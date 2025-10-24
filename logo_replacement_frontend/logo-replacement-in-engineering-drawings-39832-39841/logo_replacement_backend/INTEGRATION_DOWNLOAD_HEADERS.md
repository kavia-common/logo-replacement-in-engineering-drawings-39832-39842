# Download Endpoints: Headers and Content Types

This document summarizes the required response headers and content types for the backend download endpoints so the React frontend can handle downloads and previews reliably, including across origins.

- GET /jobs/{job_id}/download
  - Purpose: stream the processed ZIP of all outputs.
  - Must set:
    - Content-Type: application/zip
    - Content-Disposition: attachment; filename="processed_<job_id>.zip"
    - Access-Control-Expose-Headers: Content-Disposition
  - Status codes:
    - 200 when ZIP is available
    - 404 if job or artifact not found
    - 409 if job not completed yet

- GET /jobs/{job_id}/files
  - Purpose: return JSON listing of processed files with fields: filename, size, content_type
  - Status codes:
    - 200 on success
    - 404 if job or results not found
    - 409 if job not completed yet

- GET /jobs/{job_id}/files/{filename}
  - Purpose: stream an individual processed file for inline display in browser (images/PDF) or download.
  - Must set:
    - Content-Type: based on file (e.g., image/png, image/jpeg, image/tiff, application/pdf, etc.)
    - Content-Disposition: attachment; filename="<filename>"
    - Access-Control-Expose-Headers: Content-Disposition

Notes:
- When frontend and backend are on different origins, Access-Control-Expose-Headers is required for fetch() to read the Content-Disposition header, which is used to derive a filename for saved downloads.
- If you use cookie-based sessions, configure CORS to allow credentials and set fetch(..., { credentials: 'include' }).
