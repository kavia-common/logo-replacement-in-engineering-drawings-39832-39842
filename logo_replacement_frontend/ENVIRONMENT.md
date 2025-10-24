# Environment and Integration Guide

This frontend communicates with the FastAPI backend for job creation, uploads, status polling, listing processed files, and downloading results.

## Frontend Environment Variables

- REACT_APP_BACKEND_URL
  - Preferred variable to point the frontend at the backend base URL.
  - Examples:
    - Local dev direct: REACT_APP_BACKEND_URL=http://localhost:3001
    - Same origin with reverse proxy: REACT_APP_BACKEND_URL=/
  - If not set, the app falls back to:
    1) REACT_APP_API_BASE (legacy support)
    2) Same-origin relative paths ('') so CRA dev proxy or reverse proxy can be used.

Notes:
- The frontend strips any trailing slashes on the configured base.
- When base is empty string, calls are relative (e.g., /jobs).

## CRA Proxy (Development)

The included package.json sets:
- "proxy": "http://localhost:3001"

This means if REACT_APP_BACKEND_URL is not set, `npm start` will forward API requests to port 3001 locally.

To override and point directly to a backend:
- Use: `npm run start:api` (sets REACT_APP_API_BASE which is still honored for backward compatibility)
- Or set REACT_APP_BACKEND_URL explicitly before `npm start`.

## Backend CORS

When running the backend on a different origin (domain/port), ensure CORS allows the frontend origin:
- Allowed origin should include: 
  - http://localhost:3000 (CRA dev)
  - Deployed frontend domain in production
- Allowed methods should cover: GET, POST, DELETE
- Allow credentials if needed (not required by default here)

## Downloads and File Previews

For the main ZIP download endpoint GET /jobs/{job_id}/download:
- Headers required:
  - Content-Disposition: attachment; filename="processed_<job_id>.zip"
  - Access-Control-Expose-Headers: Content-Disposition   (so fetch() can read it across origins)
  - Content-Type: application/zip

For per-file download endpoint GET /jobs/{job_id}/files/{filename}:
- Set Content-Type appropriately based on file extension (e.g., image/png, application/pdf)
- Include:
  - Content-Disposition: attachment; filename="<filename>"
  - Access-Control-Expose-Headers: Content-Disposition

The frontend uses:
- GET /jobs/{job_id}/files to list processed items and render a Results section with previews (images inline, PDFs as icon with View link).
- GET /jobs/{job_id}/files/{filename} for "Open" (new tab) and "Download" actions.

## .env.example

Create a `.env` file based on the following example for your environment:

REACT_APP_BACKEND_URL=http://localhost:3001

Do not commit `.env` files.
