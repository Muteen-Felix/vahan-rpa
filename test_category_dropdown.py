"""
Test CO LAP — chi Category Group dropdown, chua ghep vao vahan_rpa_poc.py.
Muc dich: xac nhan info Role 2 dua co dung khong, TRUOC khi dien vao SELECTORS
cua script chinh (khoi 2 trong time-line.md).

Info Role 2 dua (chua verify):
- native select#vehicleCategoryGroup[multiple] ton tai nhung display:none
- UI that: .multiselect-dropdown (custom)
- search input: .multiselect-dropdown-search[placeholder="search"]
- option Two Wheeler: [data-search-text="TWO WHEELER"], checkbox nam trong option
- sau khi check phai click ra ngoai de dong dropdown

[ASSUMPTION] chua co selector rieng cho CONTAINER cua Category Group (phan biet
voi Fuel - ca hai deu la .multiselect-dropdown). Script nay dung xpath
"following::" tu #vehicleCategoryGroup de do container gan nhat - chi la doan
mo, PHAI nhin bang mat khi browser mo len de xac nhan click dung cho.
"""
import time
from playwright.sync_api import sync_playwright

from config import DOWNLOAD_DIR

URL = "https://analytics.parivahan.gov.in/analytics/vahanpublicreport?lang=en"


def run():
    with sync_playwright() as p:
        # start-maximized + viewport=None de Chrome bat len full man hinh that
        # (khong phai full man hinh browser, ma la maximize cua so - du de nhin ro).
        browser = p.chromium.launch(headless=False, args=["--start-maximized"])
        context = browser.new_context(accept_downloads=True, no_viewport=True)
        page = context.new_page()
        page.set_default_timeout(20000)

        print("[1] Mo trang...")
        page.goto(URL, wait_until="networkidle")
        print("    OK")

        print("[2] Tim hidden select #vehicleCategoryGroup...")
        hidden = page.locator("#vehicleCategoryGroup")
        print(f"    count={hidden.count()}")
        if hidden.count() == 0:
            print("    [BLOCKED] Khong thay #vehicleCategoryGroup tren trang nay."
                  " Dung lai, chup screenshot DOM, bao Role 2.")
            page.wait_for_timeout(120000)
            browser.close()
            return

        print("[3] Doan container = div.multiselect-dropdown gan nhat SAU hidden select (ASSUMPTION)...")
        container = page.locator(
            "xpath=//*[@id='vehicleCategoryGroup']/following::div[contains(@class,'multiselect-dropdown')][1]"
        )
        print(f"    count={container.count()}")
        if container.count() == 0:
            print("    [BLOCKED] Doan container sai. Can nguoi tu tay bam vao dropdown"
                  " Category Group tren browser, dung DevTools 'Inspect' de lay selector that.")
            page.wait_for_timeout(180000)
            browser.close()
            return

        print("[4] Click container de mo dropdown...")
        container.click()
        page.wait_for_timeout(500)

        print("[5] Go 'TWO WHEELER' vao o search (scope trong container, khong query toan trang)...")
        search_box = container.locator(".multiselect-dropdown-search[placeholder='search']").first
        print(f"    search_box count={search_box.count()}, visible={search_box.is_visible() if search_box.count() else 'N/A'}")
        search_box.fill("TWO WHEELER")
        page.wait_for_timeout(500)

        print("[6] Click option [data-search-text='TWO WHEELER'] (scope trong container)...")
        option = container.locator("[data-search-text='TWO WHEELER']").first
        print(f"    option count={option.count()}")
        option.scroll_into_view_if_needed()
        option.click()
        page.wait_for_timeout(500)

        print("[7] Click ra ngoai (body 2,2) de dong dropdown...")
        page.click("body", position={"x": 2, "y": 2})

        print(">>> DUNG LAI 90 GIAY de ban tu mat kiem tra: checkbox Two Wheeler"
              " co dang duoc tick khong, dropdown co dong khong.")
        page.wait_for_timeout(90000)

        browser.close()
        print("[done]")


if __name__ == "__main__":
    run()
