"""Surface and dependency coverage for the full local VAHAN UI fixture."""

from __future__ import annotations

from playwright.sync_api import sync_playwright

from test_ui_fixture_extension import start_fixture_server


EXPECTED_OPTION_COUNTS = {
    "#archivedFlags": 4,
    "#reportType": 4,
    "#financialYearSelect": 58,
    "#reportYear": 58,
    "#reportMonth": 13,
    "#stateName": 36,
    "#vehicleEmission": 26,
    "#vehicleMaker": 7734,
    "#vehicleCategoryGroup": 11,
    "#vehicleSubCategory": 17,
    "#vehicleClass": 76,
    "#vehicleFuel": 34,
    "#evType": 4,
    "#vehicleStatus": 11,
    "#vehicleOwnerType": 27,
    "#vehicleType": 3,
    "#fitnessCheck": 2,
    "#delhiNcr": 2,
    "#yAxis": 15,
    "#xAxis": 1,
}


def display_state(page, selector: str) -> str:
    return page.locator(selector).evaluate("element => getComputedStyle(element).display")


def run() -> None:
    server, _thread = start_fixture_server()
    base_url = f"http://127.0.0.1:{server.server_port}/analytics/vahanpublicreport"
    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(headless=True)
            page = browser.new_page(viewport={"width": 1440, "height": 1100})
            page.set_default_timeout(20_000)
            page.goto(f"{base_url}?lang=en&ui=baseline", wait_until="networkidle")

            assert page.locator("#vahanPublicForm").get_attribute("method") == "POST"
            assert page.locator("#vahanPublicForm").get_attribute("enctype") == "application/x-www-form-urlencoded"
            assert page.locator("#vahanPublicForm").get_attribute("action") == "/analytics/vahanpublicreport?lang=en"

            for selector, expected_count in EXPECTED_OPTION_COUNTS.items():
                assert page.locator(f"{selector} option").count() == expected_count, selector

            assert page.locator("#vehicleCategoryGroup option").all_inner_texts()[-1] == "Two Wheeler"
            assert page.locator("#vehicleFuel option").all_inner_texts()[0] == "BIO-CNG/BIO-GAS"
            assert page.locator("#yAxis option").all_inner_texts()[-1] == "Month Wise"
            assert page.locator("#vehicleMaker").get_attribute("multiselect-max-items") == "10"
            assert page.locator("#externalCaptcha").evaluate("element => element.required") is True
            assert page.locator("#captchaImage").get_attribute("alt") == "CAPTCHA image"
            assert page.locator("#captchaImg").count() == 1
            assert page.locator("#applyButton").count() == 1
            assert page.locator("#hiddenCaptchaField").get_attribute("name") == "captcha"

            # Every multiple select has the same local widget pattern as the
            # live page; Maker intentionally has no select-all row.
            assert page.locator("select[multiple]").count() == 13
            assert page.locator("div.multiselect-dropdown[data-for-select]").count() == 13
            assert page.locator('[data-for-select="vehicleMaker"] .multiselect-dropdown-all-selector').count() == 0
            assert page.locator('[data-for-select="vehicleFuel"] .multiselect-dropdown-all-selector').count() == 1

            # The lazy maker snapshot is large enough to exercise the real
            # maximum-selection constraint, not only its HTML attribute.
            maker = page.locator('[data-for-select="vehicleMaker"]')
            maker.locator(".multiselect-display").click()
            for index in range(11):
                maker.locator(".multiselect-option").nth(index).click()
            assert page.locator("#vehicleMaker option:checked").count() == 10
            assert "maximum 10" in page.locator("#makerError").inner_text()
            assert page.locator("#selectedMakers").input_value().count(",") == 9
            page.locator("#clearMaker").click()
            assert page.locator("#vehicleMaker option:checked").count() == 0

            # Report type controls reproduce the live visibility branches.
            page.select_option("#reportType", "1")
            assert display_state(page, "#financialYearDropdown") == "block"
            assert display_state(page, "#calendarDatePicker") == "none"
            assert display_state(page, "#timePeriodPicker") == "none"

            page.select_option("#reportType", "4")
            assert display_state(page, "#financialYearDropdown") == "none"
            assert display_state(page, "#calendarDatePicker") == "none"
            assert display_state(page, "#timePeriodPicker") == "none"

            page.select_option("#reportType", "9")
            assert display_state(page, "#timePeriodPicker") == "block"
            assert page.locator("#toDate").input_value() == "31 Jan 2026"

            page.select_option("#reportType", "0")
            assert display_state(page, "#calendarDatePicker") == "block"
            assert display_state(page, "#monthYearPicker") == "none"

            # Selecting Delhi exercises the state -> RTO dependency using the
            # captured production endpoint result, without a live request.
            page.locator('[data-for-select="stateName"] .multiselect-display').click()
            page.locator('[data-for-select="stateName"] .multiselect-option').filter(has_text="Delhi").click()
            page.wait_for_function("() => document.querySelectorAll('#rtoCode option').length === 23")
            assert not page.locator("#rtoCode").is_disabled()
            assert page.locator("#disableDropdown").evaluate("element => element.style.pointerEvents") == "auto"
            assert page.locator("#rtoCode option").first.inner_text() == "BURARI AUTO UNIT - DL53"
            assert page.locator("#rtoCode option").last.inner_text() == "WAZIRPUR - DL8"

            # All Y-Axis branches are represented and produce a non-empty,
            # duplicate-free X-Axis list from the captured live mapping.
            y_values = page.locator("#yAxis option").evaluate_all("elements => elements.map(element => element.value).filter(Boolean)")
            for y_value in y_values:
                page.select_option("#yAxis", y_value)
                page.locator("#yAxis").click()
                actual = page.locator("#xAxis option").evaluate_all("elements => elements.map(element => element.value)")
                expected = page.evaluate("value => [''].concat(window.VAHAN_FIXTURE_DATA.xAxisByY[value].map(option => option.value))", y_value)
                assert actual == expected, y_value
                assert len(actual) == len(set(actual)), y_value

            print("FIXTURE FULL SURFACE PASS controls=20 multiselects=13 makers=7734 rto_maps=36 axis_branches=15")
            browser.close()
    finally:
        server.shutdown()
        server.server_close()


if __name__ == "__main__":
    run()
