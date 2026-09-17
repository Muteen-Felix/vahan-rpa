import asyncio
from uuid import UUID

from app.models.job import Job, JobStatus


class InMemoryJobRepository:
    def __init__(self) -> None:
        self._jobs: dict[UUID, Job] = {}
        self._lock = asyncio.Lock()

    async def create(self, job: Job) -> Job:
        async with self._lock:
            self._jobs[job.id] = job
            return job.model_copy(deep=True)

    async def get(self, job_id: UUID) -> Job | None:
        async with self._lock:
            job = self._jobs.get(job_id)
            return job.model_copy(deep=True) if job else None

    async def update_status(
        self,
        job_id: UUID,
        status: JobStatus,
        *,
        error: str | None = None,
        captcha_id: str | None = None,
        captcha_image_data_url: str | None = None,
    ) -> Job | None:
        async with self._lock:
            job = self._jobs.get(job_id)
            if not job:
                return None
            job.status = status
            job.error = error
            if captcha_id is not None:
                job.captcha_id = captcha_id
            if captcha_image_data_url is not None:
                job.captcha_image_data_url = captcha_image_data_url
            job.touch()
            return job.model_copy(deep=True)

    async def clear(self) -> None:
        async with self._lock:
            self._jobs.clear()
