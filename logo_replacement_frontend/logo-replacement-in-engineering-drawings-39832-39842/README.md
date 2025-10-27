# logo-replacement-in-engineering-drawings-39832-39842

This workspace hosts a demo for automated logo replacement in engineering drawings.

Frontend highlights (Executive Gray theme):
- Single-page layout with a polished header and subtle gradient
- Central drag-and-drop upload for ZIP + logo image
- Animated progress indicator and clear status states
- Results section with styled cards and actions (Open/Download)

See:
- Frontend details and customization notes: `logo_replacement_frontend/README.md`
- Environment and integration guide: `logo_replacement_frontend/ENVIRONMENT.md`

Dev servers:
- Frontend (CRA): http://localhost:3000
- Backend (FastAPI): http://localhost:3001 (proxy configured in package.json)

Notes:
- No changes to backend endpoints; the UI revamp preserves existing API integration.
- Colors/tokens are defined in `logo_replacement_frontend/src/App.css` under CSS variables for easy theming.
