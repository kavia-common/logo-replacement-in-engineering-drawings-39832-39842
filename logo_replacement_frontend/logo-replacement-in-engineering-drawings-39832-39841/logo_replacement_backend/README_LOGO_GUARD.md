# Upload Guard Note

To avoid propagating a 422 ValidationError when `logo_image` is omitted in the multipart upload, a small guard helper is provided:

File: `app/middleware/logo_guard.py`

Use it in the `/jobs/{job_id}/upload` handler to return a friendly 400:

```python
from fastapi import APIRouter, HTTPException, status, UploadFile, File, Request
from .middleware.logo_guard import ensure_logo_image_present

router = APIRouter()

@router.post("/jobs/{job_id}/upload", summary="Upload drawings (ZIP and/or files) and logo image")
async def upload_files(job_id: str, request: Request, logo_image: UploadFile = File(...), drawings_zip: UploadFile | None = File(None), drawings_files: list[UploadFile] | None = File(None)):
    ensure_logo_image_present(request)
    # existing implementation...
```

If your route already validates and produces a clear 400 for a missing logo, you may skip using this helper.
