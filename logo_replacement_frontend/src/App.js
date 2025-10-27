import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './App.css';

/**
 * PUBLIC_INTERFACE
 * App
 * Single-page UI to upload a drawings ZIP and a logo image, initiate processing, poll job status,
 * and download the processed ZIP with a refined Executive Gray theme and polished UX.
 *
 * Endpoints used (unchanged):
 * - POST /jobs
 * - POST /jobs/{job_id}/upload
 * - POST /jobs/{job_id}/start
 * - GET  /jobs/{job_id}/status
 * - GET  /jobs/{job_id}/download
 * - GET  /jobs/{job_id}/files
 * - GET  /jobs/{job_id}/files/{filename}
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

  // Result files (for on-screen preview/list)
  const [files, setFiles] = useState([]);
  const [filesError, setFilesError] = useState('');

  // Files to upload
  const [drawingsZip, setDrawingsZip] = useState(null);
  const [drawingsFiles, setDrawingsFiles] = useState([]);
  const [logoFile, setLogoFile] = useState(null);
  const [formError, setFormError] = useState('');

  // Drag-and-drop state
  const [isDragging, setIsDragging] = useState(false);

  // For stepbar active state
  const currentStep = useMemo(() => {
    if (!jobId) return 1;
    if (status === 'READY' || status === 'UPLOADING' || status === 'PENDING') return 2;
    if (status === 'RUNNING') return 2;
    if (status === 'COMPLETED') return 3;
    return 1;
  }, [jobId, status]);

  const pollingRef = useRef(null);
  const isRunning = useMemo(() => status === 'RUNNING', [status]);
  const isReadyToStart = useMemo(() => status === 'READY', [status]);
  const isCompleted = useMemo(() => status === 'COMPLETED', [status]);

  // API base URL resolution:
  const apiBase = useMemo(() => {
    const envCandidates = [
      process.env.REACT_APP_BACKEND_URL,
      process.env.REACT_APP_API_BASE
    ];
    const chosen = envCandidates.find(v => typeof v === 'string' && v.trim() !== '');
    if (chosen) return chosen.replace(/\/+$/, '');
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
    setFiles([]);
    setFilesError('');
  }, []);

  const resetAll = useCallback(() => {
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

  // PUBLIC_INTERFACE
  async function fetchProcessedFilesList(jid) {
    /**
     * Fetch list of processed files for the given job_id using GET /jobs/{job_id}/files.
     * Returns an array of { filename, size, content_type } or throws on error.
     */
    const url = `${apiBase}/jobs/${encodeURIComponent(jid)}/files`;
    const res = await fetch(url, { method: 'GET', headers: { Accept: 'application/json' } });
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      throw new Error(`Files list failed (${res.status}): ${txt || 'Unknown error'}`);
    }
    const data = await res.json();
    const items = Array.isArray(data.items) ? data.items : [];
    return items;
  }

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

    // Client-side validation
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
      form.append('logo_image', logoFile);
      if (hasZip) form.append('drawings_zip', drawingsZip);
      if (hasFiles) Array.from(drawingsFiles).forEach((f) => form.append('drawings_files', f));

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
    const intervalMs = 2500;
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
          try {
            const items = await fetchProcessedFilesList(jid);
            setFiles(items);
            setFilesError('');
          } catch (err) {
            setFiles([]);
            setFilesError(err.message || 'Failed to load processed files list.');
          }
        } else if (data.status === 'ERROR' || data.status === 'CANCELLED') {
          setErrorMsg(data.error || 'Job failed or cancelled.');
          clearInterval(pollingRef.current);
          pollingRef.current = null;
        }
      } catch (err) {
        setErrorMsg(err.message || 'Failed to fetch status.');
      }
    };
    tick();
    pollingRef.current = setInterval(tick, intervalMs);
  }, [apiBase]);

  useEffect(() => {
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
    setFiles([]);
    setFilesError('');
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

  // PUBLIC_INTERFACE
  const handleDownload = useCallback(async () => {
    /**
     * Download the processed ZIP by fetching as Blob, parsing Content-Disposition for filename,
     * and triggering browser download. Shows inline error toast on non-200.
     */
    if (!jobId) return;
    if (!isCompleted && !resultReady) {
      setErrorMsg('The job is not completed yet. Please wait until status is COMPLETED.');
      return;
    }

    setErrorMsg('');
    try {
      const url = `${apiBase}/jobs/${encodeURIComponent(jobId)}/download`;
      const res = await fetch(url, {
        method: 'GET',
        credentials: 'include'
      });

      if (!res.ok) {
        let errDetail = '';
        try { errDetail = await res.text(); } catch { /* ignore */ }
        const baseMsg = res.status === 409
          ? 'The job is not complete yet. Please wait until it reaches COMPLETED.'
          : 'Download request failed.';
        throw new Error(`Download failed (${res.status}): ${errDetail || baseMsg}`);
      }

      const cd = res.headers.get('Content-Disposition') || res.headers.get('content-disposition');
      let filename = `processed_${jobId}.zip`;
      if (cd) {
        const matchQuoted = cd.match(/filename\*=UTF-8''([^;]+)|filename="([^"]+)"|filename=([^;]+)/i);
        if (matchQuoted) {
          filename = decodeURIComponent(matchQuoted[1] || matchQuoted[2] || matchQuoted[3]).trim();
        }
      }

      const blob = await res.blob();
      const dlUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = dlUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(dlUrl);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to download result.');
      if (isCompleted || resultReady) {
        try {
          const items = await fetchProcessedFilesList(jobId);
          setFiles(items);
          setFilesError('');
        } catch (e) {
          setFilesError(e.message || 'Also failed to load per-file results.');
        }
      }
    }
  }, [apiBase, jobId, isCompleted, resultReady]);

  // Helpers for per-file actions
  const isPreviewableImage = useCallback((contentType = '', name = '') => {
    const ct = (contentType || '').toLowerCase();
       const nm = (name || '').toLowerCase();
    return ct.startsWith('image/') || /\.(png|jpg|jpeg|gif|tif|tiff|bmp)$/i.test(nm);
  }, []);

  const isPdf = useCallback((contentType = '', name = '') => {
    const ct = (contentType || '').toLowerCase();
    const nm = (name || '').toLowerCase();
    return ct === 'application/pdf' || /\.pdf$/i.test(nm);
  }, []);

  // PUBLIC_INTERFACE
  const handleOpenFile = useCallback((item) => {
    /**
     * Open file in a new tab using the file endpoint. Browser will render images and PDFs natively.
     */
    if (!jobId || !item?.filename) return;
    const url = `${apiBase}/jobs/${encodeURIComponent(jobId)}/files/${encodeURIComponent(item.filename)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }, [apiBase, jobId]);

  // PUBLIC_INTERFACE
  const handleDownloadFile = useCallback(async (item) => {
    /**
     * Download an individual processed file as blob and trigger browser save dialog.
     */
    if (!jobId || !item?.filename) return;
    try {
      const url = `${apiBase}/jobs/${encodeURIComponent(jobId)}/files/${encodeURIComponent(item.filename)}`;
      const res = await fetch(url, { method: 'GET', credentials: 'include' });
      if (!res.ok) {
        let detail = '';
        try { detail = await res.text(); } catch {}
        throw new Error(`File download failed (${res.status}): ${detail || 'Unknown error'}`);
      }
      const cd = res.headers.get('Content-Disposition') || res.headers.get('content-disposition');
      let filename = item.filename.split('/').pop();
      if (cd) {
        const matchQuoted = cd.match(/filename\*=UTF-8''([^;]+)|filename="([^"]+)"|filename=([^;]+)/i);
        if (matchQuoted) {
          filename = decodeURIComponent(matchQuoted[1] || matchQuoted[2] || matchQuoted[3]).trim();
        }
      }
      const blob = await res.blob();
      const dlUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = dlUrl;
      a.download = filename || 'download';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(dlUrl);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to download file.');
    }
  }, [apiBase, jobId]);

  // Accessibility helpers
  const drawingsZipInputId = 'drawings-zip-input';
  const drawingsFilesInputId = 'drawings-files-input';
  const logoInputId = 'logo-image-input';
  const progressId = 'job-progress';

  // Drag-and-drop handlers (for the main upload area)
  const onDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);
  const onDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);
  const onDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const dt = e.dataTransfer;
    if (!dt?.files?.length) return;
    const filesArr = Array.from(dt.files);

    const zipCandidate = filesArr.find(f => /\.zip$/i.test(f.name));
    const logoCandidate = filesArr.find(f => /\.(png|jpg|jpeg|gif|bmp|tif|tiff|pdf)$/i.test(f.name));

    if (zipCandidate) setDrawingsZip(zipCandidate);
    const others = filesArr.filter(f => !/\.zip$/i.test(f.name));
    if (others.length > 0) setDrawingsFiles(prev => [...prev, ...others]);
    if (logoCandidate) setLogoFile(logoCandidate);
  }, []);

  return (
    <div className="App">
      <header
        className="navbar"
        role="banner"
        aria-label="Application header"
      >
        <div className="navbar-left">
          <div className="brand-logo" aria-hidden="true">LR</div>
          <div className="brand-text">
            <h1 className="title">Logo Replacement</h1>
            <p className="subtitle">Engineering Drawings Automation</p>
          </div>

          {/* Compact step status bar */}
          <div className="stepbar" aria-label="Current step">
            <div className={`step ${currentStep === 1 ? 'active' : ''}`} aria-current={currentStep === 1 ? 'step' : undefined}>
              <span className={`dot ${currentStep >= 1 ? 'on' : ''}`} />
              <span>Upload</span>
            </div>
            <div className={`step ${currentStep === 2 ? 'active' : ''}`} aria-current={currentStep === 2 ? 'step' : undefined}>
              <span className={`dot ${currentStep >= 2 ? 'on' : ''}`} />
              <span>Process</span>
            </div>
            <div className={`step ${currentStep === 3 ? 'active' : ''}`} aria-current={currentStep === 3 ? 'step' : undefined}>
              <span className={`dot ${currentStep >= 3 ? 'on' : ''}`} />
              <span>Results</span>
            </div>
          </div>
        </div>
        <div className="navbar-right" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
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
        <section className="card" aria-labelledby="upload-section-title" style={{ animationDelay: '0.05s' }}>
          <h2 id="upload-section-title" className="section-title">1. Upload</h2>
          <p className="description">
            Drag-and-drop your drawings ZIP and select a logo image below, or use the file pickers. Then upload to prepare processing.
          </p>

          {/* Drag-and-drop zone */}
          <div
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            role="button"
            tabIndex={0}
            aria-label="Drag and drop files here"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                const el = document.getElementById(drawingsZipInputId);
                if (el) el.focus();
              }
            }}
            style={{
              border: `2px dashed ${isDragging ? 'var(--primary)' : 'var(--border)'}`,
              background: isDragging
                ? 'linear-gradient(180deg, rgba(55,65,81,0.08), rgba(156,163,175,0.08)), var(--surface)'
                : 'var(--surface)',
              color: 'var(--text-muted)',
              borderRadius: 12,
              padding: 24,
              textAlign: 'center',
              transition: 'all .2s ease',
              outline: 'none',
              boxShadow: isDragging ? 'var(--shadow)' : 'none'
            }}
          >
            <div style={{ fontSize: 42, marginBottom: 8 }}>⬆️</div>
            <div style={{ fontWeight: 800, color: 'var(--primary)' }}>Drag & Drop Files</div>
            <div style={{ fontSize: 12, marginTop: 6 }}>
              Drop a ZIP of drawings and an image for your logo. PDFs and images are supported.
            </div>
            <div style={{ marginTop: 10 }}>
              {drawingsZip && <span className="file-pill">ZIP: {drawingsZip.name}</span>}
              {logoFile && <span className="file-pill" style={{ marginLeft: 8 }}>Logo: {logoFile.name}</span>}
              {Array.isArray(drawingsFiles) && drawingsFiles.length > 0 && (
                <span className="file-pill" style={{ marginLeft: 8 }}>
                  {drawingsFiles.length} individual file(s)
                </span>
              )}
            </div>
          </div>

          <form className="form-grid" onSubmit={handleCreateAndUpload} noValidate style={{ marginTop: 16 }}>
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

            <div className="form-control" style={{ gridColumn: '1 / -1' }}>
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

            <div className="actions" style={{ gridColumn: '1 / -1' }}>
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
              <span className="meta-label">Selected:</span>
              <span className="meta-value">
                {drawingsZip ? `ZIP: ${drawingsZip.name}` : 'No ZIP'} • {logoFile ? `Logo: ${logoFile.name}` : 'No Logo'}
              </span>
            </div>
          </div>
        </section>

        <section className="card" aria-labelledby="process-section-title" style={{ animationDelay: '0.1s' }}>
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

          {/* Animated progress */}
          <div className="progress-wrapper" aria-live="polite" aria-atomic="true">
            <div className="progress-labels">
              <span>Progress</span>
              <span>{progress}%</span>
            </div>
            <div
              className="progress-bar"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progress}
              aria-describedby={progressId}
              style={{ position: 'relative' }}
            >
              <div
                className="progress-fill"
                style={{
                  width: `${Math.min(Math.max(progress, 0), 100)}%`,
                  position: 'relative'
                }}
              />
              {/* subtle animated shimmer when running */}
              {isRunning && (
                <div
                  aria-hidden="true"
                  style={{
                    position: 'absolute',
                    top: 0,
                    bottom: 0,
                    width: '30%',
                    left: 0,
                    background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.35), transparent)',
                    animation: 'shimmer 1.2s infinite',
                    mixBlendMode: 'overlay',
                    borderRadius: 999
                  }}
                />
              )}
            </div>
            <style>
              {`@keyframes shimmer {
                0% { transform: translateX(0%); }
                100% { transform: translateX(250%); }
              }`}
            </style>
            <div id={progressId} className="sr-only">{progress}%</div>
            <div className="status-hint">
              {isRunning && 'Processing drawings...'}
              {isCompleted && 'Processing completed.'}
              {status === 'READY' && 'Ready to start processing.'}
            </div>
          </div>
        </section>

        <section className="card" aria-labelledby="download-section-title" style={{ animationDelay: '0.15s' }}>
          <h2 id="download-section-title" className="section-title">3. Download & Results</h2>
          <p className="description">
            After completion, download the ZIP or browse individual output files below.
          </p>

          <div className="actions">
            <button
              className="btn btn-primary"
              type="button"
              onClick={handleDownload}
              disabled={!jobId || !isCompleted}
              aria-disabled={!jobId || !isCompleted}
            >
              Download Result ZIP
            </button>
          </div>

          {/* Results Gallery/List */}
          {isCompleted && (
            <div style={{ marginTop: 16 }}>
              <h3 className="section-title" style={{ marginBottom: 8 }}>Results</h3>
              {filesError && (
                <div className="alert alert-error" role="alert" style={{ marginBottom: 12 }}>
                  {filesError}
                </div>
              )}
              {Array.isArray(files) && files.length > 0 ? (
                <div className="results-grid">
                  {files.map((item, idx) => {
                    const name = item.filename || `file-${idx}`;
                    const contentType = item.content_type || '';
                    const fileUrl = `${apiBase}/jobs/${encodeURIComponent(jobId)}/files/${encodeURIComponent(name)}`;

                    return (
                      <div key={`${name}-${idx}`} className="card results-card">
                        <div className="results-preview">
                          {isPreviewableImage(contentType, name) ? (
                            <img
                              src={fileUrl}
                              alt={name}
                              style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
                            />
                          ) : isPdf(contentType, name) ? (
                            <div style={{ textAlign: 'center', color: 'var(--primary)', padding: 12 }}>
                              <div style={{ fontSize: 48, lineHeight: 1 }}>📄</div>
                              <div style={{ fontSize: 12, marginTop: 4 }}>PDF</div>
                            </div>
                          ) : (
                            <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 12 }}>
                              <div style={{ fontSize: 36, lineHeight: 1 }}>🗂️</div>
                              <div style={{ fontSize: 12, marginTop: 4 }}>No preview</div>
                            </div>
                          )}
                        </div>

                        <div style={{ marginBottom: 8, color: 'var(--primary)', fontWeight: 600, fontSize: 13, wordBreak: 'break-all' }}>
                          {name}
                        </div>

                        <div className="actions">
                          <button
                            className="btn btn-secondary"
                            type="button"
                            onClick={() => handleOpenFile(item)}
                          >
                            Open
                          </button>
                          <button
                            className="btn btn-primary"
                            type="button"
                            onClick={() => handleDownloadFile(item)}
                          >
                            Download
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="empty-state">
                  <div className="empty-illustration" aria-hidden="true">🖼️</div>
                  <div className="caption">No files listed yet. Once processing completes, results will appear here.</div>
                </div>
              )}
            </div>
          )}
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

        <section className="card info-card" aria-labelledby="help-title" style={{ animationDelay: '0.2s' }}>
          <h2 id="help-title" className="section-title">Notes</h2>
          <ul className="notes-list">
            <li>Polling interval is approximately 2.5 seconds.</li>
            <li>If the API is hosted on a different origin, set REACT_APP_BACKEND_URL or REACT_APP_API_BASE in your environment.</li>
            <li>Ensure your drawings ZIP is not corrupted and that the logo is a supported image format.</li>
            <li>For cross-origin downloads, backend must expose header: Access-Control-Expose-Headers: Content-Disposition.</li>
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
