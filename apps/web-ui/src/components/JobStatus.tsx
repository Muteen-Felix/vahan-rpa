import type { Job, JobStatus as Status } from "../contracts";
import { api } from "../services/api-client";

const labels: Record<Status, string> = {
  QUEUED: "Đang xếp hàng",
  ASSIGNED: "Đã giao cho extension",
  OPENING_VAHAN: "Đang mở VAHAN",
  FILLING_FILTERS: "Đang điền bộ lọc",
  WAITING_CAPTCHA: "Đang chờ CAPTCHA",
  SUBMITTING: "Đang gửi CAPTCHA",
  WAITING_RESULT: "Đang chờ kết quả",
  COMPLETED: "Hoàn tất",
  FAILED: "Thất bại",
  CANCELLED: "Đã hủy",
};

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function JobStatus({ job, onCancel }: { job: Job | null; onCancel: () => void }) {
  if (!job) return null;
  const terminal = ["COMPLETED", "FAILED", "CANCELLED"].includes(job.status);
  const hasExcel = job.status === "COMPLETED" && !!job.excelFileName;

  return (
    <section className="panel job-panel">
      <div className="panel-heading">
        <span className="step-number">2</span>
        <div><h2>Tiến trình</h2><p className="job-id">Job {job.id}</p></div>
      </div>
      <div className="job-state" data-state={job.status}>
        <span className="pulse" />
        <strong>{labels[job.status]}</strong>
      </div>
      {job.error && <p className="error-message">{job.error}</p>}
      {hasExcel && (
        <div className="job-excel-download">
          <a
            className="primary-button"
            href={api.excelDownloadUrl(job.id)}
            download={job.excelFileName || "report.xlsx"}
          >
            📥 Tải báo cáo Excel
          </a>
          <p className="job-excel-meta">
            {job.excelFileName}
            {job.excelFileSize != null && ` · ${formatSize(job.excelFileSize)}`}
          </p>
        </div>
      )}
      {!terminal && <button className="secondary-button" onClick={onCancel}>Hủy job</button>}
    </section>
  );
}
