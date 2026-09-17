(function installVahanUiHealthCheckContent(global) {
  "use strict";

  const HEALTH_CHECK_STEP = "scheduled-health-check";
  const DATA_CONTRACT_VERSION = "v1";
  const DATA_CONTROLS = Object.freeze({
    category: "#vehicleCategoryGroup",
    fuel: "#vehicleFuel",
    yAxis: "#yAxis",
    xAxis: "#xAxis",
  });

  function normalize(value) {
    return String(value || "").replace(/\s+/g, " ").trim().toLocaleLowerCase();
  }

  function hash(value) {
    let result = 2166136261;
    for (const character of String(value)) {
      result ^= character.charCodeAt(0);
      result = Math.imul(result, 16777619);
    }
    return (result >>> 0).toString(16);
  }

  function optionRecords(select) {
    return [...select.options].map((option) => ({
      label: String(option.label || option.textContent || "").replace(/\s+/g, " ").trim(),
      value: String(option.value || ""),
    }));
  }

  function dataSnapshot() {
    const controls = {};
    for (const [name, selector] of Object.entries(DATA_CONTROLS)) {
      const select = document.querySelector(selector);
      if (!select) continue;
      const options = optionRecords(select);
      controls[name] = {
        selector,
        optionCount: options.length,
        digest: hash(JSON.stringify(options)),
        sample: options.slice(0, 8),
      };
    }
    return {
      version: DATA_CONTRACT_VERSION,
      signature: hash(JSON.stringify(controls)),
      controls,
    };
  }

  function requireOption(api, selector, control, expectedOption) {
    const select = document.querySelector(selector);
    const options = select ? optionRecords(select) : [];
    if (options.some((option) => normalize(option.label) === normalize(expectedOption))) return;
    throw new api.UiDriftError(
      "UI_DRIFT_REQUIRED_OPTION",
      `Không tìm thấy option ${control} '${expectedOption}'.`,
      HEALTH_CHECK_STEP,
      {
        control,
        selector,
        expectedOption,
        optionCount: options.length,
        actualOptions: options.slice(0, 20).map((option) => option.label),
      },
    );
  }

  function requireOptions(api, selector, control) {
    const select = document.querySelector(selector);
    const optionCount = select ? select.options.length : 0;
    if (optionCount > 0) return;
    throw new api.UiDriftError(
      "UI_DRIFT_EMPTY_OPTIONS",
      `Danh sách option của ${control} đang rỗng hoặc chưa được tải.`,
      HEALTH_CHECK_STEP,
      { control, selector, optionCount },
    );
  }

  function inspect() {
    const api = global.VahanUiDrift;
    if (!api) throw new Error("VAHAN UI drift contract is not available.");

    const contract = api.getUiContract(HEALTH_CHECK_STEP);
    requireOption(api, DATA_CONTROLS.category, "category", "Two Wheeler");
    requireOptions(api, DATA_CONTROLS.fuel, "fuel");
    requireOption(api, DATA_CONTROLS.yAxis, "yaxis", "Fuel");

    return {
      ...contract,
      dataSnapshot: dataSnapshot(),
    };
  }

  function errorText(error) {
    return String(error?.message || error || "Unknown UI health-check error")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 300);
  }

  function reportFor(error) {
    const api = global.VahanUiDrift;
    if (!api?.isUiDriftError(error)) return null;
    return {
      ...api.formatUiDrift(error),
      diagnostics: error.details || {},
    };
  }

  function inspectForBackground() {
    try {
      return Promise.resolve({ ok: true, contract: inspect() });
    } catch (error) {
      const uiDrift = reportFor(error);
      return Promise.resolve(uiDrift
        ? { ok: false, uiDrift }
        : { ok: false, error: errorText(error) });
    }
  }

  global.VahanUiHealthCheckContent = Object.freeze({ inspect });

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type !== "RUN_SCHEDULED_UI_CHECK") return;
    inspectForBackground().then(sendResponse);
    return true;
  });
})(globalThis);
