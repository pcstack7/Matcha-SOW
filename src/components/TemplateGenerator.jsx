/**
 * TemplateGenerator — the "From Template" flow inside the SOW Generator page.
 *
 * Flow:
 *   1. Pick a fixed template (cards/dropdown)
 *   2. Pick an account (auto-populates data-source placeholders)
 *   3. Fill any remaining placeholders (smart fields based on input_type)
 *   4. Click Generate — backend returns a filled .docx as a download
 */

import { useEffect, useMemo, useState } from 'react';

function TemplateGenerator() {
  const [templates, setTemplates] = useState([]);
  const [definitions, setDefinitions] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);

  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [values, setValues] = useState({});
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // ── Initial data load ──────────────────────────────────────────────
  useEffect(() => {
    Promise.all([
      fetch('/api/fixed-templates', { credentials: 'include' }).then((r) => r.json()),
      fetch('/api/placeholder-definitions', { credentials: 'include' }).then((r) => r.json()),
      fetch('/api/accounts?filter=active', { credentials: 'include' }).then((r) => r.json()),
    ])
      .then(([t, d, a]) => {
        setTemplates(Array.isArray(t) ? t : []);
        setDefinitions(Array.isArray(d) ? d : []);
        setAccounts(Array.isArray(a) ? a : []);
      })
      .catch((e) => setError(e.message || 'Failed to load templates'))
      .finally(() => setLoading(false));
  }, []);

  // ── Derived data ───────────────────────────────────────────────────
  const selectedTemplate = useMemo(
    () => templates.find((t) => t.id === Number(selectedTemplateId)) || null,
    [templates, selectedTemplateId]
  );

  const selectedAccount = useMemo(
    () => accounts.find((a) => a.id === Number(selectedAccountId)) || null,
    [accounts, selectedAccountId]
  );

  // The set of placeholder keys actually present in this template,
  // joined with their full definition (input type, label, source, etc.)
  const templateFields = useMemo(() => {
    if (!selectedTemplate) return [];
    const keys = selectedTemplate.placeholders.map((p) => p.key);
    const defByKey = new Map(definitions.map((d) => [d.key, d]));

    return keys
      .map((key) => {
        const def = defByKey.get(key);
        if (!def) {
          // Custom placeholder not in the library — render as a generic text field
          return { key, label: key, input_type: 'text', data_source: null, description: '', sort_order: 999 };
        }
        return def;
      })
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  }, [selectedTemplate, definitions]);

  const fieldsRequiringInput = templateFields.filter(
    (f) => !f.data_source && f.input_type !== 'account'
  );

  // ── Account selection auto-fill ────────────────────────────────────
  useEffect(() => {
    if (!selectedAccount) return;
    const next = { ...values };
    for (const field of templateFields) {
      if (field.input_type === 'account') {
        next[field.key] = selectedAccount.name || '';
      } else if (field.data_source) {
        const [table, col] = field.data_source.split('.');
        if (table === 'accounts' && selectedAccount[col] != null) {
          next[field.key] = String(selectedAccount[col]);
        }
      }
    }
    setValues(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAccount, selectedTemplateId]);

  // Reset values when template changes
  useEffect(() => {
    setValues({});
    setSelectedAccountId('');
    setError(null);
    setSuccess(null);
  }, [selectedTemplateId]);

  // ── Field updates ──────────────────────────────────────────────────
  const setValue = (key) => (e) => {
    const v = e?.target?.type === 'date' ? formatHumanDate(e.target.value) : e.target.value;
    setValues((prev) => ({ ...prev, [key]: v }));
  };

  // ── Generate ───────────────────────────────────────────────────────
  const handleGenerate = async () => {
    if (!selectedTemplate) return;
    setGenerating(true);
    setError(null);
    setSuccess(null);

    try {
      const r = await fetch(`/api/fixed-templates/${selectedTemplate.id}/generate`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ placeholder_values: values }),
      });

      if (!r.ok) {
        const errPayload = await r.json().catch(() => ({}));
        throw new Error(errPayload.error || 'Generation failed');
      }

      // Stream the .docx to a download
      const blob = await r.blob();
      const cdHeader = r.headers.get('Content-Disposition') || '';
      const m = /filename="([^"]+)"/.exec(cdHeader);
      const fileName = m ? m[1] : `${selectedTemplate.name}.docx`;

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setSuccess(`Downloaded ${fileName}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
        <p>Loading templates...</p>
      </div>
    );
  }

  if (templates.length === 0) {
    return (
      <div className="card">
        <div className="empty-state">
          <div className="empty-state-icon">📄</div>
          <p>No Fixed SOW Templates have been uploaded yet.</p>
          <p style={{ fontSize: '0.85rem', color: '#6b7280' }}>
            Ask an administrator to upload a template via the "Fixed SOW Templates" page.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      {/* ── Template selector ───────────────────────────────────────── */}
      <div className="card">
        <div className="card-header">
          <h3>1. Choose a Template</h3>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.75rem' }}>
          {templates.map((t) => {
            const isSelected = Number(selectedTemplateId) === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setSelectedTemplateId(String(t.id))}
                style={{
                  textAlign: 'left',
                  background: isSelected ? '#eff6ff' : '#fff',
                  border: `2px solid ${isSelected ? '#2563eb' : '#e5e7eb'}`,
                  borderRadius: 8,
                  padding: '0.85rem 1rem',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  position: 'relative',
                }}
              >
                {isSelected && (
                  <div style={{
                    position: 'absolute', top: 8, right: 8,
                    width: 20, height: 20, borderRadius: '50%',
                    background: '#2563eb', color: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '0.7rem', fontWeight: 700,
                  }}>✓</div>
                )}
                <div style={{ fontWeight: 600, color: '#111827', paddingRight: 24 }}>{t.name}</div>
                {t.description && (
                  <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: 4, lineHeight: 1.4 }}>
                    {t.description}
                  </div>
                )}
                <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                  {t.product_name && (
                    <span className="badge badge-secondary" style={{ fontSize: '0.7rem' }}>
                      {t.product_name}
                    </span>
                  )}
                  {t.engagement_type_name && (
                    <span className="badge badge-secondary" style={{ fontSize: '0.7rem' }}>
                      {t.engagement_type_name}
                    </span>
                  )}
                  <span style={{
                    background: '#eff6ff', color: '#1e40af',
                    padding: '2px 8px', borderRadius: 10,
                    fontSize: '0.7rem', fontWeight: 600,
                  }}>
                    {t.placeholders.length} field{t.placeholders.length === 1 ? '' : 's'}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Account selector + dynamic field panel ─────────────────── */}
      {selectedTemplate && (
        <div className="card" style={{ marginTop: '1rem' }}>
          <div className="card-header">
            <h3>2. Fill in Details</h3>
          </div>

          {/* Account first — drives auto-fill */}
          <div className="form-group">
            <label>
              Account <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <select
              className="form-control"
              value={selectedAccountId}
              onChange={(e) => setSelectedAccountId(e.target.value)}
            >
              <option value="">Choose an account...</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}{a.short_name ? ` (${a.short_name})` : ''}
                </option>
              ))}
            </select>
            <small style={{ color: '#6b7280', fontSize: '0.75rem' }}>
              Account fields (short name, client number, country, sites) auto-fill from this selection.
            </small>
          </div>

          {selectedAccount && (
            <AutoFilledSummary account={selectedAccount} templateFields={templateFields} />
          )}

          {/* Manual entry fields — one per placeholder w/o data_source */}
          {fieldsRequiringInput.length > 0 && (
            <div style={{ marginTop: '1rem' }}>
              <p style={{
                fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase',
                letterSpacing: '0.06em', color: '#6b7280', marginBottom: '0.75rem',
              }}>
                Document Fields
              </p>
              <DynamicFieldPanel
                fields={fieldsRequiringInput}
                values={values}
                onChange={setValue}
              />
            </div>
          )}

          {/* Generate button */}
          <div className="modal-footer" style={{ marginTop: '1rem' }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleGenerate}
              disabled={!selectedAccount || generating}
              style={{ minWidth: 200 }}
            >
              {generating ? 'Generating…' : '⬇  Generate & Download .docx'}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Auto-fill summary — shows what was filled from the account record
// ═══════════════════════════════════════════════════════════════════════════

function AutoFilledSummary({ account, templateFields }) {
  const filled = templateFields
    .filter((f) => f.data_source || f.input_type === 'account')
    .map((f) => {
      const value = f.input_type === 'account'
        ? account.name
        : account[f.data_source?.split('.')[1] || ''];
      return { key: f.key, label: f.label, value };
    });

  if (filled.length === 0) return null;

  return (
    <div style={{
      background: '#f0fdf4',
      border: '1px solid #bbf7d0',
      borderRadius: 8,
      padding: '0.75rem 1rem',
      marginTop: '0.5rem',
    }}>
      <div style={{
        fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase',
        letterSpacing: '0.06em', color: '#15803d', marginBottom: 8,
      }}>
        ✨ Auto-filled from account
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 6 }}>
        {filled.map((f) => (
          <div key={f.key} style={{ fontSize: '0.8rem' }}>
            <span style={{ color: '#15803d', fontWeight: 500 }}>{f.label}: </span>
            <span style={{ color: '#111827' }}>
              {f.value || <em style={{ color: '#9ca3af' }}>(blank)</em>}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Dynamic field panel — renders the right input control per placeholder type
// ═══════════════════════════════════════════════════════════════════════════

function DynamicFieldPanel({ fields, values, onChange }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0.75rem' }}>
      {fields.map((f) => (
        <div key={f.key} className="form-group" style={{ marginBottom: 0 }}>
          <label>{f.label}</label>
          {renderInputForField(f, values[f.key] || '', onChange(f.key))}
          {f.description && (
            <small style={{ color: '#6b7280', fontSize: '0.7rem' }}>{f.description}</small>
          )}
        </div>
      ))}
    </div>
  );
}

function renderInputForField(field, value, onChange) {
  switch (field.input_type) {
    case 'number':
      return (
        <input
          type="number"
          className="form-control"
          value={value}
          onChange={onChange}
          placeholder={field.description || ''}
        />
      );

    case 'date':
      return (
        <input
          type="date"
          className="form-control"
          value={parseHumanDateForInput(value)}
          onChange={onChange}
        />
      );

    case 'dropdown': {
      const opts = Array.isArray(field.input_options) ? field.input_options : [];
      return (
        <select className="form-control" value={value} onChange={onChange}>
          <option value="">— Select —</option>
          {opts.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      );
    }

    case 'textarea':
      return (
        <textarea
          className="form-control"
          value={value}
          onChange={onChange}
          rows={3}
          placeholder={field.description || ''}
        />
      );

    case 'text':
    case 'account':
    default:
      return (
        <input
          type="text"
          className="form-control"
          value={value}
          onChange={onChange}
          placeholder={field.description || ''}
        />
      );
  }
}

// ── Date helpers ────────────────────────────────────────────────────────────
// Stored format: "23 February 2026" (what SOW docs naturally use)
// Input format: "2026-02-23" (the HTML5 date input)
function formatHumanDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  if (!y || !m || !d) return iso;
  return `${d} ${months[m - 1]} ${y}`;
}

function parseHumanDateForInput(humanDate) {
  if (!humanDate) return '';
  const months = { January:1,February:2,March:3,April:4,May:5,June:6,July:7,August:8,September:9,October:10,November:11,December:12 };
  const m = /^(\d{1,2})\s+(\w+)\s+(\d{4})$/.exec(humanDate);
  if (!m) return '';
  const [, d, mon, y] = m;
  const monthNum = months[mon];
  if (!monthNum) return '';
  return `${y}-${String(monthNum).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export default TemplateGenerator;
