const fieldIds = [
  "archivedFlags", "period", "financialYears", "reportYear", "reportMonth",
  "fromYear", "toYear", "fromDate", "toDate", "states", "rtos",
  "emissions", "makers", "categoryGroups", "subCategories", "classes",
  "fuels", "evTypes", "statuses", "ownerTypes", "vehicleType", "fitness",
  "delhiNcr", "yAxis", "xAxis", "autoExport", "autoApply",
];

const dropdowns = {
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
};

const status = document.querySelector("#status");
const fillButton = document.querySelector("#fill");
const runnerConnection = document.querySelector("#runnerConnection");
const runnerServerUrl = document.querySelector("#runnerServerUrl");
const runnerName = document.querySelector("#runnerName");
const runnerToken = document.querySelector("#runnerToken");
const saveRunnerConfigButton = document.querySelector("#saveRunnerConfig");
const authGuard = document.querySelector("#authGuard");
const authGuardMessage = document.querySelector("#authGuardMessage");
const clearAuthHoldButton = document.querySelector("#clearAuthHold");
let activeTabId;
let activeTabUrl = "";
let authHoldActive = false;

function isSupportedReportUrl(value) {
  try {
    const url = new URL(String(value || ""));
    return url.protocol === "https:"
      && url.hostname === "analytics.parivahan.gov.in"
      && url.pathname.includes("/analytics/vahanpublicreport");
  } catch {
    return false;
  }
}

function renderRunnerConnection(connection = {}) {
  const labels = {
    connected: "Backend đã kết nối",
    connecting: "Đang kết nối backend...",
    disconnected: "Backend đã ngắt kết nối",
    error: "Không thể kết nối backend",
  };
  runnerConnection.dataset.state = connection.status || "disconnected";
  runnerConnection.querySelector(".connection-text").textContent =
    labels[connection.status] || labels.disconnected;
  runnerConnection.title = connection.detail || "";
}

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === "RUNNER_CONNECTION_CHANGED") {
    renderRunnerConnection(message.connection);
  }
  if (message?.type === "VAHAN_AUTH_REQUIRED") renderAuthHold(message.authHold);
  if (message?.type === "VAHAN_AUTH_CLEARED") renderAuthHold(null);
});

function renderAuthHold(hold) {
  authHoldActive = Boolean(hold?.code === "VAHAN_AUTH_REQUIRED");
  authGuard.hidden = !authHoldActive;
  fillButton.disabled = authHoldActive;
  if (!authHoldActive) {
    authGuardMessage.textContent = "";
    return;
  }
  const retryAfter = hold.retryAfter ? new Date(hold.retryAfter).toLocaleString() : "sau khi xác nhận";
  authGuardMessage.textContent = `Chrome đã nhận 401/HTTP Basic Auth từ analytics.parivahan.gov.in. `
    + `Extension đã dừng retry. Hãy đóng hộp thoại đăng nhập, chờ đến ${retryAfter} `
    + `và kiểm tra trang chính thức trước khi chạy lại.`;
  status.className = "error";
  status.textContent = "Đang tạm dừng để tránh gửi thêm request đến VAHAN.";
}

async function loadAuthHold() {
  const response = await new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: "GET_VAHAN_AUTH_HOLD" }, resolve);
  });
  if (response?.ok) renderAuthHold(response.authHold);
  return response?.authHold || null;
}

clearAuthHoldButton.addEventListener("click", async () => {
  clearAuthHoldButton.disabled = true;
  try {
    const response = await new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: "CLEAR_VAHAN_AUTH_HOLD" }, resolve);
    });
    if (!response?.ok) throw new Error(response?.error || "Không thể xóa trạng thái tạm dừng.");
    renderAuthHold(null);
    status.className = "";
    status.textContent = "Đã xóa tạm dừng. Hãy tải lại trang VAHAN thủ công rồi mới chạy test.";
  } catch (error) {
    status.className = "error";
    status.textContent = error.message;
  } finally {
    clearAuthHoldButton.disabled = false;
  }
});

async function initializeRunnerConfig() {
  const { runnerConfig = {} } = await chrome.storage.local.get("runnerConfig");
  runnerServerUrl.value = runnerConfig.serverUrl || "http://127.0.0.1:8000";
  runnerName.value = runnerConfig.runnerName || "VAHAN Chrome";
  runnerToken.value = runnerConfig.token || "change-me";
}

saveRunnerConfigButton.addEventListener("click", async () => {
  const serverUrl = runnerServerUrl.value.trim().replace(/\/$/, "");
  if (!/^https?:\/\//i.test(serverUrl)) {
    renderRunnerConnection({ status: "error", detail: "Server URL phải bắt đầu bằng http:// hoặc https://" });
    return;
  }
  const { runnerConfig = {} } = await chrome.storage.local.get("runnerConfig");
  await chrome.storage.local.set({
    runnerConfig: {
      ...runnerConfig,
      serverUrl,
      runnerName: runnerName.value.trim() || "VAHAN Chrome",
      token: runnerToken.value,
    },
  });
  renderRunnerConnection({ status: "connecting", detail: "Đang kết nối lại backend..." });
});

function selectedLabels(element) {
  if (element.tagName === "SELECT") {
    return [...element.selectedOptions]
      .filter((option) => option.value !== "")
      .map((option) => option.textContent.trim())
      .filter(Boolean)
      .join(",");
  }
  return element.type === "checkbox" ? element.checked : element.value.trim();
}

function populateSelect(select, labels, selectedCsv = "") {
  const selected = selectedCsv.split(",").map((item) => item.trim().toLocaleLowerCase()).filter(Boolean);
  select.replaceChildren();
  if (!select.multiple) select.add(new Option("--- Select ---", ""));
  for (const label of labels) {
    const option = new Option(label, label);
    option.selected = selected.includes(label.toLocaleLowerCase());
    select.add(option);
  }
  select.dispatchEvent(new Event("optionsupdated"));
}

function enhanceMultiSelect(select) {
  if (!select.multiple) return;
  select.hidden = true;
  const control = document.createElement("div");
  control.className = "multi-control";
  const tools = document.createElement("div");
  tools.className = "select-tools";

  const search = document.createElement("input");
  search.type = "search";
  search.className = "option-search";
  search.placeholder = "Search...";
  search.setAttribute("aria-label", `Search ${select.id}`);

  const allLabel = document.createElement("label");
  allLabel.className = "select-all";
  const all = document.createElement("input");
  all.type = "checkbox";
  allLabel.append(all, document.createTextNode(" Select All"));
  tools.append(search, allLabel);
  const optionList = document.createElement("div");
  optionList.className = "option-list";
  control.append(tools, optionList);
  select.before(control);

  const refreshAllState = () => {
    const visible = [...optionList.querySelectorAll(".option-item")].filter((item) => !item.hidden);
    const selectedCount = visible.filter((item) => item.querySelector("input").checked).length;
    all.checked = visible.length > 0 && selectedCount === visible.length;
    all.indeterminate = selectedCount > 0 && selectedCount < visible.length;
  };

  const renderOptions = () => {
    optionList.replaceChildren();
    for (const option of select.options) {
      const item = document.createElement("div");
      item.className = "option-item";
      item.dataset.search = option.textContent.toLocaleLowerCase();
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = option.selected;
      checkbox.disabled = option.disabled;
      const text = document.createElement("span");
      text.textContent = option.textContent;
      item.append(checkbox, text);
      item.addEventListener("click", (event) => {
        if (event.target !== checkbox) checkbox.checked = !checkbox.checked;
        option.selected = checkbox.checked;
        select.dispatchEvent(new Event("change", { bubbles: true }));
      });
      checkbox.addEventListener("click", (event) => event.stopPropagation());
      checkbox.addEventListener("change", () => {
        option.selected = checkbox.checked;
        select.dispatchEvent(new Event("change", { bubbles: true }));
      });
      optionList.append(item);
    }
    refreshAllState();
  };

  search.addEventListener("input", () => {
    const term = search.value.trim().toLocaleLowerCase();
    for (const item of optionList.querySelectorAll(".option-item")) {
      item.hidden = Boolean(term) && !item.dataset.search.includes(term);
    }
    refreshAllState();
  });

  all.addEventListener("change", () => {
    for (const item of optionList.querySelectorAll(".option-item")) {
      if (item.hidden) continue;
      const checkbox = item.querySelector("input");
      if (checkbox.disabled) continue;
      checkbox.checked = all.checked;
      const index = [...optionList.children].indexOf(item);
      select.options[index].selected = all.checked;
    }
    select.dispatchEvent(new Event("change", { bubbles: true }));
    refreshAllState();
  });

  select.addEventListener("change", () => {
    [...optionList.querySelectorAll("input")].forEach((checkbox, index) => {
      checkbox.checked = select.options[index]?.selected ?? false;
    });
    refreshAllState();
  });
  select.addEventListener("optionsupdated", () => {
    search.value = "";
    renderOptions();
  });
  renderOptions();
}

function replaceWithSelect(id, definition, labels, selectedValue) {
  const oldElement = document.getElementById(id);
  const oldLabel = oldElement.closest("label");
  const select = document.createElement("select");
  select.id = id;
  select.multiple = Boolean(definition.multiple);
  if (select.multiple) select.size = Math.min(3, Math.max(2, labels.length));
  populateSelect(select, labels, selectedValue ?? oldElement.value);
  if (oldLabel && oldLabel.parentElement) {
    const field = document.createElement("div");
    field.className = "field";
    const title = document.createElement("span");
    title.className = "field-title";
    title.textContent = [...oldLabel.childNodes]
      .filter((node) => node.nodeType === Node.TEXT_NODE)
      .map((node) => node.textContent.trim())
      .filter(Boolean)
      .join(" ");
    field.append(title, select);
    oldLabel.replaceWith(field);
  } else {
    oldElement.replaceWith(select);
  }
  enhanceMultiSelect(select);
  return select;
}

async function message(payload) {
  if (!activeTabId) throw new Error("Không tìm thấy tab VAHAN chính thức.");
  if (activeTabUrl && !isSupportedReportUrl(activeTabUrl)) {
    throw new Error(
      "Hãy chuyển sang tab VAHAN chính thức tại /analytics/vahanpublicreport rồi mở lại extension.",
    );
  }
  return chrome.tabs.sendMessage(activeTabId, payload);
}

async function initializeDynamicFields() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  activeTabId = tab?.id;
  activeTabUrl = tab?.url || "";
  if (!isSupportedReportUrl(activeTabUrl)) {
    throw new Error(
      "Extension chỉ hoạt động trên trang VAHAN chính thức /analytics/vahanpublicreport.",
    );
  }
  const { vahanConfig = {} } = await chrome.storage.local.get("vahanConfig");
  const response = await message({ type: "GET_VAHAN_OPTIONS", selectors: dropdowns });
  if (!response?.ok) throw new Error(response?.error || "Không thể tải danh sách lựa chọn từ VAHAN.");

  const desiredValues = {};
  for (const [id, definition] of Object.entries(dropdowns)) {
    desiredValues[id] = vahanConfig[id] ?? document.getElementById(id).value;
    replaceWithSelect(id, definition, response.options[id] || [], desiredValues[id]);
  }

  for (const id of ["fromYear", "toYear", "fromDate", "toDate", "makers"]) {
    if (vahanConfig[id] !== undefined) document.getElementById(id).value = vahanConfig[id];
  }
  document.getElementById("autoExport").checked = vahanConfig.autoExport ?? true;
  document.getElementById("autoApply").checked = vahanConfig.autoApply ?? false;

  document.getElementById("delhiNcr").addEventListener("change", async () => {
    await refreshStates();
    await saveConfig();
  });
  document.getElementById("states").addEventListener("change", async () => {
    await refreshRtos();
    await saveConfig();
  });
  document.getElementById("yAxis").addEventListener("change", async () => {
    await refreshXAxis();
    await saveConfig();
  });
  await refreshStates(desiredValues.states, desiredValues.rtos);
  await refreshXAxis(desiredValues.xAxis);
  setupMakerAutocomplete(vahanConfig.makers || document.getElementById("makers").value);
  setupAutoSave();
}

function collectConfig() {
  return Object.fromEntries(
    fieldIds.map((id) => [id, selectedLabels(document.getElementById(id))]),
  );
}

async function saveConfig() {
  await chrome.storage.local.set({ vahanConfig: collectConfig() });
}

function setupAutoSave() {
  for (const id of fieldIds) {
    const element = document.getElementById(id);
    element.addEventListener("change", saveConfig);
    if (element.tagName === "INPUT" && element.type !== "checkbox") {
      element.addEventListener("input", saveConfig);
    }
  }
}

async function refreshRtos(selectedValue = "") {
  const stateLabels = selectedLabels(document.getElementById("states"));
  const response = await message({ type: "GET_RTO_OPTIONS", stateLabels });
  if (response?.ok) populateSelect(document.getElementById("rtos"), response.options, selectedValue);
}

async function refreshStates(selectedState = "", selectedRto = "") {
  const delhiNcr = selectedLabels(document.getElementById("delhiNcr"));
  const response = await message({ type: "GET_STATE_OPTIONS", delhiNcr });
  if (!response?.ok) return;
  populateSelect(document.getElementById("states"), response.options, selectedState);
  populateSelect(document.getElementById("rtos"), [], "");
  await refreshRtos(selectedRto);
}

async function refreshXAxis(selectedValue = "") {
  const yAxis = selectedLabels(document.getElementById("yAxis"));
  const response = await message({ type: "GET_X_AXIS_OPTIONS", yAxis });
  if (response?.ok) populateSelect(document.getElementById("xAxis"), response.options, selectedValue);
}

function setupMakerAutocomplete(initialValue) {
  const input = document.getElementById("makers");
  input.type = "hidden";
  const picker = document.createElement("div");
  picker.className = "maker-picker";
  const chips = document.createElement("div");
  chips.className = "maker-chips";
  const searchInput = document.createElement("input");
  searchInput.type = "search";
  searchInput.placeholder = "Nhập ít nhất 2 ký tự để tìm...";
  const results = document.createElement("div");
  results.className = "maker-results";
  picker.append(chips, searchInput, results);
  input.after(picker);
  let selected = String(initialValue || "").split(",").map((item) => item.trim()).filter(Boolean);
  let timer;

  const sync = () => {
    input.value = selected.join(",");
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    chips.replaceChildren(...selected.map((maker) => {
      const chip = document.createElement("span");
      chip.className = "maker-chip";
      chip.append(document.createTextNode(maker));
      const remove = document.createElement("button");
      remove.type = "button";
      remove.textContent = "×";
      remove.title = `Bỏ ${maker}`;
      remove.addEventListener("click", () => {
        selected = selected.filter((item) => item !== maker);
        sync();
      });
      chip.append(remove);
      return chip;
    }));
  };

  searchInput.addEventListener("input", () => {
    clearTimeout(timer);
    const search = searchInput.value.trim();
    if (search.length < 2) {
      results.replaceChildren();
      return;
    }
    results.textContent = "Đang tìm...";
    timer = setTimeout(async () => {
      const response = await message({ type: "SEARCH_MAKERS", search });
      results.replaceChildren();
      if (!response?.ok) {
        results.textContent = response?.error || "Không tìm được Maker.";
        return;
      }
      const choices = response.options.filter((maker) => !selected.includes(maker));
      if (!choices.length) results.textContent = "Không có kết quả.";
      for (const maker of choices) {
        const option = document.createElement("button");
        option.type = "button";
        option.textContent = maker;
        option.addEventListener("click", () => {
          selected.push(maker);
          searchInput.value = "";
          results.replaceChildren();
          sync();
        });
        results.append(option);
      }
    }, 250);
  });
  sync();
}

document.addEventListener("DOMContentLoaded", async () => {
  await initializeRunnerConfig();
  const authHold = await loadAuthHold();
  if (authHold) return;
  chrome.runtime.sendMessage({ type: "GET_RUNNER_CONNECTION" }, (response) => {
    renderRunnerConnection(response?.connection);
  });
  try {
    await initializeDynamicFields();
    status.textContent = "Đã tải các lựa chọn từ VAHAN.";
  } catch (error) {
    status.className = "error";
    status.textContent = error.message.includes("Receiving end")
      ? "Tab chưa có content script. Hãy tải lại trang VAHAN, sau đó Reload extension nếu vừa đổi manifest."
      : error.message;
  }
});

fillButton.addEventListener("click", async () => {
  if (authHoldActive) return;
  status.className = "";
  status.textContent = "Đang điền bộ lọc...";
  fillButton.disabled = true;
  const config = collectConfig();
  try {
    await chrome.storage.local.set({ vahanConfig: config });
    const response = await message({ type: "FILL_VAHAN", config });
    if (!response?.ok) throw new Error(response?.error || "Không nhận được phản hồi từ trang VAHAN.");
    status.textContent = config.autoApply
      ? "Đã điền bộ lọc. Apply sẽ tự chạy sau khi bạn nhập đủ CAPTCHA."
      : "Đã điền bộ lọc. Hãy nhập CAPTCHA và bấm Apply.";
  } catch (error) {
    status.className = "error";
    status.textContent = error.message;
  } finally {
    fillButton.disabled = false;
  }
});
