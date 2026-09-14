"""
Mo dropdown Fuel, liet ke TAT CA option ben trong (data-search-text) de xem
"All" duoc bieu dien the nao — option rieng, checkbox select-all, hay khong co
gi (de trong = mac dinh All). KHONG doan, doc that tu DOM.
"""
from playwright.sync_api import sync_playwright

URL = "https://analytics.parivahan.gov.in/analytics/vahanpublicreport?lang=en"


def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.goto(URL, wait_until="networkidle")

        container = page.locator(
            "xpath=//*[@id='vehicleFuel']/following::div[contains(@class,'multiselect-dropdown')][1]"
        )
        container.click()
        page.wait_for_timeout(500)

        print("=== HTML ben trong dropdown Fuel (khi chua go gi vao search) ===")
        html = container.inner_html()
        print(html[:4000].encode("ascii", "replace").decode("ascii"))

        print("\n=== Tat ca phan tu co data-search-text ===")
        opts = container.locator("[data-search-text]")
        n = opts.count()
        print(f"count={n}")
        for i in range(n):
            el = opts.nth(i)
            txt = el.get_attribute("data-search-text")
            print(f"  [{i}] data-search-text={txt!r}")

        print("\n=== Cac checkbox/input ben trong dropdown ===")
        inputs = container.locator("input")
        ni = inputs.count()
        print(f"count={ni}")
        for i in range(ni):
            el = inputs.nth(i)
            print(f"  [{i}] type={el.get_attribute('type')!r} id={el.get_attribute('id')!r} value={el.get_attribute('value')!r}")

        browser.close()


if __name__ == "__main__":
    run()
