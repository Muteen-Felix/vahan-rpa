import { useEffect, useState, type FormEvent } from "react";

import type { UiHealthSchedule } from "../contracts";
import { api } from "../services/api-client";

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function HealthCheckSchedule() {
  const [schedule, setSchedule] = useState<UiHealthSchedule | null>(null);
  const [days, setDays] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.uiHealthSchedule()
      .then((value) => {
        if (cancelled) return;
        setSchedule(value);
        setDays(String(value.intervalDays));
      })
      .catch((reason) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "Không tải được lịch kiểm tra.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  async function saveSchedule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const intervalDays = Number(days.trim());
    if (!Number.isInteger(intervalDays) || intervalDays < 1 || intervalDays > 365) {
      setError("Số ngày phải là số nguyên từ 1 đến 365.");
      setNotice("");
      return;
    }

    setSaving(true);
    setError("");
    setNotice("");
    try {
      const updated = await api.updateUiHealthSchedule(intervalDays);
      setSchedule(updated);
      setDays(String(updated.intervalDays));
      setNotice(`Đã lưu lịch kiểm tra mỗi ${updated.intervalDays} ngày.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không lưu được lịch kiểm tra.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="panel health-schedule" id="health-check">
      <div className="panel-heading">
        <span className="step-number">0</span>
        <div>
          <h2>Lịch kiểm tra giao diện</h2>
          <p>Tự động kiểm tra trang VAHAN và ghi log CSV.</p>
        </div>
      </div>

      <form className="health-schedule-form" onSubmit={saveSchedule}>
        <label htmlFor="health-check-days">
          Kiểm tra lại sau
          <span className="health-schedule-input-row">
            <input
              className="health-schedule-input"
              id="health-check-days"
              type="number"
              min="1"
              max="365"
              step="1"
              value={days}
              disabled={loading || saving}
              onChange={(event) => setDays(event.currentTarget.value)}
              placeholder="3"
            />
            <span className="health-schedule-unit">ngày</span>
          </span>
        </label>
        <button className="primary-button" type="submit" disabled={loading || saving}>
          {saving ? "Đang lưu..." : "Lưu lịch kiểm tra"}
        </button>
      </form>

      {notice && <p className="health-schedule-status success" role="status">{notice}</p>}
      {error && <p className="health-schedule-status error-message" role="alert">{error}</p>}
      {schedule && (
        <div className="health-schedule-meta">
          <span>Chu kỳ hiện tại: <strong>{schedule.intervalDays} ngày</strong></span>
          <span>Lần kiểm tra dự kiến: <strong>{formatDate(schedule.nextCheckAt)}</strong></span>
        </div>
      )}
      <p className="security-note health-schedule-note">
        Extension sẽ nhận lịch mới và đặt lại tác vụ kiểm tra tự động. Kiểm tra chỉ đọc giao diện,
        không điền CAPTCHA và không bấm Apply.
      </p>
    </section>
  );
}
