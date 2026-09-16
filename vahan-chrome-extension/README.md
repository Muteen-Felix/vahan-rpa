# VAHAN RPA Chrome Extension

Chrome Extension Manifest V3 chạy trực tiếp trên máy client. Extension hỗ trợ toàn bộ filter của VAHAN, các chế độ thời gian, X/Y Axis và option động State → RTO/Maker. Người dùng tự nhập CAPTCHA và bấm Apply. Khi trang kết quả xuất hiện, extension có thể tự bấm nút Xlsx.

Các dropdown trong popup được đọc trực tiếp từ option hiện có trên trang mỗi lần mở. Dropdown nhiều lựa chọn có Search và Select All giống luồng VAHAN. RTO cập nhật theo State, X-Axis cập nhật theo Y-Axis; Maker dùng autocomplete từ endpoint lazy-load của VAHAN (tối đa 10 theo quy tắc trang). Các trường năm/ngày vẫn là ô nhập.

Trước khi điền và trước các bước phụ thuộc dữ liệu, extension chạy UI contract
fail-closed trong `ui-drift.js`. Contract kiểm tra trang, control, loại
multi-select, wrapper trong đúng `form-group`, control động và hidden fields của
hai trục. Nếu UI thay đổi, extension không tiếp tục thao tác; widget trên trang
hiển thị panel `Chi tiết thay đổi UI` với đúng vị trí (ví dụ
`Fuel (#vehicleFuel)`), mong đợi, thực tế, bước và mã `UI_DRIFT_*`. Cùng report
được gửi về popup khi lỗi xảy ra trong lúc popup yêu cầu điền bộ lọc.

## Cài vào Chrome

1. Mở `chrome://extensions`.
2. Bật **Developer mode**.
3. Chọn **Load unpacked**.
4. Chọn thư mục `vahan-chrome-extension`.
5. Mở `https://analytics.parivahan.gov.in/analytics/vahanpublicreport?lang=en`.
6. Bấm biểu tượng extension, chỉnh cấu hình rồi chọn **Điền bộ lọc**.
7. Nhập CAPTCHA và bấm **Apply** trên VAHAN.

Không tự động đọc, giải hoặc vượt CAPTCHA. Đây là attended RPA.

## Kiểm thử local

Fixture local có thể được dùng để kiểm tra cả luồng điền filter và cảnh báo UI
drift:

```bash
python3 test_vahan_chrome_extension.py
```

Kịch bản test xác nhận baseline, điền Category/Fuel/Y-Axis/X-Axis, thiếu Fuel
runtime và mất option `Two Wheeler`. Khi test trên fixture, manifest đã cho phép
`localhost` và `127.0.0.1`; khi phát hành thật, chỉ giữ host VAHAN cần thiết.
