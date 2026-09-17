from datetime import date

from fastapi import APIRouter, HTTPException, Query, status
from fastapi.responses import FileResponse

from app.models.ui_health import (
    UiHealthLogRequest,
    UiHealthLogResponse,
    UiHealthReportsResponse,
    UiHealthSchedule,
    UiHealthScheduleUpdate,
)
from app.realtime.server import sio
from app.services import services


router = APIRouter(prefix="/ui-health", tags=["ui-health"])


def _normalise_date(value: str | None) -> str | None:
    if value is None or not value.strip():
        return None
    try:
        return date.fromisoformat(value).isoformat()
    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="date must use YYYY-MM-DD format.",
        ) from error


@router.get(
    "/schedule",
    response_model=UiHealthSchedule,
    response_model_by_alias=True,
)
async def get_ui_health_schedule() -> UiHealthSchedule:
    return await services.ui_health.get()


@router.put(
    "/schedule",
    response_model=UiHealthSchedule,
    response_model_by_alias=True,
)
async def update_ui_health_schedule(command: UiHealthScheduleUpdate) -> UiHealthSchedule:
    schedule = await services.ui_health.update(command.interval_days)
    await sio.emit(
        "ui-health:schedule-updated",
        schedule.model_dump(mode="json", by_alias=True),
        namespace="/runner",
    )
    return schedule


@router.post(
    "/logs",
    response_model=UiHealthLogResponse,
    response_model_by_alias=True,
    status_code=status.HTTP_201_CREATED,
)
async def receive_ui_health_log(command: UiHealthLogRequest) -> UiHealthLogResponse:
    result = await services.ui_health_logs.append(
        command.health_check,
        page_url=command.page_url,
    )
    return UiHealthLogResponse.model_validate(result)


@router.get(
    "/reports",
    response_model=UiHealthReportsResponse,
    response_model_by_alias=True,
)
async def list_ui_health_reports(
    date_filter: str | None = Query(default=None, alias="date"),
) -> UiHealthReportsResponse:
    reports = await services.ui_health_logs.list_reports(_normalise_date(date_filter))
    return UiHealthReportsResponse.model_validate(reports)


@router.get("/reports/{file_name}/download")
async def download_ui_health_report(file_name: str) -> FileResponse:
    report_path = await services.ui_health_logs.resolve_report(file_name)
    if report_path is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report file not found.")
    return FileResponse(
        report_path,
        media_type="text/csv",
        filename=report_path.name,
    )
