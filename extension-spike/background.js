// VAHAN RPA Assistant - download confirmation service worker
//
// Content scripts cannot reliably observe the browser download lifecycle.
// Keep the confirmation in the extension context and send only metadata back
// to the originating tab.  No file contents or CAPTCHA values are collected.

const pendingDownloads = new Map();
const DOWNLOAD_ARM_TIMEOUT_MS = 30_000;

function armDownload(tabId) {
  const existing = pendingDownloads.get(tabId);
  if (existing?.timer) clearTimeout(existing.timer);

  const timer = setTimeout(() => {
    pendingDownloads.delete(tabId);
  }, DOWNLOAD_ARM_TIMEOUT_MS);

  pendingDownloads.set(tabId, { timer });
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action !== "EXPECT_DOWNLOAD" || sender.tab?.id == null) return;

  armDownload(sender.tab.id);
  sendResponse({ armed: true });
});

chrome.downloads.onCreated.addListener((downloadItem) => {
  const pending = pendingDownloads.get(downloadItem.tabId);
  if (!pending) return;

  clearTimeout(pending.timer);
  pendingDownloads.delete(downloadItem.tabId);

  chrome.tabs.sendMessage(downloadItem.tabId, {
    action: "DOWNLOAD_CONFIRMED",
    downloadId: downloadItem.id,
    filename: downloadItem.filename || downloadItem.url,
  });
});
