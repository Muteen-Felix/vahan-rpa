from pathlib import Path

from app.config import settings


def stored_excel_path(file_name: str | None) -> Path | None:
    if not file_name or Path(file_name).name != file_name or not file_name.lower().endswith(".xlsx"):
        return None
    path = Path(settings.excel_report_dir) / file_name
    return path if path.is_file() and path.stat().st_size > 0 else None
