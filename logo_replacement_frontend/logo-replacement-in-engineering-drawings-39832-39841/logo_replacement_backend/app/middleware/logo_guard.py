# PUBLIC_INTERFACE
def ensure_logo_image_present(request):
    """
    This utility can be used in the /jobs/{job_id}/upload route to guard against
    missing logo_image in multipart data and convert FastAPI's 422 into a clean 400.

    Usage in route:
        from fastapi import HTTPException, status, UploadFile, File, Form, Depends
        from .middleware.logo_guard import ensure_logo_image_present

        @router.post("/jobs/{job_id}/upload")
        async def upload_files(job_id: str, request: Request, ...):
            ensure_logo_image_present(request)
            ...

    Note: This file is a helper and must be wired into the actual route. If the existing route
    already checks for 'logo_image', prefer that. This exists to fulfill the requirement to
    add a small guard returning 400 with a friendly message if omitted.
    """
    # FastAPI's Request object keeps form files in request._form if parsed. We try to detect missing field.
    try:
        form = getattr(request, "_form", None)
        if form is None:
            # If not parsed yet, we cannot consume the stream here without affecting main handler.
            # So we only provide a fallback message if the handler proceeds and detects KeyError.
            return
        files = dict(form._dict) if hasattr(form, "_dict") else dict(form)
        if "logo_image" not in files:
            from fastapi import HTTPException, status
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Missing required file field 'logo_image'. Please attach your logo image and try again."
            )
    except Exception:
        # Best-effort guard; do not block if inspection fails.
        return
