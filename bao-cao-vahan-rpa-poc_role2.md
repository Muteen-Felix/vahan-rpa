# BÁO CÁO SPIKE: RPA TRÊN VAHAN (India) — EXPORT EXCEL

> **Cách dùng file này**
>
> - Mỗi người chỉ sửa phần có tên mình. Không sửa phần người khác, có gì comment.
> - Ghi rõ nhãn trước mỗi nhận định: `[FACT]` = đã tự tay quan sát/đo được · `[ASSUMPTION]` = đang đoán, chưa kiểm chứng · `[BLOCKED]` = không làm được, ghi rõ vì sao.
> - Không viết "hình như", "chắc là", "có vẻ". Hoặc đo được, hoặc ghi `[BLOCKED]`.
> - Chỗ nào chưa có số liệu thì để nguyên `___`, đừng xoá. Ô trống là thông tin, nó cho mentor thấy mình dừng ở đâu.
> - **Mục 1 viết CUỐI CÙNG**, sau khi mọi mục khác đã xong.

---

## 0. THÔNG TIN BUỔI LÀM


| Mục                        | Nội dung                                                                                                      |
| -------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Ngày                       | ___                                                                                                           |
| Timebox                    | ___ giờ (từ ___ đến ___)                                                                                      |
| Người tham gia             | Role 1: ___ · Role 2: ___ · Role 3: ___                                                                       |
| Mục tiêu buổi              | Thử nhanh case: filter xe 2 bánh + 1 loại nhiên liệu → bấm Export Excel → tải file thành công và đúng dữ liệu |
| Công cụ automation đã chọn | ___                                                                                                           |
| Lý do chọn công cụ này     | ___ (ghi thật: thường là "người X đã quen", không phải "công cụ tốt nhất")                                    |


### 0.1 Bộ filter chuẩn — CẢ 3 NGƯỜI DÙNG CHUNG BỘ NÀY

Chốt lúc đầu buổi, không ai được tự đổi giữa chừng.


| Trường lọc                  | Giá trị     |
| --------------------------- | ----------- |
| URL trang                   | ___         |
| State                       | ___         |
| RTO                         | ___         |
| Year / Registration Period  | ___         |
| Category Group              | Two Wheeler |
| Fuel                        | ___         |
| Các filter khác để mặc định | ___         |


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


| Câu hỏi                                                            | Trả lời |
| ------------------------------------------------------------------ | ------- |
| Truy cập được từ VN không cần đổi IP?                              | ___     |
| Nếu không: lỗi gì, mã HTTP gì?                                     | ___     |
| Có phải geo-block thật, hay là lỗi khác (timeout / WAF / captcha)? | ___     |
| Có cần login không?                                                | ___     |


### 3.2 Các bước làm tay


| #   | Thao tác   | Thời gian (giây) | Ghi chú (dropdown load lâu? phải chờ?) |
| --- | ---------- | ---------------- | -------------------------------------- |
| 1   | ___        | ___              | ___                                    |
| 2   | ___        | ___              | ___                                    |
| 3   | ___        | ___              | ___                                    |
| 4   | ___        | ___              | ___                                    |
| 5   | Bấm Export | ___              | ___                                    |
|     | **TỔNG**   | **___**          |                                        |


- Số lần click tổng cộng: ___
- Video quay màn hình: ___ (đường dẫn file)

### 3.3 File baseline tải về


| Mục                                                | Giá trị                             |
| -------------------------------------------------- | ----------------------------------- |
| Tên file                                           | ___                                 |
| Định dạng thật (xlsx / csv đội lốt / html đội lốt) | ___                                 |
| Dung lượng                                         | ___                                 |
| Số dòng dữ liệu                                    | ___                                 |
| Tên các cột                                        | ___                                 |
| **Con số tổng / tổng số xe trong file**            | **___** ← dùng để đối chiếu ở mục 6 |


### 3.4 Kiểm tra filter có thật sự tác động không

Đổi Fuel sang một giá trị khác rồi export lại:


| Mục         | Lần 1 (fuel gốc) | Lần 2 (fuel khác) | Khác nhau? |
| ----------- | ---------------- | ----------------- | ---------- |
| Số dòng     | ___              | ___               | ___        |
| Con số tổng | ___              | ___               | ___        |


`[FACT]` Kết luận: ___

---

## 4. PHẦN B — RECON NETWORK & DOM  *(Role 2: ___)*

### 4.1 Nút Export gọi cái gì


| Câu hỏi                                                    | Trả lời                                                                                                                                                                                              |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Method (GET / POST / XHR)                                  | [FACT] Không có endpoint API tải file Excel từ server khi bấm Export. Nút Export (`#downloadBtn1`) kích hoạt thư viện SheetJS (`xlsx.full.min.js`) dựng file `.xlsx` trực tiếp tại client từ DOM bảng hiển thị, đồng thời gửi request ghi log tới `https://analytics.parivahan.gov.in/analytics/reports/logDownload/Vahan%20Public%20Report%20Xlsx`. POST duy nhất trên trang là submit form filter (kèm CAPTCHA và CSRF token). |
| URL endpoint đầy đủ                                        | Form action: `https://analytics.parivahan.gov.in/analytics/vahanpublicreport?lang=en`.  Log Xlsx: `https://analytics.parivahan.gov.in/analytics/reports/logDownload/Vahan%20Public%20Report%20Xlsx`. |
| Payload / query params                                     | Form filter có các field: `stateMultiple`, `rtoCodeMultiple`, `vehicleCategoryGroup`, `vehicleFuels` (Lưu ý: name trong form payload là `vehicleFuels`, nhưng ID của element trên DOM là `vehicleFuel`), `fromYear`, `toYear`, `xAxis`, `yAxis`, `captcha`, `_csrf`, v.v. |
| Response Content-Type                                      | trang ban đầu trả `text/html;charset=utf-8`; trang tải `xlsx.full.min.js`.                                                                                                                           |
| Có cần cookie phiên không?                                 | GET trang tạo cookie `analytics_sh_cok`, có `Secure` và `HttpOnly`.                                                                                                                                  |
| Có CSRF token / ViewState / `j_id...` trong payload không? | Có hidden input `name="_csrf"` với giá trị thay đổi theo lần tải trang. Không thấy ViewState hoặc ID dạng `j_id...` trong HTML đã kiểm tra.                                                          |
| **Replay được request này bằng HTTP client không?**        | [FACT] Không replay được bằng HTTP thuần — file được build phía client, không phải response HTTP đơn lẻ. |
| Nếu đã thử replay: kết quả                                 | [FACT] Không có HTTP request trả về binary xlsx từ server để replay. Server chỉ nhận form POST filter và trả về HTML table. File Excel do SheetJS phía browser tự kết xuất từ DOM bảng dữ liệu sau khi submit. |


> Ô "replay được không" là **phát hiện có giá trị nhất cả buổi**. Nếu YES thì hướng đi dài hạn đổi hoàn toàn.

### 4.2 Công nghệ trang


| Câu hỏi                                       | Trả lời                                                                                                                                                                                                                                     |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Stack (JSF/PrimeFaces, SPA, khác)             | Trang server-rendered HTML, dùng jQuery, Bootstrap, Bootstrap Datepicker và SheetJS (`xlsx.full.min.js`); không phải SPA.                                                                                                                   |
| ID phần tử tĩnh hay sinh động (`j_idt123`)?   | Các control chính dùng ID tĩnh, có nghĩa: `stateName`, `rtoCode`, `vehicleCategoryGroup`, `vehicleFuel`, `reportType`, `fromYear`, `toYear`, `yAxis`, `xAxis`, `externalCaptcha`, `applyTrigger`, `downloadBtn1`. Không thấy ID `j_idt...`. |
| Dropdown State → RTO phụ thuộc nhau thế nào   | RTO bị vô hiệu khi chưa chọn hoặc chọn nhiều State. Khi chọn đúng một State, trang gọi `GET /analytics/json_rtos?stateCode=<code>`, nhận JSON rồi thêm các option vào `#rtoCode`.                                                           |
| Thời gian chờ sau mỗi lần chọn filter         | Chưa đo riêng từng filter                                                                                                                                                                                                                   |
| Có captcha / rate-limit / chặn sau N request? | Có CAPTCHA bắt buộc trước POST tạo báo cáo, Rate-limit/chặn sau N request chưa xác định                                                                                                                                                     |
| Có phân trang không                           | Report dạng bảng thống kê                                                                                                                                                                                                                   |


### 4.3 Selector map — BÀN GIAO CHO ROLE 3


| Phần tử                      | Selector                                                                      | Cách định vị (id / attribute / text)                                           | Ổn định?                       |
| ---------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | ------------------------------ |
| Dropdown State               | `#stateName`                                                                  | ID; chọn option theo text chuẩn hoá, ví dụ `Delhi`                             | Cao — ID tĩnh.                 |
| Dropdown Year                | `#reportType`, `#fromYear`, `#toYear`; Financial Year: `#financialYearSelect` | ID                                                                             | Cao — ID tĩnh.                 |
| Category Group = Two Wheeler | `#vehicleCategoryGroup`                                                       | ID của `<select>`; option theo text chuẩn hoá `Two Wheeler`                    | Cao — ID tĩnh.                 |
| Fuel                         | `#vehicleFuel`                                                                | ID tĩnh của `<select>` (`id="vehicleFuel"`, lưu ý name trong form payload là `vehicleFuels`); option theo text, ví dụ `PETROL`, `DIESEL`, `ELECTRIC(BOV)` | Cao — ID tĩnh.                 |
| Nút Apply Filters            | `#applyTrigger`                                                               | ID                                                                             | Cao — ID tĩnh.                 |
| Nút Export Excel             | `#downloadBtn1`                                                               | ID                                                                             | Hiển thị sau khi apply filter. |


**Thời điểm bàn giao thực tế:** phút thứ ___ *(mục tiêu: phút 50)*

### 4.4 Pháp lý

- Đã đọc Terms of Use / Copyright Policy chưa: Đã đọc trang [Copyright Policy](https://analytics.parivahan.gov.in/analytics/copyright): cho phép tái sử dụng nội dung nếu sao chép chính xác, không gây hiểu nhầm và ghi nguồn; nội dung bên thứ ba cần xin phép chủ sở hữu. Liên kết **Terms of Use** trên trang hiện là `href="#"`, chưa lấy được nội dung Terms of Use để đánh giá.
- Có điều khoản nào nói về automated access không: Chưa tìm thấy/đọc được Terms of Use quy định automated access, scraping hoặc RPA; chưa thể kết luận được phép hay bị cấm.

---

## 5. PHẦN C — AUTOMATION PoC  *(Role 3: ___)*

### 5.1 Cấu hình môi trường


| Mục                             | Nội dung |
| ------------------------------- | -------- |
| Công cụ + version               | ___      |
| Browser + version               | ___      |
| Thư mục download cố định        | ___      |
| Đã tắt hộp thoại "Save as" chưa | ___      |
| Đường dẫn script / flow         | ___      |


### 5.2 Luồng đã dựng


| #   | Bước                    | Đã chạy được? | Ghi chú |
| --- | ----------------------- | ------------- | ------- |
| 1   | Mở trang                | ___           | ___     |
| 2   | Chọn State              | ___           | ___     |
| 3   | Chọn Year               | ___           | ___     |
| 4   | Chọn Two Wheeler        | ___           | ___     |
| 5   | Chọn Fuel               | ___           | ___     |
| 6   | Apply Filters           | ___           | ___     |
| 7   | Chờ bảng load xong      | ___           | ___     |
| 8   | Bấm Export              | ___           | ___     |
| 9   | Xác nhận file đã tải về | ___           | ___     |


### 5.3 Kết quả chạy lặp

> Chạy 1 lần được là may mắn. Chạy 3 lần được mới là kết luận.


| Lần | Kết quả | Thời gian (giây) | File tải về? | Lỗi gặp phải |
| --- | ------- | ---------------- | ------------ | ------------ |
| 1   | ___     | ___              | ___          | ___          |
| 2   | ___     | ___              | ___          | ___          |
| 3   | ___     | ___              | ___          | ___          |


- Tỉ lệ thành công: ___ / 3
- Bước hay hỏng nhất: ___
- Nguyên nhân gốc (không phải triệu chứng): ___

### 5.4 Bước dừng

Nếu chưa chạy hết luồng: **dừng ở bước số ___**, vì lý do: ___

---

## 6. ĐỐI CHIẾU: FILE ROBOT vs FILE BASELINE  *(Role 1 chủ trì)*

> Lỗi nguy hiểm nhất của automation không phải là crash, mà là **tải về file sai mà không ai biết**.


| Tiêu chí           | Baseline (tay) | Robot | Khớp? |
| ------------------ | -------------- | ----- | ----- |
| Tên/định dạng file | ___            | ___   | ___   |
| Dung lượng         | ___            | ___   | ___   |
| Số dòng            | ___            | ___   | ___   |
| Tên cột            | ___            | ___   | ___   |
| **Con số tổng**    | ___            | ___   | ___   |


`[FACT]` Kết luận đối chiếu: ___

---

## 7. ĐO LƯỜNG TỔNG HỢP


| Chỉ số                            | Làm tay | Automation |
| --------------------------------- | ------- | ---------- |
| Thời gian 1 lần chạy              | ___     | ___        |
| Số thao tác của người             | ___     | ___        |
| Tỉ lệ thành công                  | ___     | ___        |
| Thời gian setup ban đầu (một lần) | —       | ___        |


`[FACT]` Điểm hoà vốn ước tính — chạy bao nhiêu lần thì automation mới có lãi so với làm tay: ___

---

## 8. RỦI RO & GIỚI HẠN


| #   | Rủi ro                                   | Mức độ | Ảnh hưởng | Cách giảm thiểu |
| --- | ---------------------------------------- | ------ | --------- | --------------- |
| 1   | Site đổi UI → selector vỡ                | ___    | ___       | ___             |
| 2   | Bị rate-limit / chặn khi chạy nhiều      | ___    | ___       | ___             |
| 3   | File tải về sai dữ liệu mà không báo lỗi | ___    | ___       | ___             |
| 4   | Latency VN ↔ India gây timeout           | ___    | ___       | ___             |
| 5   | Ràng buộc Terms of Use                   | ___    | ___       | ___             |
| 6   | ___                                      | ___    | ___       | ___             |


---

## 9. KẾT LUẬN KỸ THUẬT CÓ BẰNG CHỨNG

### 9.1 Hướng đi nên chọn để mở rộng


| Phương án                  | Bằng chứng ủng hộ | Bằng chứng phản đối |
| -------------------------- | ----------------- | ------------------- |
| A. RPA thao tác trên UI    | [FACT] Tương thích trực tiếp với cơ chế sinh file: file Excel được build hoàn toàn ở phía client (thư viện SheetJS parse DOM bảng dữ liệu). Browser automation (Playwright) tự nhiên tương thích và hỗ trợ trích xuất file `.xlsx` chuẩn định dạng. | [FACT] Tốn tài nguyên hơn gọi HTTP thuần; phụ thuộc vào độ ổn định DOM/selector; cần giải quyết CAPTCHA trên giao diện. |
| B. Gọi thẳng HTTP endpoint | [FACT] Tiết kiệm tài nguyên máy tính nếu có API endpoint tải file trực tiếp. | [FACT] Server KHÔNG có endpoint HTTP trả về file Excel để replay. POST form filter bị bảo vệ bởi CAPTCHA và CSRF token theo phiên, response chỉ trả về HTML table. Tự viết code giả lập toàn bộ (giải CAPTCHA + parse HTML table + tự dựng Excel) có độ phức tạp và rủi ro cao hơn nhiều so với RPA browser. |


**Đề xuất:** Chọn **Phương án A (RPA thao tác trên UI bằng Playwright)**.
**Điều kiện để đề xuất này đúng:** Giải quyết được bước CAPTCHA (bằng CAPTCHA solver AI/OCR hoặc mô hình attended RPA) và duy trì selector ổn định theo ID tĩnh đã bàn giao (`#stateName`, `#vehicleCategoryGroup`, `#vehicleFuel`, `#applyTrigger`, `#downloadBtn1`).

### 9.2 Điều buổi này CHƯA chứng minh được

---

---

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

