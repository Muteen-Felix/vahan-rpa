# VAHAN RPA API — MVP Phase 1

Backend control plane for the React Web UI and VAHAN browser extension.

## Included

- FastAPI REST endpoints: health, runners, create/get/cancel jobs.
- Socket.IO namespaces: `/ui` and `/runner`.
- In-memory runner registry and job repository.
- Runner registration, heartbeat and disconnect handling.
- Job assignment/status routing.
- CAPTCHA image and human-entered value routing.

State is intentionally lost when the process restarts. PostgreSQL, Redis,
Celery, authentication and report storage are outside Phase 1.

## Run locally

```powershell
cd apps/api-server
python -m pip install -e ".[dev]"
$env:VAHAN_API_RUNNER_TOKEN = "change-me"
python -m uvicorn app.main:application --host 127.0.0.1 --port 8000 --reload
```

OpenAPI is available at `http://127.0.0.1:8000/docs` and health at
`http://127.0.0.1:8000/api/health`.

## Test

```powershell
cd apps/api-server
python -m pytest
```
