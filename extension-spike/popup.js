// VAHAN RPA - Popup Script

const btnStart = document.getElementById("btnStart");
const statusMsg = document.getElementById("statusMsg");

btnStart.addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    statusMsg.textContent = "Không tìm thấy tab hiện tại!";
    return;
  }

  btnStart.disabled = true;
  btnStart.textContent = "Đang bắt đầu...";

  try {
    // Gui tin nhan toi content script
    chrome.tabs.sendMessage(tab.id, { action: "START_FLOW" }, (response) => {
      if (chrome.runtime.lastError) {
        // Neu content script chua chay (do trang chua F5), inject script ngay
        chrome.scripting.executeScript(
          {
            target: { tabId: tab.id },
            files: ["content.js"],
          },
          () => {
            chrome.tabs.sendMessage(tab.id, { action: "START_FLOW" });
            window.close(); // Dong popup de nguoi dung theo doi tren web
          }
        );
      } else {
        window.close(); // Dong popup de nguoi dung xem widget truc tiep tren web
      }
    });
  } catch (err) {
    statusMsg.textContent = `Lỗi: ${err.message}`;
    btnStart.disabled = false;
    btnStart.textContent = "▶ Bắt Đầu Chạy Tự Động";
  }
});
