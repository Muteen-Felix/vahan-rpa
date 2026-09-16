"""Read-only live smoke test for the supported VAHAN UI contract.

This test deliberately stops before CAPTCHA and Apply.  It is safe to run as a
scheduled health check and should fail loudly when the vendor changes the DOM
contract used by the automation.
"""

from playwright.sync_api import sync_playwright

from poc_vahan import URL
from ui_contract import UIDriftError, assert_ui_contract


def run() -> int:
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            page.goto(URL, wait_until="networkidle")
            contract = assert_ui_contract(page, step="scheduled-preflight")
            print(
                "UI CONTRACT PASS "
                f"version={contract['contract_version']} signature={contract['signature']}"
            )
            return 0
        except UIDriftError as error:
            print(f"UI CONTRACT FAIL code={error.code} step={error.step} message={error}")
            return 2
        finally:
            browser.close()


if __name__ == "__main__":
    raise SystemExit(run())
