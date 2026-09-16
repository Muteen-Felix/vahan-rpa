import { useEffect, useState } from "react";

import { CaptchaPanel } from "./components/CaptchaPanel";
import { ConnectionBanner } from "./components/ConnectionBanner";
import { FilterForm } from "./components/FilterForm";
import { JobStatus } from "./components/JobStatus";
import type { Acknowledgement, CaptchaChallenge, ConnectionState, Job, Runner, VahanFilters } from "./contracts";
import { api } from "./services/api-client";
import { uiSocket } from "./services/socket-client";

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

  useEffect(() => {
    const onConnect = () => { setConnection("connected"); refreshRunners(); };
    const onDisconnect = () => setConnection("disconnected");
    const onConnectError = () => setConnection("error");
    const onRunnerChange = () => refreshRunners();
    const onJobStatus = (updated: Job) => setJob(updated);
    const onCaptcha = (challenge: CaptchaChallenge) => setCaptcha({ ...challenge, invalid: false });
    const onCaptchaInvalid = (challenge: CaptchaChallenge) => setCaptcha({ ...challenge, invalid: true });

    uiSocket.on("connect", onConnect);
    uiSocket.on("disconnect", onDisconnect);
    uiSocket.on("connect_error", onConnectError);
    uiSocket.on("runner:online", onRunnerChange);
    uiSocket.on("runner:offline", onRunnerChange);
    uiSocket.on("job:status", onJobStatus);
    uiSocket.on("captcha:required", onCaptcha);
    uiSocket.on("captcha:invalid", onCaptchaInvalid);
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
      const acknowledgement = await uiSocket.timeout(5_000).emitWithAck(
        "ui:subscribe-job",
        { jobId: created.id },
      ) as Acknowledgement;
      if (!acknowledgement.ok) throw new Error(acknowledgement.error || "Không subscribe được job.");
      if (acknowledgement.job) setJob(acknowledgement.job);
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
      setCaptcha(null);
      await refreshRunners();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không hủy được job.");
    }
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand"><span>🤖</span><div><h1>VAHAN Report Tool</h1><p>Attended RPA Control Center</p></div></div>
        <span className="attended-badge">Attended</span>
      </header>

      <ConnectionBanner backend={connection} runners={runners.length} />
      {error && <div className="global-error" role="alert">{error}<button onClick={() => setError("")}>×</button></div>}

      <div className="workspace">
        <FilterForm runners={runners} busy={creating || Boolean(job && !["COMPLETED", "FAILED", "CANCELLED"].includes(job.status))} onSubmit={createJob} />
        <div className="right-column">
          <JobStatus job={job} onCancel={cancelJob} />
          <CaptchaPanel
            challenge={captcha}
            submitting={submittingCaptcha}
            autoApply={job?.filters.autoApply ?? false}
            onSubmit={submitCaptcha}
          />
          {!job && <section className="empty-state"><span>📋</span><h2>Chưa có job</h2><p>Chọn extension và cấu hình filter để bắt đầu.</p></section>}
        </div>
      </div>
    </main>
  );
}
