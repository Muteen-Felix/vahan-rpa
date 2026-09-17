export const UI_HEALTH_CHECK_ALARM = "vahan-ui-health-check";
export const DEFAULT_UI_HEALTH_CHECK_INTERVAL_DAYS = 3;
export const MIN_UI_HEALTH_CHECK_INTERVAL_DAYS = 1;
export const MAX_UI_HEALTH_CHECK_INTERVAL_DAYS = 365;
// Kept as a compatibility export for existing callers. The controller uses
// the configured interval at runtime and falls back to the default above.
export const UI_HEALTH_CHECK_INTERVAL_DAYS = DEFAULT_UI_HEALTH_CHECK_INTERVAL_DAYS;
export const UI_HEALTH_CHECK_INTERVAL_MINUTES = UI_HEALTH_CHECK_INTERVAL_DAYS * 24 * 60;
export const UI_HEALTH_CHECK_TIMEOUT_MS = 45_000;
export const UI_HEALTH_CHECK_TAB_READY_TIMEOUT_MS = 30_000;
export const UI_HEALTH_CHECK_MESSAGE = "RUN_SCHEDULED_UI_CHECK";
export const UI_HEALTH_CHECK_STATE_KEY = "vahanUiHealthCheck";
export const PENDING_DEV_NOTIFICATION_KEY = "vahanUiPendingDevNotification";
export const UI_HEALTH_SCHEDULE_PATH = "/api/ui-health/schedule";
export const UI_HEALTH_LOG_PATH = "/api/ui-health/logs";
export const UI_HEALTH_PENDING_LOGS_KEY = "vahanUiHealthPendingLogs";
export const UI_HEALTH_LOG_TIMEOUT_MS = 15_000;
export const VAHAN_PUBLIC_REPORT_URL =
  "https://analytics.parivahan.gov.in/analytics/vahanpublicreport?lang=en";

const DATA_CHANGED_STATUS = "DATA_CHANGED";

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

function withTimeout(promise, timeoutMs, message) {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timeoutId);
        resolve(value);
      },
      (error) => {
        clearTimeout(timeoutId);
        reject(error);
      },
    );
  });
}

function now() {
  return new Date().toISOString();
}

function createCheckId() {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function errorMessage(error) {
  return String(error?.message || error || "Unknown scheduled health-check error")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 300);
}

function normalizeIntervalDays(value, fallback = DEFAULT_UI_HEALTH_CHECK_INTERVAL_DAYS) {
  const numeric = Number(value);
  if (
    Number.isInteger(numeric) &&
    numeric >= MIN_UI_HEALTH_CHECK_INTERVAL_DAYS &&
    numeric <= MAX_UI_HEALTH_CHECK_INTERVAL_DAYS
  ) {
    return numeric;
  }
  return fallback;
}

function intervalMinutesForDays(intervalDays) {
  return intervalDays * 24 * 60;
}

async function loadBackendSchedule(chromeApi, fetchImpl) {
  if (typeof fetchImpl !== "function") return null;

  const stored = await chromeApi.storage.local.get("runnerConfig");
  const runnerConfig = stored?.runnerConfig || {};
  const serverUrl = String(runnerConfig.serverUrl || "").trim().replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(serverUrl)) return null;

  const response = await fetchImpl(`${serverUrl}${UI_HEALTH_SCHEDULE_PATH}`);
  if (!response?.ok) {
    throw new Error(`Không tải được lịch kiểm tra từ backend (${response?.status || "unknown"}).`);
  }
  const payload = await response.json();
  const intervalDays = normalizeIntervalDays(payload?.intervalDays, null);
  if (intervalDays === null) {
    throw new Error("Backend trả về số ngày kiểm tra không hợp lệ.");
  }
  return intervalDays;
}

async function postHealthCheck(chromeApi, healthCheck, fetchImpl) {
  if (typeof fetchImpl !== "function") {
    throw new Error("Backend log upload is unavailable in this extension runtime.");
  }

  const stored = await chromeApi.storage.local.get("runnerConfig");
  const runnerConfig = stored?.runnerConfig || {};
  const serverUrl = String(runnerConfig.serverUrl || "").trim().replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(serverUrl)) {
    throw new Error("Chưa cấu hình địa chỉ backend để gửi log UI health.");
  }

  const response = await withTimeout(
    fetchImpl(`${serverUrl}${UI_HEALTH_LOG_PATH}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        healthCheck,
        pageUrl: VAHAN_PUBLIC_REPORT_URL,
        runnerId: runnerConfig.runnerId || null,
      }),
    }),
    UI_HEALTH_LOG_TIMEOUT_MS,
    "Timed out while sending the UI health log to the backend.",
  );
  if (!response?.ok) {
    throw new Error(`Không gửi được log UI health lên backend (${response?.status || "unknown"}).`);
  }
  return response.json();
}

function normalizeControl(control = {}) {
  return {
    name: String(control.name || ""),
    selector: String(control.selector || ""),
    tag: String(control.tag || ""),
    id: String(control.id || ""),
    nameAttr: String(control.nameAttr ?? control.name_attr ?? ""),
    multiple: Boolean(control.multiple),
  };
}

function normalizeDataSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== "object") return null;
  const controls = {};
  for (const [name, control] of Object.entries(snapshot.controls || {})) {
    controls[name] = {
      selector: String(control?.selector || ""),
      optionCount: Number.isFinite(Number(control?.optionCount))
        ? Number(control.optionCount)
        : 0,
      digest: String(control?.digest || ""),
      sample: Array.isArray(control?.sample)
        ? control.sample.slice(0, 8).map((option) => ({
          label: String(option?.label || ""),
          value: String(option?.value || ""),
        }))
        : [],
    };
  }
  return {
    version: String(snapshot.version || "v1"),
    signature: String(snapshot.signature || ""),
    controls,
  };
}

function normalizeContract(contract = {}) {
  return {
    contractVersion: String(contract.contractVersion || ""),
    signature: String(contract.signature || ""),
    path: String(contract.path || contract.urlPath || ""),
    formAction: String(contract.formAction || ""),
    controls: Array.isArray(contract.controls)
      ? contract.controls.map(normalizeControl)
      : [],
    dataSnapshot: normalizeDataSnapshot(contract.dataSnapshot),
  };
}

export function compareDataSnapshots(previous, current) {
  if (!previous?.signature || !current?.signature) return [];
  const previousControls = previous?.controls || {};
  const currentControls = current?.controls || {};
  const names = new Set([
    ...Object.keys(previousControls),
    ...Object.keys(currentControls),
  ]);
  return [...names]
    .sort()
    .filter((name) => {
      const before = previousControls[name];
      const after = currentControls[name];
      if (!before || !after) return Boolean(before || after);
      return before.optionCount !== after.optionCount || before.digest !== after.digest;
    })
    .map((name) => ({
      name,
      selector: currentControls[name]?.selector || previousControls[name]?.selector || "",
      previous: previousControls[name] || null,
      current: currentControls[name] || null,
    }));
}

function summarizeContract(contract) {
  const normalized = normalizeContract(contract);
  return {
    ...normalized,
    controls: normalized.controls,
    dataSnapshot: normalized.dataSnapshot,
  };
}

function normalizeUiDriftReport(report = {}) {
  return {
    code: String(report.code || "UI_DRIFT"),
    step: String(report.step || "scheduled-health-check"),
    title: String(report.title || "Cấu trúc UI không khớp contract"),
    target: String(report.target || "trang VAHAN Public Report"),
    expected: String(report.expected || "không có dữ liệu"),
    actual: String(report.actual || "không có dữ liệu"),
    action: String(report.action || "Dev cần kiểm tra UI contract."),
    message: String(report.message || "Phát hiện thay đổi trên trang VAHAN."),
    diagnostics: report.diagnostics && typeof report.diagnostics === "object"
      ? report.diagnostics
      : {},
  };
}

function dataChangedReport(changes, previousContract, currentContract) {
  const target = changes.length === 1
    ? changes[0].name
    : `${changes.length} control chứa dữ liệu option`;
  const actual = changes.map((change) => {
    const before = change.previous;
    const after = change.current;
    return `${change.name}: ${before?.optionCount ?? 0} option/${before?.digest || "missing"}` +
      ` → ${after?.optionCount ?? 0} option/${after?.digest || "missing"}`;
  }).join("; ");
  return {
    code: "UI_DRIFT_OPTION_DATA_CHANGED",
    step: "scheduled-health-check",
    title: "Dữ liệu option của trang VAHAN đã thay đổi",
    target,
    expected: "Bộ dữ liệu option khớp lần kiểm tra trước",
    actual,
    action: "Dev cần xác minh thay đổi dữ liệu, cập nhật adapter nếu cần và chạy lại kiểm thử UI.",
    message: `Phát hiện dữ liệu thay đổi tại ${target}. Tool đã ghi log để Dev phân tích.`,
    diagnostics: {
      previousDataSignature: previousContract?.dataSnapshot?.signature || "",
      currentDataSignature: currentContract?.dataSnapshot?.signature || "",
      changes,
    },
  };
}

async function queueDevNotification(chromeApi, healthCheck) {
  if (!["UI_DRIFT", DATA_CHANGED_STATUS].includes(healthCheck.status)) return null;

  const stored = await chromeApi.storage.local.get(PENDING_DEV_NOTIFICATION_KEY);
  const previous = stored[PENDING_DEV_NOTIFICATION_KEY];
  const sameAlert = previous?.report?.code === healthCheck.report?.code &&
    previous?.report?.target === healthCheck.report?.target;
  const notification = {
    schemaVersion: "v1",
    type: healthCheck.status === DATA_CHANGED_STATUS
      ? "VAHAN_UI_DATA_CHANGED"
      : "VAHAN_UI_DRIFT",
    alertType: healthCheck.status,
    delivery: "PENDING_CONFIGURATION",
    firstDetectedAt: sameAlert ? previous.firstDetectedAt : healthCheck.checkedAt,
    lastDetectedAt: healthCheck.checkedAt,
    occurrences: sameAlert ? Number(previous.occurrences || 0) + 1 : 1,
    report: healthCheck.report,
  };

  // This is intentionally only a local queue. A future website/webhook/email
  // connector can read this payload without changing the health-check flow.
  await chromeApi.storage.local.set({ [PENDING_DEV_NOTIFICATION_KEY]: notification });
  return notification;
}

async function flushPendingHealthLogs(chromeApi, fetchImpl) {
  const stored = await chromeApi.storage.local.get(UI_HEALTH_PENDING_LOGS_KEY);
  const pending = Array.isArray(stored[UI_HEALTH_PENDING_LOGS_KEY])
    ? stored[UI_HEALTH_PENDING_LOGS_KEY].filter((item) => item && typeof item === "object")
    : [];
  let lastResult = null;
  let lastError = null;

  while (pending.length > 0) {
    try {
      lastResult = await postHealthCheck(chromeApi, pending[0], fetchImpl);
      pending.shift();
    } catch (error) {
      lastError = errorMessage(error);
      break;
    }
  }
  await chromeApi.storage.local.set({ [UI_HEALTH_PENDING_LOGS_KEY]: pending });
  return {
    ok: pending.length === 0,
    pendingCount: pending.length,
    lastResult,
    error: lastError,
  };
}

async function deliverHealthLog(chromeApi, healthCheck, fetchImpl) {
  await flushPendingHealthLogs(chromeApi, fetchImpl);
  try {
    const result = await postHealthCheck(chromeApi, healthCheck, fetchImpl);
    const pending = await chromeApi.storage.local.get(UI_HEALTH_PENDING_LOGS_KEY);
    return {
      ...(result || {}),
      ok: true,
      pendingCount: Array.isArray(pending[UI_HEALTH_PENDING_LOGS_KEY])
        ? pending[UI_HEALTH_PENDING_LOGS_KEY].length
        : 0,
    };
  } catch (error) {
    const stored = await chromeApi.storage.local.get(UI_HEALTH_PENDING_LOGS_KEY);
    const pending = Array.isArray(stored[UI_HEALTH_PENDING_LOGS_KEY])
      ? stored[UI_HEALTH_PENDING_LOGS_KEY]
      : [];
    pending.push(healthCheck);
    await chromeApi.storage.local.set({ [UI_HEALTH_PENDING_LOGS_KEY]: pending });
    return {
      ok: false,
      queued: true,
      pendingCount: pending.length,
      error: errorMessage(error),
    };
  }
}

async function persistUiHealthCheck(chromeApi, healthCheck, fetchImpl) {
  const identifiedHealthCheck = {
    ...healthCheck,
    checkId: healthCheck.checkId || createCheckId(),
  };
  const notification = await queueDevNotification(chromeApi, identifiedHealthCheck);
  await chromeApi.storage.local.set({
    [UI_HEALTH_CHECK_STATE_KEY]: identifiedHealthCheck,
    ...(notification ? { [PENDING_DEV_NOTIFICATION_KEY]: notification } : {}),
  });

  const saved = {
    ...identifiedHealthCheck,
    backendLog: await deliverHealthLog(chromeApi, identifiedHealthCheck, fetchImpl),
  };
  await chromeApi.storage.local.set({ [UI_HEALTH_CHECK_STATE_KEY]: saved });
  return saved;
}

function waitForTabReady(chromeApi, tabId, timeoutMs = UI_HEALTH_CHECK_TAB_READY_TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const onUpdated = (updatedTabId, changeInfo) => {
      if (updatedTabId === tabId && changeInfo.status === "complete") finish(resolve);
    };
    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      chromeApi.tabs.onUpdated?.removeListener(onUpdated);
      callback(value);
    };
    const timeoutId = setTimeout(
      () => finish(reject, new Error("Timed out while loading the VAHAN health-check tab.")),
      timeoutMs,
    );

    chromeApi.tabs.onUpdated?.addListener(onUpdated);
    chromeApi.tabs.get(tabId)
      .then((tab) => {
        if (tab.status === "complete") finish(resolve);
      })
      .catch(() => {});
  });
}

async function requestUiHealthCheck(chromeApi, tabId, retryDelayMs = 500) {
  let lastError;
  for (let attempt = 0; attempt < 10; attempt += 1) {
    try {
      return await chromeApi.tabs.sendMessage(tabId, { type: UI_HEALTH_CHECK_MESSAGE });
    } catch (error) {
      lastError = error;
      await wait(retryDelayMs);
    }
  }
  throw lastError || new Error("VAHAN health-check content script did not respond.");
}

export function createUiHealthCheckController(chromeApi, options = {}) {
  const fallbackIntervalDays = normalizeIntervalDays(
    options.intervalDays,
    normalizeIntervalDays(
      Number(options.intervalMinutes) / (24 * 60),
      DEFAULT_UI_HEALTH_CHECK_INTERVAL_DAYS,
    ),
  );
  let intervalDays = fallbackIntervalDays;
  const checkTimeoutMs = options.checkTimeoutMs || UI_HEALTH_CHECK_TIMEOUT_MS;
  const tabReadyTimeoutMs = options.tabReadyTimeoutMs || UI_HEALTH_CHECK_TAB_READY_TIMEOUT_MS;
  const retryDelayMs = options.retryDelayMs ?? 500;
  const fetchImpl = options.fetch || globalThis.fetch;
  let activeHealthCheck = null;

  async function ensureAlarm({ force = false, requestedIntervalDays } = {}) {
    if (!chromeApi.alarms?.get || !chromeApi.alarms?.create) {
      return { ok: false, reason: "Chrome alarms API is unavailable." };
    }
    if (requestedIntervalDays !== undefined) {
      const normalized = normalizeIntervalDays(requestedIntervalDays, null);
      if (normalized === null) {
        return {
          ok: false,
          reason: `Số ngày kiểm tra phải từ ${MIN_UI_HEALTH_CHECK_INTERVAL_DAYS} đến ${MAX_UI_HEALTH_CHECK_INTERVAL_DAYS}.`,
          intervalDays,
        };
      }
      intervalDays = normalized;
    }
    const intervalMinutes = intervalMinutesForDays(intervalDays);
    const existing = await chromeApi.alarms.get(UI_HEALTH_CHECK_ALARM);
    if (!force && existing && Number(existing.periodInMinutes) === intervalMinutes) {
      return { ok: true, created: false, intervalDays, alarm: existing };
    }
    await chromeApi.alarms.create(UI_HEALTH_CHECK_ALARM, {
      delayInMinutes: intervalMinutes,
      periodInMinutes: intervalMinutes,
    });
    return {
      ok: true,
      created: !existing,
      updated: Boolean(existing),
      intervalDays,
    };
  }

  async function updateSchedule(requestedIntervalDays) {
    return ensureAlarm({ force: true, requestedIntervalDays });
  }

  async function refreshScheduleFromBackend() {
    try {
      const configuredIntervalDays = await loadBackendSchedule(chromeApi, fetchImpl);
      if (configuredIntervalDays === null) {
        return {
          ok: false,
          reason: "Backend schedule is unavailable; keeping the current extension schedule.",
          intervalDays,
        };
      }
      return updateSchedule(configuredIntervalDays);
    } catch (error) {
      return { ok: false, reason: errorMessage(error), intervalDays };
    }
  }

  async function execute(trigger) {
    const startedAt = now();
    const previousState = await chromeApi.storage.local.get(UI_HEALTH_CHECK_STATE_KEY);
    const previousHealthCheck = previousState[UI_HEALTH_CHECK_STATE_KEY];
    let tabId;

    try {
      const tab = await chromeApi.tabs.create({ url: VAHAN_PUBLIC_REPORT_URL, active: false });
      tabId = tab.id;
      if (!tabId) throw new Error("Chrome did not return a health-check tab ID.");

      await waitForTabReady(chromeApi, tabId, tabReadyTimeoutMs);
      const response = await withTimeout(
        requestUiHealthCheck(chromeApi, tabId, retryDelayMs),
        checkTimeoutMs,
        "Timed out while checking the VAHAN UI contract.",
      );
      const checkedAt = now();

      if (response?.ok && response.contract) {
        const contract = summarizeContract(response.contract);
        const changes = compareDataSnapshots(
          previousHealthCheck?.contract?.dataSnapshot,
          contract.dataSnapshot,
        );
        if (changes.length > 0) {
          return persistUiHealthCheck(chromeApi, {
            status: DATA_CHANGED_STATUS,
            trigger,
            startedAt,
            checkedAt,
            contract,
            report: dataChangedReport(
              changes,
              previousHealthCheck?.contract,
              contract,
            ),
          }, fetchImpl);
        }
        return persistUiHealthCheck(chromeApi, {
          status: "PASS",
          trigger,
          startedAt,
          checkedAt,
          contract,
        }, fetchImpl);
      }

      if (response?.uiDrift) {
        return persistUiHealthCheck(chromeApi, {
          status: "UI_DRIFT",
          trigger,
          startedAt,
          checkedAt,
          report: normalizeUiDriftReport(response.uiDrift),
        }, fetchImpl);
      }

      return persistUiHealthCheck(chromeApi, {
        status: "CHECK_ERROR",
        trigger,
        startedAt,
        checkedAt,
        error: errorMessage(response?.error || "The VAHAN health check returned no result."),
      }, fetchImpl);
    } catch (error) {
      return persistUiHealthCheck(chromeApi, {
        status: "CHECK_ERROR",
        trigger,
        startedAt,
        checkedAt: now(),
        error: errorMessage(error),
      }, fetchImpl);
    } finally {
      if (tabId) await chromeApi.tabs.remove(tabId).catch(() => {});
    }
  }

  async function getState() {
    return chromeApi.storage.local.get([
      UI_HEALTH_CHECK_STATE_KEY,
      PENDING_DEV_NOTIFICATION_KEY,
      UI_HEALTH_PENDING_LOGS_KEY,
    ]);
  }

  function run(trigger = "alarm") {
    if (!activeHealthCheck) {
      activeHealthCheck = execute(trigger).finally(() => {
        activeHealthCheck = null;
      });
    }
    return activeHealthCheck;
  }

  return Object.freeze({
    ensureAlarm,
    getState,
    refreshScheduleFromBackend,
    run,
    updateSchedule,
  });
}

export function registerUiHealthCheck(chromeApi, options = {}) {
  const controller = createUiHealthCheckController(chromeApi, options);
  const ensure = () => {
    controller.ensureAlarm().catch((error) => {
      console.error("[VAHAN UI HEALTH] Không thể tạo lịch kiểm tra:", errorMessage(error));
    });
  };

  chromeApi.runtime?.onInstalled?.addListener(ensure);
  chromeApi.runtime?.onStartup?.addListener(ensure);
  chromeApi.alarms?.onAlarm?.addListener((alarm) => {
    if (alarm.name === UI_HEALTH_CHECK_ALARM) void controller.run("alarm");
  });
  chromeApi.runtime?.onMessage?.addListener((message, _sender, sendResponse) => {
    if (message?.type === "GET_UI_HEALTH_CHECK") {
      controller.getState()
        .then(sendResponse)
        .catch((error) => sendResponse({ error: errorMessage(error) }));
      return true;
    }
    if (message?.type === "RUN_UI_HEALTH_CHECK_NOW") {
      controller.run("manual")
        .then((healthCheck) => sendResponse({
          ok: healthCheck.status === "PASS",
          healthCheck,
        }))
        .catch((error) => sendResponse({ ok: false, error: errorMessage(error) }));
      return true;
    }
    return undefined;
  });
  ensure();
  return controller;
}
