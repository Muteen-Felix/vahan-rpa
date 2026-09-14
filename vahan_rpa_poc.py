"""
Vahan RPA PoC — Role 3 skeleton (Playwright, sync API)

Cách dùng:
1. Khối 0-1: chạy trước, chưa cần điền SELECTORS.
2. Phút 50: nhận selector map từ Role 2 (mục 4.3 báo cáo), điền vào SELECTORS.
3. Khối 2: gọi run_flow() từng bước một để debug (page load -> filter -> apply -> export -> file).
4. Khối 4: gọi run_iterations(n=3) để đo lặp.

Không dùng sleep() cố định để chờ load — luôn dùng wait_for_selector/wait_for_load_state,
vì thời gian load thật của trang là dữ liệu cần đo (mục 3.2), không phải con số đoán trước.
"""

import time
from pathlib import Path
from playwright.sync_api import sync_playwright, TimeoutError as PWTimeout

from config import DOWNLOAD_DIR

# ── CẤU HÌNH (điền ở Khối 0) ────────────────────────────────────────────
URL = "https://analytics.parivahan.gov.in/analytics/vahanpublicreport?lang=en"  # từ mục 0.1 báo cáo — chốt bởi cả 3 người, không tự đổi
# [FACT] step_load_page() đo 4 lần (headless, sandbox dev): 6.9s / 3.6s / 4.1s / 3.7s
# — trung vị ~3.9s, đỉnh 6.9s. 20000ms = ~3x đỉnh đo được, chừa biên cho mạng thật/
# headful/CAPTCHA làm trang nặng hơn. Đo lại trên máy thật lúc chạy PoC (mục 3.2) —
# số đo ở đây lấy từ môi trường dev, không chắc đại diện cho mạng lúc thi.
DEFAULT_TIMEOUT_MS = 15000

# Apply kích hoạt query lọc dữ liệu ở server, khác bản chất với load trang tĩnh —
# tách timeout riêng thay vì dùng chung DEFAULT_TIMEOUT_MS của context. Chưa có số đo
# thật cho riêng bước Apply (mục 5.2/5.3 sẽ cho số đó) nên tạm lấy bằng DEFAULT_TIMEOUT_MS,
# chỉnh lại khi có dữ liệu đo thật.
APPLY_TIMEOUT_MS = DEFAULT_TIMEOUT_MS

# ── SELECTOR MAP (điền sau khi nhận bàn giao từ Role 2, mục 4.3) ───────
# QUAN TRỌNG: các dropdown này KHÔNG phải <select> HTML gốc — là widget
# tag/multi-select tùy chỉnh (nhìn giống select2/ng-select/react-select).
# Role 2 phải xác định trong DevTools nó là loại nào và selector thật.
# Selector dưới đây là CHỖ ĐỂ Ở (placeholder pattern), không phải giá trị đúng.
SELECTORS = {
    "state_container": None,       # selector của cả khối dropdown State (để click mở)
    "year_from": None,             # ô "Year From" (input, không phải dropdown)
    "year_to": None,               # ô "Year To"
    # [FACT] verify bằng test_category_dropdown.py — chạy thật + xác nhận bằng mắt (Two Wheeler
    # được tick đúng chỗ, không lẫn sang Fuel). Container = div.multiselect-dropdown ngay sau
    # #vehicleCategoryGroup (hidden select) trong DOM order — dùng XPath following:: vì trang
    # không có id/attribute riêng nào gắn thẳng vào div wrapper.
    "category_container": "xpath=//*[@id='vehicleCategoryGroup']/following::div[contains(@class,'multiselect-dropdown')][1]",
    # [FACT] verify bằng test_category_and_fuel.py — hidden select thật là id=vehicleFuel
    # (name=vehicleFuels), tìm bằng inspect_dom.py, KHÔNG đoán từ Category Group. Checkbox
    # tick xong được assert is_checked()==True bằng code (không chỉ tin click không lỗi).
    "fuel_container": "xpath=//*[@id='vehicleFuel']/following::div[contains(@class,'multiselect-dropdown')][1]",
    "yaxis_container": None,       # dropdown Y-Axis (pivot)
    "xaxis_container": None,       # dropdown X-Axis (pivot)
    "apply_button": None,
    "captcha_input": None,         # ô nhập CAPTCHA
    "download_excel_button": None, # nút "Download Excel Report" (KHÔNG phải CSV)
    # Đã xác nhận: click bất kỳ đâu cũng đóng được dropdown checkbox — không cần
    # selector riêng cho việc này, dùng click vào <body> (luôn tồn tại, xem hàm
    # select_checkbox_option bên dưới).
}

# Giá trị filter — phải khớp đúng mục 0.1 (bộ filter chuẩn cả 3 người dùng chung)
FILTER_VALUES = {
    "state": "___",
    "year_from": "___",
    "year_to": "___",
    "category_group": "Two Wheeler",
    # [FACT] mục 0.1 báo cáo đã chốt: Fuel = "All". Xác nhận qua inspect_fuel_options.py:
    # "All" KHÔNG phải option thường (không có data-search-text) — là phần tử riêng
    # div.multiselect-dropdown-all-selector, nằm đầu danh sách. KHÔNG dùng chung hàm
    # select_checkbox_option() cho case này, xem select_all_checkbox() trong
    # test_category_and_fuel.py.
    "fuel": "All",
    "yaxis": "Vehicle Category Group",
    "xaxis": "Fuel",
}


def select_checkbox_option(page, container_selector: str, option_text: str):
    """
    Cho dropdown dạng searchable multi-select với option là checkbox (xác nhận thực tế
    cho Category Group / Fuel — có scrollbar, nên phải scroll_into_view_if_needed trước
    khi click, nếu không Playwright sẽ click trượt hoặc báo lỗi 'not visible').
    Sau khi click checkbox, dropdown KHÔNG tự đóng (khác với dropdown chọn 1 giá trị) —
    xác nhận thực tế: click bất kỳ đâu cũng đóng được (Escape thì không). Dùng click
    vào góc <body> — phần tử luôn tồn tại, không cần selector riêng từ Role 2.
    """
    page.click(container_selector)
    page.keyboard.type(option_text)
    page.wait_for_timeout(300)  # debounce của widget search

    option = page.get_by_text(option_text, exact=True).first
    option.scroll_into_view_if_needed()
    option.click()

    # Click góc trên-trái body để tránh dính vào phần tử khác đang hiển thị ở giữa trang.
    page.click("body", position={"x": 2, "y": 2})


def select_all_checkbox(page, container_selector: str):
    """
    Riêng cho case chọn "All" trong dropdown checkbox (xác nhận thực tế cho Fuel qua
    inspect_fuel_options.py) — "All" KHÔNG phải option thường trong danh sách (không có
    data-search-text), mà là phần tử riêng div.multiselect-dropdown-all-selector nằm đầu
    danh sách. KHÔNG dùng select_checkbox_option() cho case này — nó tìm theo
    data-search-text, sẽ không thấy "All".
    """
    page.click(container_selector)
    page.wait_for_timeout(400)

    all_checkbox = page.locator(f"{container_selector} >> div.multiselect-dropdown-all-selector input[type='checkbox']").first
    all_checkbox.click()
    page.wait_for_timeout(300)

    page.click("body", position={"x": 2, "y": 2})


def select_from_custom_dropdown(page, container_selector: str, option_text: str):
    """
    Cho dropdown chọn-một-giá-trị (State, Y-Axis, X-Axis) — click text thường tự đóng dropdown.
    KHÔNG dùng hàm này cho Category Group/Fuel — dùng select_checkbox_option() thay thế.
    """
    page.click(container_selector)
    page.keyboard.type(option_text)
    page.wait_for_timeout(300)
    page.get_by_text(option_text, exact=True).first.click()


def launch_browser(p, headless=False):
    """headless=False trong lúc debug lần đầu — bạn cần TỰ MẮT thấy site chạy."""
    browser = p.chromium.launch(headless=headless)
    context = browser.new_context(accept_downloads=True)
    context.set_default_timeout(DEFAULT_TIMEOUT_MS)
    page = context.new_page()
    return browser, context, page


def step_load_page(page):
    """Bước 1: page load. Nếu fail ở đây -> vấn đề truy cập/geo-block (mục 3.1), chưa liên quan automation."""
    t0 = time.time()
    page.goto(URL, wait_until="networkidle")
    elapsed = time.time() - t0
    print(f"[step_load_page] OK, {elapsed:.1f}s")
    return elapsed


def step_apply_filters(page):
    """Bước 2-3: chọn filter (custom dropdown, không phải <select> gốc).
    Debug từng dropdown riêng trước khi ráp cả chuỗi — nếu 1 dropdown fail,
    đừng chạy tiếp các dropdown sau, sẽ che mất lỗi thật."""
    assert SELECTORS["state_container"], "Chưa nhận selector map từ Role 2"

    select_from_custom_dropdown(page, SELECTORS["state_container"], FILTER_VALUES["state"])
    page.wait_for_load_state("networkidle")  # State->RTO phụ thuộc nhau, chờ load lại

    page.fill(SELECTORS["year_from"], FILTER_VALUES["year_from"])
    page.fill(SELECTORS["year_to"], FILTER_VALUES["year_to"])

    select_checkbox_option(page, SELECTORS["category_container"], FILTER_VALUES["category_group"])
    assert FILTER_VALUES["fuel"] == "All", "FILTER_VALUES['fuel'] đổi khác 'All' — phải viết lại bằng " \
        "select_checkbox_option() thường (case 'All' dùng hàm riêng select_all_checkbox())"
    select_all_checkbox(page, SELECTORS["fuel_container"])

    # Cấu hình pivot Y-Axis/X-Axis — KHÔNG có trong time-line.md gốc, phát hiện từ ảnh thực tế
    select_from_custom_dropdown(page, SELECTORS["yaxis_container"], FILTER_VALUES["yaxis"])
    select_from_custom_dropdown(page, SELECTORS["xaxis_container"], FILTER_VALUES["xaxis"])

    print("[step_apply_filters] Đã điền xong filter, CHƯA bấm Apply (còn chờ CAPTCHA)")


def step_captcha_pause(page):
    """
    Tuân thủ quy định: CẤM TUYỆT ĐỐI BYPASS CAPTCHA.
    Luồng vận hành theo mô hình Attended RPA: người dùng trực tiếp quan sát
    và gõ CAPTCHA vào ô trên trình duyệt, script chỉ đợi tín hiệu để tiếp tục.
    Hàm này được gọi lại nếu nhập sai vì CAPTCHA đổi liên tục.
    """
    print(">>> Nhìn vào browser, đọc CAPTCHA HIỆN TẠI, gõ trực tiếp vào ô trên trang.")
    input(">>> Gõ xong CAPTCHA trên browser rồi nhấn Enter ở đây để script tiếp tục... ")


def step_apply_with_captcha_retry(page, max_attempts=3):
    """
    Thay thế cách làm 1-lần-rồi-xong. Xác nhận thực tế:
    - CAPTCHA sai -> Apply -> reload -> hiện 'Invalid CAPTCHA.' -> trang sinh CAPTCHA MỚI
    - Không thể sửa lại text CAPTCHA cũ rồi submit lại — bắt buộc đọc giá trị mới mỗi lần
    Vì vậy đây phải là vòng lặp: mỗi lần thử là một CAPTCHA khác nhau, không phải retry
    với cùng giá trị.
    """
    for attempt in range(1, max_attempts + 1):
        print(f"[captcha] Lần thử {attempt}/{max_attempts}")
        step_captcha_pause(page)  # người đọc CAPTCHA HIỆN TẠI trên trang, gõ vào
        page.click(SELECTORS["apply_button"], timeout=APPLY_TIMEOUT_MS)
        page.wait_for_load_state("networkidle", timeout=APPLY_TIMEOUT_MS)

        if page.get_by_text("Invalid CAPTCHA", exact=False).count() > 0:
            print("[captcha] Sai — trang đã tự sinh CAPTCHA mới, chuẩn bị thử lại")
            continue

        print("[captcha] Apply thành công")
        return True

    print(f"[captcha] Thất bại sau {max_attempts} lần — dừng, không đoán mò thêm")
    return False


def step_download_excel(page):
    """Bước cuối: bấm 'Download Excel Report' (KHÔNG bấm CSV) + bắt download event.
    Playwright xử lý download trực tiếp qua event, không qua OS Save-as dialog."""
    with page.expect_download(timeout=DEFAULT_TIMEOUT_MS) as download_info:
        page.click(SELECTORS["download_excel_button"])
    download = download_info.value

    dest = DOWNLOAD_DIR / download.suggested_filename
    download.save_as(dest)
    print(f"[step_download_excel] saved to {dest}")
    return dest


def verify_file(path: Path) -> dict:
    """Đừng tin đuôi file — kiểm tra thật. Trả về dict để log vào mục 3.3/6 báo cáo.
    Báo cáo mục 3.3 liệt kê 3 khả năng đội lốt cụ thể (xlsx thật / csv đội lốt /
    html đội lốt) nên verify_file phải phân biệt được cả 3, không chỉ OK-hay-không."""
    result = {"exists": path.exists(), "size_bytes": None, "real_format": None}
    if not result["exists"]:
        result["real_format"] = "file không tồn tại"
        return result

    result["size_bytes"] = path.stat().st_size
    if result["size_bytes"] == 0:
        result["real_format"] = "file rỗng (0 byte) — CẢNH BÁO"
        return result

    with open(path, "rb") as f:
        header = f.read(8)

    if header.startswith(b"PK"):
        result["real_format"] = "xlsx (zip-based, OK)"
    elif header[:4] == b"\xd0\xcf\x11\xe0":
        result["real_format"] = "xls cũ (OLE, định dạng khác xlsx) — kiểm tra lại yêu cầu"
    elif header.lower().startswith(b"<html") or header.lower().startswith(b"<!doc"):
        result["real_format"] = "html đội lốt xlsx — CẢNH BÁO"
    elif all(32 <= b < 127 or b in (9, 10, 13) for b in header):
        result["real_format"] = "csv/text đội lốt xlsx — CẢNH BÁO"
    else:
        result["real_format"] = f"unknown header: {header!r}"

    return result


def run_flow(headless=False):
    """Chạy 1 lần đầy đủ, in log từng bước — dùng ở Khối 2 để debug."""
    with sync_playwright() as p:
        browser, context, page = launch_browser(p, headless=headless)
        try:
            step_load_page(page)
            step_apply_filters(page)
            captcha_ok = step_apply_with_captcha_retry(page, max_attempts=3)
            if not captcha_ok:
                return {"success": False, "error": "Không vượt qua được CAPTCHA sau nhiều lần thử"}
            file_path = step_download_excel(page)
            info = verify_file(file_path)
            print(f"[verify] {info}")
            return {"success": True, "file": str(file_path), **info}
        except PWTimeout as e:
            print(f"[run_flow] TIMEOUT tại một bước — xem log phía trên để biết bước nào: {e}")
            return {"success": False, "error": str(e)}
        finally:
            browser.close()


def run_iterations(n=3):
    """Khối 4: chạy lặp n lần, không sửa code giữa các lần. Ghi kết quả vào mục 5.3.
    LƯU Ý: PHẢI headless=False vì mỗi lần chạy cần người đọc CAPTCHA mới —
    đây là giới hạn thật của PoC này (không unattended được), ghi rõ vào mục 9.2."""
    results = []
    for i in range(1, n + 1):
        print(f"\n=== Lần {i}/{n} ===")
        t0 = time.time()
        r = run_flow(headless=False)  # KHÔNG đổi sang True — captcha cần người thấy browser
        r["duration_s"] = round(time.time() - t0, 1)
        r["iteration"] = i
        results.append(r)

    success_count = sum(1 for r in results if r["success"])
    print(f"\nTỉ lệ thành công: {success_count}/{n}")
    return results


if __name__ == "__main__":
    # Khối 2: chạy 1 lần đầu để debug từng bước
    run_flow(headless=False)

    # Khối 4: khi đã chạy ổn, bỏ comment dòng dưới để đo lặp
    # run_iterations(n=3)
