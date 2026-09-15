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

Chrome Extension sử dụng cùng nguyên tắc trong `content.js`. Service worker
`background.js` xác nhận Browser thực sự tạo download trước khi hiển thị thành
công.

## Chạy kiểm tra

```bash
python3 test_ui_contract.py
python3 test_verify_file.py
python3 -m py_compile *.py
node --check extension-spike/content.js
node --check extension-spike/background.js
```

`test_ui_contract.py` chỉ đọc DOM và dừng trước CAPTCHA/Apply, phù hợp làm smoke
check định kỳ. Tuyệt đối không tự động giải hoặc bypass CAPTCHA.

## Khi VAHAN phát hành UI mới

- UI chỉ đổi màu/bố cục nhưng contract còn đúng: flow tiếp tục.
- Control, event, wrapper hoặc schema thay đổi: flow dừng, hiển thị bước lỗi và
  mã `UI_DRIFT_*`.
- Maintainer cập nhật adapter/contract sau khi kiểm thử live; không tự động chọn
   selector mơ hồ trong production.
