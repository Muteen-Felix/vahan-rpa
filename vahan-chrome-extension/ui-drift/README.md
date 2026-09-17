# VAHAN UI Drift Guard (isolated module)

Thư mục này là lớp kiểm tra giao diện và log riêng, được thêm vào MVP mà
không thay thế controller điền filter/CAPTCHA hiện tại.

## Luồng hoạt động

1. Service worker đặt `chrome.alarms` theo số ngày người dùng lưu trên Web UI
   (mặc định 3 ngày, cho phép từ 1 đến 365 ngày).
2. Khi alarm chạy, extension chỉ tìm tab VAHAN chính thức đã mở đúng URL
   `https://analytics.parivahan.gov.in/analytics/vahanpublicreport?lang=en`.
   Extension không tự mở tab; nếu tab chưa mở hoặc URL bị chuyển sang trang khác,
   lượt kiểm tra được ghi là `CHECK_ERROR` để Dev biết cần xử lý.
3. `health-check-content.js` chỉ đọc DOM: kiểm tra control bắt buộc, wrapper
   multiselect và một số option dữ liệu ổn định (`Two Wheeler`, `Fuel`, danh
   sách Fuel không rỗng).
4. Kết quả được so sánh với lần trước để phát hiện `DATA_CHANGED` khi digest
   option thay đổi.
5. Kết quả và diagnostic được gửi tới backend qua `POST /api/ui-health/logs`.
   Backend lưu CSV theo cửa sổ tối đa 10 ngày hoặc 512 KiB; tên dạng
   `report-YYYY-MM-DD-to-YYYY-MM-DD.csv`. Khi backend tạm thời không khả dụng,
   extension giữ các health check chưa gửi trong hàng đợi local và gửi bù ở lần
   kiểm tra kế tiếp.

Health check production chạy trên trang VAHAN chính thức. Nó không điền filter,
không đọc/giải CAPTCHA, không bấm Apply và không tải báo cáo. Kiểm tra clone local
chỉ dành cho lệnh DevTools `runOnTab` được gọi thủ công.

## Các điểm tích hợp

- `guard.js`: contract, signature, diagnostic `UI_DRIFT_*` và safe-repair API
  dành cho controller tương lai.
- `health-check-content.js`: listener chỉ phục vụ message
  `RUN_SCHEDULED_UI_CHECK`.
- `health-check.mjs`: alarm, xác minh tab VAHAN chính thức, so sánh dữ liệu, gửi log
  backend, queue log offline, queue alert và state.
- `src/background.js`: chỉ import/register module health-check.
- `manifest.json`: thêm quyền `alarms` và nạp các content script riêng.

Web UI gọi `GET/PUT /api/ui-health/schedule`. Backend lưu cấu hình trong bộ nhớ
MVP và phát sự kiện `ui-health:schedule-updated` qua namespace `/runner`; runner
đang kết nối sẽ đặt lại alarm ngay. Khi runner khởi động hoặc kết nối lại, nó
đọc lại lịch từ backend. Nếu backend tạm thời không khả dụng, extension giữ
alarm hiện tại hoặc dùng mặc định 3 ngày cho lần cài mới.

Nút **Kiểm tra ngay** trên Web UI gọi `POST /api/ui-health/run-now`. Backend chọn
một runner đang kết nối và phát `ui-health:run-now`; extension chỉ chạy trên tab
VAHAN chính thức đang hiển thị ở cửa sổ hiện tại, đúng URL và có content script
phản hồi. Manual check không fallback sang tab nền và không tự mở tab. Nếu tab
đang hiển thị không phải trang official hoặc tab đổi URL, lần chạy được ghi là
`CHECK_ERROR`. Lịch alarm không có thao tác người dùng nên vẫn có thể chọn một
tab official khác đã mở.

Web UI gọi `GET /api/ui-health/reports?date=YYYY-MM-DD` để xem các bản ghi của
một ngày và dùng `GET /api/ui-health/reports/{fileName}/download` để tải đúng
file CSV từ backend. Backend giữ file trong `apps/api-server/runtime/ui-health-logs`
(có thể đổi bằng `VAHAN_UI_HEALTH_LOG_DIR`).

State cục bộ:

- `vahanUiHealthCheck`: lần kiểm tra gần nhất.
- `vahanUiPendingDevNotification`: alert chờ connector Dev đọc sau này.
- `vahanUiHealthPendingLogs`: các health check chưa gửi được lên backend.

Hiện tại alert Dev vẫn chưa gửi ra ngoài; connector website/webhook/email có thể
đọc `GET_UI_HEALTH_CHECK` hoặc storage sau này. Nếu Chrome tắt hoàn toàn, alarm
của extension không chạy; cần scheduler backend riêng nếu muốn kiểm tra khi máy
và Chrome đều tắt.

## Test bằng DevTools trên clone local (bản unpacked)

Health check production luôn kiểm tra trang chính thức. Để kiểm tra một DOM đã bị
sửa trực tiếp trong DevTools mà không ảnh hưởng production, dùng lệnh `runOnTab`
thủ công trên fixture clone:

```bash
python3 -m http.server 8765 --directory /path/to/vahan-rpa-ui-fixture
```

Mở trang clone baseline (fixture mặc định chạy cổng `8765`; Live Server có thể
dùng cổng `5500`):

`http://127.0.0.1:8765/analytics/vahanpublicreport?lang=en&ui=baseline&dev=1`

Sau khi reload extension ở `chrome://extensions`, mở DevTools của service worker
và chạy:

```js
const tabs = await chrome.tabs.query({});
const tab = tabs.find((item) =>
  /^http:\/\/(127\.0\.0\.1|localhost):(8765|5500)\/analytics\/vahanpublicreport/.test(item.url || ""),
);
if (!tab?.id) throw new Error("Chưa mở clone tại cổng 8765 hoặc 5500.");
await vahanUiHealthDebug.runOnTab(tab.id);
```

`runOnTab` không đóng tab và vẫn ghi CSV với `trigger=devtools`; đây là ngoại lệ
chỉ dành cho kiểm thử local có chủ đích. Hãy chạy một lần ở trạng thái bình thường
để tạo baseline, sửa DOM của clone, rồi chạy lại. Các
thao tác thường dùng trong Console của tab clone:

```js
// UI_DRIFT_REQUIRED_CONTROL: xóa control bắt buộc
document.querySelector("#vehicleFuel")?.remove();

// UI_DRIFT_REQUIRED_CONTROL: đổi ID control bắt buộc
const fuelForIdTest = document.querySelector("#vehicleFuel");
if (fuelForIdTest) fuelForIdTest.id = "vehicleFuelRenamed";

// UI_DRIFT_REQUIRED_CONTROL: tạo duplicate control
const original = document.querySelector("#vehicleFuel");
if (original) original.after(original.cloneNode(true));

// UI_DRIFT_REQUIRED_OPTION: đổi tên option bắt buộc
const option = [...document.querySelectorAll("#vehicleCategoryGroup option")]
  .find((item) => item.textContent.trim() === "Two Wheeler");
if (option) option.textContent = "Two Wheeler (test)";

// UI_DRIFT_EMPTY_OPTIONS: làm rỗng danh sách Fuel
const fuel = document.querySelector("#vehicleFuel");
if (fuel) fuel.replaceChildren();

// Khôi phục nhanh bằng reload clone
location.reload();
```

Các URL scenario dựng sẵn cũng chỉ chạy trên clone, ví dụ:

`http://127.0.0.1:8765/analytics/vahanpublicreport?lang=en&ui=missing-fuel&dev=1`

Sau mỗi lần chạy, xem mục **Báo cáo kiểm tra theo ngày** trên Web UI. Không dùng
DevTools để bấm Apply hoặc gửi CAPTCHA; health check chỉ nên đọc DOM.

## Kiểm tra

```bash
npm run test:ui-drift
node --check ui-drift/guard.js
node --check ui-drift/health-check-content.js
```

Ma trận test DevTools đầy đủ, gồm mutation trên clone local, kiểm tra URL/tab,
queue backend, CSV và các mã lỗi flow nâng cao: [DEVTOOLS-TESTING.md](./DEVTOOLS-TESTING.md).
