import { useRef, useState } from "react";

import type { Scenario, VahanFilters } from "../contracts";

interface BatchLogEntry {
  name: string;
  status: "ok" | "empty" | "error";
  detail: string;
}

interface Props {
  onImport: (scenarios: Scenario[]) => void;
  onRunAll: (scenarios: Scenario[]) => void;
  onStop: () => void;
  running: boolean;
  progress: { done: number; total: number; current: string };
  log: BatchLogEntry[];
  disabled: boolean;
}

const REQUIRED_ARRAY_FIELDS: (keyof VahanFilters)[] = ["categoryGroups", "fuels"];
const REQUIRED_STRING_FIELDS: (keyof VahanFilters)[] = ["yAxis", "xAxis"];

function parseScenarioFile(raw: string): Scenario[] {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error("File không phải JSON hợp lệ.");
  }
  if (!Array.isArray(data)) {
    throw new Error("File phải là một mảng JSON các scenario: [{ \"name\": ..., \"filters\": {...} }, ...].");
  }

  return data.map((item, index) => {
    const label = `scenario #${index + 1}`;
    if (typeof item !== "object" || item === null) {
      throw new Error(`${label}: không phải object.`);
    }
    const { name, filters } = item as Record<string, unknown>;
    if (typeof name !== "string" || !name.trim()) {
      throw new Error(`${label}: thiếu trường "name" (string).`);
    }
    if (typeof filters !== "object" || filters === null) {
      throw new Error(`${label} ("${name}"): thiếu trường "filters" (object).`);
    }
    const filterRecord = filters as Record<string, unknown>;
    for (const field of REQUIRED_ARRAY_FIELDS) {
      if (!Array.isArray(filterRecord[field])) {
        throw new Error(`${label} ("${name}"): filters.${field} phải là mảng (có thể rỗng []).`);
      }
    }
    for (const field of REQUIRED_STRING_FIELDS) {
      if (typeof filterRecord[field] !== "string" || !(filterRecord[field] as string).trim()) {
        throw new Error(`${label} ("${name}"): filters.${field} phải là chuỗi khác rỗng.`);
      }
    }
    return { name, filters: filterRecord as unknown as VahanFilters };
  });
}

export function ScenarioImport({ onImport, onRunAll, onStop, running, progress, log, disabled }: Props) {
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [error, setError] = useState("");
  const [fileName, setFileName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setError("");
    try {
      const text = await file.text();
      const parsed = parseScenarioFile(text);
      setScenarios(parsed);
      setFileName(file.name);
      onImport(parsed);
    } catch (reason) {
      setScenarios([]);
      setFileName("");
      onImport([]);
      setError(reason instanceof Error ? reason.message : "Không đọc được file scenario.");
    }
  }

  return (
    <section className="panel scenario-import">
      <div className="panel-heading">
        <span className="step-number">S</span>
        <div>
          <h2>Import scenario</h2>
          <p>File JSON — mảng {"{ name, filters }"}, filters đúng shape VahanFilters.</p>
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="application/json,.json"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) handleFile(file);
          event.target.value = "";
        }}
        hidden
      />
      <button className="secondary-button" type="button" onClick={() => inputRef.current?.click()}>
        Chọn file scenario (.json)
      </button>

      {fileName && !error && (
        <p className="option-note">
          Đã nạp <strong>{fileName}</strong> — {scenarios.length} scenario.
        </p>
      )}
      {error && <p className="error-message">{error}</p>}

      {scenarios.length > 0 && !error && (
        <ol className="scenario-list">
          {scenarios.map((scenario, index) => (
            <li key={`${scenario.name}-${index}`}>
              <strong>{scenario.name}</strong>
              <span>
                {scenario.filters.categoryGroups.join(", ") || "—"} · fuels: {scenario.filters.fuels.join(", ") || "—"} ·
                Y={scenario.filters.yAxis} · X={scenario.filters.xAxis}
              </span>
            </li>
          ))}
        </ol>
      )}

      {scenarios.length > 0 && (
        <>
          {!running && (
            <button
              className="primary-button"
              type="button"
              disabled={disabled}
              onClick={() => onRunAll(scenarios)}
            >
              Chạy tất cả ({scenarios.length}) — tuần tự, CAPTCHA thủ công từng job
            </button>
          )}
          {running && (
            <button className="secondary-button" type="button" onClick={onStop}>
              Dừng sau job hiện tại
            </button>
          )}
        </>
      )}

      {(running || progress.total > 0) && (
        <p className="option-note">
          {running
            ? `Đang chạy ${progress.done + 1}/${progress.total}: ${progress.current}`
            : `Đã dừng ở ${progress.done}/${progress.total}.`}
        </p>
      )}

      {log.length > 0 && (
        <ol className="scenario-list batch-log">
          {log.map((entry, index) => {
            const icon = entry.status === "ok" ? "✓" : entry.status === "empty" ? "○" : "✗";
            return (
              <li key={`${entry.name}-${index}`} data-status={entry.status}>
                <strong>{icon} {entry.name}</strong>
                <span>{entry.detail}</span>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
