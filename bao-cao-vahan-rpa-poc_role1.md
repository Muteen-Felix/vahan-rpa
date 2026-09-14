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
| Fuel | ___ |
| Các filter khác để mặc định | ___ |

---

## 1. TÓM TẮT CHO MENTOR *(viết cuối cùng — 5 dòng, không hơn)*

- **Làm được gì:** [FACT] Đã kiểm chứng robot và một lượt làm tay cùng bộ lọc; cả hai trả 3 cột, 11 dòng dữ liệu và tổng `15.722.527`.
- **Chưa làm được gì:** [BLOCKED] Chưa lấy được file Excel của lượt tay tại đường dẫn host-readable để so sánh byte/hash; chưa đo thời gian tay và thời gian setup độc lập.
- **Kết luận kỹ thuật quan trọng nhất:** [FACT] 4 file robot có cùng nội dung và khớp bảng kết quả live của lượt tay cho Two Wheeler theo Fuel, All State, năm 2026.
- **Cần gì để đi tiếp:** Ghi giờ một lượt tay cùng cấu hình, đo setup `S`, rồi đưa file Excel vừa tải vào thư mục làm việc để đối chiếu cấp file.
- **Câu hỏi cần mentor trả lời:** Tiêu chí nghiệm thu có cần file/byte/hash trùng tuyệt đối, hay chấp nhận đối chiếu bảng dữ liệu cùng bộ lọc?

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
| Method (GET / POST / XHR) | [FACT] Form filter dùng `POST`. [ASSUMPTION] Export có thể tạo file từ dữ liệu trên trình duyệt qua SheetJS; chưa xác nhận được bằng một lượt export thành công. |
| URL endpoint đầy đủ | [FACT] Form action: `https://analytics.parivahan.gov.in/analytics/vahanpublicreport?lang=en`. [FACT] Có đường dẫn log Excel: `https://analytics.parivahan.gov.in/analytics/reports/logDownload/Vahan%20Public%20Report%20Xlsx`. Chưa xác nhận log endpoint có được gọi trong lượt export thành công. |
| Payload / query params | [FACT] Có các field `stateMultiple`, `rtoCodeMultiple`, `vehicleCategoryGroup`, `vehicleFuels`, `fromYear`, `toYear`, `xAxis`, `yAxis`, `captcha`, `_csrf` và các field filter khác. |
| Response Content-Type | [FACT] Trang ban đầu trả `text/html;charset=utf-8` và tải thư viện SheetJS `xlsx.full.min.js`. [BLOCKED] Chưa thu được response của một lượt export thành công để xác định Content-Type của file. |
| Có cần cookie phiên không? | [FACT] GET trang tạo cookie `analytics_sh_cok` với thuộc tính `Secure` và `HttpOnly`. |
| Có CSRF token / ViewState / `j_id...` trong payload không? | [FACT] Có hidden input `name="_csrf"`, giá trị thay đổi theo lần tải trang. Không thấy ViewState hoặc ID dạng `j_id...` trong HTML đã kiểm tra. |
| **Replay được request này bằng HTTP client không?** | [BLOCKED] Chưa có POST/export thành công để replay. Chưa thể kết luận hướng HTTP client thay thế UI. |
| Nếu đã thử replay: kết quả | [BLOCKED] Chưa thực hiện replay vì chưa có request export hoàn chỉnh và CAPTCHA chưa được hoàn tất. |

> Ô "replay được không" là **phát hiện có giá trị nhất cả buổi**. Nếu YES thì hướng đi dài hạn đổi hoàn toàn.

### 4.2 Công nghệ trang
| Câu hỏi | Trả lời |
|---|---|
| Stack (JSF/PrimeFaces, SPA, khác) | [FACT] Trang server-rendered HTML, dùng jQuery, Bootstrap, Bootstrap Datepicker và SheetJS (`xlsx.full.min.js`); không phải SPA. |
| ID phần tử tĩnh hay sinh động (`j_idt123`)? | [FACT] Control chính dùng ID tĩnh, có nghĩa như `stateName`, `rtoCode`, `vehicleCategoryGroup`, `vehicleFuel`, `reportType`, `fromYear`, `toYear`, `yAxis`, `xAxis`, `externalCaptcha`, `applyTrigger`, `downloadBtn1`. Không thấy ID `j_idt...`. |
| Dropdown State → RTO phụ thuộc nhau thế nào | [FACT] RTO bị vô hiệu khi chưa chọn hoặc chọn nhiều State. Khi chọn đúng một State, trang gọi `GET /analytics/json_rtos?stateCode=<code>`, nhận JSON rồi thêm option vào `#rtoCode`. |
| Thời gian chờ sau mỗi lần chọn filter | [BLOCKED] Role 2 chưa đo riêng thời gian chờ cho từng filter. |
| Có captcha / rate-limit / chặn sau N request? | [FACT] CAPTCHA bắt buộc trước POST tạo báo cáo. [BLOCKED] Chưa xác định được rate-limit hoặc ngưỡng chặn sau N request. |
| Có phân trang không | [FACT] Report hiển thị dạng bảng thống kê tổng hợp; chưa quan sát thấy phân trang dữ liệu chi tiết. |

### 4.3 Selector map — BÀN GIAO CHO ROLE 3
| Phần tử | Selector | Cách định vị (id / attribute / text) | Ổn định? |
|---|---|---|---|
| Archived Flag | `#archivedFlags` | ID của `<select multiple>` | Cao — ID tĩnh. |
| Year Type | `#reportType` | ID của `<select>` | Cao — ID tĩnh. |
| Financial Year | `#financialYearSelect` | ID của `<select multiple>` | Trung bình — phụ thuộc Year Type. |
| Registration From Year | `#fromYear` | ID của `<input>` | Trung bình — phụ thuộc Year Type. |
| Registration To Year | `#toYear` | ID của `<input>` | Trung bình — phụ thuộc Year Type. |
| From Date | `#fromDate` | ID của `<input>` | Trung bình — phụ thuộc Year Type. |
| To Date | `#toDate` | ID của `<input>` | Trung bình — phụ thuộc Year Type. |
| Report Year | `#reportYear` | ID của `<select>` | Trung bình — phụ thuộc Year Type. |
| Report Month | `#reportMonth` | ID của `<select>` | Trung bình — phụ thuộc Year Type. |
| State | `#stateName` | ID của `<select multiple>` | Cao — ID tĩnh. |
| RTO | `#rtoCode` | ID của `<select multiple>` | Trung bình — option tải động theo State. |
| Emission | `#vehicleEmission` | ID của `<select multiple>` | Cao — ID tĩnh. |
| Maker | `#vehicleMaker` | ID của `<select multiple>` | Trung bình — option tải lazy. |
| Category Group | `#vehicleCategoryGroup` | ID của `<select multiple>` | Cao — ID tĩnh. |
| Sub-Category | `#vehicleSubCategory` | ID của `<select multiple>` | Cao — ID tĩnh. |
| Vehicle Class | `#vehicleClass` | ID của `<select multiple>` | Cao — ID tĩnh. |
| Fuel | `#vehicleFuel` | ID của `<select multiple>` | Cao — ID tĩnh. |
| EV Type | `#evType` | ID của `<select multiple>` | Cao — ID tĩnh. |
| Status | `#vehicleStatus` | ID của `<select multiple>` | Cao — ID tĩnh. |
| Owner Type | `#vehicleOwnerType` | ID của `<select multiple>` | Cao — ID tĩnh. |
| Vehicle Type | `#vehicleType` | ID của `<select>` | Cao — ID tĩnh. |
| Fitness Valid as On Date | `#fitnessCheck` | ID của `<select>` | Cao — ID tĩnh. |
| Delhi NCR | `#delhiNcr` | ID của `<select>` | Cao — ID tĩnh. |
| Y-Axis | `#yAxis` | ID của `<select>` | Cao — ID tĩnh. |
| X-Axis | `#xAxis` | ID của `<select>` | Trung bình — option sinh theo Y-Axis. |
| CAPTCHA input | `#externalCaptcha` | ID của `<input>` | Cao — ID tĩnh; nhập thủ công. |
| Refresh CAPTCHA | `#captchaImg` | ID của `<button>` | Cao — ID tĩnh. |
| Apply | `#applyTrigger` | ID của `<button type="submit">` | Cao — ID tĩnh. |
| Export CSV | `#downloadBtn` | ID; chỉ có sau khi có kết quả | Trung bình. |
| Export Excel | `#downloadBtn1` | ID; chỉ có sau khi có kết quả | Trung bình. |

**Hidden field nội bộ — không thao tác trực tiếp:** `#hiddenCaptchaField`, `#xAxis_hidden`, `#yAxis_hidden`, `#selectedMakers`, `#last5FYHidden` và `input[name="_csrf"]`.

**Thời điểm bàn giao thực tế:** ___ `[BLOCKED]` Role 2 chưa ghi nhận phút bàn giao *(mục tiêu: phút 50)*

### 4.4 Pháp lý
- Đã đọc Terms of Use / Copyright Policy chưa: [FACT] Đã đọc Copyright Policy. Nội dung cho phép tái sử dụng nếu sao chép chính xác, không gây hiểu nhầm và ghi nguồn; nội dung bên thứ ba cần xin phép chủ sở hữu. [BLOCKED] Liên kết Terms of Use trên trang hiện là `href="#"`, chưa lấy được nội dung để đánh giá.
- Có điều khoản nào nói về automated access không: [BLOCKED] Chưa tìm thấy hoặc đọc được Terms of Use quy định automated access, scraping hay RPA; chưa thể kết luận được phép hay bị cấm.

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

| Tiêu chí | Baseline tay — lượt kiểm chứng cùng bộ lọc | Robot | Khớp? |
|---|---|---|---|
| Tên/định dạng file | Đã bấm **Download Excel Report** sau Apply, nhưng browser in-app chưa trả về đường dẫn file để đọc độc lập tên/định dạng | Lượt chạy kiểm chứng tạo `1789380014_table_data.xlsx`; 4 file robot đã nhận (`table_data-2.xlsx`, `1789378528_table_data.xlsx`, `1789378546_table_data.xlsx`, `1789378566_table_data.xlsx`) cũng là XLSX | Chưa chốt ở cấp file/byte |
| Dung lượng | `n.a.` — không có file tải về ở đường dẫn host-readable | `16.864 bytes/file` | `n.a.` |
| Số dòng | `11` dòng dữ liệu trên bảng kết quả live | `11` dòng dữ liệu/file (Sheet1, dòng 4–14) | Có (theo dữ liệu hiển thị) |
| Tên cột | `Fuel`, `Two Wheeler`, `Total` | `Fuel`, `Two Wheeler`, `Total` | Có |
| **Con số tổng** | **`15.722.527`** | **`15.722.527/file`** | Có |

`[FACT]` Xác minh thực chạy: ngày 14/09/2026, robot chạy thành công một lượt end-to-end và tạo `1789380014_table_data.xlsx` trong `18,8s`. File này là XLSX thật, `16.864 bytes`, có 15 dòng vật lý (11 dòng dữ liệu), tổng `15.722.527`; tổng 11 dòng dữ liệu cũng bằng `15.722.527`. Ma trận ô của file mới trùng 3 file timestamp sau khi chuẩn hoá dấu phân cách hàng nghìn; `table_data-2.xlsx` cũng cùng cấu trúc và tổng.

`[FACT]` Kết luận đối chiếu: Lượt manual ngày 14/09/2026 đã Apply thành công với đúng bộ lọc của robot: năm 2026, All State, `Two Wheeler`, Fuel = All, Y = Fuel, X = Vehicle Category Group. Bảng live trả 11 dòng, 3 cột và tổng `15.722.527`, khớp với file robot. Vì vậy có bằng chứng dữ liệu đầu ra cùng cấu hình là tương đương.

`[BLOCKED]` Chưa hoàn tất đối chiếu ở cấp file/byte: thao tác tải Excel đã được bấm nhưng browser in-app không cung cấp file mới tại đường dẫn host-readable để kiểm tra tên, dung lượng hoặc hash. `table_data (2).xlsx` là file lịch sử khác bộ lọc, không dùng làm baseline cho kết luận này.

---

## 7. ĐO LƯỜNG TỔNG HỢP

| Chỉ số | Làm tay | Automation |
|---|---|---|
| Thời gian 1 lần chạy | `n.a.` — đã có lượt Apply và nhận bảng kết quả cùng bộ lọc, nhưng không bấm giờ độc lập; `30 giây` ở Mục 3.2 là bộ lọc khác nên không dùng làm `Ttay`. | `[FACT]` Lượt chạy kiểm chứng end-to-end: `18,8s` (mở trang `3,4s`, chọn filter `3,3s`, CAPTCHA + Apply `10,6s`, chờ bảng `0,0s`, tải file `0,5s`). Log có sẵn của repo: 3/3 lượt thành công, trung bình `21,4s`, dải `17,6–27,2s`. |
| Số thao tác của người | 1 lần người dùng nhập CAPTCHA; số click không được đo độc lập. `~40 click` ở Mục 3.2 không được tái sử dụng cho cấu hình này. | `[FACT]` Người dùng chỉ cần nhập CAPTCHA trong browser (1 lần nhập, 6 ký tự); robot tự chọn filter, Apply, export và kiểm tra file. |
| Tỉ lệ thành công | Apply + hiển thị bảng kết quả: `1/1` lượt cùng bộ lọc; đã bấm xuất Excel nhưng chưa lấy được file ở máy host. | `[FACT]` Lượt kiểm chứng hiện tại: `1/1` thành công khi CAPTCHA đúng. Log repo: `3/3` thành công; 1 lượt phải nhập lại CAPTCHA do lần đầu sai. 4 file robot được cung cấp đều là XLSX hợp lệ và có dữ liệu. |
| Thời gian setup ban đầu (một lần) | — | `[BLOCKED]` Chưa đo được thời gian xây dựng/debug selector ban đầu. Phiên kiểm chứng dùng môi trường đã có Playwright và không tính vào thời gian chạy. |

`[BLOCKED]` Phần đối chiếu dữ liệu cùng bộ lọc đã có kết quả khớp, nhưng chưa thể chốt điểm hòa vốn thực tế: lượt làm tay chưa có thời gian bấm giờ độc lập (`Ttay`) và thời gian setup `S` chưa đo. Khi đo lại cùng bộ filter, điểm hòa vốn là `S / (Ttay - Trobot)` lượt, chỉ có ý nghĩa khi `Ttay > Trobot`.

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
