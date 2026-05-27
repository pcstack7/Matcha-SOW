import { useState, useEffect, useMemo } from 'react';

const INPUT_TYPES = [
  { value: 'text',     label: 'Text input',     hint: 'Single-line free text' },
  { value: 'textarea', label: 'Multi-line text', hint: 'For longer descriptions like payment terms' },
  { value: 'number',   label: 'Number',         hint: 'Numeric input (e.g. fee amount, # of facilities)' },
  { value: 'date',     label: 'Date picker',    hint: 'Calendar widget for dates' },
  { value: 'dropdown', label: 'Dropdown',       hint: 'Pick from a fixed list of options (e.g. currency)' },
  { value: 'account',  label: 'Account picker', hint: 'Dropdown of all active accounts (use for CLIENT_FULL_NAME)' },
];

const DATA_SOURCE_OPTIONS = [
  { value: '',                       label: '— Manual entry (no auto-fill) —' },
  { value: 'accounts.name',          label: 'Account: Name' },
  { value: 'accounts.short_name',    label: 'Account: Short Name' },
  { value: 'accounts.client_number', label: 'Account: Client Number' },
  { value: 'accounts.country',       label: 'Account: Country' },
  { value: 'accounts.sites',         label: 'Account: Sites' },
];

const EMPTY_FORM = {
  key: '',
  label: '',
  description: '',
  input_type: 'text',
  data_source: '',
  input_options: '',   // comma-separated in UI, sent as array
  detect_regex: '',    // newline-separated in UI, sent as array
  sort_order: 0,
};

function PlaceholderLibrary({ userRole }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('active');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [formData, setFormData] = useState(EMPTY_FORM);

  const isAdmin = userRole === 'admin';

  useEffect(() => {
    loadItems();
  }, [filter]);

  const loadItems = async () => {
    try {
      setLoading(true);
      const includeInactive = filter !== 'active';
      const response = await fetch(`/api/placeholder-definitions?includeInactive=${includeInactive}`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch placeholder definitions');
      let data = await response.json();
      if (filter === 'inactive') data = data.filter((p) => !p.is_active);
      setItems(data);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (item = null) => {
    if (item) {
      setEditing(item);
      setFormData({
        key: item.key,
        label: item.label || '',
        description: item.description || '',
        input_type: item.input_type || 'text',
        data_source: item.data_source || '',
        input_options: Array.isArray(item.input_options) ? item.input_options.join(', ') : '',
        detect_regex: Array.isArray(item.detect_regex) ? item.detect_regex.join('\n') : '',
        sort_order: item.sort_order || 0,
      });
    } else {
      setEditing(null);
      const nextOrder = items.length > 0 ? Math.max(...items.map((i) => i.sort_order || 0)) + 1 : 1;
      setFormData({ ...EMPTY_FORM, sort_order: nextOrder });
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditing(null);
    setFormData(EMPTY_FORM);
  };

  const handleChange = (field) => (e) => {
    const value = e.target.value;
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const payload = {
      key: formData.key,
      label: formData.label,
      description: formData.description || null,
      input_type: formData.input_type,
      data_source: formData.data_source || null,
      input_options: formData.input_options
        ? formData.input_options.split(',').map((s) => s.trim()).filter(Boolean)
        : [],
      detect_regex: formData.detect_regex
        ? formData.detect_regex.split('\n').map((s) => s.trim()).filter(Boolean)
        : [],
      sort_order: Number(formData.sort_order) || 0,
    };

    try {
      const url = editing
        ? `/api/placeholder-definitions/${editing.id}`
        : '/api/placeholder-definitions';
      const method = editing ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save placeholder');
      }
      loadItems();
      handleCloseModal();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDeactivate = async (id) => {
    if (!window.confirm('Deactivate this placeholder? Existing templates that reference it will continue to work, but it will no longer be auto-detected in new uploads.')) return;
    try {
      const response = await fetch(`/api/placeholder-definitions/${id}/deactivate`, {
        method: 'PATCH',
        credentials: 'include',
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to deactivate');
      }
      loadItems();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleReactivate = async (id) => {
    try {
      const response = await fetch(`/api/placeholder-definitions/${id}/reactivate`, {
        method: 'PATCH',
        credentials: 'include',
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to reactivate');
      }
      loadItems();
    } catch (err) {
      setError(err.message);
    }
  };

  const typeLabel = (type) => {
    const t = INPUT_TYPES.find((it) => it.value === type);
    return t ? t.label : type;
  };

  const stats = useMemo(
    () => ({
      total: items.length,
      autoFilled: items.filter((i) => i.data_source).length,
      manual: items.filter((i) => !i.data_source).length,
    }),
    [items]
  );

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
        <p>Loading placeholder library...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="content-header">
        <h2>Placeholder Library</h2>
        <p>
          Define the catalog of replaceable fields used across Fixed SOW Templates. Each entry controls how a placeholder is detected during template upload and how its value is captured at generation time.
        </p>
      </div>

      {!isAdmin && (
        <div className="alert alert-info">
          You have view-only access. Contact an administrator to modify the placeholder library.
        </div>
      )}

      {error && <div className="alert alert-error">{error}</div>}

      {/* ── Stats strip ───────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', marginBottom: '1rem' }}>
        <StatCard label="Total placeholders" value={stats.total} />
        <StatCard label="Auto-filled from account" value={stats.autoFilled} accent="#10b981" />
        <StatCard label="Manual entry" value={stats.manual} accent="#3b82f6" />
      </div>

      <div className="card">
        <div className="card-header">
          <h3>Placeholders</h3>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <select
              className="form-control"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              style={{ width: 'auto', minWidth: '150px' }}
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="all">All</option>
            </select>
            {isAdmin && (
              <button className="btn btn-primary" onClick={() => handleOpenModal()}>
                + Add Placeholder
              </button>
            )}
          </div>
        </div>

        {items.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">🏷️</div>
            <p>No placeholders found.</p>
          </div>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: 50 }}>#</th>
                  <th>Key</th>
                  <th>Label</th>
                  <th>Input Type</th>
                  <th>Source</th>
                  <th>Status</th>
                  {isAdmin && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td style={{ color: '#9ca3af', fontVariantNumeric: 'tabular-nums' }}>
                      {item.sort_order}
                    </td>
                    <td>
                      <code style={{
                        background: '#f3f4f6',
                        padding: '2px 8px',
                        borderRadius: 4,
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        color: '#1f2937',
                      }}>
                        {item.key}
                      </code>
                    </td>
                    <td>
                      <div style={{ fontWeight: 500 }}>{item.label}</div>
                      {item.description && (
                        <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: 2 }}>
                          {item.description}
                        </div>
                      )}
                    </td>
                    <td>
                      <span className="badge badge-secondary" style={{ fontWeight: 500 }}>
                        {typeLabel(item.input_type)}
                      </span>
                      {item.input_type === 'dropdown' && Array.isArray(item.input_options) && item.input_options.length > 0 && (
                        <div style={{ fontSize: '0.7rem', color: '#6b7280', marginTop: 4 }}>
                          {item.input_options.slice(0, 3).join(' • ')}
                          {item.input_options.length > 3 && ` +${item.input_options.length - 3}`}
                        </div>
                      )}
                    </td>
                    <td>
                      {item.data_source ? (
                        <span style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: '#059669' }}>
                          {item.data_source}
                        </span>
                      ) : (
                        <span style={{ color: '#9ca3af' }}>manual</span>
                      )}
                    </td>
                    <td>
                      <span className={`badge ${item.is_active ? 'badge-success' : 'badge-secondary'}`}>
                        {item.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    {isAdmin && (
                      <td>
                        <div className="action-buttons">
                          {item.is_active && (
                            <>
                              <button
                                className="btn btn-small btn-outline"
                                onClick={() => handleOpenModal(item)}
                              >
                                Edit
                              </button>
                              <button
                                className="btn btn-small btn-warning"
                                onClick={() => handleDeactivate(item.id)}
                              >
                                Deactivate
                              </button>
                            </>
                          )}
                          {!item.is_active && (
                            <button
                              className="btn btn-small btn-success"
                              onClick={() => handleReactivate(item.id)}
                            >
                              Reactivate
                            </button>
                          )}
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

      {showModal && isAdmin && (
        <div className="modal-overlay" onClick={handleCloseModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 640 }}>
            <div className="modal-header">
              <h3>{editing ? 'Edit Placeholder' : 'Add Placeholder'}</h3>
              <button className="modal-close" onClick={handleCloseModal}>×</button>
            </div>

            <form onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px', gap: '0.75rem' }}>
                <div className="form-group">
                  <label>
                    Key <span style={{ color: '#ef4444' }}>*</span>
                    {editing && <span style={{ fontSize: '0.7rem', color: '#9ca3af', marginLeft: 6 }}>(immutable)</span>}
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    value={formData.key}
                    onChange={handleChange('key')}
                    placeholder="e.g. CLIENT_FULL_NAME"
                    disabled={!!editing}
                    required
                    style={{ fontFamily: 'monospace', textTransform: 'uppercase' }}
                  />
                  <small style={{ color: '#6b7280', fontSize: '0.7rem' }}>
                    Uppercase letters, numbers and underscores. Auto-normalized on save.
                  </small>
                </div>
                <div className="form-group">
                  <label>Sort Order</label>
                  <input
                    type="number"
                    className="form-control"
                    value={formData.sort_order}
                    onChange={handleChange('sort_order')}
                    min={0}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Label <span style={{ color: '#ef4444' }}>*</span></label>
                <input
                  type="text"
                  className="form-control"
                  value={formData.label}
                  onChange={handleChange('label')}
                  placeholder="e.g. Client Full Legal Name"
                  required
                />
              </div>

              <div className="form-group">
                <label>Description</label>
                <textarea
                  className="form-control"
                  value={formData.description}
                  onChange={handleChange('description')}
                  rows="2"
                  placeholder="Brief explanation shown next to the field at generation time"
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div className="form-group">
                  <label>Input Type</label>
                  <select
                    className="form-control"
                    value={formData.input_type}
                    onChange={handleChange('input_type')}
                  >
                    {INPUT_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                  <small style={{ color: '#6b7280', fontSize: '0.7rem' }}>
                    {INPUT_TYPES.find((t) => t.value === formData.input_type)?.hint}
                  </small>
                </div>

                <div className="form-group">
                  <label>Data Source (auto-fill)</label>
                  <select
                    className="form-control"
                    value={formData.data_source}
                    onChange={handleChange('data_source')}
                  >
                    {DATA_SOURCE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                  <small style={{ color: '#6b7280', fontSize: '0.7rem' }}>
                    If set, this field auto-fills when the user selects an account.
                  </small>
                </div>
              </div>

              {formData.input_type === 'dropdown' && (
                <div className="form-group">
                  <label>Dropdown Options</label>
                  <input
                    type="text"
                    className="form-control"
                    value={formData.input_options}
                    onChange={handleChange('input_options')}
                    placeholder="USD, AUD, PHP, SGD, NZD, INR, GBP, EUR"
                  />
                  <small style={{ color: '#6b7280', fontSize: '0.7rem' }}>
                    Comma-separated list of choices shown in the dropdown.
                  </small>
                </div>
              )}

              <div className="form-group">
                <label>Detection Patterns (regex, one per line)</label>
                <textarea
                  className="form-control"
                  value={formData.detect_regex}
                  onChange={handleChange('detect_regex')}
                  rows="3"
                  placeholder={'\\bQuote\\s*#\\s*(\\d{5,8})\\b\n\\bOrder\\s*#\\s*(\\d{5,8})\\b'}
                  style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}
                />
                <small style={{ color: '#6b7280', fontSize: '0.7rem' }}>
                  Regex patterns used to auto-detect occurrences in uploaded .docx files. Leave blank if not pattern-detectable (e.g. client name).
                </small>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={handleCloseModal}>Cancel</button>
                <button type="submit" className="btn btn-primary">
                  {editing ? 'Update' : 'Create'} Placeholder
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, accent }) {
  return (
    <div style={{
      background: '#fff',
      border: '1px solid #e5e7eb',
      borderRadius: 8,
      padding: '0.75rem 1rem',
      display: 'flex',
      flexDirection: 'column',
      gap: 2,
    }}>
      <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: '#6b7280', fontWeight: 600 }}>
        {label}
      </div>
      <div style={{ fontSize: '1.5rem', fontWeight: 700, color: accent || '#111827', fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </div>
    </div>
  );
}

export default PlaceholderLibrary;
