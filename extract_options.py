from playwright.sync_api import sync_playwright
import json

URL = "https://analytics.parivahan.gov.in/analytics/vahanpublicreport?lang=en"

def extract_all_options():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.goto(URL, wait_until="networkidle")

        data = page.evaluate("""() => {
            const results = {};

            // 1. All standard <select> elements
            const selectIds = [
                'reportType', 'financialYearSelect', 'stateName', 'rtoCode',
                'vehicleEmission', 'vehicleMaker', 'vehicleCategoryGroup',
                'vehicleSubCategory', 'vehicleClass', 'vehicleFuel', 'evType',
                'vehicleStatus', 'vehicleOwnerType', 'vehicleType',
                'fitnessCheck', 'delhiNcr', 'yAxis', 'xAxis'
            ];

            selectIds.forEach(id => {
                const el = document.getElementById(id);
                if (!el) {
                    results[id] = { found: false };
                    return;
                }
                const options = Array.from(el.options).map((opt, idx) => ({
                    index: idx,
                    value: opt.value,
                    text: opt.text.trim(),
                    label: opt.getAttribute('label') || opt.text.trim(),
                    selected: opt.selected,
                    disabled: opt.disabled
                }));

                // Check custom multiselect UI
                let multiContainer = null;
                let next = el.nextElementSibling;
                while (next) {
                    if (next.classList && next.classList.contains('multiselect-dropdown')) {
                        multiContainer = next;
                        break;
                    }
                    next = next.nextElementSibling;
                }

                let multiItems = [];
                let hasAll = false;
                if (multiContainer) {
                    multiItems = Array.from(multiContainer.querySelectorAll('[data-search-text]')).map(item => ({
                        searchText: item.getAttribute('data-search-text'),
                        text: item.innerText.trim()
                    }));
                    hasAll = !!multiContainer.querySelector('.multiselect-dropdown-all-selector');
                }

                results[id] = {
                    found: true,
                    tagName: el.tagName,
                    multiple: el.multiple,
                    totalOptions: options.length,
                    options: options,
                    hasMultiselectUI: !!multiContainer,
                    hasAllSelector: hasAll,
                    multiselectItemsCount: multiItems.length
                };
            });

            return results;
        }""")

        with open("vahan_options.json", "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)

        print(f"Extracted options for {len(data)} selectors to vahan_options.json")
        for k, v in data.items():
            tot = v.get("totalOptions", 0)
            multi_tot = v.get("multiselectItemsCount", 0)
            print(f"  {k:22}: {tot:3} options in <select> (multi UI items: {multi_tot:3})")

        browser.close()

if __name__ == "__main__":
    extract_all_options()
