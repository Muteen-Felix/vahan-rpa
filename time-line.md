Tôi dựng template trước, rồi lên plan chi tiết bên dưới.Copy file này lên Google Docs hoặc Notion để 3 người sửa song song, đừng gửi file qua chat rồi mỗi người một bản.

---

# PLAN 3 TIẾNG (180 phút)

## Khối 0 — Đồng bộ (0:00 – 0:20) · Cả 3 người cùng làm

Đây là 20 phút quan trọng nhất. Bỏ qua là cả buổi hỏng.

- Cùng mở trang, cùng thấy nó load được.
- **Chốt bộ filter chuẩn** và ghi ngay vào mục 0.1 của báo cáo. Không ai được tự đổi sau đó.
- **Chốt công cụ automation** bằng đúng một câu hỏi: ai trong 3 người đã từng viết script chạy thật? Người đó chọn công cụ, người đó làm Role 3.
- Chia role, tạo file báo cáo dùng chung.

---

## Khối 1 — Chạy song song (0:20 – 0:50)

| | Role 1 — Baseline | Role 2 — Recon | Role 3 — PoC |
|---|---|---|---|
| Việc | Làm tay end-to-end, quay màn hình, bấm Export, lưu file gốc | Mở DevTools, bắt request của nút Export, dò selector | Dựng khung sẵn: cấu hình thư mục download, tắt hộp thoại Save as, viết hàm verify file |
| Không làm | Đừng lo đo chính xác vội, cứ chạy cho xong 1 vòng trước | Đừng sa đà mô tả toàn bộ trang, chỉ 6 phần tử trong selector map | **Đừng ngồi chờ Role 2** |
| Điền vào | Mục 3.1, 3.2 | Mục 4.1, 4.2 | Mục 5.1 |

> **Deadline cứng: phút 50, Role 2 bàn giao selector map cho Role 3.** Đây là điểm đồng bộ duy nhất trong cả buổi. Trễ cái này là hỏng lịch.

---

## Khối 2 — Ráp và thử (0:50 – 1:30)

| | Role 1 | Role 2 | Role 3 |
|---|---|---|---|
| Việc | Mở file baseline, đếm dòng, **ghi con số tổng ra** | Thử replay request Export bằng HTTP client (Postman/curl) | Ráp selector vào, chạy luồng thật lần đầu |
| Tiếp theo | Chạy lại với fuel khác, kiểm tra filter có tác động thật không | Nếu replay được → báo ngay cho cả nhóm, đây là phát hiện lớn | Debug theo thứ tự: trang load → filter → Apply → Export → file rơi xuống |
| Điền vào | Mục 3.3, 3.4 | Mục 4.1 (ô replay), 4.4 | Mục 5.2 |

---

## Khối 3 — CHECKPOINT CẮT PHẠM VI (1:30 – 1:40) · Cả 3 dừng tay

Nhìn thẳng vào tình trạng và quyết định:

- **Nếu luồng đã chạy được** → sang khối 4 bình thường.
- **Nếu chưa** → cắt sạch mọi thứ râu ria. Bỏ retry, bỏ xử lý lỗi, bỏ log đẹp. Chỉ giữ đúng một đường thẳng đến file Excel.
- **Nếu vẫn tắc ở một bước cụ thể** → chấp nhận, chuyển sang mode bàn giao, Role 3 dành thời gian còn lại viết mục 11 cho thật rõ thay vì cố sửa.

Không tranh luận quá 10 phút ở khối này.

---

## Khối 4 — Đo và đối chiếu (1:40 – 2:20)

| | Role 1 | Role 2 | Role 3 |
|---|---|---|---|
| Việc | **Đối chiếu file robot vs file baseline** từng tiêu chí | Viết mục rủi ro và câu hỏi cho VF India | Chạy lặp 3 lần, ghi thời gian và lỗi từng lần |
| Điền vào | Mục 6 | Mục 8, 10 | Mục 5.3, 7 |

Nếu số dòng hoặc con số tổng không khớp, **đó là phát hiện phải báo cáo**, không phải lỗi cần giấu.

---

## Khối 5 — Viết báo cáo (2:20 – 2:45) · Cả 3 người

**2:20 là hard stop. Đóng máy automation lại.** Đây là phần nhiều nhóm chết: đến phút 150 cả ba vẫn đang cùng sửa một selector, và cuối buổi không có gì để trình bày.

- Mỗi người rà lại phần của mình, thay hết `___` còn sót bằng số liệu hoặc `[BLOCKED]`.
- Cùng viết mục 9 (kết luận kỹ thuật) — phần này cần cả ba đồng ý.
- Role 1 viết mục 1 (tóm tắt) **cuối cùng**, dựa trên những gì đã có.

---

## Khối 6 — Chốt (2:45 – 3:00)

- Đọc to mục 1 trong 2 phút, thử xem có trôi không.
- Kiểm tra đã đính kèm: file baseline, file robot tải về, video quay màn hình, script/flow.
- Chốt danh sách câu hỏi gửi mentor.

---

## Hai nguyên tắc nhắc lại

**Một:** không bao giờ để 3 người cùng debug một lỗi. Nếu Role 3 tắc, Role 2 sang hỗ trợ, Role 1 tiếp tục viết báo cáo. Luôn phải có người đang viết.

**Hai:** buổi này vẫn thành công kể cả robot không chạy, miễn là trả lời được nút Export gọi request gì và tắc ở đâu. Đừng đánh đổi mục 11 để lấy thêm 20 phút debug.