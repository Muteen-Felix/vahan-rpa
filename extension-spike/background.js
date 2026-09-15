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

  pendingDownloads.set(tabId, { tabId, timer });
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action !== "EXPECT_DOWNLOAD" || sender.tab?.id == null) return;

  armDownload(sender.tab.id);
  sendResponse({ armed: true });
});

chrome.downloads.onCreated.addListener((downloadItem) => {
  const directMatch = pendingDownloads.get(downloadItem.tabId);
  // Some browser download events (notably local/extension-triggered fixture
  // downloads) omit tabId. Only fall back when exactly one tab is pending;
  // multiple pending tabs remain fail-closed to avoid confirming the wrong file.
  const missingTabId = downloadItem.tabId == null || downloadItem.tabId === -1;
  const pending = directMatch || (
    missingTabId && pendingDownloads.size === 1
      ? pendingDownloads.values().next().value
      : null
  );
  if (!pending) return;

  clearTimeout(pending.timer);
  pendingDownloads.delete(pending.tabId);

  chrome.tabs.sendMessage(pending.tabId, {
    action: "DOWNLOAD_CONFIRMED",
    downloadId: downloadItem.id,
    filename: downloadItem.filename || downloadItem.url,
  });
});
