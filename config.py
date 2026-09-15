from pathlib import Path

DOWNLOAD_DIR = Path(__file__).resolve().parent / "downloads"
DOWNLOAD_DIR.mkdir(parents=True, exist_ok=True)

# UI drift diagnostics are deliberately metadata-only.  Do not write CAPTCHA
# values, screenshots, or full page HTML here.
DIAGNOSTIC_DIR = Path(__file__).resolve().parent / "diagnostics"
DIAGNOSTIC_DIR.mkdir(parents=True, exist_ok=True)
