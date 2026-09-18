import { useCallback, useEffect, useRef, useState } from "react";

import { CaptchaPanel } from "./components/CaptchaPanel";
import { ConnectionBanner } from "./components/ConnectionBanner";
import { ExportedReportsList } from "./components/ExportedReportsList";
import { FilterForm } from "./components/FilterForm";
import { HealthCheckReports } from "./components/HealthCheckReports";
import { HealthCheckSchedule } from "./components/HealthCheckSchedule";
import { JobStatus } from "./components/JobStatus";
import { ScenarioImport } from "./components/ScenarioImport";
import type {
  Acknowledgement,
  CaptchaChallenge,
  ConnectionState,
  Job,
  PendingUiHealthCheck,
  Runner,
  Scenario,
  UiHealthCheckNowResponse,
  VahanFilters,
} from "./contracts";
import { api } from "./services/api-client";
import { uiSocket } from "./services/socket-client";

const ACTIVE_JOB_STORAGE_KEY = "vahanActiveJobId";
type AppSection = "configure" | "activity" | "settings";
type BatchStatus = "idle" | "running" | "completed" | "stopped" | "error";

function sectionFromHash(): AppSection {
  const hash = window.location.hash.replace(/^#/, "").split("?")[0];
  if (hash === "settings") return "settings";
  if (hash === "activity") return "activity";
  return "configure";
}

export default function App() {
  const [activeSection, setActiveSection] = useState<AppSection>(() => sectionFromHash());
  const view = activeSection === "settings" ? "settings" : "configure";
  const [connection, setConnection] = useState<ConnectionState>("connecting");
  const [runners, setRunners] = useState<Runner[]>([]);
  const [job, setJob] = useState<Job | null>(null);
  const [captcha, setCaptcha] = useState<CaptchaChallenge | null>(null);
  const [creating, setCreating] = useState(false);
  const [submittingCaptcha, setSubmittingCaptcha] = useState(false);
  const [error, setError] = useState("");
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [batchRunning, setBatchRunning] = useState(false);
  const [batchStatus, setBatchStatus] = useState<BatchStatus>("idle");
  const [reportsTrigger, setReportsTrigger] = useState(0);
  const [batchProgress, setBatchProgress] = useState({ done: 0, total: 0, current: "" });
  const [batchLog, setBatchLog] = useState<{
    name: string;
    status: "ok" | "empty" | "error";
    detail: string;
    jobId?: string;
    excelFileName?: string | null;
  }[]>([]);
  const [healthReportsRefreshToken, setHealthReportsRefreshToken] = useState(0);
  const [pendingManualCheck, setPendingManualCheck] = useState<PendingUiHealthCheck | null>(null);

  const runnersRef = useRef<Runner[]>([]);
  useEffect(() => { runnersRef.current = runners; }, [runners]);
  const terminalResolverRef = useRef<((job: Job) => void) | null>(null);
  const batchStopRef = useRef(false);
  const pendingManualCheckRef = useRef<PendingUiHealthCheck | null>(null);

  useEffect(() => {
    const onHashChange = () => setActiveSection(sectionFromHash());
    window.addEventListener("hashchange", onHashChange);
    onHashChange();
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  useEffect(() => {
    document.title = view === "settings"
      ? "VAHAN · Cài đặt"
      : "VAHAN · Report Automation";
  }, [view]);

  const onHealthCheckRequested = useCallback((request: UiHealthCheckNowResponse) => {
    const pending = {
      requestId: request.requestId,
      requestedAt: request.requestedAt,
    };
    pendingManualCheckRef.current = pending;
    setPendingManualCheck(pending);
  }, []);

  const onManualCheckSettled = useCallback(() => {
    pendingManualCheckRef.current = null;
    setPendingManualCheck(null);
  }, []);

  function handleScenarioImport(nextScenarios: Scenario[]) {
    setScenarios(nextScenarios);
    setBatchLog([]);
    setBatchStatus("idle");
    setBatchProgress({
      done: 0,
      total: nextScenarios.length,
      current: nextScenarios[0]?.name || "",
    });
  }

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
        if (updated.status === "COMPLETED") {
          setReportsTrigger((c) => c + 1);
        }
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
    const onUiHealthLogReceived = (payload: { trigger?: string; checkedAt?: string }) => {
      setHealthReportsRefreshToken((value) => value + 1);
      const pending = pendingManualCheckRef.current;
      if (!pending || payload.trigger !== "manual-web") return;
      const checkedAt = Date.parse(payload.checkedAt || "");
      const requestedAt = Date.parse(pending.requestedAt);
      if (Number.isFinite(checkedAt) && Number.isFinite(requestedAt) && checkedAt >= requestedAt) {
        onManualCheckSettled();
      }
    };

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

  async function createJob(runnerId: string, filters: VahanFilters, scenarioName?: string) {
    setCreating(true);
    setError("");
    setCaptcha(null);
    try {
      const created = await api.createJob(runnerId, filters, scenarioName);
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

  async function runOneScenarioJob(runnerId: string, filters: VahanFilters, scenarioName?: string): Promise<Job> {
    const terminal = new Promise<Job>((resolve) => { terminalResolverRef.current = resolve; });
    await createJob(runnerId, filters, scenarioName);
    return terminal;
  }

  async function runScenarioQueue(queue: Scenario[]) {
    if (!queue.length || batchRunning) return;
    batchStopRef.current = false;
    setBatchRunning(true);
    setBatchStatus("running");
    setBatchLog([]);
    setBatchProgress({ done: 0, total: queue.length, current: queue[0].name });

    let outcome: BatchStatus = "completed";
    let processed = 0;

    for (let i = 0; i < queue.length; i++) {
      if (batchStopRef.current) {
        outcome = "stopped";
        break;
      }
      const scenario = queue[i];
      setBatchProgress({ done: i, total: queue.length, current: scenario.name });

      const runnerId = await pickAvailableRunnerWithRetry();
      if (!runnerId) {
        setBatchLog((log) => [...log, {
          name: scenario.name, status: "error",
          detail: "Dừng batch: không còn extension runner nào ONLINE và rảnh.",
        }]);
        outcome = "error";
        break;
      }

      try {
        const result = await runOneScenarioJob(runnerId, scenario.filters, scenario.name);
        processed = i + 1;
        setBatchProgress({ done: processed, total: queue.length, current: scenario.name });
        if ((result.error || "").startsWith("NO_RECORD_FOUND")) {
          // Filter hợp lệ nhưng VAHAN không có dữ liệu khớp — không phải lỗi hệ thống,
          // không dừng batch, chạy tiếp kịch bản kế tiếp.
          setBatchLog((log) => [...log, {
            name: scenario.name, status: "empty",
            detail: "Không có dữ liệu khớp bộ lọc (No record found) — bỏ qua, chạy tiếp.",
          }]);
        } else if (result.status === "COMPLETED") {
          setBatchLog((log) => [...log, {
            name: scenario.name,
            status: "ok",
            detail: `Job ${result.id} hoàn tất.`,
            jobId: result.id,
            excelFileName: result.excelFileName,
          }]);
        } else {
          setBatchLog((log) => [...log, {
            name: scenario.name, status: "error",
            detail: result.error || `Job kết thúc ở trạng thái ${result.status} — dừng batch.`,
          }]);
          outcome = "error";
          break;
        }
      } catch (reason) {
        setBatchLog((log) => [...log, {
          name: scenario.name, status: "error",
          detail: reason instanceof Error ? reason.message : "Lỗi không rõ khi tạo job.",
        }]);
        outcome = "error";
        break;
      }
    }

    if (outcome === "completed" && batchStopRef.current && processed < queue.length) {
      outcome = "stopped";
    }
    setBatchProgress((current) => ({ ...current, done: processed }));
    setBatchStatus(outcome);
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
          <a href="#configure">Bảng điều khiển</a>
          <a href="#activity">Tiến trình</a>
          <a href="#reports">Báo cáo đã xuất</a>
          <a href="#settings">Cài đặt</a>
          <span className="attended-badge">ATTENDED RPA</span>
        </nav>
      </header>

      <div className="app-layout">
        <div className="app-main">
          {view === "settings" ? (
            <main className="page-content settings-page" id="settings">
              <div className="section-intro settings-intro">
                <div><p className="eyebrow dark">SETTINGS</p><h2>Cài đặt hệ thống</h2></div>
                <p>Quản lý lịch health-check, theo dõi thay đổi giao diện VAHAN và xem toàn bộ lịch sử kiểm tra tại một nơi.</p>
              </div>

              <HealthCheckSchedule
                pendingManualCheck={pendingManualCheck}
                onCheckRequested={onHealthCheckRequested}
              />
              <HealthCheckReports
                refreshToken={healthReportsRefreshToken}
                pendingManualCheck={pendingManualCheck}
                onManualCheckSettled={onManualCheckSettled}
              />
            </main>
          ) : (
            <>
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

                <div className="workspace">
                  <div className="left-column">
                    <ScenarioImport
                      onImport={handleScenarioImport}
                      onRunAll={runScenarioQueue}
                      onStop={stopBatch}
                      running={batchRunning}
                      progress={batchProgress}
                      batchStatus={batchStatus}
                      log={batchLog}
                      disabled={busy}
                    />
                    {scenarios.length === 0 && (
                      <FilterForm runners={runners} busy={busy} onSubmit={createJob} />
                    )}
                  </div>
                  <div className="right-column" id="activity">
                    <JobStatus job={job} onCancel={cancelJob} />
                    <CaptchaPanel challenge={captcha} submitting={submittingCaptcha} autoApply={job?.filters.autoApply ?? false} onSubmit={submitCaptcha} />
                    {!job && <section className="empty-state"><span>01</span><h2>Sẵn sàng khởi tạo</h2><p>Chọn extension và cấu hình bộ lọc để bắt đầu quy trình báo cáo.</p></section>}
                  </div>
                </div>

                <div id="reports" style={{ marginTop: "32px" }}>
                  <ExportedReportsList refreshTrigger={reportsTrigger} />
                </div>
              </main>
            </>
          )}
        </div>
      </div>

      <footer><span>VAHAN REPORT AUTOMATION</span><span>Attended workflow · 2026</span></footer>
    </div>
  );
}
