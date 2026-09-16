from uuid import UUID

from app.models.job import JobStatus
from app.realtime.server import sio
from app.services import services


@sio.event(namespace="/ui")
async def connect(_sid: str, _environ: dict, _auth: dict | None) -> bool:
    # Authentication is deliberately deferred for the single-user MVP.
    return True


@sio.on("ui:subscribe-job", namespace="/ui")
async def subscribe_job(sid: str, payload: dict) -> dict:
    try:
        job_id = UUID(str(payload["jobId"]))
    except (KeyError, TypeError, ValueError):
        return {"ok": False, "error": "Invalid job ID."}
    job = await services.jobs.get(job_id)
    if not job:
        return {"ok": False, "error": "Job not found."}
    await sio.enter_room(sid, f"job:{job_id}", namespace="/ui")
    return {
        "ok": True,
        "job": job.model_dump(mode="json", by_alias=True),
    }


@sio.on("captcha:submitted", namespace="/ui")
async def submit_captcha(_sid: str, payload: dict) -> dict:
    try:
        job_id = UUID(str(payload["jobId"]))
        captcha_id = str(payload["captchaId"])
        value = str(payload["value"]).strip()
    except (KeyError, TypeError, ValueError):
        return {"ok": False, "error": "Invalid CAPTCHA submission."}
    if len(value) != 6:
        return {"ok": False, "error": "CAPTCHA must contain exactly 6 characters."}

    job = await services.jobs.get(job_id)
    if not job:
        return {"ok": False, "error": "Job not found."}
    if job.status != JobStatus.WAITING_CAPTCHA:
        return {"ok": False, "error": "Job is not waiting for CAPTCHA."}
    if job.captcha_id != captcha_id:
        return {"ok": False, "error": "CAPTCHA has changed or expired."}

    updated = await services.jobs.update_status(job_id, JobStatus.SUBMITTING)
    await sio.emit(
        "captcha:submitted",
        {
            "jobId": str(job_id),
            "captchaId": captcha_id,
            "value": value,
        },
        room=f"runner:{job.runner_id}",
        namespace="/runner",
    )
    await sio.emit(
        "job:status",
        updated.model_dump(mode="json", by_alias=True),
        room=f"job:{job_id}",
        namespace="/ui",
    )
    return {"ok": True}
