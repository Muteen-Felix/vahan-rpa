"""Full attended-flow integration test against the local fixture.

This test uses a fixture CAPTCHA value only. It never sends a CAPTCHA value to
the real VAHAN portal.
"""

from __future__ import annotations

import shutil
import tempfile
from pathlib import Path

from playwright.sync_api import sync_playwright

from test_ui_fixture_extension import EXTENSION_DIR, start_fixture_server, wait_for_ready_card


def run() -> None:
    server, _thread = start_fixture_server()
    profile_dir = Path(tempfile.mkdtemp(prefix="vahan-fixture-full-flow-"))
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
                accept_downloads=True,
            )
            try:
                page = context.pages[0] if context.pages else context.new_page()
                page.set_default_timeout(30_000)
                page.goto(f"{base_url}?lang=en&ui=baseline", wait_until="networkidle")
                wait_for_ready_card(page)
                assert page.locator("#vahan-badge").inner_text() == "Sẵn sàng"

                page.locator("#vahan-btn-start").click()
                page.wait_for_function(
                    """() => {
                      const category = document.querySelectorAll('#vehicleCategoryGroup option:checked').length;
                      const fuel = document.querySelectorAll('#vehicleFuel option:checked').length;
                      const fuelTotal = document.querySelectorAll('#vehicleFuel option').length;
                      return category === 1 && fuel === fuelTotal &&
                        document.querySelector('#yAxis_hidden')?.value === 'vehicleFuel' &&
                        document.querySelector('#xAxis_hidden')?.value === 'vehicleCategoryGroup';
                    }""",
                    timeout=20_000,
                )
                assert page.locator("#vehicleCategoryGroup option:checked").count() == 1
                assert page.locator("#vehicleFuel option:checked").count() == page.locator("#vehicleFuel option").count()
                assert page.locator("#yAxis_hidden").input_value() == "vehicleFuel"
                assert page.locator("#xAxis_hidden").input_value() == "vehicleCategoryGroup"
                print("FIXTURE FULL FLOW FILTERS PASS")

                with page.expect_download(timeout=30_000) as download_info:
                    page.locator("#externalCaptcha").fill("ABC123")
                download = download_info.value
                wait_for_ready_card(page)
                page.wait_for_function(
                    "() => document.querySelector('#vahan-badge')?.textContent?.trim() === 'Thành công!'",
                    timeout=30_000,
                )
                assert download.suggested_filename == "vahan-fixture-report.xlsx"
                print(f"FIXTURE FULL FLOW PASS apply_reload_download=True file={download.suggested_filename}")
            finally:
                context.close()
    finally:
        server.shutdown()
        server.server_close()
        shutil.rmtree(profile_dir, ignore_errors=True)


if __name__ == "__main__":
    run()
