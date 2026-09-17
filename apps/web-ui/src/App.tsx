import { useEffect, useRef, useState } from "react";

import { CaptchaPanel } from "./components/CaptchaPanel";
import { ConnectionBanner } from "./components/ConnectionBanner";
import { FilterForm } from "./components/FilterForm";
import { HealthCheckReports } from "./components/HealthCheckReports";
import { HealthCheckSchedule } from "./components/HealthCheckSchedule";
import { JobStatus } from "./components/JobStatus";
import { ScenarioImport } from "./components/ScenarioImport";
import type { Acknowledgement, CaptchaChallenge, ConnectionState, Job, Runner, Scenario, VahanFilters } from "./contracts";
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
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [batchRunning, setBatchRunning] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ done: 0, total: 0, current: "" });
  const [batchLog, setBatchLog] = useState<{ name: string; status: "ok" | "empty" | "error"; detail: string }[]>([]);
  const [healthReportsRefreshToken, setHealthReportsRefreshToken] = useState(0);

  const runnersRef = useRef<Runner[]>([]);
  useEffect(() => { runnersRef.current = runners; }, [runners]);
  const terminalResolverRef = useRef<((job: Job) => void) | null>(null);
  const batchStopRef = useRef(false);

  async function refreshRunners() {
    try {
      setRunners(await api.runners());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không tải được danh sách runner.");
    }
  }

  function resolveTerminal(finishedJob: Job) {
    const resolve = terminalResolverRef.current;
    if (!resolve) return;
    terminalResolverRef.current = null;
    resolve(finishedJob);
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
        await refreshRunners();
        resolveTerminal(acknowledgement.job);
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
    const onJobStatus = async (updated: Job) => {
      setJob(updated);
      if (["COMPLETED", "FAILED", "CANCELLED"].includes(updated.status)) {
        localStorage.removeItem(ACTIVE_JOB_STORAGE_KEY);
        setCaptcha(null);
        // Đợi danh sách runner cập nhật xong TRƯỚC KHI resolve — nếu không, batch runner
        // (runScenarioQueue) sẽ đọc runnersRef.current lúc còn stale (runner vẫn hiện "đang
        // bận") và báo nhầm "không còn runner rảnh" ngay sau job đầu tiên.
        await refreshRunners();
        resolveTerminal(updated);
      }
    };
    const onCaptcha = (challenge: CaptchaChallenge) => setCaptcha({ ...challenge, invalid: false });
    const onCaptchaInvalid = (challenge: CaptchaChallenge) => setCaptcha({ ...challenge, invalid: true });
    const onCaptchaRefreshed = (challenge: CaptchaChallenge) => setCaptcha({ ...challenge, invalid: false, refreshed: true });
    const onUiHealthLogReceived = () => setHealthReportsRefreshToken((value) => value + 1);

    uiSocket.on("connect", onConnect);
    uiSocket.on("disconnect", onDisconnect);
    uiSocket.on("connect_error", onConnectError);
    uiSocket.on("runner:online", onRunnerChange);
    uiSocket.on("runner:offline", onRunnerChange);
    uiSocket.on("job:status", onJobStatus);
    uiSocket.on("captcha:required", onCaptcha);
    uiSocket.on("captcha:invalid", onCaptchaInvalid);
    uiSocket.on("captcha:refreshed", onCaptchaRefreshed);
    uiSocket.on("ui-health:log-received", onUiHealthLogReceived);
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
      uiSocket.off("ui-health:log-received", onUiHealthLogReceived);
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
      const message = reason instanceof Error ? reason.message : "Không tạo được job.";
      setError(message);
      throw new Error(message);
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

  function pickAvailableRunner(): string | null {
    const runner = runnersRef.current.find((candidate) => candidate.status === "ONLINE" && !candidate.currentJobId);
    return runner ? runner.id : null;
  }

  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  // pickAvailableRunner() nên đã thấy đúng runner rảnh ngay (onJobStatus giờ await
  // refreshRunners() trước khi cho batch đi tiếp) — vòng retry này chỉ là lớp phòng hộ
  // cho race condition còn sót lại (vd. REST list chậm hơn dự kiến), không phải cơ chế
  // chính để đồng bộ trạng thái runner.
  async function pickAvailableRunnerWithRetry(attempts = 3, delayMs = 1000): Promise<string | null> {
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      const runnerId = pickAvailableRunner();
      if (runnerId) return runnerId;
      if (attempt < attempts - 1) {
        await sleep(delayMs);
        await refreshRunners();
      }
    }
    return null;
  }

  async function runOneScenarioJob(runnerId: string, filters: VahanFilters): Promise<Job> {
    const terminal = new Promise<Job>((resolve) => { terminalResolverRef.current = resolve; });
    await createJob(runnerId, filters);
    return terminal;
  }

  async function runScenarioQueue(queue: Scenario[]) {
    if (!queue.length || batchRunning) return;
    batchStopRef.current = false;
    setBatchRunning(true);
    setBatchLog([]);
    setBatchProgress({ done: 0, total: queue.length, current: queue[0].name });

    for (let i = 0; i < queue.length; i++) {
      if (batchStopRef.current) break;
      const scenario = queue[i];
      setBatchProgress({ done: i, total: queue.length, current: scenario.name });

      const runnerId = await pickAvailableRunnerWithRetry();
      if (!runnerId) {
        setBatchLog((log) => [...log, {
          name: scenario.name, status: "error",
          detail: "Dừng batch: không còn extension runner nào ONLINE và rảnh.",
        }]);
        break;
      }

      try {
        const result = await runOneScenarioJob(runnerId, scenario.filters);
        if (result.status === "COMPLETED") {
          setBatchLog((log) => [...log, { name: scenario.name, status: "ok", detail: `Job ${result.id} hoàn tất.` }]);
        } else if ((result.error || "").startsWith("NO_RECORD_FOUND")) {
          // Filter hợp lệ nhưng VAHAN không có dữ liệu khớp — không phải lỗi hệ thống,
          // không dừng batch, chạy tiếp kịch bản kế tiếp.
          setBatchLog((log) => [...log, {
            name: scenario.name, status: "empty",
            detail: "Không có dữ liệu khớp bộ lọc (No record found) — bỏ qua, chạy tiếp.",
          }]);
        } else {
          setBatchLog((log) => [...log, {
            name: scenario.name, status: "error",
            detail: result.error || `Job kết thúc ở trạng thái ${result.status} — dừng batch.`,
          }]);
          break;
        }
      } catch (reason) {
        setBatchLog((log) => [...log, {
          name: scenario.name, status: "error",
          detail: reason instanceof Error ? reason.message : "Lỗi không rõ khi tạo job.",
        }]);
        break;
      }
    }

    setBatchProgress((current) => ({ ...current, done: current.total }));
    setBatchRunning(false);
  }

  function stopBatch() {
    batchStopRef.current = true;
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

  const busy = creating || batchRunning || Boolean(job && !["COMPLETED", "FAILED", "CANCELLED"].includes(job.status));

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
        <HealthCheckReports refreshToken={healthReportsRefreshToken} />

        <div className="workspace">
          <div className="left-column">
            <ScenarioImport
              onImport={setScenarios}
              onRunAll={runScenarioQueue}
              onStop={stopBatch}
              running={batchRunning}
              progress={batchProgress}
              log={batchLog}
              disabled={busy}
            />
            <FilterForm runners={runners} busy={busy} onSubmit={createJob} />
          </div>
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
