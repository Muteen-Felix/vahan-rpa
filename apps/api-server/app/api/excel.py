import re
from pathlib import Path
from uuid import UUID

import aiofiles
from fastapi import APIRouter, HTTPException, UploadFile, status
from fastapi.responses import FileResponse

from app.config import settings
from app.models.job import JobStatus
from app.services import services

router = APIRouter(prefix="/jobs", tags=["excel"])

_report_dir = Path(settings.excel_report_dir)


def _sanitize_filename(name: str) -> str:
    cleaned = re.sub(r'[\\/*?:"<>|\r\n\t]', "_", name).strip()
    return cleaned or "report"


def _excel_path(job_id: UUID) -> Path:
    return _report_dir / f"{job_id}.xlsx"


@router.get("/reports", status_code=status.HTTP_200_OK)
async def list_exported_reports() -> list[dict]:
    jobs = await services.jobs.list_all()
    reports = []
    for job in jobs:
        if job.status == JobStatus.COMPLETED and job.excel_file_name:
            reports.append({
                "jobId": str(job.id),
                "scenarioName": job.scenario_name or job.excel_file_name,
                "fileName": job.excel_file_name,
                "fileSize": job.excel_file_size or 0,
                "createdAt": job.created_at.isoformat(),
                "downloadUrl": f"/api/jobs/{job.id}/excel",
            })
    reports.sort(key=lambda r: r["createdAt"], reverse=True)
    return reports


@router.post(
    "/{job_id}/upload-excel",
    status_code=status.HTTP_200_OK,
)
async def upload_excel(job_id: UUID, file: UploadFile) -> dict:
    job = await services.jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found.")

    if file.content_type and file.content_type not in {
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/octet-stream",
    }:
        raise HTTPException(status_code=400, detail="Only .xlsx files are accepted.")

    _report_dir.mkdir(parents=True, exist_ok=True)
    dest = _excel_path(job_id)

    size = 0
    async with aiofiles.open(dest, "wb") as out:
        while chunk := await file.read(256 * 1024):
            size += len(chunk)
            if size > settings.max_excel_upload_bytes:
                await out.close()
                dest.unlink(missing_ok=True)
                raise HTTPException(
                    status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                    detail=f"File exceeds {settings.max_excel_upload_bytes // (1024 * 1024)} MB limit.",
                )
            await out.write(chunk)

    if job.scenario_name:
        file_name = f"{_sanitize_filename(job.scenario_name)}.xlsx"
    elif file.filename:
        file_name = file.filename
    else:
        file_name = f"{job_id}.xlsx"

    await services.jobs.set_excel_file(job_id, file_name=file_name, file_size=size)

    return {"ok": True, "fileName": file_name, "sizeBytes": size}


@router.get("/{job_id}/excel")
async def download_excel(job_id: UUID) -> FileResponse:
    job = await services.jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found.")

    path = _excel_path(job_id)
    if not path.is_file():
        raise HTTPException(status_code=404, detail="Excel file not found for this job.")

    return FileResponse(
        path=path,
        filename=job.excel_file_name or f"{job_id}.xlsx",
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )

