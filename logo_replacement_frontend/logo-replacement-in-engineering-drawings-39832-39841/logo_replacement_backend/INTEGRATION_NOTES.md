# Backend Integration Notes: Download Endpoint Headers

To ensure the React frontend can download the processed ZIP with a correct filename, the FastAPI download route GET /jobs/{job_id}/download must return:

- Content-Disposition: attachment; filename="processed_<job_id>.zip"
  - If you preserve original naming, set the desired filename accordingly.
- Access-Control-Expose-Headers: Content-Disposition
  - Required when frontend and backend are on different origins so the browser exposes the header to JavaScript (for fetch()).
- Content-Type: application/zip
- Appropriate status codes:
  - 200 when the ZIP is ready and streaming
  - 404 when job or artifact not found
  - 409 when job is not completed yet

If cookie-based sessions/authorization are used:
- Configure CORS to allow credentials and the frontend origin (e.g., http://localhost:3000 in development).
- Frontend calls fetch(url, { credentials: 'include' }).

Example (FastAPI):

from fastapi import APIRouter, HTTPException, Response
from fastapi.responses import StreamingResponse

router = APIRouter()

@router.get("/jobs/{job_id}/download", summary="Download processed ZIP", description="Stream the processed ZIP file with Content-Disposition header for download.")
async def download_result(job_id: str):
    # ... validate job, ensure status == COMPLETED, locate zip_path ...
    zip_path = f"/path/to/results/{job_id}/processed.zip"
    try:
        def file_iter(path, chunk_size=1024*1024):
            with open(path, "rb") as f:
                while True:
                    chunk = f.read(chunk_size)
                    if not chunk:
                        break
                    yield chunk

        headers = {
            "Content-Disposition": f'attachment; filename="processed_{job_id}.zip"',
            "Access-Control-Expose-Headers": "Content-Disposition"
        }
        return StreamingResponse(
            file_iter(zip_path),
            media_type="application/zip",
            headers=headers
        )
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Result not found")
