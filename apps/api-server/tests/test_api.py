from httpx import ASGITransport, AsyncClient

from app.main import application
from app.services import services


async def test_health() -> None:
    async with AsyncClient(
        transport=ASGITransport(app=application),
        base_url="http://test",
    ) as client:
        response = await client.get("/api/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


async def test_create_job_requires_online_runner() -> None:
    async with AsyncClient(
        transport=ASGITransport(app=application),
        base_url="http://test",
    ) as client:
        response = await client.post(
            "/api/jobs",
            json={"runnerId": "missing", "filters": {}},
        )

    assert response.status_code == 404


async def test_create_get_and_cancel_job() -> None:
    await services.runners.register(
        runner_id="runner-local-001",
        name="Test Chrome",
        socket_id="test-socket",
        version="0.1.0",
    )
    payload = {
        "runnerId": "runner-local-001",
        "filters": {
            "states": ["Delhi"],
            "categoryGroups": ["Two Wheeler"],
            "autoApply": False,
            "autoExport": True,
        },
    }

    async with AsyncClient(
        transport=ASGITransport(app=application),
        base_url="http://test",
    ) as client:
        created = await client.post("/api/jobs", json=payload)
        assert created.status_code == 201
        body = created.json()
        assert body["status"] == "ASSIGNED"
        assert body["filters"]["categoryGroups"] == ["Two Wheeler"]

        fetched = await client.get(f"/api/jobs/{body['id']}")
        assert fetched.status_code == 200
        assert fetched.json()["id"] == body["id"]

        cancelled = await client.post(f"/api/jobs/{body['id']}/cancel")
        assert cancelled.status_code == 200
        assert cancelled.json()["status"] == "CANCELLED"

    runner = await services.runners.get("runner-local-001")
    assert runner is not None
    assert runner.current_job_id is None
