from uuid import UUID

from socketio.exceptions import TimeoutError as SocketIOTimeoutError

from app.models.job import JobStatus, can_transition
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
    response = {
        "ok": True,
        "job": job.model_dump(mode="json", by_alias=True),
    }
    if job.status == JobStatus.WAITING_CAPTCHA and job.captcha_id and job.captcha_image_data_url:
        response["captcha"] = {
            "jobId": str(job.id),
            "captchaId": job.captcha_id,
            "imageDataUrl": job.captcha_image_data_url,
        }
    return response


@sio.on("ui:runner-options", namespace="/ui")
async def runner_options(_sid: str, payload: dict) -> dict:
    runner_id = str(payload.get("runnerId", "")).strip()
    request = payload.get("request")
    if not runner_id or not isinstance(request, dict):
        return {"ok": False, "error": "Invalid runner options request."}
    if request.get("type") not in {
        "GET_ALL_OPTIONS", "GET_STATE_OPTIONS", "GET_RTO_OPTIONS",
        "GET_X_AXIS_OPTIONS", "SEARCH_MAKERS",
    }:
        return {"ok": False, "error": "Unsupported runner options request."}
    runner = await services.runners.get(runner_id)
    if not runner:
        return {"ok": False, "error": "Runner is offline."}
    try:
        return await sio.call(
            "runner:options",
            request,
            to=runner.socket_id,
            namespace="/runner",
            timeout=20,
        )
    except SocketIOTimeoutError:
        return {"ok": False, "error": "Runner did not return VAHAN options in time."}


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
    if not can_transition(job.status, JobStatus.SUBMITTING):
        return {"ok": False, "error": "Job cannot submit CAPTCHA in its current state."}

    runner = await services.runners.get(job.runner_id)
    if not runner:
        return {"ok": False, "error": "Runner is offline."}

    updated = await services.jobs.update_status(job_id, JobStatus.SUBMITTING)
    await sio.emit("job:status", updated.model_dump(mode="json", by_alias=True), room=f"job:{job_id}", namespace="/ui")
    try:
        acknowledgement = await sio.call(
            "captcha:submit",
            {
            "jobId": str(job_id),
            "captchaId": captcha_id,
            "value": value,
            },
            to=runner.socket_id,
            namespace="/runner",
            timeout=15,
        )
    except SocketIOTimeoutError:
        acknowledgement = {"ok": False, "error": "Runner did not acknowledge CAPTCHA submission."}
    if not acknowledgement or not acknowledgement.get("ok"):
        error = (acknowledgement or {}).get("error", "Runner rejected CAPTCHA submission.")
        failed = await services.jobs.update_status(job_id, JobStatus.FAILED, error=error)
        await services.runners.set_job(job.runner_id, None)
        await sio.emit("job:status", failed.model_dump(mode="json", by_alias=True), room=f"job:{job_id}", namespace="/ui")
        return {"ok": False, "error": error}
    return {"ok": True}
