import { useEffect, useState, type FormEvent, type ReactNode } from "react";

import {
  ACCESS_TOKEN_STORAGE_KEY,
  api,
  AUTH_LOGOUT_EVENT,
  AUTH_REQUIRED_EVENT,
  clearAccessToken,
  getAccessToken,
} from "../services/api-client";

type GateState = "checking" | "setup" | "login" | "unavailable" | "authenticated";

export function AuthGate({ children }: { children: ReactNode }) {
  const [gate, setGate] = useState<GateState>("checking");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    const expireSession = () => {
      clearAccessToken();
      setPassword("");
      setGate("login");
      setError("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
    };
    const signOut = () => {
      setPassword("");
      setError("Bạn đã đăng xuất.");
      setGate("login");
    };
    window.addEventListener(AUTH_REQUIRED_EVENT, expireSession);
    window.addEventListener(AUTH_LOGOUT_EVENT, signOut);

    async function restoreSession() {
      try {
        const status = await api.authStatus();
        if (!active) return;
        if (!status.configured) {
          setGate("setup");
          return;
        }
        if (!getAccessToken()) {
          setGate("login");
          return;
        }
        try {
          await api.currentUser();
          if (active) setGate("authenticated");
        } catch {
          clearAccessToken();
          if (active) setGate("login");
        }
      } catch (reason) {
        if (!active) return;
        setError(reason instanceof Error ? reason.message : "Không kết nối được API.");
        setGate("unavailable");
      }
    }

    void restoreSession();
    return () => {
      active = false;
      window.removeEventListener(AUTH_REQUIRED_EVENT, expireSession);
      window.removeEventListener(AUTH_LOGOUT_EVENT, signOut);
    };
  }, []);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const result = await api.login(username.trim(), password);
      window.sessionStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, result.accessToken);
      setPassword("");
      setGate("authenticated");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Đăng nhập thất bại.");
    } finally {
      setSubmitting(false);
    }
  }

  if (gate === "authenticated") return children;

  if (gate === "checking") {
    return <main className="auth-shell"><p>Đang kiểm tra phiên đăng nhập…</p></main>;
  }

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <a className="brand auth-brand" href="#top" aria-label="VAHAN">
          <span className="brand-mark">V</span>
          <span className="brand-copy"><strong>VAHAN</strong><small>REPORT AUTOMATION</small></span>
        </a>

        {gate === "setup" ? (
          <>
            <p className="eyebrow dark">BẢO VỆ BẢNG ĐIỀU KHIỂN</p>
            <h1>Chưa cấu hình đăng nhập</h1>
            <p className="auth-description">
              Cấu hình username, mật khẩu tối thiểu 12 ký tự và token secret ngẫu nhiên tối thiểu 32 ký tự
              trên terminal chạy API, rồi khởi động lại backend.
            </p>
            <pre className="auth-setup-code">{`export VAHAN_UI_AUTH_USERNAME="admin"
export VAHAN_UI_AUTH_PASSWORD="mat-khau-it-nhat-12-ky-tu"
export VAHAN_UI_AUTH_TOKEN_SECRET="$(python -c 'import secrets; print(secrets.token_hex(32))')"
python -m uvicorn app.main:application --host 127.0.0.1 --port 8000 --reload`}</pre>
            <p className="auth-footnote">
              Giữ mật khẩu và token secret ở phía máy chủ. Token đăng nhập có hiệu lực 1 giờ.
            </p>
          </>
        ) : gate === "unavailable" ? (
          <>
            <p className="eyebrow dark">KẾT NỐI API</p>
            <h1>Chưa kết nối được</h1>
            <p className="auth-description">{error || "Không thể kiểm tra cấu hình đăng nhập."}</p>
            <button className="primary-button" type="button" onClick={() => window.location.reload()}>
              Thử lại
            </button>
          </>
        ) : (
          <>
            <p className="eyebrow dark">ĐĂNG NHẬP QUẢN TRỊ</p>
            <h1>Chào mừng trở lại</h1>
            <p className="auth-description">Đăng nhập để mở bảng điều khiển VAHAN RPA.</p>
            <form className="auth-form" onSubmit={handleLogin}>
              <label>
                Tên đăng nhập
                <input
                  autoComplete="username"
                  autoFocus
                  maxLength={128}
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  required
                />
              </label>
              <label>
                Mật khẩu
                <input
                  type="password"
                  autoComplete="current-password"
                  maxLength={1024}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />
              </label>
              {error && <p className="auth-error" role="alert">{error}</p>}
              <button className="primary-button" type="submit" disabled={submitting}>
                {submitting ? "Đang xác thực…" : "Đăng nhập"}
              </button>
            </form>
            <p className="auth-footnote">Kết nối bảo vệ bằng access token có thời hạn.</p>
          </>
        )}
      </section>
    </main>
  );
}
