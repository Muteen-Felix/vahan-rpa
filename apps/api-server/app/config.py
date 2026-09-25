from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


DEFAULT_UI_HEALTH_LOG_DIR = Path(__file__).resolve().parents[1] / "runtime" / "ui-health-logs"
DEFAULT_EXCEL_REPORT_DIR = Path(__file__).resolve().parents[1] / "runtime" / "excel-reports"
DEFAULT_CAPTCHA_IMAGE_DIR = Path(__file__).resolve().parents[1] / "runtime" / "images1"
DEFAULT_CAPTCHA_IMAGE_PATH_TEMPLATE = "ảnh1"
DEFAULT_WEB_CORS_ORIGINS = (
    "http://localhost:5173",
    "http://127.0.0.1:5173",
)
# manifest.json now pins a fixed "key", so the unpacked extension ID is the
# same on every machine regardless of the clone path. Other installations can
# still override it with VAHAN_API_EXTENSION_IDS without changing the web
# origins (e.g. if someone loads a fork with a different key).
DEFAULT_EXTENSION_IDS = (
    "lnlmikbapplimecdenhhadbhmbenddpd",
    "ooplajjjjphdcaolokpaenmkjlbcmlhk",
)


def _as_bool(value: str | None, default: bool = False) -> bool:
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


@dataclass(frozen=True, slots=True)
class Settings:
    app_name: str = "VAHAN RPA API"
    host: str = "127.0.0.1"
    port: int = 8000
    debug: bool = False
    cors_origins: tuple[str, ...] = (
        *DEFAULT_WEB_CORS_ORIGINS,
        *(f"chrome-extension://{extension_id}" for extension_id in DEFAULT_EXTENSION_IDS),
    )
    socketio_cors_origins: str | tuple[str, ...] = "*"
    runner_token: str = "change-me"
    runner_disconnect_grace_seconds: float = 30.0
    ui_health_log_dir: str = str(DEFAULT_UI_HEALTH_LOG_DIR)
    excel_report_dir: str = str(DEFAULT_EXCEL_REPORT_DIR)
    captcha_image_dir: str = str(DEFAULT_CAPTCHA_IMAGE_DIR)
    captcha_image_path_template: str = DEFAULT_CAPTCHA_IMAGE_PATH_TEMPLATE
    max_excel_upload_bytes: int = 50 * 1024 * 1024  # 50 MB

    @classmethod
    def from_env(cls) -> "Settings":
        web_origins = tuple(
            origin.strip()
            for origin in os.getenv(
                "VAHAN_API_CORS_ORIGINS",
                ",".join(DEFAULT_WEB_CORS_ORIGINS),
            ).split(",")
            if origin.strip()
        )
        extension_ids = tuple(
            extension_id.strip()
            for extension_id in os.getenv(
                "VAHAN_API_EXTENSION_IDS",
                ",".join(DEFAULT_EXTENSION_IDS),
            ).split(",")
            if extension_id.strip()
        )
        origins = tuple(dict.fromkeys(
            (*web_origins, *(f"chrome-extension://{extension_id}" for extension_id in extension_ids))
        ))
        socketio_origins_value = os.getenv("VAHAN_API_SOCKETIO_CORS_ORIGINS", "*").strip()
        socketio_origins: str | tuple[str, ...] = (
            "*"
            if socketio_origins_value == "*"
            else tuple(
                origin.strip()
                for origin in socketio_origins_value.split(",")
                if origin.strip()
            )
        )
        return cls(
            host=os.getenv("VAHAN_API_HOST", "127.0.0.1"),
            port=int(os.getenv("VAHAN_API_PORT", "8000")),
            debug=_as_bool(os.getenv("VAHAN_API_DEBUG")),
            cors_origins=origins,
            socketio_cors_origins=socketio_origins,
            runner_token=os.getenv("VAHAN_API_RUNNER_TOKEN", "change-me"),
            runner_disconnect_grace_seconds=float(os.getenv("VAHAN_API_RUNNER_DISCONNECT_GRACE_SECONDS", "30")),
            ui_health_log_dir=os.getenv("VAHAN_UI_HEALTH_LOG_DIR", str(DEFAULT_UI_HEALTH_LOG_DIR)),
            excel_report_dir=os.getenv("VAHAN_EXCEL_REPORT_DIR", str(DEFAULT_EXCEL_REPORT_DIR)),
            captcha_image_dir=os.getenv("VAHAN_CAPTCHA_IMAGE_DIR", str(DEFAULT_CAPTCHA_IMAGE_DIR)),
            captcha_image_path_template=os.getenv(
                "VAHAN_CAPTCHA_IMAGE_PATH_TEMPLATE",
                DEFAULT_CAPTCHA_IMAGE_PATH_TEMPLATE,
            ),
        )


settings = Settings.from_env()
