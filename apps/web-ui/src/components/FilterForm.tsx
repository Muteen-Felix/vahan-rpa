import { useState, type FormEvent } from "react";

import type { Runner, VahanFilters } from "../contracts";

interface Props {
  runners: Runner[];
  busy: boolean;
  onSubmit: (runnerId: string, filters: VahanFilters) => Promise<void>;
}

const csv = (value: string) => value.split(",").map((item) => item.trim()).filter(Boolean);

export function FilterForm({ runners, busy, onSubmit }: Props) {
  const available = runners.filter((runner) => runner.status === "ONLINE" && !runner.currentJobId);
  const [runnerId, setRunnerId] = useState("");
  const [state, setState] = useState("Delhi");
  const [rto, setRto] = useState("DWARKA - DL9");
  const [category, setCategory] = useState("Two Wheeler");
  const [fuel, setFuel] = useState("ELECTRIC(BOV)");
  const [yAxis, setYAxis] = useState("Vehicle Class");
  const [xAxis, setXAxis] = useState("Month Wise");
  const [autoApply, setAutoApply] = useState(true);
  const [autoExport, setAutoExport] = useState(true);

  const selectedRunner = available.some((runner) => runner.id === runnerId)
    ? runnerId
    : available[0]?.id || "";

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!selectedRunner) return;
    await onSubmit(selectedRunner, {
      states: csv(state),
      rtos: csv(rto),
      categoryGroups: csv(category),
      fuels: csv(fuel),
      yAxis,
      xAxis,
      autoApply,
      autoExport,
    });
  }

  return (
    <form className="panel filter-form" onSubmit={submit}>
      <div className="panel-heading">
        <span className="step-number">1</span>
        <div><h2>Cấu hình báo cáo</h2><p>Nhập nhiều giá trị bằng dấu phẩy.</p></div>
      </div>

      <label>Extension runner
        <select value={selectedRunner} onChange={(event) => setRunnerId(event.target.value)} disabled={busy}>
          {!available.length && <option value="">Chưa có extension khả dụng</option>}
          {available.map((runner) => <option key={runner.id} value={runner.id}>{runner.name} · {runner.id}</option>)}
        </select>
      </label>

      <div className="form-grid">
        <label>State<input value={state} onChange={(event) => setState(event.target.value)} /></label>
        <label>RTO<input value={rto} onChange={(event) => setRto(event.target.value)} /></label>
        <label>Category Group<input value={category} onChange={(event) => setCategory(event.target.value)} /></label>
        <label>Fuel<input value={fuel} onChange={(event) => setFuel(event.target.value)} /></label>
        <label>Y-Axis<input value={yAxis} onChange={(event) => setYAxis(event.target.value)} /></label>
        <label>X-Axis<input value={xAxis} onChange={(event) => setXAxis(event.target.value)} /></label>
      </div>

      <div className="checks">
        <label><input type="checkbox" checked={autoApply} onChange={(event) => setAutoApply(event.target.checked)} /> Tự động Apply sau khi nhập CAPTCHA</label>
        <label><input type="checkbox" checked={autoExport} onChange={(event) => setAutoExport(event.target.checked)} /> Tự động tải Excel</label>
      </div>

      <button className="primary-button" disabled={busy || !selectedRunner}>
        {busy ? "Đang tạo job..." : "▶ Fill Filter"}
      </button>
    </form>
  );
}
