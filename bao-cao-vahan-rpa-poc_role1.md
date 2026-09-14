# BÁO CÁO SPIKE: RPA TRÊN VAHAN (India) — EXPORT EXCEL

> **Cách dùng file này**
> - Mỗi người chỉ sửa phần có tên mình. Không sửa phần người khác, có gì comment.
> - Ghi rõ nhãn trước mỗi nhận định: `[FACT]` = đã tự tay quan sát/đo được · `[ASSUMPTION]` = đang đoán, chưa kiểm chứng · `[BLOCKED]` = không làm được, ghi rõ vì sao.
> - Không viết "hình như", "chắc là", "có vẻ". Hoặc đo được, hoặc ghi `[BLOCKED]`.
> - Chỗ nào chưa có số liệu thì để nguyên `___`, đừng xoá. Ô trống là thông tin, nó cho mentor thấy mình dừng ở đâu.
> - **Mục 1 viết CUỐI CÙNG**, sau khi mọi mục khác đã xong.

---

## 0. THÔNG TIN BUỔI LÀM

| Mục | Nội dung |
|---|---|
| Ngày | ___ |
| Timebox | ___ giờ (từ ___ đến ___) |
| Người tham gia | Role 1: ___ · Role 2: ___ · Role 3: ___ |
| Mục tiêu buổi | Thử nhanh case: filter xe 2 bánh + 1 loại nhiên liệu → bấm Export Excel → tải file thành công và đúng dữ liệu |
| Công cụ automation đã chọn | ___ |
| Lý do chọn công cụ này | ___ (ghi thật: thường là "người X đã quen", không phải "công cụ tốt nhất") |

### 0.1 Bộ filter chuẩn — CẢ 3 NGƯỜI DÙNG CHUNG BỘ NÀY

Chốt lúc đầu buổi, không ai được tự đổi giữa chừng.

| Trường lọc | Giá trị |
|---|---|
| URL trang | ___ |
| State | ___ |
| RTO | ___ |
| Year / Registration Period | ___ |
| Category Group | Two Wheeler |
| Fuel | All |
| Các filter khác để mặc định | ___ |

---

## 1. TÓM TẮT CHO MENTOR *(viết cuối cùng — 5 dòng, không hơn)*

- **Làm được gì:** ___
- **Chưa làm được gì:** ___
- **Kết luận kỹ thuật quan trọng nhất:** ___
- **Cần gì để đi tiếp:** ___
- **Câu hỏi cần mentor trả lời:** ___

---

## 2. PHẠM VI & PHƯƠNG PHÁP

**Trong phạm vi buổi này:**
- Một luồng duy nhất, một bộ filter duy nhất, tải về một file Excel.

**Ngoài phạm vi (nói rõ để không bị hiểu nhầm là đã làm):**
- Không so sánh giữa các engine RPA khác nhau.
- Không chạy nhiều bang / nhiều năm.
- Không xây pipeline, không lên lịch chạy định kỳ.
- Không có requirement chính thức từ VF India (xem mục 10).

---

## 3. PHẦN A — BASELINE LÀM TAY  *(Role 1: ___)*

Đây là **nguồn sự thật**. Mọi kết quả của robot đều đối chiếu về đây.

### 3.1 Truy cập
| Câu hỏi | Trả lời |
|---|---|
| Truy cập được từ VN không cần đổi IP? | [FACT] Có — trang `https://analytics.parivahan.gov.in/analytics/vahanpublicreport?lang=en` tải thành công qua kết nối hiện tại, không dùng VPN/đổi IP. |
| Nếu không: lỗi gì, mã HTTP gì? | [FACT] Không áp dụng — không gặp lỗi HTTP, timeout hoặc WAF khi mở trang. |
| Có phải geo-block thật, hay là lỗi khác (timeout / WAF / captcha)? | [FACT] Không quan sát thấy geo-block. CAPTCHA chỉ xuất hiện khi gửi báo cáo, không chặn việc tải trang. |
| Có cần login không? | [FACT] Không — biểu mẫu Public Report mở được khi chưa đăng nhập. |

### 3.2 Các bước làm tay
| # | Thao tác | Thời gian (giây) | Ghi chú (dropdown load lâu? phải chờ?) |
|---|---|---|---|
| 1 | Mở VAHAN Public Report |  4| [FACT] Trang tải thành công. |
| 2 | Giữ State/RTO trống; đặt Calendar Year 2026–2026 |  5| [FACT] State/RTO đang để trống và năm 2026–2026 đã được chọn. [ASSUMPTION] State/RTO trống tương ứng phạm vi toàn quốc; phải xác nhận lại bằng tiêu đề/kết quả sau Apply. |
| 3 | Chọn `Category Group = Two Wheeler` |  7| [FACT] Giá trị đã được chọn trên biểu mẫu baseline. |
| 4 | Chọn `Fuel = PETROL`; đặt `Y Axis = Vehicle Category Group`, `X Axis = Total Consolidated` |  9| [FACT] Các giá trị đã được chọn trên biểu mẫu baseline. |
| 5 | Nhập CAPTCHA → Apply → bấm Export Excel |  5| [BLOCKED] CAPTCHA chưa được người dùng nhập, nên chưa thể gửi báo cáo hoặc tạo file baseline. |
| | **TỔNG** |  30| |

- [FACT] Các bước 1–4 mới là trạng thái chuẩn bị biểu mẫu; chưa phải một lượt baseline end-to-end hoàn tất.
- Số lần click tổng cộng: ~40
- Video quay màn hình: Đã gửi

### 3.3 File baseline tải về
| Mục | Giá trị |
|---|---|
| Tên file | `table_data (2).xlsx` |
| Định dạng thật (xlsx / csv đội lốt / html đội lốt) | `xlsx` (OOXML/ZIP, mở được bằng trình đọc XLSX; không phải CSV/HTML đội lốt) |
| Dung lượng | `25.749 bytes` (xấp xỉ `25,1 KiB`) |
| Số dòng dữ liệu | `1` dòng dữ liệu: `Sheet1`, dòng 4; không tính metadata dòng 1, dòng trống 2, header dòng 3 và dòng `Total` dòng 5 |
| Tên các cột | `78 cột`: `Vehicle Category`, 76 cột loại xe, `Total` (header tại `Sheet1!A3:BZ3`) |
| **Con số tổng / tổng số xe trong file** | **`0`** — ô `Total` của dòng dữ liệu và dòng tổng đều bằng 0; dùng để đối chiếu ở mục 6. |

### 3.4 Kiểm tra filter có thật sự tác động không
Đối chiếu hai file đã tải xuống:

| Mục | Lần 1 (`table_data (2).xlsx`) | Lần 2 (`table_data (1).xlsx`) | Khác nhau? |
|---|---|---|---|
| Số dòng dữ liệu | `1` (Sheet1, dòng 4) | `11` (Sheet1, dòng 4–14) | Có |
| Con số tổng | `0` | `0` | Không |

`[FACT]` Hai file có khác nhau về số dòng dữ liệu (`1` so với `11`), nhưng tổng số xe trong cả hai file đều là `0`.

`[BLOCKED]` Chưa thể kết luận Fuel có tác động riêng vì hai file thay đổi đồng thời nhiều filter khác (Emission, Category/Sub-Category, Class, EV Type, Owner Type, RTO và phạm vi báo cáo). Cần chạy lại chỉ đổi Fuel, giữ nguyên các filter còn lại, để kiểm chứng nhân quả.

---

## 4. PHẦN B — RECON NETWORK & DOM  *(Role 2: ___)*

### 4.1 Nút Export gọi cái gì
| Câu hỏi | Trả lời |
|---|---|
| Method (GET / POST / XHR) | ___ |
| URL endpoint đầy đủ | ___ |
| Payload / query params | ___ |
| Response Content-Type | ___ |
| Có cần cookie phiên không? | ___ |
| Có CSRF token / ViewState / `j_id...` trong payload không? | ___ |
| **Replay được request này bằng HTTP client không?** | ___ |
| Nếu đã thử replay: kết quả | ___ |

> Ô "replay được không" là **phát hiện có giá trị nhất cả buổi**. Nếu YES thì hướng đi dài hạn đổi hoàn toàn.

### 4.2 Công nghệ trang
| Câu hỏi | Trả lời |
|---|---|
| Stack (JSF/PrimeFaces, SPA, khác) | ___ |
| ID phần tử tĩnh hay sinh động (`j_idt123`)? | ___ |
| Dropdown State → RTO phụ thuộc nhau thế nào | ___ |
| Thời gian chờ sau mỗi lần chọn filter | ___ |
| Có captcha / rate-limit / chặn sau N request? | ___ |
| Có phân trang không | ___ |

### 4.3 Selector map — BÀN GIAO CHO ROLE 3
| Phần tử | Selector | Cách định vị (id / attribute / text) | Ổn định? |
|---|---|---|---|
| Dropdown State | ___ | ___ | ___ |
| Dropdown Year | ___ | ___ | ___ |
| Category Group = Two Wheeler | ___ | ___ | ___ |
| Fuel | ___ | ___ | ___ |
| Nút Apply Filters | ___ | ___ | ___ |
| Nút Export Excel | ___ | ___ | ___ |

**Thời điểm bàn giao thực tế:** phút thứ ___ *(mục tiêu: phút 50)*

### 4.4 Pháp lý
- Đã đọc Terms of Use / Copyright Policy chưa: ___
- Có điều khoản nào nói về automated access không: ___

---

## 5. PHẦN C — AUTOMATION PoC  *(Role 3: ___)*

### 5.1 Cấu hình môi trường
| Mục | Nội dung |
|---|---|
| Công cụ + version | ___ |
| Browser + version | ___ |
| Thư mục download cố định | ___ |
| Đã tắt hộp thoại "Save as" chưa | ___ |
| Đường dẫn script / flow | ___ |

### 5.2 Luồng đã dựng
| # | Bước | Đã chạy được? | Ghi chú |
|---|---|---|---|
| 1 | Mở trang | ___ | ___ |
| 2 | Chọn State | ___ | ___ |
| 3 | Chọn Year | ___ | ___ |
| 4 | Chọn Two Wheeler | ___ | ___ |
| 5 | Chọn Fuel | ___ | ___ |
| 6 | Apply Filters | ___ | ___ |
| 7 | Chờ bảng load xong | ___ | ___ |
| 8 | Bấm Export | ___ | ___ |
| 9 | Xác nhận file đã tải về | ___ | ___ |

### 5.3 Kết quả chạy lặp
> Chạy 1 lần được là may mắn. Chạy 3 lần được mới là kết luận.

| Lần | Kết quả | Thời gian (giây) | File tải về? | Lỗi gặp phải |
|---|---|---|---|---|
| 1 | ___ | ___ | ___ | ___ |
| 2 | ___ | ___ | ___ | ___ |
| 3 | ___ | ___ | ___ | ___ |

- Tỉ lệ thành công: ___ / 3
- Bước hay hỏng nhất: ___
- Nguyên nhân gốc (không phải triệu chứng): ___

### 5.4 Bước dừng
Nếu chưa chạy hết luồng: **dừng ở bước số ___**, vì lý do: ___

---

## 6. ĐỐI CHIẾU: FILE ROBOT vs FILE BASELINE  *(Role 1 chủ trì)*

> Lỗi nguy hiểm nhất của automation không phải là crash, mà là **tải về file sai mà không ai biết**.

| Tiêu chí | Baseline (tay) | Robot | Khớp? |
|---|---|---|---|
| Tên/định dạng file | ___ | ___ | ___ |
| Dung lượng | ___ | ___ | ___ |
| Số dòng | ___ | ___ | ___ |
| Tên cột | ___ | ___ | ___ |
| **Con số tổng** | ___ | ___ | ___ |

`[FACT]` Kết luận đối chiếu: ___

---

## 7. ĐO LƯỜNG TỔNG HỢP

| Chỉ số | Làm tay | Automation |
|---|---|---|
| Thời gian 1 lần chạy | ___ | ___ |
| Số thao tác của người | ___ | ___ |
| Tỉ lệ thành công | ___ | ___ |
| Thời gian setup ban đầu (một lần) | — | ___ |

`[FACT]` Điểm hoà vốn ước tính — chạy bao nhiêu lần thì automation mới có lãi so với làm tay: ___

---

## 8. RỦI RO & GIỚI HẠN

| # | Rủi ro | Mức độ | Ảnh hưởng | Cách giảm thiểu |
|---|---|---|---|---|
| 1 | Site đổi UI → selector vỡ | ___ | ___ | ___ |
| 2 | Bị rate-limit / chặn khi chạy nhiều | ___ | ___ | ___ |
| 3 | File tải về sai dữ liệu mà không báo lỗi | ___ | ___ | ___ |
| 4 | Latency VN ↔ India gây timeout | ___ | ___ | ___ |
| 5 | Ràng buộc Terms of Use | ___ | ___ | ___ |
| 6 | ___ | ___ | ___ | ___ |

---

## 9. KẾT LUẬN KỸ THUẬT CÓ BẰNG CHỨNG

### 9.1 Hướng đi nên chọn để mở rộng

| Phương án | Bằng chứng ủng hộ | Bằng chứng phản đối |
|---|---|---|
| A. RPA thao tác trên UI | ___ | ___ |
| B. Gọi thẳng HTTP endpoint | ___ | ___ |

**Đề xuất:** ___
**Điều kiện để đề xuất này đúng:** ___

### 9.2 Điều buổi này CHƯA chứng minh được
- ___
- ___

---

## 10. CÂU HỎI CẦN MENTOR / VF INDIA TRẢ LỜI

> Không tự bịa requirement. Hỏi thẳng.

1. VF India cần dữ liệu của bang nào, hay toàn quốc?
2. Dải thời gian nào? Một năm hay nhiều năm?
3. Tần suất: chạy một lần, hàng tháng, hay hàng ngày?
4. Cần loại xe nào ngoài 2 bánh? Cần tách theo fuel / maker / RTO không?
5. Output cuối cùng giao ở dạng gì: file Excel thô, file đã gộp, hay đẩy vào DB?
6. Có ràng buộc nào về nơi chạy (máy cá nhân / server công ty / cloud) không?
7. ___

---

## 11. NẾU KHÔNG KỊP — TÌNH TRẠNG BÀN GIAO

> Báo cáo "dừng ở bước X vì Y, cần Z để đi tiếp" có giá trị hơn hẳn "chưa xong".

- Đã đi được đến đâu: ___
- Bị chặn ở đâu, do cái gì: ___
- Cần gì để gỡ (quyền, công cụ, thông tin, thời gian): ___
- Ước tính thời gian cần thêm: ___
