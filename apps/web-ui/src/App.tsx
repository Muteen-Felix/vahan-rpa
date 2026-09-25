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
import { AUTH_REQUIRED_EVENT, api } from "./services/api-client";
import { uiSocket } from "./services/socket-client";

const ACTIVE_JOB_STORAGE_KEY = "vahanActiveJobId";
const SCENARIO_IMPORT_STORAGE_KEY = "vahanScenarioImportState";
const BATCH_RECOVERY_STORAGE_KEY = "vahanScenarioBatchRecovery";
const UI_SOCKET_ACK_TIMEOUT_MS = 15_000;
const CAPTCHA_REFRESH_ACK_TIMEOUT_MS = 25_000;
type AppSection = "configure" | "reports" | "settings";
type BatchStatus = "idle" | "running" | "completed" | "completed_with_errors" | "stopped" | "error";

interface BatchLogEntry {
  index: number;
  name: string;
  status: "ok" | "empty" | "error";
  detail: string;
  jobId?: string;
  excelFileName?: string | null;
}

interface ScenarioImportState {
  scenarios: Scenario[];
  fileName: string;
}

interface PersistedBatchRecovery {
  version: 1;
  status: BatchStatus;
  queueIndices: number[];
  nextPosition: number;
  currentIndex: number | null;
  activeJobId: string | null;
  stopRequested: boolean;
  hadErrors: boolean;
  log: BatchLogEntry[];
  failedAtIndex: number | null;
  progress: { done: number; total: number; current: string };
  retryQueueAdded?: boolean;
}

function readScenarioImportState(): ScenarioImportState {
  try {
    const raw = localStorage.getItem(SCENARIO_IMPORT_STORAGE_KEY);
    if (!raw) return { scenarios: [], fileName: "" };
    const stored = JSON.parse(raw) as ScenarioImportState;
    if (!Array.isArray(stored.scenarios) || typeof stored.fileName !== "string") {
      return { scenarios: [], fileName: "" };
    }
    return stored;
  } catch {
    return { scenarios: [], fileName: "" };
  }
}

function readBatchRecovery(): PersistedBatchRecovery | null {
  try {
    const raw = localStorage.getItem(BATCH_RECOVERY_STORAGE_KEY);
    if (!raw) return null;
    const stored = JSON.parse(raw) as PersistedBatchRecovery;
    const validStatuses: BatchStatus[] = ["idle", "running", "completed", "completed_with_errors", "stopped", "error"];
    if (
      stored.version !== 1
      || !validStatuses.includes(stored.status)
      || !Array.isArray(stored.queueIndices)
      || !stored.queueIndices.every((index) => Number.isInteger(index) && index >= 0)
      || !Number.isInteger(stored.nextPosition)
      || stored.nextPosition < 0
      || stored.nextPosition > stored.queueIndices.length
      || !Array.isArray(stored.log)
      || typeof stored.stopRequested !== "boolean"
      || typeof stored.hadErrors !== "boolean"
      || !stored.progress
      || !Number.isFinite(stored.progress.done)
      || !Number.isFinite(stored.progress.total)
      || typeof stored.progress.current !== "string"
    ) return null;
    return stored;
  } catch {
    return null;
  }
}

function isSocketTimeout(reason: unknown): boolean {
  const message = reason instanceof Error ? reason.message : String(reason || "");
  return /operation has timed out|timed out|timeout/i.test(message);
}

function sectionFromHash(): AppSection {
  const hash = window.location.hash.replace(/^#/, "").split("?")[0];
  if (hash === "reports") return "reports";
  if (hash === "settings") return "settings";
  return "configure";
}

export default function App() {
  const [activeSection, setActiveSection] = useState<AppSection>(() => sectionFromHash());
  const view = activeSection;
  const [connection, setConnection] = useState<ConnectionState>("connecting");
  const [runners, setRunners] = useState<Runner[]>([]);
  const [job, setJob] = useState<Job | null>(null);
  const [captcha, setCaptcha] = useState<CaptchaChallenge | null>(null);
  const [creating, setCreating] = useState(false);
  const [submittingCaptcha, setSubmittingCaptcha] = useState(false);
  const [refreshingCaptcha, setRefreshingCaptcha] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [scenarioImport, setScenarioImport] = useState<ScenarioImportState>(readScenarioImportState);
  const scenarios = scenarioImport.scenarios;
  const importedFileName = scenarioImport.fileName;
  const [initialBatchRecovery] = useState(readBatchRecovery);
  const [batchRunning, setBatchRunning] = useState(initialBatchRecovery?.status === "running");
  const [batchStatus, setBatchStatus] = useState<BatchStatus>(initialBatchRecovery?.status || "idle");
  const [failedAtIndex, setFailedAtIndex] = useState<number | null>(initialBatchRecovery?.failedAtIndex ?? null);
  const [reportsTrigger, setReportsTrigger] = useState(0);
  const [batchProgress, setBatchProgress] = useState(initialBatchRecovery?.progress || { done: 0, total: 0, current: "" });
  const [batchLog, setBatchLog] = useState<BatchLogEntry[]>(initialBatchRecovery?.log || []);
  const [healthReportsRefreshToken, setHealthReportsRefreshToken] = useState(0);
  const [pendingManualCheck, setPendingManualCheck] = useState<PendingUiHealthCheck | null>(null);
  const [jobRestoreReady, setJobRestoreReady] = useState(false);

  const runnersRef = useRef<Runner[]>([]);
  useEffect(() => { runnersRef.current = runners; }, [runners]);
  const terminalResolverRef = useRef<((job: Job) => void) | null>(null);
  const latestJobRef = useRef<Job | null>(null);
  const batchStopRef = useRef(false);
  const batchRunningRef = useRef(initialBatchRecovery?.status === "running");
  const batchLoopStartedRef = useRef(false);
  const batchRecoveryRef = useRef<PersistedBatchRecovery | null>(initialBatchRecovery);
  const batchLogRef = useRef<BatchLogEntry[]>(initialBatchRecovery?.log || []);
  const failedAtIndexRef = useRef<number | null>(initialBatchRecovery?.failedAtIndex ?? null);
  const pendingManualCheckRef = useRef<PendingUiHealthCheck | null>(null);
  const auditingReportsRef = useRef(false);

  async function reconcileStoredResults() {
    const currentLog = batchLogRef.current;
    const candidates = currentLog.filter((entry) => entry.status === "ok"
      || (entry.status === "error" && entry.detail.startsWith("Could not verify this Excel file")));
    if (!candidates.length) return;
    const names = [...new Set(candidates.map((entry) => entry.excelFileName).filter((name): name is string => Boolean(name)))];
    let verified: Record<string, number> = {};
    let verificationError = false;
    try {
      if (names.length) verified = (await api.verifyReports(names)).files;
    } catch {
      verificationError = true;
    }
    const nextLog = currentLog.map((entry) => {
      if (!candidates.includes(entry)) return entry;
      if (entry.jobId && entry.excelFileName && verified[entry.excelFileName] > 0) {
        return entry.status === "ok" ? entry : { ...entry, status: "ok" as const, detail: "Stored Excel file verified." };
      }
      return { ...entry, status: "error" as const,
        detail: verificationError
          ? "Could not verify this Excel file on the server. This case is not counted as downloaded."
          : "The Excel file for this case is missing or was never saved. This case needs a retry." };
    }).sort((a, b) => a.index - b.index);
    batchLogRef.current = nextLog;
    setBatchLog(nextLog);
    const failed = nextLog.find((entry) => entry.status === "error")?.index ?? null;
    failedAtIndexRef.current = failed;
    setFailedAtIndex(failed);
    updateBatchRecovery({ log: nextLog, failedAtIndex: failed, hadErrors: failed !== null });
    if (["completed", "completed_with_errors"].includes(batchRecoveryRef.current?.status || "")) {
      const status = failed === null ? "completed" : "completed_with_errors";
      setBatchStatus(status);
      updateBatchRecovery({ status });
    }
  }

  useEffect(() => {
    if (connection !== "connected" || batchRunningRef.current || auditingReportsRef.current) return;
    if (!batchLogRef.current.some((entry) => entry.status === "ok")) return;
    auditingReportsRef.current = true;
    void reconcileStoredResults().finally(() => { auditingReportsRef.current = false; });
  }, [connection]);

  function writeBatchRecovery(next: PersistedBatchRecovery | null) {
    batchRecoveryRef.current = next;
    try {
      if (next) localStorage.setItem(BATCH_RECOVERY_STORAGE_KEY, JSON.stringify(next));
      else localStorage.removeItem(BATCH_RECOVERY_STORAGE_KEY);
    } catch {
      setNotice("Could not save batch progress in this browser. Keep this page open to let the batch continue.");
    }
  }

  function updateBatchRecovery(patch: Partial<PersistedBatchRecovery>) {
    const current = batchRecoveryRef.current;
    if (current) writeBatchRecovery({ ...current, ...patch });
  }

  function updateBatchProgress(next: { done: number; total: number; current: string }) {
    setBatchProgress(next);
    updateBatchRecovery({ progress: next });
  }

  useEffect(() => {
    const onHashChange = () => setActiveSection(sectionFromHash());
    window.addEventListener("hashchange", onHashChange);
    onHashChange();
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  useEffect(() => {
    document.title = view === "settings"
      ? "VAHAN · Cài đặt"
      : view === "reports" ? "VAHAN · Exported Reports" : "VAHAN · Report Automation";
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

  function handleScenarioImport(nextScenarios: Scenario[], fileName: string) {
    if (batchRunningRef.current) {
      setNotice("A batch is running. Stop it before changing the JSON file.");
      return;
    }
    const nextImport = { scenarios: nextScenarios, fileName };
    setScenarioImport(nextImport);
    try {
      if (nextScenarios.length) localStorage.setItem(SCENARIO_IMPORT_STORAGE_KEY, JSON.stringify(nextImport));
      else localStorage.removeItem(SCENARIO_IMPORT_STORAGE_KEY);
    } catch {
      setNotice("Could not save the JSON file in this browser. Re-import it if you need to refresh the page.");
    }
    batchRunningRef.current = false;
    batchStopRef.current = false;
    setBatchRunning(false);
    batchLogRef.current = [];
    setBatchLog([]);
    setBatchStatus("idle");
    failedAtIndexRef.current = null;
    setFailedAtIndex(null);
    writeBatchRecovery(null);
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
      setError(reason instanceof Error ? reason.message : "Could not load the runner list.");
    }
  }

  function resolveTerminal(finishedJob: Job) {
    latestJobRef.current = finishedJob;
    const resolve = terminalResolverRef.current;
    if (!resolve) return;
    terminalResolverRef.current = null;
    resolve(finishedJob);
  }

  async function subscribeJob(jobId: string) {
    const acknowledgement = await uiSocket.timeout(UI_SOCKET_ACK_TIMEOUT_MS).emitWithAck(
      "ui:subscribe-job", { jobId },
    ) as Acknowledgement;
    if (!acknowledgement.ok) throw new Error(acknowledgement.error || "Could not subscribe to the job.");
    if (acknowledgement.job) {
      latestJobRef.current = acknowledgement.job;
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
    const ensureUiSocket = () => {
      if (!uiSocket.connected && !uiSocket.active) uiSocket.connect();
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") ensureUiSocket();
    };
    const onConnect = () => {
      setConnection("connected");
      setJobRestoreReady(false);
      refreshRunners();
      const activeJobId = (batchRecoveryRef.current?.status === "running" ? batchRecoveryRef.current.activeJobId : null)
        || localStorage.getItem(ACTIVE_JOB_STORAGE_KEY);
      if (activeJobId) {
        localStorage.setItem(ACTIVE_JOB_STORAGE_KEY, activeJobId);
        subscribeJob(activeJobId)
          .catch((reason) => {
            if (isSocketTimeout(reason)) {
              setNotice("The connection is slow. Job status will continue syncing with the extension.");
            } else {
              setError(reason instanceof Error ? reason.message : "Could not restore the job.");
            }
          })
          .finally(() => setJobRestoreReady(true));
      } else {
        setJobRestoreReady(true);
      }
    };
    const onDisconnect = (reason: string) => {
      setConnection("disconnected");
      setJobRestoreReady(false);
      if (reason === "io server disconnect") window.dispatchEvent(new Event(AUTH_REQUIRED_EVENT));
    };
    const onConnectError = (reason: Error) => {
      setConnection("error");
      if (/rejected|unauthorized|authentication required|token expired/i.test(reason.message)) {
        window.dispatchEvent(new Event(AUTH_REQUIRED_EVENT));
      }
    };
    const onRunnerChange = () => refreshRunners();
    const onJobStatus = async (updated: Job) => {
      latestJobRef.current = updated;
      setJob(updated);
      if (updated.status === "SUBMITTING" || updated.status === "WAITING_RESULT") {
        setCaptcha(null);
        setNotice("");
      }
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
    window.addEventListener("online", ensureUiSocket);
    window.addEventListener("pageshow", ensureUiSocket);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.removeEventListener("online", ensureUiSocket);
      window.removeEventListener("pageshow", ensureUiSocket);
      document.removeEventListener("visibilitychange", onVisibilityChange);
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
    setNotice("");
    setCaptcha(null);
    try {
      const created = await api.createJob(runnerId, filters, scenarioName);
      latestJobRef.current = created;
      setJob(created);
      localStorage.setItem(ACTIVE_JOB_STORAGE_KEY, created.id);
      if (batchRecoveryRef.current?.status === "running") {
        updateBatchRecovery({ activeJobId: created.id });
      }
      await subscribeJob(created.id);
      await refreshRunners();
    } catch (reason) {
      if (isSocketTimeout(reason)) {
        const message = "The connection is slow. The job was created and the extension is still being monitored.";
        setNotice(message);
        throw new Error(message);
      }
      const message = reason instanceof Error ? reason.message : "Could not create the job.";
      setError(message);
      throw new Error(message);
    } finally {
      setCreating(false);
    }
  }

  async function submitCaptcha(text1: string) {
    if (!job || !captcha) return;
    setSubmittingCaptcha(true);
    setError("");
    setNotice("");
    try {
      const acknowledgement = await uiSocket.timeout(UI_SOCKET_ACK_TIMEOUT_MS).emitWithAck(
        "captcha:submitted",
        { jobId: job.id, captchaId: captcha.captchaId, text1 },
      ) as Acknowledgement;
      if (!acknowledgement.ok) throw new Error(acknowledgement.error || "Could not submit the CAPTCHA.");
      setCaptcha(null);
    } catch (reason) {
      if (isSocketTimeout(reason)) {
        // The server accepts this command before the extension performs the
        // slow DOM work. Keep this as a non-blocking notice for old servers or
        // a temporarily slow socket; a real job failure is shown by JobStatus.
        setNotice("CAPTCHA received. The extension is continuing to fill in the VAHAN filters.");
      } else {
        setError(reason instanceof Error ? reason.message : "Could not submit the CAPTCHA.");
      }
    } finally {
      setSubmittingCaptcha(false);
    }
  }

  async function refreshCaptcha() {
    if (!job || !captcha) return;
    setRefreshingCaptcha(true);
    setError("");
    setNotice("");
    try {
      const acknowledgement = await uiSocket.timeout(CAPTCHA_REFRESH_ACK_TIMEOUT_MS).emitWithAck(
        "captcha:refresh",
        { jobId: job.id, captchaId: captcha.captchaId },
      ) as Acknowledgement & { captcha?: CaptchaChallenge };
      if (!acknowledgement.ok) throw new Error(acknowledgement.error || "Could not load a new CAPTCHA.");
      if (acknowledgement.captcha) {
        setCaptcha({ ...acknowledgement.captcha, invalid: false, refreshed: true });
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load a new CAPTCHA.");
    } finally {
      setRefreshingCaptcha(false);
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
    try {
      await createJob(runnerId, filters, scenarioName);
      return await terminal;
    } catch (reason) {
      terminalResolverRef.current = null;
      throw reason;
    }
  }

  async function waitForExistingJob(jobId: string): Promise<Job> {
    const isTerminal = (candidate: Job | null): candidate is Job =>
      Boolean(candidate && ["COMPLETED", "FAILED", "CANCELLED"].includes(candidate.status));
    let known = latestJobRef.current;
    if (known?.id === jobId && isTerminal(known)) return known;
    if (known?.id !== jobId) {
      const snapshot = await api.getJob(jobId);
      const latest = latestJobRef.current;
      known = latest?.id === jobId ? latest : snapshot;
      latestJobRef.current = known;
      setJob(known);
      if (isTerminal(known)) return known;
    }

    return new Promise((resolve) => {
      terminalResolverRef.current = resolve;
      const latest = latestJobRef.current;
      if (latest?.id === jobId && isTerminal(latest)) {
        terminalResolverRef.current = null;
        resolve(latest);
      }
    });
  }

  async function runScenarioQueue(
    queue: Scenario[],
    {
      startIndex = 0,
      clearLog = true,
      resumeState,
      selectedIndices,
      autoRetry = true,
    }: { startIndex?: number; clearLog?: boolean; resumeState?: PersistedBatchRecovery; selectedIndices?: number[]; autoRetry?: boolean } = {},
  ) {
    if ((!queue.length && !resumeState) || (batchRunningRef.current && !resumeState)) return;
    batchLoopStartedRef.current = true;
    batchRunningRef.current = true;
    setBatchRunning(true);
    if (!clearLog) await reconcileStoredResults();
    setBatchStatus("running");

    const queueIndices = resumeState ? [...resumeState.queueIndices]
      : selectedIndices ? [...selectedIndices] : queue.map((_, index) => startIndex + index);
    const startPosition = resumeState?.nextPosition || 0;
    const total = queueIndices.length;
    let done = startPosition;
    let current = resumeState?.progress.current
      || scenarios[queueIndices[startPosition]]?.name
      || queue[0]?.name
      || "";

    if (clearLog) {
      batchLogRef.current = [];
      setBatchLog([]);
      failedAtIndexRef.current = null;
      setFailedAtIndex(null);
    }
    if (resumeState) {
      batchStopRef.current = resumeState.stopRequested;
      updateBatchRecovery({ status: "running" });
    } else {
      batchStopRef.current = false;
      const initialProgress = { done: 0, total, current };
      writeBatchRecovery({
        version: 1,
        status: "running",
        queueIndices,
        nextPosition: 0,
        currentIndex: queueIndices[0] ?? null,
        activeJobId: null,
        stopRequested: false,
        hadErrors: false,
        log: batchLogRef.current,
        failedAtIndex: failedAtIndexRef.current,
        progress: initialProgress,
        retryQueueAdded: !autoRetry,
      });
      done = 0;
    }
    updateBatchProgress({ done, total: queueIndices.length, current });

    let outcome: BatchStatus = "completed";
    let hadErrors = batchLogRef.current.some((entry) => entry.status === "error");

    function recordScenario(entry: BatchLogEntry) {
      const currentLog = batchLogRef.current;
      const existingIndex = currentLog.findIndex((item) => item.index === entry.index);
      const nextLog = (existingIndex < 0
        ? [...currentLog, entry]
        : currentLog.map((item, index) => index === existingIndex ? entry : item))
        .sort((a, b) => a.index - b.index);
      batchLogRef.current = nextLog;
      setBatchLog(nextLog);
      hadErrors = nextLog.some((item) => item.status === "error");
      const failed = nextLog.find((item) => item.status === "error")?.index ?? null;
      failedAtIndexRef.current = failed;
      setFailedAtIndex(failed);
      updateBatchRecovery({ log: nextLog, hadErrors, failedAtIndex: failed });
    }

    let retryQueueAdded = resumeState?.retryQueueAdded ?? !autoRetry;
    const initialQueueLength = queueIndices.length;
    function queueFailedCasesOnce() {
      if (retryQueueAdded || initialQueueLength <= 1 || batchStopRef.current) return;
      retryQueueAdded = true;
      const failedIndices = queueIndices.slice(0, initialQueueLength).filter((index) =>
        batchLogRef.current.some((entry) => entry.index === index && entry.status === "error"));
      queueIndices.push(...failedIndices);
      updateBatchRecovery({ queueIndices: [...queueIndices], retryQueueAdded: true });
      updateBatchProgress({ done, total: queueIndices.length, current });
    }
    // A refresh can happen after the final first-pass case was saved but
    // before its retry queue was persisted.
    if (startPosition === initialQueueLength) queueFailedCasesOnce();
    for (let position = startPosition; position < queueIndices.length; position += 1) {
      const activeJobId = resumeState && position === startPosition ? resumeState.activeJobId : null;
      if (batchStopRef.current && !activeJobId) {
        outcome = "stopped";
        break;
      }
      const scenarioIndex = queueIndices[position];
      const scenario = scenarios[scenarioIndex];
      if (!scenario) {
        outcome = "error";
        setError(`Could not find case ${scenarioIndex + 1} while restoring the batch.`);
        break;
      }
      current = scenario.name;
      updateBatchProgress({ done: position, total: queueIndices.length, current });
      updateBatchRecovery({
        status: "running",
        nextPosition: position,
        currentIndex: scenarioIndex,
        activeJobId,
        stopRequested: batchStopRef.current,
      });

      try {
        let result: Job;
        if (activeJobId) {
          result = await waitForExistingJob(activeJobId);
        } else {
          const runnerId = await pickAvailableRunnerWithRetry();
          if (!runnerId) throw new Error("No online extension runner is available.");
          result = await runOneScenarioJob(runnerId, scenario.filters, scenario.name);
        }
        if ((result.error || "").startsWith("NO_RECORD_FOUND")) {
          // Filter hợp lệ nhưng VAHAN không có dữ liệu khớp — không phải lỗi hệ thống,
          // không dừng batch, chạy tiếp kịch bản kế tiếp.
          recordScenario({
            index: scenarioIndex,
            name: scenario.name, status: "empty",
            detail: "VAHAN returned no report after waiting (no record found). Skipping this case and continuing.",
          });
        } else if (result.status === "COMPLETED") {
          if (!result.excelFileName || !result.excelFileSize || result.excelFileSize <= 0) {
            throw new Error("Job reported completion without a saved Excel file.");
          }
          const stored = await api.verifyReports([result.excelFileName]);
          if (!stored.files[result.excelFileName]) {
            throw new Error("Job reported completion, but its Excel file is missing from server storage.");
          }
          recordScenario({
            index: scenarioIndex,
            name: scenario.name,
            status: "ok",
            detail: "Job " + result.id + " completed.",
            jobId: result.id,
            excelFileName: result.excelFileName,
          });
        } else {
          recordScenario({
            index: scenarioIndex,
            name: scenario.name, status: "error",
            detail: (result.error || ("Job ended with status " + result.status + ".")) + " This case was skipped; continuing with the next case.",
          });
        }
      } catch (reason) {
        recordScenario({
          index: scenarioIndex,
          name: scenario.name, status: "error",
          detail: (reason instanceof Error ? reason.message : "An unknown error occurred while creating the job.") + " This case was skipped; continuing with the next case.",
        });
      }
      done = position + 1;
      updateBatchProgress({ done, total: queueIndices.length, current: scenario.name });
      updateBatchRecovery({
        nextPosition: position + 1,
        currentIndex: null,
        activeJobId: null,
        hadErrors,
      });
      if (position === initialQueueLength - 1) queueFailedCasesOnce();
    }

    if (batchStopRef.current && outcome === "completed") outcome = "stopped";
    const finalStatus = outcome === "completed" && hadErrors ? "completed_with_errors" : outcome;
    updateBatchProgress({ done, total: queueIndices.length, current });
    setBatchStatus(finalStatus);
    updateBatchRecovery({
      status: finalStatus,
      currentIndex: null,
      activeJobId: null,
      stopRequested: false,
      hadErrors,
    });
    batchRunningRef.current = false;
    setBatchRunning(false);
  }

  function stopBatch() {
    batchStopRef.current = true;
    updateBatchRecovery({ stopRequested: true });
  }

  function runFromScenarioIndex(index: number) {
    if (!Number.isInteger(index) || index < 0 || index >= scenarios.length) return;
    runScenarioQueue(scenarios.slice(index), { startIndex: index, clearLog: false });
  }

  function runSingleScenarioIndex(index: number) {
    if (!Number.isInteger(index) || index < 0 || index >= scenarios.length) return;
    runScenarioQueue([scenarios[index]], { startIndex: index, clearLog: false });
  }

  function retryFailedScenario() {
    void (async () => {
      await reconcileStoredResults();
      const failedIndices = batchLogRef.current.filter((entry) => entry.status === "error")
        .map((entry) => entry.index).filter((index) => Boolean(scenarios[index]));
      if (!failedIndices.length) return;
      await runScenarioQueue(failedIndices.map((index) => scenarios[index]), {
        selectedIndices: failedIndices, clearLog: false, autoRetry: false,
      });
    })();
  }

  useEffect(() => {
    if (!jobRestoreReady || batchLoopStartedRef.current) return;
    const recovery = batchRecoveryRef.current;
    if (recovery?.status !== "running") return;
    if (!scenarios.length) {
      setError("Batch progress was restored, but the saved JSON file could not be found.");
      batchRunningRef.current = false;
      setBatchRunning(false);
      writeBatchRecovery({ ...recovery, status: "error", activeJobId: null });
      return;
    }

    const activeJobId = recovery.activeJobId || localStorage.getItem(ACTIVE_JOB_STORAGE_KEY);
    if (activeJobId) localStorage.setItem(ACTIVE_JOB_STORAGE_KEY, activeJobId);
    void runScenarioQueue(scenarios, {
      clearLog: false,
      resumeState: { ...recovery, activeJobId },
    });
  }, [jobRestoreReady, scenarios]);

  async function cancelJob() {
    if (!job) return;
    try {
      setJob(await api.cancelJob(job.id));
      localStorage.removeItem(ACTIVE_JOB_STORAGE_KEY);
      setCaptcha(null);
      await refreshRunners();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not cancel the job.");
    }
  }

  const busy = creating || batchRunning || Boolean(job && !["COMPLETED", "FAILED", "CANCELLED"].includes(job.status));

  return (
    <div className="app-shell">
      <header className="site-header">
        <nav className="main-nav" aria-label="Main navigation">
          <a className={activeSection === "configure" ? "active" : undefined} href="#configure">Create Report</a>
          <a className={activeSection === "reports" ? "active" : undefined} href="#reports">Exported Reports</a>
          <a className={activeSection === "settings" ? "active" : undefined} href="#settings">Settings</a>
        </nav>
        <div className="header-actions">
          <ConnectionBanner backend={connection} runners={runners.length} />
          <button className="logout-button" type="button" onClick={api.logout}>Log out</button>
        </div>
      </header>

      <div className="app-layout">
        <div className="app-main">
          {view === "settings" ? (
            <main className="page-content settings-page" id="settings">
              <div className="section-intro settings-intro">
                <h2>Cài đặt</h2>
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
          ) : view === "reports" ? (
            <main className="page-content exported-reports-page" id="reports">
              <div className="section-intro reports-intro">
                <h2>Exported Reports</h2>
              </div>
              <ExportedReportsList refreshTrigger={reportsTrigger} />
            </main>
          ) : (
              <main className="page-content report-page-content">
                <div className="section-intro" id="configure">
                  <h2>Create Report</h2>
                </div>

                {error && <div className="global-error" role="alert">{error}<button onClick={() => setError("")}>×</button></div>}
                {notice && <div className="global-notice" role="status">{notice}<button onClick={() => setNotice("")}>×</button></div>}

                <div className="workspace">
                  <div className="left-column">
                    <ScenarioImport
                      scenarios={scenarios}
                      fileName={importedFileName}
                      onImport={handleScenarioImport}
                      onRunAll={runScenarioQueue}
                      onRunFrom={runFromScenarioIndex}
                      onRunOne={runSingleScenarioIndex}
                      onRetryFailed={retryFailedScenario}
                      onStop={stopBatch}
                      running={batchRunning}
                      progress={batchProgress}
                      batchStatus={batchStatus}
                      log={batchLog}
                      failedAtIndex={failedAtIndex}
                      disabled={busy}
                    />
                    {/* {scenarios.length === 0 && (
                      <FilterForm runners={runners} busy={busy} onSubmit={createJob} />
                    )} */}
                  </div>
                  <div className="right-column">
                    {job && (
                      <div className="job-status-area" id="activity">
                        <JobStatus job={job} onCancel={cancelJob} />
                      </div>
                    )}
                    <CaptchaPanel
                      challenge={captcha}
                      submitting={submittingCaptcha}
                      refreshing={refreshingCaptcha}
                      onSubmit={submitCaptcha}
                      onRefresh={refreshCaptcha}
                    />
                    {!job && <section className="empty-state"><h2>Ready</h2><p>Import a JSON scenario file to get started.</p></section>}
                  </div>
                </div>

              </main>
          )}
        </div>
      </div>
    </div>
  );
}
