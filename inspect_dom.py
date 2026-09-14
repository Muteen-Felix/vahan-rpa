"""
Script do DOM mot lan, KHONG phai automation flow - chi de tim id/name that cua
cac hidden <select> tren trang (vd Fuel), thay vi doan mo.
Chay xong tu dong dong browser, khong can nguoi cho.
"""
from playwright.sync_api import sync_playwright

URL = "https://analytics.parivahan.gov.in/analytics/vahanpublicreport?lang=en"


def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.goto(URL, wait_until="networkidle")

        print("=== Tat ca <select> tren trang ===")
        selects = page.locator("select")
        n = selects.count()
        print(f"count={n}")
        for i in range(n):
            el = selects.nth(i)
            id_ = el.get_attribute("id")
            name_ = el.get_attribute("name")
            multiple = el.get_attribute("multiple")
            cls = el.get_attribute("class")
            print(f"  [{i}] id={id_!r} name={name_!r} multiple={multiple!r} class={cls!r}")

        print("\n=== Tat ca div.multiselect-dropdown tren trang ===")
        dds = page.locator("div.multiselect-dropdown")
        n2 = dds.count()
        print(f"count={n2}")
        for i in range(n2):
            el = dds.nth(i)
            cls = el.get_attribute("class")
            # lay text ngan gon cua no de doan no la dropdown gi
            txt = el.inner_text()[:60].replace("\n", " | ").encode("ascii", "replace").decode("ascii")
            print(f"  [{i}] class={cls!r} text={txt!r}")

        browser.close()


if __name__ == "__main__":
    run()
