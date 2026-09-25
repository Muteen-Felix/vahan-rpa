import type { Job, JobStatus as Status } from "../contracts";
import { AuthenticatedDownload } from "./AuthenticatedDownload";

const labels: Record<Status, string> = {
  QUEUED: "Đang xếp hàng",
  ASSIGNED: "Đã giao cho extension",
  OPENING_VAHAN: "Đang mở VAHAN",
  CAPTURING_CAPTCHA: "Đang lấy CAPTCHA",
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

interface ParsedJobError {
  title?: string;
  detail: string;
  suggestion?: string;
}

function parseJobError(rawError: string): ParsedJobError {
  const error = String(rawError || "").trim();

  if (error.includes("VAHAN_SESSION_EXPIRED") || error.includes("Session Timeout")) {
    return {
      title: "Phiên làm việc VAHAN đã hết hạn (Session Timeout)",
      detail: "Máy chủ VAHAN đã hủy phiên làm việc do tab đã mở lâu không có tương tác.",
      suggestion: "Vui lòng tải lại trang VAHAN trên trình duyệt và thử chạy lại.",
    };
  }

  if (error.includes("VAHAN_AUTH_REQUIRED") || error.includes("401")) {
    return {
      title: "VAHAN yêu cầu xác thực hoặc phiên đã hết hạn (HTTP 401)",
      detail: error.replace(/^VAHAN_AUTH_REQUIRED:\s*/i, ""),
      suggestion: "Đóng hộp thoại đăng nhập (nếu có), mở lại trang VAHAN chính thức và thử lại.",
    };
  }

  if (error.includes("VAHAN_UNREACHABLE") || error.includes("chrome-error") || error.includes("Lỗi kết nối")) {
    return {
      title: "Không thể kết nối đến trang VAHAN (Site Unreachable)",
      detail: error.replace(/^VAHAN_UNREACHABLE:\s*/i, ""),
      suggestion: "Kiểm tra kết nối Internet của máy hoặc truy cập thử https://analytics.parivahan.gov.in xem trang có đang bảo trì không.",
    };
  }

  if (error.includes("VAHAN_SERVER_ERROR") || error.includes("HTTP 5")) {
    return {
      title: "Máy chủ VAHAN gặp sự cố (Server Error)",
      detail: error.replace(/^VAHAN_SERVER_ERROR:\s*/i, ""),
      suggestion: "Cổng thông tin VAHAN đang gặp sự cố nội bộ. Vui lòng chờ ít phút rồi thử lại.",
    };
  }

  if (error.includes("Receiving end does not exist")) {
    return {
      title: "Mất kết nối với tab VAHAN",
      detail: "Extension không thể liên lạc với script trong tab VAHAN (tab có thể đã bị đóng hoặc chuyển sang trang khác).",
      suggestion: "Hãy đảm bảo tab VAHAN đang mở đúng trang Public Report và tải lại tab.",
    };
  }

  if (error.startsWith("NO_RECORD_FOUND")) {
    return {
      title: "Không có dữ liệu",
      detail: error.replace(/^NO_RECORD_FOUND:\s*/, ""),
      suggestion: "Hãy thử nới lỏng hoặc thay đổi các tiêu chí lọc.",
    };
  }

  return {
    detail: error,
  };
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
      {job.error && (() => {
        const parsed = parseJobError(job.error);
        return (
          <div className="job-error-box error-message">
            {parsed.title && <strong className="job-error-title">{parsed.title}</strong>}
            <p className="job-error-detail">{parsed.detail}</p>
            {parsed.suggestion && <p className="job-error-suggestion">💡 <em>Gợi ý: {parsed.suggestion}</em></p>}
          </div>
        );
      })()}
      {hasExcel && (
        <div className="job-excel-download">
          <AuthenticatedDownload
            className="primary-button"
            path={`/api/jobs/${job.id}/excel`}
            fileName={job.excelFileName || "report.xlsx"}
          >
            📥 Tải báo cáo Excel
          </AuthenticatedDownload>
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
