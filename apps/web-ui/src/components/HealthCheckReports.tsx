import { useEffect, useState } from "react";

import type { UiHealthReportsResponse } from "../contracts";
import { API_URL, api } from "../services/api-client";

const statusLabels: Record<string, string> = {
  PASS: "Bình thường",
  DATA_CHANGED: "Dữ liệu thay đổi",
  UI_DRIFT: "Giao diện thay đổi",
  CHECK_ERROR: "Lỗi kiểm tra",
};

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatBytes(value: number) {
  if (value < 1024) return `${value} B`;
  return `${(value / 1024).toFixed(1)} KiB`;
}

function diagnosticText(value: string) {
  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    return value || "Không có diagnostic chi tiết.";
  }
}

export function HealthCheckReports() {
  const [data, setData] = useState<UiHealthReportsResponse | null>(null);
  const [selectedDate, setSelectedDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    api.uiHealthReports(selectedDate || undefined)
      .then((value) => {
        if (cancelled) return;
        setData(value);
        if (value.selectedDate && value.selectedDate !== selectedDate) {
          setSelectedDate(value.selectedDate);
        }
      })
      .catch((reason) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "Không tải được báo cáo UI health.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [selectedDate]);

  const activeDate = selectedDate || data?.selectedDate || "";
  const selectedSummary = data?.availableDates.find((item) => item.date === activeDate);
  const selectedFiles = data?.reports.filter((report) => report.containsSelectedDate) || [];

  return (
    <section className="panel health-reports" id="health-reports">
      <div className="panel-heading">
        <span className="step-number">4</span>
        <div>
          <h2>Báo cáo kiểm tra theo ngày</h2>
          <p>Xem chi tiết lỗi và tải CSV từ backend.</p>
        </div>
      </div>

      {loading && !data && <p className="health-reports-loading">Đang tải lịch sử kiểm tra...</p>}
      {error && <p className="health-schedule-status error-message" role="alert">{error}</p>}

      {data && data.availableDates.length === 0 && !loading && (
        <p className="health-reports-empty">Chưa có log kiểm tra nào từ extension.</p>
      )}

      {data && data.availableDates.length > 0 && (
        <>
          <div className="health-reports-toolbar">
            <label htmlFor="health-report-date">
              Ngày kiểm tra
              <select
                id="health-report-date"
                value={activeDate}
                onChange={(event) => setSelectedDate(event.currentTarget.value)}
                disabled={loading}
              >
                {data.availableDates.map((summary) => (
                  <option key={summary.date} value={summary.date}>
                    {summary.date} · {summary.total} lần kiểm tra
                  </option>
                ))}
              </select>
            </label>
            <div className="health-report-summary" aria-label="Tóm tắt ngày được chọn">
              <span><strong>{data.rows.length}</strong> bản ghi</span>
              <span className="report-count-pass">{selectedSummary?.pass || 0} bình thường</span>
              <span className="report-count-warning">{selectedSummary?.dataChanged || 0} dữ liệu thay đổi</span>
              <span className="report-count-error">{selectedSummary?.uiDrift || 0} UI drift</span>
              <span className="report-count-error">{selectedSummary?.checkError || 0} lỗi kiểm tra</span>
            </div>
          </div>

          <div className="health-reports-downloads">
            <div>
              <strong>File CSV chứa ngày {activeDate}</strong>
              <small>Backend lưu theo cửa sổ tối đa 10 ngày hoặc 512 KiB.</small>
            </div>
            <div className="health-report-links">
              {selectedFiles.length > 0 ? selectedFiles.map((report) => (
                <a
                  key={report.fileName}
                  className="secondary-button health-report-download"
                  href={`${API_URL}${report.downloadUrl}`}
                  download={report.fileName}
                >
                  Tải {report.fileName} · {formatBytes(report.sizeBytes)}
                </a>
              )) : <span className="health-reports-empty">Không tìm thấy file CSV cho ngày này.</span>}
            </div>
          </div>

          {data.rows.length > 0 ? (
            <div className="health-report-table-wrap">
              <table className="health-report-table">
                <thead>
                  <tr>
                    <th>Thời điểm</th>
                    <th>Trạng thái</th>
                    <th>Mã lỗi / tiêu đề</th>
                    <th>Đối tượng</th>
                    <th>Expected / Actual</th>
                    <th>Chi tiết</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((row) => (
                    <tr key={row.log_id}>
                      <td className="report-nowrap">{formatDateTime(row.checked_at)}</td>
                      <td><span className={`report-status report-status-${row.status.toLowerCase()}`}>{statusLabels[row.status] || row.status}</span></td>
                      <td>
                        <strong>{row.error_code || "—"}</strong>
                        <small>{row.error_title || "Không có lỗi"}</small>
                      </td>
                      <td>
                        <strong>{row.target || "—"}</strong>
                        <small>{row.selector || row.page_path || "—"}</small>
                      </td>
                      <td>
                        <small><b>Expected:</b> {row.expected || "—"}</small>
                        <small><b>Actual:</b> {row.actual || row.error || "—"}</small>
                      </td>
                      <td>
                        <details>
                          <summary>Xem diagnostic</summary>
                          <pre>{diagnosticText(row.diagnostic_details)}</pre>
                          <small><b>Log ID:</b> {row.log_id || "—"}</small>
                          <small><b>Trigger:</b> {row.trigger || "—"} · <b>Failure:</b> {row.failure_type || "—"}</small>
                          <small><b>Duration:</b> {row.duration_ms ? `${row.duration_ms} ms` : "—"} · <b>Path:</b> {row.page_path || "—"}</small>
                          {row.action && <small><b>Action:</b> {row.action}</small>}
                        </details>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p className="health-reports-empty">Ngày này chưa có bản ghi.</p>}
        </>
      )}
    </section>
  );
}
