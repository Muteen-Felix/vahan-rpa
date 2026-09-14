"""
Tự test verify_file() bằng file giả — chạy NGAY, không đợi có file Excel thật.
Không dùng framework test ngoài chuẩn thư viện, PoC 3 tiếng không cần thêm dependency.
"""
import zipfile
from pathlib import Path
from vahan_rpa_poc import verify_file

TMP = Path("./_test_files")
TMP.mkdir(exist_ok=True)

cases = []


def case(name, make_fn, expect_substr):
    path = TMP / name
    make_fn(path)
    result = verify_file(path)
    ok = expect_substr in (result["real_format"] or "")
    cases.append((name, ok, result))


def make_real_xlsx(path):
    # xlsx thật là file zip — không cần openpyxl, tự tạo zip tối thiểu là đủ để test header.
    with zipfile.ZipFile(path, "w") as z:
        z.writestr("[Content_Types].xml", "<Types/>")


def make_html(path):
    path.write_text("<html><body>Invalid CAPTCHA.</body></html>", encoding="utf-8")


def make_csv(path):
    path.write_text("state,year,total\nDL,2023,100\n", encoding="utf-8")


def make_empty(path):
    path.write_bytes(b"")


def make_old_xls(path):
    path.write_bytes(b"\xd0\xcf\x11\xe0" + b"\x00" * 20)


case("real.xlsx", make_real_xlsx, "xlsx (zip-based, OK)")
case("fake_html.xlsx", make_html, "html đội lốt")
case("fake_csv.xlsx", make_csv, "csv/text đội lốt")
case("empty.xlsx", make_empty, "file rỗng")
case("old_format.xls", make_old_xls, "xls cũ")

# file không tồn tại — không tạo file
missing_result = verify_file(TMP / "khong_ton_tai.xlsx")
cases.append(("khong_ton_tai.xlsx", "không tồn tại" in missing_result["real_format"], missing_result))

print(f"{'CASE':<20} {'PASS?':<8} DETAIL")
all_ok = True
for name, ok, result in cases:
    print(f"{name:<20} {'OK' if ok else 'FAIL':<8} {result}")
    all_ok = all_ok and ok

print()
print("TẤT CẢ PASS" if all_ok else "CÓ CASE FAIL — sửa verify_file() trước khi dùng với file thật")

# dọn dẹp
for f in TMP.glob("*"):
    f.unlink()
TMP.rmdir()
