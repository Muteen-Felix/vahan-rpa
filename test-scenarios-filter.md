# 10 bộ scenario filter — VAHAN RPA

## Nguồn dữ liệu dùng để build bảng này (không đoán mò)
- `run3_log.txt` — danh sách 33 option Fuel thật, đọc từ header cột "Fuel (...)" của file Excel đã tải (`[FACT]`).
- `apps/web-ui/src/components/FilterForm.tsx` (dòng 15-25) — object `initial`, các giá trị seed cho từng trường. Các giá trị này chỉ được **giữ lại** bởi `matchingMany()`/`matching()` nếu khớp đúng option thật do extension đọc trực tiếp từ DOM VAHAN lúc runtime (`apps/web-ui` fetch `GET_ALL_OPTIONS` từ content script) — nên coi là giá trị **đã tồn tại thật trên trang**, nhưng **chưa có log chạy end-to-end** nào xác nhận tổ hợp đó Apply/Export thành công.
- `bao-cao-vahan-rpa-poc.md` mục 0.1/5.2/5.3 và `bao-cao-vahan-rpa-poc_role2.md` mục baseline (dòng 91-92) — 2 tổ hợp đã chạy thật (1 bằng robot, 1 bằng tay).

## Giới hạn đã biết — KHÔNG bịa thêm ngoài các giá trị dưới
- **Category Group**: toàn bộ 3 nguồn trên chỉ xác nhận đúng **một** giá trị thật: `Two Wheeler`. Không có nơi nào trong repo dò được tên category group khác (Three Wheeler, LMV, HMV...). → mọi scenario dưới đây **giữ nguyên** `Category Group = Two Wheeler`; muốn đa dạng field này phải chạy `GET_ALL_OPTIONS` qua extension trước rồi mới thêm được — hiện tại là `[BLOCKED]`.
- **State/RTO**: chỉ xác nhận 2 cấu hình thật — `ALL STATES` (mặc định trang, dùng trong flow robot) và `Delhi` / RTO `DWARKA - DL9` (seed trong `FilterForm.tsx`). Không bịa thêm bang khác.
- **subCategories/classes/evTypes/ownerTypes/vehicleType/fitness/emissions/period/delhiNcr/statuses/archivedFlags**: mỗi trường chỉ có đúng 1 giá trị thật được xác nhận (liệt kê trong bảng). Giữ cố định theo giá trị đó trong toàn bộ 10 bộ — không có cơ sở để đổi.
- Trường **thật sự có nhiều giá trị đã xác nhận để đa dạng hoá** là: **Fuel** (34 option) và **Year (from/to)** (2025 vs mặc định trang). 10 bộ dưới đây biến thiên chủ yếu ở 2 trường này.
- **Y-Axis/X-Axis: CHỈ có đúng 1 cặp đã xác nhận chạy được qua extension mới (`vahan-chrome-extension/content.js`): `Y=Fuel / X=Vehicle Category Group`.** Đã thử chạy thật cặp `Y=Vehicle Category Group / X=Total Consolidated` (lấy từ ghi chú tay Role 2, `bao-cao..._role2.md` dòng 92) và bị lỗi thật `#xAxis: dynamic options did not load within 15000 ms.` — vì `#xAxis` được VAHAN nạp **động theo Y-Axis đã chọn** (`getXAxisOptions()` trong `content.js`), và "Total Consolidated" không xuất hiện trong danh sách X-Axis thật khi Y-Axis = Vehicle Category Group (hoặc trang tải quá 15s). → **10/10 bộ dưới đây đã đổi về cùng 1 cặp Y/X đã xác nhận**, không còn đa dạng ở trường này nữa; bộ #10 vì vậy trùng hệt bộ #1 (cùng fuel, cùng trục) — chỉ còn ý nghĩa "chạy lặp lại lần 2" chứ không phải "đổi trục" như thiết kế ban đầu.
- Muốn có thêm cặp Y/X khác để đa dạng lại, **không đoán tiếp** — dùng chính `apps/web-ui` (form thường, không qua batch) chọn Y-Axis mong muốn, đọc danh sách X-Axis thật hiện ra trong dropdown (UI gọi `GET_X_AXIS_OPTIONS` sống từ DOM), rồi mới đưa giá trị đó vào JSON.

---

## Bảng 10 bộ scenario

| # | Mô tả filter cần chọn | State / RTO | Category Group | Fuel | Year From–To | Y-Axis | X-Axis | Trạng thái |
|---|---|---|---|---|---|---|---|---|
| 1 | Baseline đã chạy robot — Fuel gộp tất cả | ALL STATES (để trống) | Two Wheeler | **All** (34 fuel liệt kê rõ) | mặc định trang (không set) | Fuel | Vehicle Category Group | `[FACT]` đã chạy thật qua batch runner mới, ✓ COMPLETED |
| 2 | Fuel cụ thể — PETROL | ALL STATES (để trống) | Two Wheeler | PETROL | mặc định trang (không set) | Fuel | Vehicle Category Group | `[ASSUMPTION]` — **đã đổi trục** khỏi cặp gốc `Vehicle Category Group/Total Consolidated` (baseline tay Role 1) vì cặp đó gây lỗi thật `#xAxis: dynamic options did not load within 15000 ms.` khi chạy qua automation |
| 3 | Fuel phổ biến khác — DIESEL | ALL STATES | Two Wheeler | DIESEL | mặc định trang | Fuel | Vehicle Category Group | `[ASSUMPTION]` option Fuel có thật (run3_log.txt), tổ hợp Apply/Export chưa chạy thử |
| 4 | Fuel điện — ELECTRIC(BOV), khớp seed evTypes | Delhi / DWARKA - DL9 | Two Wheeler | ELECTRIC(BOV) | mặc định trang | Fuel | Vehicle Category Group | `[ASSUMPTION]` — **đã đổi trục** khỏi cặp gốc `Vehicle Class/Month Wise` (seed FilterForm.tsx, chưa verify) sang cặp đã xác nhận chạy được |
| 5 | Fuel điện khác — PURE EV | ALL STATES | Two Wheeler | PURE EV | mặc định trang | Fuel | Vehicle Category Group | `[ASSUMPTION]` PURE EV có trong danh sách 34 option xác nhận, chưa chạy thử riêng lẻ (mới thấy trong tổng "All") |
| 6 | Hybrid — STRONG HYBRID EV | ALL STATES | Two Wheeler | STRONG HYBRID EV | mặc định trang | Fuel | Vehicle Category Group | `[ASSUMPTION]` như trên |
| 7 | CNG only | ALL STATES | Two Wheeler | CNG ONLY | mặc định trang | Fuel | Vehicle Category Group | `[ASSUMPTION]` như trên |
| 8 | Fuel hiếm/nhiều token đặc biệt — kiểm tra escape ký tự trong selector search | ALL STATES | Two Wheeler | PETROL(E20)/HYBRID/CNG | mặc định trang | Fuel | Vehicle Category Group | `[ASSUMPTION]` mục đích: test việc điền chuỗi có `/` và `()` vào `<select>` qua `selectLabels()` — chưa chạy thử, rủi ro cao nhất trong 10 bộ |
| 9 | Cùng Fuel=All nhưng đổi khoảng năm cụ thể (thay vì mặc định) | ALL STATES | Two Wheeler | All (34 fuel) | 2025–2025 | Fuel | Vehicle Category Group | `[ASSUMPTION]` `2025` là giá trị seed `fromYear/toYear` trong `FilterForm.tsx`; **chưa có log nào set Year khác mặc định** — đây là field ngoài phạm vi PoC gốc (`time-line.md`: "Không chạy nhiều bang / nhiều năm") |
| 10 | Fuel=All, chạy lặp lần 2 cùng cấu hình bộ #1 | ALL STATES | Two Wheeler | All (34 fuel) | mặc định trang | Fuel | Vehicle Category Group | `[ASSUMPTION]` — **đã mất ý nghĩa "đổi trục" ban đầu** vì cặp trục thay thế (`Vehicle Category Group/Total Consolidated`) bị lỗi thật; giờ trùng cấu hình bộ #1, chỉ còn giá trị đo lặp lại/ổn định |

---

## Đọc bảng này thế nào
- Cột "Trạng thái" là nhãn bắt buộc theo `CLAUDE.md` của repo con này — `[FACT]` = đã tự tay/robot chạy và verify; `[ASSUMPTION]` = giá trị filter có thật trong DOM (xác nhận qua code hoặc log tải file) nhưng **tổ hợp cụ thể trong hàng đó chưa được Apply+Export thử qua automation**.
- 8/10 bộ là `[ASSUMPTION]` vì đây là mở rộng test coverage **ngoài phạm vi** buổi spike gốc (`time-line.md` mục 2: "Ngoài phạm vi... Không chạy nhiều bang/nhiều năm"). Trước khi coi các bộ này là "đã kiểm chứng", cần chạy qua `apps/web-ui` (đã có UI chọn filter + extension full-selectors) rồi ghi kết quả thật (thành công/lỗi, thời gian, số dòng file) — không tự suy ra từ việc "option tồn tại" là "chạy được".
- Bộ #8 nên chạy trước tiên trong số các bộ `[ASSUMPTION]` — rủi ro selector cao nhất (chuỗi search dài, có ký tự `/`, `(`, `)` có thể làm `select_checkbox_option()`/tương đương trong extension tìm nhầm hoặc không khớp `data-search-text`).
- Category Group vẫn bị khoá ở `Two Wheeler` cho cả 10 bộ — đây là `[BLOCKED]`, không phải lựa chọn thiết kế. Muốn gỡ, cần chạy `GET_ALL_OPTIONS` qua extension đang chạy thật (`apps/web-ui`) để lấy danh sách category group thật, sau đó bổ sung bộ scenario mới — không đoán tên trước.
