import type { ConnectionState } from "../contracts";

interface Props {
  backend: ConnectionState;
  runners: number;
}

export function ConnectionBanner({ backend, runners }: Props) {
  const text = {
    connecting: "Đang kết nối backend...",
    connected: runners > 0 ? `${runners} extension đang online` : "Backend đã kết nối · Chưa có extension online",
    disconnected: "Đã mất kết nối backend",
    error: "Không thể kết nối backend",
  }[backend];

  return (
    <div className="connection-banner" data-state={backend}>
      <span className="connection-dot" />
      <span>{text}</span>
    </div>
  );
}
