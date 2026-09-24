import { io } from "socket.io-client";
import { normalizeJobFilters } from "./job-config.mjs";
import {
  registerUiHealthCheck,
} from "../ui-drift/health-check.mjs";
import {
  VAHAN_AUTH_HOLD_KEY,
  VAHAN_AUTH_GUARD_VERSION,
  VAHAN_AUTH_REQUIRED_CODE,
  VAHAN_SESSION_EXPIRED_CODE,
  VAHAN_UNREACHABLE_CODE,
  VAHAN_SERVER_ERROR_CODE,
  createVahanAuthHold,
  isVahanAuthHoldActive,
  isVahanMainFrameAuthChallenge,
  isVahanRequestUrl,
  isVahanPublicReportUrl,
  isVahanRedirectedHomeUrl,
  isChromeErrorUrl,
  vahanAuthHoldMessage,
  vahanSessionExpiredMessage,
  vahanUnreachableMessage,
} from "./vahan-auth-guard.mjs";

const DEFAULT_RUNNER_CONFIG = Object.freeze({
  serverUrl: "http://127.0.0.1:8000",
  runnerName: "VAHAN Chrome",
  token: "change-me",
});
const HEARTBEAT_INTERVAL_MS = 20_000;
const VAHAN_URL = "https://analytics.parivahan.gov.in/analytics/vahanpublicreport?lang=en";
// Cross-border latency (e.g. Vietnam -> India) can make the initial cold load
// take much longer than a same-region load. This only applies to the first
// navigation in getVahanTab(); sendToVahan()'s reload-recovery keeps the
// tighter default timeout since it's recovering an already-loaded tab.
const INITIAL_PAGE_LOAD_TIMEOUT_MS = 75_000;
// Max idle age before an existing tab is considered stale and reloaded to guarantee
// a fresh session (JSESSIONID) and CSRF token.
const MAX_TAB_IDLE_AGE_MS = 10 * 60 * 1000;
const VAHAN_OPTION_SELECTORS = Object.freeze({
  archivedFlags: { selector: "#archivedFlags", multiple: true },
  period: { selector: "#reportType" },
  financialYears: { selector: "#financialYearSelect", multiple: true },
  reportYear: { selector: "#reportYear" },
  reportMonth: { selector: "#reportMonth" },
  states: { selector: "#stateName", multiple: true },
  rtos: { selector: "#rtoCode", multiple: true },
  emissions: { selector: "#vehicleEmission", multiple: true },
  categoryGroups: { selector: "#vehicleCategoryGroup", multiple: true },
  subCategories: { selector: "#vehicleSubCategory", multiple: true },
  classes: { selector: "#vehicleClass", multiple: true },
  fuels: { selector: "#vehicleFuel", multiple: true },
  evTypes: { selector: "#evType", multiple: true },
  statuses: { selector: "#vehicleStatus", multiple: true },
  ownerTypes: { selector: "#vehicleOwnerType", multiple: true },
  vehicleType: { selector: "#vehicleType" },
  fitness: { selector: "#fitnessCheck" },
  delhiNcr: { selector: "#delhiNcr" },
  yAxis: { selector: "#yAxis" },
  xAxis: { selector: "#xAxis" },
});

let socket;
let heartbeatTimer;
let reconnectTimer;
let activeConfig;
let activeJobId;
let cancelledJobIds = new Set();
let pendingBlobResolver;
let uiHealthCheckController;
let vahanAuthHold;
let authHoldWrite = Promise.resolve();
const authChallengeWaiters = new Set();
const authFailureReportedJobs = new Set();
const tabActivityTimestamps = new Map();
const tabLastErrors = new Map();

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function recordTabActivity(tabId) {
  if (tabId !== undefined && tabId !== null) {
    tabActivityTimestamps.set(tabId, Date.now());
  }
}

class VahanAuthRequiredError extends Error {
  constructor(hold) {
    super(vahanAuthHoldMessage(hold));
    this.name = "VahanAuthRequiredError";
    this.code = VAHAN_AUTH_REQUIRED_CODE;
    this.hold = hold;
  }
}

class VahanSessionExpiredError extends Error {
  constructor(message = vahanSessionExpiredMessage()) {
    super(message);
    this.name = "VahanSessionExpiredError";
    this.code = VAHAN_SESSION_EXPIRED_CODE;
  }
}

class VahanUnreachableError extends Error {
  constructor(detail = "") {
    super(vahanUnreachableMessage(detail));
    this.name = "VahanUnreachableError";
    this.code = VAHAN_UNREACHABLE_CODE;
    this.detail = detail;
  }
}

class VahanServerError extends Error {
  constructor(statusCode = 500) {
    super(`Máy chủ VAHAN đang gặp sự cố (HTTP ${statusCode}). Hệ thống có thể đang bảo trì.`);
    this.name = "VahanServerError";
    this.code = VAHAN_SERVER_ERROR_CODE;
    this.statusCode = statusCode;
  }
}

async function loadVahanAuthHold() {
  const stored = await chrome.storage.local.get(VAHAN_AUTH_HOLD_KEY);
  vahanAuthHold = stored?.[VAHAN_AUTH_HOLD_KEY] || undefined;
  if (!isVahanAuthHoldActive(vahanAuthHold)) {
    if (vahanAuthHold?.code === VAHAN_AUTH_REQUIRED_CODE
      && vahanAuthHold.guardVersion !== VAHAN_AUTH_GUARD_VERSION) {
      await chrome.storage.local.remove(VAHAN_AUTH_HOLD_KEY);
    }
    vahanAuthHold = undefined;
    chrome.action.setBadgeText?.({ text: "" });
  }
  return vahanAuthHold;
}

function notifyAuthChallengeWaiters(hold) {
  for (const waiter of authChallengeWaiters) {
    if (waiter.tabId === undefined || hold.tabId === null || waiter.tabId === hold.tabId) {
      waiter.reject(new VahanAuthRequiredError(hold));
    }
  }
}

function showAuthHoldBadge(hold) {
  chrome.action.setBadgeText?.({ text: "!" });
  chrome.action.setBadgeBackgroundColor?.({ color: "#b42318" });
  chrome.action.setTitle?.({ title: "VAHAN đang yêu cầu xác thực — hệ thống đã tạm dừng" });
  chrome.runtime.sendMessage({ type: "VAHAN_AUTH_REQUIRED", authHold: hold }).catch(() => {});
}

function recordVahanAuthChallenge(details) {
  const hold = createVahanAuthHold(details, vahanAuthHold);
  vahanAuthHold = hold;
  notifyAuthChallengeWaiters(hold);
  showAuthHoldBadge(hold);

  // Serialize storage writes because the server may challenge several assets
  // for the same page at almost the same time.
  authHoldWrite = authHoldWrite
    .catch(() => {})
    .then(async () => {
      await chrome.storage.local.set({ [VAHAN_AUTH_HOLD_KEY]: hold });
      return hold;
    });
  return hold;
}

async function clearVahanAuthHold() {
  vahanAuthHold = undefined;
  await chrome.storage.local.remove(VAHAN_AUTH_HOLD_KEY);
  chrome.action.setBadgeText?.({ text: "" });
  chrome.action.setTitle?.({ title: "VAHAN RPA Assistant" });
  chrome.runtime.sendMessage({ type: "VAHAN_AUTH_CLEARED" }).catch(() => {});
}

async function assertNoVahanAuthHold(tabId) {
  const hold = vahanAuthHold || await loadVahanAuthHold();
  if (isVahanAuthHoldActive(hold, Date.now(), tabId)) {
    throw new VahanAuthRequiredError(hold);
  }
}

function installVahanAuthGuard() {
  if (!chrome.webRequest?.onAuthRequired?.addListener) return;

  // The extension never guesses credentials. Cancel the challenge instead of
  // allowing Chrome's native login dialog and stop all automation retries.
  chrome.webRequest.onAuthRequired.addListener(
    (details, respond) => {
      if (details.isProxy) {
        respond({});
        return;
      }
      if (!isVahanMainFrameAuthChallenge(details)) {
        // Do not let a protected image/API asset open an HTTP auth prompt or
        // pause the otherwise usable official report page.
        respond({ cancel: true });
        return;
      }
      const hold = recordVahanAuthChallenge(details);
      respond({ cancel: true });
    },
    { urls: ["https://analytics.parivahan.gov.in/*"] },
    ["asyncBlocking"],
  );

  // A normal top-level page load is the only automatic signal that the hold
  // can be cleared. It avoids retaining a stale lock after the user has
  // manually waited/reloaded the official page.
  chrome.webRequest.onCompleted?.addListener(
    (details) => {
      if (details.type !== "main_frame") return;
      if (details.statusCode >= 500 && isVahanRequestUrl(details.url)) {
        tabLastErrors.set(details.tabId, {
          type: "SERVER_ERROR",
          statusCode: details.statusCode,
          url: details.url,
          timestamp: Date.now(),
        });
      }
      if (details.statusCode >= 200 && details.statusCode < 300) {
        if (isVahanPublicReportUrl(details.url)) {
          recordTabActivity(details.tabId);
          tabLastErrors.delete(details.tabId);
        }
        if (!isVahanRequestUrl(details.url) || !vahanAuthHold) return;
        if (vahanAuthHold.tabId !== null && vahanAuthHold.tabId !== details.tabId) return;
        try {
          const completed = new URL(details.url);
          const challenged = new URL(vahanAuthHold.url);
          if (`${completed.origin}${completed.pathname}` !== `${challenged.origin}${challenged.pathname}`) return;
        } catch {
          return;
        }
        clearVahanAuthHold().catch(() => {});
      }
    },
    { urls: ["https://analytics.parivahan.gov.in/*"] },
  );

  if (chrome.webNavigation?.onErrorOccurred) {
    chrome.webNavigation.onErrorOccurred.addListener((details) => {
      if (details.frameId === 0 && isVahanRequestUrl(details.url)) {
        tabLastErrors.set(details.tabId, {
          type: "NETWORK_ERROR",
          error: details.error,
          url: details.url,
          timestamp: Date.now(),
        });
      }
    });
  }

  chrome.tabs.onRemoved?.addListener((tabId) => {
    tabActivityTimestamps.delete(tabId);
    tabLastErrors.delete(tabId);
  });
}

async function reportJobStatus(jobId, status, error) {
  if (!socket?.connected) throw new Error("Backend is disconnected.");
  const response = await socket.timeout(5_000).emitWithAck("job:status", {
    jobId,
    status,
    ...(error ? { error } : {}),
  });
  if (!response?.ok) throw new Error(response?.error || `Could not report ${status}.`);
}

async function publishCaptcha(jobId, captcha) {
  if (!socket?.connected) throw new Error("Backend is disconnected.");
  const response = await socket.timeout(5_000).emitWithAck("captcha:required", {
    jobId,
    captchaId: captcha.captchaId,
    imageDataUrl: captcha.imageDataUrl,
  });
  if (!response?.ok) throw new Error(response?.error || "Could not publish CAPTCHA.");
}

async function publishCaptchaChange(activeServerJob, captcha, event) {
  if (!captcha?.captchaId || !captcha?.imageDataUrl) {
    throw new Error("VAHAN did not return a valid fresh CAPTCHA.");
  }
  if (captcha.captchaId === activeServerJob.captchaId) {
    throw new Error("VAHAN returned the previous CAPTCHA image. Please try again.");
  }

  const updatedJob = {
    ...activeServerJob,
    captchaId: captcha.captchaId,
    stage: "WAITING_CAPTCHA",
  };
  // Persist first so the mutation observer cannot republish the same image
  // while the backend is delivering the event to the Web UI.
  await chrome.storage.local.set({ activeServerJob: updatedJob });
  await emitWithRetry(event, {
    jobId: activeServerJob.jobId,
    captchaId: captcha.captchaId,
    imageDataUrl: captcha.imageDataUrl,
  });
  return captcha;
}

async function requestFreshCaptcha(activeServerJob) {
  const captcha = await sendToVahan(activeServerJob.tabId, {
    type: "REFRESH_CAPTCHA",
    previousCaptchaId: activeServerJob.captchaId,
  });
  if (!captcha?.ok) throw new Error(captcha?.error || "Could not refresh the official VAHAN CAPTCHA.");
  return captcha;
}

async function emitWithRetry(event, payload, attempts = 3) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      if (!socket?.connected) throw new Error("Backend is disconnected.");
      const response = await socket.timeout(5_000).emitWithAck(event, payload);
      if (!response?.ok) throw new Error(response?.error || `${event} was rejected.`);
      return response;
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await delay(500 * attempt);
    }
  }
  throw lastError;
}

function assertJobActive(jobId) {
  if (cancelledJobIds.has(jobId)) throw new Error("Job was cancelled.");
}

async function verifyTabUrl(tabId) {
  const tab = await chrome.tabs.get(tabId);
  const url = tab?.url || "";
  if (isChromeErrorUrl(url)) {
    const lastError = tabLastErrors.get(tabId);
    throw new VahanUnreachableError(lastError?.error || "Lỗi kết nối");
  }
  const lastError = tabLastErrors.get(tabId);
  if (lastError && lastError.type === "SERVER_ERROR" && Date.now() - lastError.timestamp < 15_000) {
    throw new VahanServerError(lastError.statusCode);
  }
  if (isVahanRedirectedHomeUrl(url)) {
    throw new VahanSessionExpiredError();
  }
  return tab;
}

async function waitForTabComplete(tabId, timeout = 30_000) {
  await assertNoVahanAuthHold(tabId);
  const current = await chrome.tabs.get(tabId);
  if (current.status === "complete") {
    await verifyTabUrl(tabId);
    return;
  }
  await new Promise((resolve, reject) => {
    let settled = false;
    const authWaiter = {
      tabId,
      reject: (error) => finish(reject, error),
    };
    const authPoll = setInterval(() => {
      assertNoVahanAuthHold(tabId).catch((error) => finish(reject, error));
    }, 250);
    const timer = setTimeout(() => {
      finish(reject, new Error("VAHAN page did not finish loading in time."));
    }, timeout);
    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      clearInterval(authPoll);
      chrome.tabs.onUpdated.removeListener(listener);
      authChallengeWaiters.delete(authWaiter);
      callback(value);
    };
    const listener = (updatedId, changeInfo) => {
      if (updatedId !== tabId || changeInfo.status !== "complete") return;
      verifyTabUrl(tabId)
        .then(() => finish(resolve))
        .catch((error) => finish(reject, error));
    };
    authChallengeWaiters.add(authWaiter);
    chrome.tabs.onUpdated.addListener(listener);
  });
}

async function getVahanTab() {
  await assertNoVahanAuthHold();
  const tabs = await chrome.tabs.query({ url: "https://analytics.parivahan.gov.in/analytics/vahanpublicreport*" });
  let tab = tabs[0];
  let forceReload = false;

  if (tab?.id) {
    const lastActive = tabActivityTimestamps.get(tab.id) || 0;
    const isStale = (Date.now() - lastActive) > MAX_TAB_IDLE_AGE_MS;
    if (isStale || !isVahanPublicReportUrl(tab.url)) {
      forceReload = true;
    }
  } else {
    tab = await chrome.tabs.create({ url: VAHAN_URL, active: false });
  }

  if (!tab.id) throw new Error("Chrome did not return a VAHAN tab id.");

  if (forceReload) {
    await chrome.tabs.update(tab.id, { url: VAHAN_URL });
  }

  try {
    await waitForTabComplete(tab.id, INITIAL_PAGE_LOAD_TIMEOUT_MS);
  } catch (error) {
    // An auth-hold or resilience rejection is surfaced immediately
    if (error instanceof VahanAuthRequiredError
      || error instanceof VahanUnreachableError
      || error instanceof VahanServerError
      || error instanceof VahanSessionExpiredError) {
      throw error;
    }
    if (!String(error?.message).includes("did not finish loading")) {
      throw error;
    }
    // Cross-border network slowness is transient: reload once and give the
    // page one more chance before giving up.
    await chrome.tabs.reload(tab.id);
    try {
      await waitForTabComplete(tab.id, INITIAL_PAGE_LOAD_TIMEOUT_MS);
    } catch (retryError) {
      if (retryError instanceof VahanUnreachableError
        || retryError instanceof VahanServerError
        || retryError instanceof VahanSessionExpiredError) {
        throw retryError;
      }
      throw new Error("VAHAN page did not finish loading after a retry — the site may be down or extremely slow.");
    }
  }

  await assertNoVahanAuthHold(tab.id);
  recordTabActivity(tab.id);
  return tab.id;
}

async function getOptionsTab() {
  return getVahanTab();
}

async function sendToVahan(tabId, message) {
  let reloadAttempted = false;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    try {
      await assertNoVahanAuthHold(tabId);
      return await chrome.tabs.sendMessage(tabId, message);
    } catch (error) {
      await assertNoVahanAuthHold(tabId);
      if (String(error?.message).includes("Receiving end")) {
        try {
          const currentTab = await chrome.tabs.get(tabId);
          if (isChromeErrorUrl(currentTab?.url)) {
            const lastError = tabLastErrors.get(tabId);
            throw new VahanUnreachableError(lastError?.error || "Lỗi kết nối");
          }
          if (isVahanRedirectedHomeUrl(currentTab?.url)) {
            throw new VahanSessionExpiredError();
          }
        } catch (inspectError) {
          if (inspectError instanceof VahanUnreachableError || inspectError instanceof VahanSessionExpiredError) {
            throw inspectError;
          }
        }
      }
      if (attempt === 0 && String(error?.message).includes("Receiving end")) {
        reloadAttempted = true;
        await chrome.tabs.reload(tabId);
        await waitForTabComplete(tabId);
      }
      if (attempt === 5 || (reloadAttempted && attempt > 0)) {
        try {
          const finalTab = await chrome.tabs.get(tabId);
          if (isChromeErrorUrl(finalTab?.url)) {
            throw new VahanUnreachableError();
          }
          if (isVahanRedirectedHomeUrl(finalTab?.url)) {
            throw new VahanSessionExpiredError();
          }
        } catch (finalInspectError) {
          if (finalInspectError instanceof VahanUnreachableError || finalInspectError instanceof VahanSessionExpiredError) {
            throw finalInspectError;
          }
        }
        throw error;
      }
      await delay(500);
    }
  }
}

function isLikelyExcelDownload(item, tabId) {
  if (!item || item.id === undefined) return false;
  if (Number.isInteger(item.tabId) && item.tabId === tabId) return true;
  const url = String(item.url || "").toLocaleLowerCase();
  if (url.startsWith("blob:") || url.startsWith("data:")) return true;
  const source = `${url} ${item.filename || ""}`;
  return /(?:\.xlsx?(?:$|[?#])|\.xlsm(?:$|[?#])|excel|spreadsheet|export)/i.test(source);
}

async function triggerAndWaitForExcelDownload(tabId) {
  // The page-level bridge (interceptor-main.js / content.js) suppresses the
  // native browser download and hands us the exact bytes instead. The only
  // copy of the report is the one this function uploads to the API server.
  // The listeners below are a secondary defense: if suppression ever fails
  // (e.g. a VAHAN change bypasses the patched click path), cancel and erase
  // any Excel-looking download that slips through so it never lands as a
  // second, unmanaged copy on the user's machine.
  let resolveBlob;
  let rejectBlob;
  let blobTimer;

  const blobPromise = new Promise((resolve, reject) => {
    resolveBlob = resolve;
    rejectBlob = reject;
    blobTimer = setTimeout(() => {
      reject(new Error("Excel file bytes were not captured within 60 seconds."));
    }, 60_000);
  });

  const onCreated = (item) => {
    if (!isLikelyExcelDownload(item, tabId)) return;
    try {
      chrome.downloads.cancel(item.id, () => {
        chrome.downloads.erase({ id: item.id }, () => {});
      });
    } catch (e) {}

    // If the page used a download URL rather than the URL.createObjectURL
    // path, ask the tab to copy that source into the same upload bridge so we
    // still capture the bytes despite the suppression having missed it.
    if (item.url) {
      sendToVahan(tabId, {
        type: "CAPTURE_EXCEL_DOWNLOAD",
        href: item.url,
        fileName: item.filename?.split(/[\\/]/).pop() || "report.xlsx",
      }).catch(() => {});
    }
  };

  const blobResolver = (data) => {
    clearTimeout(blobTimer);
    if (!data?.dataUrl || !String(data.dataUrl).startsWith("data:")) {
      rejectBlob(new Error("Excel file bytes were not captured correctly."));
    } else {
      resolveBlob(data);
    }
    if (pendingBlobResolver === blobResolver) pendingBlobResolver = undefined;
    resolveBlob = () => {};
    rejectBlob = () => {};
  };
  pendingBlobResolver = blobResolver;
  chrome.downloads.onCreated.addListener(onCreated);

  try {
    const response = await sendToVahan(tabId, { type: "CLICK_EXCEL_DOWNLOAD" });
    if (!response?.ok) {
      rejectBlob(new Error(response?.error || "Could not click the Excel download button."));
    }

    const { dataUrl, fileName } = await blobPromise;

    // Upload to API server.
    const { activeServerJob } = await chrome.storage.local.get("activeServerJob");
    const jobId = activeServerJob?.jobId;
    if (!jobId) throw new Error("No active job to attach the Excel file to.");
    await chrome.storage.local.set({
      activeServerJob: { ...activeServerJob, stage: "UPLOADING_REPORT" },
    });

    const config = await loadRunnerConfig();
    const serverUrl = config.serverUrl || "http://127.0.0.1:8000";

    // Convert data URL to Blob for upload.
    const blobResponse = await fetch(dataUrl);
    if (!blobResponse.ok) {
      throw new Error(`Could not decode the captured Excel file (${blobResponse.status}).`);
    }
    const blob = await blobResponse.blob();
    if (!blob.size) throw new Error("The captured Excel file is empty.");
    const uploadFileName = activeServerJob?.scenarioName
      ? `${activeServerJob.scenarioName.replace(/[\\/*?:"<>|\r\n\t]/g, "_").trim()}.xlsx`
      : (fileName || "report.xlsx");
    const formData = new FormData();
    formData.append("file", blob, uploadFileName);

    const uploadResponse = await fetch(`${serverUrl}/api/jobs/${jobId}/upload-excel`, {
      method: "POST",
      body: formData,
    });
    if (!uploadResponse.ok) {
      const body = await uploadResponse.json().catch(() => ({}));
      throw new Error(body.detail || `Server upload failed (${uploadResponse.status}).`);
    }
    return await uploadResponse.json();
  } finally {
    clearTimeout(blobTimer);
    chrome.downloads.onCreated.removeListener(onCreated);
    if (pendingBlobResolver === blobResolver) pendingBlobResolver = undefined;
  }
}


async function executeJob(job) {
  const jobId = String(job?.jobId || "");
  if (!jobId) return;
  if (activeJobId === jobId) return;
  if (activeJobId) {
    console.warn(`[VAHAN EXT] Preempting stale job ${activeJobId} with new job ${jobId}`);
    cancelledJobIds.add(activeJobId);
    activeJobId = undefined;
    await chrome.storage.local.remove(["pendingServerJob", "activeServerJob"]);
  }

  activeJobId = jobId;
  cancelledJobIds.delete(jobId);
  await chrome.storage.local.set({ pendingServerJob: job });
  chrome.runtime.sendMessage({ type: "SERVER_JOB_ASSIGNED", job }).catch(() => {});

  let tabId;
  try {
    await reportJobStatus(jobId, "OPENING_VAHAN");
    tabId = await getVahanTab();
    assertJobActive(jobId);

    const config = normalizeJobFilters(job.filters);
    await chrome.storage.local.set({
      activeServerJob: { ...job, tabId, config, stage: "CAPTURING_CAPTCHA" },
    });

    // Capture CAPTCHA before touching the report filters. The user can start
    // reading/entering it immediately while the official page remains fast
    // and idle; filters are filled only after the user submits the code.
    await reportJobStatus(jobId, "CAPTURING_CAPTCHA");
    const captcha = await sendToVahan(tabId, { type: "CAPTURE_CAPTCHA" });
    if (!captcha?.ok) throw new Error(captcha?.error || "Could not capture the CAPTCHA.");
    assertJobActive(jobId);
    await chrome.storage.local.set({
      activeServerJob: { ...job, tabId, config, captchaId: captcha.captchaId, stage: "WAITING_CAPTCHA", attempts: 0 },
    });
    await publishCaptcha(jobId, captcha);
  } catch (error) {
    if (!cancelledJobIds.has(jobId)) {
      const authHeld = isVahanAuthHoldActive(vahanAuthHold, Date.now(), tabId);
      if (!(authHeld && authFailureReportedJobs.has(jobId))) {
        let errorMessage = error.message;
        if (authHeld) {
          errorMessage = `${VAHAN_AUTH_REQUIRED_CODE}: ${vahanAuthHoldMessage(vahanAuthHold)}`;
        } else if (error.code) {
          errorMessage = `${error.code}: ${error.message}`;
        }
        await reportJobStatus(
          jobId,
          "FAILED",
          errorMessage,
        ).catch(() => {});
        if (authHeld) authFailureReportedJobs.add(jobId);
      }
    }
    activeJobId = undefined;
    await chrome.storage.local.remove(["pendingServerJob", "activeServerJob"]);
  }
}

async function loadRunnerConfig() {
  const { runnerConfig = {} } = await chrome.storage.local.get("runnerConfig");
  const normalized = {
    ...DEFAULT_RUNNER_CONFIG,
    ...runnerConfig,
    runnerId: runnerConfig.runnerId || crypto.randomUUID(),
  };
  if (JSON.stringify(normalized) !== JSON.stringify(runnerConfig)) {
    await chrome.storage.local.set({ runnerConfig: normalized });
  }
  return normalized;
}

async function publishConnection(status, detail = "") {
  const connection = {
    status,
    detail,
    runnerId: activeConfig?.runnerId || null,
    serverUrl: activeConfig?.serverUrl || null,
    updatedAt: new Date().toISOString(),
  };
  await chrome.storage.local.set({ runnerConnection: connection });
  chrome.runtime.sendMessage({ type: "RUNNER_CONNECTION_CHANGED", connection }).catch(() => {});
}

function stopHeartbeat() {
  clearInterval(heartbeatTimer);
  heartbeatTimer = undefined;
}

function startHeartbeat() {
  stopHeartbeat();
  heartbeatTimer = setInterval(() => {
    if (!socket?.connected) return;
    socket.timeout(5_000).emit("runner:heartbeat", { timestamp: Date.now() }, (error, response) => {
      if (error || !response?.ok) {
        publishConnection("error", error?.message || response?.error || "Heartbeat failed.");
      }
    });
  }, HEARTBEAT_INTERVAL_MS);
}

async function connectRunner() {
  clearTimeout(reconnectTimer);
  activeConfig = await loadRunnerConfig();
  void uiHealthCheckController?.refreshScheduleFromBackend();
  socket?.removeAllListeners();
  socket?.disconnect();

  await publishConnection("connecting", "Đang kết nối backend...");
  socket = io(`${activeConfig.serverUrl}/runner`, {
    transports: ["websocket"],
    auth: {
      runnerId: activeConfig.runnerId,
      runnerName: activeConfig.runnerName,
      token: activeConfig.token,
      version: chrome.runtime.getManifest().version,
    },
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1_000,
    reconnectionDelayMax: 10_000,
    timeout: 10_000,
  });

  socket.on("connect", async () => {
    publishConnection("connected", "Đã kết nối backend.");
    startHeartbeat();
    const { activeServerJob } = await chrome.storage.local.get("activeServerJob");
    if (activeServerJob?.jobId) {
      await reportJobStatus(activeServerJob.jobId, "FAILED", "Extension reconnected or restarted.").catch(() => {});
    }
    activeJobId = undefined;
    await chrome.storage.local.remove(["pendingServerJob", "activeServerJob"]);
  });

  socket.on("disconnect", (reason) => {
    stopHeartbeat();
    publishConnection("disconnected", `Mất kết nối: ${reason}`);
  });

  socket.on("connect_error", (error) => {
    stopHeartbeat();
    publishConnection("error", error.message || "Không thể kết nối backend.");
  });

  socket.on("ui-health:schedule-updated", (schedule) => {
    uiHealthCheckController?.updateSchedule(schedule?.intervalDays).catch((error) => {
      console.warn("[VAHAN UI HEALTH] Không thể cập nhật lịch kiểm tra:", error.message);
    });
  });

  socket.on("ui-health:run-now", (request = {}) => {
    uiHealthCheckController?.run("manual-web").then((healthCheck) => {
      console.info(
        "[VAHAN UI HEALTH] Kiểm tra tab VAHAN chính thức tức thời hoàn tất:",
        request.requestId || "unknown-request",
        healthCheck.status,
      );
    }).catch((error) => {
      console.warn("[VAHAN UI HEALTH] Kiểm tra tức thời thất bại:", error.message);
    });
  });

  socket.io.on("reconnect_attempt", () => {
    publishConnection("connecting", "Đang kết nối lại backend...");
  });

  socket.on("job:assigned", (job) => executeJob(job).catch(async (error) => {
    const jobId = String(job?.jobId || "");
    if (jobId) await reportJobStatus(jobId, "FAILED", error.message).catch(() => {});
    if (activeJobId === jobId) activeJobId = undefined;
  }));
  socket.on("job:cancelled", async ({ jobId }) => {
    const id = String(jobId);
    cancelledJobIds.add(id);
    if (activeJobId === id) activeJobId = undefined;
    await chrome.storage.local.remove(["pendingServerJob", "activeServerJob"]);
  });
  socket.on("captcha:submit", async (payload, acknowledge) => {
    const jobId = String(payload?.jobId || "");
    try {
      const { activeServerJob } = await chrome.storage.local.get("activeServerJob");
      if (!activeServerJob || activeServerJob.jobId !== jobId || (activeJobId && activeJobId !== jobId)) {
        throw new Error("The active VAHAN job no longer matches this CAPTCHA.");
      }
      activeJobId = jobId;
      if (activeServerJob.captchaId !== payload.captchaId) {
        throw new Error("The CAPTCHA has changed or expired.");
      }
      assertJobActive(jobId);
      const attempts = (activeServerJob.attempts || 0) + 1;
      await chrome.storage.local.set({
        activeServerJob: {
          ...activeServerJob,
          stage: "SUBMITTING",
          attempts,
        },
      });

      // The CAPTCHA was intentionally captured before the filters. Only now,
      // after the user has supplied the code, fill the official report form.
      const fillResponse = await sendToVahan(activeServerJob.tabId, {
        type: "FILL_VAHAN",
        config: activeServerJob.config,
      });
      if (!fillResponse?.ok) {
        throw new Error(fillResponse?.error || "VAHAN did not accept the filters.");
      }
      assertJobActive(jobId);
      const { vahanConfig = {} } = await chrome.storage.local.get("vahanConfig");
      await chrome.storage.local.set({
        vahanConfig: { ...vahanConfig, ...activeServerJob.config },
      });

      // Filling dynamic controls can cause the official page to refresh its
      // CAPTCHA. Do not submit a code against a different image.
      const currentCaptcha = await sendToVahan(activeServerJob.tabId, { type: "CAPTURE_CAPTCHA" });
      if (!currentCaptcha?.ok) {
        throw new Error(currentCaptcha?.error || "Could not verify the current CAPTCHA.");
      }
      if (currentCaptcha.captchaId !== activeServerJob.captchaId) {
        await chrome.storage.local.set({
          activeServerJob: {
            ...activeServerJob,
            captchaId: currentCaptcha.captchaId,
            stage: "WAITING_CAPTCHA",
            attempts: attempts - 1,
          },
        });
        await reportJobStatus(jobId, "WAITING_CAPTCHA");
        await publishCaptcha(jobId, currentCaptcha);
        acknowledge({ ok: true, refreshed: true });
        return;
      }

      const response = await sendToVahan(activeServerJob.tabId, {
        type: "SUBMIT_REMOTE_CAPTCHA",
        value: String(payload.value || ""),
        autoApply: activeServerJob.config.autoApply ?? false,
      });
      if (!response?.ok) throw new Error(response?.error || "Could not fill the CAPTCHA on VAHAN.");
      await chrome.storage.local.set({
        activeServerJob: {
          ...activeServerJob,
          stage: "WAITING_RESULT",
          attempts,
        },
      });
      await reportJobStatus(jobId, "WAITING_RESULT");
      acknowledge({ ok: true });
    } catch (error) {
      if (activeJobId === jobId) activeJobId = undefined;
      await chrome.storage.local.remove(["pendingServerJob", "activeServerJob"]);
      acknowledge({ ok: false, error: error.message });
    }
  });
  socket.on("captcha:refresh", async (payload, acknowledge) => {
    const jobId = String(payload?.jobId || "");
    try {
      const { activeServerJob } = await chrome.storage.local.get("activeServerJob");
      if (!activeServerJob || activeServerJob.jobId !== jobId || activeServerJob.stage !== "WAITING_CAPTCHA") {
        throw new Error("The job is not waiting for a CAPTCHA refresh.");
      }
      if (activeServerJob.captchaId !== payload?.captchaId) {
        throw new Error("The CAPTCHA has changed or expired.");
      }
      assertJobActive(jobId);
      const captcha = await requestFreshCaptcha(activeServerJob);
      await publishCaptchaChange(activeServerJob, captcha, "captcha:refreshed");
      acknowledge({ ok: true, captcha: {
        jobId,
        captchaId: captcha.captchaId,
        imageDataUrl: captcha.imageDataUrl,
      } });
    } catch (error) {
      acknowledge({ ok: false, error: error.message });
    }
  });
  socket.on("runner:options", async (request, acknowledge) => {
    try {
      const tabId = await getOptionsTab();
      const messageByType = {
        GET_ALL_OPTIONS: {
          type: "GET_VAHAN_OPTIONS",
          selectors: VAHAN_OPTION_SELECTORS,
        },
        GET_STATE_OPTIONS: { type: "GET_STATE_OPTIONS", delhiNcr: request.delhiNcr },
        GET_RTO_OPTIONS: { type: "GET_RTO_OPTIONS", stateLabels: request.stateLabels },
        GET_X_AXIS_OPTIONS: { type: "GET_X_AXIS_OPTIONS", yAxis: request.yAxis },
        SEARCH_MAKERS: { type: "SEARCH_MAKERS", search: request.search },
      };
      const message = messageByType[request.type];
      if (!message) throw new Error("Unsupported VAHAN options request.");
      acknowledge(await sendToVahan(tabId, message));
    } catch (error) {
      acknowledge({ ok: false, error: error.message });
    }
  });
}

async function handlePageResult(message, sender) {
  const { activeServerJob } = await chrome.storage.local.get("activeServerJob");
  if (!activeServerJob || (activeJobId && activeServerJob.jobId !== activeJobId)) return;
  activeJobId = activeServerJob.jobId;
  if (sender.tab?.id !== activeServerJob.tabId) return;
  const jobId = activeServerJob.jobId;

  if (message.result === "AUTH_REQUIRED") {
    const hold = vahanAuthHold || await loadVahanAuthHold();
    await reportJobStatus(
      jobId,
      "FAILED",
      `${VAHAN_AUTH_REQUIRED_CODE}: ${vahanAuthHoldMessage(hold || {})}`,
    ).catch(() => {});
    activeJobId = undefined;
    await chrome.storage.local.remove(["pendingServerJob", "activeServerJob"]);
    return;
  }

  if (message.result === "INVALID_CAPTCHA") {
    if ((activeServerJob.attempts || 0) >= 3) {
      await reportJobStatus(jobId, "FAILED", "CAPTCHA was invalid 3 consecutive times.").catch(() => {});
      activeJobId = undefined;
      await chrome.storage.local.remove(["pendingServerJob", "activeServerJob"]);
      return;
    }
    // A VAHAN invalid-message node can arrive before it swaps the image. Never
    // return that old image to the FE: force an official refresh if needed.
    let captcha = message.captcha;
    if (!captcha?.captchaId || !captcha?.imageDataUrl || captcha.captchaId === activeServerJob.captchaId) {
      captcha = await requestFreshCaptcha(activeServerJob);
    }
    await publishCaptchaChange(activeServerJob, captcha, "captcha:invalid");
    return;
  }

  if (message.result === "DOWNLOAD_READY") {
    try {
      await chrome.storage.local.set({
        activeServerJob: { ...activeServerJob, stage: "DOWNLOADING_REPORT" },
      });
      await triggerAndWaitForExcelDownload(activeServerJob.tabId);
      await reportJobStatus(jobId, "COMPLETED");
    } catch (error) {
      await reportJobStatus(jobId, "FAILED", error.message).catch(() => {});
    }
    activeJobId = undefined;
    await chrome.storage.local.remove(["pendingServerJob", "activeServerJob"]);
    return;
  }

  if (message.result === "COMPLETED") {
    await reportJobStatus(jobId, "COMPLETED");
    activeJobId = undefined;
    await chrome.storage.local.remove(["pendingServerJob", "activeServerJob"]);
    return;
  }

  // VAHAN filter hợp lệ nhưng không ra dữ liệu — khác lỗi hệ thống thật (selector gãy,
  // mất mạng...). Vẫn báo FAILED (job model không có trạng thái "rỗng" riêng) nhưng gắn
  // tiền tố NO_RECORD_FOUND để phía Web UI (batch runner) nhận diện và CHẠY TIẾP kịch bản
  // kế tiếp thay vì dừng cả hàng đợi như một lỗi thật.
  if (message.result === "NO_RECORD") {
    await reportJobStatus(jobId, "FAILED", "NO_RECORD_FOUND: VAHAN không có dữ liệu khớp bộ lọc này.").catch(() => {});
    activeJobId = undefined;
    await chrome.storage.local.remove(["pendingServerJob", "activeServerJob"]);
    return;
  }

  if (message.result === "FAILED") {
    await reportJobStatus(jobId, "FAILED", message.error || "VAHAN did not return a result.").catch(() => {});
    activeJobId = undefined;
    await chrome.storage.local.remove(["pendingServerJob", "activeServerJob"]);
  }
}

async function handleCaptchaChanged(message, sender) {
  const { activeServerJob } = await chrome.storage.local.get("activeServerJob");
  if (!activeServerJob || activeServerJob.stage !== "WAITING_CAPTCHA") return;
  if (sender.tab?.id !== activeServerJob.tabId) return;
  const captcha = message.captcha;
  if (!captcha?.captchaId || !captcha?.imageDataUrl || captcha.captchaId === activeServerJob.captchaId) return;
  await publishCaptchaChange(activeServerJob, captcha, "captcha:refreshed");
}

chrome.runtime.onInstalled.addListener(() => connectRunner());
chrome.runtime.onStartup.addListener(() => connectRunner());

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "local" || !changes.runnerConfig) return;
  const nextConfig = changes.runnerConfig.newValue;
  clearTimeout(reconnectTimer);
  reconnectTimer = setTimeout(() => {
    if (JSON.stringify(nextConfig) !== JSON.stringify(activeConfig)) connectRunner();
  }, 250);
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "SERVER_CAPTCHA_CHANGED") {
    handleCaptchaChanged(message, _sender)
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }
  if (message?.type === "EXCEL_BLOB_CAPTURED") {
    if (pendingBlobResolver) {
      pendingBlobResolver({ dataUrl: message.dataUrl, fileName: message.fileName });
    }
    sendResponse({ ok: true });
    return true;
  }

  if (message?.type === "SERVER_JOB_PAGE_RESULT") {
    handlePageResult(message, _sender)
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === "OPEN_ACTION_POPUP") {
    if (typeof chrome.action.openPopup !== "function") {
      sendResponse({ ok: false, error: "Tính năng này cần Google Chrome 127 trở lên." });
      return;
    }
    chrome.action.openPopup()
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === "GET_RUNNER_CONNECTION") {
    chrome.storage.local.get("runnerConnection").then(({ runnerConnection }) => {
      sendResponse({ ok: true, connection: runnerConnection || { status: "disconnected" } });
    });
    return true;
  }

  if (message?.type === "GET_VAHAN_AUTH_HOLD") {
    (async () => {
      const hold = vahanAuthHold || await loadVahanAuthHold();
      sendResponse({ ok: true, authHold: isVahanAuthHoldActive(hold) ? hold : null });
    })().catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === "CLEAR_VAHAN_AUTH_HOLD") {
    clearVahanAuthHold()
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === "RELOAD_VAHAN_PAGE") {
    (async () => {
      await clearVahanAuthHold();
      const tabs = await chrome.tabs.query({ url: "https://analytics.parivahan.gov.in/*" });
      if (tabs[0]?.id) {
        await chrome.tabs.update(tabs[0].id, { url: VAHAN_URL });
        return { ok: true };
      }
      await chrome.tabs.create({ url: VAHAN_URL });
      return { ok: true };
    })()
      .then(sendResponse)
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === "RECONNECT_RUNNER") {
    connectRunner()
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }
});

// UI Drift Guard is registered as an isolated listener. It owns only the
// configured read-only health check, backend CSV delivery and pending Dev
// alert; the MVP runner/job flow above remains unchanged.
uiHealthCheckController = registerUiHealthCheck(chrome);
installVahanAuthGuard();
void loadVahanAuthHold();
connectRunner();
