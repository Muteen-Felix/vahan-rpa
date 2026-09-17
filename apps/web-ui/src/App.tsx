import { useEffect, useState } from "react";

import { CaptchaPanel } from "./components/CaptchaPanel";
import { ConnectionBanner } from "./components/ConnectionBanner";
import { FilterForm } from "./components/FilterForm";
import { HealthCheckReports } from "./components/HealthCheckReports";
import { HealthCheckSchedule } from "./components/HealthCheckSchedule";
import { JobStatus } from "./components/JobStatus";
import type { Acknowledgement, CaptchaChallenge, ConnectionState, Job, Runner, VahanFilters } from "./contracts";
import { api } from "./services/api-client";
import { uiSocket } from "./services/socket-client";

const ACTIVE_JOB_STORAGE_KEY = "vahanActiveJobId";

export default function App() {
  const [connection, setConnection] = useState<ConnectionState>("connecting");
  const [runners, setRunners] = useState<Runner[]>([]);
  const [job, setJob] = useState<Job | null>(null);
  const [captcha, setCaptcha] = useState<CaptchaChallenge | null>(null);
  const [creating, setCreating] = useState(false);
  const [submittingCaptcha, setSubmittingCaptcha] = useState(false);
  const [error, setError] = useState("");

  async function refreshRunners() {
    try {
      setRunners(await api.runners());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không tải được danh sách runner.");
    }
  }

  async function subscribeJob(jobId: string) {
    const acknowledgement = await uiSocket.timeout(5_000).emitWithAck(
      "ui:subscribe-job", { jobId },
    ) as Acknowledgement;
    if (!acknowledgement.ok) throw new Error(acknowledgement.error || "Không subscribe được job.");
    if (acknowledgement.job) {
      setJob(acknowledgement.job);
      if (["COMPLETED", "FAILED", "CANCELLED"].includes(acknowledgement.job.status)) {
        localStorage.removeItem(ACTIVE_JOB_STORAGE_KEY);
      }
    }
    if (acknowledgement.captcha) setCaptcha({ ...acknowledgement.captcha, invalid: false });
  }

  useEffect(() => {
    const onConnect = () => {
      setConnection("connected");
      refreshRunners();
      const activeJobId = localStorage.getItem(ACTIVE_JOB_STORAGE_KEY);
      if (activeJobId) subscribeJob(activeJobId).catch((reason) => {
        setError(reason instanceof Error ? reason.message : "Không thể khôi phục job.");
      });
    };
    const onDisconnect = () => setConnection("disconnected");
    const onConnectError = () => setConnection("error");
    const onRunnerChange = () => refreshRunners();
    const onJobStatus = (updated: Job) => {
      setJob(updated);
      if (["COMPLETED", "FAILED", "CANCELLED"].includes(updated.status)) {
        localStorage.removeItem(ACTIVE_JOB_STORAGE_KEY);
        setCaptcha(null);
        refreshRunners();
      }
    };
    const onCaptcha = (challenge: CaptchaChallenge) => setCaptcha({ ...challenge, invalid: false });
    const onCaptchaInvalid = (challenge: CaptchaChallenge) => setCaptcha({ ...challenge, invalid: true });
    const onCaptchaRefreshed = (challenge: CaptchaChallenge) => setCaptcha({ ...challenge, invalid: false, refreshed: true });

    uiSocket.on("connect", onConnect);
    uiSocket.on("disconnect", onDisconnect);
    uiSocket.on("connect_error", onConnectError);
    uiSocket.on("runner:online", onRunnerChange);
    uiSocket.on("runner:offline", onRunnerChange);
    uiSocket.on("job:status", onJobStatus);
    uiSocket.on("captcha:required", onCaptcha);
    uiSocket.on("captcha:invalid", onCaptchaInvalid);
    uiSocket.on("captcha:refreshed", onCaptchaRefreshed);
    uiSocket.connect();

    return () => {
      uiSocket.off("connect", onConnect);
      uiSocket.off("disconnect", onDisconnect);
      uiSocket.off("connect_error", onConnectError);
      uiSocket.off("runner:online", onRunnerChange);
      uiSocket.off("runner:offline", onRunnerChange);
      uiSocket.off("job:status", onJobStatus);
      uiSocket.off("captcha:required", onCaptcha);
      uiSocket.off("captcha:invalid", onCaptchaInvalid);
      uiSocket.off("captcha:refreshed", onCaptchaRefreshed);
      uiSocket.disconnect();
    };
  }, []);

  async function createJob(runnerId: string, filters: VahanFilters) {
    setCreating(true);
    setError("");
    setCaptcha(null);
    try {
      const created = await api.createJob(runnerId, filters);
      setJob(created);
      localStorage.setItem(ACTIVE_JOB_STORAGE_KEY, created.id);
      await subscribeJob(created.id);
      await refreshRunners();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không tạo được job.");
    } finally {
      setCreating(false);
    }
  }

  async function submitCaptcha(value: string) {
    if (!job || !captcha) return;
    setSubmittingCaptcha(true);
    setError("");
    try {
      const acknowledgement = await uiSocket.timeout(5_000).emitWithAck(
        "captcha:submitted",
        { jobId: job.id, captchaId: captcha.captchaId, value },
      ) as Acknowledgement;
      if (!acknowledgement.ok) throw new Error(acknowledgement.error || "Không gửi được CAPTCHA.");
      setCaptcha(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không gửi được CAPTCHA.");
    } finally {
      setSubmittingCaptcha(false);
    }
  }

  async function cancelJob() {
    if (!job) return;
    try {
      setJob(await api.cancelJob(job.id));
      localStorage.removeItem(ACTIVE_JOB_STORAGE_KEY);
      setCaptcha(null);
      await refreshRunners();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không hủy được job.");
    }
  }

  return (
    <div className="app-shell">
      <header className="site-header">
        <a className="brand" href="#top" aria-label="VAHAN Automation home">
          <span className="brand-mark">V</span>
          <span className="brand-copy"><strong>VAHAN</strong><small>REPORT AUTOMATION</small></span>
        </a>
        <nav className="main-nav" aria-label="Điều hướng chính">
          <a href="#configure">Cấu hình</a>
          <a href="#activity">Tiến trình</a>
          <span className="attended-badge">ATTENDED RPA</span>
        </nav>
      </header>

      <section className="hero" id="top">
        <div className="hero-glow" aria-hidden="true" />
        <div className="hero-content">
          <p className="eyebrow">VAHAN DATA OPERATIONS</p>
          <h1>Report automation.<br /><span>Human verified.</span></h1>
          <p className="hero-description">Điều phối bộ lọc, CAPTCHA và báo cáo VAHAN trong một không gian vận hành tập trung.</p>
          <div className="hero-meta">
            <ConnectionBanner backend={connection} runners={runners.length} />
            <span className="secure-note">Manual CAPTCHA · Secure by design</span>
          </div>
        </div>
        <div className="hero-visual" aria-hidden="true"><span>V</span><i /></div>
      </section>

      <main className="page-content">
        <div className="section-intro" id="configure">
          <div><p className="eyebrow dark">CONTROL CENTER</p><h2>Tạo báo cáo mới</h2></div>
          <p>Chọn dữ liệu trực tiếp từ phiên VAHAN đang kết nối, sau đó theo dõi toàn bộ tiến trình theo thời gian thực.</p>
        </div>

        {error && <div className="global-error" role="alert">{error}<button onClick={() => setError("")}>×</button></div>}

        <HealthCheckSchedule />
        <HealthCheckReports />

        <div className="workspace">
          <FilterForm runners={runners} busy={creating || Boolean(job && !["COMPLETED", "FAILED", "CANCELLED"].includes(job.status))} onSubmit={createJob} />
          <div className="right-column" id="activity">
            <JobStatus job={job} onCancel={cancelJob} />
            <CaptchaPanel challenge={captcha} submitting={submittingCaptcha} autoApply={job?.filters.autoApply ?? false} onSubmit={submitCaptcha} />
            {!job && <section className="empty-state"><span>01</span><h2>Sẵn sàng khởi tạo</h2><p>Chọn extension và cấu hình bộ lọc để bắt đầu quy trình báo cáo.</p></section>}
          </div>
        </div>
      </main>

      <footer><span>VAHAN REPORT AUTOMATION</span><span>Attended workflow · 2026</span></footer>
    </div>
  );
}
