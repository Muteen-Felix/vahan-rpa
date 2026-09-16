import { io } from "socket.io-client";
import { normalizeJobFilters } from "./job-config.mjs";

const DEFAULT_RUNNER_CONFIG = Object.freeze({
  serverUrl: "http://127.0.0.1:8000",
  runnerName: "VAHAN Chrome",
  token: "change-me",
});
const HEARTBEAT_INTERVAL_MS = 20_000;
const VAHAN_URL = "https://analytics.parivahan.gov.in/analytics/vahanpublicreport?lang=en";

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

    // Phase 5 will capture the current CAPTCHA and replace this status update
    // with captcha:required, including the image shown in the Web UI.
    await reportJobStatus(jobId, "WAITING_CAPTCHA");
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

  socket.on("connect", () => {
    publishConnection("connected", "Đã kết nối backend.");
    startHeartbeat();
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
