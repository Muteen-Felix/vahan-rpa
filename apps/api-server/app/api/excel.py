import re
import zipfile
from pathlib import Path
from uuid import UUID, uuid4

import aiofiles
from fastapi import APIRouter, Header, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from app.config import settings
from app.excel_storage import stored_excel_path
from app.models.job import Job, JobStatus
from app.services import services

router = APIRouter(prefix="/jobs", tags=["excel"])

_report_dir = Path(settings.excel_report_dir)


def _sanitize_filename(name: str) -> str:
    cleaned = re.sub(r'[\\/*?:"<>|\r\n\t]', "_", name).strip()
    return cleaned or "report"


def _generate_excel_filename(job: Job, uploaded_filename: str | None = None) -> str:
    dt = job.created_at.astimezone() if job.created_at.tzinfo else job.created_at
    timestamp = dt.strftime("%Y%m%d_%H%M%S")

    if job.scenario_name:
        base_name = _sanitize_filename(job.scenario_name)
    elif uploaded_filename and uploaded_filename != "report.xlsx":
        clean_stem = _sanitize_filename(Path(uploaded_filename).stem)
        base_name = clean_stem
    else:
        base_name = f"report_{str(job.id)[:8]}"

    return f"{base_name}_{timestamp}_{str(job.id)[:8]}.xlsx"


class VerifyReportsRequest(BaseModel):
    file_names: list[str] = Field(alias="fileNames", max_length=500)


def _excel_path(job: Job) -> Path:
    if job.excel_file_name:
        path = _report_dir / job.excel_file_name
        if path.is_file():
            return path
    # Backward compatibility fallback
    return _report_dir / f"{job.id}.xlsx"


@router.get("/reports", status_code=status.HTTP_200_OK)
async def list_exported_reports() -> list[dict]:
    jobs = await services.jobs.list_all()
    reports = []
    for job in jobs:
        if job.status == JobStatus.COMPLETED and stored_excel_path(job.excel_file_name):
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


@router.post("/reports/verify")
async def verify_exported_reports(request: VerifyReportsRequest) -> dict:
    return {"files": {
        name: (path.stat().st_size if (path := stored_excel_path(name)) else 0)
        for name in request.file_names
    }}


@router.get("/reports/file/{file_name}")
async def download_stored_report(file_name: str) -> FileResponse:
    path = stored_excel_path(file_name)
    if not path:
        raise HTTPException(status_code=404, detail="Excel file not found.")
    return FileResponse(
        path=path,
        filename=file_name,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )


@router.post(
    "/{job_id}/upload-excel",
    status_code=status.HTTP_200_OK,
)
async def upload_excel(
    job_id: UUID,
    file: UploadFile,
    runner_id: str | None = Header(default=None, alias="X-VAHAN-RUNNER-ID"),
) -> dict:
    job = await services.jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found.")
    if not runner_id or runner_id != job.runner_id:
        raise HTTPException(status_code=403, detail="This runner is not assigned to the job.")
    if job.status != JobStatus.WAITING_RESULT:
        raise HTTPException(status_code=409, detail="Job is not waiting for an Excel report.")

    if file.content_type and file.content_type not in {
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/octet-stream",
    }:
        raise HTTPException(status_code=400, detail="Only .xlsx files are accepted.")

    _report_dir.mkdir(parents=True, exist_ok=True)
    file_name = _generate_excel_filename(job, file.filename)
    dest = _report_dir / file_name
    temporary = _report_dir / f".{job.id}.{uuid4().hex}.tmp"

    size = 0
    try:
        async with aiofiles.open(temporary, "wb") as out:
            while chunk := await file.read(256 * 1024):
                size += len(chunk)
                if size > settings.max_excel_upload_bytes:
                    raise HTTPException(
                        status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                        detail=f"File exceeds {settings.max_excel_upload_bytes // (1024 * 1024)} MB limit.",
                    )
                await out.write(chunk)
        if not size:
            raise HTTPException(status_code=400, detail="Excel file is empty.")
        if not zipfile.is_zipfile(temporary):
            raise HTTPException(status_code=400, detail="The uploaded file is not a valid Excel workbook.")
        with zipfile.ZipFile(temporary) as workbook:
            if "xl/workbook.xml" not in workbook.namelist() or workbook.testzip() is not None:
                raise HTTPException(status_code=400, detail="The uploaded Excel workbook is damaged.")
        temporary.replace(dest)
    finally:
        temporary.unlink(missing_ok=True)
    await services.jobs.set_excel_file(job_id, file_name=file_name, file_size=size)

    return {"ok": True, "fileName": file_name, "sizeBytes": size}


@router.get("/{job_id}/excel")
async def download_excel(job_id: UUID) -> FileResponse:
    job = await services.jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found.")

    path = _excel_path(job)
    if not path.is_file():
        raise HTTPException(status_code=404, detail="Excel file not found for this job.")

    return FileResponse(
        path=path,
        filename=job.excel_file_name or f"{job_id}.xlsx",
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )
