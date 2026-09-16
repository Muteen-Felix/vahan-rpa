from __future__ import annotations

from datetime import datetime, timezone
from enum import StrEnum
from uuid import UUID, uuid4

from pydantic import BaseModel, ConfigDict, Field

from app.models.filters import VahanFilters


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class JobStatus(StrEnum):
    QUEUED = "QUEUED"
    ASSIGNED = "ASSIGNED"
    OPENING_VAHAN = "OPENING_VAHAN"
    FILLING_FILTERS = "FILLING_FILTERS"
    WAITING_CAPTCHA = "WAITING_CAPTCHA"
    SUBMITTING = "SUBMITTING"
    WAITING_RESULT = "WAITING_RESULT"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    CANCELLED = "CANCELLED"


class CreateJobRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    runner_id: str = Field(alias="runnerId", min_length=1, max_length=128)
    filters: VahanFilters


class Job(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: UUID = Field(default_factory=uuid4)
    runner_id: str = Field(alias="runnerId")
    status: JobStatus = JobStatus.QUEUED
    filters: VahanFilters
    captcha_id: str | None = Field(default=None, alias="captchaId")
    error: str | None = None
    created_at: datetime = Field(default_factory=utc_now, alias="createdAt")
    updated_at: datetime = Field(default_factory=utc_now, alias="updatedAt")

    def touch(self) -> None:
        self.updated_at = utc_now()
