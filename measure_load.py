"""Đo thời gian load thật của trang Vahan — dùng số này để chỉnh DEFAULT_TIMEOUT_MS
thay vì đoán mò 15000ms. Chạy độc lập, không đụng vào luồng filter/captcha."""
from playwright.sync_api import sync_playwright
from vahan_rpa_poc import launch_browser, step_load_page, URL

with sync_playwright() as p:
    browser, context, page = launch_browser(p, headless=True)
    try:
        elapsed = step_load_page(page)
        print(f"URL: {URL}")
        print(f"Thời gian load thật: {elapsed:.2f}s")
    except Exception as e:
        print(f"[measure_load] LỖI khi load trang: {type(e).__name__}: {e}")
    finally:
        browser.close()
