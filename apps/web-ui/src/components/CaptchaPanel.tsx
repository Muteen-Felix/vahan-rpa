import { useEffect, useState } from "react";

import type { CaptchaChallenge } from "../contracts";

interface Props {
  challenge: CaptchaChallenge | null;
  submitting: boolean;
  autoApply: boolean;
  onSubmit: (value: string) => Promise<void>;
}

export function CaptchaPanel({ challenge, submitting, autoApply, onSubmit }: Props) {
  const [value, setValue] = useState("");
  useEffect(() => setValue(""), [challenge?.captchaId]);
  if (!challenge) return null;

  return (
    <section className="panel captcha-panel">
      <div className="panel-heading">
        <span className="step-number">3</span>
        <div><h2>Nhập CAPTCHA</h2><p>Đọc ảnh và nhập thủ công 6 ký tự.</p></div>
      </div>
      {challenge.invalid && <p className="error-message">CAPTCHA không đúng. Vui lòng nhập ảnh mới.</p>}
      {challenge.refreshed && <p className="captcha-refresh-message">CAPTCHA đã thay đổi. Vui lòng nhập lại theo ảnh mới.</p>}
      <img className="captcha-image" src={challenge.imageDataUrl} alt="VAHAN CAPTCHA" />
      <label>Mã CAPTCHA
        <input
          value={value}
          maxLength={6}
          autoComplete="off"
          onChange={(event) => setValue(event.target.value)}
          placeholder="Nhập 6 ký tự"
        />
      </label>
      <button
        className="primary-button"
        disabled={submitting || value.trim().length !== 6}
        onClick={async () => {
          await onSubmit(value.trim());
          setValue("");
        }}
      >
        {submitting ? "Đang gửi..." : autoApply ? "Gửi và Apply" : "Gửi và điền CAPTCHA"}
      </button>
      {!autoApply && <p className="security-note">Sau khi gửi, hãy kiểm tra và bấm Apply trên tab VAHAN.</p>}
      <p className="security-note">🔒 Hệ thống không đọc hoặc giải CAPTCHA tự động.</p>
    </section>
  );
}
