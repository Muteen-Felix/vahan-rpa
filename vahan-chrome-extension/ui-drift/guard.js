// Shared fail-closed UI contract and diagnostics for the production extension.
// Keep this file before content.js in manifest.json.
(function installVahanUiDrift(global) {
  "use strict";

  const UI_CONTRACT_VERSION = "v1";
  const REPORT_PATH_FRAGMENT = "/analytics/vahanpublicreport";
  const BASE_REQUIRED_CONTROLS = {
    form: "#vahanPublicForm",
    category: "#vehicleCategoryGroup",
    fuel: "#vehicleFuel",
    yaxis: "#yAxis",
    xaxis: "#xAxis",
    captcha: "#externalCaptcha",
    apply: "#applyTrigger",
  };

  const CONTROL_LABELS = {
    form: "form VAHAN Public Report (#vahanPublicForm)",
    category: "Category Group (#vehicleCategoryGroup)",
    vehicleCategoryGroup: "Category Group (#vehicleCategoryGroup)",
    vehicleSubCategory: "Sub-category (#vehicleSubCategory)",
    vehicleClass: "Class (#vehicleClass)",
    fuel: "Fuel (#vehicleFuel)",
    vehicleFuel: "Fuel (#vehicleFuel)",
    yaxis: "Y-Axis (#yAxis)",
    yAxis: "Y-Axis (#yAxis)",
    xaxis: "X-Axis (#xAxis)",
    xAxis: "X-Axis (#xAxis)",
    captcha: "ô CAPTCHA (#externalCaptcha)",
    externalCaptcha: "ô CAPTCHA (#externalCaptcha)",
    apply: "nút Apply (#applyTrigger)",
    applyTrigger: "nút Apply (#applyTrigger)",
    archivedFlags: "Archived Flag (#archivedFlags)",
    reportType: "Report Type (#reportType)",
    financialYearSelect: "Financial Year (#financialYearSelect)",
    reportYear: "Report Year (#reportYear)",
    reportMonth: "Report Month (#reportMonth)",
    delhiNcr: "Delhi NCR (#delhiNcr)",
    stateName: "State (#stateName)",
    rtoCode: "RTO (#rtoCode)",
    vehicleEmission: "Emission (#vehicleEmission)",
    vehicleMaker: "Maker (#vehicleMaker)",
    evType: "EV Type (#evType)",
    vehicleStatus: "Status (#vehicleStatus)",
    vehicleOwnerType: "Owner Type (#vehicleOwnerType)",
    vehicleType: "Vehicle Type (#vehicleType)",
    fitnessCheck: "Fitness (#fitnessCheck)",
  };

  class UiDriftError extends Error {
    constructor(code, message, step = "preflight", details = {}) {
      super(message);
      this.name = "UiDriftError";
      this.code = code;
      this.step = step;
      this.details = details;
    }
  }

  function displayDiagnosticValue(value, maxLength = 180) {
    if (value === null || value === undefined || value === "") {
      return "không có dữ liệu";
    }
    const raw = Array.isArray(value) ? value.join(", ") : String(value);
    const text = raw.replace(/\s+/g, " ").trim();
    if (!text) return "không có dữ liệu";
    return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
  }

  function diagnosticTarget(details = {}, step = "preflight") {
    const key = details.control || details.name;
    if (CONTROL_LABELS[key]) return CONTROL_LABELS[key];

    const selector = details.selector;
    if (selector) {
      const cleanSelector = String(selector).replace(/^#/, "");
      if (CONTROL_LABELS[cleanSelector]) return CONTROL_LABELS[cleanSelector];
      return `control ${displayDiagnosticValue(selector)}`;
    }

    const hiddenSelectId = details.hiddenSelectId || details.hidden_select_id;
    if (hiddenSelectId) {
      const cleanId = String(hiddenSelectId).replace(/^#/, "");
      return CONTROL_LABELS[cleanId] || `control #${cleanId}`;
    }

    if (details.label) return displayDiagnosticValue(details.label);
    return step || "preflight";
  }

  function normalizeControlFingerprint(control) {
    if (!control) return null;
    return {
      tag: control.tag || null,
      id: control.id || null,
      nameAttr: control.nameAttr || null,
      multiple: Boolean(control.multiple),
    };
  }

  function describeControlFingerprint(control) {
    if (!control) return "control không tồn tại";
    const fingerprint = normalizeControlFingerprint(control);
    return `tag=${fingerprint.tag}; id=${fingerprint.id}; name=${fingerprint.nameAttr}; multiple=${fingerprint.multiple}`;
  }

  function diffControlFingerprints(expectedContract, actualContract) {
    if (!Array.isArray(expectedContract?.controls)) return [];
    const expected = new Map(expectedContract.controls.map((control) => [control.name, control]));
    const actual = new Map((actualContract?.controls || []).map((control) => [control.name, control]));
    const names = new Set([...expected.keys(), ...actual.keys()]);
    return [...names]
      .filter((name) => {
        const expectedControl = normalizeControlFingerprint(expected.get(name));
        const actualControl = normalizeControlFingerprint(actual.get(name));
        return JSON.stringify(expectedControl) !== JSON.stringify(actualControl);
      })
      .map((name) => ({
        name,
        selector: expected.get(name)?.selector || actual.get(name)?.selector || "",
        expected: expected.get(name) || null,
        actual: actual.get(name) || null,
      }));
  }

  function formatUiDrift(error) {
    const details = error?.details || {};
    const code = error?.code || "UI_DRIFT";
    const count = details.count;
    let target = diagnosticTarget(details, error?.step);
    let title;
    let expected;
    let actual;

    if (code === "UI_DRIFT_REQUIRED_CONTROL") {
      title = "Control bắt buộc bị thiếu hoặc bị trùng";
      expected = "DOM phải có đúng 1 control";
      actual = `DOM đang có ${count === undefined ? "không xác định" : count} control`;
    } else if (code === "UI_DRIFT_CONTROL_TYPE") {
      title = "Loại control đã thay đổi";
      expected = displayDiagnosticValue(details.expected, 100);
      actual = displayDiagnosticValue(
        details.actual || "control không còn là multi-select (thiếu thuộc tính multiple)"
      );
    } else if (code === "UI_DRIFT_REQUIRED_OPTION") {
      const option = displayDiagnosticValue(
        details.expectedOption || details.expected_option || details.option
      );
      title = "Thiếu lựa chọn bắt buộc";
      expected = `option '${option}' phải tồn tại`;
      actual = displayDiagnosticValue(
        details.actual || "option này đã bị xóa, đổi tên hoặc chưa được tải"
      );
    } else if (code === "UI_DRIFT_EMPTY_OPTIONS") {
      title = "Danh sách lựa chọn đang rỗng";
      expected = "Có ít nhất 1 option để tiếp tục";
      actual = `DOM đang có ${details.optionCount ?? details.option_count ?? 0} option`;
    } else if (code === "UI_DRIFT_MULTISELECT_WRAPPER") {
      title = "Wrapper multiselect đã thay đổi vị trí hoặc số lượng";
      expected = "Có đúng 1 wrapper trong cùng form-group với select gốc";
      actual = `Tìm thấy ${details.wrapperCount ?? details.wrapper_count ?? "không xác định"} wrapper`;
    } else if (code === "UI_DRIFT_WRONG_PAGE") {
      target = "trang VAHAN Public Report";
      title = "Đang ở sai trang";
      expected = displayDiagnosticValue(
        details.expectedUrl || details.expected_url || `URL phải chứa ${REPORT_PATH_FRAGMENT}`,
      );
      actual = displayDiagnosticValue(details.url);
    } else if (code === "UI_DRIFT_CHANGED_DURING_RUN") {
      const change = details.changedControls?.[0] || details.changed_controls?.[0];
      if (change) {
        target = diagnosticTarget({ control: change.name, selector: change.selector }, error?.step);
        title = "Control đã thay đổi giữa hai bước kiểm tra";
        expected = describeControlFingerprint(change.expected);
        actual = describeControlFingerprint(change.actual);
        const totalChanges = (details.changedControls || details.changed_controls || []).length;
        if (totalChanges > 1) actual += `; và ${totalChanges - 1} control khác cũng thay đổi`;
      } else {
        target = "cấu trúc UI trong lúc flow đang chạy";
        title = "UI thay đổi giữa hai bước kiểm tra";
        expected = `signature=${displayDiagnosticValue(
          details.expectedSignature || details.expected_signature
        )}`;
        actual = `signature=${displayDiagnosticValue(
          details.actualSignature || details.actual_signature
        )}`;
      }
    } else if (code === "UI_DRIFT_OPTION_NOT_UNIQUE") {
      target = `${displayDiagnosticValue(details.label)} > option '${displayDiagnosticValue(
        details.target || details.targetText
      )}'`;
      title = "Option không còn duy nhất";
      expected = "Tìm thấy đúng 1 option khớp";
      actual = `Tìm thấy ${count === undefined ? "không xác định" : count} kết quả`;
    } else if (code === "UI_DRIFT_ALL_OPTION_NOT_FOUND") {
      target = `${displayDiagnosticValue(details.label)} > checkbox All`;
      title = "Checkbox All đã thay đổi hoặc bị mất";
      expected = "Có đúng 1 checkbox All";
      actual = `Tìm thấy ${count === undefined ? "không xác định" : count} checkbox`;
    } else if (code === "UI_DRIFT_SEARCH_INPUT") {
      target = `ô tìm kiếm của ${displayDiagnosticValue(details.label)}`;
      title = "Ô tìm kiếm multiselect không đúng";
      expected = "Có đúng 1 ô tìm kiếm";
      actual = `Tìm thấy ${count === undefined ? "không xác định" : count} ô`;
    } else if (code === "UI_DRIFT_OPTION_CONTROL") {
      target = `option '${displayDiagnosticValue(details.option)}' trong ${displayDiagnosticValue(
        details.label
      )}`;
      title = "Control của option đã thay đổi";
      expected = "Có đúng 1 checkbox cho option";
      actual = `Tìm thấy ${details.checkboxCount ?? details.checkbox_count ?? "không xác định"} checkbox`;
    } else if (code === "UI_DRIFT_SELECTION_NOT_SYNCED") {
      target = `${displayDiagnosticValue(details.label)} > option '${displayDiagnosticValue(
        details.option
      )}'`;
      title = "Widget và select gốc không đồng bộ";
      expected = "Checkbox và option gốc cùng được chọn";
      actual = `Select gốc đang có: ${displayDiagnosticValue(
        details.selectedOptions || details.selected
      )}`;
    } else if (code === "UI_DRIFT_AXIS_NOT_SYNCED") {
      target = "Y-Axis/X-Axis và hidden fields";
      title = "Giá trị trục báo cáo không đồng bộ";
      expected = "Hidden fields khớp giá trị đang hiển thị";
      actual = `Expected=${displayDiagnosticValue(details.expected)}; Actual=${displayDiagnosticValue(
        details.actual
      )}`;
    } else if (code === "UI_DRIFT_STALE_FLOW_STATE") {
      target = "trạng thái flow đã lưu";
      title = "Flow cũ không còn đủ thông tin contract";
      expected = "Có signature UI contract hợp lệ";
      actual = "Không có signature";
    } else if (code === "UI_DRIFT_DYNAMIC_CONTROL_TIMEOUT") {
      title = "Control động không xuất hiện đúng hạn";
      expected = "Control và option cần thiết xuất hiện trong thời gian cho phép";
      actual = `Timeout tại bước ${displayDiagnosticValue(error?.step)}`;
    } else {
      title = "Cấu trúc UI không khớp contract";
      expected = "Trang khớp UI contract đã được kiểm thử";
      actual = `Mã lỗi ${code}`;
    }

    const message = `Phát hiện thay đổi tại ${target}: ${title}. Tool đã dừng để tránh thao tác sai dữ liệu.`;
    const action =
      "Dev cần kiểm tra đúng vùng này, cập nhật selector/adapter và chạy lại kiểm thử UI được phê duyệt; " +
      "người dùng không cần nhập lại dữ liệu cho đến khi tool được cập nhật.";
    return {
      code,
      step: error?.step || "preflight",
      title,
      target,
      expected,
      actual,
      action,
      message,
    };
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

  function getDropdownContainer(hiddenSelectId, step = "filter") {
    const cleanId = String(hiddenSelectId).replace(/^#/, "");
    const hidden = requireOne(`#${cleanId}`, cleanId, step);
    const group = hidden.closest(".form-group");
    let candidates = group ? group.querySelectorAll("div.multiselect-dropdown") : [];
    if (candidates.length !== 1 && hidden.parentElement) {
      candidates = hidden.parentElement.querySelectorAll("div.multiselect-dropdown");
    }
    if (candidates.length !== 1) {
      throw new UiDriftError(
        "UI_DRIFT_MULTISELECT_WRAPPER",
        `Không xác định được widget multiselect duy nhất cho #${cleanId}.`,
        step,
        { hiddenSelectId: cleanId, wrapperCount: candidates.length }
      );
    }
    const wrapper = candidates[0];
    const label = wrapper.getAttribute("aria-label") || cleanId;
    const searchInputs = wrapper.querySelectorAll("input.multiselect-dropdown-search");
    if (searchInputs.length !== 1) {
      throw new UiDriftError(
        "UI_DRIFT_SEARCH_INPUT",
        `Không xác định được ô search duy nhất cho #${cleanId}.`,
        step,
        { label, count: searchInputs.length }
      );
    }
    if (hidden.hasAttribute("multiselect-select-all")) {
      const allCheckboxes = wrapper.querySelectorAll(
        ".multiselect-dropdown-all-selector input[type=checkbox]"
      );
      if (allCheckboxes.length !== 1) {
        throw new UiDriftError(
          "UI_DRIFT_ALL_OPTION_NOT_FOUND",
          `Không xác định được checkbox All duy nhất cho #${cleanId}.`,
          step,
          { label, count: allCheckboxes.length }
        );
      }
    }
    return wrapper;
  }

  function stableSignature(fingerprint) {
    const canonical = JSON.stringify(fingerprint);
    return Array.from(canonical)
      .reduce((hash, character) => ((hash * 31 + character.charCodeAt(0)) >>> 0), 7)
      .toString(16);
  }

  function getUiContract(step = "preflight", additionalControls = {}, multiSelectNames = []) {
    if (!window.location.pathname.includes(REPORT_PATH_FRAGMENT)) {
      throw new UiDriftError(
        "UI_DRIFT_WRONG_PAGE",
        "Trang hiện tại không phải VAHAN Public Report.",
        step,
        { url: window.location.href }
      );
    }

    const controls = { ...BASE_REQUIRED_CONTROLS, ...additionalControls };
    const fingerprint = [];
    for (const [name, selector] of Object.entries(controls)) {
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

    const multiNames = multiSelectNames.length ? multiSelectNames : ["category", "fuel"];
    for (const name of multiNames) {
      const selector = controls[name];
      if (!selector) continue;
      const element = document.querySelector(selector);
      if (!element?.hasAttribute("multiple")) {
        throw new UiDriftError(
          "UI_DRIFT_CONTROL_TYPE",
          `Control ${name} không còn là multi-select như contract ${UI_CONTRACT_VERSION}.`,
          step,
          {
            name,
            expected: "multiple select",
            actual: "control không còn thuộc tính multiple",
          }
        );
      }
      getDropdownContainer(element.id, step);
    }

    return {
      contractVersion: UI_CONTRACT_VERSION,
      signature: stableSignature(fingerprint),
      path: window.location.pathname,
      formAction: document.querySelector(BASE_REQUIRED_CONTROLS.form)?.getAttribute("action") || "",
      controls: fingerprint,
    };
  }

  function assertUiContract(
    step = "preflight",
    expectedSignature = null,
    additionalControls = {},
    multiSelectNames = [],
    expectedContract = null
  ) {
    const contract = getUiContract(step, additionalControls, multiSelectNames);
    if (expectedSignature && expectedSignature !== contract.signature) {
      const changedControls = diffControlFingerprints(expectedContract, contract);
      throw new UiDriftError(
        "UI_DRIFT_CHANGED_DURING_RUN",
        "Cấu trúc UI đã thay đổi trong lúc flow đang chạy; dữ liệu chưa được xác nhận.",
        step,
        { expectedSignature, actualSignature: contract.signature, changedControls }
      );
    }
    return contract;
  }

  async function waitForUiContract(
    step = "preflight",
    expectedSignature = null,
    additionalControls = {},
    multiSelectNames = [],
    timeoutMs = 10000,
    expectedContract = null
  ) {
    const startedAt = Date.now();
    let lastError = null;
    while (Date.now() - startedAt < timeoutMs) {
      try {
        return assertUiContract(
          step,
          expectedSignature,
          additionalControls,
          multiSelectNames,
          expectedContract
        );
      } catch (error) {
        lastError = error;
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
    }
    throw lastError || new UiDriftError(
      "UI_DRIFT_DYNAMIC_CONTROL_TIMEOUT",
      "UI contract không sẵn sàng đúng hạn.",
      step
    );
  }

  // The repair policy is deliberately small.  A repair is allowed only when
  // the original control is absent and there is exactly one semantic match
  // with the expected tag, name or label.  It never guesses an option, a
  // changed control type, a duplicate element, or a submit/CAPTCHA change.
  const SAFE_CONTROL_IDENTITIES = Object.freeze({
    category: { tag: "select", names: ["vehicleCategoryGroup"], labels: ["category group"] },
    vehicleCategoryGroup: { tag: "select", names: ["vehicleCategoryGroup"], labels: ["category group"] },
    fuel: { tag: "select", names: ["vehicleFuels"], labels: ["fuel"] },
    vehicleFuel: { tag: "select", names: ["vehicleFuels"], labels: ["fuel"] },
    yaxis: { tag: "select", labels: ["y-axis"] },
    yAxis: { tag: "select", labels: ["y-axis"] },
    xaxis: { tag: "select", labels: ["x-axis"] },
    xAxis: { tag: "select", labels: ["x-axis"] },
    captcha: { tag: "input", names: ["externalCaptcha"], labels: ["captcha"] },
    externalCaptcha: { tag: "input", names: ["externalCaptcha"], labels: ["captcha"] },
    apply: { tag: "button", labels: ["apply"] },
    applyTrigger: { tag: "button", labels: ["apply"] },
    archivedFlags: { tag: "select", names: ["archivedFlags"], labels: ["archived flag"] },
    reportType: { tag: "select", names: ["timePeriod"], labels: ["year type"] },
    financialYearSelect: { tag: "select", names: ["financialYearList"], labels: ["financial year"] },
    reportYear: { tag: "select", names: ["reportYear"], labels: ["month / year"] },
    reportMonth: { tag: "select", names: ["reportMonth"], labels: ["month / year"] },
    fromYear: { tag: "input", names: ["fromYear"] },
    toYear: { tag: "input", names: ["toYear"] },
    fromDate: { tag: "input", names: ["fromDate"] },
    toDate: { tag: "input", names: ["toDate"] },
    delhiNcr: { tag: "select", names: ["delhiNcr"], labels: ["delhi ncr"] },
    stateName: { tag: "select", names: ["stateMultiple"], labels: ["state"] },
    rtoCode: { tag: "select", names: ["rtoCodeMultiple"], labels: ["rto"] },
    vehicleEmission: { tag: "select", names: ["vehicleEmissions"], labels: ["emission"] },
    vehicleMaker: { tag: "select", names: ["vehicleMakers"], labels: ["maker"] },
    vehicleSubCategory: { tag: "select", names: ["vehicleSubCategories"], labels: ["sub-category"] },
    vehicleClass: { tag: "select", names: ["vehicleClasses"], labels: ["class"] },
    evType: { tag: "select", names: ["evType"], labels: ["ev type"] },
    vehicleStatus: { tag: "select", names: ["vehicleStatus"], labels: ["status"] },
    vehicleOwnerType: { tag: "select", names: ["vehicleOwnerType"], labels: ["owner type"] },
    vehicleType: { tag: "select", names: ["vehicleType"], labels: ["type"] },
    fitnessCheck: { tag: "select", names: ["fitnessCheck"], labels: ["fitness valid as on date"] },
    yAxisHidden: { tag: "input", names: ["yAxis"] },
    xAxisHidden: { tag: "input", names: ["xAxis"] },
  });

  function normalizeText(value) {
    return String(value || "").replace(/\s+/g, " ").trim().toLocaleLowerCase();
  }

  function controlNameFromSelector(selector) {
    return String(selector || "").replace(/^#/, "");
  }

  function safeControlIdentity(name, selector) {
    return SAFE_CONTROL_IDENTITIES[name] ||
      SAFE_CONTROL_IDENTITIES[controlNameFromSelector(selector)] ||
      null;
  }

  function findSemanticControl(name, selector) {
    const identity = safeControlIdentity(name, selector);
    if (!identity) return null;
    const candidates = [...document.querySelectorAll(identity.tag)];
    const byName = candidates.filter((element) => identity.names?.includes(element.getAttribute("name")));
    if (byName.length === 1) return byName[0];
    if (byName.length > 1) return null;

    const expectedLabels = (identity.labels || []).map(normalizeText);
    if (!expectedLabels.length) return null;
    const byLabel = [...document.querySelectorAll("label")]
      .filter((label) => {
        const labelText = normalizeText(label.textContent);
        return expectedLabels.some((expected) => labelText === expected || labelText.includes(expected));
      })
      .map((label) => label.control || (label.htmlFor ? document.getElementById(label.htmlFor) : null))
      .filter((element, index, elements) => element && elements.indexOf(element) === index)
      .filter((element) => candidates.includes(element));
    if (byLabel.length === 1) return byLabel[0];

    if (identity.tag === "button") {
      const byText = candidates.filter((element) => expectedLabels.some((expected) => {
        const text = normalizeText(element.textContent);
        return text === expected || text.includes(expected);
      }));
      if (byText.length === 1) return byText[0];
    }
    return null;
  }

  function repairControlIdentity(name, selector) {
    if (!selector || document.querySelectorAll(selector).length !== 0) return null;
    const candidate = findSemanticControl(name, selector);
    const expectedId = controlNameFromSelector(selector);
    if (!candidate || document.getElementById(expectedId)) return null;

    const previousId = candidate.id;
    const labels = [...document.querySelectorAll("label")].filter((label) =>
      label.control === candidate || (previousId && label.htmlFor === previousId)
    );
    const wrappers = [...document.querySelectorAll("[data-for-select]")].filter((wrapper) =>
      [previousId, candidate.getAttribute("name"), expectedId].filter(Boolean).includes(
        wrapper.getAttribute("data-for-select")
      )
    );

    candidate.id = expectedId;
    labels.forEach((label) => { label.htmlFor = expectedId; });
    wrappers.forEach((wrapper) => { wrapper.dataset.forSelect = expectedId; });
    return {
      target: `#${expectedId}`,
      message: `đã khôi phục nhận diện control theo ${candidate.getAttribute("name") || "label"}`,
    };
  }

  function repairMovedMultiselectWrapper(hiddenSelectId) {
    const cleanId = controlNameFromSelector(hiddenSelectId);
    if (!cleanId) return null;
    const selects = document.querySelectorAll(`#${cleanId}`);
    if (selects.length !== 1) return null;
    const select = selects[0];
    const target = select.closest(".field-control");
    const group = select.closest(".form-group");
    if (!target || !group) return null;

    const wrappers = [...document.querySelectorAll("[data-for-select]")].filter((wrapper) =>
      wrapper.getAttribute("data-for-select") === cleanId ||
      wrapper.getAttribute("data-for-select") === select.getAttribute("name")
    );
    if (wrappers.length !== 1) return null;
    const wrapper = wrappers[0];
    const ownerGroup = wrapper.closest(".form-group");
    if (ownerGroup && group && ownerGroup !== group) return null;

    const needsClass = !wrapper.classList.contains("multiselect-dropdown");
    const needsMove = wrapper.parentElement !== target;
    if (!needsClass && !needsMove) return null;
    wrapper.classList.add("multiselect-dropdown");
    target.appendChild(wrapper);
    return {
      target: `#${cleanId}`,
      message: "đã đưa wrapper multiselect về đúng form-group",
    };
  }

  function trySafeUiRepair(error) {
    if (!error?.code?.startsWith("UI_DRIFT")) return { repaired: false, retry: false };
    const details = error.details || {};

    if (error.code === "UI_DRIFT_REQUIRED_CONTROL") {
      const selector = details.selector;
      const count = details.count ?? (selector ? document.querySelectorAll(selector).length : undefined);
      if (count > 1) return { repaired: false, retry: false };
      const repair = repairControlIdentity(details.name || details.control, selector);
      if (repair) return { repaired: true, ...repair };
      return {
        repaired: false,
        retry: Boolean(safeControlIdentity(details.name || details.control, selector)) && count === 0,
      };
    }

    if (error.code === "UI_DRIFT_MULTISELECT_WRAPPER") {
      const repair = repairMovedMultiselectWrapper(details.hiddenSelectId || details.hidden_select_id);
      if (repair) return { repaired: true, ...repair };
    }
    return { repaired: false, retry: false };
  }

  function createSafeContractGuard({ onRepair = () => {}, maxRepairAttempts = 8 } = {}) {
    let repairNotices = [];

    function recordRepair(repair) {
      const notice = `Đã tự sửa thay đổi UI an toàn tại ${repair.target}.`;
      if (!repairNotices.includes(notice)) repairNotices.push(notice);
      onRepair({ ...repair, notice });
    }

    function assertWithSafeRepair(
      step,
      expectedSignature,
      additionalControls,
      multiSelectNames,
      expectedContract
    ) {
      let lastError;
      for (let attempt = 0; attempt < maxRepairAttempts; attempt += 1) {
        try {
          return assertUiContract(
            step,
            expectedSignature,
            additionalControls,
            multiSelectNames,
            expectedContract
          );
        } catch (error) {
          lastError = error;
          const repair = trySafeUiRepair(error);
          if (!repair.repaired) throw error;
          recordRepair(repair);
        }
      }
      throw lastError;
    }

    async function waitForContractWithSafeRepair(
      step = "preflight",
      expectedSignature = null,
      additionalControls = {},
      multiSelectNames = [],
      timeoutMs = 10000,
      expectedContract = null
    ) {
      const deadline = Date.now() + timeoutMs;
      let lastError = null;
      while (Date.now() < deadline) {
        try {
          return assertUiContract(
            step,
            expectedSignature,
            additionalControls,
            multiSelectNames,
            expectedContract
          );
        } catch (error) {
          lastError = error;
          const repair = trySafeUiRepair(error);
          if (repair.repaired) {
            recordRepair(repair);
            await new Promise((resolve) => setTimeout(resolve, 50));
            continue;
          }
          if (!repair.retry) throw error;
          await new Promise((resolve) => setTimeout(resolve, 200));
        }
      }
      throw lastError || new UiDriftError(
        "UI_DRIFT_DYNAMIC_CONTROL_TIMEOUT",
        "UI contract không sẵn sàng đúng hạn.",
        step
      );
    }

    return Object.freeze({
      assertWithSafeRepair,
      consumeRepairNotices: () => {
        const notice = repairNotices.join(" ");
        repairNotices = [];
        return notice;
      },
      reset: () => { repairNotices = []; },
      waitForContractWithSafeRepair,
    });
  }

  global.VahanUiDrift = Object.freeze({
    UiDriftError,
    assertUiContract,
    createSafeContractGuard,
    formatUiDrift,
    getDropdownContainer,
    getUiContract,
    isUiDriftError: (error) => Boolean(error?.code?.startsWith("UI_DRIFT")),
    requireOne,
    waitForUiContract,
  });
})(globalThis);
