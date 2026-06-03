import { useState, useEffect, useRef, useMemo } from 'react';
import { DeleteIcon } from './Icons';

const CONFIDENCE_COLOR = {
  high:   { dot: '#10b981', label: 'High',   bg: '#ecfdf5' },
  medium: { dot: '#f59e0b', label: 'Medium', bg: '#fffbeb' },
  low:    { dot: '#9ca3af', label: 'Low',    bg: '#f9fafb' },
};

function FixedSOWTemplates({ userRole }) {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showWizard, setShowWizard] = useState(false);

  const isAdmin = userRole === 'admin';

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      const r = await fetch('/api/fixed-templates', { credentials: 'include' });
      if (!r.ok) throw new Error('Failed to fetch templates');
      setTemplates(await r.json());
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Permanently delete "${name}"?\n\nThis cannot be undone. The .docx file will also be removed from the server.`)) return;
    try {
      const r = await fetch(`/api/fixed-templates/${id}`, { method: 'DELETE', credentials: 'include' });
      if (!r.ok) {
        const d = await r.json();
        throw new Error(d.error || 'Failed to delete');
      }
      const data = await r.json().catch(() => ({}));
      loadTemplates();

      // Offer to clean up placeholders that are now unused (and not built-in
      // defaults) as a result of removing this template.
      const orphans = data.orphanedPlaceholders || [];
      if (orphans.length > 0) {
        const list = orphans.map((o) => `• ${o.label} (${o.key})`).join('\n');
        const remove = window.confirm(
          `These placeholders are no longer used by any template:\n\n${list}\n\n` +
          `Remove them from the Placeholder Library too? (Built-in defaults are never removed.)`
        );
        if (remove) {
          await Promise.all(
            orphans.map((o) =>
              fetch(`/api/placeholder-definitions/${o.id}?force=true`, {
                method: 'DELETE',
                credentials: 'include',
              }).catch(() => null)
            )
          );
        }
      }
    } catch (e) {
      setError(e.message);
    }
  };

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
        <p>Loading Fixed SOW Templates...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="content-header">
        <h2>Fixed SOW Templates</h2>
        <p>
          Upload Word documents that should be reused as-is for each client, with only certain
          fields swapped out. The system detects replaceable text automatically based on the
          Placeholder Library.
        </p>
      </div>

      {!isAdmin && (
        <div className="alert alert-info">
          You have view-only access. Contact an administrator to upload new templates.
        </div>
      )}

      {error && <div className="alert alert-error">{error}</div>}

      <div className="card">
        <div className="card-header">
          <h3>Template Library</h3>
          {isAdmin && (
            <button className="btn btn-primary" onClick={() => setShowWizard(true)}>
              + Upload Template
            </button>
          )}
        </div>

        {templates.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📄</div>
            <p>No templates uploaded yet.</p>
            {isAdmin && <p>Click "Upload Template" to add your first one.</p>}
          </div>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Product</th>
                  <th>Engagement Type</th>
                  <th>Placeholders</th>
                  <th>Uploaded</th>
                  <th>By</th>
                  {isAdmin && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {templates.map((t) => (
                  <tr key={t.id}>
                    <td>
                      <div style={{ fontWeight: 500 }}>{t.name}</div>
                      {t.description && (
                        <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: 2 }}>
                          {t.description}
                        </div>
                      )}
                      <div style={{ fontSize: '0.7rem', color: '#9ca3af', marginTop: 2, fontFamily: 'monospace' }}>
                        {t.file_name}
                      </div>
                    </td>
                    <td>
                      {t.product_name ? (
                        <span className="badge badge-secondary">{t.product_name}</span>
                      ) : (
                        <span style={{ color: '#9ca3af' }}>—</span>
                      )}
                    </td>
                    <td>
                      {t.engagement_type_name ? (
                        <span className="badge badge-secondary">{t.engagement_type_name}</span>
                      ) : (
                        <span style={{ color: '#9ca3af' }}>—</span>
                      )}
                    </td>
                    <td>
                      <span style={{
                        background: '#eff6ff',
                        color: '#1e40af',
                        padding: '2px 10px',
                        borderRadius: 12,
                        fontWeight: 600,
                        fontSize: '0.8rem',
                      }}>
                        {t.placeholders.length}
                      </span>
                      {t.placeholders.length > 0 && (
                        <div style={{ fontSize: '0.7rem', color: '#6b7280', marginTop: 4, lineHeight: 1.4 }}>
                          {t.placeholders.slice(0, 4).map(p => p.key).join(' • ')}
                          {t.placeholders.length > 4 && ` +${t.placeholders.length - 4}`}
                        </div>
                      )}
                    </td>
                    <td style={{ fontSize: '0.85rem', color: '#6b7280' }}>
                      {new Date(t.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                    </td>
                    <td style={{ fontSize: '0.85rem' }}>{t.created_by_display_name || '—'}</td>
                    {isAdmin && (
                      <td>
                        <div className="icon-btn-group">
                          <button
                            className="icon-btn icon-btn-delete"
                            onClick={() => handleDelete(t.id, t.name)}
                            data-tooltip="Delete template"
                          ><DeleteIcon /></button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showWizard && isAdmin && (
        <UploadWizard
          onClose={() => setShowWizard(false)}
          onSuccess={() => {
            setShowWizard(false);
            loadTemplates();
          }}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Upload Wizard — 3-step flow
// ═══════════════════════════════════════════════════════════════════════════

function UploadWizard({ onClose, onSuccess }) {
  const [step, setStep] = useState(1);
  const [error, setError] = useState(null);

  // Step 1 state — file & metadata
  const [file, setFile] = useState(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [productId, setProductId] = useState('');
  const [engagementTypeId, setEngagementTypeId] = useState('');
  const [products, setProducts] = useState([]);
  const [engagementTypes, setEngagementTypes] = useState([]);

  // Step 2 state — scan results + per-row confirmations + custom additions
  const [scanning, setScanning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [scanResult, setScanResult] = useState(null);    // { detections, placeholder_library }
  const [confirmed, setConfirmed] = useState({});         // index -> bool
  const [customAdds, setCustomAdds] = useState([]);       // [{ key, found_text }]

  // Step 3 state
  const [savedTemplate, setSavedTemplate] = useState(null);

  useEffect(() => {
    // Load products + engagement types for the metadata dropdowns
    Promise.all([
      fetch('/api/products?filter=active', { credentials: 'include' }).then(r => r.json()),
      fetch('/api/engagement-types?filter=active', { credentials: 'include' }).then(r => r.json()),
    ])
      .then(([p, e]) => {
        setProducts(p || []);
        setEngagementTypes(e || []);
      })
      .catch(() => {/* non-critical */});
  }, []);

  // ── Step 1 → Step 2: scan the uploaded file ───────────────────────────────
  const handleScan = async (e) => {
    e?.preventDefault();
    if (!file) return setError('Please select a .docx file to upload');
    if (!name.trim()) return setError('Please enter a template name');

    setError(null);
    setScanning(true);

    try {
      const fd = new FormData();
      fd.append('file', file);
      const r = await fetch('/api/fixed-templates/scan', {
        method: 'POST',
        credentials: 'include',
        body: fd,
      });
      if (!r.ok) {
        const d = await r.json();
        throw new Error(d.error || 'Scan failed');
      }
      const data = await r.json();
      setScanResult(data);
      // Pre-confirm all high-confidence detections
      const initial = {};
      (data.detections || []).forEach((det, i) => {
        initial[i] = det.confidence === 'high' || det.confidence === 'medium';
      });
      setConfirmed(initial);
      setStep(2);
    } catch (err) {
      setError(err.message);
    } finally {
      setScanning(false);
    }
  };

  // ── Step 2 → Step 3: save with confirmed + custom mappings ────────────────
  const handleSave = async () => {
    setError(null);
    setSaving(true);

    try {
      // Build the final mappings array from confirmed detections + custom adds
      const detected = (scanResult?.detections || [])
        .map((det, i) => ({ ...det, _checked: !!confirmed[i] }))
        .filter(d => d._checked)
        .map(d => ({
          key: d.key,
          found_text: d.found_text,
          occurrences: d.occurrences,
        }));

      const customs = customAdds
        .filter(c => c.key && c.found_text)
        .map(c => ({ key: c.key, found_text: c.found_text, occurrences: 1 }));

      const mappings = [...detected, ...customs];

      const fd = new FormData();
      fd.append('file', file);
      fd.append('name', name.trim());
      if (description) fd.append('description', description.trim());
      if (productId) fd.append('product_id', productId);
      if (engagementTypeId) fd.append('engagement_type_id', engagementTypeId);
      fd.append('mappings', JSON.stringify(mappings));

      const r = await fetch('/api/fixed-templates', {
        method: 'POST',
        credentials: 'include',
        body: fd,
      });
      if (!r.ok) {
        const d = await r.json();
        throw new Error(d.error || 'Save failed');
      }
      const saved = await r.json();
      setSavedTemplate(saved);
      setStep(3);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const confirmedCount = useMemo(
    () => Object.values(confirmed).filter(Boolean).length + customAdds.filter(c => c.key && c.found_text).length,
    [confirmed, customAdds]
  );

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && step !== 2 && onClose()}>
      <div
        className="modal"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 820, width: '90vw', maxHeight: '90vh', overflow: 'auto' }}
      >
        <div className="modal-header">
          <h3>Upload Fixed SOW Template</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <StepIndicator step={step} />

        {error && <div className="alert alert-error" style={{ margin: '0 0 1rem' }}>{error}</div>}

        {/* ── STEP 1 ───────────────────────────────────────────────────── */}
        {step === 1 && (
          <form onSubmit={handleScan}>
            <FileDropZone file={file} onFile={setFile} />

            <div className="form-group" style={{ marginTop: '1rem' }}>
              <label>Template Name <span style={{ color: '#ef4444' }}>*</span></label>
              <input
                type="text"
                className="form-control"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Opal Upgrade — APAC Cloud"
                required
              />
            </div>

            <div className="form-group">
              <label>Description</label>
              <textarea
                className="form-control"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows="2"
                placeholder="Optional short description shown in the library list"
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div className="form-group">
                <label>Product</label>
                <select
                  className="form-control"
                  value={productId}
                  onChange={(e) => setProductId(e.target.value)}
                >
                  <option value="">— None —</option>
                  {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Engagement Type</label>
                <select
                  className="form-control"
                  value={engagementTypeId}
                  onChange={(e) => setEngagementTypeId(e.target.value)}
                >
                  <option value="">— None —</option>
                  {engagementTypes.map((et) => <option key={et.id} value={et.id}>{et.name}</option>)}
                </select>
              </div>
            </div>

            <div className="modal-footer">
              <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={scanning || !file || !name.trim()}>
                {scanning ? 'Scanning…' : 'Scan Document →'}
              </button>
            </div>
          </form>
        )}

        {/* ── STEP 2 ───────────────────────────────────────────────────── */}
        {step === 2 && scanResult && (
          <ConfirmationStep
            scanResult={scanResult}
            confirmed={confirmed}
            setConfirmed={setConfirmed}
            customAdds={customAdds}
            setCustomAdds={setCustomAdds}
            saving={saving}
            confirmedCount={confirmedCount}
            onBack={() => setStep(1)}
            onSave={handleSave}
          />
        )}

        {/* ── STEP 3 ───────────────────────────────────────────────────── */}
        {step === 3 && savedTemplate && (
          <SuccessStep
            template={savedTemplate}
            onAnother={() => {
              // Reset for another upload
              setStep(1);
              setFile(null);
              setName('');
              setDescription('');
              setProductId('');
              setEngagementTypeId('');
              setScanResult(null);
              setConfirmed({});
              setCustomAdds([]);
              setSavedTemplate(null);
              setError(null);
            }}
            onDone={onSuccess}
          />
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Step Indicator
// ═══════════════════════════════════════════════════════════════════════════

function StepIndicator({ step }) {
  const steps = [
    { n: 1, label: 'Upload & Configure' },
    { n: 2, label: 'Confirm Detections' },
    { n: 3, label: 'Done' },
  ];

  return (
    <div style={{
      display: 'flex',
      gap: 8,
      margin: '0.5rem 0 1.25rem',
      padding: '0.75rem',
      background: '#f9fafb',
      borderRadius: 8,
      alignItems: 'center',
    }}>
      {steps.map((s, i) => {
        const isActive = step === s.n;
        const isDone = step > s.n;
        return (
          <div key={s.n} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%',
              background: isDone ? '#10b981' : isActive ? '#2563eb' : '#e5e7eb',
              color: isDone || isActive ? '#fff' : '#6b7280',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 600, fontSize: '0.85rem',
              transition: 'all 0.2s',
              flexShrink: 0,
            }}>
              {isDone ? '✓' : s.n}
            </div>
            <span style={{
              marginLeft: 8,
              fontSize: '0.85rem',
              fontWeight: isActive ? 600 : 500,
              color: isActive ? '#111827' : isDone ? '#10b981' : '#9ca3af',
            }}>
              {s.label}
            </span>
            {i < steps.length - 1 && (
              <div style={{
                flex: 1,
                height: 2,
                background: step > s.n ? '#10b981' : '#e5e7eb',
                margin: '0 8px',
                transition: 'background 0.2s',
              }}/>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// File Drop Zone
// ═══════════════════════════════════════════════════════════════════════════

function FileDropZone({ file, onFile }) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef(null);

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f && f.name.toLowerCase().endsWith('.docx')) {
      onFile(f);
    }
  };

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      style={{
        border: `2px dashed ${dragging ? '#2563eb' : file ? '#10b981' : '#d1d5db'}`,
        background: dragging ? '#eff6ff' : file ? '#ecfdf5' : '#f9fafb',
        borderRadius: 8,
        padding: '1.5rem',
        cursor: 'pointer',
        textAlign: 'center',
        transition: 'all 0.2s',
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".docx"
        style={{ display: 'none' }}
        onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
      />
      {file ? (
        <>
          <div style={{ fontSize: '1.5rem', marginBottom: 4 }}>📄</div>
          <div style={{ fontWeight: 600, color: '#065f46' }}>{file.name}</div>
          <div style={{ fontSize: '0.75rem', color: '#047857', marginTop: 4 }}>
            {(file.size / 1024 / 1024).toFixed(2)} MB · Click or drop a different file to replace
          </div>
        </>
      ) : (
        <>
          <div style={{ fontSize: '1.5rem', marginBottom: 4 }}>⬆️</div>
          <div style={{ fontWeight: 500, color: '#374151' }}>
            Drop a Word document here, or click to browse
          </div>
          <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: 4 }}>
            Accepts .docx files up to 25MB
          </div>
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Confirmation step (the most complex piece)
// ═══════════════════════════════════════════════════════════════════════════

function ConfirmationStep({
  scanResult, confirmed, setConfirmed, customAdds, setCustomAdds,
  saving, confirmedCount, onBack, onSave,
}) {
  const detections = scanResult.detections || [];
  const library = scanResult.placeholder_library || [];

  const toggle = (i) => setConfirmed((prev) => ({ ...prev, [i]: !prev[i] }));

  const updateCustom = (idx, field, value) => {
    setCustomAdds((prev) => prev.map((c, i) => (i === idx ? { ...c, [field]: value } : c)));
  };

  const removeCustom = (idx) => {
    setCustomAdds((prev) => prev.filter((_, i) => i !== idx));
  };

  const addCustomRow = () => {
    setCustomAdds((prev) => [...prev, { key: '', found_text: '' }]);
  };

  // Keys already used by an active detection — disable in the custom dropdown
  // to prevent duplicates that would inject the same marker twice.
  const usedKeys = new Set(
    detections
      .filter((_, i) => confirmed[i])
      .map((d) => d.key)
      .concat(customAdds.map((c) => c.key).filter(Boolean))
  );

  const versionTablesCleared = scanResult.version_tables_cleared || 0;

  return (
    <>
      {/* ── Revision-history cleanup notice ───────────────────────────── */}
      {versionTablesCleared > 0 && (
        <div style={{
          padding: '0.7rem 0.9rem',
          background: '#ecfdf5',
          border: '1px solid #a7f3d0',
          borderRadius: 6,
          marginBottom: '0.9rem',
          fontSize: '0.82rem',
          color: '#065f46',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}>
          <span style={{ fontSize: '1rem' }}>🧹</span>
          <span>
            Cleared <strong>{versionTablesCleared}</strong> revision-history
            {versionTablesCleared === 1 ? ' table' : ' tables'} from this template
            so previous version entries won&apos;t carry into new SOWs. Headers were preserved.
          </span>
        </div>
      )}

      <p style={{ fontSize: '0.85rem', color: '#374151', marginBottom: '1rem' }}>
        We scanned <strong>{scanResult.file_name}</strong> and found{' '}
        <strong>{detections.length}</strong> potential placeholder{detections.length === 1 ? '' : 's'}.
        Confirm which ones to use, or add additional mappings below.
      </p>

      {/* ── Detected mappings ─────────────────────────────────────────── */}
      {detections.length === 0 ? (
        <div style={{
          padding: '1.5rem',
          background: '#fffbeb',
          border: '1px solid #fde68a',
          borderRadius: 8,
          textAlign: 'center',
          marginBottom: '1rem',
        }}>
          <div style={{ fontSize: '1.5rem', marginBottom: 4 }}>🤔</div>
          <div style={{ fontWeight: 500, color: '#78350f' }}>No placeholders detected automatically.</div>
          <div style={{ fontSize: '0.8rem', color: '#92400e', marginTop: 4 }}>
            You can still save the template by adding manual placeholders below,
            or click Back to ensure the document is the correct version.
          </div>
        </div>
      ) : (
        <div style={{
          border: '1px solid #e5e7eb',
          borderRadius: 8,
          overflow: 'hidden',
          marginBottom: '1rem',
        }}>
          {detections.map((det, i) => {
            const c = CONFIDENCE_COLOR[det.confidence] || CONFIDENCE_COLOR.low;
            const isChecked = !!confirmed[i];
            return (
              <label
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '0.75rem 1rem',
                  borderBottom: i < detections.length - 1 ? '1px solid #f3f4f6' : 'none',
                  cursor: 'pointer',
                  background: isChecked ? '#f9fafb' : '#fff',
                  transition: 'background 0.15s',
                }}
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => toggle(i)}
                  style={{ marginRight: 12, width: 16, height: 16, cursor: 'pointer' }}
                />
                <div style={{
                  width: 8, height: 8, borderRadius: '50%',
                  background: c.dot, marginRight: 10, flexShrink: 0,
                }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <code style={{
                      background: '#eef2ff',
                      color: '#3730a3',
                      padding: '2px 8px',
                      borderRadius: 4,
                      fontSize: '0.75rem',
                      fontWeight: 600,
                    }}>{det.key}</code>
                    <span style={{ fontSize: '0.8rem', color: '#6b7280' }}>{det.label}</span>
                  </div>
                  <div style={{
                    fontSize: '0.85rem',
                    color: '#111827',
                    marginTop: 4,
                    fontStyle: 'italic',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    "{det.found_text}"
                  </div>
                </div>
                <div style={{
                  fontSize: '0.7rem',
                  color: c.dot,
                  background: c.bg,
                  padding: '2px 8px',
                  borderRadius: 12,
                  fontWeight: 600,
                  marginLeft: 12,
                  flexShrink: 0,
                }}>
                  ×{det.occurrences} · {c.label}
                </div>
              </label>
            );
          })}
        </div>
      )}

      {/* ── Custom additions ─────────────────────────────────────────────── */}
      <div style={{
        background: '#fafafa',
        border: '1px solid #e5e7eb',
        borderRadius: 8,
        padding: '1rem',
        marginBottom: '1rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Add Custom Placeholders</div>
            <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
              For text the scanner missed — e.g. a short form of the client name, or a date variant.
            </div>
          </div>
          <button type="button" className="btn btn-small btn-outline" onClick={addCustomRow}>
            + Add Row
          </button>
        </div>

        {customAdds.length === 0 ? (
          <div style={{ fontSize: '0.75rem', color: '#9ca3af', textAlign: 'center', padding: '0.5rem' }}>
            No custom placeholders added.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {customAdds.map((c, idx) => (
              <div key={idx} style={{ display: 'grid', gridTemplateColumns: '230px 1fr auto', gap: 8, alignItems: 'center' }}>
                <select
                  className="form-control"
                  value={c.key}
                  onChange={(e) => updateCustom(idx, 'key', e.target.value)}
                  style={{ fontSize: '0.85rem' }}
                >
                  <option value="">— Select placeholder —</option>
                  {library.map((p) => (
                    <option key={p.key} value={p.key} disabled={usedKeys.has(p.key) && p.key !== c.key}>
                      {p.label} ({p.key})
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  className="form-control"
                  value={c.found_text}
                  onChange={(e) => updateCustom(idx, 'found_text', e.target.value)}
                  placeholder="Exact text to replace (copy-paste from the document)"
                  style={{ fontSize: '0.85rem' }}
                />
                <button
                  type="button"
                  onClick={() => removeCustom(idx)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#ef4444',
                    cursor: 'pointer',
                    fontSize: '1.2rem',
                    padding: '0 8px',
                  }}
                  title="Remove"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0.75rem 1rem',
        background: confirmedCount > 0 ? '#ecfdf5' : '#fffbeb',
        border: `1px solid ${confirmedCount > 0 ? '#a7f3d0' : '#fde68a'}`,
        borderRadius: 8,
        marginBottom: '1rem',
      }}>
        <div style={{ fontSize: '0.85rem', color: confirmedCount > 0 ? '#065f46' : '#78350f' }}>
          <strong>{confirmedCount}</strong> placeholder{confirmedCount === 1 ? '' : 's'} will be injected into the template.
        </div>
      </div>

      <div className="modal-footer">
        <button type="button" className="btn btn-outline" onClick={onBack} disabled={saving}>
          ← Back
        </button>
        <button
          type="button"
          className="btn btn-primary"
          onClick={onSave}
          disabled={saving || confirmedCount === 0}
        >
          {saving ? 'Saving…' : `Save Template (${confirmedCount})`}
        </button>
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Success step
// ═══════════════════════════════════════════════════════════════════════════

function SuccessStep({ template, onAnother, onDone }) {
  return (
    <>
      <div style={{
        textAlign: 'center',
        padding: '2rem 1rem 1rem',
      }}>
        <div style={{
          width: 64, height: 64,
          background: '#ecfdf5',
          borderRadius: '50%',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '2rem',
          marginBottom: '1rem',
        }}>
          ✅
        </div>
        <h3 style={{ margin: 0 }}>Template saved</h3>
        <p style={{ color: '#6b7280', marginTop: 4 }}>
          <strong>{template.name}</strong> is ready to use in the SOW Generator.
        </p>

        <div style={{
          background: '#f9fafb',
          border: '1px solid #e5e7eb',
          borderRadius: 8,
          padding: '1rem',
          marginTop: '1rem',
          textAlign: 'left',
          maxWidth: 500,
          margin: '1rem auto',
        }}>
          <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#6b7280', marginBottom: 6 }}>
            {template.placeholders.length} placeholder{template.placeholders.length === 1 ? '' : 's'} configured
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {template.placeholders.map((p) => (
              <code key={p.key} style={{
                background: '#eef2ff',
                color: '#3730a3',
                padding: '2px 8px',
                borderRadius: 4,
                fontSize: '0.75rem',
                fontWeight: 600,
              }}>
                {p.key}
              </code>
            ))}
          </div>
        </div>
      </div>

      <div className="modal-footer">
        <button type="button" className="btn btn-outline" onClick={onAnother}>
          Upload Another
        </button>
        <button type="button" className="btn btn-primary" onClick={onDone}>
          Done
        </button>
      </div>
    </>
  );
}

export default FixedSOWTemplates;
