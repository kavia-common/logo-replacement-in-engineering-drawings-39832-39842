import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './App.css';

/**
 * PUBLIC_INTERFACE
 * App
 * Single-page UI to upload a drawings ZIP and a logo image, initiate processing, poll job status,
 * and download the processed ZIP. Uses backend endpoints:
 * - POST /jobs
 * - POST /jobs/{job_id}/upload
 * - POST /jobs/{job_id}/start
 * - GET  /jobs/{job_id}/status (polled every 2-3s)
 * - GET  /jobs/{job_id}/download
 */
function App() {
  // Theme handling (Executive Gray default)
  const [theme, setTheme] = useState('light');

  // Job state
  const [jobId, setJobId] = useState('');
  const [status, setStatus] = useState('');
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [resultReady, setResultReady] = useState(false);

  // Files
  // drawingsZip: single optional ZIP file
  const [drawingsZip, setDrawingsZip] = useState(null);
  // drawingsFiles: optional multiple individual files (PNG/JPG/JPEG/TIFF/BMP/GIF/PDF)
  const [drawingsFiles, setDrawingsFiles] = useState([]);
  // logoFile: required single file
  const [logoFile, setLogoFile] = useState(null);
  // Inline validation error for form submission
  const [formError, setFormError] = useState('');

  const pollingRef = useRef(null);
  const isRunning = useMemo(() => status === 'RUNNING', [status]);
  const isReadyToStart = useMemo(() => status === 'READY', [status]);
  const isCompleted = useMemo(() => status === 'COMPLETED', [status]);

  // API base URL resolution:
  // 1) REACT_APP_BACKEND_URL (preferred)
  // 2) REACT_APP_API_BASE (legacy support)
  // 3) Same-origin ('') which allows CRA proxy or reverse proxy in production
  const apiBase = useMemo(() => {
    const envCandidates = [
      process.env.REACT_APP_BACKEND_URL,
      process.env.REACT_APP_API_BASE
    ];
    const chosen = envCandidates.find(v => typeof v === 'string' && v.trim() !== '');
    if (chosen) return chosen.replace(/\/+$/, '');
    // Fallback: same-origin so relative paths work with CRA proxy or reverse proxy
    return '';
  }, []);

  // Apply theme to document
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  }, []);

  const clearStatus = useCallback(() => {
    setStatus('');
    setProgress(0);
    setMessage('');
    setErrorMsg('');
    setResultReady(false);
  }, []);

  const resetAll = useCallback(() => {
    // Stop polling if any
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    setJobId('');
    clearStatus();
    setDrawingsZip(null);
    setDrawingsFiles([]);
    setLogoFile(null);
    setFormError('');
  }, [clearStatus]);

  const createJob = useCallback(async () => {
    setErrorMsg('');
    setMessage('Creating job...');
    try {
      const res = await fetch(`${apiBase}/jobs`, {
        method: 'POST',
        headers: { 'Accept': 'application/json' }
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`Create job failed (${res.status}): ${txt || 'Unknown error'}`);
      }
      const data = await res.json();
      setJobId(data.job_id);
      setStatus(data.status || 'PENDING');
      setMessage('Job created. Ready to upload files.');
      return data.job_id;
    } catch (err) {
      setErrorMsg(err.message || 'Failed to create job.');
      setMessage('');
      return null;
    }
  }, [apiBase]);

  const uploadFiles = useCallback(async (jid) => {
    if (!jid) return false;

    // Client-side validation:
    // - logo image is required
    // - at least one drawings input: either a ZIP or one/more individual files
    if (!logoFile) {
      const msg = 'Please select a logo image before uploading.';
      setFormError(msg);
      setErrorMsg(msg);
      return false;
    }
    const hasZip = !!drawingsZip;
    const hasFiles = Array.isArray(drawingsFiles) ? drawingsFiles.length > 0 : (drawingsFiles && drawingsFiles.length > 0);
    if (!hasZip && !hasFiles) {
      const msg = 'Please add drawings: either a ZIP or one or more individual files.';
      setFormError(msg);
      setErrorMsg(msg);
      return false;
    }

    setFormError('');
    setErrorMsg('');
    setMessage('Uploading files...');
    setStatus('UPLOADING');
    try {
      const form = new FormData();

      // Append required logo under exact field name 'logo_image'
      form.append('logo_image', logoFile);

      // Optional drawings_zip (single)
      if (hasZip) {
        form.append('drawings_zip', drawingsZip);
      }

      // Optional drawings_files (multiple) - append each file with the same key
      if (hasFiles) {
        const filesArr = Array.from(drawingsFiles);
        filesArr.forEach((f) => {
          form.append('drawings_files', f);
        });
      }

      const res = await fetch(`${apiBase}/jobs/${encodeURIComponent(jid)}/upload`, {
        method: 'POST',
        body: form
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`Upload failed (${res.status}): ${txt || 'Unknown error'}`);
      }
      const data = await res.json();
      setStatus(data.status || 'READY');
      setProgress(typeof data.progress === 'number' ? data.progress : 0);
      setMessage(data.message || 'Upload successful. Ready to start processing.');
      return true;
    } catch (err) {
      setErrorMsg(err.message || 'Failed to upload files.');
      setStatus('ERROR');
      setMessage('');
      return false;
    }
  }, [apiBase, drawingsZip, drawingsFiles, logoFile]);

  const startProcessing = useCallback(async (jid) => {
    if (!jid) return false;
    setErrorMsg('');
    setMessage('Starting processing...');
    try {
      const res = await fetch(`${apiBase}/jobs/${encodeURIComponent(jid)}/start`, {
        method: 'POST',
        headers: { 'Accept': 'application/json' }
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`Start failed (${res.status}): ${txt || 'Unknown error'}`);
      }
      const data = await res.json();
      setStatus(data.status || 'RUNNING');
      setProgress(typeof data.progress === 'number' ? data.progress : 0);
      setMessage(data.message || 'Processing started.');
      return true;
    } catch (err) {
      setErrorMsg(err.message || 'Failed to start processing.');
      setMessage('');
      return false;
    }
  }, [apiBase]);

  const pollStatus = useCallback((jid) => {
    if (!jid) return;
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    const intervalMs = 2500; // 2.5 seconds
    const tick = async () => {
      try {
        const res = await fetch(`${apiBase}/jobs/${encodeURIComponent(jid)}/status`, {
          method: 'GET',
          headers: { 'Accept': 'application/json' }
        });
        if (!res.ok) {
          const txt = await res.text();
          throw new Error(`Status failed (${res.status}): ${txt || 'Unknown error'}`);
        }
        const data = await res.json();
        setStatus(data.status || '');
        setProgress(typeof data.progress === 'number' ? data.progress : 0);
        setMessage(data.message || '');
        if (data.status === 'COMPLETED') {
          setResultReady(true);
          clearInterval(pollingRef.current);
          pollingRef.current = null;
        } else if (data.status === 'ERROR' || data.status === 'CANCELLED') {
          setErrorMsg(data.error || 'Job failed or cancelled.');
          clearInterval(pollingRef.current);
          pollingRef.current = null;
        }
      } catch (err) {
        setErrorMsg(err.message || 'Failed to fetch status.');
        // Keep polling, transient errors may resolve; stop if too many errors? Keep simple here.
      }
    };
    // immediate call then interval
    tick();
    pollingRef.current = setInterval(tick, intervalMs);
  }, [apiBase]);

  useEffect(() => {
    // Cleanup polling when unmounting
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, []);

  const handleCreateAndUpload = useCallback(async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setResultReady(false);
    setProgress(0);
    setMessage('');
    setStatus('PENDING');

    const jid = await createJob();
    if (!jid) return;

    const ok = await uploadFiles(jid);
    if (!ok) return;

    setMessage('Files uploaded. You can start processing when ready.');
  }, [createJob, uploadFiles]);

  const handleStart = useCallback(async () => {
    if (!jobId) return;
    const ok = await startProcessing(jobId);
    if (ok) pollStatus(jobId);
  }, [jobId, pollStatus, startProcessing]);

  const handleDownload = useCallback(async () => {
    if (!jobId) return;
    setErrorMsg('');
    try {
      const url = `${apiBase}/jobs/${encodeURIComponent(jobId)}/download`;
      // Trigger browser download
      const res = await fetch(url, { method: 'GET' });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`Download failed (${res.status}): ${txt || 'Unknown error'}`);
      }
      const blob = await res.blob();
      const dlUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = dlUrl;
      a.download = `processed_${jobId}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(dlUrl);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to download result.');
    }
  }, [apiBase, jobId]);

  // Accessibility helpers
  const drawingsZipInputId = 'drawings-zip-input';
  const drawingsFilesInputId = 'drawings-files-input';
  const logoInputId = 'logo-image-input';
  const progressId = 'job-progress';

  return (
    <div className="App">
      <header className="navbar" role="banner" aria-label="Application header">
        <div className="navbar-left">
          <div className="brand-logo" aria-hidden="true">LR</div>
          <div className="brand-text">
            <h1 className="title">Logo Replacement</h1>
            <p className="subtitle">Engineering Drawings Automation</p>
          </div>
        </div>
        <div className="navbar-right">
          <button
            className="btn theme-toggle"
            onClick={toggleTheme}
            aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
            type="button"
          >
            {theme === 'light' ? 'Dark mode' : 'Light mode'}
          </button>
        </div>
      </header>

      <main className="container" role="main">
        <section className="card" aria-labelledby="upload-section-title">
          <h2 id="upload-section-title" className="section-title">1. Upload</h2>
          <p className="description">
            Upload a ZIP containing your drawings and the new logo image. After upload, start processing and monitor progress.
          </p>

          <form className="form-grid" onSubmit={handleCreateAndUpload} noValidate>
            <div className="form-control">
              <label htmlFor={drawingsZipInputId} className="label">
                Drawings ZIP (optional)
              </label>
              <input
                id={drawingsZipInputId}
                name="drawings_zip"
                type="file"
                accept=".zip,application/zip"
                onChange={(e) => setDrawingsZip(e.target.files && e.target.files[0] ? e.target.files[0] : null)}
                aria-describedby="drawings-zip-help"
              />
              <div id="drawings-zip-help" className="help-text">
                Upload a ZIP containing drawings (images/PDFs). Alternatively, add individual files below.
              </div>
              {drawingsZip && (
                <div className="file-pill" aria-live="polite">
                  {drawingsZip.name}
                </div>
              )}
            </div>

            <div className="form-control">
              <label htmlFor={drawingsFilesInputId} className="label">
                Individual Drawings (optional, multiple)
              </label>
              <input
                id={drawingsFilesInputId}
                name="drawings_files"
                type="file"
                multiple
                accept=".pdf,application/pdf,image/png,image/jpeg,image/jpg,image/gif,image/tiff,image/bmp"
                onChange={(e) => setDrawingsFiles(e.target.files ? Array.from(e.target.files) : [])}
                aria-describedby="drawings-files-help"
              />
              <div id="drawings-files-help" className="help-text">
                Add one or more files (PDF, PNG, JPG/JPEG, TIFF, BMP, GIF). You may use this or the ZIP above.
              </div>
              {Array.isArray(drawingsFiles) && drawingsFiles.length > 0 && (
                <div className="file-pill" aria-live="polite">
                  {drawingsFiles.length} file(s) selected
                </div>
              )}
            </div>

            <div className="form-control">
              <label htmlFor={logoInputId} className="label">
                Logo Image (required)
              </label>
              <input
                id={logoInputId}
                name="logo_image"
                type="file"
                accept=".png,.jpg,.jpeg,.gif,.bmp,.tif,.tiff,image/*,.pdf,application/pdf"
                onChange={(e) => setLogoFile(e.target.files && e.target.files[0] ? e.target.files[0] : null)}
                aria-describedby="logo-help"
                required
              />
              <div id="logo-help" className="help-text">
                Select the logo image to overlay (common image types or PDF supported by backend).
              </div>
              {logoFile && (
                <div className="file-pill" aria-live="polite">
                  {logoFile.name}
                </div>
              )}
            </div>

            {formError && (
              <div className="alert alert-error" role="alert" style={{ gridColumn: '1 / -1' }}>
                {formError}
              </div>
            )}

            <div className="actions">
              <button
                className="btn btn-primary"
                type="submit"
                disabled={(!drawingsZip && (!drawingsFiles || drawingsFiles.length === 0)) || !logoFile || Boolean(jobId && status && status !== 'PENDING' && status !== '')}
                aria-disabled={(!drawingsZip && (!drawingsFiles || drawingsFiles.length === 0)) || !logoFile}
              >
                Create Job & Upload
              </button>
              <button
                className="btn btn-secondary"
                type="button"
                onClick={resetAll}
                disabled={!drawingsZip && (!drawingsFiles || drawingsFiles.length === 0) && !logoFile && !jobId}
              >
                Reset
              </button>
            </div>
          </form>

          <div className="meta">
            <div className="meta-row">
              <span className="meta-label">Job ID:</span>
              <span className="meta-value">{jobId || '—'}</span>
            </div>
            <div className="meta-row">
              <span className="meta-label">Status:</span>
              <span className={`meta-badge status-${status ? status.toLowerCase() : 'none'}`}>
                {status || '—'}
              </span>
            </div>
            <div className="meta-row">
              <span className="meta-label">Message:</span>
              <span className="meta-value">{message || '—'}</span>
            </div>
            <div className="meta-row">
              <span className="meta-label">Upload Keys:</span>
              <span className="meta-value">logo_image, drawings_zip (optional), drawings_files (optional, multiple)</span>
            </div>
          </div>
        </section>

        <section className="card" aria-labelledby="process-section-title">
          <h2 id="process-section-title" className="section-title">2. Process</h2>
          <p className="description">
            Start background processing once files have been uploaded. The status will be polled automatically.
          </p>

          <div className="actions">
            <button
              className="btn btn-success"
              type="button"
              onClick={handleStart}
              disabled={!jobId || !isReadyToStart}
              aria-disabled={!jobId || !isReadyToStart}
            >
              Start Processing
            </button>
          </div>

          <div className="progress-wrapper" aria-live="polite" aria-atomic="true">
            <div className="progress-labels">
              <span>Progress</span>
              <span>{progress}%</span>
            </div>
            <div className="progress-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} aria-describedby={progressId}>
              <div className="progress-fill" style={{ width: `${Math.min(Math.max(progress, 0), 100)}%` }} />
            </div>
            <div id={progressId} className="sr-only">{progress}%</div>
            <div className="status-hint">
              {isRunning && 'Processing drawings...'}
              {isCompleted && 'Processing completed.'}
              {status === 'READY' && 'Ready to start processing.'}
            </div>
          </div>
        </section>

        <section className="card" aria-labelledby="download-section-title">
          <h2 id="download-section-title" className="section-title">3. Download</h2>
          <p className="description">
            Download the processed ZIP once the job is completed.
          </p>

          <div className="actions">
            <button
              className="btn btn-primary"
              type="button"
              onClick={handleDownload}
              disabled={!jobId || !resultReady}
              aria-disabled={!jobId || !resultReady}
            >
              Download Result ZIP
            </button>
          </div>
        </section>

        {(errorMsg || message) && (
          <section className="alerts" aria-live="polite" aria-atomic="true">
            {errorMsg && (
              <div className="alert alert-error" role="alert">
                {errorMsg}
              </div>
            )}
            {message && !errorMsg && (
              <div className="alert alert-info" role="status">
                {message}
              </div>
            )}
          </section>
        )}

        <section className="card info-card" aria-labelledby="help-title">
          <h2 id="help-title" className="section-title">Notes</h2>
          <ul className="notes-list">
            <li>Polling interval is approximately 2.5 seconds.</li>
            <li>If the API is hosted on a different origin, set REACT_APP_API_BASE in your environment.</li>
            <li>Ensure your drawings ZIP is not corrupted and that the logo is a supported image format.</li>
          </ul>
        </section>
      </main>

      <footer className="footer" role="contentinfo">
        <div className="footer-content">
          <span>© {new Date().getFullYear()} Logo Replacement Demo</span>
        </div>
      </footer>
    </div>
  );
}

export default App;
