"""
Test co lap — Category Group + Fuel, noi tiep tu test_category_dropdown.py.
Chua ghep vao vahan_rpa_poc.py chinh (van dang cho Role 2 ban giao du selector map).

Da verify qua inspect_dom.py (KHONG doan mo):
- Category Group: hidden select id=vehicleCategoryGroup, name=vehicleCategoryGroup
- Fuel:           hidden select id=vehicleFuel,           name=vehicleFuels
Ca hai deu la <select multiple>, UI that la div.multiselect-dropdown ngay sau
select trong DOM order (pattern nay da verify dung cho Category bang mat thuong
o test_category_dropdown.py, ap dung tuong tu cho Fuel).

[ASSUMPTION - can chot] gia tri Fuel = "PETROL", lay tu bao-cao-vahan-rpa-poc_role1.md
muc 3.2 (Role 1 da ghi [FACT] dung PETROL trong baseline). Muc 0.1 (bo filter chuan
ca 3 nguoi dung chung) van con "___" cho Fuel — CHUA chinh thuc chot. Neu mentor/ca
nhom chot gia tri khac, doi FUEL_VALUE ben duoi.
"""
import time
from playwright.sync_api import sync_playwright

URL = "https://analytics.parivahan.gov.in/analytics/vahanpublicreport?lang=en"

CATEGORY_VALUE = "TWO WHEELER"
# [FACT] muc 0.1 bao cao da chot: Fuel = "All". Xac nhan qua inspect_fuel_options.py:
# "All" KHONG phai option thuong (khong co data-search-text) - la phan tu rieng
# div.multiselect-dropdown-all-selector, nam dau danh sach, tach biet voi cac
# option PETROL/DIESEL/... Dung ham select_all_checkbox() rieng, KHONG dung chung
# ham select_checkbox_dropdown() (ham do tim theo data-search-text, se khong thay "All").
FUEL_VALUE = "All"


def select_checkbox_dropdown(page, hidden_select_id: str, search_text: str, label: str):
    """
    Dung chung cho Category Group va Fuel — ca hai la <select multiple> an,
    UI that la div.multiselect-dropdown[1] ngay sau selector do trong DOM order.
    """
    print(f"[{label}] Tim hidden select #{hidden_select_id}...")
    hidden = page.locator(f"#{hidden_select_id}")
    assert hidden.count() == 1, f"[{label}] KHONG tim thay #{hidden_select_id}, count={hidden.count()}"

    container = page.locator(
        f"xpath=//*[@id='{hidden_select_id}']/following::div[contains(@class,'multiselect-dropdown')][1]"
    )
    assert container.count() == 1, f"[{label}] container count={container.count()}, xpath sai"

    print(f"[{label}] Click container mo dropdown...")
    container.click()
    page.wait_for_timeout(400)

    search_box = container.locator(".multiselect-dropdown-search[placeholder='search']").first
    assert search_box.count() == 1, f"[{label}] search box count={search_box.count()}"
    search_box.fill(search_text)
    page.wait_for_timeout(500)

    option = container.locator(f"div[data-search-text='{search_text}']").first
    assert option.count() == 1, f"[{label}] option '{search_text}' count={option.count()}"
    option.scroll_into_view_if_needed()
    option.click()
    page.wait_for_timeout(300)

    # verify checkbox that su duoc tick, khong chi tin click khong loi
    checkbox = container.locator(f"div[data-search-text='{search_text}'] input[type='checkbox']").first
    checked = checkbox.is_checked()
    print(f"[{label}] checkbox checked={checked}")
    assert checked, f"[{label}] click xong nhung checkbox KHONG duoc tick — co gi do sai"

    print(f"[{label}] Click ra ngoai de dong dropdown...")
    page.click("body", position={"x": 2, "y": 2})
    page.wait_for_timeout(300)


def select_all_checkbox(page, hidden_select_id: str, label: str):
    """
    Rieng cho case chon 'All' — day KHONG phai mot option trong danh sach
    (khong co data-search-text), ma la div.multiselect-dropdown-all-selector
    nam dau danh sach, tach biet voi cac option thuong. Xac nhan bang
    inspect_fuel_options.py, khong doan.
    """
    print(f"[{label}] Tim hidden select #{hidden_select_id}...")
    hidden = page.locator(f"#{hidden_select_id}")
    assert hidden.count() == 1, f"[{label}] KHONG tim thay #{hidden_select_id}, count={hidden.count()}"

    container = page.locator(
        f"xpath=//*[@id='{hidden_select_id}']/following::div[contains(@class,'multiselect-dropdown')][1]"
    )
    assert container.count() == 1, f"[{label}] container count={container.count()}, xpath sai"

    print(f"[{label}] Click container mo dropdown...")
    container.click()
    page.wait_for_timeout(400)

    all_selector = container.locator("div.multiselect-dropdown-all-selector input[type='checkbox']").first
    assert all_selector.count() == 1, f"[{label}] all-selector checkbox count={all_selector.count()}"
    all_selector.click()
    page.wait_for_timeout(300)

    checked = all_selector.is_checked()
    print(f"[{label}] All checkbox checked={checked}")
    assert checked, f"[{label}] click xong nhung checkbox 'All' KHONG duoc tick"

    print(f"[{label}] Click ra ngoai de dong dropdown...")
    page.click("body", position={"x": 2, "y": 2})
    page.wait_for_timeout(300)


def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False, args=["--start-maximized"])
        context = browser.new_context(accept_downloads=True, no_viewport=True)
        page = context.new_page()
        page.set_default_timeout(20000)

        print("[0] Mo trang...")
        page.goto(URL, wait_until="networkidle")
        print("    OK")

        select_checkbox_dropdown(page, "vehicleCategoryGroup", CATEGORY_VALUE, "Category Group")
        select_all_checkbox(page, "vehicleFuel", "Fuel")

        print("\n>>> CA HAI selector da verify checked=True bang code.")
        print(">>> DUNG 60 GIAY de ban tu mat kiem tra tren browser truoc khi dong.")
        page.wait_for_timeout(60000)

        browser.close()
        print("[done]")


if __name__ == "__main__":
    run()
