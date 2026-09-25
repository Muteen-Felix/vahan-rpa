import { useEffect, useRef, useState } from "react";

import type { Scenario, VahanFilters } from "../contracts";
import { api } from "../services/api-client";

interface BatchLogEntry {
  index: number;
  name: string;
  status: "ok" | "empty" | "error";
  detail: string;
  jobId?: string;
  excelFileName?: string | null;
}

interface Props {
  onImport: (scenarios: Scenario[]) => void;
  onRunAll: (scenarios: Scenario[]) => void;
  onRunFrom: (index: number) => void;
  onRetryFailed: () => void;
  onStop: () => void;
  running: boolean;
  progress: { done: number; total: number; current: string };
  batchStatus: "idle" | "running" | "completed" | "completed_with_errors" | "stopped" | "error";
  log: BatchLogEntry[];
  failedAtIndex: number | null;
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

export function ScenarioImport({
  onImport, onRunAll, onRunFrom, onRetryFailed, onStop, running, progress,
  batchStatus, log, failedAtIndex, disabled,
}: Props) {
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [selectedStartIndex, setSelectedStartIndex] = useState(0);
  const [error, setError] = useState("");
  const [fileName, setFileName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (failedAtIndex === null || !scenarios.length) {
      setSelectedStartIndex(0);
      return;
    }
    setSelectedStartIndex(failedAtIndex + 1 < scenarios.length ? failedAtIndex + 1 : failedAtIndex);
  }, [failedAtIndex, scenarios.length]);

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

  function clearScenarioFile() {
    setScenarios([]);
    setFileName("");
    setError("");
    onImport([]);
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
      {scenarios.length > 0 && !error && (
        <p className="option-note" role="status">
          Đang chạy theo cấu hình trong JSON. Phần “Cấu hình báo cáo” bên dưới đã được bỏ qua.
        </p>
      )}
      {scenarios.length > 0 && !error && (
        <p className="option-note">
          Case lỗi được tự bỏ qua để chạy tiếp. Bạn có thể chọn case bắt đầu hoặc chạy lại case lỗi gần nhất.
        </p>
      )}
      {error && <p className="error-message">{error}</p>}

      {fileName && !running && !error && (
        <button className="secondary-button" type="button" onClick={clearScenarioFile}>
          Bỏ JSON, dùng cấu hình thủ công
        </button>
      )}

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
          {!running && (
            <label className="scenario-start-select">
              Chọn case để chạy tiếp từ
              <select
                value={selectedStartIndex}
                disabled={disabled}
                onChange={(event) => setSelectedStartIndex(Number(event.target.value))}
              >
                {scenarios.map((scenario, index) => (
                  <option key={scenario.name + "-" + index} value={index}>
                    Case {index + 1}: {scenario.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          {!running && (
            <button className="secondary-button scenario-continue-button" type="button" disabled={disabled} onClick={() => onRunFrom(selectedStartIndex)}>
              Chạy từ case đã chọn
            </button>
          )}
          {!running && failedAtIndex !== null && scenarios[failedAtIndex] && (
            <button className="retry-button" type="button" disabled={disabled} onClick={onRetryFailed}>
              <span className="retry-icon" aria-hidden="true">↻</span>
              Chạy lại case lỗi #{failedAtIndex + 1}
            </button>
          )}
        </>
      )}

      {(running || progress.total > 0) && (
        <p className="option-note">
          {running
            ? `Đang chạy ${progress.done + 1}/${progress.total}: ${progress.current}`
            : batchStatus === "completed"
              ? `Đã hoàn tất ${progress.done}/${progress.total}.`
              : batchStatus === "completed_with_errors"
                ? `Đã chạy ${progress.done}/${progress.total}; ${log.filter((entry) => entry.status === "error").length} case lỗi đã được bỏ qua.`
              : batchStatus === "stopped"
                ? `Đã dừng ở ${progress.done}/${progress.total}.`
                : batchStatus === "error"
                  ? `Đã dừng do lỗi ở ${progress.done}/${progress.total}.`
                  : `Sẵn sàng chạy ${progress.total} scenario.`}
        </p>
      )}

      {log.length > 0 && (
        <ol className="scenario-list batch-log">
          {log.map((entry, index) => {
            const icon = entry.status === "ok" ? "✓" : entry.status === "empty" ? "○" : "✗";
            return (
              <li key={entry.index + "-" + index} data-status={entry.status}>
                <strong>{icon} {entry.name}</strong>
                <span>{entry.detail}</span>
                {entry.excelFileName && entry.jobId && (
                  <div>
                    <a
                      href={api.excelDownloadUrl(entry.jobId)}
                      download={entry.excelFileName}
                      className="batch-excel-link"
                    >
                      📥 Tải Excel
                    </a>
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
