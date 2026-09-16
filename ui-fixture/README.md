# VAHAN UI fixture

Đây là bản clone local có kiểm soát của trang `VAHAN REPORT` dùng để test UI
drift. Fixture giữ lại bố cục chính của trang live (header, navigation, sidebar
Report Filters, Y-Axis/X-Axis, CAPTCHA, Apply, bảng kết quả và footer), toàn bộ
control contract mà RPA đang dùng, cùng snapshot lựa chọn/ràng buộc tại ngày
`2026-09-15`.

Snapshot trong `analytics/vahanpublicreport/fixture-data.js` gồm 36 bang, toàn
bộ danh sách RTO động đã thu được từ `json_rtos`, 58 năm tài chính, 58 năm báo
cáo, 76 lớp xe, 34 loại nhiên liệu, 27 loại chủ xe, 26 chuẩn phát thải và các
lựa chọn EV/status/category. Maker được lấy hết từ lazy endpoint của trang
live (7.734 lựa chọn; HTML ban đầu chỉ render 5 lựa chọn đầu tiên), cùng thuộc
tính giới hạn tối đa 10 maker được mô phỏng đầy đủ.

Fixture cũng mô phỏng các ràng buộc chính: Year Type điều khiển nhóm ngày/năm,
State tải lại danh sách RTO trong snapshot và bật RTO, Y-Axis sinh X-Axis theo
15 nhánh của trang live, các select nhiều lựa chọn có search/All, giới hạn
maker, kiểm tra khoảng năm/ngày, đồng bộ hidden fields và refresh CAPTCHA giả.

Fixture không gửi request đến hệ thống Ấn Độ và không xử lý CAPTCHA thật.

## Chạy thủ công

Từ thư mục repository:

```bash
python3 -m http.server 8765 --directory ui-fixture
```

Mở trang baseline:

`http://127.0.0.1:8765/analytics/vahanpublicreport?lang=en&ui=baseline`

Để bật bảng điều khiển dành cho developer, thêm `&dev=1`. Bảng này cho phép
xóa `#vehicleFuel`, xóa option `Two Wheeler` hoặc tạo duplicate dropdown ngay
trong lúc trang đang mở. Có thể đổi `reportType`, chọn Delhi trong State để
kiểm tra 23 RTO Delhi, chọn Financial Year/1 Month Flexible và thử từng Y/X-Axis
branch trực tiếp trên fixture.

## Các kịch bản UI drift

Thay `ui=baseline` bằng một trong các giá trị sau:

- `missing-fuel`: xóa control `#vehicleFuel`.
- `renamed-fuel`: mô phỏng control Fuel bị đổi tên/ID.
- `wrong-type`: Category không còn là multi-select.
- `wrong-label`: mất option `Two Wheeler`.
- `missing-yaxis-option`: mất option Y-Axis `Fuel`.
- `wrong-wrapper`: có hai wrapper Fuel.
- `moved-wrapper`: wrapper Fuel ra ngoài field group.
- `missing-apply`: mất nút Apply.
- `visual-only`: chỉ đổi màu giao diện; contract vẫn hợp lệ.

Khi contract bị phá, Extension phải báo lỗi ở hai kênh:

1. Người dùng: badge `Cần cập nhật tool`, thông báo dừng, nút chạy bị khóa và
   panel `Chi tiết thay đổi UI` chỉ rõ vị trí, mong đợi, thực tế, bước và mã lỗi.
2. Developer: `console.error` với cùng report có cấu trúc (`target`, `expected`,
   `actual`, `action`) và mã `UI_DRIFT_*` trong DevTools Console.

Ví dụ khi xóa Fuel lúc runtime, người dùng thấy vị trí
`Fuel (#vehicleFuel)` và `DOM đang có 0 control`; khi mất option, thông báo
chuyển sang đúng vùng `Category Group (#vehicleCategoryGroup)` cùng tên option
`Two Wheeler`.

Sau khi sửa `manifest.json`, vào `chrome://extensions`, bật Developer mode và
bấm Reload cho extension `VAHAN RPA Assistant`. Manifest đã cho phép `localhost`
và `127.0.0.1` chỉ để chạy fixture local.

## Chạy test tự động

```bash
python3 test_ui_diagnostics.py
python3 test_ui_fixture_contract.py
python3 test_ui_fixture_extension.py
python3 test_ui_fixture_full_flow.py
python3 test_ui_fixture_surface.py
```

Test tự mở Chromium với Extension, kiểm tra baseline, sau đó xóa Fuel runtime
để xác nhận cảnh báo developer + người dùng và trạng thái fail-closed.
Test full-flow dùng CAPTCHA giả trong fixture để kiểm tra thêm Apply, reload,
download và xác nhận hoàn tất của Extension.
Test surface kiểm tra đầy đủ số lượng control/option, form attributes, 13
multiselect, toàn bộ 15 nhánh X-Axis, State -> RTO và bốn nhánh Year Type.
