from io import BytesIO
from uuid import uuid4

from httpx import ASGITransport, AsyncClient

from app.main import application
from app.models.filters import VahanFilters
from app.models.job import Job, JobStatus
from app.services import services


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
    fake_excel_bytes = b"PK\x03\x04mock-excel-file-content"
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
        )
        assert upload_resp.status_code == 200
        upload_data = upload_resp.json()
        assert upload_data["ok"] is True
        # Filename should be sanitized from scenarioName
        expected_name = "Delhi EV _ 2024_ Two-Wheeler.xlsx"
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

        download_resp = await client.get(f"/api/jobs/{job.id}/excel")
        assert download_resp.status_code == 200
        assert download_resp.content == fake_excel_bytes
        assert expected_name in unquote(download_resp.headers.get("content-disposition", ""))

        # 4. List reports
        reports_resp = await client.get("/api/jobs/reports")
        assert reports_resp.status_code == 200
        reports = reports_resp.json()
        assert len(reports) >= 1
        found = next((r for r in reports if r["jobId"] == str(job.id)), None)
        assert found is not None
        assert found["scenarioName"] == "Delhi EV / 2024: Two-Wheeler"
        assert found["fileName"] == expected_name
        assert found["fileSize"] == len(fake_excel_bytes)


async def test_upload_excel_non_existent_job() -> None:
    fake_job_id = uuid4()
    file_payload = {
        "file": ("report.xlsx", BytesIO(b"data"), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
    }
    async with AsyncClient(
        transport=ASGITransport(app=application),
        base_url="http://test",
    ) as client:
        resp = await client.post(f"/api/jobs/{fake_job_id}/upload-excel", files=file_payload)
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
        resp = await client.post(f"/api/jobs/{job.id}/upload-excel", files=file_payload)

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
        resp = await client.get(f"/api/jobs/{job.id}/excel")
        assert resp.status_code == 404
