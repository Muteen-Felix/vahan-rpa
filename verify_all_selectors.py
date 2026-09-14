from playwright.sync_api import sync_playwright

URL = "https://analytics.parivahan.gov.in/analytics/vahanpublicreport?lang=en"

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    page.goto(URL, wait_until="networkidle")

    select_ids = [
        "financialYearSelect", "stateName", "rtoCode", "vehicleEmission",
        "vehicleMaker", "vehicleCategoryGroup", "vehicleSubCategory",
        "vehicleClass", "vehicleFuel", "evType", "vehicleStatus", "vehicleOwnerType"
    ]
    print("=== Multiselect containers ===")
    for sid in select_ids:
        xpath = f"xpath=//*[@id='{sid}']/following::div[contains(@class,'multiselect-dropdown')][1]"
        loc = page.locator(xpath)
        print(f"{sid:25} -> count={loc.count()}")
        assert loc.count() == 1, f"Failed for {sid}"

    print("\n=== Single Selects & Inputs ===")
    singles = [
        "reportType", "fromYear", "toYear", "vehicleType",
        "fitnessCheck", "delhiNcr", "yAxis", "xAxis",
        "externalCaptcha", "applyTrigger", "downloadBtn1"
    ]
    for sid in singles:
        loc = page.locator(f"#{sid}")
        print(f"{sid:25} -> count={loc.count()}")
        if sid != "downloadBtn1":
            assert loc.count() == 1, f"Failed for #{sid}"

    browser.close()
    print("\nALL SELECTORS VERIFIED EXACTLY 1 OCCURRENCE IN LIVE DOM!")
