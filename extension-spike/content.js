// VAHAN RPA Assistant - Content Script
// Attended Automation Demo
//
// Flow này bám theo poc_vahan.py — script Playwright đã chạy thật và verify 3/3 lần
// (mục 5.3 báo cáo). Selector/hành vi lấy từ đó, KHÔNG đoán lại từ đầu:
//   - Category Group = Two Wheeler, Fuel = All (mục 0.1 đã chốt "All", không phải PETROL —
//     xem inspect_fuel_options.py: "All" là div.multiselect-dropdown-all-selector riêng,
//     không có data-search-text, không nằm trong danh sách option thường).
//   - Y-Axis = Fuel, X-Axis = Vehicle Category Group là <select> GỐC (không phải widget
//     multiselect tuỳ chỉnh). #xAxis chỉ được trang populate options khi có sự kiện
//     "click" trên #yAxis — KHÔNG phải "change" (đọc thẳng script nhúng trong trang,
//     document.getElementById("yAxis")?.addEventListener("click", updateXAxisOptions)).
//     Bắt buộc: set #yAxis trước, dispatch click trên #yAxis, rồi mới set #xAxis.
//
// [FACT] QUAN TRỌNG — Apply KHÔNG phải AJAX: page.html có
//   document.getElementById("vahanPublicForm").submit();
// trong handler click của #applyTrigger (POST thật, method="POST" trên form
// #vahanPublicForm). Bấm Apply = trình duyệt NAVIGATE sang trang mới (server
// render lại), dù URL thanh địa chỉ không đổi (self-POST). Toàn bộ JS context —
// biến, Promise, `await` đang chờ — của content script CŨ bị huỷ NGAY khi
// navigate; code đứng sau clickApply() sẽ KHÔNG BAO GIỜ chạy tới.
// Content script được tiêm lại (document_idle) trên trang mới là một lần CHẠY
// MỚI HOÀN TOÀN, không kế thừa gì từ lần trước — nên phải tự lưu "mình đang ở
// bước nào" vào chrome.storage.local TRƯỚC khi click Apply, rồi đọc lại ở lần
// chạy mới để biết cần bấm Download hay phải gõ lại CAPTCHA (nếu "Invalid
// CAPTCHA."). Đây là lý do bắt buộc phải có permission "storage" trong manifest.
//
// [FACT] Dùng chrome.storage.LOCAL, KHÔNG dùng .session: đã test thật trong
// Chrome và gặp lỗi "Access to storage is not allowed from this context" — vùng
// "session" mặc định CHẶN content script trừ khi có một background/service-worker
// gọi chrome.storage.session.setAccessLevel("TRUSTED_AND_UNTRUSTED_CONTEXTS")
// trước. .local không bị giới hạn này. Đánh đổi: .local sống sót qua cả việc đóng
// trình duyệt (session thì không), nhưng code luôn tự xoá state khi xong
// (thành công/lỗi/hết max attempts) và từ chối flow state cũ không có UI contract.

console.log("[VAHAN RPA] Assistant content script initialized.");

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ==========================================
// 0. PERSISTED FLOW STATE (sống sót qua reload do Apply gây ra)
// ==========================================

const FLOW_STATE_KEY = "vahanRpaFlowState";
const MAX_CAPTCHA_ATTEMPTS = 5; // giống tinh thần max_attempts trong poc_vahan.py, tránh loop vô hạn nếu có gì đó sai thật (không chỉ gõ nhầm)
const UI_CONTRACT_VERSION = "v1";
const REPORT_PATH_FRAGMENT = "/analytics/vahanpublicreport";

class UiDriftError extends Error {
  constructor(code, message, step = "preflight", details = {}) {
    super(message);
    this.name = "UiDriftError";
    this.code = code;
    this.step = step;
    this.details = details;
  }
}

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

// ==========================================
// 1. DOM HELPER FUNCTIONS
// ==========================================

const REQUIRED_CONTROLS = {
  form: "#vahanPublicForm",
  category: "#vehicleCategoryGroup",
  fuel: "#vehicleFuel",
  yaxis: "#yAxis",
  xaxis: "#xAxis",
  captcha: "#externalCaptcha",
  apply: "#applyTrigger",
};

function normalizeText(value) {
  return String(value || "").replace(/\s+/g, " ").trim().toLocaleLowerCase();
}

function isSupportedReportPage() {
  return (
    window.location.pathname.includes(REPORT_PATH_FRAGMENT) &&
    document.querySelector(REQUIRED_CONTROLS.form)
  );
}

function requireOne(selector, name, step = "preflight") {
  const matches = document.querySelectorAll(selector);
  if (matches.length !== 1) {
    throw new UiDriftError(
      "UI_DRIFT_REQUIRED_CONTROL",
      `Không tìm thấy duy nhất control bắt buộc "${name}".`,
      step,
      { name, selector, count: matches.length }
    );
  }
  return matches[0];
}

// Resolve widget trong cùng field-group với hidden select. Không dùng
// following::div trên toàn trang vì một UI mới có thể chèn thêm dropdown khác.
function getDropdownContainer(hiddenSelectId) {
  const cleanId = hiddenSelectId.replace("#", "");
  const hidden = requireOne(`#${cleanId}`, hiddenSelectId, "filter");
  const group = hidden.closest(".form-group");
  let candidates = group
    ? group.querySelectorAll("div.multiselect-dropdown")
    : [];

  if (candidates.length !== 1 && hidden.parentElement) {
    candidates = hidden.parentElement.querySelectorAll("div.multiselect-dropdown");
  }

  if (candidates.length !== 1) {
    throw new UiDriftError(
      "UI_DRIFT_MULTISELECT_WRAPPER",
      `Không xác định được widget multiselect duy nhất cho #${cleanId}.`,
      "filter",
      { hiddenSelectId: cleanId, wrapperCount: candidates.length }
    );
  }
  return candidates[0];
}

function findDropdownOption(container, targetText, label, step = label) {
  const target = normalizeText(targetText);
  const matches = Array.from(container.querySelectorAll("[data-search-text]"))
    .filter((option) => {
      const dataText = normalizeText(option.getAttribute("data-search-text"));
      const visibleText = normalizeText(option.textContent);
      return dataText === target || visibleText === target;
    });

  if (matches.length !== 1) {
    throw new UiDriftError(
      "UI_DRIFT_OPTION_NOT_UNIQUE",
      `Không tìm thấy duy nhất option "${targetText}" trong ${label}.`,
      step,
      { label, target: targetText, count: matches.length }
    );
  }
  return matches[0];
}

function findAllCheckbox(container, label, step = label) {
  const matches = Array.from(container.querySelectorAll("input[type='checkbox']"))
    .filter((checkbox) => normalizeText(checkbox.parentElement?.textContent) === "all");
  if (matches.length === 1) return matches[0];

  const fallback = container.querySelectorAll(
    "div.multiselect-dropdown-all-selector input[type='checkbox']"
  );
  if (fallback.length === 1) return fallback[0];

  throw new UiDriftError(
    "UI_DRIFT_ALL_OPTION_NOT_FOUND",
    `Không tìm thấy checkbox All duy nhất trong ${label}.`,
    step,
    { label, count: matches.length }
  );
}

function getOptionLabels(selector) {
  return Array.from(document.querySelectorAll(`${selector} option`)).map((option) =>
    normalizeText(option.label || option.textContent)
  );
}

function getUiContract(step = "preflight") {
  if (!window.location.pathname.includes(REPORT_PATH_FRAGMENT)) {
    throw new UiDriftError(
      "UI_DRIFT_WRONG_PAGE",
      "Trang hiện tại không phải VAHAN Public Report.",
      step,
      { url: window.location.href }
    );
  }

  const fingerprint = [];
  for (const [name, selector] of Object.entries(REQUIRED_CONTROLS)) {
    const element = requireOne(selector, name, step);
    fingerprint.push({
      name,
      selector,
      tag: element.tagName.toLowerCase(),
      id: element.id,
      nameAttr: element.getAttribute("name"),
      multiple: element.hasAttribute("multiple"),
    });
  }

  for (const name of ["category", "fuel"]) {
    const element = document.querySelector(REQUIRED_CONTROLS[name]);
    if (!element.hasAttribute("multiple")) {
      throw new UiDriftError(
        "UI_DRIFT_CONTROL_TYPE",
        `Control ${name} không còn là multi-select như contract ${UI_CONTRACT_VERSION}.`,
        step,
        { name, expected: "multiple select" }
      );
    }
  }

  if (!getOptionLabels(REQUIRED_CONTROLS.category).includes("two wheeler")) {
    throw new UiDriftError(
      "UI_DRIFT_REQUIRED_OPTION",
      "Không tìm thấy option Category Group Two Wheeler.",
      step,
      { control: "category", expectedOption: "Two Wheeler" }
    );
  }

  if (document.querySelectorAll("#vehicleFuel option").length === 0) {
    throw new UiDriftError(
      "UI_DRIFT_EMPTY_OPTIONS",
      "Danh sách Fuel đang rỗng hoặc chưa được tải.",
      step,
      { control: "fuel" }
    );
  }

  if (!getOptionLabels(REQUIRED_CONTROLS.yaxis).includes("fuel")) {
    throw new UiDriftError(
      "UI_DRIFT_REQUIRED_OPTION",
      "Không tìm thấy option Y-Axis Fuel.",
      step,
      { control: "yaxis", expectedOption: "Fuel" }
    );
  }

  getDropdownContainer("vehicleCategoryGroup");
  getDropdownContainer("vehicleFuel");

  const canonical = JSON.stringify(fingerprint);
  const signature = Array.from(canonical).reduce(
    (hash, character) => ((hash * 31 + character.charCodeAt(0)) >>> 0),
    7
  ).toString(16);

  return {
    contractVersion: UI_CONTRACT_VERSION,
    signature,
    path: window.location.pathname,
    formAction: document.querySelector(REQUIRED_CONTROLS.form)?.getAttribute("action") || "",
    controls: fingerprint,
  };
}

function assertUiContract(step = "preflight", expectedSignature = null) {
  const contract = getUiContract(step);
  if (expectedSignature && expectedSignature !== contract.signature) {
    throw new UiDriftError(
      "UI_DRIFT_CHANGED_DURING_RUN",
      "Cấu trúc UI đã thay đổi trong lúc flow đang chạy; dữ liệu chưa được xác nhận.",
      step,
      { expectedSignature, actualSignature: contract.signature }
    );
  }
  return contract;
}

async function waitForUiContract(step = "preflight", expectedSignature = null, timeoutMs = 10000) {
  const startedAt = Date.now();
  let lastError = null;
  while (Date.now() - startedAt < timeoutMs) {
    try {
      return assertUiContract(step, expectedSignature);
    } catch (err) {
      lastError = err;
      await sleep(200);
    }
  }
  throw lastError || new UiDriftError(
    "UI_DRIFT_CONTRACT_TIMEOUT",
    "UI contract không sẵn sàng đúng hạn.",
    step
  );
}

function waitForCondition(predicate, timeoutMs = 10000, intervalMs = 100) {
  return new Promise((resolve, reject) => {
    const startedAt = Date.now();
    const timer = setInterval(() => {
      try {
        if (predicate()) {
          clearInterval(timer);
          resolve(true);
          return;
        }
      } catch (_) {
        // Keep polling while a dynamic widget is still being initialized.
      }
      if (Date.now() - startedAt >= timeoutMs) {
        clearInterval(timer);
        reject(new UiDriftError(
          "UI_DRIFT_DYNAMIC_CONTROL_TIMEOUT",
          "Control động không xuất hiện đúng hạn.",
          "axis"
        ));
      }
    }, intervalMs);
  });
}

// Chọn MỘT option cụ thể trong dropdown checkbox searchable (Category Group).
// Verify thật bằng assert checkbox.checked, không chỉ tin click không lỗi —
// đúng pattern select_checkbox_dropdown() trong test_category_and_fuel.py.
async function selectCheckboxOption(hiddenSelectId, targetText, label) {
  const container = getDropdownContainer(hiddenSelectId);

  container.scrollIntoView({ behavior: "smooth", block: "center" });
  container.click();

  const searchBoxes = container.querySelectorAll(
    "input.multiselect-dropdown-search, input[type='search'], input[placeholder*='search' i]"
  );
  if (searchBoxes.length !== 1) {
    throw new UiDriftError(
      "UI_DRIFT_SEARCH_INPUT",
      `Không tìm thấy duy nhất ô tìm kiếm cho ${label}.`,
      label,
      { label, count: searchBoxes.length }
    );
  }
  const searchBox = searchBoxes[0];
  searchBox.value = targetText;
  searchBox.dispatchEvent(new Event("input", { bubbles: true }));
  await sleep(300);

  const option = findDropdownOption(container, targetText, label);
  option.scrollIntoView({ behavior: "smooth", block: "nearest" });
  option.click();

  const checkbox = option.querySelector("input[type='checkbox']");
  if (!checkbox || !checkbox.checked) {
    throw new UiDriftError(
      "UI_DRIFT_SELECTION_NOT_SYNCED",
      `[${label}] Click xong nhưng checkbox không được tick.`,
      label,
      { label, option: targetText }
    );
  }

  const selectedOptions = Array.from(
    document.querySelectorAll(`#${hiddenSelectId} option:checked`)
  ).map((selected) => normalizeText(selected.textContent));
  if (!selectedOptions.includes(normalizeText(targetText))) {
    throw new UiDriftError(
      "UI_DRIFT_SELECTION_NOT_SYNCED",
      `[${label}] Widget hiển thị đã chọn nhưng select gốc không đồng bộ.`,
      label,
      { label, option: targetText, selectedOptions }
    );
  }

  document.body.click();
  await sleep(300);
}

// Chọn "All" — KHÔNG phải option thường (không có data-search-text), mà là
// div.multiselect-dropdown-all-selector nằm đầu danh sách. Xác nhận qua
// inspect_fuel_options.py, dùng cho Fuel. KHÔNG dùng selectCheckboxOption() cho case này.
async function selectAllCheckbox(hiddenSelectId, label) {
  const container = getDropdownContainer(hiddenSelectId);

  container.scrollIntoView({ behavior: "smooth", block: "center" });
  container.click();

  const allCheckbox = findAllCheckbox(container, label);
  allCheckbox.click();

  if (!allCheckbox.checked) {
    throw new UiDriftError(
      "UI_DRIFT_SELECT_ALL_NOT_SYNCED",
      `[${label}] Click xong nhưng checkbox All không được tick.`,
      label,
      { label }
    );
  }

  const nativeOptions = document.querySelectorAll(`#${hiddenSelectId} option`);
  const selectedOptions = document.querySelectorAll(`#${hiddenSelectId} option:checked`);
  if (nativeOptions.length === 0 || nativeOptions.length !== selectedOptions.length) {
    throw new UiDriftError(
      "UI_DRIFT_SELECT_ALL_NOT_SYNCED",
      `[${label}] Widget hiển thị All nhưng select gốc không chọn đủ option.`,
      label,
      { label, optionCount: nativeOptions.length, selectedCount: selectedOptions.length }
    );
  }

  document.body.click();
  await sleep(300);
}

// Set giá trị cho <select> GỐC (Y-Axis/X-Axis) bằng cách khớp label hoặc text hiển thị của <option>.
// Hỗ trợ cả option.label, attribute 'label', text/textContent và value của thẻ option.
function setNativeSelectByLabel(selectId, labelText) {
  const select = requireOne(selectId, selectId, "axis");

  const upperTarget = labelText.trim().toUpperCase();
  const option = Array.from(select.options).find((o) => {
    const optLabel = (o.label || o.getAttribute("label") || o.text || o.textContent || "").trim().toUpperCase();
    const optVal = (o.value || "").trim().toUpperCase();
    return optLabel === upperTarget || optVal === upperTarget;
  });
  if (!option) {
    throw new Error(`[${selectId}] Không tìm thấy option có nhãn "${labelText}"`);
  }

  select.value = option.value;
  select.dispatchEvent(new Event("change", { bubbles: true }));
  return select;
}

function highlightCaptcha(on = true) {
  const el = document.querySelector("#externalCaptcha");
  if (!el) return;
  if (on) {
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.focus();
    el.style.outline = "4px solid #ff9800";
    el.style.backgroundColor = "#fff9e6";
    el.style.transition = "all 0.3s ease";
  } else {
    el.style.outline = "";
    el.style.backgroundColor = "";
  }
}

// CAPTCHA cua VAHAN co 6 ky tu!
// Ho tro: go du 6 ky tu (co delay 800ms) HOAC bam phim Enter ngay trong o CAPTCHA
function waitForCaptchaInput(expectedLength = 6, timeoutMs = 300000) {
  return new Promise((resolve, reject) => {
    const el = document.querySelector("#externalCaptcha");
    const startTime = Date.now();
    let delayTimer = null;

    const cleanup = () => {
      if (timer) clearInterval(timer);
      if (delayTimer) clearTimeout(delayTimer);
      if (el) el.removeEventListener("keydown", onEnter);
      highlightCaptcha(false);
    };

    const onEnter = (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        const val = el?.value?.trim() || "";
        if (val.length >= 5) {
          cleanup();
          resolve(val);
        }
      }
    };

    if (el) {
      el.addEventListener("keydown", onEnter);
    }

    const timer = setInterval(() => {
      const currentVal = el ? el.value.trim() : "";

      // Neu da go du 6 ky tu, cho 800ms de phong truong hop sua/go tiep
      if (currentVal.length >= expectedLength) {
        if (!delayTimer) {
          delayTimer = setTimeout(() => {
            const finalVal = el ? el.value.trim() : "";
            if (finalVal.length >= expectedLength) {
              cleanup();
              resolve(finalVal);
            } else {
              delayTimer = null;
            }
          }, 800);
        }
      } else {
        if (delayTimer) {
          clearTimeout(delayTimer);
          delayTimer = null;
        }
      }

      if (Date.now() - startTime > timeoutMs) {
        cleanup();
        reject(new Error("Quá thời gian chờ nhập CAPTCHA (5 phút)."));
      }
    }, 300);
  });
}

function clickApply() {
  const btn = document.querySelector("#applyTrigger");
  if (!btn) throw new Error("Không tìm thấy nút Apply (#applyTrigger)");
  btn.scrollIntoView({ behavior: "smooth", block: "center" });
  btn.click();
}

function waitForDownloadButton(timeoutMs = 60000) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    const timer = setInterval(() => {
      // Kiem tra neu trang bao loi Invalid CAPTCHA — trang KHONG reload, filter
      // van giu nguyen, chi captcha bi xoa trang (xac nhan trong poc_vahan.py)
      const bodyText = document.body.innerText || "";
      if (bodyText.includes("Invalid CAPTCHA") || bodyText.includes("invalid captcha")) {
        clearInterval(timer);
        reject(new Error("INVALID_CAPTCHA"));
        return;
      }

      const btn = document.querySelector("#downloadBtn1");
      if (
        btn &&
        (btn.offsetParent !== null ||
          window.getComputedStyle(btn).display !== "none")
      ) {
        clearInterval(timer);
        resolve(btn);
        return;
      }
      if (Date.now() - startTime > timeoutMs) {
        clearInterval(timer);
        reject(new Error("Bảng dữ liệu chưa render xong sau 60s."));
      }
    }, 600);
  });
}

function armDownloadConfirmation() {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ action: "EXPECT_DOWNLOAD" }, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(`Không thể theo dõi download: ${chrome.runtime.lastError.message}`));
        return;
      }
      if (!response?.armed) {
        reject(new Error("Browser không xác nhận được cơ chế theo dõi download."));
        return;
      }
      resolve(true);
    });
  });
}

function waitForDownloadConfirmation(timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    let timer;
    const onMessage = (request) => {
      if (request.action !== "DOWNLOAD_CONFIRMED") return;
      cleanup();
      resolve(request);
    };
    const cleanup = () => {
      if (timer) clearTimeout(timer);
      chrome.runtime.onMessage.removeListener(onMessage);
    };

    chrome.runtime.onMessage.addListener(onMessage);
    timer = setTimeout(() => {
      cleanup();
      reject(new Error("Browser chưa xác nhận file Excel được tải xuống sau 30 giây."));
    }, timeoutMs);
  });
}

// ==========================================
// 2. IN-PAGE FLOATING WIDGET UI
// ==========================================

function injectFloatingWidget() {
  if (document.getElementById("vahan-rpa-root")) return;

  const root = document.createElement("div");
  root.id = "vahan-rpa-root";
  root.innerHTML = `
    <div id="vahan-rpa-card" style="
      position: fixed;
      bottom: 24px;
      right: 24px;
      width: 320px;
      background: #ffffff;
      border-radius: 12px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.22);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      z-index: 9999999;
      border: 1px solid #e1e4e8;
      overflow: hidden;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    ">
      <div style="
        background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%);
        color: white;
        padding: 12px 16px;
        display: flex;
        justify-content: space-between;
        align-items: center;
      ">
        <div style="font-weight: 700; font-size: 14px; display: flex; align-items: center; gap: 6px;">
          <span>🤖</span> VAHAN RPA Tool
        </div>
        <button id="vahan-btn-toggle" style="
          background: rgba(255,255,255,0.2);
          border: none;
          color: white;
          width: 24px;
          height: 24px;
          border-radius: 50%;
          cursor: pointer;
          font-size: 14px;
          line-height: 1;
        ">−</button>
      </div>

      <div id="vahan-body" style="padding: 14px 16px;">
        <div id="vahan-badge" style="
          display: inline-block;
          font-size: 11px;
          font-weight: 600;
          color: #0366d6;
          background: #f1f8ff;
          padding: 3px 8px;
          border-radius: 12px;
          margin-bottom: 12px;
          border: 1px solid #c8e1ff;
        ">Sẵn sàng</div>

        <div style="font-size: 12px; display: flex; flex-direction: column; gap: 8px; margin-bottom: 14px;">
          <div id="step-cat" style="color: #666; display: flex; align-items: center; gap: 8px;">
            <span class="icon">⚪</span> <span>1. Category Group: Two Wheeler</span>
          </div>
          <div id="step-fuel" style="color: #666; display: flex; align-items: center; gap: 8px;">
            <span class="icon">⚪</span> <span>2. Fuel: All</span>
          </div>
          <div id="step-axis" style="color: #666; display: flex; align-items: center; gap: 8px;">
            <span class="icon">⚪</span> <span>3. Y-Axis: Fuel / X-Axis: Vehicle Category Group</span>
          </div>
          <div id="step-captcha" style="color: #666; display: flex; align-items: center; gap: 8px;">
            <span class="icon">⚪</span> <span>4. Nhập CAPTCHA (6 ký tự)</span>
          </div>
          <div id="step-apply" style="color: #666; display: flex; align-items: center; gap: 8px;">
            <span class="icon">⚪</span> <span>5. Bấm Apply Filters</span>
          </div>
          <div id="step-dl" style="color: #666; display: flex; align-items: center; gap: 8px;">
            <span class="icon">⚪</span> <span>6. Tải file Excel</span>
          </div>
        </div>

        <button id="vahan-btn-start" style="
          width: 100%;
          background: #2ea44f;
          color: white;
          border: none;
          padding: 10px;
          border-radius: 6px;
          font-weight: 600;
          font-size: 13px;
          cursor: pointer;
          transition: background 0.2s;
        ">▶ Chạy Tự Động Flow Demo</button>

        <div id="vahan-status-msg" style="
          margin-top: 10px;
          font-size: 11px;
          color: #586069;
          min-height: 20px;
          line-height: 1.4;
        ">Nhấn nút trên để bắt đầu quy trình tự động.</div>
      </div>
    </div>
  `;
  document.body.appendChild(root);

  let isMin = false;
  const toggleBtn = document.getElementById("vahan-btn-toggle");
  const bodyEl = document.getElementById("vahan-body");
  toggleBtn.onclick = () => {
    isMin = !isMin;
    bodyEl.style.display = isMin ? "none" : "block";
    toggleBtn.textContent = isMin ? "+" : "−";
  };

  document.getElementById("vahan-btn-start").onclick = () => {
    runFullAutomationFlow();
  };
}

// ==========================================
// 3. STEP PROGRESS UI CONTROLLER
// ==========================================

function updateStepStatus(stepId, state, text) {
  const el = document.getElementById(stepId);
  if (!el) return;

  const iconEl = el.querySelector(".icon");
  const msgEl = document.getElementById("vahan-status-msg");
  const badgeEl = document.getElementById("vahan-badge");

  if (state === "running") {
    iconEl.textContent = "⏳";
    el.style.color = "#005cc5";
    el.style.fontWeight = "600";
    if (text && msgEl) msgEl.textContent = text;
    if (badgeEl) {
      badgeEl.textContent = "Đang xử lý...";
      badgeEl.style.color = "#b08800";
      badgeEl.style.background = "#fffbdd";
      badgeEl.style.borderColor = "#fff5b1";
    }
  } else if (state === "waiting") {
    iconEl.textContent = "👉";
    el.style.color = "#d93f0b";
    el.style.fontWeight = "bold";
    if (text && msgEl) msgEl.textContent = text;
    if (badgeEl) {
      badgeEl.textContent = "Chờ nhập CAPTCHA (6 ký tự)";
      badgeEl.style.color = "#b08800";
      badgeEl.style.background = "#fffbdd";
      badgeEl.style.borderColor = "#fff5b1";
    }
  } else if (state === "done") {
    iconEl.textContent = "✅";
    el.style.color = "#22863a";
    el.style.fontWeight = "normal";
  } else if (state === "error") {
    iconEl.textContent = "❌";
    el.style.color = "#cb2431";
    el.style.fontWeight = "bold";
    if (text && msgEl) msgEl.textContent = text;
    if (badgeEl) {
      badgeEl.textContent = "Cần gõ lại CAPTCHA";
      badgeEl.style.color = "#cb2431";
      badgeEl.style.background = "#ffeef0";
      badgeEl.style.borderColor = "#ffdce0";
    }
  }
}

// ==========================================
// 4. MAIN FLOW EXECUTOR
//
// Bám đúng thứ tự đã verify trong poc_vahan.py::apply_filters()/run_once():
//   Category -> Fuel(All) -> Y-Axis(set+click) -> X-Axis(set) -> CAPTCHA(attended,
//   loop retry) -> Apply -> [RELOAD TRANG] -> chờ #downloadBtn1 render -> bấm tải.
//
// Vì Apply = form.submit() thật (xem ghi chú ở đầu file), hàm này KHÔNG chạy
// end-to-end trong một lần thực thi JS. Nó dừng lại ngay sau khi persist state +
// click Apply; phần "chờ bảng render -> bấm Download" chạy ở resumeAfterApply(),
// được init() gọi tự động ở LẦN TIÊM SCRIPT KẾ TIẾP (sau khi trang reload).
// ==========================================

function setUiBusy(isBusy) {
  const startBtn = document.getElementById("vahan-btn-start");
  if (!startBtn) return;
  // UI drift is fail-closed: cleanup in a catch/finally block must not
  // re-enable automation after the page contract has been invalidated.
  if (!isBusy && startBtn.dataset.uiDrift === "true") return;
  startBtn.disabled = isBusy;
  startBtn.style.opacity = isBusy ? "0.6" : "1";
  startBtn.style.cursor = isBusy ? "not-allowed" : "pointer";
}

function showFinalError(err) {
  if (err instanceof UiDriftError || err?.code?.startsWith("UI_DRIFT")) {
    showUiDriftError(err);
    return;
  }
  console.error("[VAHAN RPA ERROR]", err);
  const msgEl = document.getElementById("vahan-status-msg");
  const badgeEl = document.getElementById("vahan-badge");
  if (msgEl) msgEl.textContent = `❌ ${err.message}`;
  if (badgeEl) badgeEl.textContent = "Thất bại";
  const startBtn = document.getElementById("vahan-btn-start");
  if (startBtn) startBtn.textContent = "🔄 Chạy Lại Quy Trình";
}

function showUiDriftError(err) {
  console.error("[VAHAN RPA UI DRIFT]", err);
  const msgEl = document.getElementById("vahan-status-msg");
  const badgeEl = document.getElementById("vahan-badge");
  if (msgEl) {
    msgEl.textContent =
      `⚠️ Giao diện VAHAN đã thay đổi tại bước ${err.step || "preflight"}. ` +
      `Tool đã dừng để tránh chọn sai dữ liệu. Mã: ${err.code || "UI_DRIFT"}.`;
  }
  if (badgeEl) {
    badgeEl.textContent = "Cần cập nhật tool";
    badgeEl.style.color = "#9f1239";
    badgeEl.style.background = "#fff1f2";
    badgeEl.style.borderColor = "#fecdd3";
  }
  const startBtn = document.getElementById("vahan-btn-start");
  if (startBtn) {
    startBtn.dataset.uiDrift = "true";
    startBtn.disabled = true;
    startBtn.textContent = "⛔ Giao diện chưa được hỗ trợ";
    startBtn.style.opacity = "0.6";
    startBtn.style.cursor = "not-allowed";
  }
}

function showFinalSuccess() {
  const msgEl = document.getElementById("vahan-status-msg");
  const badgeEl = document.getElementById("vahan-badge");
  if (msgEl) msgEl.textContent = "🎉 Hoàn tất 100%! File Excel đã tải về.";
  if (badgeEl) {
    badgeEl.textContent = "Thành công!";
    badgeEl.style.color = "#22863a";
    badgeEl.style.background = "#dcffe4";
    badgeEl.style.borderColor = "#bef5cb";
  }
  const startBtn = document.getElementById("vahan-btn-start");
  if (startBtn) startBtn.textContent = "🔄 Chạy Lại Quy Trình";
}

// Chờ người gõ CAPTCHA, rồi PERSIST state TRƯỚC KHI click Apply (bắt buộc — click
// gây navigate ngay, code sau clickApply() có thể không bao giờ chạy tới, nên phải
// đảm bảo storage đã ghi xong trước khi bấm, không phải sau).
async function waitCaptchaThenApply(attempts, expectedUiSignature = null) {
  updateStepStatus(
    "step-captcha",
    "waiting",
    "👉 Hãy gõ đủ 6 ký tự CAPTCHA (hoặc bấm Enter sau khi gõ xong)..."
  );
  highlightCaptcha(true);
  await waitForCaptchaInput(6);
  updateStepStatus("step-captcha", "done");

  updateStepStatus("step-apply", "running", "Đã nhận diện CAPTCHA! Đang gửi Apply (trang sẽ tải lại)...");
  const contract = await waitForUiContract("before-apply", expectedUiSignature);
  await setFlowState({
    status: "AWAITING_RESULT",
    attempts,
    uiContract: contract,
    startedAt: Date.now(),
  });
  clickApply();
  // KHÔNG viết thêm code phụ thuộc kết quả ở đây — trang đang navigate.
}

// Chạy 1 lần duy nhất khi người dùng bấm nút Start: chọn filter rồi vào vòng
// CAPTCHA/Apply đầu tiên.
async function runFullAutomationFlow() {
  setUiBusy(true);
  try {
    const contract = await waitForUiContract("preflight");

    // Bước 1: Category Group
    updateStepStatus("step-cat", "running", "Đang chọn Category Group: Two Wheeler...");
    await selectCheckboxOption("vehicleCategoryGroup", "TWO WHEELER", "Category Group");
    updateStepStatus("step-cat", "done");

    // Bước 2: Fuel = All (mục 0.1 đã chốt "All", KHÔNG phải PETROL — xem ghi chú đầu file)
    updateStepStatus("step-fuel", "running", "Đang chọn Fuel: All...");
    await selectAllCheckbox("vehicleFuel", "Fuel");
    updateStepStatus("step-fuel", "done");

    // Bước 3: Y-Axis / X-Axis — <select> gốc, KHÔNG phải widget multiselect.
    // X-Axis chỉ được populate khi #yAxis nhận event "click" (không phải "change").
    updateStepStatus("step-axis", "running", "Đang set Y-Axis: Fuel...");
    const yAxisEl = setNativeSelectByLabel("#yAxis", "Fuel");
    yAxisEl.dispatchEvent(new Event("click", { bubbles: true }));
    await waitForCondition(() =>
      Array.from(document.querySelectorAll("#xAxis option")).some((option) =>
        normalizeText(option.label || option.textContent) === "vehicle category group"
      ), 5000
    );
    updateStepStatus("step-axis", "running", "Đang set X-Axis: Vehicle Category Group...");
    setNativeSelectByLabel("#xAxis", "Vehicle Category Group");
    const yAxisHidden = document.querySelector("#yAxis_hidden");
    const xAxisHidden = document.querySelector("#xAxis_hidden");
    if (
      !yAxisHidden ||
      !xAxisHidden ||
      yAxisHidden.value !== "vehicleFuel" ||
      xAxisHidden.value !== "vehicleCategoryGroup"
    ) {
      throw new UiDriftError(
        "UI_DRIFT_AXIS_NOT_SYNCED",
        "Y-Axis/X-Axis hiển thị đã chọn nhưng field gửi lên server không đồng bộ.",
        "axis",
        {
          yAxisHidden: yAxisHidden?.value || null,
          xAxisHidden: xAxisHidden?.value || null,
        }
      );
    }
    updateStepStatus("step-axis", "done");

    // Vào vòng CAPTCHA/Apply đầu tiên — sau đây trang sẽ reload, phần còn lại
    // (chờ bảng + bấm Download, hoặc gõ lại CAPTCHA nếu sai) chạy ở
    // resumeAfterApply() khi content script được tiêm lại trên trang mới.
    await waitCaptchaThenApply(1, contract.signature);
  } catch (err) {
    await setFlowState(null);
    showFinalError(err);
    setUiBusy(false);
  }
}

// ==========================================
// 5. RESUME SAU KHI TRANG RELOAD (do Apply gây ra)
//
// Được init() gọi tự động ở MỖI LẦN TIÊM SCRIPT, nếu storage cho biết lần tiêm
// trước đã click Apply và đang chờ kết quả. Đây là cơ chế "sống sót qua reload"
// thay cho vòng lặp while trong 1 lần thực thi JS (không dùng được vì Apply =
// navigate thật, không phải AJAX — xem ghi chú đầu file).
// ==========================================

async function resumeAfterApply(state) {
  setUiBusy(true);
  if (!state.uiContract?.signature) {
    const err = new UiDriftError(
      "UI_DRIFT_STALE_FLOW_STATE",
      "Flow cũ không có thông tin UI contract; không tiếp tục tự động.",
      "resume"
    );
    await setFlowState(null);
    showFinalError(err);
    setUiBusy(false);
    return;
  }
  try {
    await waitForUiContract("post-apply", state.uiContract.signature);
  } catch (err) {
    await setFlowState(null);
    showFinalError(err);
    setUiBusy(false);
    return;
  }

  // Cả 3 bước filter (Category/Fuel/Axis) đã set ở lần tiêm trước và được server
  // echo lại nguyên trạng trên trang mới (xác nhận trong poc_vahan.py) — không
  // cần chọn lại, chỉ cập nhật UI cho khớp thực tế.
  updateStepStatus("step-cat", "done");
  updateStepStatus("step-fuel", "done");
  updateStepStatus("step-axis", "done");
  updateStepStatus("step-captcha", "done");
  updateStepStatus("step-apply", "done");
  const msgEl = document.getElementById("vahan-status-msg");
  if (msgEl) msgEl.textContent = "Trang vừa tải lại sau khi gửi Apply — đang kiểm tra kết quả...";

  const bodyText = document.body.innerText || "";
  if (bodyText.includes("Invalid CAPTCHA") || bodyText.includes("invalid captcha")) {
    await setFlowState(null);
    if (state.attempts >= MAX_CAPTCHA_ATTEMPTS) {
      showFinalError(
        new Error(`CAPTCHA sai ${MAX_CAPTCHA_ATTEMPTS} lần liên tiếp — dừng, không đoán mò thêm. Bấm nút Start để thử lại từ đầu.`)
      );
      setUiBusy(false);
      return;
    }
    updateStepStatus("step-captcha", "error", "⚠️ CAPTCHA bị sai! Trang đã tải lại với CAPTCHA mới, vui lòng gõ lại.");
    try {
      await waitCaptchaThenApply(state.attempts + 1, state.uiContract?.signature || null);
    } catch (err) {
      await setFlowState(null);
      showFinalError(err);
      setUiBusy(false);
    }
    return;
  }

  updateStepStatus("step-dl", "running", "CAPTCHA đúng — đang chờ bảng dữ liệu render...");
  try {
    const downloadBtn = await waitForDownloadButton(30000);
    updateStepStatus("step-dl", "running", "Bảng đã hiển thị, đang bấm tải Excel...");
    await sleep(600);
    await armDownloadConfirmation();
    const downloadConfirmation = waitForDownloadConfirmation(30000);
    downloadBtn.click();
    await downloadConfirmation;
    updateStepStatus("step-dl", "done");
    await setFlowState(null);
    showFinalSuccess();
  } catch (e) {
    await setFlowState(null);
    showFinalError(e);
  } finally {
    setUiBusy(false);
  }
}

// ==========================================
// 6. MESSAGE LISTENER & INIT
// ==========================================

chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
  if (req.action === "START_FLOW") {
    runFullAutomationFlow();
    sendResponse({ status: "STARTED" });
  }
});

async function init() {
  if (!isSupportedReportPage()) return;
  injectFloatingWidget();
  try {
    await waitForUiContract("preflight");
    const state = await getFlowState();
    if (state && state.status === "AWAITING_RESULT") {
      await resumeAfterApply(state);
    }
  } catch (err) {
    await setFlowState(null);
    showFinalError(err);
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
