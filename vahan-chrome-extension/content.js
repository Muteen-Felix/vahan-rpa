const splitValues = (value) => String(value || "").split(",").map((item) => item.trim()).filter(Boolean);
const normalize = (value) => String(value || "").replace(/\s+/g, " ").trim().toLocaleLowerCase();
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const {
  UiDriftError,
  assertUiContract,
  formatUiDrift,
  getDropdownContainer,
  isUiDriftError,
  requireOne,
  waitForUiContract,
} = globalThis.VahanUiDrift;

const PAGE_CONTROLS = {
  archivedFlags: "#archivedFlags",
  reportType: "#reportType",
  financialYearSelect: "#financialYearSelect",
  reportYear: "#reportYear",
  reportMonth: "#reportMonth",
  fromYear: "#fromYear",
  toYear: "#toYear",
  fromDate: "#fromDate",
  toDate: "#toDate",
  delhiNcr: "#delhiNcr",
  stateName: "#stateName",
  rtoCode: "#rtoCode",
  vehicleEmission: "#vehicleEmission",
  vehicleMaker: "#vehicleMaker",
  vehicleSubCategory: "#vehicleSubCategory",
  vehicleClass: "#vehicleClass",
  evType: "#evType",
  vehicleStatus: "#vehicleStatus",
  vehicleOwnerType: "#vehicleOwnerType",
  vehicleType: "#vehicleType",
  fitnessCheck: "#fitnessCheck",
  yAxisHidden: "#yAxis_hidden",
  xAxisHidden: "#xAxis_hidden",
};

const MULTISELECT_NAMES = [
  "category",
  "fuel",
  "archivedFlags",
  "financialYearSelect",
  "stateName",
  "rtoCode",
  "vehicleEmission",
  "vehicleMaker",
  "vehicleSubCategory",
  "vehicleClass",
  "evType",
  "vehicleStatus",
  "vehicleOwnerType",
];

let pageUiContract = null;
let lastUiDriftError = null;
let uiDriftDetected = false;
const FLOW_STATE_KEY = "vahanUiFlowState";
let applyGuardCleanup;

async function getFlowState() {
  const data = await chrome.storage.local.get(FLOW_STATE_KEY);
  return data[FLOW_STATE_KEY] || null;
}

async function setFlowState(state) {
  if (state === null) {
    await chrome.storage.local.remove(FLOW_STATE_KEY);
  } else {
    await chrome.storage.local.set({ [FLOW_STATE_KEY]: state });
  }
}

function hasInvalidCaptchaMessage() {
  const bodyText = document.body?.innerText || "";
  return bodyText.includes("Invalid CAPTCHA") || bodyText.includes("invalid captcha");
}

function watchForInvalidCaptcha() {
  let stopped = false;
  let timeoutId;
  const observer = new MutationObserver(() => {
    if (stopped || !hasInvalidCaptchaMessage()) return;
    stop();
    void setFlowState(null).catch((error) => {
      console.error("[VAHAN RPA] Không thể xoá flow state sau CAPTCHA không hợp lệ.", error);
    });
    updateFloatingStep("captcha", "error");
    updateFloatingStep("apply", "error");
    setFloatingStatus(
      "error",
      "CAPTCHA không hợp lệ. Hãy nhập CAPTCHA mới rồi bấm Apply lại."
    );
  });

  const stop = () => {
    if (stopped) return;
    stopped = true;
    observer.disconnect();
    clearTimeout(timeoutId);
  };

  observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  timeoutId = setTimeout(stop, 30000);
  return stop;
}

function getOptionMap(select) {
  return [...select.options].map((option) => ({
    label: normalize(option.label || option.textContent),
    value: option.value,
  }));
}

async function waitForOptions(selector, labels, timeout = 15000) {
  const deadline = Date.now() + timeout;
  const expected = labels.map(normalize);
  while (Date.now() < deadline) {
    const select = document.querySelector(selector);
    if (select) {
      const available = getOptionMap(select).map((option) => option.label);
      if (expected.every((label) => available.includes(label))) return;
    }
    await delay(200);
  }
  throw new UiDriftError(
    "UI_DRIFT_DYNAMIC_CONTROL_TIMEOUT",
    `${selector}: dynamic options did not load within ${timeout} ms.`,
    "dynamic-options",
    { selector, expectedOptions: labels }
  );
}

function controlNameFromSelector(selector) {
  return String(selector).replace(/^#/, "");
}

function findWidgetRows(widget) {
  return Array.from(
    widget.querySelectorAll(
      "[data-search-text], .multiselect-dropdown-list > div:not(.multiselect-dropdown-all-selector)"
    )
  ).filter((row, index, rows) => rows.indexOf(row) === index);
}

async function selectLabels(selector, rawValue, step = "filter") {
  const labels = splitValues(rawValue);
  const controlName = controlNameFromSelector(selector);
  const select = requireOne(selector, controlName, step);
  const options = getOptionMap(select);
  if (!labels.length && !select.multiple) return;
  const values = labels.map((label) => options.find((option) => option.label === normalize(label))?.value);
  const missingLabel = labels.find((label, index) => values[index] === undefined);
  if (missingLabel !== undefined) {
    throw new UiDriftError(
      "UI_DRIFT_REQUIRED_OPTION",
      `${selector}: could not find "${missingLabel}".`,
      step,
      {
        control: controlName,
        selector,
        expectedOption: missingLabel,
        optionCount: select.options.length,
      }
    );
  }

  const widget = select.multiple ? getDropdownContainer(select.id, step) : null;

  if (select.multiple && widget) {
    const desired = new Set(labels.map(normalize));
    widget.click();
    const rows = findWidgetRows(widget);
    const rowLabels = new Set();
    for (const row of rows) {
      const label = normalize(
        row.getAttribute("data-search-text") ||
        row.querySelector("label")?.textContent ||
        row.textContent
      );
      rowLabels.add(label);
      const isSelected = row.classList.contains("checked") || row.querySelector("input")?.checked;
      const shouldSelect = desired.has(label);
      if (Boolean(isSelected) !== shouldSelect) row.click();
    }
    const missingWidgetLabel = labels.find((label) => !rowLabels.has(normalize(label)));
    if (missingWidgetLabel !== undefined) {
      throw new UiDriftError(
        "UI_DRIFT_OPTION_NOT_UNIQUE",
        `Không tìm thấy option "${missingWidgetLabel}" trong ${selector}.`,
        step,
        { label: controlName, target: missingWidgetLabel, count: 0 }
      );
    }
  } else {
    for (const option of select.options) option.selected = values.includes(option.value);
  }

  select.dispatchEvent(new Event("change", { bubbles: true }));

  const actual = [...select.selectedOptions].map((option) => normalize(option.label || option.textContent));
  const expected = labels.map(normalize);
  if (actual.length !== expected.length || expected.some((label) => !actual.includes(label))) {
    throw new UiDriftError(
      "UI_DRIFT_SELECTION_NOT_SYNCED",
      `${selector}: VAHAN widget did not apply the requested selection.`,
      step,
      { label: controlName, option: labels.join(", "), selectedOptions: actual }
    );
  }
}

async function loadMakerOptions(rawValue) {
  const makers = splitValues(rawValue);
  if (!makers.length) return;
  const select = requireOne("#vehicleMaker", "vehicleMaker", "vehicle-filters");
  for (const maker of makers) {
    if ([...select.options].some((option) => normalize(option.label || option.textContent) === normalize(maker))) continue;
    const url = new URL("/analytics/vahanpublicreport/lazy/vehicle-makers", location.origin);
    url.search = new URLSearchParams({ page: "0", size: "20", search: maker }).toString();
    const response = await fetch(url, { credentials: "same-origin" });
    if (!response.ok) throw new Error(`Could not load Maker options (${response.status}).`);
    const values = await response.json();
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
  if (!state) {
    throw new UiDriftError(
      "UI_DRIFT_REQUIRED_OPTION",
      `Không tìm thấy State "${labels[0]}" để tải RTO.`,
      "state-rto",
      { control: "stateName", selector: "#stateName", expectedOption: labels[0] }
    );
  }
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
  return response.json();
}

async function getXAxisOptions(yAxisLabel) {
  const yAxis = requireOne("#yAxis", "yAxis", "axis");
  if (!yAxisLabel) return [];
  const match = getOptionMap(yAxis).find((option) => option.label === normalize(yAxisLabel));
  if (!match) {
    throw new UiDriftError(
      "UI_DRIFT_REQUIRED_OPTION",
      `Không tìm thấy Y-Axis "${yAxisLabel}".`,
      "axis",
      { control: "yAxis", selector: "#yAxis", expectedOption: yAxisLabel, optionCount: yAxis.options.length }
    );
  }
  yAxis.value = match.value;
  yAxis.dispatchEvent(new Event("change", { bubbles: true }));
  yAxis.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  await delay(50);
  return [...document.querySelectorAll("#xAxis option")]
    .map((option) => (option.label || option.textContent || "").replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

async function getStateOptions(delhiNcrLabel) {
  await selectLabels("#delhiNcr", delhiNcrLabel, "state");
  await delay(150);
  const state = requireOne("#stateName", "stateName", "state");
  return [...state.options]
    .map((option) => (option.label || option.textContent || "").replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function fill(selector, value) {
  if (!value) return;
  const input = requireOne(selector, controlNameFromSelector(selector), "time");
  input.value = value;
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

async function fillVahan(config, expectedSignature = null) {
  if (lastUiDriftError) throw lastUiDriftError;
  const checkContract = (step) =>
    assertUiContract(step, expectedSignature, PAGE_CONTROLS, MULTISELECT_NAMES, pageUiContract);

  checkContract("before-fill");
  await selectLabels("#archivedFlags", config.archivedFlags, "time");
  await selectLabels("#reportType", config.period, "time");
  await delay(300);
  await selectLabels("#financialYearSelect", config.financialYears, "time");
  await selectLabels("#reportYear", config.reportYear, "time");
  await selectLabels("#reportMonth", config.reportMonth, "time");
  fill("#fromYear", config.fromYear);
  fill("#toYear", config.toYear);
  fill("#fromDate", config.fromDate);
  fill("#toDate", config.toDate);
  checkContract("after-time");

  // VAHAN rebuilds the State options whenever Delhi NCR changes. Apply this
  // first so the State selection below is not cleared by the page script.
  await selectLabels("#delhiNcr", config.delhiNcr, "state");
  await delay(100);
  await selectLabels("#stateName", config.states, "state");
  if (splitValues(config.rtos).length) {
    await waitForOptions("#rtoCode", splitValues(config.rtos));
    await selectLabels("#rtoCode", config.rtos, "state-rto");
  }
  checkContract("after-state");

  await selectLabels("#vehicleEmission", config.emissions, "vehicle-filters");
  await loadMakerOptions(config.makers);
  await selectLabels("#vehicleMaker", config.makers, "vehicle-filters");
  await selectLabels("#vehicleCategoryGroup", config.categoryGroups, "vehicle-filters");
  await selectLabels("#vehicleSubCategory", config.subCategories, "vehicle-filters");
  await selectLabels("#vehicleClass", config.classes, "vehicle-filters");
  await selectLabels("#vehicleFuel", config.fuels, "vehicle-filters");
  await selectLabels("#evType", config.evTypes, "vehicle-filters");
  await selectLabels("#vehicleStatus", config.statuses, "vehicle-filters");
  await selectLabels("#vehicleOwnerType", config.ownerTypes, "vehicle-filters");
  await selectLabels("#vehicleType", config.vehicleType, "vehicle-filters");
  await selectLabels("#fitnessCheck", config.fitness, "vehicle-filters");
  checkContract("after-vehicle-filters");

  await selectLabels("#yAxis", config.yAxis, "axis");
  const yAxis = requireOne("#yAxis", "yAxis", "axis");
  yAxis.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  if (splitValues(config.xAxis).length) {
    await waitForOptions("#xAxis", splitValues(config.xAxis));
    await selectLabels("#xAxis", config.xAxis, "axis");
  }
  const yAxisHidden = requireOne("#yAxis_hidden", "yAxisHidden", "axis");
  const xAxisHidden = requireOne("#xAxis_hidden", "xAxisHidden", "axis");
  const expectedAxis = `${yAxis.value}/${document.querySelector("#xAxis")?.value || ""}`;
  const actualAxis = `${yAxisHidden.value}/${xAxisHidden.value}`;
  if (expectedAxis !== actualAxis) {
    throw new UiDriftError(
      "UI_DRIFT_AXIS_NOT_SYNCED",
      "Y-Axis/X-Axis hiển thị đã chọn nhưng field gửi lên server không đồng bộ.",
      "axis",
      { expected: expectedAxis, actual: actualAxis }
    );
  }
  checkContract("before-captcha");
  configureAutoApply(config.autoApply);
}

let autoApplyCleanup;

function configureAutoApply(enabled) {
  autoApplyCleanup?.();
  autoApplyCleanup = undefined;

  const applyLabel = floatingWidget?.shadowRoot?.querySelector('[data-role="apply-label"]');
  if (applyLabel) {
    applyLabel.textContent = enabled ? "5. Tự động bấm Apply" : "5. Bạn bấm Apply trên VAHAN";
  }

  const captcha = document.querySelector("#externalCaptcha");
  const applyButton = document.querySelector("#applyTrigger");
  if (!enabled || !captcha || !applyButton) return;

  let timer;
  let submitted = false;
  const cleanup = () => {
    clearTimeout(timer);
    captcha.removeEventListener("input", onInput);
  };
  const submit = () => {
    if (submitted || captcha.value.trim().length !== 6) return;
    submitted = true;
    cleanup();
    updateFloatingStep("captcha", "done");
    updateFloatingStep("apply", "running");
    setFloatingStatus("running", "Đã nhập đủ CAPTCHA. Đang tự động bấm Apply...");
    applyButton.scrollIntoView({ behavior: "smooth", block: "center" });
    applyButton.click();
  };
  const onInput = () => {
    clearTimeout(timer);
    if (captcha.value.trim().length === 6) timer = setTimeout(submit, 800);
  };

  captcha.addEventListener("input", onInput);
  autoApplyCleanup = cleanup;
  onInput();
}

// Guard Apply for both manual and automatic submissions. The first click is
// paused long enough to validate/persist the UI signature; only then is the
// original click replayed so the page can navigate safely.
function installApplyGuard() {
  applyGuardCleanup?.();
  const applyButton = requireOne("#applyTrigger", "apply", "before-apply");
  let forwarding = false;
  let preparing = false;
  let invalidCaptchaCleanup;

  const onClick = (event) => {
    if (forwarding) {
      forwarding = false;
      return;
    }

    const captcha = document.querySelector("#externalCaptcha");
    if (!uiDriftDetected && captcha && captcha.value.trim().length < 6) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    if (preparing || uiDriftDetected) return;
    preparing = true;

    void (async () => {
      try {
        const contract = assertUiContract(
          "before-apply",
          pageUiContract?.signature || null,
          PAGE_CONTROLS,
          MULTISELECT_NAMES,
          pageUiContract
        );
        pageUiContract = contract;
        await setFlowState({
          status: "AWAITING_RESULT",
          attempts: 1,
          uiContract: contract,
          startedAt: Date.now(),
        });
        invalidCaptchaCleanup = watchForInvalidCaptcha();
        forwarding = true;
        applyButton.click();
      } catch (error) {
        if (isUiDriftError(error)) {
          showUiDriftError(error);
        } else {
          setFloatingStatus("error", error.message);
        }
      } finally {
        preparing = false;
      }
    })();
  };

  applyButton.addEventListener("click", onClick, true);
  applyGuardCleanup = () => {
    applyButton.removeEventListener("click", onClick, true);
    invalidCaptchaCleanup?.();
    invalidCaptchaCleanup = undefined;
    applyGuardCleanup = undefined;
  };
}

async function initializeAutoApplyPreference() {
  const { vahanConfig } = await chrome.storage.local.get("vahanConfig");
  configureAutoApply(vahanConfig?.autoApply);
}

let exportClicked = false;
let exportWatcherTimer;
let exportWatcherTimeout;
async function startAutoExportWatcher() {
  const { vahanConfig } = await chrome.storage.local.get("vahanConfig");
  clearInterval(exportWatcherTimer);
  clearTimeout(exportWatcherTimeout);
  exportWatcherTimer = undefined;
  exportWatcherTimeout = undefined;
  if (!(vahanConfig?.autoExport ?? true) || exportClicked) return;
  exportWatcherTimer = setInterval(() => {
    const button = document.querySelector("#downloadBtn1");
    if (!exportClicked && button && button.getClientRects().length) {
      exportClicked = true;
      clearInterval(exportWatcherTimer);
      updateFloatingStep("captcha", "done");
      updateFloatingStep("apply", "done");
      updateFloatingStep("export", "done");
      setFloatingStatus("success", "Đã tìm thấy kết quả và tải file Excel.");
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
    checking: "Đang kiểm tra UI...",
    ready: "Sẵn sàng",
    running: "Đang xử lý...",
    waiting: "Chờ nhập CAPTCHA",
    success: "Thành công",
    error: "Có lỗi xảy ra",
    "ui-drift": "Cần cập nhật tool",
  };
  badge.dataset.state = state;
  badge.textContent = labels[state] || labels.ready;
  status.textContent = message;
}

function renderUiDriftDetail(report) {
  const root = floatingWidget?.shadowRoot;
  const detail = root?.querySelector(".drift-detail");
  if (!detail) return;

  for (const field of ["target", "expected", "actual", "step", "code", "action"]) {
    const valueEl = detail.querySelector(`[data-ui-drift-field="${field}"]`);
    if (valueEl) valueEl.textContent = report[field] || "không có dữ liệu";
  }
  detail.hidden = false;
}

function markUiDriftStep(step) {
  const normalizedStep = String(step || "").toLocaleLowerCase();
  const stepName = normalizedStep.includes("axis")
    ? "axes"
    : normalizedStep.includes("state") || normalizedStep.includes("rto")
      ? "time"
      : normalizedStep.includes("vehicle") || normalizedStep.includes("category") || normalizedStep.includes("fuel")
        ? "vehicle"
        : normalizedStep.includes("captcha")
          ? "captcha"
          : normalizedStep.includes("apply")
            ? "apply"
            : "time";
  updateFloatingStep(stepName, "error");
}

function showUiDriftError(error) {
  const report = formatUiDrift(error);
  lastUiDriftError = error;
  uiDriftDetected = true;
  console.error("[VAHAN RPA UI DRIFT]", report, error);

  markUiDriftStep(report.step);
  setFloatingStatus("ui-drift", `⚠️ ${report.message} Mã: ${report.code}.`);
  renderUiDriftDetail(report);

  const root = floatingWidget?.shadowRoot;
  const button = root?.querySelector(".start");
  if (button) {
    button.dataset.uiDrift = "true";
    button.disabled = true;
    button.textContent = "⛔ Giao diện chưa được hỗ trợ";
  }
}

function resetFloatingSteps() {
  for (const name of ["time", "vehicle", "axes", "captcha", "apply", "export"]) {
    updateFloatingStep(name, "idle");
  }
}

async function runFromFloatingWidget() {
  const root = floatingWidget.shadowRoot;
  const button = root.querySelector(".start");
  if (uiDriftDetected) return;
  button.disabled = true;
  resetFloatingSteps();
  setFloatingStatus("running", "Đang đọc cấu hình đã lưu...");
  updateFloatingStep("time", "running");

  try {
    const { vahanConfig } = await chrome.storage.local.get("vahanConfig");
    if (!vahanConfig) {
      throw new Error("Chưa có cấu hình. Hãy mở popup extension và chọn bộ lọc trước.");
    }

    const contract = pageUiContract || await waitForUiContract(
      "before-fill",
      null,
      PAGE_CONTROLS,
      MULTISELECT_NAMES
    );
    await fillVahan(vahanConfig, contract.signature);
    updateFloatingStep("time", "done");
    updateFloatingStep("vehicle", "done");
    updateFloatingStep("axes", "done");
    updateFloatingStep("captcha", "waiting");
    setFloatingStatus(
      "waiting",
      vahanConfig.autoApply
        ? "Đã điền bộ lọc. Apply sẽ tự chạy sau khi bạn nhập đủ CAPTCHA."
        : "Đã điền bộ lọc. Hãy nhập CAPTCHA và bấm Apply trên trang VAHAN.",
    );
    button.textContent = "↻ Điền Lại Bộ Lọc";
  } catch (error) {
    if (isUiDriftError(error)) {
      showUiDriftError(error);
    } else {
      updateFloatingStep("time", "error");
      setFloatingStatus("error", error.message);
      button.textContent = "↻ Thử Lại";
    }
  } finally {
    button.disabled = uiDriftDetected;
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
        position: fixed; right: 24px; bottom: 24px; z-index: 2147483647;
        width: 360px; overflow: hidden; border: 1px solid #e1e4e8;
        border-radius: 12px; background: #fff; color: #24292e;
        box-shadow: 0 10px 30px rgba(0,0,0,.22);
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      }
      .header {
        display: flex; align-items: center; gap: 8px;
        padding: 12px 16px; color: #fff;
        background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%);
      }
      .title { display: flex; align-items: center; gap: 7px; font-size: 16px; font-weight: 700; }
      .toggle {
        width: 24px; height: 24px; padding: 0; border: 0; border-radius: 50%;
        background: rgba(255,255,255,.2); color: #fff; font-size: 16px;
        line-height: 1; cursor: pointer;
      }
      .toggle:hover { background: rgba(255,255,255,.3); }
      .body { padding: 14px 16px; }
      .body[hidden] { display: none; }
      .badge {
        display: inline-block; margin-left: auto; padding: 3px 8px;
        border: 1px solid rgba(255,255,255,.45); border-radius: 12px;
        background: rgba(255,255,255,.16); color: #fff; font-size: 12px; font-weight: 600;
      }
      .badge[data-state="checking"], .badge[data-state="running"], .badge[data-state="waiting"] {
        border-color: #fff5b1; background: #fffbdd; color: #9a6700;
      }
      .badge[data-state="success"] { border-color: #bef5cb; background: #dcffe4; color: #22863a; }
      .badge[data-state="error"] { border-color: #ffdce0; background: #ffeef0; color: #cb2431; }
      .badge[data-state="ui-drift"] { border-color: #fecdd3; background: #fff1f2; color: #9f1239; }
      .steps { display: flex; flex-direction: column; gap: 9px; margin-bottom: 16px; font-size: 13px; }
      .step { display: flex; align-items: center; gap: 8px; color: #666; line-height: 1.35; }
      .step-icon { width: 16px; color: #8c959f; font-size: 16px; font-weight: 700; text-align: center; }
      .step[data-state="running"] { color: #005cc5; font-weight: 600; }
      .step[data-state="waiting"] { color: #d93f0b; font-weight: 700; }
      .step[data-state="done"] { color: #22863a; }
      .step[data-state="error"] { color: #cb2431; font-weight: 700; }
      .start {
        width: 100%; padding: 10px; border: 0; border-radius: 6px;
        background: #2ea44f; color: #fff; font-size: 14px; font-weight: 600;
        cursor: pointer; box-shadow: 0 1px 3px rgba(0,0,0,.1);
      }
      .start:hover { background: #2c974b; }
      .start:disabled { opacity: .6; cursor: wait; }
      .preferences {
        display: flex; flex-direction: column; gap: 7px; margin: 0 0 12px;
        padding: 10px; border: 1px solid #e1e4e8; border-radius: 7px;
        background: #f8f9fa;
      }
      .preference {
        display: flex; align-items: center; gap: 7px; color: #444;
        font-size: 12px; line-height: 1.4; cursor: pointer;
      }
      .preference input { width: 14px; height: 14px; margin: 0; accent-color: #2ea44f; }
      .open-popup {
        width: 100%; margin-top: 8px; padding: 8px; border: 1px solid #d0d7de;
        border-radius: 6px; background: #fff; color: #1e3c72; font-size: 13px;
        font-weight: 600; cursor: pointer;
      }
      .open-popup:hover { background: #f6f8fa; border-color: #8c959f; }
      .status { min-height: 22px; margin-top: 10px; color: #586069; font-size: 12px; line-height: 1.45; }
      .drift-detail {
        margin-top: 10px; padding: 10px; border: 1px solid #fecdd3;
        border-radius: 8px; background: #fff7f8; color: #4c0519;
        font-size: 10px; line-height: 1.45;
      }
      .drift-detail[hidden] { display: none; }
      .drift-detail-title { margin-bottom: 6px; font-weight: 700; }
      .drift-detail-action { margin-top: 6px; }
    </style>
    <section class="card" aria-label="VAHAN RPA Tool">
      <header class="header">
        <div class="title"><span aria-hidden="true">🤖</span> VAHAN RPA Tool</div>
        <div class="badge" data-state="checking">Đang kiểm tra UI...</div>
        <button class="toggle" type="button" aria-label="Thu gọn widget" aria-expanded="true">−</button>
      </header>
      <div class="body">
        <div class="steps">
          <div class="step" data-step="time" data-state="idle"><span class="step-icon">○</span><span>1. Điền thời gian và khu vực</span></div>
          <div class="step" data-step="vehicle" data-state="idle"><span class="step-icon">○</span><span>2. Điền bộ lọc phương tiện</span></div>
          <div class="step" data-step="axes" data-state="idle"><span class="step-icon">○</span><span>3. Thiết lập trục báo cáo</span></div>
          <div class="step" data-step="captcha" data-state="idle"><span class="step-icon">○</span><span>4. Bạn nhập CAPTCHA thủ công</span></div>
          <div class="step" data-step="apply" data-state="idle"><span class="step-icon">○</span><span data-role="apply-label">5. Bấm Apply trên VAHAN</span></div>
          <div class="step" data-step="export" data-state="idle"><span class="step-icon">○</span><span>6. Tự động tải file Excel</span></div>
        </div>
        <div class="preferences" aria-label="Tùy chọn tự động">
          <label class="preference"><input data-setting="autoApply" type="checkbox"><span>Tự động bấm Apply sau khi nhập CAPTCHA</span></label>
          <label class="preference"><input data-setting="autoExport" type="checkbox"><span>Tự động tải Excel khi có kết quả</span></label>
        </div>
        <button class="start" type="button">▶ Điền Bộ Lọc Tự Động</button>
        <button class="open-popup" type="button">⚙ Mở Cấu Hình</button>
        <div class="status" role="status">Đang kiểm tra giao diện và cấu trúc control...</div>
        <div class="drift-detail" hidden aria-live="assertive">
          <div class="drift-detail-title">Chi tiết thay đổi UI</div>
          <div><strong>Vị trí:</strong> <span data-ui-drift-field="target"></span></div>
          <div><strong>Mong đợi:</strong> <span data-ui-drift-field="expected"></span></div>
          <div><strong>Thực tế:</strong> <span data-ui-drift-field="actual"></span></div>
          <div><strong>Bước:</strong> <span data-ui-drift-field="step"></span></div>
          <div><strong>Mã lỗi:</strong> <span data-ui-drift-field="code"></span></div>
          <div class="drift-detail-action"><strong>Hướng xử lý:</strong> <span data-ui-drift-field="action"></span></div>
        </div>
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
    toggle.setAttribute("aria-label", expanded ? "Mở rộng widget" : "Thu gọn widget");
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
      if (!response?.ok) throw new Error(response?.error || "Chrome không thể mở popup.");
    } catch (error) {
      setFloatingStatus("error", `Không thể mở cấu hình: ${error.message}`);
    }
  });
  chrome.storage.local.get("vahanConfig").then(({ vahanConfig }) => {
    root.querySelector('[data-setting="autoApply"]').checked = vahanConfig?.autoApply ?? false;
    root.querySelector('[data-setting="autoExport"]').checked = vahanConfig?.autoExport ?? true;
    if (vahanConfig?.autoApply) {
      root.querySelector('[data-role="apply-label"]').textContent = "5. Tự động bấm Apply";
    }
  });
}

async function resumeAfterApply(state) {
  if (!state.uiContract?.signature) {
    await setFlowState(null);
    showUiDriftError(
      new UiDriftError(
        "UI_DRIFT_STALE_FLOW_STATE",
        "Flow cũ không có thông tin UI contract; không tiếp tục tự động.",
        "resume"
      )
    );
    return;
  }

  try {
    pageUiContract = await waitForUiContract(
      "post-apply",
      state.uiContract.signature,
      PAGE_CONTROLS,
      MULTISELECT_NAMES,
      10000,
      state.uiContract
    );
  } catch (error) {
    await setFlowState(null);
    if (isUiDriftError(error)) {
      showUiDriftError(error);
    } else {
      setFloatingStatus("error", error.message);
    }
    return;
  }

  installApplyGuard();
  for (const name of ["time", "vehicle", "axes", "captcha", "apply"]) {
    updateFloatingStep(name, "done");
  }
  const bodyText = document.body.innerText || "";
  await setFlowState(null);

  if (bodyText.includes("Invalid CAPTCHA") || bodyText.includes("invalid captcha")) {
    updateFloatingStep("captcha", "error");
    setFloatingStatus(
      "error",
      "CAPTCHA không hợp lệ. Hãy nhập CAPTCHA mới rồi bấm Apply lại."
    );
    return;
  }

  setFloatingStatus("running", "Apply đã gửi — đang kiểm tra bảng kết quả...");
}

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "local" || !changes.vahanConfig) return;
  const previous = changes.vahanConfig.oldValue || {};
  const current = changes.vahanConfig.newValue || {};
  const autoApply = current.autoApply ?? false;
  const autoExport = current.autoExport ?? true;
  const root = floatingWidget?.shadowRoot;

  if (root) {
    root.querySelector('[data-setting="autoApply"]').checked = autoApply;
    root.querySelector('[data-setting="autoExport"]').checked = autoExport;
  }
  if ((previous.autoApply ?? false) !== autoApply) configureAutoApply(autoApply);
  if ((previous.autoExport ?? true) !== autoExport) startAutoExportWatcher();
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  let operation;
  if (message?.type === "FILL_VAHAN") operation = fillVahan(message.config).then(() => ({ ok: true }));
  else if (message?.type === "GET_VAHAN_OPTIONS") operation = Promise.resolve({ ok: true, options: readOptions(message.selectors) });
  else if (message?.type === "GET_STATE_OPTIONS") operation = getStateOptions(message.delhiNcr).then((options) => ({ ok: true, options }));
  else if (message?.type === "GET_RTO_OPTIONS") operation = fetchRtos(message.stateLabels).then((options) => ({ ok: true, options }));
  else if (message?.type === "GET_X_AXIS_OPTIONS") operation = getXAxisOptions(message.yAxis).then((options) => ({ ok: true, options }));
  else if (message?.type === "SEARCH_MAKERS") operation = fetchMakers(message.search).then((options) => ({ ok: true, options }));
  else return;

  operation
    .then(sendResponse)
    .catch((error) => {
      const response = { ok: false, error: error.message };
      if (isUiDriftError(error)) {
        showUiDriftError(error);
        const report = formatUiDrift(error);
        response.error = report.message;
        response.uiDrift = report;
      }
      sendResponse(response);
    });
  return true;
});

async function initializeContent() {
  injectFloatingWidget();
  setFloatingStatus("checking", "Đang kiểm tra giao diện và cấu trúc control...");
  try {
    pageUiContract = await waitForUiContract(
      "preflight",
      null,
      PAGE_CONTROLS,
      MULTISELECT_NAMES
    );
    const state = await getFlowState();
    if (state?.status === "AWAITING_RESULT") {
      await resumeAfterApply(state);
    } else {
      installApplyGuard();
      setFloatingStatus("ready", "Giao diện đã được kiểm tra. Nhấn nút trên để dùng cấu hình đã lưu từ popup.");
    }
    if (uiDriftDetected) return;
    await initializeAutoApplyPreference();
    await startAutoExportWatcher();
  } catch (error) {
    await setFlowState(null);
    if (isUiDriftError(error)) {
      showUiDriftError(error);
    } else {
      setFloatingStatus("error", error.message);
    }
  }
}

initializeContent();
