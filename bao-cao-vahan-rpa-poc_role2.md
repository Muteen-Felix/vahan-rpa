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
| Ngày                       | 2026-09-14                                                                                                    |
| Timebox                    | ___ giờ (từ ___ đến ___)                                                                                      |
| Người tham gia             | Role 1: Vu Van Huy · Role 2: Nguyen Minh Duc · Role 3: Nguyen Chinh Nghia                                     |
| Mục tiêu buổi              | Thử nhanh case: filter xe 2 bánh + 1 loại nhiên liệu → bấm Export Excel → tải file thành công và đúng dữ liệu |
| Công cụ automation đã chọn | Playwright (Python)                                                                                           |
| Lý do chọn công cụ này     | ___ (ghi thật: thường là "người X đã quen", không phải "công cụ tốt nhất")                                    |


### 0.1 Bộ filter chuẩn — CẢ 3 NGƯỜI DÙNG CHUNG BỘ NÀY

Chốt lúc đầu buổi, không ai được tự đổi giữa chừng.


| Trường lọc                  | Giá trị                                                                                                                                          |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| URL trang                   | [https://analytics.parivahan.gov.in/analytics/vahanpublicreport?lang=en](https://analytics.parivahan.gov.in/analytics/vahanpublicreport?lang=en) |
| State                       | ___                                                                                                                                              |
| RTO                         | ___                                                                                                                                              |
| Year / Registration Period  | ___                                                                                                                                              |
| Category Group              | Two Wheeler                                                                                                                                      |
| Fuel                        | PETROL                                                                                                                                           |
| Các filter khác để mặc định | ___                                                                                                                                              |


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

## 3. PHẦN A — BASELINE LÀM TAY  *(Role 1: Vu Van Huy)*

Đây là **nguồn sự thật**. Mọi kết quả của robot đều đối chiếu về đây.

### 3.1 Truy cập


| Câu hỏi                                                            | Trả lời                                                                                                                                                |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Truy cập được từ VN không cần đổi IP?                              | [FACT] Có — trang `https://analytics.parivahan.gov.in/analytics/vahanpublicreport?lang=en` tải thành công qua kết nối hiện tại, không dùng VPN/đổi IP. |
| Nếu không: lỗi gì, mã HTTP gì?                                     | [FACT] Không áp dụng — không gặp lỗi HTTP, timeout hoặc WAF khi mở trang.                                                                              |
| Có phải geo-block thật, hay là lỗi khác (timeout / WAF / captcha)? | [FACT] Không quan sát thấy geo-block. CAPTCHA chỉ xuất hiện khi gửi báo cáo, không chặn việc tải trang.                                                |
| Có cần login không?                                                | [FACT] Không — biểu mẫu Public Report mở được khi chưa đăng nhập.                                                                                      |


### 3.2 Các bước làm tay


| #   | Thao tác                                                                                   | Thời gian (giây) | Ghi chú (dropdown load lâu? phải chờ?)                                                                                                                                    |
| --- | ------------------------------------------------------------------------------------------ | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Mở VAHAN Public Report                                                                     | 4                | [FACT] Trang tải thành công.                                                                                                                                              |
| 2   | Giữ State/RTO trống; đặt Calendar Year 2026–2026                                           | 5                | [FACT] State/RTO đang để trống và năm 2026–2026 đã được chọn. [ASSUMPTION] State/RTO trống tương ứng phạm vi toàn quốc; phải xác nhận lại bằng tiêu đề/kết quả sau Apply. |
| 3   | Chọn `Category Group = Two Wheeler`                                                        | 7                | [FACT] Giá trị đã được chọn trên biểu mẫu baseline.                                                                                                                       |
| 4   | Chọn `Fuel = PETROL`; đặt `Y Axis = Vehicle Category Group`, `X Axis = Total Consolidated` | 9                | [FACT] Các giá trị đã được chọn trên biểu mẫu baseline.                                                                                                                   |
| 5   | Nhập CAPTCHA → Apply → bấm Export Excel                                                    | 5                | [BLOCKED] CAPTCHA chưa được người dùng nhập, nên chưa thể gửi báo cáo hoặc tạo file baseline.                                                                             |
|     | **TỔNG**                                                                                   | **30**           |                                                                                                                                                                           |


- [FACT] Các bước 1–4 mới là trạng thái chuẩn bị biểu mẫu; chưa phải một lượt baseline end-to-end hoàn tất.
- Số lần click tổng cộng: ~40
- Video quay màn hình: Đã gửi

### 3.3 File baseline tải về


| Mục                                                | Giá trị                                                                                                            |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Tên file                                           | `table_data (2).xlsx`                                                                                              |
| Định dạng thật (xlsx / csv đội lốt / html đội lốt) | `xlsx` (OOXML/ZIP, mở được bằng trình đọc XLSX; không phải CSV/HTML đội lốt)                                       |
| Dung lượng                                         | `25.749 bytes` (xấp xỉ `25,1 KiB`)                                                                                 |
| Số dòng dữ liệu                                    | `1` dòng dữ liệu: `Sheet1`, dòng 4; không tính metadata dòng 1, dòng trống 2, header dòng 3 và dòng `Total` dòng 5 |
| Tên các cột                                        | `78 cột`: `Vehicle Category`, 76 cột loại xe, `Total` (header tại `Sheet1!A3:BZ3`)                                 |
| **Con số tổng / tổng số xe trong file**            | `**0`** — ô `Total` của dòng dữ liệu và dòng tổng đều bằng 0; dùng để đối chiếu ở mục 6.                           |


### 3.4 Kiểm tra filter có thật sự tác động không

Đối chiếu hai file đã tải xuống:


| Mục             | Lần 1 (`table_data (2).xlsx`) | Lần 2 (`table_data (1).xlsx`) | Khác nhau? |
| --------------- | ----------------------------- | ----------------------------- | ---------- |
| Số dòng dữ liệu | `1` (Sheet1, dòng 4)          | `11` (Sheet1, dòng 4–14)      | Có         |
| Con số tổng     | `0`                           | `0`                           | Không      |


`[FACT]` Hai file có khác nhau về số dòng dữ liệu (`1` so với `11`), nhưng tổng số xe trong cả hai file đều là `0`.

`[BLOCKED]` Chưa thể kết luận Fuel có tác động riêng vì hai file thay đổi đồng thời nhiều filter khác (Emission, Category/Sub-Category, Class, EV Type, Owner Type, RTO và phạm vi báo cáo). Cần chạy lại chỉ đổi Fuel, giữ nguyên các filter còn lại, để kiểm chứng nhân quả.

---

## 4. PHẦN B — RECON NETWORK & DOM  *(Role 2: Nguyen Minh Duc)*

### 4.1 Nút Export gọi cái gì


| Câu hỏi                                                    | Trả lời                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Method (GET / POST / XHR)                                  | [FACT] Không có endpoint API tải file Excel từ server khi bấm Export. Nút Export (`#downloadBtn1`) kích hoạt thư viện SheetJS (`xlsx.full.min.js`) dựng file `.xlsx` trực tiếp tại client từ DOM bảng hiển thị, đồng thời gửi request ghi log tới `https://analytics.parivahan.gov.in/analytics/reports/logDownload/Vahan%20Public%20Report%20Xlsx`. POST duy nhất trên trang là submit form filter (kèm CAPTCHA và CSRF token). |
| URL endpoint đầy đủ                                        | Form action: `https://analytics.parivahan.gov.in/analytics/vahanpublicreport?lang=en`. Log Xlsx: `https://analytics.parivahan.gov.in/analytics/reports/logDownload/Vahan%20Public%20Report%20Xlsx`.                                                                                                                                                                                                                              |
| Payload / query params                                     | Form có các field: `stateMultiple`, `rtoCodeMultiple`, `vehicleCategoryGroup`, `vehicleFuels` (Lưu ý: name trong form payload là `vehicleFuels`, nhưng ID của element trên DOM là `vehicleFuel`), `fromYear`, `toYear`, `xAxis`, `yAxis`, `captcha`, `_csrf`, v.v.                                                                                                                                                               |
| Response Content-Type                                      | trang ban đầu trả `text/html;charset=utf-8`; trang tải `xlsx.full.min.js`.                                                                                                                                                                                                                                                                                                                                                       |
| Có cần cookie phiên không?                                 | GET trang tạo cookie `analytics_sh_cok`, có `Secure` và `HttpOnly`.                                                                                                                                                                                                                                                                                                                                                              |
| Có CSRF token / ViewState / `j_id...` trong payload không? | Có hidden input `name="_csrf"` với giá trị thay đổi theo lần tải trang. Không thấy ViewState hoặc ID dạng `j_id...` trong HTML đã kiểm tra.                                                                                                                                                                                                                                                                                      |
| **Replay được request này bằng HTTP client không?**        | [FACT] Không replay được bằng HTTP thuần — file được build phía client, không phải response HTTP đơn lẻ.                                                                                                                                                                                                                                                                                                                         |
| Nếu đã thử replay: kết quả                                 | [FACT] Không có HTTP request trả về binary xlsx từ server để replay. Server chỉ nhận form POST filter và trả về HTML table. File Excel do SheetJS phía browser tự kết xuất từ DOM bảng dữ liệu sau khi submit.                                                                                                                                                                                                                   |


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


| Phần tử                      | Selector                                                                      | Cách định vị (id / attribute / text)                                                                                                                      | Ổn định?                       |
| ---------------------------- | ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| Dropdown State               | `#stateName`                                                                  | ID; chọn option theo text chuẩn hoá, ví dụ `Delhi`                                                                                                        | Cao — ID tĩnh.                 |
| Dropdown Year                | `#reportType`, `#fromYear`, `#toYear`; Financial Year: `#financialYearSelect` | ID                                                                                                                                                        | Cao — ID tĩnh.                 |
| Category Group = Two Wheeler | `#vehicleCategoryGroup`                                                       | ID của `<select>`; option theo text chuẩn hoá `Two Wheeler`                                                                                               | Cao — ID tĩnh.                 |
| Fuel                         | `#vehicleFuel`                                                                | ID tĩnh của `<select>` (`id="vehicleFuel"`, lưu ý name trong form payload là `vehicleFuels`); option theo text, ví dụ `PETROL`, `DIESEL`, `ELECTRIC(BOV)` | Cao — ID tĩnh.                 |
| Nút Apply Filters            | `#applyTrigger`                                                               | ID                                                                                                                                                        | Cao — ID tĩnh.                 |
| Nút Export Excel             | `#downloadBtn1`                                                               | ID                                                                                                                                                        | Hiển thị sau khi apply filter. |


**Thời điểm bàn giao thực tế:** phút thứ ___ *(mục tiêu: phút 50)*

### 4.4 Pháp lý

- Đã đọc Terms of Use / Copyright Policy chưa: Đã đọc trang [Copyright Policy](https://analytics.parivahan.gov.in/analytics/copyright): cho phép tái sử dụng nội dung nếu sao chép chính xác, không gây hiểu nhầm và ghi nguồn; nội dung bên thứ ba cần xin phép chủ sở hữu. Liên kết **Terms of Use** trên trang hiện là `href="#"`, chưa lấy được nội dung Terms of Use để đánh giá.
- Có điều khoản nào nói về automated access không: Chưa tìm thấy/đọc được Terms of Use quy định automated access, scraping hoặc RPA; chưa thể kết luận được phép hay bị cấm.

---

## 5. PHẦN C — AUTOMATION PoC  *(Role 3: Nguyen Chinh Nghia)*

### 5.1 Cấu hình môi trường


| Mục                             | Nội dung                                                                                                                                             |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Công cụ + version               | [FACT] Playwright Python `1.62.0`, Python `3.11.9`, Windows 11                                                                                       |
| Browser + version               | [FACT] Chromium (Chrome for Testing) `151.0.7922.34`, bản Playwright tự tải về `ms-playwright\chromium-1234`                                         |
| Thư mục download cố định        | [FACT] `D:\AI-ENGINEERING\projects\power-desktop-research\vahan-rpa\downloads` — đường dẫn tuyệt đối, khai báo trong `config.py`, tự tạo nếu chưa có |
| Đã tắt hộp thoại "Save as" chưa | [FACT] Có — context tạo với `accept_downloads=True` và file được ghi bằng `download.save_as(DOWNLOAD_DIR/...)`, không qua hộp thoại hệ thống         |
| Đường dẫn script / flow         | [FACT] `poc_vahan.py` (khung + `verify_file()`), `config.py` (DOWNLOAD_DIR)                                                                          |


`[FACT]` `verify_file()` đã chạy thử trên file xlsx tự tạo: nhận diện đúng file tồn tại/không tồn tại, phân biệt xlsx thật (ZIP/OOXML) với file đội lốt, đọc được header và đếm số dòng — đủ dữ liệu để đối chiếu mục 6.

`[FACT]` Đã nhận bàn giao selector map từ Role 2 (mục 4.3). Đã xác nhận ID thật là `#vehicleFuel` (thay vì name `vehicleFuels` trong form payload), khung `poc_vahan.py` và `test_category_and_fuel.py` đã cắm đúng selector vào container multiselect tương ứng.

### 5.2 Luồng đã dựng


| #   | Bước                    | Đã chạy được? | Ghi chú                                                                                                                                                                                                                                                                                                |
| --- | ----------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Mở trang                | Có            | [FACT] `page.goto()` trả HTTP `200`, title `Welcome to Data Analytics Portal`, tải xong trong `5,8` giây. Chạy **headless** vẫn vào được — site không chặn browser tự động ở bước tải trang.                                                                                                           |
| 2   | Chọn State              | Không áp dụng | `[ASSUMPTION]` Theo yêu cầu phạm vi test hiện tại: KHÔNG chọn State, dùng mặc định toàn quốc (ALL STATES) của trang — chưa phải quyết định chính thức ở mục 0.1, cần xác nhận lại. Selector container đã có sẵn trong code (`SELECTORS["state_container"]`) nhưng chưa được gọi trong luồng chạy thật. |
| 3   | Chọn Year               | Không áp dụng | `[ASSUMPTION]` Tương tự State — dùng mặc định Year Type/khoảng năm của trang (không gọi `#reportType`/`#fromYear`/`#toYear`), theo cùng quyết định phạm vi ở trên.                                                                                                                                     |
| 4   | Chọn Two Wheeler        | Có            | `[FACT]` `select_checkbox_option()` click vào container `div.multiselect-dropdown` theo sau `#vehicleCategoryGroup`, verify bằng `assert checkbox.is_checked()==True` (không chỉ tin click không lỗi). Chạy đúng cả 3/3 lần đo lặp (mục 5.3).                                                          |
| 5   | Chọn Fuel               | Có            | `[FACT]` Fuel = "All" (đã chốt mục 0.1) qua `select_all_checkbox()` — click `div.multiselect-dropdown-all-selector`, KHÔNG phải option thường (không có `data-search-text`). Chạy đúng cả 3/3 lần.                                                                                                     |
| 6   | Apply Filters           | Có            | `[FACT]` Bấm `#applyTrigger` sau khi robot tự phát hiện CAPTCHA đã được gõ (`page.wait_for_function()` poll `#externalCaptcha`, KHÔNG dùng `input()`/terminal). Thời gian chờ CAPTCHA + Apply từng lần: `9,8s / 11,7s / 19,5s` (lần 3 dài hơn vì gõ sai CAPTCHA 1 lần, script tự retry).               |
| 7   | Chờ bảng load xong      | Có            | `[FACT]` Không có selector riêng báo "bảng đã render" — dùng proxy đã verify thật: nút Export (`#downloadBtn1`) count=0 trước Apply, chỉ xuất hiện (`state="visible"`) sau khi Apply thành công. Đo `t_wait_table_s` ≈ `0,0s` cả 3 lần — bảng render gần như ngay sau khi trang hết networkidle.       |
| 8   | Bấm Export              | Có            | `[FACT]` Click `#downloadBtn1`, bắt bằng `page.expect_download()`, lưu `.xlsx` vào `downloads/` với tên gắn timestamp (`{unix_time}_table_data.xlsx`) để 3 lần chạy không ghi đè nhau. Thời gian tải: `0,2s / 0,2s / 0,1s`.                                                                            |
| 9   | Xác nhận file đã tải về | Có            | `[FACT]` `verify_file()` xác nhận cả 3 file: xlsx thật (`zipfile.is_zipfile()==True`), `size_bytes=16864` giống hệt nhau, `row_count_raw=15`, cột `['Fuel', 'Two Wheeler', 'Total']`, dòng Total = `15.722.527`.                                                                                       |


### 5.3 Kết quả chạy lặp

> Chạy 1 lần được là may mắn. Chạy 3 lần được mới là kết luận.


| Lần | Kết quả             | Thời gian (giây) | File tải về?                                | Lỗi gặp phải                                                                                                                                                                                                                         |
| --- | ------------------- | ---------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | `[FACT]` Thành công | `17,6`           | Có — `downloads/1789378528_table_data.xlsx` | Không                                                                                                                                                                                                                                |
| 2   | `[FACT]` Thành công | `19,5`           | Có — `downloads/1789378546_table_data.xlsx` | Không                                                                                                                                                                                                                                |
| 3   | `[FACT]` Thành công | `27,2`           | Có — `downloads/1789378566_table_data.xlsx` | CAPTCHA gõ sai ở lần thử đầu — script tự phát hiện qua text "Invalid CAPTCHA." trên trang, tự chờ người đọc CAPTCHA mới và gõ lại (không sửa lại filter, filter vẫn giữ nguyên), lần thử 2 thành công. Không phải lỗi code/selector. |


- Tỉ lệ thành công: `[FACT]` 3 / 3
- Bước hay hỏng nhất: `[FACT]` CAPTCHA — 1/3 lần đo cần gõ lại (người đọc/gõ sai ký tự). Toàn bộ phần automation (chọn Category/Fuel/Axis, Apply, Export, verify file) không lỗi lần nào trong cả 3 lần chạy.
- Nguyên nhân gốc (không phải triệu chứng): `[FACT]` CAPTCHA là bước DUY NHẤT trong luồng phụ thuộc con người — mọi sai sót phát sinh đều nằm ở đây (đọc nhầm/gõ nhầm ký tự captcha), không nằm ở logic hay selector automation.

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


| Chỉ số                            | Làm tay                         | Automation                                                                                                                                                                                                                                                           |
| --------------------------------- | ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Thời gian 1 lần chạy              | ___ *(chờ Role 1 điền mục 3.2)* | `[FACT]` Trung bình `21,4s` (dải `17,6s`–`27,2s`, gồm cả thời gian người đọc+gõ CAPTCHA trên browser). Phần automation thuần (mở trang → chọn filter → Apply → Export → verify, KHÔNG tính thời gian người gõ CAPTCHA) luôn dưới `8s`/lần.                           |
| Số thao tác của người             | ___ *(chờ Role 1 điền mục 3.2)* | `[FACT]` `1` thao tác duy nhất — đọc và gõ CAPTCHA trực tiếp trên trang. Không cần chọn filter tay, không cần quay lại terminal bấm Enter (attended qua `page.wait_for_function()`, không dùng `input()`).                                                           |
| Tỉ lệ thành công                  | ___ *(chờ Role 1 điền mục 3.4)* | `[FACT]` `3/3` (100%), trong đó `1/3` lần cần gõ lại CAPTCHA 1 lần (script tự retry, không cần can thiệp gì thêm ngoài gõ lại).                                                                                                                                      |
| Thời gian setup ban đầu (một lần) | —                               | `[ASSUMPTION]` Không đo tách riêng được trong phiên này — viết code và debug selector diễn ra xen kẽ nhiều vòng thử (xem lịch sử trong hội thoại/commit), không phải một khối thời gian liên tục để đo chính xác. Để `_`__, cần đo lại có chủ đích nếu muốn số thật. |


`[FACT]` Điểm hoà vốn ước tính — chạy bao nhiêu lần thì automation mới có lãi so với làm tay: ___ *(cần thời gian làm tay thật ở mục 3.2 từ Role 1 mới tính được — automation ổn định ở ~21s/lần bao gồm cả CAPTCHA, nhưng chưa có mẫu số để so sánh)*

---

## 8. RỦI RO & GIỚI HẠN


| #   | Rủi ro                                        | Mức độ                                                                                                                                                                         | Ảnh hưởng                                                                                                                                                                                                  | Cách giảm thiểu                                                                                                                                                                                                                |
| --- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Site đổi UI → selector vỡ                     | **Trung bình** — `[FACT]` các control chính hiện có ID tĩnh, nhưng Category/Fuel là widget multiselect tùy chỉnh và thao tác đang phụ thuộc cấu trúc DOM `following::div`.     | `[ASSUMPTION]` Nếu VAHAN đổi ID, cấu trúc wrapper hoặc thư viện giao diện, robot có thể dừng ở bước chọn filter hay Export; không làm sai dữ liệu âm thầm nếu giữ các assert hiện có.                      | Ưu tiên ID/attribute ổn định; gom selector tại một nơi; giữ assert checkbox và trạng thái nút Export; thêm smoke test chạy định kỳ và cảnh báo rõ bước/selector bị lỗi.                                                        |
| 2   | Bị rate-limit / chặn khi chạy nhiều           | **Trung bình, chưa đủ dữ liệu** — `[FACT]` chưa xác định rate-limit/chặn sau N request; mẫu hiện tại chỉ có 3 lần chạy liên tiếp.                                              | `[ASSUMPTION]` Chạy với tần suất lớn có thể bị chậm, trả lỗi, khóa phiên/IP hoặc làm CAPTCHA khó hơn, khiến SLA không ổn định.                                                                             | Xác nhận tần suất nghiệp vụ trước; giới hạn concurrency và tốc độ; dùng backoff có giới hạn; ghi HTTP status/thời điểm lỗi; thử tải tăng dần trong phạm vi được chủ hệ thống cho phép, không tự động retry vô hạn.             |
| 3   | File tải về sai dữ liệu mà không báo lỗi      | **Cao** — lỗi không crash nhưng có thể đưa số liệu sai vào báo cáo hoặc hệ thống downstream.                                                                                   | `[FACT]` Robot hiện mới xác minh định dạng XLSX, số dòng, tên cột và tổng; `[ASSUMPTION]` nếu filter không được áp dụng đúng mà schema vẫn giống nhau, kiểm tra kỹ thuật đơn thuần có thể không phát hiện. | Đối chiếu với file baseline cùng đúng bộ filter; lưu metadata filter cùng file; kiểm tra định dạng thật, schema, số dòng, tổng và các invariant nghiệp vụ; không phát hành dữ liệu khi baseline/filter chưa được xác nhận.     |
| 4   | Latency VN ↔ India gây timeout                | **Trung bình** — `[FACT]` 3 lần PoC hoàn tất trong `17,6–27,2s`, chưa gặp timeout; mẫu nhỏ và chỉ phản ánh một phiên chạy.                                                     | `[ASSUMPTION]` Mạng chậm hoặc portal quá tải có thể làm `goto`, submit filter hay chờ Export vượt timeout, gây thất bại từng lần và tăng thời gian xử lý.                                                  | Dùng explicit wait theo trạng thái DOM/network thay cho sleep cố định; đặt timeout riêng cho từng bước dựa trên số đo; retry có giới hạn cho lỗi mạng an toàn; log thời gian từng bước để điều chỉnh ngưỡng theo dữ liệu thật. |
| 5   | Ràng buộc Terms of Use                        | **Cao / chưa thể kết luận được phép** — `[FACT]` đã đọc Copyright Policy nhưng liên kết Terms of Use hiện không cung cấp nội dung; chưa tìm thấy quy định về automated access. | `[ASSUMPTION]` Nếu automated access bị hạn chế, việc triển khai có thể phải dừng hoặc chuyển sang kênh dữ liệu được VAHAN cho phép; ngoài ra có rủi ro tuân thủ khi tái sử dụng/phân phối dữ liệu.         | Xin xác nhận bằng văn bản từ mentor/VF India và chủ hệ thống về quyền truy cập tự động, tần suất, lưu trữ và phân phối; ghi nguồn; chưa chạy quy mô lớn hoặc production trước khi được phê duyệt.                              |
| 6   | CAPTCHA khiến luồng không thể chạy unattended | **Cao** — `[FACT]` CAPTCHA bắt buộc trước mỗi lần Apply; 1/3 lần đo đã nhập sai và cần nhập lại.                                                                               | `[FACT]` Mỗi lượt hiện cần một người đọc/nhập CAPTCHA, nên không phù hợp job nền hoặc lịch chạy hoàn toàn tự động; nếu không nhập trong 300 giây thì lần chạy thất bại.                                    | Giữ mô hình attended và retry tối đa 3 lần trong PoC; làm rõ SLA/tần suất; hỏi chủ hệ thống về API hoặc cơ chế truy cập chính thức.                                                                                            |


---

## 9. KẾT LUẬN KỸ THUẬT CÓ BẰNG CHỨNG

### 9.1 Hướng đi nên chọn để mở rộng


| Phương án                  | Bằng chứng ủng hộ                                                                                                                                                                                                                                              | Bằng chứng phản đối                                                                                                                                                                                                                                                                                                                                                   |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A. RPA thao tác trên UI    | [FACT] Tương thích trực tiếp với kiến trúc portal: file Excel được build hoàn toàn ở phía client (thư viện SheetJS parse dữ liệu từ DOM bảng hiển thị). Trình duyệt tự động (Playwright) tự nhiên kích hoạt được SheetJS để sinh file `.xlsx` chuẩn định dạng. | [FACT] Tốn tài nguyên tính toán hơn gọi HTTP thuần; phụ thuộc vào độ ổn định của DOM/selector; cần xử lý CAPTCHA trên giao diện.                                                                                                                                                                                                                                      |
| B. Gọi thẳng HTTP endpoint | [FACT] Tiết kiệm tài nguyên máy tính nếu server cung cấp API tải file trực tiếp.                                                                                                                                                                               | [FACT] Server KHÔNG có endpoint HTTP trả về binary file Excel để replay trực tiếp. Form POST filter có CAPTCHA bắt buộc và CSRF token theo phiên, response chỉ trả về HTML server-rendered; không hỗ trợ tải file Excel trực tiếp qua HTTP. |


**Đề xuất:** Chọn **Phương án A (RPA thao tác trên UI bằng Playwright)**.
**Điều kiện để đề xuất này đúng:** Vận hành theo mô hình Attended RPA (người dùng trực tiếp nhập CAPTCHA thủ công trên trình duyệt theo đúng quy định, tuyệt đối không bypass CAPTCHA) và duy trì selector ổn định theo ID tĩnh đã xác định (`#stateName`, `#vehicleCategoryGroup`, `#vehicleFuel`, `#applyTrigger`, `#downloadBtn1`).

### 9.2 Điều buổi này CHƯA chứng minh được

- ---
- ---

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

