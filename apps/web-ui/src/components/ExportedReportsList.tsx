import { useEffect, useState } from "react";

import type { ExportedReportItem } from "../contracts";
import { AuthenticatedDownload } from "./AuthenticatedDownload";
import { api } from "../services/api-client";

function formatSize(bytes: number): string {
  if (!bytes) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

export function ExportedReportsList({ refreshTrigger }: { refreshTrigger?: number }) {
  const [reports, setReports] = useState<ExportedReportItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadReports() {
    setLoading(true);
    setError("");
    try {
      const data = await api.exportedReports();
      setReports(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không tải được danh sách báo cáo.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadReports();
  }, [refreshTrigger]);

  return (
    <section className="panel exported-reports-panel">
      <div className="panel-heading" style={{ justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "13px" }}>
          <span className="step-number" style={{ background: "#ecfdf3", color: "#137a37", borderColor: "#16a34a" }}>✓</span>
          <div>
            <h2>Báo cáo đã xuất ({reports.length})</h2>
            <p>Các file Excel đã lưu trữ an toàn trên máy chủ của bạn</p>
          </div>
        </div>
        <button
          className="secondary-button"
          type="button"
          style={{ width: "auto", minHeight: "36px", padding: "6px 14px", marginTop: 0 }}
          onClick={loadReports}
          disabled={loading}
        >
          {loading ? "Đang tải..." : "🔄 Làm mới"}
        </button>
      </div>

      {error && <p className="error-message" style={{ marginTop: "14px" }}>{error}</p>}

      {reports.length === 0 && !loading && (
        <p className="health-reports-empty" style={{ margin: "18px 0 0" }}>
          Chưa có báo cáo nào được xuất. Khi bạn chạy kịch bản và hoàn tất, các file Excel sẽ tự động xuất hiện tại đây.
        </p>
      )}

      {reports.length > 0 && (
        <div className="health-report-table-wrap" style={{ marginTop: "18px" }}>
          <table className="health-report-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Kịch bản / Tên file</th>
                <th>Dung lượng</th>
                <th>Thời gian xuất</th>
                <th style={{ textAlign: "right" }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((report, idx) => (
                <tr key={report.jobId}>
                  <td style={{ width: "40px", color: "var(--muted)" }}>{idx + 1}</td>
                  <td>
                    <strong style={{ color: "var(--navy)", fontSize: "12px" }}>{report.scenarioName}</strong>
                    <small style={{ color: "var(--muted)", fontFamily: "monospace" }}>{report.fileName}</small>
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <span style={{ fontWeight: 600, color: "#137a37" }}>{formatSize(report.fileSize)}</span>
                  </td>
                  <td style={{ whiteSpace: "nowrap", color: "var(--muted)" }}>
                    {formatDate(report.createdAt)}
                  </td>
                  <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                    <AuthenticatedDownload
                      className="primary-button"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        width: "auto",
                        minHeight: "34px",
                        padding: "6px 14px",
                        textDecoration: "none",
                        fontSize: "11px",
                      }}
                      path={report.downloadUrl}
                      fileName={report.fileName}
                    >
                      📥 Tải xuống
                    </AuthenticatedDownload>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
