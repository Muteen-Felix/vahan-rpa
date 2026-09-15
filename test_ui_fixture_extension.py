"""Integration test for the local VAHAN UI-drift fixture and browser extension."""

from __future__ import annotations

import functools
import shutil
import tempfile
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from playwright.sync_api import sync_playwright

from ui_contract import assert_ui_contract


REPOSITORY_DIR = Path(__file__).resolve().parent
FIXTURE_DIR = REPOSITORY_DIR / "ui-fixture"
EXTENSION_DIR = REPOSITORY_DIR / "extension-spike"


class QuietFixtureHandler(SimpleHTTPRequestHandler):
    """Serve fixture assets without making test output noisy."""

    def log_message(self, *_args):
        return


def start_fixture_server() -> tuple[ThreadingHTTPServer, threading.Thread]:
    handler = functools.partial(QuietFixtureHandler, directory=str(FIXTURE_DIR))
    server = ThreadingHTTPServer(("127.0.0.1", 0), handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    return server, thread


def wait_for_ready_card(page) -> None:
    page.wait_for_selector("#vahan-rpa-card", state="visible", timeout=20_000)


def run() -> None:
    server, _thread = start_fixture_server()
    profile_dir = Path(tempfile.mkdtemp(prefix="vahan-fixture-extension-"))
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
                page.set_default_timeout(20_000)
                console_errors: list[str] = []
                page.on(
                    "console",
                    lambda message: console_errors.append(message.text)
                    if message.type == "error"
                    else None,
                )

                page.goto(f"{base_url}?lang=en&ui=baseline", wait_until="networkidle")
                wait_for_ready_card(page)
                contract = assert_ui_contract(page, step="fixture-baseline")
                assert page.locator("#vahan-badge").inner_text() == "Sẵn sàng"
                print(f"FIXTURE BASELINE PASS signature={contract['signature']}")

                page.evaluate("window.vahanFixture.removeFuelAtRuntime()")
                page.locator("#vahan-btn-start").click()
                page.wait_for_function(
                    "() => document.querySelector('#vahan-badge')?.textContent?.trim() === 'Cần cập nhật tool'",
                    timeout=20_000,
                )
                assert page.locator("#vahan-btn-start").is_disabled()
                assert any("[VAHAN RPA UI DRIFT]" in error for error in console_errors)
                print("FIXTURE RUNTIME DRIFT PASS user_banner=True developer_console=True fail_closed=True")

                page.goto(f"{base_url}?lang=en&ui=wrong-label", wait_until="networkidle")
                wait_for_ready_card(page)
                page.wait_for_function(
                    "() => document.querySelector('#vahan-badge')?.textContent?.trim() === 'Cần cập nhật tool'",
                    timeout=20_000,
                )
                assert page.locator("#vahan-btn-start").is_disabled()
                print("FIXTURE LOAD-TIME DRIFT PASS wrong-label=True fail_closed=True")
            finally:
                context.close()
    finally:
        server.shutdown()
        server.server_close()
        shutil.rmtree(profile_dir, ignore_errors=True)


if __name__ == "__main__":
    run()
