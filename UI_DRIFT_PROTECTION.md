# UI Drift Protection

## Mục tiêu

VAHAN là hệ thống bên ngoài, nên thay đổi giao diện không được biến thành
selector sai hoặc dữ liệu sai. Flow dừng an toàn khi trang không còn khớp
contract đã được kiểm thử.

## Cơ chế hiện tại

1. `ui_contract.py` kiểm tra đúng trang báo cáo, các control bắt buộc, loại
   control, option quan trọng và wrapper của Category/Fuel.
2. Wrapper multiselect được tìm trong cùng `form-group` với `<select>` gốc,
   không tìm theo `following::div` trên toàn document.
3. Sau mỗi lần chọn, flow xác nhận cả checkbox/widget và giá trị của select gốc.
4. Sau Apply, flow kiểm tra lại UI contract và signature trước khi đọc kết quả.
5. File tải về phải là XLSX hợp lệ và có schema `Fuel`, `Two Wheeler`, `Total`.
6. UI drift tạo mã lỗi `UI_DRIFT_*`, ghi metadata chẩn đoán không chứa CAPTCHA
   và không đánh dấu chạy thành công.
7. Bộ định dạng chẩn đoán (`format_ui_drift`) chuyển lỗi thành thông báo có vị
   trí cụ thể, nguyên nhân mong đợi/thực tế, bước phát hiện và hướng xử lý.
   Extension hiển thị cùng nội dung trong panel `Chi tiết thay đổi UI`; Python
   ghi nó vào `ui_drift_notification` và trường `user_notification` của file
   diagnostic.

Health check production chỉ đọc DOM của tab VAHAN chính thức và không xử lý
CAPTCHA thật. Khi có nhiều thay đổi trong cùng một
lượt, extension giữ lỗi đầu tiên ở `report`, đồng thời lưu toàn bộ lỗi trong
`reports[]` và `errorCount`.

Chrome Extension sử dụng cùng nguyên tắc trong `content.js`. Service worker
`background.js` xác nhận Browser thực sự tạo download trước khi hiển thị thành
công. Bộ extension chính ở `vahan-chrome-extension/` dùng `ui-drift.js` làm
adapter contract chung cho popup và widget; `extension-spike/` được giữ làm
harness regression tương thích với các test cũ.

## Chạy kiểm tra

```bash
python3 test_ui_contract.py
python3 test_verify_file.py
python3 test_ui_diagnostics.py
python3 -m py_compile *.py
node --check extension-spike/content.js
node --check extension-spike/background.js
npm --prefix vahan-chrome-extension run check
PYTHONPATH=apps/api-server apps/api-server/.venv/bin/pytest -q
```

`test_ui_contract.py` chỉ đọc DOM và dừng trước CAPTCHA/Apply, phù hợp làm smoke
check định kỳ. Tuyệt đối không tự động giải hoặc bypass CAPTCHA.

## Khi VAHAN phát hành UI mới

- UI chỉ đổi màu/bố cục nhưng contract còn đúng: flow tiếp tục.
- Control, event, wrapper hoặc schema thay đổi: flow dừng, hiển thị bước lỗi và
  mã `UI_DRIFT_*`.
- Thông báo không dừng ở mã lỗi chung. Ví dụ khi Fuel bị xóa, người dùng và
  DevTools nhận đúng vị trí `Fuel (#vehicleFuel)`, trạng thái thực tế `DOM đang
  có 0 control`, cùng mã `UI_DRIFT_REQUIRED_CONTROL`. Khi option bị đổi tên,
  thông báo chỉ rõ `Category Group (#vehicleCategoryGroup)` và option
  `Two Wheeler` bị thiếu.
- Maintainer cập nhật adapter/contract sau khi kiểm thử live; không tự động chọn
   selector mơ hồ trong production.
