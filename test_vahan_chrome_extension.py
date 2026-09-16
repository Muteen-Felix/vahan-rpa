"""Smoke test for the merged production extension on the local UI fixture."""

from __future__ import annotations

import functools
import shutil
import tempfile
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from playwright.sync_api import sync_playwright


REPOSITORY_DIR = Path(__file__).resolve().parent
FIXTURE_DIR = REPOSITORY_DIR / "ui-fixture"
EXTENSION_DIR = REPOSITORY_DIR / "vahan-chrome-extension"


class QuietFixtureHandler(SimpleHTTPRequestHandler):
    def log_message(self, *_args):
        return


def run() -> None:
    handler = functools.partial(QuietFixtureHandler, directory=str(FIXTURE_DIR))
    server = ThreadingHTTPServer(("127.0.0.1", 0), handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    profile_dir = Path(tempfile.mkdtemp(prefix="vahan-production-extension-"))
    base_url = f"http://127.0.0.1:{server.server_port}/analytics/vahanpublicreport"
    config = {
        "categoryGroups": "Two Wheeler",
        "fuels": "ELECTRIC(BOV)",
        "yAxis": "Fuel",
        "xAxis": "Vehicle Category Group",
        "autoApply": False,
        "autoExport": False,
    }

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
                root = page.locator("#vahan-rpa-floating-root")
                badge = root.locator(".badge")
                detail = root.locator(".drift-detail")
                start = root.locator(".start")

                page.goto(f"{base_url}?lang=en&ui=baseline", wait_until="networkidle")
                root.wait_for(state="attached")
                page.wait_for_function(
                    "() => document.querySelector('#vahan-rpa-floating-root')?.shadowRoot?.querySelector('.badge')?.textContent?.trim() === 'Sẵn sàng'",
                    timeout=20_000,
                )
                assert not detail.is_visible()
                print("PRODUCTION EXTENSION BASELINE PASS")

                worker = context.service_workers[0] if context.service_workers else None
                if worker is None:
                    context.wait_for_event("serviceworker", timeout=10_000)
                    worker = context.service_workers[0]
                worker.evaluate(
                    "config => chrome.storage.local.set({ vahanConfig: config })",
                    config,
                )

                start.click()
                page.wait_for_function(
                    "() => document.querySelector('#vahan-rpa-floating-root')?.shadowRoot?.querySelector('.status')?.textContent?.includes('Hãy nhập CAPTCHA')",
                    timeout=20_000,
                )
                assert page.locator("#vehicleCategoryGroup option:checked").all_text_contents() == ["Two Wheeler"]
                assert page.locator("#vehicleFuel option:checked").all_text_contents() == ["ELECTRIC(BOV)"]
                assert page.locator("#yAxis_hidden").input_value() == page.locator("#yAxis").input_value()
                assert page.locator("#xAxis_hidden").input_value() == page.locator("#xAxis").input_value()
                print("PRODUCTION EXTENSION FILL PASS category/fuel/axes=True")

                page.evaluate("window.vahanFixture.removeFuelAtRuntime()")
                start.click()
                page.wait_for_function(
                    "() => document.querySelector('#vahan-rpa-floating-root')?.shadowRoot?.querySelector('.badge')?.textContent?.trim() === 'Cần cập nhật tool'",
                    timeout=20_000,
                )
                assert start.is_disabled()
                assert detail.is_visible()
                detail_text = detail.inner_text()
                assert "Fuel (#vehicleFuel)" in detail_text
                assert "DOM đang có 0 control" in detail_text
                assert "UI_DRIFT_REQUIRED_CONTROL" in detail_text
                print("PRODUCTION EXTENSION RUNTIME DRIFT PASS target=Fuel")

                page.goto(f"{base_url}?lang=en&ui=wrong-label", wait_until="networkidle")
                root.wait_for(state="attached")
                page.wait_for_function(
                    "() => document.querySelector('#vahan-rpa-floating-root')?.shadowRoot?.querySelector('.badge')?.textContent?.trim() === 'Sẵn sàng'",
                    timeout=20_000,
                )
                start.click()
                page.wait_for_function(
                    "() => document.querySelector('#vahan-rpa-floating-root')?.shadowRoot?.querySelector('.badge')?.textContent?.trim() === 'Cần cập nhật tool'",
                    timeout=20_000,
                )
                assert detail.is_visible()
                detail_text = detail.inner_text()
                assert "Category Group (#vehicleCategoryGroup)" in detail_text
                assert "option 'Two Wheeler' phải tồn tại" in detail_text
                assert "UI_DRIFT_REQUIRED_OPTION" in detail_text
                print("PRODUCTION EXTENSION LOAD/RUN DRIFT PASS target=Category Group")
            finally:
                context.close()
    finally:
        server.shutdown()
        server.server_close()
        shutil.rmtree(profile_dir, ignore_errors=True)


if __name__ == "__main__":
    run()
