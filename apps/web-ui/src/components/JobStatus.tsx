import type { Job, JobStatus as Status } from "../contracts";

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

export function JobStatus({ job, onCancel }: { job: Job | null; onCancel: () => void }) {
  if (!job) return null;
  const terminal = ["COMPLETED", "FAILED", "CANCELLED"].includes(job.status);

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
      {!terminal && <button className="secondary-button" onClick={onCancel}>Hủy job</button>}
    </section>
  );
}
