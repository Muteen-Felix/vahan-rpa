from __future__ import annotations

import os
from dataclasses import dataclass


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
    cors_origins: tuple[str, ...] = ("http://localhost:5173",)
    runner_token: str = "change-me"

    @classmethod
    def from_env(cls) -> "Settings":
        origins = tuple(
            origin.strip()
            for origin in os.getenv(
                "VAHAN_API_CORS_ORIGINS",
                "http://localhost:5173",
            ).split(",")
            if origin.strip()
        )
        return cls(
            host=os.getenv("VAHAN_API_HOST", "127.0.0.1"),
            port=int(os.getenv("VAHAN_API_PORT", "8000")),
            debug=_as_bool(os.getenv("VAHAN_API_DEBUG")),
            cors_origins=origins,
            runner_token=os.getenv("VAHAN_API_RUNNER_TOKEN", "change-me"),
        )


settings = Settings.from_env()
