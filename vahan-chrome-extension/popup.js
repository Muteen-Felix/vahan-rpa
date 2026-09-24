const runnerConnection = document.querySelector("#runnerConnection");
const connectionDetail = document.querySelector("#connectionDetail");
const runnerServerUrl = document.querySelector("#runnerServerUrl");
const runnerName = document.querySelector("#runnerName");
const runnerToken = document.querySelector("#runnerToken");
const saveRunnerConfigButton = document.querySelector("#saveRunnerConfig");
const workflowBadge = document.querySelector("#workflowBadge");
const workflowTitle = document.querySelector("#workflowTitle");
const workflowDetail = document.querySelector("#workflowDetail");
const workflowJobId = document.querySelector("#workflowJobId");
const authGuard = document.querySelector("#authGuard");
const authGuardMessage = document.querySelector("#authGuardMessage");
const clearAuthHoldButton = document.querySelector("#clearAuthHold");
const reloadVahanTabButton = document.querySelector("#reloadVahanTab");
const status = document.querySelector("#status");

const connectionLabels = {
  connected: "Backend đã kết nối",
  connecting: "Đang kết nối backend...",
  disconnected: "Backend đã ngắt kết nối",
  error: "Không thể kết nối backend",
};

const workflowStates = {
  CAPTURING_CAPTCHA: ["Đang lấy CAPTCHA", "running", "Extension đang lấy ảnh CAPTCHA từ VAHAN."],
  WAITING_CAPTCHA: ["Chờ người dùng nhập CAPTCHA", "waiting", "Nhập CAPTCHA tại Web UI để tiếp tục."],
  SUBMITTING: ["Đang gửi CAPTCHA", "running", "Đang điền bộ lọc và gửi CAPTCHA lên VAHAN."],
  WAITING_RESULT: ["Đang chờ kết quả VAHAN", "running", "VAHAN đang tạo kết quả báo cáo."],
  DOWNLOADING_REPORT: ["Đang tải Excel", "running", "Chrome đang tải file Excel gốc từ VAHAN."],
  UPLOADING_REPORT: ["Đang lưu báo cáo", "running", "Đang đồng bộ file Excel vào Báo cáo đã xuất."],
};

function renderRunnerConnection(connection = {}) {
  const connectionState = connection.status || "disconnected";
  runnerConnection.dataset.state = connectionState;
  runnerConnection.querySelector(".connection-text").textContent =
    connectionLabels[connectionState] || connectionLabels.disconnected;
  connectionDetail.textContent = connection.detail || "Chưa có thông tin kết nối gần nhất.";
}

function renderWorkflow(job) {
  if (!job?.jobId) {
    workflowBadge.dataset.state = "idle";
    workflowBadge.textContent = "Sẵn sàng";
    workflowTitle.textContent = "Chưa có job đang chạy";
    workflowDetail.textContent = "Tạo báo cáo từ Web UI để extension nhận và xử lý.";
    workflowJobId.hidden = true;
    return;
  }

  const [title, state, detail] = workflowStates[job.stage] || ["Đang xử lý", "running", "Extension đang thực hiện yêu cầu từ backend."];
  workflowBadge.dataset.state = state;
  workflowBadge.textContent = state === "waiting" ? "Cần thao tác" : "Đang xử lý";
  workflowTitle.textContent = job.scenarioName || title;
  workflowDetail.textContent = `${title}. ${detail}`;
  workflowJobId.hidden = false;
  workflowJobId.textContent = `Job ${job.jobId}`;
}

function renderAuthHold(hold) {
  const active = Boolean(hold?.code === "VAHAN_AUTH_REQUIRED");
  authGuard.hidden = !active;
  if (!active) {
    authGuardMessage.textContent = "";
    return;
  }
  const retryAfter = hold.retryAfter ? new Date(hold.retryAfter).toLocaleString() : "sau khi xác nhận";
  authGuardMessage.textContent = `VAHAN trả HTTP 401. Extension đã tạm dừng để tránh thử lại liên tục; hãy đóng hộp thoại và chờ đến ${retryAfter}.`;
}

function setStatus(message = "", kind = "") {
  status.className = `form-status ${kind}`.trim();
  status.textContent = message;
}

async function loadRunnerConfig() {
  const { runnerConfig = {} } = await chrome.storage.local.get("runnerConfig");
  runnerServerUrl.value = runnerConfig.serverUrl || "http://127.0.0.1:8000";
  runnerName.value = runnerConfig.runnerName || "VAHAN Chrome";
  runnerToken.value = runnerConfig.token || "change-me";
}

async function loadPopupState() {
  const { runnerConnection, activeServerJob, vahanAuthHold } = await chrome.storage.local.get([
    "runnerConnection", "activeServerJob", "vahanAuthHold",
  ]);
  renderRunnerConnection(runnerConnection);
  renderWorkflow(activeServerJob);
  renderAuthHold(vahanAuthHold);
}

saveRunnerConfigButton.addEventListener("click", async () => {
  const serverUrl = runnerServerUrl.value.trim().replace(/\/$/, "");
  if (!/^https?:\/\//i.test(serverUrl)) {
    setStatus("Server URL phải bắt đầu bằng http:// hoặc https://", "error");
    return;
  }

  saveRunnerConfigButton.disabled = true;
  try {
    const { runnerConfig = {} } = await chrome.storage.local.get("runnerConfig");
    await chrome.storage.local.set({
      runnerConfig: {
        ...runnerConfig,
        serverUrl,
        runnerName: runnerName.value.trim() || "VAHAN Chrome",
        token: runnerToken.value,
      },
    });
    renderRunnerConnection({ status: "connecting", detail: "Đang kết nối lại backend..." });
    setStatus("Đã lưu cấu hình. Extension đang kết nối lại.", "success");
  } catch (error) {
    setStatus(error.message || "Không thể lưu cấu hình backend.", "error");
  } finally {
    saveRunnerConfigButton.disabled = false;
  }
});

clearAuthHoldButton.addEventListener("click", async () => {
  clearAuthHoldButton.disabled = true;
  try {
    const response = await chrome.runtime.sendMessage({ type: "CLEAR_VAHAN_AUTH_HOLD" });
    if (!response?.ok) throw new Error(response?.error || "Không thể xóa trạng thái tạm dừng.");
    renderAuthHold(null);
    setStatus("Đã bỏ tạm dừng. Hãy tải lại tab VAHAN trước khi chạy job mới.", "success");
  } catch (error) {
    setStatus(error.message || "Không thể xóa trạng thái tạm dừng.", "error");
  } finally {
    clearAuthHoldButton.disabled = false;
  }
});

reloadVahanTabButton?.addEventListener("click", async () => {
  reloadVahanTabButton.disabled = true;
  try {
    const response = await chrome.runtime.sendMessage({ type: "RELOAD_VAHAN_PAGE" });
    if (!response?.ok) throw new Error(response?.error || "Không thể tải lại trang VAHAN.");
    renderAuthHold(null);
    setStatus("Đang tải lại trang VAHAN...", "success");
  } catch (error) {
    setStatus(error.message || "Không thể tải lại trang VAHAN.", "error");
  } finally {
    reloadVahanTabButton.disabled = false;
  }
});

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === "RUNNER_CONNECTION_CHANGED") renderRunnerConnection(message.connection);
  if (message?.type === "VAHAN_AUTH_REQUIRED") renderAuthHold(message.authHold);
  if (message?.type === "VAHAN_AUTH_CLEARED") renderAuthHold(null);
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "local") return;
  if (changes.runnerConnection) renderRunnerConnection(changes.runnerConnection.newValue);
  if (changes.activeServerJob) renderWorkflow(changes.activeServerJob.newValue);
  if (changes.vahanAuthHold) renderAuthHold(changes.vahanAuthHold.newValue);
});

document.addEventListener("DOMContentLoaded", async () => {
  await loadRunnerConfig();
  await loadPopupState();
});
