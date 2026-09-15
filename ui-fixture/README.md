# VAHAN UI fixture

Đây là bản clone local có kiểm soát của trang `VAHAN REPORT` dùng để test UI
drift. Fixture giữ lại bố cục chính của trang live (header, navigation, sidebar
Report Filters, Y-Axis/X-Axis, CAPTCHA, Apply, bảng kết quả và footer) cùng các
control contract mà RPA đang dùng.

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
trong lúc trang đang mở.

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

1. Người dùng: badge `Cần cập nhật tool`, thông báo dừng và nút chạy bị khóa.
2. Developer: `console.error` với mã `UI_DRIFT_*` trong DevTools Console.

Sau khi sửa `manifest.json`, vào `chrome://extensions`, bật Developer mode và
bấm Reload cho extension `VAHAN RPA Assistant`. Manifest đã cho phép `localhost`
và `127.0.0.1` chỉ để chạy fixture local.

## Chạy test tự động

```bash
python3 test_ui_fixture_extension.py
```

Test tự mở Chromium với Extension, kiểm tra baseline, sau đó xóa Fuel runtime
để xác nhận cảnh báo developer + người dùng và trạng thái fail-closed.
