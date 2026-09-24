from __future__ import annotations

import asyncio
from uuid import UUID

from app.config import settings
from app.models.job import JobStatus, can_transition
from app.realtime.server import sio
from app.services import services


_disconnect_tasks: dict[str, asyncio.Task] = {}


async def _expire_disconnected_runner(runner_id: str, socket_id: str) -> None:
    try:
        await asyncio.sleep(settings.runner_disconnect_grace_seconds)
        runner = await services.runners.remove_by_socket(socket_id)
        if not runner:
            return
        if runner.current_job_id:
            job = await services.jobs.get(UUID(runner.current_job_id))
            if job and can_transition(job.status, JobStatus.FAILED):
                job = await services.jobs.update_status(job.id, JobStatus.FAILED, error="Runner disconnected.")
                await sio.emit("job:status", job.model_dump(mode="json", by_alias=True), room=f"job:{job.id}", namespace="/ui")
        await sio.emit("runner:offline", {"runnerId": runner.id}, namespace="/ui")
    finally:
        _disconnect_tasks.pop(runner_id, None)


def _registration(auth: dict | None) -> tuple[str, str, str | None] | None:
    auth = auth or {}
    runner_id = str(auth.get("runnerId", "")).strip()
    runner_name = str(auth.get("runnerName", runner_id)).strip()
    token = str(auth.get("token", ""))
    version = str(auth["version"]) if auth.get("version") else None
    if not runner_id or not runner_name or token != settings.runner_token:
        return None
    return runner_id, runner_name, version


@sio.event(namespace="/runner")
async def connect(sid: str, _environ: dict, auth: dict | None) -> bool:
    registration = _registration(auth)
    if not registration:
        return False
    runner_id, name, version = registration
    pending_disconnect = _disconnect_tasks.pop(runner_id, None)
    if pending_disconnect:
        pending_disconnect.cancel()
    runner = await services.runners.register(
        runner_id=runner_id,
        name=name,
        socket_id=sid,
        version=version,
    )
    await sio.enter_room(sid, f"runner:{runner_id}", namespace="/runner")
    await sio.emit(
        "runner:online",
        runner.model_dump(mode="json", by_alias=True),
        namespace="/ui",
    )
    return True


@sio.event(namespace="/runner")
async def disconnect(sid: str) -> None:
    runner = await services.runners.mark_reconnecting(sid)
    if not runner:
        return
    _disconnect_tasks[runner.id] = asyncio.create_task(_expire_disconnected_runner(runner.id, sid))


@sio.on("runner:heartbeat", namespace="/runner")
async def heartbeat(sid: str, _payload: dict | None = None) -> dict:
    runner = await services.runners.get_by_socket(sid)
    if not runner:
        return {"ok": False, "error": "Runner is not registered."}
    await services.runners.heartbeat(runner.id)
    return {"ok": True}


@sio.on("job:status", namespace="/runner")
async def job_status(sid: str, payload: dict) -> dict:
    runner = await services.runners.get_by_socket(sid)
    if not runner:
        return {"ok": False, "error": "Runner is not registered."}
    try:
        job_id = UUID(str(payload["jobId"]))
        status = JobStatus(str(payload["status"]))
    except (KeyError, TypeError, ValueError):
        return {"ok": False, "error": "Invalid job status payload."}

    job = await services.jobs.get(job_id)
    if not job or job.runner_id != runner.id:
        return {"ok": False, "error": "Job does not belong to this runner."}
    if not can_transition(job.status, status):
        return {"ok": False, "error": f"Invalid job transition: {job.status} -> {status}."}
    updated = await services.jobs.update_status(
        job_id,
        status,
        error=payload.get("error"),
    )
    if status in {JobStatus.COMPLETED, JobStatus.FAILED, JobStatus.CANCELLED}:
        await services.runners.set_job(runner.id, None)
    await sio.emit(
        "job:status",
        updated.model_dump(mode="json", by_alias=True),
        room=f"job:{job_id}",
        namespace="/ui",
    )
    return {"ok": True}


@sio.on("captcha:required", namespace="/runner")
async def captcha_required(sid: str, payload: dict) -> dict:
    runner = await services.runners.get_by_socket(sid)
    if not runner:
        return {"ok": False, "error": "Runner is not registered."}
    try:
        job_id = UUID(str(payload["jobId"]))
        captcha_id = str(payload["captchaId"])
        image_data_url = str(payload["imageDataUrl"])
    except (KeyError, TypeError, ValueError):
        return {"ok": False, "error": "Invalid CAPTCHA payload."}
    if not captcha_id or not image_data_url.startswith("data:image/"):
        return {"ok": False, "error": "Invalid CAPTCHA image."}
    if len(image_data_url) > 1_000_000:
        return {"ok": False, "error": "CAPTCHA image is too large."}

    job = await services.jobs.get(job_id)
    if not job or job.runner_id != runner.id:
        return {"ok": False, "error": "Job does not belong to this runner."}
    if not can_transition(job.status, JobStatus.WAITING_CAPTCHA):
        return {"ok": False, "error": "Job cannot request CAPTCHA in its current state."}
    await services.jobs.update_status(
        job_id,
        JobStatus.WAITING_CAPTCHA,
        captcha_id=captcha_id,
        captcha_image_data_url=image_data_url,
    )
    await sio.emit(
        "captcha:required",
        {
            "jobId": str(job_id),
            "captchaId": captcha_id,
            "imageDataUrl": image_data_url,
        },
        room=f"job:{job_id}",
        namespace="/ui",
    )
    return {"ok": True}


@sio.on("captcha:invalid", namespace="/runner")
async def captcha_invalid(sid: str, payload: dict) -> dict:
    runner = await services.runners.get_by_socket(sid)
    if not runner:
        return {"ok": False, "error": "Runner is not registered."}
    try:
        job_id = UUID(str(payload["jobId"]))
        captcha_id = str(payload["captchaId"])
        image_data_url = str(payload["imageDataUrl"])
    except (KeyError, TypeError, ValueError):
        return {"ok": False, "error": "Invalid CAPTCHA payload."}
    if not captcha_id or not image_data_url.startswith("data:image/"):
        return {"ok": False, "error": "Invalid CAPTCHA image."}
    if len(image_data_url) > 1_000_000:
        return {"ok": False, "error": "CAPTCHA image is too large."}

    job = await services.jobs.get(job_id)
    if not job or job.runner_id != runner.id:
        return {"ok": False, "error": "Job does not belong to this runner."}
    if job.status not in {JobStatus.SUBMITTING, JobStatus.WAITING_RESULT}:
        return {"ok": False, "error": "Job is not waiting for a VAHAN result."}
    updated = await services.jobs.update_status(
        job_id,
        JobStatus.WAITING_CAPTCHA,
        captcha_id=captcha_id,
        captcha_image_data_url=image_data_url,
    )
    await sio.emit(
        "captcha:invalid",
        {
            "jobId": str(job_id),
            "captchaId": captcha_id,
            "imageDataUrl": image_data_url,
        },
        room=f"job:{job_id}",
        namespace="/ui",
    )
    await sio.emit(
        "job:status",
        updated.model_dump(mode="json", by_alias=True),
        room=f"job:{job_id}",
        namespace="/ui",
    )
    return {"ok": True}


@sio.on("captcha:refreshed", namespace="/runner")
async def captcha_refreshed(sid: str, payload: dict) -> dict:
    runner = await services.runners.get_by_socket(sid)
    if not runner:
        return {"ok": False, "error": "Runner is not registered."}
    try:
        job_id = UUID(str(payload["jobId"]))
        captcha_id = str(payload["captchaId"])
        image_data_url = str(payload["imageDataUrl"])
    except (KeyError, TypeError, ValueError):
        return {"ok": False, "error": "Invalid CAPTCHA payload."}
    if not captcha_id or not image_data_url.startswith("data:image/"):
        return {"ok": False, "error": "Invalid CAPTCHA image."}
    if len(image_data_url) > 1_000_000:
        return {"ok": False, "error": "CAPTCHA image is too large."}

    job = await services.jobs.get(job_id)
    if not job or job.runner_id != runner.id:
        return {"ok": False, "error": "Job does not belong to this runner."}
    if job.status != JobStatus.WAITING_CAPTCHA:
        return {"ok": False, "error": "Job is not waiting for CAPTCHA."}
    updated = await services.jobs.update_status(
        job_id, JobStatus.WAITING_CAPTCHA,
        captcha_id=captcha_id, captcha_image_data_url=image_data_url,
    )
    await sio.emit(
        "captcha:refreshed",
        {"jobId": str(job_id), "captchaId": captcha_id, "imageDataUrl": image_data_url},
        room=f"job:{job_id}",
        namespace="/ui",
    )
    await sio.emit(
        "job:status",
        updated.model_dump(mode="json", by_alias=True),
        room=f"job:{job_id}",
        namespace="/ui",
    )
    return {"ok": True}
