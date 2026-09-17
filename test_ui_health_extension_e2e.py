"""End-to-end UI-health coverage using the unpacked production extension.

This test deliberately changes the DOM in the browser, then sends the real
``RUN_SCHEDULED_UI_CHECK`` message through Chrome.  It therefore covers the
same boundary as a DevTools mutation: fixture DOM -> health content script ->
service worker state/log queue.  It never contacts the official VAHAN portal
or writes to the developer's backend log directory.
"""

from __future__ import annotations

import shutil
import tempfile
from pathlib import Path
from typing import Any

from playwright.sync_api import BrowserContext, Page, Worker, sync_playwright

from test_ui_fixture_extension import start_fixture_server
from test_vahan_chrome_extension import EXTENSION_DIR


SCENARIO_EXPECTATIONS = {
    "missing-fuel": ("UI_DRIFT_REQUIRED_CONTROL", "#vehicleFuel"),
    "renamed-fuel": ("UI_DRIFT_REQUIRED_CONTROL", "#vehicleFuel"),
    "missing-category": ("UI_DRIFT_REQUIRED_CONTROL", "#vehicleCategoryGroup"),
    "duplicate-category": ("UI_DRIFT_REQUIRED_CONTROL", "#vehicleCategoryGroup"),
    "duplicate-fuel": ("UI_DRIFT_REQUIRED_CONTROL", "#vehicleFuel"),
    "empty-fuel": ("UI_DRIFT_EMPTY_OPTIONS", "#vehicleFuel"),
    "wrong-type": ("UI_DRIFT_CONTROL_TYPE", None),
    "wrong-fuel-type": ("UI_DRIFT_CONTROL_TYPE", None),
    "wrong-label": ("UI_DRIFT_REQUIRED_OPTION", "#vehicleCategoryGroup"),
    "missing-yaxis-option": ("UI_DRIFT_REQUIRED_OPTION", "#yAxis"),
    "missing-yaxis": ("UI_DRIFT_REQUIRED_CONTROL", "#yAxis"),
    "missing-xaxis": ("UI_DRIFT_REQUIRED_CONTROL", "#xAxis"),
    "missing-captcha": ("UI_DRIFT_REQUIRED_CONTROL", "#externalCaptcha"),
    "missing-form": ("UI_DRIFT_REQUIRED_CONTROL", "#vahanPublicForm"),
    "wrong-wrapper": ("UI_DRIFT_MULTISELECT_WRAPPER", None),
    "moved-wrapper": ("UI_DRIFT_MULTISELECT_WRAPPER", None),
    "missing-fuel-wrapper": ("UI_DRIFT_MULTISELECT_WRAPPER", None),
    "missing-fuel-search": ("UI_DRIFT_SEARCH_INPUT", None),
    "duplicate-fuel-search": ("UI_DRIFT_SEARCH_INPUT", None),
    "missing-fuel-all": ("UI_DRIFT_ALL_OPTION_NOT_FOUND", None),
    "duplicate-fuel-all": ("UI_DRIFT_ALL_OPTION_NOT_FOUND", None),
    "missing-apply": ("UI_DRIFT_REQUIRED_CONTROL", "#applyTrigger"),
}


def service_worker(context: BrowserContext) -> Worker:
    if context.service_workers:
        return context.service_workers[0]
    return context.wait_for_event("serviceworker", timeout=20_000)


def wait_for_extension(page: Page) -> None:
    page.wait_for_selector("#vahan-rpa-floating-root", state="attached", timeout=20_000)


def open_fixture(page: Page, base_url: str, mode: str) -> str:
    page.goto(f"{base_url}?lang=en&ui={mode}", wait_until="networkidle")
    wait_for_extension(page)
    return page.url


def run_content_health_check(worker: Worker, page_url: str, require_official: bool = False) -> dict[str, Any]:
    return worker.evaluate(
        """async ({ pageUrl, requireOfficial }) => {
          const tabs = await chrome.tabs.query({});
          const tab = tabs.find((candidate) => candidate.url === pageUrl);
          if (!tab?.id) throw new Error(`Could not find fixture tab: ${pageUrl}`);
          return chrome.tabs.sendMessage(tab.id, {
            type: "RUN_SCHEDULED_UI_CHECK",
            requireOfficial,
          });
        }""",
        {"pageUrl": page_url, "requireOfficial": require_official},
    )


def run_debug_health_check(worker: Worker, page_url: str) -> dict[str, Any]:
    return worker.evaluate(
        """async (pageUrl) => {
          // Port 9 is intentionally unavailable. The test verifies that an
          // otherwise valid UI_DRIFT is retained in the extension queue rather
          // than writing a fixture record to a real local backend.
          await chrome.storage.local.set({
            runnerConfig: {
              serverUrl: "http://127.0.0.1:9",
              runnerId: "ui-health-e2e",
            },
          });
          const tabs = await chrome.tabs.query({});
          const tab = tabs.find((candidate) => candidate.url === pageUrl);
          if (!tab?.id) throw new Error(`Could not find fixture tab: ${pageUrl}`);
          return globalThis.vahanUiHealthDebug.runOnTab(tab.id);
        }""",
        page_url,
    )


def assert_drift(response: dict[str, Any], code: str, selector: str | None = None) -> None:
    assert response["ok"] is False, response
    report = response["uiDrift"]
    assert report["code"] == code, report
    if selector is not None:
        assert report["diagnostics"]["selector"] == selector, report


def run() -> None:
    # `runOnTab` intentionally allows only the two documented local ports.
    server, _thread = start_fixture_server(port=8765)
    profile_dir = Path(tempfile.mkdtemp(prefix="vahan-ui-health-e2e-"))
    base_url = f"http://127.0.0.1:{server.server_port}/analytics/vahanpublicreport"

    try:
        with sync_playwright() as playwright:
            context = playwright.chromium.launch_persistent_context(
                user_data_dir=str(profile_dir),
                headless=False,
                args=[
                    f"--disable-extensions-except={EXTENSION_DIR}",
                    f"--load-extension={EXTENSION_DIR}",
                    "--no-first-run",
                    "--no-default-browser-check",
                    "--disable-gpu",
                ],
                viewport={"width": 1440, "height": 1100},
            )
            try:
                page = context.pages[0] if context.pages else context.new_page()
                page.set_default_timeout(20_000)
                worker = service_worker(context)

                baseline_url = open_fixture(page, base_url, "baseline")
                baseline = run_content_health_check(worker, baseline_url)
                assert baseline["ok"] is True, baseline
                assert baseline["contract"]["dataSnapshot"]["controls"]["fuel"]["optionCount"] > 0
                print("UI HEALTH CONTENT BASELINE PASS")

                visual_url = open_fixture(page, base_url, "visual-only")
                visual_only = run_content_health_check(worker, visual_url)
                assert visual_only["ok"] is True, visual_only
                print("UI HEALTH CONTENT VISUAL-ONLY PASS")

                for mode, (code, selector) in SCENARIO_EXPECTATIONS.items():
                    scenario_url = open_fixture(page, base_url, mode)
                    response = run_content_health_check(worker, scenario_url)
                    assert_drift(response, code, selector)
                    print(f"UI HEALTH CONTENT SCENARIO PASS mode={mode} code={code}")

                baseline_url = open_fixture(page, base_url, "baseline")
                runtime_case = page.evaluate(
                    """() => window.vahanFixture.runDevCase("duplicate-fuel-search")"""
                )
                assert runtime_case["caseId"] == "duplicate-fuel-search", runtime_case
                assert runtime_case["expectedCode"] == "UI_DRIFT_SEARCH_INPUT", runtime_case
                assert runtime_case["applied"] is True, runtime_case
                runtime_response = run_content_health_check(worker, baseline_url)
                assert_drift(runtime_response, "UI_DRIFT_SEARCH_INPUT")
                print("UI HEALTH CONTENT DEVTOOLS-CASE-LOG PASS case=duplicate-fuel-search")

                baseline_url = open_fixture(page, base_url, "baseline")
                page.evaluate(
                    """() => {
                      const fuel = document.querySelector("#vehicleFuel");
                      if (!fuel) throw new Error("Fixture Fuel control is missing before ID mutation.");
                      fuel.id = "vehicleFuelRenamedInDevTools";
                    }"""
                )
                id_changed = run_content_health_check(worker, baseline_url)
                assert_drift(id_changed, "UI_DRIFT_REQUIRED_CONTROL", "#vehicleFuel")
                assert id_changed["uiDrift"]["diagnostics"]["count"] == 0
                print("UI HEALTH CONTENT DEVTOOLS-ID-CHANGE PASS code=UI_DRIFT_REQUIRED_CONTROL")

                wrong_page = run_content_health_check(worker, baseline_url, require_official=True)
                assert_drift(wrong_page, "UI_DRIFT_WRONG_PAGE")
                print("UI HEALTH CONTENT OFFICIAL-URL-GUARD PASS")

                persisted = run_debug_health_check(worker, baseline_url)
                assert persisted["status"] == "UI_DRIFT", persisted
                assert persisted["trigger"] == "devtools", persisted
                assert persisted["report"]["code"] == "UI_DRIFT_REQUIRED_CONTROL", persisted
                assert persisted["backendLog"]["queued"] is True, persisted
                state = worker.evaluate(
                    """() => chrome.storage.local.get([
                      "vahanUiHealthCheck",
                      "vahanUiHealthPendingLogs",
                    ])"""
                )
                assert state["vahanUiHealthCheck"]["checkId"] == persisted["checkId"], state
                assert state["vahanUiHealthPendingLogs"][0]["report"]["code"] == "UI_DRIFT_REQUIRED_CONTROL", state
                print("UI HEALTH E2E DOM-TO-QUEUE PASS status=UI_DRIFT persisted=True")
            finally:
                context.close()
    finally:
        server.shutdown()
        server.server_close()
        shutil.rmtree(profile_dir, ignore_errors=True)


if __name__ == "__main__":
    run()
