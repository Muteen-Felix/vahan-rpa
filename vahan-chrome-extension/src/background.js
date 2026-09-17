import { io } from "socket.io-client";
import { normalizeJobFilters } from "./job-config.mjs";

const DEFAULT_RUNNER_CONFIG = Object.freeze({
  serverUrl: "http://127.0.0.1:8000",
  runnerName: "VAHAN Chrome",
  token: "change-me",
});
const HEARTBEAT_INTERVAL_MS = 20_000;
const VAHAN_URL = "https://analytics.parivahan.gov.in/analytics/vahanpublicreport?lang=en";
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

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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

async function waitForTabComplete(tabId, timeout = 30_000) {
  const current = await chrome.tabs.get(tabId);
  if (current.status === "complete") return;
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      reject(new Error("VAHAN page did not finish loading in time."));
    }, timeout);
    const listener = (updatedId, changeInfo) => {
      if (updatedId !== tabId || changeInfo.status !== "complete") return;
      clearTimeout(timer);
      chrome.tabs.onUpdated.removeListener(listener);
      resolve();
    };
    chrome.tabs.onUpdated.addListener(listener);
  });
}

async function getVahanTab() {
  const tabs = await chrome.tabs.query({ url: "https://analytics.parivahan.gov.in/analytics/vahanpublicreport*" });
  const tab = tabs[0] || await chrome.tabs.create({ url: VAHAN_URL, active: false });
  if (!tab.id) throw new Error("Chrome did not return a VAHAN tab id.");
  await waitForTabComplete(tab.id);
  return tab.id;
}

async function sendToVahan(tabId, message) {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    try {
      return await chrome.tabs.sendMessage(tabId, message);
    } catch (error) {
      if (attempt === 0 && String(error?.message).includes("Receiving end")) {
        await chrome.tabs.reload(tabId);
        await waitForTabComplete(tabId);
      }
      if (attempt === 11) throw error;
      await delay(500);
    }
  }
}

async function triggerAndWaitForExcelDownload(tabId) {
  return new Promise((resolve, reject) => {
    let downloadId;
    const cleanup = () => {
      clearTimeout(timer);
      chrome.downloads.onCreated.removeListener(onCreated);
      chrome.downloads.onChanged.removeListener(onChanged);
    };
    const onCreated = (item) => {
      if (downloadId !== undefined) return;
      downloadId = item.id;
      if (item.state === "complete") { cleanup(); resolve(item); }
    };
    const onChanged = (delta) => {
      if (delta.id !== downloadId || !delta.state) return;
      if (delta.state.current === "complete") { cleanup(); resolve(delta); }
      if (delta.state.current === "interrupted") {
        cleanup();
        reject(new Error("Excel download was interrupted."));
      }
    };
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("Excel download did not complete within 60 seconds."));
    }, 60_000);
    chrome.downloads.onCreated.addListener(onCreated);
    chrome.downloads.onChanged.addListener(onChanged);
    sendToVahan(tabId, { type: "CLICK_EXCEL_DOWNLOAD" }).then((response) => {
      if (!response?.ok) {
        cleanup();
        reject(new Error(response?.error || "Could not click the Excel download button."));
      }
    }).catch((error) => { cleanup(); reject(error); });
  });
}

async function executeJob(job) {
  const jobId = String(job?.jobId || "");
  if (!jobId) return;
  if (activeJobId === jobId) return;
  if (activeJobId) {
    await reportJobStatus(jobId, "FAILED", `Runner is already processing job ${activeJobId}.`).catch(() => {});
    return;
  }

  activeJobId = jobId;
  cancelledJobIds.delete(jobId);
  await chrome.storage.local.set({ pendingServerJob: job });
  chrome.runtime.sendMessage({ type: "SERVER_JOB_ASSIGNED", job }).catch(() => {});

  try {
    await reportJobStatus(jobId, "OPENING_VAHAN");
    const tabId = await getVahanTab();
    assertJobActive(jobId);

    const config = normalizeJobFilters(job.filters);
    const { vahanConfig = {} } = await chrome.storage.local.get("vahanConfig");
    await chrome.storage.local.set({
      vahanConfig: { ...vahanConfig, ...config },
      activeServerJob: { ...job, tabId, config },
    });

    await reportJobStatus(jobId, "FILLING_FILTERS");
    const response = await sendToVahan(tabId, { type: "FILL_VAHAN", config });
    if (!response?.ok) throw new Error(response?.error || "VAHAN did not accept the filters.");
    assertJobActive(jobId);

    const captcha = await sendToVahan(tabId, { type: "CAPTURE_CAPTCHA" });
    if (!captcha?.ok) throw new Error(captcha?.error || "Could not capture the CAPTCHA.");
    assertJobActive(jobId);
    await chrome.storage.local.set({
      activeServerJob: { ...job, tabId, config, captchaId: captcha.captchaId, stage: "WAITING_CAPTCHA", attempts: 0 },
    });
    await publishCaptcha(jobId, captcha);
  } catch (error) {
    if (!cancelledJobIds.has(jobId)) {
      await reportJobStatus(jobId, "FAILED", error.message).catch(() => {});
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
      activeJobId = activeServerJob.jobId;
      if (!activeServerJob.stage) {
        await reportJobStatus(activeJobId, "FAILED", "Extension restarted while preparing the VAHAN job.").catch(() => {});
        activeJobId = undefined;
        await chrome.storage.local.remove(["pendingServerJob", "activeServerJob"]);
      }
    }
  });

  socket.on("disconnect", (reason) => {
    stopHeartbeat();
    publishConnection("disconnected", `Mất kết nối: ${reason}`);
  });

  socket.on("connect_error", (error) => {
    stopHeartbeat();
    publishConnection("error", error.message || "Không thể kết nối backend.");
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
      await chrome.storage.local.set({
        activeServerJob: {
          ...activeServerJob,
          stage: "WAITING_RESULT",
          attempts: (activeServerJob.attempts || 0) + 1,
        },
      });
      const response = await sendToVahan(activeServerJob.tabId, {
        type: "SUBMIT_REMOTE_CAPTCHA",
        value: String(payload.value || ""),
        autoApply: activeServerJob.config.autoApply ?? false,
      });
      if (!response?.ok) throw new Error(response?.error || "Could not fill the CAPTCHA on VAHAN.");
      await reportJobStatus(jobId, "WAITING_RESULT");
      acknowledge({ ok: true });
    } catch (error) {
      if (activeJobId === jobId) activeJobId = undefined;
      await chrome.storage.local.remove(["pendingServerJob", "activeServerJob"]);
      acknowledge({ ok: false, error: error.message });
    }
  });
  socket.on("runner:options", async (request, acknowledge) => {
    try {
      const tabId = await getVahanTab();
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

  if (message.result === "INVALID_CAPTCHA") {
    if ((activeServerJob.attempts || 0) >= 3) {
      await reportJobStatus(jobId, "FAILED", "CAPTCHA was invalid 3 consecutive times.").catch(() => {});
      activeJobId = undefined;
      await chrome.storage.local.remove(["pendingServerJob", "activeServerJob"]);
      return;
    }
    const captcha = message.captcha;
    if (!captcha?.captchaId || !captcha?.imageDataUrl) return;
    await emitWithRetry("captcha:invalid", {
      jobId,
      captchaId: captcha.captchaId,
      imageDataUrl: captcha.imageDataUrl,
    });
    await chrome.storage.local.set({
      activeServerJob: { ...activeServerJob, captchaId: captcha.captchaId, stage: "WAITING_CAPTCHA" },
    });
    return;
  }

  if (message.result === "DOWNLOAD_READY") {
    try {
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
  await emitWithRetry("captcha:refreshed", {
    jobId: activeServerJob.jobId,
    captchaId: captcha.captchaId,
    imageDataUrl: captcha.imageDataUrl,
  });
  await chrome.storage.local.set({
    activeServerJob: { ...activeServerJob, captchaId: captcha.captchaId },
  });
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

  if (message?.type === "RECONNECT_RUNNER") {
    connectRunner()
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }
});

connectRunner();
