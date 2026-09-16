# VAHAN RPA Web UI — MVP Phase 3

React control center for creating VAHAN filter jobs, viewing extension runners,
tracking job status and entering CAPTCHA challenges forwarded by the backend.

## Run

Start the backend first, then:

```powershell
cd apps/web-ui
npm.cmd install
npm.cmd run dev
```

Open `http://127.0.0.1:5173`. The backend URL defaults to
`http://127.0.0.1:8000` and can be changed with `VITE_API_URL`.
