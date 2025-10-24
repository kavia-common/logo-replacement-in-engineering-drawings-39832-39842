# Logo Replacement Frontend (React)

A lightweight, modern UI for uploading drawing ZIPs and a logo image, starting processing, monitoring progress, and downloading results from the backend API.

## Quick Start

- Install: `npm install`
- Start (proxied to backend at http://localhost:3001 via CRA proxy): `npm start`
- Start with explicit backend URL: `REACT_APP_BACKEND_URL=http://localhost:3001 npm start`
- Build: `npm run build`

The frontend resolves the API base via:
1) `REACT_APP_BACKEND_URL` (preferred)
2) `REACT_APP_API_BASE` (legacy support)
3) Fallback to same-origin (''), which works with CRA proxy and reverse proxies.

See ENVIRONMENT.md for details and examples.

## Backend Integration

Expected endpoints:
- POST /jobs
- POST /jobs/{job_id}/upload
- POST /jobs/{job_id}/start
- GET  /jobs/{job_id}/status
- GET  /jobs/{job_id}/download

Downloads should be served with `Content-Disposition: attachment; filename="processed_<job_id>.zip"` by the backend. The frontend also sets a safe default filename.

## Theme

Executive Gray theme with classic, professional styling. Customize tokens in `src/App.css`.

## Scripts

- `npm start` - Dev server (http://localhost:3000)
- `npm run build` - Production build
- `npm test` - Tests

## Notes

- If the backend runs on a different origin, configure CORS on the backend to allow the frontend origin (e.g., http://localhost:3000 during development).
- Large file uploads depend on backend limits; adjust server config as needed.

### Dev server preview: Invalid Host header

In some preview environments the React dev server may display "Invalid Host header" because the Host header doesn’t match localhost.  
This project includes a development-only configuration to allow the preview host:

- `.env.development.local` sets:
  - `HOST=0.0.0.0` so the dev server binds to all interfaces
  - `DANGEROUSLY_DISABLE_HOST_CHECK=true` to accept the preview host header
  - `WDS_SOCKET_PORT=3000` to align the dev-server client socket port

These settings are only for development/preview. Do not use such settings for production builds.
