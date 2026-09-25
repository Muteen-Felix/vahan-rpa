import { useEffect, useState } from "react";

import type { PendingUiHealthCheck, UiHealthReportsResponse } from "../contracts";
import { api } from "../services/api-client";
import { AuthenticatedDownload } from "./AuthenticatedDownload";

const MANUAL_REPORT_POLL_INTERVAL_MS = 2_000;
const MANUAL_REPORT_POLL_TIMEOUT_MS = 90_000;

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
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
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

function diagnosticObject(value: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
}

function diagnosticReports(value: string): Array<Record<string, unknown>> {
  const parsed = diagnosticObject(value);
  return Array.isArray(parsed?.errors)
    ? parsed.errors.filter(
      (item): item is Record<string, unknown> => Boolean(item && typeof item === "object"),
    )
    : [];
}

function isResultForPendingManualCheck(row: Record<string, string>, pending: PendingUiHealthCheck) {
  if (row.trigger !== "manual-web") return false;
  const checkedAt = Date.parse(row.checked_at || "");
  const requestedAt = Date.parse(pending.requestedAt);
  return Number.isFinite(checkedAt) && Number.isFinite(requestedAt) && checkedAt >= requestedAt;
}

function reportValue(report: Record<string, unknown>, key: string) {
  const value = report[key];
  return value === undefined || value === null || value === "" ? "—" : String(value);
}

function HealthReportTable({ rows }: { rows: Array<Record<string, string>> }) {
  return (
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
        {rows.map((row) => {
          const reports = diagnosticReports(row.diagnostic_details);
          const declaredErrorCount = Number(row.error_count);
          const errorCount = Number.isFinite(declaredErrorCount) && declaredErrorCount > 0
            ? declaredErrorCount
            : reports.length || (row.status === "PASS" ? 0 : 1);
          return (
          <tr key={row.log_id}>
            <td className="report-nowrap">{formatDateTime(row.checked_at)}</td>
            <td>
              <span className={`report-status report-status-${(row.status || "CHECK_ERROR").toLowerCase()}`}>
                {statusLabels[row.status] || row.status || "Không rõ"}
              </span>
            </td>
            <td>
              <strong>
                {row.error_code || "—"}
                {errorCount > 1 && <span className="health-report-error-count"> · {errorCount} lỗi</span>}
              </strong>
              <small>{row.error_title || (row.status === "PASS" ? "Kiểm tra giao diện thành công" : "Không có lỗi")}</small>
            </td>
            <td>
              <strong>{row.target || "—"}</strong>
              <small>{row.selector || row.page_path || "—"}</small>
            </td>
            <td>
              <small><b>Expected:</b> {row.expected || "—"}</small>
              <small><b>Actual:</b> {row.actual || row.error || (row.status === "PASS" ? "UI contract khớp" : "—")}</small>
            </td>
            <td>
              <details>
                <summary>{errorCount > 1 ? `Xem ${errorCount} diagnostic` : "Xem diagnostic"}</summary>
                {reports.length > 1 && (
                  <ol className="health-report-errors">
                    {reports.map((report, index) => (
                      <li key={`${row.log_id}-error-${index}`}>
                        <strong>{reportValue(report, "code")}</strong>
                        <span>{reportValue(report, "target")}</span>
                        <small><b>Expected:</b> {reportValue(report, "expected")}</small>
                        <small><b>Actual:</b> {reportValue(report, "actual")}</small>
                      </li>
                    ))}
                  </ol>
                )}
                <pre>{diagnosticText(row.diagnostic_details)}</pre>
                <small><b>Log ID:</b> {row.log_id || "—"}</small>
                <small><b>Trigger:</b> {row.trigger || "—"} · <b>Failure:</b> {row.failure_type || "—"}</small>
                <small><b>Duration:</b> {row.duration_ms ? `${row.duration_ms} ms` : "—"} · <b>Path:</b> {row.page_path || "—"}</small>
                {row.action && <small><b>Action:</b> {row.action}</small>}
              </details>
            </td>
          </tr>
          );
        })}
      </tbody>
    </table>
  );
}

interface HealthCheckReportsProps {
  refreshToken?: number;
  pendingManualCheck?: PendingUiHealthCheck | null;
  onManualCheckSettled?: () => void;
}

export function HealthCheckReports({
  refreshToken = 0,
  pendingManualCheck = null,
  onManualCheckSettled,
}: HealthCheckReportsProps) {
  const [data, setData] = useState<UiHealthReportsResponse | null>(null);
  const [selectedDate, setSelectedDate] = useState("");
  const [showAllHistory, setShowAllHistory] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    let pollTimer: number | undefined;
    const pollingStartedAt = Date.now();

    async function loadReports(showLoading: boolean) {
      if (showLoading) {
        setLoading(true);
        setError("");
      }
      try {
        const value = await api.uiHealthReports(selectedDate || undefined);
        if (cancelled) return;
        setData(value);
        if (value.selectedDate && value.selectedDate !== selectedDate) {
          setSelectedDate(value.selectedDate);
        }
        if (
          pendingManualCheck
          && value.rows.some((row) => isResultForPendingManualCheck(row, pendingManualCheck))
        ) {
          onManualCheckSettled?.();
        }
      } catch (reason) {
        // A transient polling failure must not replace the existing report with
        // an error while the extension is still finishing its check.
        if (!cancelled && showLoading) {
          setError(reason instanceof Error ? reason.message : "Không tải được báo cáo UI health.");
        }
      } finally {
        if (!cancelled && showLoading) setLoading(false);
      }
    }

    void loadReports(true);
    if (pendingManualCheck) {
      pollTimer = window.setInterval(() => {
        if (Date.now() - pollingStartedAt >= MANUAL_REPORT_POLL_TIMEOUT_MS) {
          if (pollTimer !== undefined) window.clearInterval(pollTimer);
          return;
        }
        void loadReports(false);
      }, MANUAL_REPORT_POLL_INTERVAL_MS);
    }

    return () => {
      cancelled = true;
      if (pollTimer !== undefined) window.clearInterval(pollTimer);
    };
  }, [selectedDate, refreshToken, pendingManualCheck, onManualCheckSettled]);

  useEffect(() => {
    setShowAllHistory(false);
  }, [selectedDate, refreshToken]);

  const activeDate = selectedDate || data?.selectedDate || "";
  const selectedSummary = data?.availableDates.find((item) => item.date === activeDate);
  const selectedFiles = data?.reports.filter((report) => report.containsSelectedDate) || [];
  const historyRows = data?.rows || [];
  const visibleHistoryRows = showAllHistory ? historyRows : historyRows.slice(0, 5);
  const remainingHistoryCount = Math.max(historyRows.length - 5, 0);

  return (
    <section className="panel health-reports" id="health-reports">
      <div className="panel-heading">
        <span className="step-number">4</span>
        <div>
          <h2>Báo cáo kiểm tra theo ngày</h2>
          <p>Xem lịch sử kiểm tra và tải CSV từ backend.</p>
        </div>
      </div>

      {loading && !data && <p className="health-reports-loading">Đang tải lịch sử kiểm tra...</p>}
      {error && <p className="health-schedule-status error-message" role="alert">{error}</p>}
      {pendingManualCheck && (
        <p className="health-reports-pending" role="status">
          Đang chờ extension trả kết quả kiểm tra ngay. Thống kê và lịch sử sẽ tự cập nhật khi log được ghi nhận.
        </p>
      )}

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
              <span className="report-count-warning">
                {selectedSummary?.dataChanged || 0} lượt dữ liệu thay đổi
                {selectedSummary?.dataChangedErrors ? ` · ${selectedSummary.dataChangedErrors} lỗi` : ""}
              </span>
              <span className="report-count-error">
                {selectedSummary?.uiDrift || 0} lượt UI drift · {selectedSummary?.uiDriftErrors || 0} lỗi UI
              </span>
              <span className="report-count-error">{selectedSummary?.checkError || 0} lỗi kiểm tra</span>
            </div>
          </div>

          <div className="health-reports-downloads">
            <div className="health-report-download-title">
              <strong>CSV ngày {activeDate}</strong>
              <small>Backend lưu theo cửa sổ tối đa 10 ngày hoặc 512 KiB.</small>
            </div>
            <div className="health-report-links">
              {selectedFiles.length > 0 ? selectedFiles.map((report) => (
                <div className="health-report-file" key={report.fileName}>
                  <span className="health-report-file-name" title={report.fileName}>{report.fileName}</span>
                  <small>{formatBytes(report.sizeBytes)}</small>
                  <AuthenticatedDownload
                    className="secondary-button health-report-download"
                    path={report.downloadUrl}
                    fileName={report.fileName}
                  >
                    Tải CSV
                  </AuthenticatedDownload>
                </div>
              )) : <span className="health-reports-empty">Không tìm thấy file CSV cho ngày này.</span>}
            </div>
          </div>

          {historyRows.length > 0 ? (
            <>
              <div className="health-report-log health-report-history">
                <div className="health-report-log-heading">
                  <div>
                    <strong>Lịch sử kiểm tra</strong>
                    <small>
                      Hiển thị {visibleHistoryRows.length}/{historyRows.length} bản ghi, gồm cả kết quả của nút “Kiểm tra ngay”.
                    </small>
                  </div>
                  {remainingHistoryCount > 0 && (
                    <button
                      className="secondary-button health-report-more-button"
                      type="button"
                      aria-controls="health-report-history"
                      aria-expanded={showAllHistory}
                      onClick={() => setShowAllHistory((current) => !current)}
                    >
                      {showAllHistory ? "Thu gọn" : `Xem thêm (${remainingHistoryCount})`}
                    </button>
                  )}
                </div>
                <div
                  className={`health-report-table-wrap ${showAllHistory ? "is-expanded" : "is-collapsed"}`}
                  id="health-report-history"
                >
                  <HealthReportTable rows={visibleHistoryRows} />
                </div>
              </div>

            </>
          ) : <p className="health-reports-empty">Ngày này chưa có bản ghi.</p>}
        </>
      )}
    </section>
  );
}
