import { useEffect, useState } from "react";

import type { CaptchaChallenge } from "../contracts";

interface Props {
  challenge: CaptchaChallenge | null;
  submitting: boolean;
  refreshing: boolean;
  onSubmit: (value: string) => Promise<void>;
  onRefresh: () => Promise<void>;
}

export function CaptchaPanel({ challenge, submitting, refreshing, onSubmit, onRefresh }: Props) {
  const [value, setValue] = useState("");
  useEffect(() => setValue(""), [challenge?.captchaId]);
  if (!challenge) return null;

  return (
    <section className="panel captcha-panel">
      <div className="panel-heading">
        <span className="step-number">3</span>
        <div><h2>Nhập CAPTCHA</h2><p>CAPTCHA được lấy trước; sau khi gửi mã, hệ thống mới điền bộ lọc VAHAN.</p></div>
      </div>
      {challenge.invalid && <p className="error-message">CAPTCHA không đúng. Ảnh mới đã được tải từ VAHAN — vui lòng nhập lại.</p>}
      {challenge.refreshed && <p className="captcha-refresh-message">CAPTCHA đã thay đổi. Vui lòng nhập lại theo ảnh mới.</p>}
      <img className="captcha-image" src={challenge.imageDataUrl} alt="VAHAN CAPTCHA" />
      <button
        className="secondary-button captcha-refresh-button"
        disabled={submitting || refreshing}
        onClick={onRefresh}
      >
        {refreshing ? "ĐANG TẢI CAPTCHA MỚI..." : "↻ TẢI CAPTCHA MỚI"}
      </button>
      <p className="security-note">Nhập CAPTCHA thủ công trên VAHAN. Khi có từ 6 ký tự, extension sẽ tự bấm Apply.</p>
    </section>
  );
}
