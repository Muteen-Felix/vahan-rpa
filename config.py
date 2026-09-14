from pathlib import Path

DOWNLOAD_DIR = Path(__file__).resolve().parent / "downloads"
DOWNLOAD_DIR.mkdir(parents=True, exist_ok=True)
