# Hướng dẫn test VAHAN UI Health bằng DevTools

Tài liệu này mô tả các ca kiểm thử cho extension, UI drift guard, health-check,
backend log và CSV report. Mục tiêu là tạo lại lỗi có chủ đích để Dev nhìn thấy
đúng `status`, `error_code`, `target`, `expected`, `actual` và
`diagnostic_details`.

Tài liệu chỉ dùng cho bản clone local. Không dùng DevTools để sửa DOM, nhập hoặc
giải CAPTCHA, bấm Apply, gửi form hay thay đổi dữ liệu trên trang VAHAN chính
thức.

## 1. Quy tắc phạm vi

- Trang chính thức mà health-check production phải xác minh là
  `https://analytics.parivahan.gov.in/analytics/vahanpublicreport?lang=en`.
- Lịch `alarm` và nút chạy từ Web UI chỉ kiểm tra tab chính thức đã mở sẵn.
  Extension không tự mở tab và không lấy clone local làm tab production.
- `runOnTab(tabId)` là API debug chỉ gọi thủ công trong DevTools. API này cho
  phép kiểm tra clone local tại cổng `8765` hoặc `5500` và ghi log với
  `trigger=devtools`.
- Mỗi lần chạy đều lưu một bản ghi health-check. `PASS` cũng có trong lịch sử;
  lỗi có thêm report chi tiết và diagnostic JSON.
- Khi test lỗi backend, có thể để extension xếp hàng log offline. Không xóa
  `vahanUiHealthPendingLogs` trước khi kiểm tra cơ chế gửi bù.

## 2. Chuẩn bị môi trường

### 2.1. Chạy backend và clone local

Terminal 1:

```bash
cd /Users/mac/Desktop/vahan/vahan-rpa/ui-fixture
python3 -m http.server 8765
```

Terminal 2, nếu backend chưa chạy:

```bash
cd /Users/mac/Desktop/vahan/vahan-rpa/apps/api-server
PYTHONPATH=. ./.venv/bin/python -m uvicorn app.main:application --host 127.0.0.1 --port 8000
```

Mở clone baseline:

`http://127.0.0.1:8765/analytics/vahanpublicreport?lang=en&ui=baseline&dev=1`

`dev=1` bật bảng điều khiển fixture với các nút xóa Fuel, xóa option
`Two Wheeler`, duplicate wrapper và khôi phục trang.

### 2.2. Build và nạp extension

```bash
cd /Users/mac/Desktop/vahan/vahan-rpa/vahan-chrome-extension
npm install       # chỉ cần khi node_modules chưa có
npm run build
```

Trong `chrome://extensions`:

1. Bật **Developer mode**.
2. Chọn **Load unpacked** và trỏ tới
   `/Users/mac/Desktop/vahan/vahan-rpa/vahan-chrome-extension`.
3. Sau mỗi lần build, bấm **Reload** extension.
4. Bấm **service worker / Inspect** để mở DevTools của background.

Nếu cần kiểm tra log backend, extension phải có `runnerConfig.serverUrl` là
`http://127.0.0.1:8000`. Có thể xem hoặc sửa giá trị này trong
**Application → Storage → Extension storage** của service worker.

## 3. Helper dùng trong Service Worker Console

Các lệnh sau chạy trong DevTools của **service worker**, không phải Console của
trang clone.

### 3.1. Tìm tab clone và chạy một health-check

```js
(async () => {
  const tabs = await chrome.tabs.query({
    url: "http://127.0.0.1:8765/analytics/vahanpublicreport*",
  });
  const tab = tabs.find((item) => Number.isInteger(item.id));
  if (!tab) throw new Error("Chưa mở tab clone baseline.");

  const result = await vahanUiHealthDebug.runOnTab(tab.id);
  console.table({
    status: result?.status,
    trigger: result?.trigger,
    pageUrl: result?.pageUrl,
    code: result?.report?.code || "",
    target: result?.report?.target || "",
    error: result?.error || "",
    backendOk: result?.backendLog?.ok,
    queued: result?.backendLog?.queued,
  });
  console.log(result);
  return result;
})();
```

Kết quả baseline phải là `status=PASS`. Nếu kết quả là `CHECK_ERROR` ngay cả
trên baseline, kiểm tra lại extension đã Reload, URL tab có đúng path và
`content.js` đã được inject chưa.

### 3.2. Xem state local của extension

```js
const state = await vahanUiHealthDebug.getState();
console.log(state);
console.table({
  lastStatus: state.vahanUiHealthCheck?.status,
  lastTrigger: state.vahanUiHealthCheck?.trigger,
  lastCode: state.vahanUiHealthCheck?.report?.code || "",
  pendingNotifications: state.vahanUiPendingDevNotification ? 1 : 0,
  pendingLogs: state.vahanUiHealthPendingLogs?.length || 0,
});
```

Các key cần biết:

- `vahanUiHealthCheck`: health-check gần nhất, bao gồm contract/report.
- `vahanUiPendingDevNotification`: cảnh báo `UI_DRIFT` hoặc `DATA_CHANGED`
  đang chờ connector Dev đọc.
- `vahanUiHealthPendingLogs`: log chưa gửi được backend.

### 3.3. Kiểm tra report và CSV backend

```js
const checkDate = new Date().toISOString().slice(0, 10);
const reports = await fetch(
  "http://127.0.0.1:8000/api/ui-health/reports?date=" + checkDate,
).then((response) => response.json());
console.log(reports);
console.table(reports.rows || []);
```

Sau khi chạy một ca lỗi, mở `http://127.0.0.1:5173/#configure`, chọn đúng ngày
và xem **Lịch sử kiểm tra**. Kiểm tra `Xem diagnostic` phải thấy cùng mã lỗi,
đối tượng, Expected/Actual và hành động xử lý. Không cần có một khu vực Log lỗi
riêng.

## 4. Trạng thái cần đối chiếu

| Status | Ý nghĩa | Điều cần kiểm tra |
| --- | --- | --- |
| `PASS` | Contract và các option dữ liệu ổn định khớp lần trước | Có row lịch sử, `error_code` để trống |
| `DATA_CHANGED` | DOM vẫn đủ nhưng digest/count option thay đổi | `error_code=UI_DRIFT_OPTION_DATA_CHANGED`, có `changes[]` |
| `UI_DRIFT` | Sai contract, thiếu control/option hoặc wrapper | Có report đầy đủ `target`, `expected`, `actual`, `action` |
| `CHECK_ERROR` | Không chạy được kiểm tra hoặc không gửi được log | Có `error`, `page_url`, `trigger`; nếu backend lỗi thì có queue local |

`trigger` thường là `devtools`, `alarm` hoặc `manual-web`. `page_url` của ca
production phải trỏ tới host chính thức; ca clone phải trỏ tới URL `127.0.0.1`
hoặc `localhost` để phân biệt rõ với log thật.

## 5. Quy trình chung cho mỗi ca

1. Reload clone hoặc bấm **Khôi phục** trong bảng điều khiển `dev=1`.
2. Chạy một lần baseline và xác nhận `PASS`.
3. Mở Console của tab clone và chạy đúng mutation của ca cần test.
4. Quay lại Service Worker Console và chạy helper `runOnTab` ở mục 3.1.
5. Đối chiếu `status`, `report.code`, `report.diagnostics` và `backendLog`.
6. Kiểm tra row mới trong Web UI và CSV backend.
7. Reload clone trước khi chuyển sang ca tiếp theo.

Không chạy đồng thời hai lệnh health-check. Controller dùng một promise chung
để tránh hai lượt kiểm tra ghi đè state của nhau.

## 6. Các ca test health-check trên clone

### 6.1. Baseline và scenario dựng sẵn

| ID | URL/query hoặc hành động | Kết quả mong đợi |
| --- | --- | --- |
| HC-01 | `ui=baseline`, chờ trang ổn định rồi chạy | `PASS` |
| HC-02 | `ui=missing-fuel` | `UI_DRIFT_REQUIRED_CONTROL`, Fuel có 0 control |
| HC-03 | `ui=wrong-type` | `UI_DRIFT_CONTROL_TYPE`, Category không còn `multiple` |
| HC-04 | `ui=wrong-label` | `UI_DRIFT_REQUIRED_OPTION`, thiếu `Two Wheeler` |
| HC-05 | `ui=missing-yaxis-option` | `UI_DRIFT_REQUIRED_OPTION`, thiếu `Fuel` ở Y-Axis |
| HC-06 | `ui=wrong-wrapper` | `UI_DRIFT_MULTISELECT_WRAPPER`, có 2 wrapper Fuel |
| HC-07 | `ui=moved-wrapper` | `UI_DRIFT_MULTISELECT_WRAPPER`, wrapper không ở đúng field group |
| HC-08 | `ui=missing-apply` | `UI_DRIFT_REQUIRED_CONTROL`, target nút Apply |
| HC-09 | `ui=visual-only` | `PASS`; thay CSS đơn thuần chưa phải lỗi contract |

Ví dụ mở scenario:

`http://127.0.0.1:8765/analytics/vahanpublicreport?lang=en&ui=missing-fuel&dev=1`

### 6.2. Thiếu hoặc duplicate control bắt buộc

Chạy từng lệnh trên **Console của tab clone**, sau đó chạy `runOnTab`.

```js
// HC-10: thiếu Fuel
document.querySelector("#vehicleFuel")?.remove();
```

```js
// HC-11: duplicate Fuel; querySelectorAll sẽ trả về 2 control
const fuel = document.querySelector("#vehicleFuel");
if (fuel) fuel.after(fuel.cloneNode(true));
```

```js
// HC-12: thiếu Category
document.querySelector("#vehicleCategoryGroup")?.remove();
```

```js
// HC-13: duplicate Category
const category = document.querySelector("#vehicleCategoryGroup");
if (category) category.after(category.cloneNode(true));
```

```js
// HC-14: thiếu form
document.querySelector("#vahanPublicForm")?.remove();
```

```js
// HC-15: thiếu Y-Axis hoặc X-Axis
document.querySelector("#yAxis")?.remove();
// Hoặc reload rồi chạy riêng:
// document.querySelector("#xAxis")?.remove();
```

```js
// HC-16: thiếu CAPTCHA input hoặc Apply button.
// Chỉ xóa để kiểm tra nhận diện; không nhập CAPTCHA và không bấm Apply.
document.querySelector("#externalCaptcha")?.remove();
// Hoặc reload rồi chạy riêng:
// document.querySelector("#applyTrigger")?.remove();
```

Các ca HC-10 đến HC-16 phải trả `UI_DRIFT_REQUIRED_CONTROL`. Diagnostic phải
có `selector`, `count` và target tương ứng. Với duplicate, Actual phải thể hiện
`DOM đang có 2 control`; với missing, Actual phải thể hiện `0 control`.

### 6.3. Sai loại control

```js
// HC-17: Category từ multi-select thành select đơn
document.querySelector("#vehicleCategoryGroup")?.removeAttribute("multiple");
```

```js
// HC-18: Fuel từ multi-select thành select đơn
document.querySelector("#vehicleFuel")?.removeAttribute("multiple");
```

Kết quả: `UI_DRIFT_CONTROL_TYPE`, Expected là `multiple select`, Actual nêu
control đã thiếu thuộc tính `multiple`.

### 6.4. Sai wrapper, ô search hoặc checkbox All

```js
// HC-19: xóa wrapper multiselect Fuel
document.querySelector('[data-for-select="vehicleFuel"]')?.remove();
```

```js
// HC-20: duplicate wrapper multiselect Fuel
const wrapper = document.querySelector('[data-for-select="vehicleFuel"]');
if (wrapper) wrapper.parentElement.append(wrapper.cloneNode(true));
```

```js
// HC-21: xóa ô search của Fuel
document.querySelector(
  '[data-for-select="vehicleFuel"] input.multiselect-dropdown-search',
)?.remove();
```

```js
// HC-22: duplicate ô search của Fuel
const search = document.querySelector(
  '[data-for-select="vehicleFuel"] input.multiselect-dropdown-search',
);
if (search) search.after(search.cloneNode(true));
```

```js
// HC-23: xóa checkbox All của Fuel
document.querySelector(
  '[data-for-select="vehicleFuel"] .multiselect-dropdown-all-selector',
)?.remove();
```

Kết quả mong đợi:

- HC-19/HC-20: `UI_DRIFT_MULTISELECT_WRAPPER`, `wrapperCount` lần lượt là 0/2.
- HC-21/HC-22: `UI_DRIFT_SEARCH_INPUT`, `count` lần lượt là 0/2.
- HC-23: `UI_DRIFT_ALL_OPTION_NOT_FOUND`, `count=0`.

Các lỗi này được phát hiện trong `getUiContract` trước khi flow điền filter.
Không thử sửa bằng cách đoán wrapper hoặc tự tạo lại widget trên production.

### 6.5. Thiếu option hoặc danh sách rỗng

```js
// HC-24: xóa option bắt buộc Two Wheeler
const twoWheeler = [...document.querySelectorAll("#vehicleCategoryGroup option")]
  .find((option) => option.textContent.trim() === "Two Wheeler");
twoWheeler?.remove();
```

```js
// HC-25: đổi tên option bắt buộc Two Wheeler
const renamed = [...document.querySelectorAll("#vehicleCategoryGroup option")]
  .find((option) => option.textContent.trim() === "Two Wheeler");
if (renamed) renamed.textContent = "Two Wheeler (test)";
```

```js
// HC-26: xóa option Fuel trên Y-Axis
const fuelAxis = [...document.querySelectorAll("#yAxis option")]
  .find((option) => option.textContent.trim() === "Fuel");
fuelAxis?.remove();
```

```js
// HC-27: làm rỗng select Fuel
document.querySelector("#vehicleFuel")?.replaceChildren();
```

Kết quả:

- HC-24/HC-25: `UI_DRIFT_REQUIRED_OPTION`, target Category, expected option
  `Two Wheeler`.
- HC-26: `UI_DRIFT_REQUIRED_OPTION`, target Y-Axis, expected option `Fuel`.
- HC-27: `UI_DRIFT_EMPTY_OPTIONS`, `optionCount=0`.

### 6.6. Dữ liệu option thay đổi nhưng DOM vẫn hợp lệ

`DATA_CHANGED` khác `UI_DRIFT`: control vẫn tồn tại và đúng loại, nhưng digest
hoặc số lượng option khác lần kiểm tra trước.

1. Reload baseline.
2. Chạy health-check và chờ `PASS`.
3. Thay danh sách X-Axis bằng một danh sách khác:

```js
const xAxis = document.querySelector("#xAxis");
if (xAxis) {
  xAxis.replaceChildren(
    new Option("--- Select X-Axis ---", ""),
    new Option("DevTools test option", "devtools-test"),
  );
}
```

4. Chạy health-check lần hai.

Kết quả phải là `status=DATA_CHANGED`,
`report.code=UI_DRIFT_OPTION_DATA_CHANGED`. Diagnostic phải có:

- `previousDataSignature` và `currentDataSignature`;
- `changes[]` với tên `xAxis`;
- count/digest trước và sau;
- Expected `Bộ dữ liệu option khớp lần kiểm tra trước`.

X-Axis của fixture được sinh động theo Y-Axis. Nếu log lần lượt báo count 1 và
15 chỉ vì chạy quá sớm, hãy chờ danh sách ổn định rồi chạy lại; đó là ca kiểm
tra timing, không kết luận ngay rằng dữ liệu production đã đổi.

### 6.7. UI thay đổi hình thức nhưng contract không đổi

```js
// HC-28: thay đổi CSS/class, không đổi selector hoặc option
document.body.classList.add("fixture-visual-only-change");
```

Kết quả mong đợi là `PASS`. Ca này xác nhận health-check hiện tại tập trung vào
contract và dữ liệu option, không phải visual regression pixel. Nếu cần test
pixel/ảnh, phải bổ sung công cụ visual diff riêng.

## 7. Test URL, tab và content script

### 7.1. Sai trang ở content layer

Trên Console của tab clone, có thể kiểm tra formatter/contract mà không gửi
request nào:

```js
function showUiDrift(call) {
  try {
    const value = call();
    console.log("Không phát hiện lỗi", value);
    return value;
  } catch (error) {
    console.table({
      code: error.code,
      step: error.step,
      message: error.message,
      details: JSON.stringify(error.details || {}),
    });
    return error;
  }
}

const originalPath = location.pathname;
history.pushState({}, "", "/analytics/not-a-vahan-report");
showUiDrift(() => VahanUiDrift.getUiContract("devtools"));
history.pushState({}, "", originalPath + location.search);
```

Kết quả: `UI_DRIFT_WRONG_PAGE`. Đây là test trực tiếp `guard.js`; cần khôi phục
path trước khi gọi `runOnTab`.

Để kiểm tra content script nhận đúng cờ production:

```js
(async () => {
  const [tab] = await chrome.tabs.query({
    url: "http://127.0.0.1:8765/analytics/vahanpublicreport*",
  });
  const result = await chrome.tabs.sendMessage(tab.id, {
    type: "RUN_SCHEDULED_UI_CHECK",
    requireOfficial: true,
  });
  console.log(result);
  return result;
})();
```

Kết quả là `{ ok: false, uiDrift: { code: "UI_DRIFT_WRONG_PAGE" } }` vì clone
không phải host chính thức. Lệnh này chỉ kiểm tra message receiver, không lưu
log; dùng `runOnTab` để kiểm tra đầy đủ persistence/backend.

### 7.2. Không có tab chính thức hoặc URL sai

Đóng tab chính thức, sau đó bấm **Kiểm tra ngay** trên Web UI hoặc gửi message
`RUN_UI_HEALTH_CHECK_NOW` từ extension. Kết quả cần là:

- `status=CHECK_ERROR`;
- `trigger=manual` hoặc `manual-web`;
- error nói không có tab VAHAN chính thức và hướng dẫn mở đúng URL;
- row vẫn được lưu vào lịch sử/CSV để Dev biết lần kiểm tra đã thất bại.

Mở một tab chính thức rồi điều hướng sang path khác, ví dụ
`/analytics/other-page`, và chạy lại. Kết quả production vẫn phải là
`CHECK_ERROR`; extension không được dùng tab sai path làm kết quả hợp lệ.

### 7.3. URL clone không hợp lệ

Trong Service Worker Console, không dùng `runOnTab` trên tab ngoài host/path
được cho phép:

```js
await vahanUiHealthDebug.runOnTab(0);
```

Kết quả là Promise reject với lỗi tabId không hợp lệ.

Với tab có URL không phải clone report, `runOnTab` phải trả/lưu
`CHECK_ERROR`, không được gửi message health-check vào trang tùy ý. Đây là
điểm kiểm tra chống chạy nhầm origin.

### 7.4. Content script không phản hồi

Để test transport an toàn, dùng tab `about:blank` hoặc một tab không có content
script rồi thử gọi `chrome.tabs.sendMessage` trực tiếp:

```js
try {
  await chrome.tabs.sendMessage(tabIdKhongCoContentScript, {
    type: "RUN_SCHEDULED_UI_CHECK",
    requireOfficial: true,
  });
} catch (error) {
  console.table({
    expected: "CHECK_ERROR / Receiving end does not exist",
    actual: error.message,
  });
}
```

Khi dùng flow thật, `requestUiHealthCheck` sẽ retry rồi trả `CHECK_ERROR` nếu
content script vẫn không phản hồi. Nếu baseline cũng rơi vào ca này, Reload
extension và reload trang clone để inject lại script.

### 7.5. Tab đổi URL trong lúc kiểm tra

Mở baseline, bắt đầu `runOnTab`, đồng thời điều hướng tab đó sang một path sai.
Nếu đổi đúng thời điểm giữa hai lần xác minh, kết quả phải là `CHECK_ERROR` và
log giữ lại URL thực tế. Không coi một trang đã đổi URL là `PASS`.

## 8. Test các lỗi flow RPA nâng cao

Các mã dưới đây thuộc lớp guard/adapter của flow điền filter, không phải tất cả
đều được health-check định kỳ phát ra. Có thể kiểm tra lỗi contract cơ bản bằng
`VahanUiDrift.getUiContract`; các lỗi đồng bộ option/axis cần chạy flow điền
filter trên clone. Không bấm Apply và không dùng CAPTCHA thật.

| Mã lỗi | Cách tạo ca test trên clone | Kỳ vọng |
| --- | --- | --- |
| `UI_DRIFT_OPTION_NOT_UNIQUE` | Tạo hai dòng widget có cùng label/value rồi chạy bước chọn option | Flow dừng, không chọn ngẫu nhiên |
| `UI_DRIFT_ALL_OPTION_NOT_FOUND` | Xóa hoặc duplicate checkbox All; có thể kiểm tra trực tiếp bằng HC-23 | Không thao tác multiselect |
| `UI_DRIFT_SEARCH_INPUT` | Xóa hoặc duplicate `input.multiselect-dropdown-search`; dùng HC-21/22 | Báo đúng multiselect và count |
| `UI_DRIFT_OPTION_CONTROL` | Xóa/duplicate checkbox của một option trong wrapper | Flow dừng trước khi click sai option |
| `UI_DRIFT_SELECTION_NOT_SYNCED` | Đổi `option.selected` nhưng không cập nhật checkbox widget, hoặc ngược lại | Báo select gốc và widget không đồng bộ |
| `UI_DRIFT_AXIS_NOT_SYNCED` | Đổi `#yAxis/#xAxis` nhưng không cập nhật `#yAxis_hidden/#xAxis_hidden` | Không submit với hidden value cũ |
| `UI_DRIFT_STALE_FLOW_STATE` | Xóa/đổi signature contract trong state flow cũ rồi resume flow | Flow cũ phải bị từ chối và yêu cầu chạy lại |
| `UI_DRIFT_CHANGED_DURING_RUN` | Lấy signature rồi đổi fingerprint control trước bước assert | Bắt được thay đổi giữa hai bước |
| `UI_DRIFT_DYNAMIC_CONTROL_TIMEOUT` | Giữ control động không xuất hiện đến hết timeout của guard | Dừng ở bước timeout, không retry vô hạn |

Test trực tiếp `UI_DRIFT_CHANGED_DURING_RUN` bằng page Console:

```js
const contractBefore = VahanUiDrift.getUiContract("devtools");
const fuelControl = document.querySelector("#vehicleFuel");
const originalName = fuelControl?.getAttribute("name");
fuelControl?.setAttribute("name", "devtools-drift-name");

showUiDrift(() => VahanUiDrift.assertUiContract(
  "devtools",
  contractBefore.signature,
  {},
  [],
  contractBefore,
));

if (fuelControl) fuelControl.setAttribute("name", originalName || "vehicleFuels");
```

Kết quả phải là `UI_DRIFT_CHANGED_DURING_RUN`, có `expectedSignature`,
`actualSignature` và `changedControls[]`.

`waitForUiContract` trong phiên bản hiện tại trả về lỗi cuối cùng nếu một control
bắt buộc bị thiếu kéo dài; vì vậy trường hợp mất control thường vẫn có mã cụ thể
`UI_DRIFT_REQUIRED_CONTROL`. `UI_DRIFT_DYNAMIC_CONTROL_TIMEOUT` là fallback của
guard và nên xác nhận thêm bằng test unit/integration khi thay đổi timeout.

### 8.1. Kiểm tra formatter cho các mã flow nâng cao

Lệnh này không giả lập thao tác và không ghi log; nó chỉ xác nhận UI/diagnostic
formatter có thể hiển thị đủ mã lỗi dành cho adapter tương lai:

```js
const formatterExamples = [
  ["UI_DRIFT_OPTION_NOT_UNIQUE", { label: "Fuel", target: "Diesel", count: 2 }],
  ["UI_DRIFT_OPTION_CONTROL", { label: "Fuel", option: "Diesel", checkboxCount: 0 }],
  ["UI_DRIFT_SELECTION_NOT_SYNCED", { label: "Fuel", option: "Diesel", selected: [] }],
  ["UI_DRIFT_AXIS_NOT_SYNCED", { expected: "Fuel", actual: "" }],
  ["UI_DRIFT_STALE_FLOW_STATE", {}],
  ["UI_DRIFT_DYNAMIC_CONTROL_TIMEOUT", {}],
];

console.table(formatterExamples.map(([code, details]) => {
  const error = new VahanUiDrift.UiDriftError(code, "DevTools synthetic case", "devtools", details);
  const report = VahanUiDrift.formatUiDrift(error);
  return { code: report.code, target: report.target, expected: report.expected, actual: report.actual };
}));
```

## 9. Test backend, queue và CSV

### 9.1. Backend tắt hoặc URL không hợp lệ

1. Dừng backend hoặc đổi `runnerConfig.serverUrl` sang
   `http://127.0.0.1:8999`.
2. Chạy một ca baseline/DRIFT bằng `runOnTab`.
3. Kiểm tra `result.backendLog` và `vahanUiHealthDebug.getState()`.

Kỳ vọng:

- health-check vẫn có status/diagnostic cục bộ;
- `backendLog.ok=false`, `queued=true`;
- `vahanUiHealthPendingLogs.length` tăng;
- không mất report khỏi state local.

### 9.2. Backend hoạt động trở lại và gửi bù

1. Khởi động lại backend tại `http://127.0.0.1:8000`.
2. Chạy health-check tiếp theo.
3. Kiểm tra pending queue giảm về 0 nếu mọi log gửi thành công.
4. Gọi API reports và xác nhận cả log cũ lẫn log mới có mặt trong CSV.

### 9.3. HTTP lỗi, ngày sai và file không tồn tại

Các lệnh chạy trong Console của Web UI hoặc Service Worker:

```js
// Ngày sai format: backend phải trả 422
await fetch("http://127.0.0.1:8000/api/ui-health/reports?date=17-09-2026")
  .then(async (response) => ({ status: response.status, body: await response.text() }));
```

```js
// File không tồn tại: backend phải trả 404
await fetch("http://127.0.0.1:8000/api/ui-health/reports/no-such-report.csv/download")
  .then(async (response) => ({ status: response.status, body: await response.text() }));
```

Khi endpoint `/api/ui-health/logs` trả 4xx/5xx hoặc timeout, extension xử lý
giống backend offline và xếp health-check vào queue. Sau khi backend trở lại,
kiểm tra không có duplicate ngoài số lần retry hợp lệ.

### 9.4. Đối chiếu schema CSV

CSV backend phải có một header duy nhất và các cột:

```text
log_id, schema_version, checked_at, check_date, status, failure_type, trigger,
started_at, duration_ms, page_url, page_path, contract_version, signature,
form_action, checked_controls, error_code, error_title, error, step, target,
selector, expected, actual, diagnostic_details, action
```

Kiểm tra tối thiểu:

- `PASS`: `failure_type=NONE`, `error_code/error_title/error` để trống;
- `UI_DRIFT`: có mã lỗi và diagnostic JSON phân tích được;
- `DATA_CHANGED`: `diagnostic_details.changes` có before/after count/digest;
- `CHECK_ERROR`: có `error`, `page_url`, `trigger`, kể cả khi chưa có contract;
- các row cùng ngày xuất hiện trong Web UI và file tải về;
- file name dạng `report-YYYY-MM-DD-to-YYYY-MM-DD.csv`, có thể thêm
  `-part-N` khi vượt 10 ngày hoặc 512 KiB.

## 10. Test lịch chạy và nút kiểm tra ngay

### 10.1. Khoảng ngày hợp lệ

Trên Web UI thử lần lượt `1`, `3`, `365` ngày. Kỳ vọng:

- backend trả schedule tương ứng;
- extension nhận event `ui-health:schedule-updated`;
- alarm `vahan-ui-health-check` có `periodInMinutes = ngày × 24 × 60`.

Trong Service Worker Console có thể xem:

```js
await chrome.alarms.get("vahan-ui-health-check");
```

Thử `0`, `366`, số thập phân hoặc chữ. Kỳ vọng UI/backend từ chối với lỗi
validation; không tạo alarm ngoài khoảng 1–365 ngày.

### 10.2. Không có runner

Tắt extension runner hoặc ngắt socket backend, sau đó bấm **Kiểm tra ngay**.
API `POST /api/ui-health/run-now` phải trả `409` với thông báo chưa có runner.
Ca này không được giả thành `PASS` và không được dùng clone local cho manual
production flow.

### 10.3. Runner có kết nối nhưng thiếu tab chính thức

Giữ backend/extension runner đang kết nối nhưng đóng tab chính thức. Bấm
**Kiểm tra ngay**. Kỳ vọng backend nhận request, extension tạo `CHECK_ERROR` và
Web UI nhận row lịch sử qua event `ui-health:log-received`.

## 11. Kiểm tra log trên Web UI

Với mỗi ca lỗi, chọn ngày chạy trong `http://127.0.0.1:5173/#configure`:

- **Lịch sử kiểm tra** hiển thị tối đa 5 row đầu;
- nếu còn row, nút **XEM THÊM** mở phần còn lại;
- **Xem diagnostic** phải hiển thị JSON/report chi tiết;
- `Kiểm tra ngay` chỉ tạo thêm row khi extension thực sự gửi health-check;
- nút tải CSV phải tải đúng file backend, không tạo file giả ở frontend.

Nếu UI không cập nhật ngay, kiểm tra WebSocket `/ui`, sau đó gọi lại API reports
để phân biệt lỗi render frontend với lỗi lưu backend.

## 12. Troubleshooting nhanh

| Hiện tượng | Kiểm tra |
| --- | --- |
| `vahanUiHealthDebug is not defined` | Mở đúng DevTools của service worker, Reload extension, build lại nếu cần |
| Baseline trả `CHECK_ERROR` | URL/path clone, manifest match, content script và tab đã reload |
| Clone bị báo không có tab chính thức | Đang gọi flow production; dùng `runOnTab(tab.id)` cho clone |
| `backendLog.queued=true` | Kiểm tra backend port 8000 và `runnerConfig.serverUrl`, sau đó chạy lại để flush |
| `DATA_CHANGED` lặp lại với xAxis | Chờ X-Axis sinh xong và chạy lại; so sánh count/digest trong diagnostic |
| Có log cũ báo URL clone/`CHECK_ERROR` | Lịch sử giữ nguyên để audit; chỉ các lượt mới phản ánh code hiện tại |
| Không thấy row trong Web UI | Kiểm tra ngày timezone, API `/reports`, WebSocket và log backend |
| Duplicate log sau retry | Dùng `log_id/checkId` để đối chiếu; không xóa CSV thủ công trước khi kiểm tra |

## 13. Khôi phục sau test

- Bấm **Khôi phục** trên fixture hoặc reload baseline.
- Đặt lại `runnerConfig.serverUrl` về `http://127.0.0.1:8000`.
- Không xóa queue/state trước khi đã kiểm tra ca offline/flush.
- Xóa các tab clone test nếu không còn dùng.
- Nếu đã tạo file CSV test, giữ lại trong thư mục runtime để đối chiếu hoặc
  xóa riêng đúng file test sau khi bàn giao theo chính sách lưu log của dự án.

## 14. Test tự động trước khi bàn giao

Extension:

```bash
cd /Users/mac/Desktop/vahan/vahan-rpa/vahan-chrome-extension
npm run check
npm run build
npm run test:ui-drift
```

Backend:

```bash
cd /Users/mac/Desktop/vahan/vahan-rpa/apps/api-server
PYTHONPATH=. ./.venv/bin/pytest -q
```

Web UI:

```bash
cd /Users/mac/Desktop/vahan/vahan-rpa/apps/web-ui
npm run check
npm run build
npm run smoke
```

Một ca DevTools chỉ được xem là đạt khi cả kết quả trên Console, row lịch sử,
diagnostic và CSV backend cùng chỉ về một `checkId`/`log_id` và cùng một nguyên
nhân lỗi.
