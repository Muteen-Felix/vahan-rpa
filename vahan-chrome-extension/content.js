// ── Excel byte bridge ───────────────────────────────────────────────
// interceptor-main.js observes the page's export in the MAIN world and
// suppresses the native browser download. This isolated-world handler
// forwards the captured, non-empty bytes to the service worker, which
// uploads them to the API server as the sole copy of the report.
function sendExcelDataUrl(dataUrl, fileName) {
  if (typeof dataUrl !== "string" || !dataUrl.startsWith("data:")) {
    console.error("[VAHAN EXT] Invalid Excel data URL.");
    return;
  }
  chrome.runtime.sendMessage({
    type: "EXCEL_BLOB_CAPTURED",
    dataUrl,
    fileName: fileName || "report.xlsx",
  }).catch((error) => console.error("[VAHAN EXT] Send blob error:", error));
}

async function blobToDataUrl(blob, fileName) {
  if (!blob?.size) throw new Error("Excel blob was empty.");
  await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error || new Error("Could not read the Excel blob."));
    reader.onload = () => {
      sendExcelDataUrl(reader.result, fileName);
      resolve();
    };
    reader.readAsDataURL(blob);
  });
}

async function captureExcelDownload(href, fileName = "report.xlsx") {
  if (typeof href !== "string" || !href) throw new Error("Excel download URL is missing.");
  let lastError;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      const response = await fetch(href, { credentials: "include" });
      if (!response.ok) throw new Error(`Excel download fetch failed (${response.status}).`);
      const blob = await response.blob();
      await blobToDataUrl(blob, fileName);
      return;
    } catch (error) {
      lastError = error;
      if (attempt < 3) await delay(100 * (attempt + 1));
    }
  }
  throw lastError || new Error("Excel file could not be captured.");
}

(function installDownloadInterceptor() {
  window.addEventListener("__VAHAN_EXCEL_EXPORT__", (e) => {
    const { dataUrl, href, fileName } = e.detail || {};
    if (dataUrl) sendExcelDataUrl(dataUrl, fileName);
    else if (href) captureExcelDownload(href, fileName).catch((error) => {
      console.error("[VAHAN EXT] Failed to capture Excel download:", error);
    });
  });
})();

const splitValues = (value) => String(value || "").split(",").map((item) => item.trim()).filter(Boolean);
const normalize = (value) => String(value || "").replace(/\s+/g, " ").trim().toLocaleLowerCase();
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const VAHAN_AUTH_HOLD_KEY = "vahanAuthHold";
const VAHAN_AUTH_GUARD_VERSION = 2;

async function getActiveVahanAuthHold() {
  try {
    const { [VAHAN_AUTH_HOLD_KEY]: hold } = await chrome.storage.local.get(VAHAN_AUTH_HOLD_KEY);
    if (hold?.code !== "VAHAN_AUTH_REQUIRED" || hold.guardVersion !== VAHAN_AUTH_GUARD_VERSION) return null;
    const retryAfter = Date.parse(hold.retryAfter || "");
    return Number.isFinite(retryAfter) && retryAfter > Date.now() ? hold : null;
  } catch {
    return null;
  }
}

function authHoldStatusMessage(hold) {
  const retryAfter = hold?.retryAfter
    ? new Date(hold.retryAfter).toLocaleString("en-GB")
    : "after confirmation";
  return `VAHAN requires HTTP authentication. The extension is paused to prevent repeated retries. `
    + `Close the sign-in dialog, wait until ${retryAfter}, then reload the page.`;
}


function getOptionMap(select) {
  return [...select.options].map((option) => ({
    label: normalize(option.label || option.textContent),
    value: option.value,
  }));
}

async function waitForOptions(selector, labels, timeout = 15000) {
  const expected = labels.map(normalize);
  const isReady = () => {
    const select = document.querySelector(selector);
    if (!select) return false;
    const available = getOptionMap(select).map((option) => option.label);
    return expected.every((label) => available.includes(label));
  };
  await waitForDomCondition(
    isReady,
    timeout,
    100,
    `${selector}: dynamic options did not load within ${timeout} ms.`,
  );
}

function waitForDomCondition(check, timeout, stableMs, timeoutMessage) {
  return new Promise((resolve, reject) => {
    let settled = false;
    let stableTimer;
    const observer = new MutationObserver(evaluate);
    const timeoutTimer = window.setTimeout(() => {
      finish(reject, new Error(timeoutMessage));
    }, timeout);

    function finish(callback, value) {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeoutTimer);
      window.clearTimeout(stableTimer);
      observer.disconnect();
      callback(value);
    }

    function evaluate() {
      if (settled) return;
      if (!check()) {
        window.clearTimeout(stableTimer);
        stableTimer = undefined;
        return;
      }
      if (!stableMs) {
        finish(resolve);
        return;
      }
      if (stableTimer === undefined) {
        stableTimer = window.setTimeout(() => {
          stableTimer = undefined;
          if (check()) finish(resolve);
          else evaluate();
        }, stableMs);
      }
    }

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    evaluate();
  });
}

async function refreshXAxisOptions(yAxisLabel, { resetSelection = false } = {}) {
  const yAxis = document.querySelector("#yAxis");
  const xAxis = document.querySelector("#xAxis");
  if (!yAxis || !xAxis) throw new Error("Could not find #yAxis or #xAxis.");
  const match = getOptionMap(yAxis).find((option) => option.label === normalize(yAxisLabel));
  if (!match) throw new Error(`#yAxis: could not find "${yAxisLabel}".`);

  // VAHAN restores X-Axis from a hidden field while rebuilding its options.
  // Clear both values during job fills so a previous scenario cannot affect
  // the requested selection. Option lookups keep the page's current choice.
  const hiddenXAxis = document.querySelector("#xAxis_hidden");
  if (resetSelection) {
    xAxis.value = "";
    if (hiddenXAxis) hiddenXAxis.value = "";
  }
  yAxis.value = match.value;
  yAxis.dispatchEvent(new Event("change", { bubbles: true }));
  yAxis.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
  await delay(50);
  return [...xAxis.options]
    .filter((option) => option.value)
    .map((option) => (option.label || option.textContent || "").replace(/\s+/g, " ").trim());
}

async function waitForXAxisOptions(yAxisLabel, labels, timeout = 15000) {
  const expected = labels.map(normalize);
  let available = [];
  const isReady = () => {
    const xAxis = document.querySelector("#xAxis");
    if (xAxis) {
      available = [...xAxis.options]
        .filter((option) => option.value)
        .map((option) => (option.label || option.textContent || "").replace(/\s+/g, " ").trim());
      const availableNormalized = available.map(normalize);
      return expected.every((label) => availableNormalized.includes(label));
    }
    return false;
  };
  try {
    // Keep the requested option present briefly so an old list is not
    // mistaken for the options VAHAN is rebuilding after the Y-Axis change.
    await waitForDomCondition(isReady, timeout, 400, "X-Axis options did not settle.");
    return;
  } catch {
    // Keep the existing, detailed selector error for the caller.
  }
  const missing = labels.filter((label, index) => !available.map(normalize).includes(expected[index]));
  throw new Error(
    `#xAxis: requested option(s) "${missing.join(", ")}" did not load for Y-Axis "${yAxisLabel}" `
    + `within ${timeout} ms. Available X-Axis options: ${available.join(", ") || "(none)"}.`,
  );
}

async function selectLabels(selector, rawValue) {
  const labels = splitValues(rawValue);
  const select = document.querySelector(selector);
  if (!select) throw new Error(`Could not find ${selector}.`);
  const options = getOptionMap(select);
  if (!labels.length && !select.multiple) return;
  const values = labels.map((label) => options.find((option) => option.label === normalize(label))?.value);
  if (values.some((value) => value === undefined)) throw new Error(`${selector}: could not find "${labels.join(", ")}".`);

  // Write to the native select first. The VAHAN multi-select widget can omit
  // filtered/lazy rows from its DOM, so clicking visible widget rows is not a
  // reliable way to update RTO and other dynamic multi-selects.
  for (const option of select.options) option.selected = values.includes(option.value);
  select.dispatchEvent(new Event("change", { bubbles: true }));
  if (typeof select.loadOptions === "function") select.loadOptions();
  await delay(50);

  const actual = [...select.selectedOptions].map((option) => normalize(option.label || option.textContent));
  const expected = labels.map(normalize);
  if (actual.length !== expected.length || expected.some((label) => !actual.includes(label))) {
    throw new Error(`${selector}: VAHAN widget did not apply the requested selection.`);
  }
}

async function clearSelect(selector) {
  const select = document.querySelector(selector);
  if (!select) return;
  if (![...select.options].some((option) => option.selected)) return;
  for (const option of select.options) option.selected = false;
  select.dispatchEvent(new Event("change", { bubbles: true }));
  if (typeof select.loadOptions === "function") select.loadOptions();
  await delay(50);
}

async function loadMakerOptions(rawValue) {
  const makers = splitValues(rawValue);
  const select = document.querySelector("#vehicleMaker");
  if (!makers.length || !select) return;
  for (const maker of makers) {
    if ([...select.options].some((option) => normalize(option.label || option.textContent) === normalize(maker))) continue;
    const values = await fetchMakers(maker);
    for (const value of values) {
      if (![...select.options].some((option) => option.value === value)) select.add(new Option(value, value));
    }
  }
  if (typeof select.loadOptions === "function") select.loadOptions();
}

function readOptions(selectors) {
  return Object.fromEntries(Object.entries(selectors).map(([id, definition]) => {
    const select = document.querySelector(definition.selector);
    const labels = select
      ? [...select.options].map((option) => (option.label || option.textContent || "").replace(/\s+/g, " ").trim()).filter(Boolean)
      : [];
    return [id, labels];
  }));
}

async function fetchRtos(stateLabels) {
  const labels = splitValues(stateLabels);
  if (labels.length !== 1) return [];
  const state = [...document.querySelectorAll("#stateName option")]
    .find((option) => normalize(option.label || option.textContent) === normalize(labels[0]));
  if (!state) return [];
  const url = new URL("/analytics/json_rtos", location.origin);
  url.searchParams.set("stateCode", state.value);
  const response = await fetch(url, { credentials: "same-origin" });
  if (!response.ok) throw new Error(`Could not load RTO options (${response.status}).`);
  return (await response.json()).map((rto) => rto.rtoName);
}

async function fetchMakers(search) {
  const url = new URL("/analytics/vahanpublicreport/lazy/vehicle-makers", location.origin);
  url.search = new URLSearchParams({ page: "0", size: "20", search }).toString();
  const response = await fetch(url, { credentials: "same-origin" });
  if (!response.ok) throw new Error(`Could not search Maker options (${response.status}).`);
  const payload = await response.json();
  const rows = Array.isArray(payload)
    ? payload
    : payload.content || payload.results || payload.data || payload.items || [];
  return rows.map((item) => typeof item === "string"
    ? item
    : item.label || item.name || item.value || item.makerName,
  ).filter(Boolean);
}

async function getXAxisOptions(yAxisLabel) {
  if (!yAxisLabel) return [];
  return refreshXAxisOptions(yAxisLabel);
}

async function getStateOptions(delhiNcrLabel) {
  await selectLabels("#delhiNcr", delhiNcrLabel);
  await delay(150);
  const state = document.querySelector("#stateName");
  return state
    ? [...state.options]
        .map((option) => (option.label || option.textContent || "").replace(/\s+/g, " ").trim())
        .filter(Boolean)
    : [];
}

function fill(selector, value) {
  if (!value) return;
  const input = document.querySelector(selector);
  if (!input) throw new Error(`Could not find ${selector}.`);
  input.value = value;
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

async function fillVahan(config) {
  const has = (key) => Object.prototype.hasOwnProperty.call(config, key);

  // These controls are independent. Dispatch their change events together so
  // each widget's settling delay overlaps instead of serializing the fields.
  await Promise.all([
    ...(has("archivedFlags") ? [selectLabels("#archivedFlags", config.archivedFlags)] : []),
    ...(has("period") ? [selectLabels("#reportType", config.period)] : []),
  ]);
  await delay(300);
  await Promise.all([
    ...(has("financialYears") ? [selectLabels("#financialYearSelect", config.financialYears)] : []),
    ...(has("reportYear") ? [selectLabels("#reportYear", config.reportYear)] : []),
    ...(has("reportMonth") ? [selectLabels("#reportMonth", config.reportMonth)] : []),
  ]);
  if (has("fromYear")) fill("#fromYear", config.fromYear);
  if (has("toYear")) fill("#toYear", config.toYear);
  if (has("fromDate")) fill("#fromDate", config.fromDate);
  if (has("toDate")) fill("#toDate", config.toDate);

  // VAHAN rebuilds the State options whenever Delhi NCR changes. Apply this
  // first so the State selection below is not cleared by the page script.
  if (has("delhiNcr")) {
    await selectLabels("#delhiNcr", config.delhiNcr);
    await delay(100);
  }
  const geographyTask = (async () => {
    if (has("states")) {
      const states = splitValues(config.states);
      if (states.length) await waitForOptions("#stateName", states, 5_000);
      await selectLabels("#stateName", config.states);
    }
    if (has("rtos") && splitValues(config.rtos).length) {
      await waitForOptions("#rtoCode", splitValues(config.rtos));
      await selectLabels("#rtoCode", config.rtos);
    }
  })();
  const optionalSelects = {
    categoryGroups: "#vehicleCategoryGroup", subCategories: "#vehicleSubCategory",
    classes: "#vehicleClass", fuels: "#vehicleFuel", evTypes: "#evType",
    statuses: "#vehicleStatus", ownerTypes: "#vehicleOwnerType",
    vehicleType: "#vehicleType", fitness: "#fitnessCheck",
  };
  // Clear fields the new scenario omits *before* setting the fields it
  // specifies. VAHAN's dropdowns are mutually dependent (e.g. a stale
  // #evType selection restricts #vehicleFuel's option list), so a value left
  // over from the previous scenario can make an otherwise-valid label in
  // this scenario appear "not found".
  const dependentOptionalKeys = new Set([
    "categoryGroups", "subCategories", "classes", "fuels", "evTypes", "vehicleType",
  ]);
  await Promise.all(Object.entries(optionalSelects)
    .filter(([key]) => !has(key) && !dependentOptionalKeys.has(key))
    .map(([, selector]) => clearSelect(selector)));
  for (const key of dependentOptionalKeys) {
    if (!has(key)) await clearSelect(optionalSelects[key]);
  }

  const independentVehicleTasks = [];
  if (has("emissions")) independentVehicleTasks.push(selectLabels("#vehicleEmission", config.emissions));
  if (has("makers")) {
    independentVehicleTasks.push((async () => {
      await loadMakerOptions(config.makers);
      await selectLabels("#vehicleMaker", config.makers);
    })());
  }
  for (const key of ["statuses", "ownerTypes", "fitness"]) {
    const selector = optionalSelects[key];
    if (has(key)) independentVehicleTasks.push(selectLabels(selector, config[key]));
  }

  const dependentVehicleTask = (async () => {
    // These filters rebuild one another's option lists, so keep this chain in
    // order and wait for each requested option to appear.
    if (has("categoryGroups")) await selectLabels(optionalSelects.categoryGroups, config.categoryGroups);
    if (has("subCategories")) {
      if (splitValues(config.subCategories).length) {
        await waitForOptions(optionalSelects.subCategories, splitValues(config.subCategories));
      }
      await selectLabels(optionalSelects.subCategories, config.subCategories);
    }
    if (has("classes")) {
      if (splitValues(config.classes).length) {
        await waitForOptions(optionalSelects.classes, splitValues(config.classes));
      }
      await selectLabels(optionalSelects.classes, config.classes);
    }
    // The EV selection can constrain Fuel, so preserve that dependency order.
    if (has("evTypes")) await selectLabels(optionalSelects.evTypes, config.evTypes);
    if (has("fuels")) {
      if (splitValues(config.fuels).length) {
        await waitForOptions(optionalSelects.fuels, splitValues(config.fuels));
      }
      await selectLabels(optionalSelects.fuels, config.fuels);
    }
  })();

  const axisTask = (async () => {
    if (has("yAxis")) {
      await selectLabels("#yAxis", config.yAxis);
      await refreshXAxisOptions(splitValues(config.yAxis)[0], { resetSelection: true });
    }
    if (has("xAxis") && splitValues(config.xAxis).length) {
      const yAxis = document.querySelector("#yAxis");
      const selectedYAxis = yAxis && [...yAxis.options].find((option) => option.value === yAxis.value);
      const yAxisLabel = splitValues(config.yAxis)[0]
        || selectedYAxis?.label
        || selectedYAxis?.textContent?.trim();
      await waitForXAxisOptions(yAxisLabel || "(current selection)", splitValues(config.xAxis));
      await selectLabels("#xAxis", config.xAxis);
    }
  })();

  // Run independent controls and the separate axis chain together. The
  // category/subcategory/class and EV/fuel chains remain ordered by dependency.
  await Promise.all([geographyTask, ...independentVehicleTasks, dependentVehicleTask, axisTask]);
  if (has("vehicleType")) await selectLabels(optionalSelects.vehicleType, config.vehicleType);
  if (has("autoApply")) configureAutoApply(config.autoApply);
}

async function captureCaptcha(timeout = 15000) {
  const deadline = Date.now() + timeout;
  let image;
  while (Date.now() < deadline) {
    image = document.querySelector("#captchaImage");
    if (image?.complete && image.naturalWidth > 0 && image.naturalHeight > 0) break;
    await delay(200);
  }
  if (!image?.complete || !image.naturalWidth || !image.naturalHeight) {
    throw new Error("CAPTCHA image did not load within the allowed time.");
  }

  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not create a canvas for the CAPTCHA image.");
  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  const sourceUrl = image.currentSrc || image.src || image.getAttribute("src");
  if (!sourceUrl) throw new Error("The CAPTCHA image has no identifier.");
  const imageDataUrl = canvas.toDataURL("image/png");
  let hash = 2166136261;
  for (let index = 0; index < imageDataUrl.length; index += 1) {
    hash ^= imageDataUrl.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return {
    captchaId: `${sourceUrl}#${(hash >>> 0).toString(16)}`,
    imageDataUrl,
  };
}

let isRefreshingCaptcha = false;

async function refreshCaptcha(previousCaptchaId, timeout = 15000) {
  const refreshButton = document.querySelector("#captchaImg");
  if (!refreshButton || !isVisible(refreshButton)) {
    throw new Error("Could not find the official VAHAN CAPTCHA refresh button.");
  }

  // The official page owns CAPTCHA generation through #captchaImg. Do not
  // synthesize an image URL: clicking this control keeps the request in the
  // user's authenticated VAHAN session and clears the old CAPTCHA value.
  isRefreshingCaptcha = true;
  try {
    refreshButton.click();

    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      try {
        const captcha = await captureCaptcha(1_000);
        if (!previousCaptchaId || captcha.captchaId !== previousCaptchaId) return captcha;
      } catch (_error) {
        // The image is briefly unavailable while the official page replaces it.
      }
      await delay(150);
    }
    throw new Error("VAHAN did not provide a new CAPTCHA image in time.");
  } finally {
    // Settle window so DOM load and mutation observer events from this refresh don't re-trigger.
    setTimeout(() => {
      isRefreshingCaptcha = false;
    }, 500);
  }
}

let captchaRefreshTimer;
async function notifyCaptchaRefresh() {
  clearTimeout(captchaRefreshTimer);
  captchaRefreshTimer = setTimeout(async () => {
    try {
      if (isRefreshingCaptcha) return;
      const { activeServerJob } = await chrome.storage.local.get("activeServerJob");
      if (!activeServerJob || activeServerJob.stage !== "WAITING_CAPTCHA") return;
      // Passively capture the new CAPTCHA image if it changed out-of-band on VAHAN;
      // never trigger an active refresh click from this observer.
      const captcha = await captureCaptcha();
      if (captcha.captchaId === activeServerJob.captchaId) return;
      await chrome.runtime.sendMessage({ type: "SERVER_CAPTCHA_CHANGED", captcha });
    } catch (_error) {
      // A transient image load is expected while VAHAN swaps CAPTCHA pixels.
    }
  }, 150);
}

function observeCaptchaChanges() {
  document.addEventListener("load", (event) => {
    if (event.target?.id === "captchaImage") notifyCaptchaRefresh();
  }, true);
  const observer = new MutationObserver((mutations) => {
    if (mutations.some((mutation) =>
      mutation.target?.id === "captchaImage" ||
      [...mutation.addedNodes].some((node) => node.nodeType === Node.ELEMENT_NODE && (
        node.id === "captchaImage" || node.querySelector?.("#captchaImage")
      )),
    )) notifyCaptchaRefresh();
  });
  observer.observe(document.documentElement, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ["src"],
  });
}

function submitRemoteCaptcha(value, autoApply) {
  autoApply = true;
  const input = document.querySelector("#externalCaptcha");
  if (!input) throw new Error("Could not find the CAPTCHA input on VAHAN.");
  input.focus();
  input.value = value;
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
  updateFloatingStep("captcha", "done");

  if (!autoApply) {
    setFloatingStatus("waiting", "CAPTCHA entered. Review it and click Apply on VAHAN.");
    return { applied: false };
  }

  // configureAutoApply owns the delayed click and prevents duplicate submits.
  configureAutoApply(true);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  return { applied: true };
}

let autoApplyCleanup;
let applyResultWatcherButton;

// Apply can update VAHAN with AJAX instead of doing a full navigation. Keep a
// listener on the real button so server jobs are also watched in that case.
function watchApplyButton(button) {
  if (!button || applyResultWatcherButton === button) return;
  applyResultWatcherButton = button;
  button.addEventListener("click", () => {
    queueMicrotask(() => {
      startServerResultWatcher().catch((error) => {
        chrome.runtime.sendMessage({
          type: "SERVER_JOB_PAGE_RESULT",
          result: "FAILED",
          error: error.message,
        }).catch(() => {});
      });
    });
  }, true);
}

function configureAutoApply(enabled) {
  enabled = true;
  autoApplyCleanup?.();
  autoApplyCleanup = undefined;

  const applyLabel = floatingWidget?.shadowRoot?.querySelector('[data-role="apply-label"]');
  if (applyLabel) {
    applyLabel.textContent = enabled ? "5. Auto-click Apply" : "5. Click Apply on VAHAN";
  }

  const captcha = document.querySelector("#externalCaptcha");
  const applyButton = document.querySelector("#applyTrigger");
  watchApplyButton(applyButton);
  if (!enabled || !captcha || !applyButton) return;

  let timer;
  let submitted = false;
  const cleanup = () => {
    clearTimeout(timer);
    captcha.removeEventListener("input", onInput);
  };
  const submit = () => {
    if (submitted || captcha.value.trim().length < 6) return;
    submitted = true;
    cleanup();
    updateFloatingStep("captcha", "done");
    updateFloatingStep("apply", "running");
    setFloatingStatus("running", "CAPTCHA complete. Clicking Apply...");
    applyButton.scrollIntoView({ behavior: "smooth", block: "center" });
    applyButton.click();
  };
  const onInput = () => {
    clearTimeout(timer);
    const length = captcha.value.trim().length;
    if (length >= 6) timer = setTimeout(submit, 150);
    else if (length === 5) setFloatingStatus("waiting", "5 of 6 CAPTCHA characters entered. Enter the final character shown in the image.");
  };

  captcha.addEventListener("input", onInput);
  autoApplyCleanup = cleanup;
  onInput();
}

async function initializeAutoApplyPreference() {
  const { vahanConfig } = await chrome.storage.local.get("vahanConfig");
  configureAutoApply(vahanConfig?.autoApply);
}

let exportClicked = false;
let exportWatcherTimer;
let exportWatcherTimeout;
async function startAutoExportWatcher() {
  const { vahanConfig, activeServerJob } = await chrome.storage.local.get(["vahanConfig", "activeServerJob"]);
  clearInterval(exportWatcherTimer);
  clearTimeout(exportWatcherTimeout);
  exportWatcherTimer = undefined;
  exportWatcherTimeout = undefined;
  if (activeServerJob || !(vahanConfig?.autoExport ?? true) || exportClicked) return;
  exportWatcherTimer = setInterval(() => {
    const button = document.querySelector("#downloadBtn1");
    if (!exportClicked && button && button.getClientRects().length) {
      exportClicked = true;
      clearInterval(exportWatcherTimer);
      updateFloatingStep("captcha", "done");
      updateFloatingStep("apply", "done");
      updateFloatingStep("export", "done");
      setFloatingStatus("success", "Results found. Downloading the Excel file.");
      button.click();
    }
  }, 500);
  exportWatcherTimeout = setTimeout(() => clearInterval(exportWatcherTimer), 120000);
}

// Floating controller shown directly on the VAHAN page. A shadow root keeps
// the extension UI isolated from the website's Bootstrap/theme styles.
let floatingWidget;

function updateFloatingStep(name, state) {
  const row = floatingWidget?.shadowRoot?.querySelector(`[data-step="${name}"]`);
  if (!row) return;
  const icons = { idle: "○", running: "◌", done: "✓", waiting: "→", error: "×" };
  row.dataset.state = state;
  row.querySelector(".step-icon").textContent = icons[state] || icons.idle;
}

function setFloatingStatus(state, message) {
  const root = floatingWidget?.shadowRoot;
  if (!root) return;
  const badge = root.querySelector(".badge");
  const status = root.querySelector(".status");
  const labels = {
    ready: "Ready",
    running: "Processing...",
    waiting: "Waiting for CAPTCHA",
    success: "Success",
    error: "An error occurred",
  };
  badge.dataset.state = state;
  badge.textContent = labels[state] || labels.ready;
  status.textContent = message;
}

function resetFloatingSteps() {
  for (const name of ["time", "vehicle", "axes", "captcha", "apply", "export"]) {
    updateFloatingStep(name, "idle");
  }
}

// VAHAN trả các thông báo này trong DOM sau khi xử lý form. Không được tìm
// chuỗi trên toàn bộ body: DOM có thể giữ thông báo cũ/ẩn trong template.
// Chỉ nhận diện một node đang hiển thị, có nội dung ngắn và thực sự chứa thông báo.
const NO_RECORD_TEXT = /\bno\s+record\s+found\b/i;
const INVALID_CAPTCHA_TEXT = /\binvalid\s+captcha\b/i;
const NO_RECORD_CONFIRMATION_MS = 5_000;
const compactText = (value) => String(value || "").replace(/\s+/g, " ").trim();
const isVisible = (element) => {
  if (!element || element.getClientRects().length === 0) return false;
  if (element.getAttribute?.("aria-hidden") === "true") return false;
  if (element.closest?.('[aria-hidden="true"]')) return false;
  const style = window.getComputedStyle(element);
  return style.display !== "none"
    && style.visibility !== "hidden"
    && style.opacity !== "0";
};
const hasVisiblePageMessage = (pattern) => [...document.querySelectorAll("body *")]
  .filter(isVisible)
  .some((element) => {
    const text = compactText(element.textContent);
    if (!pattern.test(text) || text.length > 240) return false;
    // If a parent contains the same message through a child, let the leaf
    // node decide. This avoids matching the whole result page/container.
    return ![...element.children].some((child) =>
      isVisible(child) && pattern.test(compactText(child.textContent)));
  });
const hasInvalidCaptchaMessage = () => hasVisiblePageMessage(INVALID_CAPTCHA_TEXT);
const hasVisibleNoRecordMessage = () => hasVisiblePageMessage(NO_RECORD_TEXT);
const mutationCanChangeResult = (mutation) => {
  const nodes = [mutation.target, ...mutation.addedNodes, ...mutation.removedNodes];
  return nodes.some((node) => {
    if (node.nodeType === 3) {
      const text = compactText(node.textContent);
      return NO_RECORD_TEXT.test(text) || INVALID_CAPTCHA_TEXT.test(text);
    }
    if (node.nodeType !== 1) return false;
    if (node.id === "downloadBtn1" || node.querySelector?.("#downloadBtn1")) return true;
    const text = compactText(node.textContent);
    return text.length <= 240 && (NO_RECORD_TEXT.test(text) || INVALID_CAPTCHA_TEXT.test(text));
  });
};

let resultWatcherJobId;
async function startServerResultWatcher() {
  const { activeServerJob } = await chrome.storage.local.get("activeServerJob");
  if (!activeServerJob || activeServerJob.stage !== "WAITING_RESULT") return;
  if (resultWatcherJobId === activeServerJob.jobId) return;

  resultWatcherJobId = activeServerJob.jobId;
  try {
    await resumeServerJobAfterApply(activeServerJob);
  } finally {
    if (resultWatcherJobId === activeServerJob.jobId) resultWatcherJobId = undefined;
  }
}

function waitForVahanResult(timeoutMs = 90_000) {
  return new Promise((resolve) => {
    let settled = false;
    let checkQueued = false;
    let noRecordTimer;
    let timeoutTimer;
    let observer;

    const finish = (result) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(noRecordTimer);
      window.clearTimeout(timeoutTimer);
      observer?.disconnect();
      chrome.storage.onChanged?.removeListener(onStorageChanged);
      resolve(result);
    };

    const checkDom = () => {
      if (settled) return;
      if (hasInvalidCaptchaMessage()) {
        finish({ type: "INVALID_CAPTCHA" });
        return;
      }
      if (isVisible(document.querySelector("#downloadBtn1"))) {
        finish({ type: "DOWNLOAD_READY" });
        return;
      }
      if (hasVisibleNoRecordMessage()) {
        if (noRecordTimer === undefined) {
          // Give VAHAN a short window to reveal a report button. That button
          // remains authoritative and wins even while this timer is pending.
          noRecordTimer = window.setTimeout(() => {
            noRecordTimer = undefined;
            if (isVisible(document.querySelector("#downloadBtn1"))) {
              finish({ type: "DOWNLOAD_READY" });
            } else if (hasVisibleNoRecordMessage()) {
              finish({ type: "NO_RECORD" });
            } else {
              queueCheck();
            }
          }, NO_RECORD_CONFIRMATION_MS);
        }
        return;
      }
      window.clearTimeout(noRecordTimer);
      noRecordTimer = undefined;
    };

    const queueCheck = () => {
      if (settled || checkQueued) return;
      checkQueued = true;
      queueMicrotask(() => {
        checkQueued = false;
        checkDom();
      });
    };

    const checkAuthHold = () => {
      getActiveVahanAuthHold().then((hold) => {
        if (hold) finish({ type: "AUTH_REQUIRED", hold });
      }).catch(() => {});
    };

    const onStorageChanged = (changes, areaName) => {
      if (areaName === "local" && changes[VAHAN_AUTH_HOLD_KEY]) checkAuthHold();
    };

    observer = new MutationObserver((mutations) => {
      if (mutations.some(mutationCanChangeResult)) queueCheck();
    });
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["class", "style", "hidden", "aria-hidden"],
    });
    chrome.storage.onChanged?.addListener(onStorageChanged);
    timeoutTimer = window.setTimeout(() => finish({ type: "TIMEOUT" }), timeoutMs);
    checkAuthHold();
    checkDom();
  });
}

async function resumeServerJobAfterApply(activeServerJob) {

  updateFloatingStep("captcha", "done");
  updateFloatingStep("apply", "done");
  updateFloatingStep("export", "running");
  setFloatingStatus("running", "Checking for VAHAN results...");

  const outcome = await waitForVahanResult();
  if (outcome.type === "AUTH_REQUIRED") {
    updateFloatingStep("export", "error");
    setFloatingStatus("error", authHoldStatusMessage(outcome.hold));
    await chrome.runtime.sendMessage({ type: "SERVER_JOB_PAGE_RESULT", result: "AUTH_REQUIRED" });
    return;
  }

  if (outcome.type === "INVALID_CAPTCHA") {
    updateFloatingStep("captcha", "error");
    updateFloatingStep("export", "idle");
    setFloatingStatus("waiting", "Incorrect CAPTCHA. Sending the new image to the Web UI...");
    const captcha = await captureCaptcha();
    await chrome.runtime.sendMessage({
      type: "SERVER_JOB_PAGE_RESULT",
      result: "INVALID_CAPTCHA",
      captcha,
    });
    return;
  }

  if (outcome.type === "DOWNLOAD_READY") {
    // Every server batch case requires a stored Excel file. The page's
    // autoExport preference only applies to standalone/manual use.
    setFloatingStatus("running", "Report ready. Downloading and verifying the Excel file...");
    await chrome.runtime.sendMessage({ type: "SERVER_JOB_PAGE_RESULT", result: "DOWNLOAD_READY" });
    updateFloatingStep("export", "done");
    return;
  }

  if (outcome.type === "NO_RECORD") {
    updateFloatingStep("export", "idle");
    setFloatingStatus("success", "VAHAN returned no data for these filters (no record found).");
    await chrome.runtime.sendMessage({ type: "SERVER_JOB_PAGE_RESULT", result: "NO_RECORD" });
    return;
  }

  updateFloatingStep("export", "error");
  setFloatingStatus("error", "Timed out while waiting for VAHAN results.");
  await chrome.runtime.sendMessage({
    type: "SERVER_JOB_PAGE_RESULT",
    result: "FAILED",
    error: "Timed out waiting for the VAHAN result after 90 seconds.",
  });
}

function renderFloatingRunnerConnection(connection = {}) {
  const element = floatingWidget?.shadowRoot?.querySelector(".backend-connection");
  if (!element) return;
  const labels = {
    connected: "Backend connected",
    connecting: "Connecting to backend...",
    disconnected: "Backend disconnected",
    error: "Could not connect to backend",
  };
  element.dataset.state = connection.status || "disconnected";
  element.querySelector("span:last-child").textContent =
    labels[connection.status] || labels.disconnected;
  element.title = connection.detail || "";
}

async function runFromFloatingWidget() {
  const root = floatingWidget.shadowRoot;
  const button = root.querySelector(".start");
  button.disabled = true;
  resetFloatingSteps();
  setFloatingStatus("running", "Loading saved configuration...");
  updateFloatingStep("time", "running");

  try {
    const authHold = await getActiveVahanAuthHold();
    if (authHold) throw new Error(authHoldStatusMessage(authHold));
    const { vahanConfig } = await chrome.storage.local.get("vahanConfig");
    if (!vahanConfig) {
      throw new Error("No configuration found. Open the extension popup and choose filters first.");
    }

    await fillVahan(vahanConfig);
    updateFloatingStep("time", "done");
    updateFloatingStep("vehicle", "done");
    updateFloatingStep("axes", "done");
    updateFloatingStep("captcha", "waiting");
    setFloatingStatus(
      "waiting",
      vahanConfig.autoApply
        ? "Filters filled. Apply will run automatically after you enter the CAPTCHA."
        : "Filters filled. Enter the CAPTCHA and click Apply on VAHAN.",
    );
    button.textContent = "↻ Refill filters";
  } catch (error) {
    updateFloatingStep("time", "error");
    setFloatingStatus("error", error.message);
    button.textContent = "↻ Try again";
  } finally {
    button.disabled = false;
  }
}

function injectFloatingWidget() {
  if (document.getElementById("vahan-rpa-floating-root")) return;

  floatingWidget = document.createElement("div");
  floatingWidget.id = "vahan-rpa-floating-root";
  const root = floatingWidget.attachShadow({ mode: "open" });
  root.innerHTML = `
    <style>
      :host { all: initial; }
      .card {
        position: fixed; right: 16px; bottom: 16px; z-index: 2147483647;
        width: min(340px, calc(100vw - 24px)); overflow: hidden; border: 1px solid #e2e6ec;
        border-radius: 16px; background: #fff; color: #172033;
        box-shadow: 0 8px 24px rgba(15,23,42,.14);
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      }
      .header {
        display: flex; align-items: center; gap: 8px;
        padding: 11px 14px; border-bottom: 1px solid #eef0f3; color: #172033;
        background: #fff;
      }
      .title { font-size: 13px; font-weight: 600; }
      .toggle {
        width: 28px; height: 28px; margin-left: auto; padding: 0; border: 0; border-radius: 50%;
        background: #f2f4f7; color: #475467; font-size: 16px;
        line-height: 1; cursor: pointer;
      }
      .toggle:hover { background: #e8ecf2; }
      .body { padding: 12px 14px 14px; }
      .body[hidden] { display: none; }
      .backend-connection {
        display: flex; align-items: center; gap: 8px; margin: 0 0 10px;
        color: #596579; font-size: 11px;
      }
      .backend-dot {
        width: 8px; height: 8px; flex: 0 0 auto; border-radius: 50%;
        background: #bf8700; box-shadow: 0 0 0 3px rgba(191,135,0,.12);
      }
      .backend-connection[data-state="connected"] .backend-dot {
        background: #2ea44f; box-shadow: 0 0 0 3px rgba(46,164,79,.14);
      }
      .backend-connection[data-state="disconnected"] .backend-dot,
      .backend-connection[data-state="error"] .backend-dot {
        background: #cb2431; box-shadow: 0 0 0 3px rgba(203,36,49,.12);
      }
      .badge {
        display: inline-block; margin-left: auto; padding: 5px 9px;
        border: 1px solid #e4e8ee; border-radius: 999px;
        background: #f7f8fa; color: #475467; font-size: 10px; font-weight: 600;
      }
      .badge[data-state="running"], .badge[data-state="waiting"] {
        border-color: #f4dda6; background: #fff8e8; color: #946200;
      }
      .badge[data-state="success"] { border-color: #c9e9d5; background: #eef8f1; color: #137a37; }
      .badge[data-state="error"] { border-color: #f1c6c6; background: #fff2f2; color: #b42318; }
      .steps { display: flex; flex-direction: column; gap: 7px; margin-bottom: 12px; font-size: 11px; }
      .step { display: flex; align-items: center; gap: 8px; color: #667085; line-height: 1.4; }
      .step-icon { width: 14px; color: #98a2b3; font-size: 14px; font-weight: 600; text-align: center; }
      .step[data-state="running"] { color: #175cd3; font-weight: 600; }
      .step[data-state="waiting"] { color: #946200; font-weight: 600; }
      .step[data-state="done"] { color: #137a37; }
      .step[data-state="error"] { color: #b42318; font-weight: 600; }
      .start {
        width: 100%; min-height: 38px; padding: 9px 14px; border: 0; border-radius: 999px;
        background: #2165d5; color: #fff; font-size: 12px; font-weight: 600;
        cursor: pointer; box-shadow: 0 1px 3px rgba(0,0,0,.1);
      }
      .start:hover { background: #174ea6; }
      .start:disabled { opacity: .6; cursor: wait; }
      .preferences {
        display: block; margin: 0 0 10px;
        padding: 10px 11px; border: 1px solid #e7eaf0; border-radius: 12px;
        background: #fafbfc;
      }
      .preferences summary { color: #475467; font-size: 11px; font-weight: 600; cursor: pointer; }
      .preferences[open] summary { margin-bottom: 8px; padding-bottom: 7px; border-bottom: 1px solid #e7eaf0; }
      .preference {
        display: flex; align-items: center; gap: 8px; margin-top: 7px; color: #475467;
        font-size: 11px; line-height: 1.4; cursor: pointer;
      }
      .preference input { width: 14px; height: 14px; margin: 0; accent-color: #2165d5; }
      .open-popup {
        width: 100%; min-height: 36px; margin-top: 8px; padding: 8px 12px; border: 1px solid #d7dce4;
        border-radius: 999px; background: #fff; color: #344054; font-size: 11px;
        font-weight: 600; cursor: pointer;
      }
      .open-popup:hover { background: #f7f8fa; border-color: #bfc7d2; }
      .status { min-height: 18px; margin-top: 8px; color: #667085; font-size: 11px; line-height: 1.45; }
    </style>
    <section class="card" aria-label="VAHAN extension">
      <header class="header">
        <div class="title">Extension VAHAN</div>
        <div class="badge" data-state="ready">Ready</div>
        <button class="toggle" type="button" aria-label="Collapse widget" aria-expanded="true">−</button>
      </header>
      <div class="body">
        <div class="backend-connection" data-state="connecting"><span class="backend-dot"></span><span>Connecting to backend...</span></div>
        <div class="steps">
          <div class="step" data-step="time" data-state="idle"><span class="step-icon">○</span><span>Time and region</span></div>
          <div class="step" data-step="vehicle" data-state="idle"><span class="step-icon">○</span><span>Vehicle filters</span></div>
          <div class="step" data-step="axes" data-state="idle"><span class="step-icon">○</span><span>Report axes</span></div>
          <div class="step" data-step="captcha" data-state="idle"><span class="step-icon">○</span><span>Enter CAPTCHA on VAHAN</span></div>
          <div class="step" data-step="apply" data-state="idle"><span class="step-icon">○</span><span data-role="apply-label">Apply</span></div>
          <div class="step" data-step="export" data-state="idle"><span class="step-icon">○</span><span>Download Excel</span></div>
        </div>
        <button class="start" type="button">Fill filters</button>
        <details class="preferences">
          <summary>Cài đặt nhanh</summary>
          <label class="preference"><input data-setting="autoExport" type="checkbox"><span>Tự động tải Excel khi có kết quả</span></label>
        </details>
        <button class="open-popup" type="button">Cài đặt kết nối</button>
        <div class="status" role="status">Ready.</div>
      </div>
    </section>`;

  document.body.appendChild(floatingWidget);
  const body = root.querySelector(".body");
  const toggle = root.querySelector(".toggle");
  toggle.addEventListener("click", () => {
    const expanded = toggle.getAttribute("aria-expanded") === "true";
    body.hidden = expanded;
    toggle.textContent = expanded ? "+" : "−";
    toggle.setAttribute("aria-expanded", String(!expanded));
    toggle.setAttribute("aria-label", expanded ? "Expand widget" : "Collapse widget");
  });
  root.querySelector(".start").addEventListener("click", runFromFloatingWidget);
  for (const checkbox of root.querySelectorAll("[data-setting]")) {
    checkbox.addEventListener("change", async () => {
      const { vahanConfig = {} } = await chrome.storage.local.get("vahanConfig");
      vahanConfig[checkbox.dataset.setting] = checkbox.checked;
      await chrome.storage.local.set({ vahanConfig });
    });
  }
  root.querySelector(".open-popup").addEventListener("click", async () => {
    try {
      const response = await chrome.runtime.sendMessage({ type: "OPEN_ACTION_POPUP" });
      if (!response?.ok) throw new Error(response?.error || "Chrome could not open the popup.");
    } catch (error) {
      setFloatingStatus("error", `Could not open settings: ${error.message}`);
    }
  });
  chrome.storage.local.get(["vahanConfig", "runnerConnection"]).then(({ vahanConfig, runnerConnection }) => {
    renderFloatingRunnerConnection(runnerConnection);
    root.querySelector('[data-setting="autoExport"]').checked = vahanConfig?.autoExport ?? true;
    root.querySelector('[data-role="apply-label"]').textContent = "Auto-click Apply";
  });
}

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "local") return;
  if (changes.activeServerJob?.newValue) {
    clearInterval(exportWatcherTimer);
    clearTimeout(exportWatcherTimeout);
    exportWatcherTimer = undefined;
    exportWatcherTimeout = undefined;
  }
  if (changes.runnerConnection) {
    renderFloatingRunnerConnection(changes.runnerConnection.newValue);
  }
  if (!changes.vahanConfig) return;
  const previous = changes.vahanConfig.oldValue || {};
  const current = changes.vahanConfig.newValue || {};
  const autoApply = current.autoApply ?? false;
  const autoExport = current.autoExport ?? true;
  const root = floatingWidget?.shadowRoot;

  if (root) {
    root.querySelector('[data-setting="autoExport"]').checked = autoExport;
  }
  if ((previous.autoApply ?? false) !== autoApply) configureAutoApply(autoApply);
  if ((previous.autoExport ?? true) !== autoExport) startAutoExportWatcher();
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  let operation;
  if (message?.type === "FILL_VAHAN") operation = fillVahan(message.config).then(() => ({ ok: true }));
  else if (message?.type === "CAPTURE_CAPTCHA") operation = captureCaptcha().then((captcha) => ({ ok: true, ...captcha }));
  else if (message?.type === "REFRESH_CAPTCHA") {
    operation = refreshCaptcha(message.previousCaptchaId).then((captcha) => ({ ok: true, ...captcha }));
  }
  else if (message?.type === "SUBMIT_REMOTE_CAPTCHA") {
    operation = Promise.resolve({ ok: true, ...submitRemoteCaptcha(message.value, message.autoApply) });
  }
  else if (message?.type === "CLICK_EXCEL_DOWNLOAD") {
    const button = document.querySelector("#downloadBtn1");
    if (!isVisible(button)) operation = Promise.resolve({ ok: false, error: "Excel download button is not visible." });
    else { button.click(); operation = Promise.resolve({ ok: true }); }
  }
  else if (message?.type === "CAPTURE_EXCEL_DOWNLOAD") {
    operation = captureExcelDownload(message.href, message.fileName || "report.xlsx")
      .then(() => ({ ok: true }));
  }
  else if (message?.type === "GET_VAHAN_OPTIONS") operation = Promise.resolve({ ok: true, options: readOptions(message.selectors) });
  else if (message?.type === "GET_STATE_OPTIONS") operation = getStateOptions(message.delhiNcr).then((options) => ({ ok: true, options }));
  else if (message?.type === "GET_RTO_OPTIONS") operation = fetchRtos(message.stateLabels).then((options) => ({ ok: true, options }));
  else if (message?.type === "GET_X_AXIS_OPTIONS") operation = getXAxisOptions(message.yAxis).then((options) => ({ ok: true, options }));
  else if (message?.type === "SEARCH_MAKERS") operation = fetchMakers(message.search).then((options) => ({ ok: true, options }));
  else return;

  operation
    .then(sendResponse)
    .catch((error) => sendResponse({ ok: false, error: error.message }));
  return true;
});

// All extension controls now live in the toolbar popup. Do not inject a
// floating card into the official VAHAN page: it can obscure the result table
// and duplicates the Web UI workflow.
initializeAutoApplyPreference();
startAutoExportWatcher();
observeCaptchaChanges();
startServerResultWatcher().catch((error) => {
  chrome.runtime.sendMessage({
    type: "SERVER_JOB_PAGE_RESULT",
    result: "FAILED",
    error: error.message,
  }).catch(() => {});
});
