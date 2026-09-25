from io import BytesIO
from dataclasses import replace
from uuid import uuid4
from zipfile import ZipFile

import pytest
from httpx import ASGITransport, AsyncClient

from app import excel_storage
from app.api import excel as excel_api
from app.config import settings
from app.main import application
from app.models.filters import VahanFilters
from app.models.job import Job, JobStatus
from app.realtime.runner_events import job_status
from app.services import services
from app.security import issue_access_token


RUNNER_HEADERS = {
    "X-VAHAN-RUNNER-ID": "test-runner",
    "X-VAHAN-RUNNER-TOKEN": settings.runner_token,
}
UI_HEADERS = {"Authorization": f"Bearer {issue_access_token(settings.ui_auth_username)}"}


@pytest.fixture(autouse=True)
def isolated_excel_reports(tmp_path, monkeypatch):
    monkeypatch.setattr(excel_api, "_report_dir", tmp_path)
    monkeypatch.setattr(excel_storage, "settings", replace(excel_storage.settings, excel_report_dir=str(tmp_path)))


async def test_upload_and_download_excel_flow() -> None:
    # 1. Create a mock job with scenario name
    job = Job(
        id=uuid4(),
        runnerId="test-runner",
        scenarioName="Delhi EV / 2024: Two-Wheeler",
        status=JobStatus.WAITING_RESULT,
        filters=VahanFilters(yAxis="State Name"),
    )
    await services.jobs.create(job)

    # 2. Upload an Excel file
    excel_buffer = BytesIO()
    with ZipFile(excel_buffer, "w") as workbook:
        workbook.writestr("xl/workbook.xml", "<workbook/>")
    fake_excel_bytes = excel_buffer.getvalue()
    file_payload = {
        "file": ("temp.xlsx", BytesIO(fake_excel_bytes), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
    }

    async with AsyncClient(
        transport=ASGITransport(app=application),
        base_url="http://test",
    ) as client:
        upload_resp = await client.post(
            f"/api/jobs/{job.id}/upload-excel",
            files=file_payload,
            headers=RUNNER_HEADERS,
        )
        assert upload_resp.status_code == 200
        upload_data = upload_resp.json()
        assert upload_data["ok"] is True
        # Filename should be sanitized from scenarioName and have timestamp
        dt = job.created_at.astimezone() if job.created_at.tzinfo else job.created_at
        expected_name = f"Delhi EV _ 2024_ Two-Wheeler_{dt.strftime('%Y%m%d_%H%M%S')}_{str(job.id)[:8]}.xlsx"
        assert upload_data["fileName"] == expected_name
        assert upload_data["sizeBytes"] == len(fake_excel_bytes)

        # Update job to COMPLETED so it appears in reports list
        await services.jobs.update_status(job.id, JobStatus.COMPLETED)

        # Verify job updated in repo
        updated_job = await services.jobs.get(job.id)
        assert updated_job.excel_file_name == expected_name
        assert updated_job.excel_file_size == len(fake_excel_bytes)

        # 3. Download the Excel file
        from urllib.parse import unquote

        download_resp = await client.get(f"/api/jobs/{job.id}/excel", headers=UI_HEADERS)
        assert download_resp.status_code == 200
        assert download_resp.content == fake_excel_bytes
        assert expected_name in unquote(download_resp.headers.get("content-disposition", ""))

        # 4. List reports
        reports_resp = await client.get("/api/jobs/reports", headers=UI_HEADERS)
        assert reports_resp.status_code == 200
        reports = reports_resp.json()
        assert len(reports) >= 1
        found = next((r for r in reports if r["jobId"] == str(job.id)), None)
        assert found is not None
        assert found["scenarioName"] == "Delhi EV / 2024: Two-Wheeler"
        assert found["fileName"] == expected_name
        assert found["fileSize"] == len(fake_excel_bytes)

        verify_resp = await client.post("/api/jobs/reports/verify", json={"fileNames": [expected_name]}, headers=UI_HEADERS)
        assert verify_resp.status_code == 200
        assert verify_resp.json()["files"][expected_name] == len(fake_excel_bytes)

        stored_download = await client.get(f"/api/jobs/reports/file/{expected_name}", headers=UI_HEADERS)
        assert stored_download.status_code == 200
        assert stored_download.content == fake_excel_bytes


async def test_upload_rejects_non_excel_bytes() -> None:
    job = Job(
        id=uuid4(), runnerId="test-runner", status=JobStatus.WAITING_RESULT,
        filters=VahanFilters(yAxis="State Name"),
    )
    await services.jobs.create(job)
    async with AsyncClient(transport=ASGITransport(app=application), base_url="http://test") as client:
        response = await client.post(
            f"/api/jobs/{job.id}/upload-excel",
            files={"file": ("report.xlsx", BytesIO(b"<html>error</html>"),
                            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
            headers=RUNNER_HEADERS,
        )
    assert response.status_code == 400
    assert (await services.jobs.get(job.id)).excel_file_name is None


async def test_job_cannot_complete_without_saved_excel() -> None:
    job = Job(
        id=uuid4(), runnerId="test-runner", status=JobStatus.WAITING_RESULT,
        filters=VahanFilters(yAxis="State Name"),
    )
    await services.jobs.create(job)
    await services.runners.register(runner_id="test-runner", name="Test runner", socket_id="test-socket")
    await services.runners.set_job("test-runner", str(job.id))

    response = await job_status("test-socket", {"jobId": str(job.id), "status": "COMPLETED"})

    assert response["ok"] is False
    assert (await services.jobs.get(job.id)).status == JobStatus.WAITING_RESULT


async def test_upload_excel_non_existent_job() -> None:
    fake_job_id = uuid4()
    file_payload = {
        "file": ("report.xlsx", BytesIO(b"data"), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
    }
    async with AsyncClient(
        transport=ASGITransport(app=application),
        base_url="http://test",
    ) as client:
        resp = await client.post(f"/api/jobs/{fake_job_id}/upload-excel", files=file_payload, headers=RUNNER_HEADERS)
        assert resp.status_code == 404


async def test_upload_excel_rejects_empty_file() -> None:
    job = Job(
        id=uuid4(),
        runnerId="test-runner",
        status=JobStatus.WAITING_RESULT,
        filters=VahanFilters(yAxis="State Name"),
    )
    await services.jobs.create(job)
    file_payload = {
        "file": ("empty.xlsx", BytesIO(b""), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
    }

    async with AsyncClient(
        transport=ASGITransport(app=application),
        base_url="http://test",
    ) as client:
        resp = await client.post(f"/api/jobs/{job.id}/upload-excel", files=file_payload, headers=RUNNER_HEADERS)

    assert resp.status_code == 400
    assert resp.json()["detail"] == "Excel file is empty."


async def test_download_excel_not_found() -> None:
    job = Job(
        id=uuid4(),
        runnerId="test-runner",
        status=JobStatus.COMPLETED,
        filters=VahanFilters(yAxis="State Name"),
    )
    await services.jobs.create(job)

    async with AsyncClient(
        transport=ASGITransport(app=application),
        base_url="http://test",
    ) as client:
        resp = await client.get(f"/api/jobs/{job.id}/excel", headers=UI_HEADERS)
        assert resp.status_code == 404
