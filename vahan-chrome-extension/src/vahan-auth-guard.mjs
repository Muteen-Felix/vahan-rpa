export const VAHAN_AUTH_HOLD_KEY = "vahanAuthHold";
export const VAHAN_AUTH_REQUIRED_CODE = "VAHAN_AUTH_REQUIRED";
export const VAHAN_AUTH_HOLD_MS = 15 * 60 * 1000;
export const VAHAN_AUTH_GUARD_VERSION = 2;

const VAHAN_HOST = "analytics.parivahan.gov.in";

export function isVahanRequestUrl(value) {
  try {
    const url = new URL(String(value || ""));
    return url.protocol === "https:" && url.hostname === VAHAN_HOST;
  } catch {
    return false;
  }
}

// A protected image, stylesheet or API request must not lock the whole
// extension when the report page itself is still usable. Only a top-level
// VAHAN document challenge is a real authentication stop for the runner.
export function isVahanMainFrameAuthChallenge(details = {}) {
  return details.isProxy !== true
    && details.type === "main_frame"
    && isVahanRequestUrl(details.url);
}

function safeUrl(value) {
  try {
    const url = new URL(String(value || ""));
    return `${url.origin}${url.pathname}`;
  } catch {
    return `https://${VAHAN_HOST}/`;
  }
}

function timestamp(value) {
  return new Date(value).toISOString();
}

export function createVahanAuthHold(details = {}, previous = null, now = Date.now()) {
  const tabId = Number.isInteger(details.tabId) && details.tabId >= 0 ? details.tabId : null;
  const sameChallenge = previous
    && previous.tabId === tabId
    && previous.code === VAHAN_AUTH_REQUIRED_CODE
    && Date.parse(previous.lastDetectedAt || "") > now - VAHAN_AUTH_HOLD_MS;

  return {
    guardVersion: VAHAN_AUTH_GUARD_VERSION,
    code: VAHAN_AUTH_REQUIRED_CODE,
    status: "AUTH_REQUIRED",
    host: VAHAN_HOST,
    resourceType: String(details.type || "unknown"),
    tabId,
    url: safeUrl(details.url),
    scheme: String(details.scheme || "Basic"),
    realm: String(details.realm || "").slice(0, 120),
    statusCode: Number(details.statusCode) || 401,
    occurrences: sameChallenge ? Number(previous.occurrences || 0) + 1 : 1,
    firstDetectedAt: sameChallenge ? previous.firstDetectedAt : timestamp(now),
    lastDetectedAt: timestamp(now),
    retryAfter: timestamp(now + VAHAN_AUTH_HOLD_MS),
  };
}

export function isVahanAuthHoldActive(hold, now = Date.now(), tabId) {
  if (!hold || hold.guardVersion !== VAHAN_AUTH_GUARD_VERSION || hold.code !== VAHAN_AUTH_REQUIRED_CODE) return false;
  if (tabId !== undefined && hold.tabId !== null && hold.tabId !== tabId) return false;
  const retryAfter = Date.parse(hold.retryAfter || "");
  return Number.isFinite(retryAfter) && retryAfter > now;
}

export function vahanAuthHoldMessage(hold = {}) {
  const retryAfter = hold.retryAfter ? new Date(hold.retryAfter).toLocaleString() : "sau khi xác nhận";
  return `VAHAN đang yêu cầu xác thực HTTP (${hold.statusCode || 401}). `
    + `Extension đã tạm dừng để không thử lại liên tục. Hãy đóng hộp thoại đăng nhập, `
    + `chờ đến ${retryAfter}, kiểm tra truy cập trang chính thức rồi mới chạy lại.`;
}
