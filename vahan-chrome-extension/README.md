# VAHAN RPA Chrome Extension

Chrome Extension Manifest V3 chạy trực tiếp trên máy client. Extension hỗ trợ toàn bộ filter của VAHAN, các chế độ thời gian, X/Y Axis và option động State → RTO/Maker. Người dùng tự nhập CAPTCHA và bấm Apply. Khi trang kết quả xuất hiện, extension có thể tự bấm nút Xlsx.

Các dropdown trong popup được đọc trực tiếp từ option hiện có trên trang mỗi lần mở. Dropdown nhiều lựa chọn có Search và Select All giống luồng VAHAN. RTO cập nhật theo State, X-Axis cập nhật theo Y-Axis; Maker dùng autocomplete từ endpoint lazy-load của VAHAN (tối đa 10 theo quy tắc trang). Các trường năm/ngày vẫn là ô nhập.

## Cài vào Chrome

1. Mở `chrome://extensions`.
2. Bật **Developer mode**.
3. Chọn **Load unpacked**.
4. Chọn thư mục `vahan-chrome-extension`.
5. Mở `https://analytics.parivahan.gov.in/analytics/vahanpublicreport?lang=en`.
6. Bấm biểu tượng extension, chỉnh cấu hình rồi chọn **Điền bộ lọc**.
7. Nhập CAPTCHA và bấm **Apply** trên VAHAN.

Không tự động đọc, giải hoặc vượt CAPTCHA. Đây là attended RPA.
