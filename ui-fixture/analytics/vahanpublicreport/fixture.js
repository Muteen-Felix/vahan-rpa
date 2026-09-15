/*
 * Local VAHAN UI fixture.
 *
 * The page intentionally keeps the production contract used by the RPA:
 *   #vahanPublicForm, #vehicleCategoryGroup, #vehicleFuel, #yAxis, #xAxis,
 *   #yAxis_hidden, #xAxis_hidden, #externalCaptcha and #applyTrigger.
 *
 * Query-string scenarios make UI drift reproducible without touching the live
 * Indian portal. Example:
 *   ?lang=en&ui=baseline
 *   ?lang=en&ui=missing-fuel
 *   ?lang=en&ui=wrong-wrapper
 */
(() => {
  const params = new URLSearchParams(window.location.search);
  const uiMode = params.get("ui") || "baseline";
  const devMode = params.get("dev") === "1";

  const log = (message) => {
    const line = `[FIXTURE DEV] ${message}`;
    console.info(line);
    const target = document.getElementById("fixture-dev-log");
    if (target) {
      target.textContent = `${line}\n${target.textContent}`.trim();
    }
  };

  const normalize = (value) => String(value || "").replace(/\s+/g, " ").trim().toLowerCase();

  function removeOption(selectId, text) {
    const select = document.getElementById(selectId);
    if (!select) return false;
    const option = Array.from(select.options).find((candidate) =>
      normalize(candidate.getAttribute("label") || candidate.textContent) === normalize(text)
    );
    if (!option) return false;
    option.remove();
    return true;
  }

  function applyStructuralScenario(mode) {
    const category = document.getElementById("vehicleCategoryGroup");
    const fuel = document.getElementById("vehicleFuel");
    const yAxis = document.getElementById("yAxis");
    const apply = document.getElementById("applyTrigger");

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

  function selectedLabels(select) {
    return Array.from(select.options).filter((option) => option.selected).map((option) => option.textContent.trim());
  }

  function buildMultiselect(selectId, label) {
    const select = document.getElementById(selectId);
    if (!select) return null;

    const control = select.closest(".field-control") || select.parentElement;
    const wrapper = document.createElement("div");
    wrapper.className = "multiselect-dropdown";
    wrapper.dataset.forSelect = selectId;

    const display = document.createElement("div");
    display.className = "multiselect-display";
    display.setAttribute("role", "button");
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
      panel.querySelectorAll(".multiselect-option").forEach((option) => {
        option.hidden = needle && !normalize(option.dataset.searchText).includes(needle);
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
    panel.appendChild(allRow);

    const optionRows = [];
    const updateSummary = () => {
      const selected = selectedLabels(select);
      const summary = display.querySelector(".summary");
      if (selected.length === select.options.length && selected.length > 0) {
        summary.textContent = "All";
      } else if (selected.length === 0) {
        summary.textContent = `--- Select ${label} ---`;
      } else {
        summary.textContent = selected.join(", ");
      }
      allCheckbox.checked = selected.length === select.options.length && selected.length > 0;
    };

    const syncNativeChange = () => {
      select.dispatchEvent(new Event("change", { bubbles: true }));
      updateSummary();
    };

    allCheckbox.addEventListener("change", () => {
      Array.from(select.options).forEach((option) => { option.selected = allCheckbox.checked; });
      syncNativeChange();
    });

    Array.from(select.options).forEach((option) => {
      const row = document.createElement("div");
      row.className = "multiselect-option";
      row.dataset.searchText = option.textContent.trim().toUpperCase();
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = option.selected;
      checkbox.tabIndex = -1;
      const text = document.createElement("span");
      text.textContent = option.textContent.trim();
      row.append(checkbox, text);
      row.addEventListener("click", (event) => {
        if (event.target !== checkbox) checkbox.checked = !checkbox.checked;
        option.selected = checkbox.checked;
        syncNativeChange();
      });
      checkbox.addEventListener("click", (event) => event.stopPropagation());
      checkbox.addEventListener("change", () => {
        option.selected = checkbox.checked;
        syncNativeChange();
      });
      optionRows.push({ row, checkbox, option });
      panel.appendChild(row);
    });

    display.addEventListener("click", () => {
      wrapper.classList.toggle("open");
    });
    document.addEventListener("click", (event) => {
      if (!wrapper.contains(event.target)) wrapper.classList.remove("open");
    });

    wrapper.append(display, panel);
    control.appendChild(wrapper);
    select.addEventListener("change", () => {
      optionRows.forEach(({ checkbox, option }) => { checkbox.checked = option.selected; });
      updateSummary();
    });
    updateSummary();
    return wrapper;
  }

  function applyPostWidgetScenario(mode, fuelWrapper) {
    if (mode === "wrong-wrapper" && fuelWrapper) {
      const parent = fuelWrapper.parentElement;
      parent?.appendChild(fuelWrapper.cloneNode(true));
    }
    if (mode === "moved-wrapper" && fuelWrapper) {
      document.querySelector(".filters-body")?.appendChild(fuelWrapper);
    }
  }

  function populateXAxis() {
    const yAxis = document.getElementById("yAxis");
    const xAxis = document.getElementById("xAxis");
    const yHidden = document.getElementById("yAxis_hidden");
    const xHidden = document.getElementById("xAxis_hidden");
    if (!yAxis || !xAxis) return;
    if (yHidden) yHidden.value = yAxis.value;
    xAxis.innerHTML = "";
    const placeholder = new Option("--- Select X-Axis ---", "", false, false);
    placeholder.label = "--- Select X-Axis ---";
    xAxis.add(placeholder);
    if (yAxis.value) {
      const option = new Option("Vehicle Category Group", "vehicleCategoryGroup", false, false);
      option.label = "Vehicle Category Group";
      xAxis.add(option);
      const fuelOption = new Option("Fuel", "vehicleFuel", false, false);
      fuelOption.label = "Fuel";
      xAxis.add(fuelOption);
    }
    if (xHidden) xHidden.value = xAxis.value;
  }

  function installAxisBehavior() {
    const yAxis = document.getElementById("yAxis");
    const xAxis = document.getElementById("xAxis");
    yAxis?.addEventListener("click", populateXAxis);
    yAxis?.addEventListener("change", () => {
      const hidden = document.getElementById("yAxis_hidden");
      if (hidden) hidden.value = yAxis.value;
    });
    xAxis?.addEventListener("change", () => {
      const hidden = document.getElementById("xAxis_hidden");
      if (hidden) hidden.value = xAxis.value;
    });
  }

  function renderResult() {
    const result = document.getElementById("fixture-result");
    if (result) result.hidden = false;
  }

  function installFormBehavior() {
    const form = document.getElementById("vahanPublicForm");
    const captcha = document.getElementById("externalCaptcha");
    if (!form) return;

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      if (!captcha || captcha.value.trim().length < 6) {
        document.body.insertAdjacentHTML("afterbegin", '<div id="fixture-invalid-captcha" class="fixture-toast">Invalid CAPTCHA</div>');
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
    link.download = extension === "csv" ? "vahan-fixture-report.csv" : "vahan-fixture-report.xlsx";
    document.body.appendChild(link);
    link.click();
    link.remove();
    log(`Đã tạo download fixture: ${link.download}`);
  }

  function setupDownloads() {
    document.getElementById("downloadBtn1")?.addEventListener("click", () => downloadFixture("xlsx"));
    document.getElementById("downloadBtn2")?.addEventListener("click", () => downloadFixture("csv"));
  }

  function removeFuelAtRuntime() {
    document.getElementById("vehicleFuel")?.remove();
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
      <div id="fixture-dev-log">Ready.</div>
    `;
    document.body.appendChild(panel);
    panel.querySelector('[data-action="remove-fuel"]')?.addEventListener("click", removeFuelAtRuntime);
    panel.querySelector('[data-action="remove-category"]')?.addEventListener("click", removeCategoryLabelAtRuntime);
    panel.querySelector('[data-action="duplicate-wrapper"]')?.addEventListener("click", duplicateFuelWrapperAtRuntime);
    panel.querySelector('[data-action="restore"]')?.addEventListener("click", restoreFixture);
  }

  applyStructuralScenario(uiMode);
  const categoryWrapper = buildMultiselect("vehicleCategoryGroup", "Category Group");
  const fuelWrapper = buildMultiselect("vehicleFuel", "Fuel");
  applyPostWidgetScenario(uiMode, fuelWrapper);
  installAxisBehavior();
  installFormBehavior();
  setupDownloads();
  installDevConsole();

  window.vahanFixture = {
    mode: uiMode,
    categoryWrapper,
    fuelWrapper,
    removeFuelAtRuntime,
    removeCategoryLabelAtRuntime,
    duplicateFuelWrapperAtRuntime,
    restoreFixture,
  };

  if (uiMode === "visual-only") log("Visual-only scenario: contract selectors remain unchanged.");
})();
