import { useEffect, useState } from "react";

import type { CaptchaChallenge } from "../contracts";

interface Props {
  challenge: CaptchaChallenge | null;
  submitting: boolean;
  refreshing: boolean;
  autoApply: boolean;
  onSubmit: (value: string) => Promise<void>;
  onRefresh: () => Promise<void>;
}

export function CaptchaPanel({ challenge, submitting, refreshing, autoApply, onSubmit, onRefresh }: Props) {
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
      <label>Mã CAPTCHA
        <input
          value={value}
          maxLength={6}
          autoComplete="off"
          disabled={submitting || refreshing}
          onChange={(event) => setValue(event.target.value)}
          placeholder="Nhập 6 ký tự"
        />
      </label>
      <button
        className="primary-button"
        disabled={submitting || refreshing || value.trim().length !== 6}
        onClick={async () => {
          await onSubmit(value.trim());
          setValue("");
        }}
      >
        {submitting ? "Đang chuẩn bị báo cáo..." : autoApply ? "Gửi mã → Điền bộ lọc → Apply" : "Gửi mã và điền bộ lọc"}
      </button>
      {!autoApply && <p className="security-note">Sau khi gửi, hãy kiểm tra và bấm Apply trên tab VAHAN.</p>}
      <p className="security-note">🔒 Hệ thống không đọc hoặc giải CAPTCHA tự động.</p>
    </section>
  );
}
