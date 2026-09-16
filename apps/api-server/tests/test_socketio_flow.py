import asyncio
import socket
from collections.abc import AsyncIterator

import pytest_asyncio
import socketio
import uvicorn
from httpx import AsyncClient

from app.config import settings
from app.main import application


def _free_port() -> int:
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        return int(sock.getsockname()[1])


@pytest_asyncio.fixture
async def live_server_url() -> AsyncIterator[str]:
    port = _free_port()
    config = uvicorn.Config(
        application,
        host="127.0.0.1",
        port=port,
        log_level="warning",
        lifespan="off",
    )
    server = uvicorn.Server(config)
    task = asyncio.create_task(server.serve())
    for _ in range(100):
        if server.started:
            break
        await asyncio.sleep(0.02)
    assert server.started
    try:
        yield f"http://127.0.0.1:{port}"
    finally:
        server.should_exit = True
        await asyncio.wait_for(task, timeout=5)


async def test_runner_job_and_captcha_round_trip(live_server_url: str) -> None:
    runner = socketio.AsyncClient()
    ui = socketio.AsyncClient()
    assigned = asyncio.Event()
    captcha_visible = asyncio.Event()
    captcha_forwarded = asyncio.Event()
    assigned_payload: dict = {}

    @runner.on("job:assigned", namespace="/runner")
    async def on_assigned(payload: dict) -> None:
        assigned_payload.update(payload)
        assigned.set()

    @ui.on("captcha:required", namespace="/ui")
    async def on_captcha(_payload: dict) -> None:
        captcha_visible.set()

    @runner.on("captcha:submitted", namespace="/runner")
    async def on_captcha_submitted(_payload: dict) -> None:
        captcha_forwarded.set()

    try:
        await runner.connect(
            live_server_url,
            namespaces=["/runner"],
            transports=["websocket"],
            auth={
                "runnerId": "runner-e2e",
                "runnerName": "E2E Chrome",
                "version": "0.1.0",
                "token": settings.runner_token,
            },
        )
        await ui.connect(
            live_server_url,
            namespaces=["/ui"],
            transports=["websocket"],
        )

        async with AsyncClient(base_url=live_server_url) as client:
            response = await client.post(
                "/api/jobs",
                json={
                    "runnerId": "runner-e2e",
                    "filters": {"states": ["Delhi"], "autoApply": True},
                },
            )
        assert response.status_code == 201
        job_id = response.json()["id"]
        await asyncio.wait_for(assigned.wait(), timeout=2)
        assert assigned_payload["jobId"] == job_id

        subscription = await ui.call(
            "ui:subscribe-job",
            {"jobId": job_id},
            namespace="/ui",
            timeout=2,
        )
        assert subscription["ok"] is True

        captcha_id = "captcha-sequence-1"
        acknowledgement = await runner.call(
            "captcha:required",
            {
                "jobId": job_id,
                "captchaId": captcha_id,
                "imageDataUrl": "data:image/png;base64,iVBORw0KGgo=",
            },
            namespace="/runner",
            timeout=2,
        )
        assert acknowledgement["ok"] is True
        await asyncio.wait_for(captcha_visible.wait(), timeout=2)

        acknowledgement = await ui.call(
            "captcha:submitted",
            {
                "jobId": job_id,
                "captchaId": captcha_id,
                "value": "A1B2C3",
            },
            namespace="/ui",
            timeout=2,
        )
        assert acknowledgement["ok"] is True
        await asyncio.wait_for(captcha_forwarded.wait(), timeout=2)
    finally:
        if ui.connected:
            await ui.disconnect()
        if runner.connected:
            await runner.disconnect()
