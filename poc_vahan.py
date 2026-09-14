"""Vahan RPA PoC — Role 3. Full Flow End-to-End đầy đủ 18 trường.
Attended RPA: người dùng chỉ tương tác TRONG BROWSER (đọc + gõ CAPTCHA), KHÔNG cần
quay lại terminal gõ Enter — Playwright tự poll DOM (wait_for_function) để biết
khi nào người đã gõ xong, rồi tự tiếp quản Apply -> Chờ bảng render -> Export Excel -> verify.

Hỗ trợ chạy full flow end-to-end cho toàn bộ 18 trường/filter trên Vahan Public Report.
"""

import sys
import time
import zipfile
from pathlib import Path

# Đảm bảo in tiếng Việt trên console Windows không bị lỗi cp1252
if sys.stdout.encoding != "utf-8":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

from openpyxl import load_workbook
from playwright.sync_api import sync_playwright, TimeoutError as PWTimeout

from config import DOWNLOAD_DIR

URL = "https://analytics.parivahan.gov.in/analytics/vahanpublicreport?lang=en"

# [FACT] Selector map đầy đủ toàn bộ 18+ phần tử trên trang
SELECTORS = {
    # ── Time / Period ──
    "report_type": "#reportType",
    "financial_year_container": "xpath=//*[@id='financialYearSelect']/following::div[contains(@class,'multiselect-dropdown')][1]",
    "year_from": "#fromYear",
    "year_to": "#toYear",

    # ── Geographic / Administrative ──
    "state_container": "xpath=//*[@id='stateName']/following::div[contains(@class,'multiselect-dropdown')][1]",
    "rto_container": "xpath=//*[@id='rtoCode']/following::div[contains(@class,'multiselect-dropdown')][1]",
    "delhi_ncr": "#delhiNcr",

    # ── Vehicle Attributes & Filters ──
    "emission_container": "xpath=//*[@id='vehicleEmission']/following::div[contains(@class,'multiselect-dropdown')][1]",
    "maker_container": "xpath=//*[@id='vehicleMaker']/following::div[contains(@class,'multiselect-dropdown')][1]",
    "category_container": "xpath=//*[@id='vehicleCategoryGroup']/following::div[contains(@class,'multiselect-dropdown')][1]",
    "subcategory_container": "xpath=//*[@id='vehicleSubCategory']/following::div[contains(@class,'multiselect-dropdown')][1]",
    "class_container": "xpath=//*[@id='vehicleClass']/following::div[contains(@class,'multiselect-dropdown')][1]",
    "fuel_container": "xpath=//*[@id='vehicleFuel']/following::div[contains(@class,'multiselect-dropdown')][1]",
    "ev_type_container": "xpath=//*[@id='evType']/following::div[contains(@class,'multiselect-dropdown')][1]",
    "status_container": "xpath=//*[@id='vehicleStatus']/following::div[contains(@class,'multiselect-dropdown')][1]",
    "owner_type_container": "xpath=//*[@id='vehicleOwnerType']/following::div[contains(@class,'multiselect-dropdown')][1]",
    "vehicle_type": "#vehicleType",
    "fitness_check": "#fitnessCheck",

    # ── Pivot Axes & Action Buttons ──
    "yaxis": "#yAxis",
    "xaxis": "#xAxis",
    "captcha_input": "#externalCaptcha",
    "apply_button": "#applyTrigger",
    "download_excel_button": "#downloadBtn1",
}

# [PRESET 1] Cấu hình chạy ĐẦY ĐỦ 100% tất cả 18 trường (Full Fields End-to-End)
PRESET_FULL_18_FIELDS = {
    "report_type": "CALENDAR YEAR",
    "year_from": "2026",
    "year_to": "2026",
    "delhi_ncr": "ALL STATES",          # BẮT BUỘC đặt trước state để tránh kích hoạt reset danh sách bang
    "state": "Delhi",
    "rto": "ALL",                        # Tải động sau khi chọn Delhi, chọn ALL
    "emission": "BHARAT STAGE VI",
    "maker": "BAJAJ AUTO LTD",           # Tìm và chọn qua AJAX multiselect search
    "category_group": "Two Wheeler",
    "sub_category": "TWO WHEELER(NT)",
    "vehicle_class": "M-Cycle/Scooter",
    "fuel": "PETROL",
    "ev_type": None,                     # Không áp dụng cho xe PETROL
    "status": "ACTIVE",
    "owner_type": "INDIVIDUAL",
    "vehicle_type": "Non-Transport",
    "fitness_check": "NO",
    "yaxis": "Vehicle Category Group",
    "xaxis": "Total Consolidated",
}

# [PRESET 2] Cấu hình Toàn quốc với Category Group chọn All (11 selected)
PRESET_NATIONAL_ALL_CATEGORIES = {
    "report_type": "CALENDAR YEAR",
    "year_from": "2026",
    "year_to": "2026",
    "state": None,
    "rto": None,
    "emission": None,
    "maker": None,
    "category_group": "ALL",             # "11 selected"
    "sub_category": None,
    "vehicle_class": None,
    "fuel": None,
    "ev_type": None,
    "status": None,
    "owner_type": None,
    "vehicle_type": None,
    "fitness_check": "NO",
    "delhi_ncr": "ALL STATES",
    "yaxis": "Vehicle Category Group",
    "xaxis": "Total Consolidated",
}

DEFAULT_FILTERS = PRESET_FULL_18_FIELDS

CAPTCHA_LENGTH = 6
CAPTCHA_WAIT_TIMEOUT_MS = 300_000  # 5 phút tối đa để người đọc và gõ CAPTCHA


def select_checkbox_option(page, container_selector: str, option_text: str, label: str):
    """Tìm và tick 1 checkbox option trong custom multiselect dropdown."""
    container = page.locator(container_selector)
    container.click()
    page.wait_for_timeout(350)

    # Nếu có ô search thì nhập để filter nhanh danh sách
    search_box = container.locator(".multiselect-dropdown-search").first
    if search_box.count() > 0:
        search_box.fill(option_text)
        # Chờ debounce và AJAX search (đặc biệt là Maker lazy-load) trả về kết quả
        page.wait_for_timeout(1200)

    # Thử tìm theo data-search-text dạng chuẩn hoặc uppercase
    text_upper = option_text.strip().upper()
    opt_locator = container.locator(f"div[data-search-text='{option_text}']")
    if opt_locator.count() == 0:
        opt_locator = container.locator(f"div[data-search-text='{text_upper}']")
    if opt_locator.count() == 0:
        opt_locator = container.locator(f"div[data-search-text]:has-text('{option_text}')")
    if opt_locator.count() == 0:
        opt_locator = container.locator("div[data-search-text]").first

    assert opt_locator.count() > 0, f"[{label}] Không tìm thấy option khớp '{option_text}'"
    target = opt_locator.first
    try:
        target.scroll_into_view_if_needed()
    except Exception:
        pass
    target.click()
    page.wait_for_timeout(300)

    # Click ra ngoài body để đóng dropdown
    page.click("body", position={"x": 2, "y": 2})
    page.wait_for_timeout(300)


def select_all_checkbox(page, container_selector: str, label: str):
    """Chọn ALL (tick vào checkbox select-all ở đầu danh sách)."""
    container = page.locator(container_selector)
    container.click()
    page.wait_for_timeout(350)

    all_checkbox = container.locator("div.multiselect-dropdown-all-selector input[type='checkbox']").first
    assert all_checkbox.count() > 0, f"[{label}] Không tìm thấy nút All Selector"
    all_checkbox.click()
    page.wait_for_timeout(300)

    page.click("body", position={"x": 2, "y": 2})
    page.wait_for_timeout(300)


def apply_multiselect(page, container_selector: str, value, label: str):
    """Áp dụng filter cho multiselect dropdown."""
    if value is None:
        return
    if value == "ALL" or value == ["ALL"]:
        print(f"    - [{label}] -> Chọn ALL")
        select_all_checkbox(page, container_selector, label)
    elif isinstance(value, str):
        print(f"    - [{label}] -> Chọn '{value}'")
        select_checkbox_option(page, container_selector, value, label)
    elif isinstance(value, (list, tuple)):
        for item in value:
            print(f"    - [{label}] -> Chọn '{item}'")
            select_checkbox_option(page, container_selector, str(item), label)


def apply_filters(page, filters=None):
    """Áp dụng đầy đủ toàn bộ 18 trường trên trang Vahan Public Report."""
    cfg = dict(DEFAULT_FILTERS)
    if filters:
        cfg.update(filters)

    print("  >>> Đang chọn đầy đủ 18 trường theo cấu hình:")

    # 1. Year Type
    if cfg.get("report_type"):
        print(f"    - [1/18] Year Type -> {cfg['report_type']}")
        page.select_option(SELECTORS["report_type"], label=cfg["report_type"])
        page.wait_for_timeout(300)

    # 2. From Year & To Year
    if cfg.get("year_from") and cfg.get("year_to"):
        print(f"    - [2/18] Year Range -> {cfg['year_from']} TO {cfg['year_to']}")
        page.fill(SELECTORS["year_from"], str(cfg["year_from"]))
        page.fill(SELECTORS["year_to"], str(cfg["year_to"]))

    # 3. Delhi NCR ? (LƯU Ý QUAN TRỌNG: Phải đặt TRƯỚC State! Khi thay đổi Delhi NCR,
    # trang sẽ kích hoạt filterStatesForDelhiNcr() xóa toàn bộ danh sách và làm mất State đã chọn)
    if cfg.get("delhi_ncr"):
        print(f"    - [3/18] Delhi NCR ? -> {cfg['delhi_ncr']}")
        page.select_option(SELECTORS["delhi_ncr"], label=cfg["delhi_ncr"])
        page.wait_for_timeout(400)

    # 4. State
    if cfg.get("state"):
        print(f"    - [4/18] State -> {cfg['state']}")
        apply_multiselect(page, SELECTORS["state_container"], cfg.get("state"), "State")
        # Đợi request /analytics/json_rtos tải danh sách RTO
        page.wait_for_timeout(1500)

    # 5. RTO
    if cfg.get("rto"):
        print(f"    - [5/18] RTO -> {cfg['rto']}")
        apply_multiselect(page, SELECTORS["rto_container"], cfg.get("rto"), "RTO")

    # 6. Emission
    if cfg.get("emission"):
        print(f"    - [6/18] Emission -> {cfg['emission']}")
        apply_multiselect(page, SELECTORS["emission_container"], cfg.get("emission"), "Emission")

    # 7. Maker
    if cfg.get("maker"):
        print(f"    - [7/18] Maker -> {cfg['maker']}")
        apply_multiselect(page, SELECTORS["maker_container"], cfg.get("maker"), "Maker")

    # 8. Category Group
    if cfg.get("category_group"):
        print(f"    - [8/18] Category Group -> {cfg['category_group']}")
        apply_multiselect(page, SELECTORS["category_container"], cfg.get("category_group"), "Category Group")

    # 9. Sub-Category
    if cfg.get("sub_category"):
        print(f"    - [9/18] Sub-Category -> {cfg['sub_category']}")
        apply_multiselect(page, SELECTORS["subcategory_container"], cfg.get("sub_category"), "Sub-Category")

    # 10. Class
    if cfg.get("vehicle_class"):
        print(f"    - [10/18] Class -> {cfg['vehicle_class']}")
        apply_multiselect(page, SELECTORS["class_container"], cfg.get("vehicle_class"), "Class")

    # 11. Fuel
    if cfg.get("fuel"):
        print(f"    - [11/18] Fuel -> {cfg['fuel']}")
        apply_multiselect(page, SELECTORS["fuel_container"], cfg.get("fuel"), "Fuel")

    # 12. EV Type
    if cfg.get("ev_type"):
        print(f"    - [12/18] EV Type -> {cfg['ev_type']}")
        apply_multiselect(page, SELECTORS["ev_type_container"], cfg.get("ev_type"), "EV Type")

    # 13. Status
    if cfg.get("status"):
        print(f"    - [13/18] Status -> {cfg['status']}")
        apply_multiselect(page, SELECTORS["status_container"], cfg.get("status"), "Status")

    # 14. Owner Type
    if cfg.get("owner_type"):
        print(f"    - [14/18] Owner Type -> {cfg['owner_type']}")
        apply_multiselect(page, SELECTORS["owner_type_container"], cfg.get("owner_type"), "Owner Type")

    # 15. Vehicle Type
    if cfg.get("vehicle_type"):
        print(f"    - [15/18] Vehicle Type -> {cfg['vehicle_type']}")
        page.select_option(SELECTORS["vehicle_type"], label=cfg["vehicle_type"])

    # 16. Fitness Valid as On Date?
    if cfg.get("fitness_check"):
        print(f"    - [16/18] Fitness Valid -> {cfg['fitness_check']}")
        page.select_option(SELECTORS["fitness_check"], label=cfg["fitness_check"])

    # 17. Y-Axis
    if cfg.get("yaxis"):
        print(f"    - [17/18] Y-Axis -> {cfg['yaxis']}")
        page.select_option(SELECTORS["yaxis"], label=cfg["yaxis"])
        # Bắt buộc dispatch click để kích hoạt hàm updateXAxisOptions() của trang
        page.locator(SELECTORS["yaxis"]).evaluate('el => el.dispatchEvent(new Event("click", {bubbles:true}))')
        page.wait_for_timeout(600)

    # 18. X-Axis
    if cfg.get("xaxis"):
        print(f"    - [18/18] X-Axis -> {cfg['xaxis']}")
        page.select_option(SELECTORS["xaxis"], label=cfg["xaxis"])
        page.wait_for_timeout(300)

    # Tự động focus vào ô CAPTCHA để người dùng gõ trực tiếp
    captcha_box = page.locator(SELECTORS["captcha_input"])
    captcha_box.scroll_into_view_if_needed()
    captcha_box.focus()
    print("  >>> Đã hoàn tất điền đủ các trường và focus vào ô CAPTCHA.")


def wait_for_captcha_typed(page, timeout_ms=CAPTCHA_WAIT_TIMEOUT_MS):
    """Attended mode: Tự động poll DOM #externalCaptcha và nhận diện khi người đã gõ xong 6 ký tự."""
    captcha_box = page.locator(SELECTORS["captcha_input"])
    captcha_box.scroll_into_view_if_needed()
    captcha_box.focus()
    print(
        f"    >>> Đã focus vào ô CAPTCHA trên browser. Đang chờ bạn gõ đủ {CAPTCHA_LENGTH} ký tự "
        f"(tối đa {timeout_ms / 1000:.0f}s)..."
    )
    page.wait_for_function(
        f"""
        () => {{
            const el = document.querySelector('{SELECTORS["captcha_input"]}');
            return !!el && el.value.trim().length >= {CAPTCHA_LENGTH};
        }}
        """,
        timeout=timeout_ms,
    )
    print("    >>> Đã phát hiện CAPTCHA được điền — Robot tiếp quản luồng: bấm Apply.")


def verify_file(path):
    """Kiểm tra và xác thực file Excel tải về."""
    result = {"path": str(path), "exists": path.exists()}
    if not result["exists"]:
        return result

    result["size_bytes"] = path.stat().st_size
    result["is_real_xlsx"] = zipfile.is_zipfile(path)
    if not result["is_real_xlsx"]:
        result["head"] = path.read_bytes()[:200]
        return result

    ws = load_workbook(path, read_only=True).active
    rows = [[c.value for c in r] for r in ws.iter_rows()]
    result["sheet"] = ws.title
    result["row_count_raw"] = len(rows)
    result["columns"] = rows[2] if len(rows) > 2 else None
    result["rows"] = rows
    return result


def run_once(iteration_label="Run 1 (Full 18 Fields)", max_captcha_attempts=3, filters=None):
    """Chạy 1 lượt end-to-end hoàn chỉnh:
    Mở trang -> Chọn đủ 18 trường -> Chờ CAPTCHA -> Bấm Apply -> Chờ bảng render -> Export Excel -> Verify file."""
    t0 = time.time()
    result = {"iteration": iteration_label}
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False, args=["--start-maximized"])
        context = browser.new_context(accept_downloads=True, no_viewport=True)
        page = context.new_page()
        try:
            print(f"\n{'=' * 60}")
            print(f"=== {iteration_label} ===")
            print(f"{'=' * 60}")

            print("[1/5] Mở trang Vahan Public Report...")
            t_step = time.time()
            page.goto(URL, wait_until="domcontentloaded")
            result["t_load_page_s"] = round(time.time() - t_step, 1)

            print("[2/5] Áp dụng full selector filters (toàn bộ các trường)...")
            t_step = time.time()
            apply_filters(page, filters=filters)
            result["t_apply_filters_s"] = round(time.time() - t_step, 1)

            print("[3/5] Chờ CAPTCHA (attended) + Apply...")
            t_step = time.time()
            applied = False
            captcha_attempts_used = 0
            for attempt in range(1, max_captcha_attempts + 1):
                captcha_attempts_used = attempt
                print(f"    -- Lần thử CAPTCHA {attempt}/{max_captcha_attempts} --")
                try:
                    wait_for_captcha_typed(page)
                except PWTimeout:
                    result["error"] = f"Hết {CAPTCHA_WAIT_TIMEOUT_MS/1000:.0f}s chờ người gõ CAPTCHA."
                    break

                page.click(SELECTORS["apply_button"])
                page.wait_for_load_state("networkidle")

                if page.get_by_text("Invalid CAPTCHA", exact=False).count() > 0:
                    print(f"    [CAPTCHA lần {attempt}] Gõ sai — trang tự đổi CAPTCHA mới (các trường filter vẫn giữ nguyên), hãy gõ lại mã mới.")
                    continue

                applied = True
                break

            result["t_captcha_apply_s"] = round(time.time() - t_step, 1)
            result["captcha_attempts_used"] = captcha_attempts_used

            if not applied:
                result.setdefault("error", f"Không vượt qua CAPTCHA sau {max_captcha_attempts} lần")
                result["success"] = False
                return result

            print("[4/5] Chờ bảng dữ liệu render xong (proxy: nút Export xuất hiện)...")
            t_step = time.time()
            page.wait_for_selector(SELECTORS["download_excel_button"], state="visible", timeout=30_000)
            result["t_wait_table_s"] = round(time.time() - t_step, 1)

            print("[5/5] Bấm nút Export Excel, tải file về máy...")
            t_step = time.time()
            with page.expect_download() as dl:
                page.click(SELECTORS["download_excel_button"])
            stamped_name = f"{int(t0)}_{dl.value.suggested_filename}"
            path = DOWNLOAD_DIR / stamped_name
            dl.value.save_as(path)
            result["t_download_s"] = round(time.time() - t_step, 1)

            print(f"  >>> Đã lưu file: {path.name}")
            verify = verify_file(path)
            result.update(verify)
            result["success"] = True

            print("\n" + "=" * 60)
            print("=== KẾT QUẢ ĐỐI CHIẾU FILE TẢI VỀ ===")
            print(f"  • File path: {path}")
            print(f"  • Size: {verify.get('size_bytes')} bytes")
            print(f"  • Định dạng thật: {'XLSX chuẩn' if verify.get('is_real_xlsx') else 'Không hợp lệ'}")
            print(f"  • Số dòng raw: {verify.get('row_count_raw')}")
            print(f"  • Cột dữ liệu: {verify.get('columns')}")
            if verify.get("rows"):
                last_row = verify["rows"][-1]
                print(f"  • Dòng tổng kết: {last_row}")
            print("=" * 60)

            return result

        except PWTimeout as e:
            result["success"] = False
            result["error"] = f"TIMEOUT: {e}"
            print(f"\n[LỖI TIMEOUT] {e}")
            return result
        except Exception as e:
            result["success"] = False
            result["error"] = f"{type(e).__name__}: {e}"
            print(f"\n[LỖI] {type(e).__name__}: {e}")
            return result
        finally:
            result["duration_s"] = round(time.time() - t0, 1)
            browser.close()


def run_iterations(n=3, filters=None):
    """Chạy lặp n lần để đo lường độ ổn định."""
    results = []
    for i in range(1, n + 1):
        r = run_once(iteration_label=f"Lần {i}/{n}", filters=filters)
        results.append(r)
        print(f"--- Kết quả lần {i}: success={r.get('success')} duration_s={r.get('duration_s')} ---")

    success_count = sum(1 for r in results if r.get("success"))
    print(f"\n=== TỔNG KẾT: {success_count}/{n} lần thành công ===")
    return results


if __name__ == "__main__":
    # Mặc định chạy cấu hình đầy đủ 100% tất cả các trường
    run_once("Full Flow End-to-End (Tất cả các trường)", filters=PRESET_FULL_18_FIELDS)
