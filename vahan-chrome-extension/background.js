chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "OPEN_ACTION_POPUP") return;

  if (typeof chrome.action.openPopup !== "function") {
    sendResponse({ ok: false, error: "Tính năng này cần Google Chrome 127 trở lên." });
    return;
  }

  chrome.action.openPopup()
    .then(() => sendResponse({ ok: true }))
    .catch((error) => sendResponse({ ok: false, error: error.message }));
  return true;
});
