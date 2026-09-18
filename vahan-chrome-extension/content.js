// ── Excel blob interceptor ──────────────────────────────────────────
// VAHAN's SheetJS builds the Excel file client-side and triggers a
// download by creating an <a download href="blob:..."> then calling
// .click(). We intercept this to capture the blob, send it to the
// background script for server upload, and suppress the browser download.
function handleExcelAnchor(anchor, event) {
  const href = anchor.getAttribute("href") || anchor.href;
  const fileName = anchor.getAttribute("download") || "report.xlsx";
  if (href && (href.startsWith("blob:") || href.includes("report") || href.endsWith(".xlsx") || href.endsWith(".csv"))) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
    }
    fetch(href)
      .then((r) => r.blob())
      .then((blob) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          chrome.runtime.sendMessage({
            type: "EXCEL_BLOB_CAPTURED",
            dataUrl: reader.result,
            fileName,
          }).catch((err) => console.error("[VAHAN EXT] Send blob error:", err));
        };
        reader.readAsDataURL(blob);
      })
      .catch((error) => {
        console.error("[VAHAN EXT] Failed to capture Excel blob:", error);
      });
    return true;
  }
  return false;
}

(function installDownloadInterceptor() {
  const clickCapture = (event) => {
    const target = event.target?.closest ? event.target.closest("a") : event.target;
    if (target && target.tagName === "A" && target.hasAttribute("download")) {
      handleExcelAnchor(target, event);
    }
  };
  window.addEventListener("click", clickCapture, true);
  document.addEventListener("click", clickCapture, true);

  const originalClick = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function patchedClick() {
    if (this.hasAttribute("download") && handleExcelAnchor(this)) {
      return;
    }
    return originalClick.call(this);
  };

  window.addEventListener("__VAHAN_EXCEL_EXPORT__", (e) => {
    const { href, fileName } = e.detail || {};
    if (href) {
      handleExcelAnchor({ getAttribute: () => fileName, href });
    }
  });
})();

const splitValues = (value) => String(value || "").split(",").map((item) => item.trim()).filter(Boolean);
const normalize = (value) => String(value || "").replace(/\s+/g, " ").trim().toLocaleLowerCase();
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));


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
  throw new Error(`${selector}: dynamic options did not load within ${timeout} ms.`);
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
  const yAxis = document.querySelector("#yAxis");
  if (!yAxis || !yAxisLabel) return [];
  const match = getOptionMap(yAxis).find((option) => option.label === normalize(yAxisLabel));
  if (!match) return [];
  yAxis.value = match.value;
  yAxis.dispatchEvent(new Event("change", { bubbles: true }));
  yAxis.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  await delay(50);
  return [...document.querySelectorAll("#xAxis option")]
    .map((option) => (option.label || option.textContent || "").replace(/\s+/g, " ").trim())
    .filter(Boolean);
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
  if (has("archivedFlags")) await selectLabels("#archivedFlags", config.archivedFlags);
  if (has("period")) await selectLabels("#reportType", config.period);
  await delay(300);
  if (has("financialYears")) await selectLabels("#financialYearSelect", config.financialYears);
  if (has("reportYear")) await selectLabels("#reportYear", config.reportYear);
  if (has("reportMonth")) await selectLabels("#reportMonth", config.reportMonth);
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
  if (has("states")) await selectLabels("#stateName", config.states);
  if (has("rtos") && splitValues(config.rtos).length) {
    await waitForOptions("#rtoCode", splitValues(config.rtos));
    await selectLabels("#rtoCode", config.rtos);
  }
  if (has("emissions")) await selectLabels("#vehicleEmission", config.emissions);
  if (has("makers")) {
    await loadMakerOptions(config.makers);
    await selectLabels("#vehicleMaker", config.makers);
  }
  const optionalSelects = {
    categoryGroups: "#vehicleCategoryGroup", subCategories: "#vehicleSubCategory",
    classes: "#vehicleClass", fuels: "#vehicleFuel", evTypes: "#evType",
    statuses: "#vehicleStatus", ownerTypes: "#vehicleOwnerType",
    vehicleType: "#vehicleType", fitness: "#fitnessCheck",
  };
  for (const [key, selector] of Object.entries(optionalSelects)) {
    if (has(key)) await selectLabels(selector, config[key]);
  }
  if (has("yAxis")) {
    await selectLabels("#yAxis", config.yAxis);
    document.querySelector("#yAxis")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  }
  if (has("xAxis") && splitValues(config.xAxis).length) {
    await waitForOptions("#xAxis", splitValues(config.xAxis));
    await selectLabels("#xAxis", config.xAxis);
  }
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

let captchaRefreshTimer;
async function notifyCaptchaRefresh() {
  clearTimeout(captchaRefreshTimer);
  captchaRefreshTimer = setTimeout(async () => {
    try {
      const { activeServerJob } = await chrome.storage.local.get("activeServerJob");
      if (!activeServerJob || activeServerJob.stage !== "WAITING_CAPTCHA") return;
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
  const input = document.querySelector("#externalCaptcha");
  if (!input) throw new Error("Could not find the CAPTCHA input on VAHAN.");
  input.focus();
  input.value = value;
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
  updateFloatingStep("captcha", "done");

  if (!autoApply) {
    setFloatingStatus("waiting", "CAPTCHA đã được điền. Hãy kiểm tra và bấm Apply trên VAHAN.");
    return { applied: false };
  }

  // configureAutoApply owns the delayed click and prevents duplicate submits.
  configureAutoApply(true);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  return { applied: true };
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
    ready: "Sẵn sàng",
    running: "Đang xử lý...",
    waiting: "Chờ nhập CAPTCHA",
    success: "Thành công",
    error: "Có lỗi xảy ra",
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

const hasInvalidCaptchaMessage = () => /invalid captcha/i.test(document.body?.innerText || "");
// VAHAN trả text này khi filter hợp lệ nhưng không có dữ liệu khớp (khác timeout/lỗi thật) —
// #downloadBtn1 sẽ KHÔNG BAO GIỜ xuất hiện trong trường hợp này, nên phải phát hiện riêng,
// nếu không resumeServerJobAfterApply() sẽ chờ hết 90s rồi báo FAILED "Timed out" gây hiểu lầm.
const NO_RECORD_TEXT = "no record found";
const hasNoRecordMessage = () => (document.body?.innerText || "").toLocaleLowerCase().includes(NO_RECORD_TEXT);
const isVisible = (element) => Boolean(element && (
  element.getClientRects().length || window.getComputedStyle(element).display !== "none"
));

async function resumeServerJobAfterApply() {
  const { activeServerJob } = await chrome.storage.local.get("activeServerJob");
  if (!activeServerJob || activeServerJob.stage !== "WAITING_RESULT") return;

  updateFloatingStep("captcha", "done");
  updateFloatingStep("apply", "done");
  updateFloatingStep("export", "running");
  setFloatingStatus("running", "Trang đã tải lại. Đang kiểm tra kết quả VAHAN...");

  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    if (hasInvalidCaptchaMessage()) {
      updateFloatingStep("captcha", "error");
      updateFloatingStep("export", "idle");
      setFloatingStatus("waiting", "CAPTCHA không đúng. Đang gửi ảnh mới sang Web UI...");
      const captcha = await captureCaptcha();
      await chrome.runtime.sendMessage({
        type: "SERVER_JOB_PAGE_RESULT",
        result: "INVALID_CAPTCHA",
        captcha,
      });
      return;
    }

    if (hasNoRecordMessage()) {
      updateFloatingStep("export", "idle");
      setFloatingStatus("success", "VAHAN không có dữ liệu khớp bộ lọc này (No record found).");
      await chrome.runtime.sendMessage({ type: "SERVER_JOB_PAGE_RESULT", result: "NO_RECORD" });
      return;
    }

    const downloadButton = document.querySelector("#downloadBtn1");
    if (isVisible(downloadButton)) {
      if (activeServerJob.config?.autoExport ?? true) {
        setFloatingStatus("running", "Báo cáo đã sẵn sàng. Đang tải và xác minh file Excel...");
        await chrome.runtime.sendMessage({ type: "SERVER_JOB_PAGE_RESULT", result: "DOWNLOAD_READY" });
      } else {
        setFloatingStatus("success", "Báo cáo đã sẵn sàng. Bạn có thể tải Excel thủ công.");
        await chrome.runtime.sendMessage({ type: "SERVER_JOB_PAGE_RESULT", result: "COMPLETED" });
      }
      updateFloatingStep("export", "done");
      return;
    }
    await delay(500);
  }

  updateFloatingStep("export", "error");
  setFloatingStatus("error", "Quá thời gian chờ kết quả từ VAHAN.");
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
    connected: "Backend đã kết nối",
    connecting: "Đang kết nối backend...",
    disconnected: "Backend đã ngắt kết nối",
    error: "Không thể kết nối backend",
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
  setFloatingStatus("running", "Đang đọc cấu hình đã lưu...");
  updateFloatingStep("time", "running");

  try {
    const { vahanConfig } = await chrome.storage.local.get("vahanConfig");
    if (!vahanConfig) {
      throw new Error("Chưa có cấu hình. Hãy mở popup extension và chọn bộ lọc trước.");
    }

    await fillVahan(vahanConfig);
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
    updateFloatingStep("time", "error");
    setFloatingStatus("error", error.message);
    button.textContent = "↻ Thử Lại";
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
      .backend-connection {
        display: flex; align-items: center; gap: 7px; margin: 0 0 12px;
        color: #586069; font-size: 12px;
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
        display: inline-block; margin-left: auto; padding: 3px 8px;
        border: 1px solid rgba(255,255,255,.45); border-radius: 12px;
        background: rgba(255,255,255,.16); color: #fff; font-size: 12px; font-weight: 600;
      }
      .badge[data-state="running"], .badge[data-state="waiting"] {
        border-color: #fff5b1; background: #fffbdd; color: #9a6700;
      }
      .badge[data-state="success"] { border-color: #bef5cb; background: #dcffe4; color: #22863a; }
      .badge[data-state="error"] { border-color: #ffdce0; background: #ffeef0; color: #cb2431; }
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
    </style>
    <section class="card" aria-label="VAHAN RPA Tool">
      <header class="header">
        <div class="title"><span aria-hidden="true">🤖</span> VAHAN RPA Tool</div>
        <div class="badge" data-state="ready">Sẵn sàng</div>
        <button class="toggle" type="button" aria-label="Thu gọn widget" aria-expanded="true">−</button>
      </header>
      <div class="body">
        <div class="backend-connection" data-state="connecting"><span class="backend-dot"></span><span>Đang kết nối backend...</span></div>
        <div class="steps">
          <div class="step" data-step="time" data-state="idle"><span class="step-icon">○</span><span>1. Điền thời gian và khu vực</span></div>
          <div class="step" data-step="vehicle" data-state="idle"><span class="step-icon">○</span><span>2. Điền bộ lọc phương tiện</span></div>
          <div class="step" data-step="axes" data-state="idle"><span class="step-icon">○</span><span>3. Thiết lập trục báo cáo</span></div>
          <div class="step" data-step="captcha" data-state="idle"><span class="step-icon">○</span><span>4. Bạn nhập CAPTCHA thủ công</span></div>
          <div class="step" data-step="apply" data-state="idle"><span class="step-icon">○</span><span data-role="apply-label">5. Bấm Apply trên VAHAN</span></div>
          <div class="step" data-step="export" data-state="idle"><span class="step-icon">○</span><span>6. Gửi file Excel về server</span></div>
        </div>
        <div class="preferences" aria-label="Tùy chọn tự động">
          <label class="preference"><input data-setting="autoApply" type="checkbox"><span>Tự động bấm Apply sau khi nhập CAPTCHA</span></label>
          <label class="preference"><input data-setting="autoExport" type="checkbox"><span>Tự động tải Excel khi có kết quả</span></label>
        </div>
        <button class="start" type="button">▶ Điền Bộ Lọc Tự Động</button>
        <button class="open-popup" type="button">⚙ Mở Cấu Hình</button>
        <div class="status" role="status">Nhấn nút trên để dùng cấu hình đã lưu từ popup.</div>
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
  chrome.storage.local.get(["vahanConfig", "runnerConnection"]).then(({ vahanConfig, runnerConnection }) => {
    renderFloatingRunnerConnection(runnerConnection);
    root.querySelector('[data-setting="autoApply"]').checked = vahanConfig?.autoApply ?? false;
    root.querySelector('[data-setting="autoExport"]').checked = vahanConfig?.autoExport ?? true;
    if (vahanConfig?.autoApply) {
      root.querySelector('[data-role="apply-label"]').textContent = "5. Tự động bấm Apply";
    }
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
    root.querySelector('[data-setting="autoApply"]').checked = autoApply;
    root.querySelector('[data-setting="autoExport"]').checked = autoExport;
  }
  if ((previous.autoApply ?? false) !== autoApply) configureAutoApply(autoApply);
  if ((previous.autoExport ?? true) !== autoExport) startAutoExportWatcher();
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  let operation;
  if (message?.type === "FILL_VAHAN") operation = fillVahan(message.config).then(() => ({ ok: true }));
  else if (message?.type === "CAPTURE_CAPTCHA") operation = captureCaptcha().then((captcha) => ({ ok: true, ...captcha }));
  else if (message?.type === "SUBMIT_REMOTE_CAPTCHA") {
    operation = Promise.resolve({ ok: true, ...submitRemoteCaptcha(message.value, message.autoApply) });
  }
  else if (message?.type === "CLICK_EXCEL_DOWNLOAD") {
    const button = document.querySelector("#downloadBtn1");
    if (!isVisible(button)) operation = Promise.resolve({ ok: false, error: "Excel download button is not visible." });
    else { button.click(); operation = Promise.resolve({ ok: true }); }
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

injectFloatingWidget();
initializeAutoApplyPreference();
startAutoExportWatcher();
observeCaptchaChanges();
resumeServerJobAfterApply().catch((error) => {
  chrome.runtime.sendMessage({
    type: "SERVER_JOB_PAGE_RESULT",
    result: "FAILED",
    error: error.message,
  }).catch(() => {});
});
