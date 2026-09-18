// interceptor-main.js: Injected into the page's MAIN execution world by Chrome.
// Monkey-patches HTMLAnchorElement.prototype.click to intercept SheetJS download links
// and bridge the blob data to content.js via CustomEvent, suppressing native browser download.
(function () {
  const originalClick = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () {
    if (this.hasAttribute("download")) {
      const href = this.getAttribute("href") || this.href;
      if (href && (href.startsWith("blob:") || href.includes(".xls") || href.includes("report"))) {
        window.dispatchEvent(
          new CustomEvent("__VAHAN_EXCEL_EXPORT__", {
            detail: { href, fileName: this.getAttribute("download") || "report.xlsx" },
          })
        );
        // Suppress browser download
        return;
      }
    }
    return originalClick.call(this);
  };
})();
