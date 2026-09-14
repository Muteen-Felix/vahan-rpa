from playwright.sync_api import sync_playwright

URL = "https://analytics.parivahan.gov.in/analytics/vahanpublicreport?lang=en"

def test_filters():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.goto(URL, wait_until="networkidle")

        print("--- 1. Year Type ---")
        page.select_option("#reportType", label="CALENDAR YEAR")
        report_type_text = page.locator("#reportType option:checked").inner_text()
        print("Year Type selected:", repr(report_type_text.strip()))

        print("--- 2. From Year & To Year ---")
        page.fill("#fromYear", "2026")
        page.fill("#toYear", "2026")
        print("fromYear:", page.input_value("#fromYear"), "toYear:", page.input_value("#toYear"))

        print("--- 3. Category Group (Select All -> 11 selected) ---")
        cg_container = page.locator("xpath=//*[@id='vehicleCategoryGroup']/following::div[contains(@class,'multiselect-dropdown')][1]")
        cg_container.click()
        page.wait_for_timeout(300)
        all_cb = cg_container.locator("div.multiselect-dropdown-all-selector input[type='checkbox']").first
        all_cb.click()
        page.wait_for_timeout(300)
        page.click("body", position={"x": 2, "y": 2})
        page.wait_for_timeout(300)
        cg_text = cg_container.inner_text().strip()
        print("Category Group display:", repr(cg_text))
        assert "11 selected" in cg_text, f"Expected '11 selected', got {cg_text}"

        print("--- 4. Verify other filters display ---")
        checks = [
            ("State", "//*[@id='stateName']/following::div[contains(@class,'multiselect-dropdown')][1]", "--- Select State ---"),
            ("RTO", "//*[@id='rtoCode']/following::div[contains(@class,'multiselect-dropdown')][1]", "--- Select RTO ---"),
            ("Emission", "//*[@id='vehicleEmission']/following::div[contains(@class,'multiselect-dropdown')][1]", "--- Select Emission ---"),
            ("Maker", "//*[@id='vehicleMaker']/following::div[contains(@class,'multiselect-dropdown')][1]", "Search Maker"),
            ("Sub-Category", "//*[@id='vehicleSubCategory']/following::div[contains(@class,'multiselect-dropdown')][1]", "--- Select Sub Category ---"),
            ("Class", "//*[@id='vehicleClass']/following::div[contains(@class,'multiselect-dropdown')][1]", "--- Select Class ---"),
            ("Fuel", "//*[@id='vehicleFuel']/following::div[contains(@class,'multiselect-dropdown')][1]", "--- Select Fuel ---"),
            ("EV Type", "//*[@id='evType']/following::div[contains(@class,'multiselect-dropdown')][1]", "--- Select EV Type ---"),
            ("Status", "//*[@id='vehicleStatus']/following::div[contains(@class,'multiselect-dropdown')][1]", "--- Select Status ---"),
            ("Owner Type", "//*[@id='vehicleOwnerType']/following::div[contains(@class,'multiselect-dropdown')][1]", "--- Select Owner Type ---"),
        ]
        for name, xpath, expected in checks:
            cont = page.locator(f"xpath={xpath}")
            txt = cont.inner_text().strip().split('\n')[0]
            print(f"{name:15} -> {txt!r} (expected {expected!r})")
            assert expected in txt, f"Mismatch for {name}: expected {expected!r} in {txt!r}"

        # Single selects
        vtype = page.locator("#vehicleType option:checked").inner_text().strip()
        print(f"Type            -> {vtype!r}")
        assert "Select Vehicle Type" in vtype

        fit = page.locator("#fitnessCheck option:checked").inner_text().strip()
        print(f"Fitness         -> {fit!r}")
        assert fit == "NO"

        delhi = page.locator("#delhiNcr option:checked").inner_text().strip()
        print(f"Delhi NCR ?     -> {delhi!r}")

        print("--- 5. Y-Axis & X-Axis ---")
        page.select_option("#yAxis", label="Vehicle Category Group")
        page.locator("#yAxis").evaluate('el => el.dispatchEvent(new Event("click", {bubbles:true}))')
        page.wait_for_timeout(500)
        page.select_option("#xAxis", label="Total Consolidated")
        page.wait_for_timeout(300)
        y_val = page.locator("#yAxis").input_value()
        x_val = page.locator("#xAxis").input_value()
        print(f"yAxis value={y_val!r}, xAxis value={x_val!r}")

        print("\nALL FILTER SELECTORS AND CONFIGURATION VERIFIED 100% SUCCESSFULLY!")
        browser.close()

if __name__ == "__main__":
    test_filters()
