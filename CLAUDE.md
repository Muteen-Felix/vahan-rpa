# Working rules — vahan-rpa spike

## Bối cảnh
Đây là spike 3 tiếng (180 phút) đánh giá khả năng RPA trên trang Vahan (India) để
export Excel dữ liệu đăng ký xe. Nguồn sự thật cho tiến độ/kế hoạch và cho báo cáo:
- `time-line.md` — kế hoạch theo khối thời gian, phân role, các mốc deadline cứng.
- `bao-cao-vahan-rpa-poc.md` — template báo cáo, là **deliverable chính** của buổi.

Không có source nào khác. Nếu thiếu thông tin, để nguyên `___` hoặc dùng nhãn
`[BLOCKED]` — không tự bịa số liệu, không tự bịa requirement từ VF India.

## Roles (không tự đổi giữa buổi)
- **Role 1 — Baseline**: làm tay end-to-end, đo thời gian/số click, tải file
  baseline, đối chiếu file robot vs baseline (mục 3, 6), viết mục 1 (tóm tắt)
  **cuối cùng**.
- **Role 2 — Recon**: bắt request của nút Export bằng DevTools, dò selector,
  thử replay bằng HTTP client, bàn giao selector map cho Role 3 (mục 4).
  **Deadline cứng: phút 50.**
- **Role 3 — PoC**: dựng automation, không ngồi chờ Role 2, chạy lặp 3 lần,
  ghi lỗi/thời gian từng lần (mục 5).

Nếu được giao hỗ trợ một role, chỉ sửa đúng phần của role đó trong báo cáo;
việc của role khác thì comment, không tự sửa.

## Nhãn bắt buộc khi ghi nhận xét
- `[FACT]` = đã tự tay quan sát/đo được.
- `[ASSUMPTION]` = đang đoán, chưa kiểm chứng.
- `[BLOCKED]` = không làm được, phải ghi rõ lý do.
- Cấm dùng "hình như", "chắc là", "có vẻ". Hoặc đo được, hoặc `[BLOCKED]`.
- Ô trống (`___`) là thông tin hợp lệ — không tự điền đại cho đầy, không xoá ô
  trống thay bằng suy đoán.

## Quy tắc quan trọng nhất
1. **Phát hiện "replay request Export bằng HTTP client có được không"** là
   phát hiện giá trị nhất buổi — nếu YES thì hướng đi dài hạn đổi hẳn từ RPA
   UI sang gọi thẳng HTTP endpoint. Luôn ưu tiên kiểm tra/nêu bật kết quả này.
2. Đối chiếu file robot vs file baseline (số dòng, con số tổng, tên cột) là
   bước bắt buộc trước khi coi automation "chạy được". Tải sai dữ liệu mà
   không phát hiện nguy hiểm hơn crash.
3. Chạy 1 lần thành công không phải kết luận — cần chạy lặp ít nhất 3 lần.
4. Ở checkpoint phút 1:30, nếu luồng chưa chạy được thì cắt phạm vi (bỏ retry,
   bỏ xử lý lỗi, bỏ log đẹp) thay vì cố gỡ hết mọi lỗi.
5. Hard stop phút 2:20: ngừng sửa automation, chuyển sang viết báo cáo. Không
   đánh đổi mục 11 (tình trạng bàn giao) để lấy thêm thời gian debug.
6. Không tự đặt requirement thay VF India — câu hỏi chưa rõ thì đưa vào mục 10
   để hỏi mentor, không tự giả định rồi viết như thể đã được xác nhận.
7. **CẤM TUYỆT ĐỐI BYPASS CAPTCHA**: Nghiêm cấm mọi hành vi, ý định hoặc nghiên
   cứu giải/bypass CAPTCHA tự động (OCR, AI solver, dịch vụ bên thứ ba, v.v.).
   Xoá bỏ hoàn toàn mọi ý định bypass CAPTCHA trong dự án. Luôn tuân thủ quy định
   và chính sách hệ thống: chỉ sử dụng mô hình Attended RPA (con người trực tiếp
   quan sát và gõ CAPTCHA thủ công trên trình duyệt).

## Output discipline
- Deliverable là file `bao-cao-vahan-rpa-poc.md` đã điền đầy đủ, không phải
  tóm tắt trong chat.
- Không sửa phần báo cáo của role khác — nếu cần, để lại comment.
- Đính kèm khi hoàn tất: file baseline, file robot tải về, video quay màn
  hình, script/flow automation.
