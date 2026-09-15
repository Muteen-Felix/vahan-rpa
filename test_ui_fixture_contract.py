"""Contract matrix for the local VAHAN UI-drift fixture."""

from __future__ import annotations

import functools
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from playwright.sync_api import sync_playwright

from ui_contract import UIDriftError, assert_ui_contract


REPOSITORY_DIR = Path(__file__).resolve().parent
FIXTURE_DIR = REPOSITORY_DIR / "ui-fixture"


class QuietFixtureHandler(SimpleHTTPRequestHandler):
    def log_message(self, *_args):
        return


def run() -> None:
    handler = functools.partial(QuietFixtureHandler, directory=str(FIXTURE_DIR))
    server = ThreadingHTTPServer(("127.0.0.1", 0), handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    base_url = f"http://127.0.0.1:{server.server_port}/analytics/vahanpublicreport"

    expected_failures = {
        "missing-fuel": "UI_DRIFT_REQUIRED_CONTROL",
        "renamed-fuel": "UI_DRIFT_REQUIRED_CONTROL",
        "wrong-type": "UI_DRIFT_CONTROL_TYPE",
        "wrong-label": "UI_DRIFT_REQUIRED_OPTION",
        "missing-yaxis-option": "UI_DRIFT_REQUIRED_OPTION",
        "missing-apply": "UI_DRIFT_REQUIRED_CONTROL",
        "wrong-wrapper": "UI_DRIFT_MULTISELECT_WRAPPER",
        "moved-wrapper": "UI_DRIFT_MULTISELECT_WRAPPER",
    }

    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(headless=True)
            page = browser.new_page()
            page.set_default_timeout(20_000)

            for mode, expected_code in expected_failures.items():
                page.goto(f"{base_url}?lang=en&ui={mode}", wait_until="networkidle")
                try:
                    assert_ui_contract(page, step=f"fixture-{mode}")
                except UIDriftError as error:
                    assert error.code == expected_code, (mode, error.code, expected_code)
                    print(f"FIXTURE {mode} PASS code={error.code}")
                else:
                    raise AssertionError(f"{mode} unexpectedly passed contract validation")

            for mode in ("baseline", "visual-only"):
                page.goto(f"{base_url}?lang=en&ui={mode}", wait_until="networkidle")
                snapshot = assert_ui_contract(page, step=f"fixture-{mode}")
                print(f"FIXTURE {mode} PASS signature={snapshot['signature']}")

            browser.close()
    finally:
        server.shutdown()
        server.server_close()


if __name__ == "__main__":
    run()
