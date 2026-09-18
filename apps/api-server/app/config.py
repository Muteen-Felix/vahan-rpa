from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


DEFAULT_UI_HEALTH_LOG_DIR = Path(__file__).resolve().parents[1] / "runtime" / "ui-health-logs"
DEFAULT_EXCEL_REPORT_DIR = Path(__file__).resolve().parents[1] / "runtime" / "excel-reports"


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
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    )
    socketio_cors_origins: str | tuple[str, ...] = "*"
    runner_token: str = "change-me"
    runner_disconnect_grace_seconds: float = 30.0
    ui_health_log_dir: str = str(DEFAULT_UI_HEALTH_LOG_DIR)
    excel_report_dir: str = str(DEFAULT_EXCEL_REPORT_DIR)
    max_excel_upload_bytes: int = 50 * 1024 * 1024  # 50 MB

    @classmethod
    def from_env(cls) -> "Settings":
        origins = tuple(
            origin.strip()
            for origin in os.getenv(
                "VAHAN_API_CORS_ORIGINS",
                "http://localhost:5173,http://127.0.0.1:5173",
            ).split(",")
            if origin.strip()
        )
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
        )


settings = Settings.from_env()
