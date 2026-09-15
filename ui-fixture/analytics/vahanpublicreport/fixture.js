/*
 * Local VAHAN public-report fixture.
 *
 * This is a deterministic, offline simulation of the current Indian VAHAN
 * Analytics page.  The option snapshot lives in fixture-data.js.  The fixture
 * models the DOM contract, dynamic state -> RTO loading, time-period
 * visibility, searchable multiselects, maker limits and Y/X-Axis branches.
 *
 * It intentionally does not copy the production backend or CAPTCHA validation.
 * Any six-character value is accepted by this local test page.
 *
 * Query-string scenarios make UI drift reproducible:
 *   ?lang=en&ui=baseline
 *   ?lang=en&ui=missing-fuel
 *   ?lang=en&ui=wrong-wrapper
 *   ?lang=en&ui=visual-only
 */
(() => {
  "use strict";

  const DATA = window.VAHAN_FIXTURE_DATA;
  if (!DATA) {
    console.error("[FIXTURE] Missing fixture-data.js");
    return;
  }

  const params = new URLSearchParams(window.location.search);
  const uiMode = params.get("ui") || "baseline";
  const devMode = params.get("dev") === "1";
  const MULTISELECTS = [
    ["archivedFlags", "Archived Flag"],
    ["financialYearSelect", "Financial Year"],
    ["stateName", "State"],
    ["rtoCode", "RTO"],
    ["vehicleEmission", "Emission"],
    ["vehicleMaker", "Maker"],
    ["vehicleCategoryGroup", "Category Group"],
    ["vehicleSubCategory", "Sub Category"],
    ["vehicleClass", "Class"],
    ["vehicleFuel", "Fuel"],
    ["evType", "EV Type"],
    ["vehicleStatus", "Status"],
    ["vehicleOwnerType", "Owner Type"],
  ];
  const widgetRegistry = new Map();

  const log = (message) => {
    const line = `[FIXTURE DEV] ${message}`;
    console.info(line);
    const target = document.getElementById("fixture-dev-log");
    if (target) target.textContent = `${line}\n${target.textContent}`.trim();
  };

  const normalize = (value) =>
    String(value || "").replace(/\s+/g, " ").trim().toLowerCase();

  const get = (id) => document.getElementById(id);

  function selectedLabels(select) {
    return Array.from(select?.options || [])
      .filter((option) => option.selected)
      .map((option) => option.textContent.trim());
  }

  function optionData(value, label, selected = false) {
    return { value: String(value ?? ""), label: String(label ?? ""), selected };
  }

  function populateSelect(id, options) {
    const select = get(id);
    if (!select) return;
    select.innerHTML = "";
    options.forEach((item) => {
      const option = new Option(
        item.label,
        item.value,
        Boolean(item.selected),
        Boolean(item.selected)
      );
      option.label = item.label;
      select.add(option);
    });
  }

  function populateAllOptions() {
    populateSelect("archivedFlags", DATA.archivedFlags);
    populateSelect("reportType", DATA.reportTypes);
    populateSelect("financialYearSelect", DATA.financialYears);
    populateSelect("reportYear", DATA.reportYears);
    populateSelect("reportMonth", DATA.months);
    populateSelect("stateName", DATA.states);
    populateSelect("vehicleEmission", DATA.emissions);
    populateSelect("vehicleMaker", DATA.makers);
    populateSelect("vehicleCategoryGroup", DATA.categoryGroups);
    populateSelect("vehicleSubCategory", DATA.subCategories);
    populateSelect("vehicleClass", DATA.classes);
    populateSelect("vehicleFuel", DATA.fuels);
    populateSelect("evType", DATA.evTypes);
    populateSelect("vehicleStatus", DATA.statuses);
    populateSelect("vehicleOwnerType", DATA.ownerTypes);
    populateSelect("vehicleType", DATA.vehicleTypes);
    populateSelect("fitnessCheck", DATA.fitnessChecks);
    populateSelect("delhiNcr", DATA.delhiNcr);
    populateSelect("yAxis", DATA.yAxis);
    populateSelect("xAxis", [optionData("", "--- Select X-Axis ---")]);
  }

  function removeOption(selectId, text) {
    const select = get(selectId);
    if (!select) return false;
    const option = Array.from(select.options).find((candidate) =>
      normalize(candidate.getAttribute("label") || candidate.textContent) === normalize(text)
    );
    if (!option) return false;
    option.remove();
    return true;
  }

  function applyStructuralScenario(mode) {
    const category = get("vehicleCategoryGroup");
    const fuel = get("vehicleFuel");
    const yAxis = get("yAxis");
    const apply = get("applyTrigger");

    switch (mode) {
      case "missing-fuel":
      case "renamed-fuel":
        fuel?.remove();
        break;
      case "wrong-type":
        category?.removeAttribute("multiple");
        break;
      case "wrong-label":
        removeOption("vehicleCategoryGroup", "Two Wheeler");
        break;
      case "missing-yaxis-option":
        removeOption("yAxis", "Fuel");
        break;
      case "missing-apply":
        apply?.remove();
        break;
      case "visual-only":
        document.body.classList.add("fixture-visual-only-change");
        break;
      default:
        break;
    }
  }

  function setMakerMessages() {
    const select = get("vehicleMaker");
    const selectedCount = select?.selectedOptions.length || 0;
    const clear = get("clearMaker");
    const limit = DATA.constraints.makerMax;
    if (clear) clear.hidden = selectedCount <= 1;
    const limitMessage = get("makerLimitMsg");
    if (limitMessage) {
      limitMessage.textContent = selectedCount >= limit
        ? `You can select maximum ${limit} makers.`
        : "";
    }
    const hidden = get("selectedMakers");
    if (hidden) hidden.value = Array.from(select?.selectedOptions || [])
      .map((option) => option.value)
      .join(",");
  }

  function showFieldError(id, message) {
    const element = get(id);
    if (element) element.textContent = message || "";
  }

  function buildMultiselect(selectId, label) {
    const select = get(selectId);
    if (!select || !select.multiple) return null;
    const existing = widgetRegistry.get(selectId);
    if (existing) return existing.wrapper;

    const control = select.closest(".field-control") || select.parentElement;
    const wrapper = document.createElement("div");
    wrapper.className = "multiselect-dropdown";
    wrapper.dataset.forSelect = selectId;
    wrapper.setAttribute("aria-label", label);

    const display = document.createElement("div");
    display.className = "multiselect-display";
    display.setAttribute("role", "button");
    display.setAttribute("tabindex", "0");
    display.setAttribute("aria-label", label);
    display.innerHTML = '<span class="summary"></span><span class="arrow">⌄</span>';

    const panel = document.createElement("div");
    panel.className = "multiselect-panel";
    panel.addEventListener("click", (event) => event.stopPropagation());

    const search = document.createElement("input");
    search.type = "search";
    search.className = "multiselect-dropdown-search";
    search.placeholder = "search";
    search.setAttribute("aria-label", `${label} search`);
    search.addEventListener("input", () => {
      const needle = normalize(search.value);
      panel.querySelectorAll(".multiselect-option").forEach((row) => {
        row.hidden = Boolean(needle) && !normalize(row.dataset.searchText).includes(needle);
      });
    });
    panel.appendChild(search);

    const allRow = document.createElement("div");
    allRow.className = "multiselect-dropdown-all-selector";
    const allCheckbox = document.createElement("input");
    allCheckbox.type = "checkbox";
    allCheckbox.setAttribute("aria-label", `${label} All`);
    const allText = document.createElement("span");
    allText.textContent = "All";
    allRow.append(allCheckbox, allText);
    if (select.hasAttribute("multiselect-select-all")) panel.appendChild(allRow);

    let optionRows = [];
    const updateSummary = () => {
      const selected = selectedLabels(select);
      const summary = display.querySelector(".summary");
      if (selected.length === select.options.length && selected.length > 0) {
        summary.textContent = "All";
      } else if (selected.length === 0) {
        summary.textContent = select.getAttribute("placeholder") || `--- Select ${label} ---`;
      } else {
        summary.textContent = selected.join(", ");
      }
      allCheckbox.checked =
        select.hasAttribute("multiselect-select-all") &&
        selected.length === select.options.length &&
        selected.length > 0;
      wrapper.classList.toggle("is-disabled", Boolean(select.disabled));
      const parent = select.closest(".disabled-dependent");
      if (parent) parent.classList.toggle("is-disabled", Boolean(select.disabled));
    };

    const syncNativeChange = () => {
      select.dispatchEvent(new Event("change", { bubbles: true }));
      updateSummary();
      if (selectId === "vehicleMaker") setMakerMessages();
    };

    const canSelectMore = (option, nextChecked) => {
      if (selectId !== "vehicleMaker" || !nextChecked || option.selected) return true;
      const selectedCount = select.selectedOptions.length;
      const limit = Number(select.getAttribute("multiselect-max-items")) || DATA.constraints.makerMax;
      if (selectedCount >= limit) {
        showFieldError("makerError", `You can select maximum ${limit} makers.`);
        setMakerMessages();
        return false;
      }
      showFieldError("makerError", "");
      return true;
    };

    const renderOptions = () => {
      optionRows.forEach(({ row }) => row.remove());
      optionRows = [];
      Array.from(select.options).forEach((option) => {
        const row = document.createElement("div");
        row.className = "multiselect-option";
        row.dataset.searchText = option.textContent.trim().toUpperCase();
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.checked = option.selected;
        checkbox.tabIndex = -1;
        checkbox.disabled = Boolean(select.disabled);
        const text = document.createElement("span");
        text.textContent = option.textContent.trim();
        row.append(checkbox, text);

        const setOption = (nextChecked) => {
          if (!canSelectMore(option, nextChecked)) {
            checkbox.checked = false;
            return;
          }
          checkbox.checked = nextChecked;
          option.selected = nextChecked;
          syncNativeChange();
        };
        row.addEventListener("click", (event) => {
          if (select.disabled) return;
          if (event.target !== checkbox) setOption(!checkbox.checked);
        });
        checkbox.addEventListener("click", (event) => event.stopPropagation());
        checkbox.addEventListener("change", () => setOption(checkbox.checked));
        optionRows.push({ row, checkbox, option });
        panel.appendChild(row);
      });
      updateSummary();
    };

    allCheckbox.addEventListener("change", () => {
      if (select.disabled) {
        allCheckbox.checked = false;
        return;
      }
      if (selectId === "vehicleMaker") return;
      Array.from(select.options).forEach((option) => {
        option.selected = allCheckbox.checked;
      });
      syncNativeChange();
      renderOptions();
    });

    display.addEventListener("click", () => {
      if (!select.disabled) wrapper.classList.toggle("open");
    });
    display.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        if (!select.disabled) wrapper.classList.toggle("open");
      }
    });
    document.addEventListener("click", (event) => {
      if (!wrapper.contains(event.target)) wrapper.classList.remove("open");
    });

    wrapper.append(display, panel);
    control.appendChild(wrapper);
    select.addEventListener("change", () => {
      optionRows.forEach(({ checkbox, option }) => {
        checkbox.checked = option.selected;
        checkbox.disabled = Boolean(select.disabled);
      });
      updateSummary();
      if (selectId === "vehicleMaker") setMakerMessages();
    });
    widgetRegistry.set(selectId, { wrapper, renderOptions, updateSummary });
    renderOptions();
    return wrapper;
  }

  function refreshMultiselect(selectId) {
    widgetRegistry.get(selectId)?.renderOptions();
  }

  function loadRtoOptions() {
    const state = get("stateName");
    const rto = get("rtoCode");
    const disableDropdown = get("disableDropdown");
    if (!state || !rto) return;

    const selectedStates = Array.from(state.selectedOptions).map((option) => option.value);
    const seen = new Set();
    const options = [];
    selectedStates.forEach((stateCode) => {
      (DATA.rtoByState[stateCode] || []).forEach((option) => {
        const key = `${option.value}:${option.label}`;
        if (seen.has(key)) return;
        seen.add(key);
        options.push(optionData(option.value, option.label));
      });
    });
    rto.innerHTML = "";
    options.forEach((option) => rto.add(new Option(option.label, option.value)));
    rto.disabled = options.length === 0;
    if (disableDropdown) {
      disableDropdown.style.pointerEvents = options.length ? "auto" : "none";
      disableDropdown.style.opacity = options.length ? "1" : "0.5";
    }
    refreshMultiselect("rtoCode");
    log(options.length
      ? `State ${selectedStates.join(", ")}: đã tải ${options.length} RTO từ snapshot.`
      : "Đã xóa State: RTO trở về trạng thái disabled.");
  }

  function setGroupVisibility(id, visible) {
    const group = get(id);
    if (group) group.style.display = visible ? "block" : "none";
  }

  function applyReportType() {
    const type = get("reportType")?.value || "0";
    setGroupVisibility("financialYearDropdown", type === "1");
    setGroupVisibility("calendarDatePicker", type === "0");
    setGroupVisibility("timePeriodPicker", type === "9");
    // The current live page keeps this group hidden for the four report types.
    setGroupVisibility("monthYearPicker", false);
    if (type === "9") {
      const from = get("fromDate");
      const to = get("toDate");
      if (from && !from.value) from.value = DATA.constraints.defaultFromDate;
      if (to) to.value = "31 Jan 2026";
    }
  }

  function parsePortalDate(value) {
    const match = String(value || "").trim().match(/^(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4})$/);
    if (!match) return Number.NaN;
    const monthNames = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
    const month = monthNames.indexOf(match[2].slice(0, 3).toLowerCase());
    if (month < 0) return Number.NaN;
    return Date.UTC(Number(match[3]), month, Number(match[1]));
  }

  function validateDateRanges() {
    const type = get("reportType")?.value || "0";
    showFieldError("dateError", "");
    showFieldError("timePeriodError", "");
    if (type === "0") {
      const from = get("fromYear")?.value.trim() || "";
      const to = get("toYear")?.value.trim() || "";
      const min = DATA.constraints.calendarYearMin;
      const max = DATA.constraints.calendarYearMax;
      if (!/^\d{4}$/.test(from) || !/^\d{4}$/.test(to)) {
        showFieldError("dateError", "Please select both FROM and TO year.");
        return false;
      }
      if (Number(from) < min || Number(to) > max || Number(from) > Number(to)) {
        showFieldError("dateError", `Year range must be between ${min} and ${max}.`);
        return false;
      }
    }
    if (type === "9") {
      const fromDate = parsePortalDate(get("fromDate")?.value);
      const toDate = parsePortalDate(get("toDate")?.value);
      if (!Number.isFinite(fromDate) || !Number.isFinite(toDate) || fromDate > toDate) {
        showFieldError("timePeriodError", "Please select a valid date range.");
        return false;
      }
    }
    return true;
  }

  function populateXAxis() {
    const yAxis = get("yAxis");
    const xAxis = get("xAxis");
    const yHidden = get("yAxis_hidden");
    const xHidden = get("xAxis_hidden");
    if (!yAxis || !xAxis) return;
    if (yHidden) yHidden.value = yAxis.value;
    const current = xAxis.value;
    xAxis.innerHTML = "";
    xAxis.add(new Option("--- Select X-Axis ---", ""));
    const options = DATA.xAxisByY[yAxis.value] || [];
    options.forEach((option) => xAxis.add(new Option(option.label, option.value)));
    if (options.some((option) => option.value === current)) xAxis.value = current;
    else xAxis.value = "";
    if (xHidden) xHidden.value = xAxis.value;
  }

  function installAxisBehavior() {
    const yAxis = get("yAxis");
    const xAxis = get("xAxis");
    yAxis?.addEventListener("click", populateXAxis);
    yAxis?.addEventListener("change", () => {
      populateXAxis();
      showFieldError("yAxisError", "");
    });
    xAxis?.addEventListener("change", () => {
      const hidden = get("xAxis_hidden");
      if (hidden) hidden.value = xAxis.value;
      showFieldError("xAxisError", "");
    });
    populateXAxis();
  }

  function installFilterDependencies() {
    get("stateName")?.addEventListener("change", loadRtoOptions);
    get("reportType")?.addEventListener("change", applyReportType);
    get("fromYear")?.addEventListener("input", () => showFieldError("dateError", ""));
    get("toYear")?.addEventListener("input", () => showFieldError("dateError", ""));
    get("fromDate")?.addEventListener("input", () => showFieldError("timePeriodError", ""));
    get("toDate")?.addEventListener("input", () => showFieldError("timePeriodError", ""));
    get("reportYear")?.addEventListener("change", () => {
      const hidden = get("selectedYear");
      if (hidden) hidden.value = get("reportYear").value;
    });
    get("reportMonth")?.addEventListener("change", () => {
      const hidden = get("selectedMonth");
      if (hidden) hidden.value = get("reportMonth").value;
    });
    get("clearMaker")?.addEventListener("click", () => {
      const select = get("vehicleMaker");
      Array.from(select?.options || []).forEach((option) => { option.selected = false; });
      select?.dispatchEvent(new Event("change", { bubbles: true }));
      refreshMultiselect("vehicleMaker");
      showFieldError("makerError", "");
    });
    applyReportType();
  }

  function syncHiddenFields() {
    const yAxis = get("yAxis");
    const xAxis = get("xAxis");
    if (get("yAxis_hidden")) get("yAxis_hidden").value = yAxis?.value || "";
    if (get("xAxis_hidden")) get("xAxis_hidden").value = xAxis?.value || "";
    if (get("hiddenCaptchaField")) get("hiddenCaptchaField").value = get("externalCaptcha")?.value.trim() || "";
    if (get("selectedYear")) get("selectedYear").value = get("reportYear")?.value || "";
    if (get("selectedMonth")) get("selectedMonth").value = get("reportMonth")?.value || "";
    setMakerMessages();
  }

  function captchaSvg(value, seed) {
    const encoded = encodeURIComponent(value).replace(/'/g, "%27");
    const angle = seed % 2 ? -7 : 6;
    return `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='210' height='65' viewBox='0 0 210 65'%3E%3Crect width='210' height='65' fill='%23fff'/%3E%3Cpath d='M5 52L195 10M20 8L195 55' stroke='%23d7e5d7'/%3E%3Ctext x='50%25' y='58%25' dominant-baseline='middle' text-anchor='middle' fill='%23087b17' font-family='Georgia' font-size='38' font-weight='700' letter-spacing='3' transform='rotate(${angle} 105 33)'%3E${encoded}%3C/text%3E%3C/svg%3E`;
  }

  function installCaptchaBehavior() {
    const image = get("captchaImage");
    const refresh = get("captchaImg");
    const input = get("externalCaptcha");
    const values = ["RrKbe3", "Q7mN2p", "B8xL4d", "T5cV9k"];
    let index = 0;
    const refreshCaptcha = () => {
      index = (index + 1) % values.length;
      const value = values[index];
      if (image) image.src = captchaSvg(value, index);
      if (input) input.value = "";
      if (get("hiddenCaptchaField")) get("hiddenCaptchaField").value = "";
      log(`CAPTCHA fixture refreshed (${value.length} characters).`);
    };
    refresh?.addEventListener("click", refreshCaptcha);
    if (image) image.dataset.fixtureCaptcha = values[index];
  }

  function updateResultTitle() {
    const title = document.querySelector("#fixture-result .result-title");
    if (!title) return;
    const y = get("yAxis")?.selectedOptions?.[0]?.textContent?.trim() || "Report";
    const x = get("xAxis")?.selectedOptions?.[0]?.textContent?.trim() || "Total";
    title.textContent = `${y} (${x}) Wise Vehicle Data for All State (${DATA.constraints.calendarYearMax})`;
  }

  function renderResult() {
    const result = get("fixture-result");
    if (result) {
      result.hidden = false;
      updateResultTitle();
    }
  }

  function installFormBehavior() {
    const form = get("vahanPublicForm");
    const captcha = get("externalCaptcha");
    if (!form) return;

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      syncHiddenFields();
      if (!validateDateRanges()) return;
      if (!get("yAxis")?.value || !get("xAxis")?.value) {
        showFieldError("yAxisError", !get("yAxis")?.value ? "Please select Y-Axis option." : "");
        showFieldError("xAxisError", !get("xAxis")?.value ? "Please select X-Axis option." : "");
        return;
      }
      if (!captcha || captcha.value.trim().length < 6) {
        document.getElementById("fixture-invalid-captcha")?.remove();
        document.body.insertAdjacentHTML(
          "afterbegin",
          '<div id="fixture-invalid-captcha" class="fixture-toast">Invalid CAPTCHA</div>'
        );
        if (captcha) captcha.value = "";
        return;
      }
      sessionStorage.setItem("vahan-fixture-result", "1");
      window.location.reload();
    });

    if (sessionStorage.getItem("vahan-fixture-result") === "1") renderResult();
  }

  function downloadFixture(extension) {
    const url = "/analytics/vahanpublicreport/vahan-fixture-report.txt";
    const link = document.createElement("a");
    link.href = url;
    link.download = extension === "csv"
      ? "vahan-fixture-report.csv"
      : "vahan-fixture-report.xlsx";
    document.body.appendChild(link);
    link.click();
    log(`Đã tạo download fixture: ${link.download}`);
    link.remove();
  }

  function setupDownloads() {
    get("downloadBtn1")?.addEventListener("click", () => downloadFixture("xlsx"));
    get("downloadBtn2")?.addEventListener("click", () => downloadFixture("csv"));
  }

  function removeFuelAtRuntime() {
    get("vehicleFuel")?.remove();
    log("Runtime drift: đã xóa #vehicleFuel khỏi DOM.");
  }

  function removeCategoryLabelAtRuntime() {
    const changed = removeOption("vehicleCategoryGroup", "Two Wheeler");
    log(changed ? "Runtime drift: đã xóa option Two Wheeler." : "Không tìm thấy option Two Wheeler.");
  }

  function duplicateFuelWrapperAtRuntime() {
    const wrapper = document.querySelector('[data-for-select="vehicleFuel"]');
    if (!wrapper) return;
    wrapper.parentElement.appendChild(wrapper.cloneNode(true));
    log("Runtime drift: đã thêm duplicate Fuel dropdown wrapper.");
  }

  function restoreFixture() {
    sessionStorage.removeItem("vahan-fixture-result");
    window.location.reload();
  }

  function applyPostWidgetScenario(mode, fuelWrapper) {
    if (mode === "wrong-wrapper" && fuelWrapper) {
      fuelWrapper.parentElement?.appendChild(fuelWrapper.cloneNode(true));
    }
    if (mode === "moved-wrapper" && fuelWrapper) {
      document.querySelector(".filters-body")?.appendChild(fuelWrapper);
    }
  }

  function installDevConsole() {
    if (!devMode) return;
    const panel = document.createElement("aside");
    panel.id = "fixture-dev-console";
    panel.innerHTML = `
      <h2>Dev UI Drift Fixture</h2>
      <div>Scenario: <strong>${uiMode}</strong></div>
      <div class="dev-actions">
        <button type="button" data-action="remove-fuel">Xóa Fuel runtime</button>
        <button type="button" data-action="remove-category">Xóa Two Wheeler</button>
        <button type="button" data-action="duplicate-wrapper">Duplicate wrapper</button>
        <button type="button" data-action="restore">Khôi phục</button>
      </div>
      <div id="fixture-dev-log">Ready. ${DATA.states.length} states / ${Object.keys(DATA.rtoByState).length} RTO maps loaded.</div>
    `;
    document.body.appendChild(panel);
    panel.querySelector('[data-action="remove-fuel"]')?.addEventListener("click", removeFuelAtRuntime);
    panel.querySelector('[data-action="remove-category"]')?.addEventListener("click", removeCategoryLabelAtRuntime);
    panel.querySelector('[data-action="duplicate-wrapper"]')?.addEventListener("click", duplicateFuelWrapperAtRuntime);
    panel.querySelector('[data-action="restore"]')?.addEventListener("click", restoreFixture);
  }

  populateAllOptions();
  applyStructuralScenario(uiMode);

  const wrappers = new Map();
  MULTISELECTS.forEach(([id, label]) => {
    const wrapper = buildMultiselect(id, label);
    if (wrapper) wrappers.set(id, wrapper);
  });
  const categoryWrapper = wrappers.get("vehicleCategoryGroup") || null;
  const fuelWrapper = wrappers.get("vehicleFuel") || null;

  applyPostWidgetScenario(uiMode, fuelWrapper);
  installAxisBehavior();
  installFilterDependencies();
  installCaptchaBehavior();
  installFormBehavior();
  setupDownloads();
  installDevConsole();

  window.vahanFixture = {
    mode: uiMode,
    data: DATA,
    categoryWrapper,
    fuelWrapper,
    loadRtoOptions,
    applyReportType,
    populateXAxis,
    removeFuelAtRuntime,
    removeCategoryLabelAtRuntime,
    duplicateFuelWrapperAtRuntime,
    restoreFixture,
  };

  if (uiMode === "visual-only") log("Visual-only scenario: contract selectors remain unchanged.");
})();
