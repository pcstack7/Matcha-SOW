import { useState, useEffect } from 'react';
import { EditIcon, DeactivateIcon, ActivateIcon } from './Icons';

const EMPTY_FORM = {
  name: '',
  account_contact: '',
  email: '',
  phone: '',
  notes: '',
  // v3 — SOW template fields
  short_name: '',
  client_number: '',
  country: '',
  sites: '',
};

function AccountManagement({ userRole }) {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState(null);
  const [filter, setFilter] = useState('active');
  const [formData, setFormData] = useState(EMPTY_FORM);

  const isAdmin = userRole === 'admin';

  useEffect(() => {
    loadAccounts();
  }, [filter]);

  const loadAccounts = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/accounts?filter=${filter}`, { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch accounts');
      setAccounts(await response.json());
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (account = null) => {
    if (account) {
      setEditingAccount(account);
      setFormData({
        name: account.name || '',
        account_contact: account.account_contact || '',
        email: account.email || '',
        phone: account.phone || '',
        notes: account.notes || '',
        short_name: account.short_name || '',
        client_number: account.client_number || '',
        country: account.country || '',
        sites: account.sites || '',
      });
    } else {
      setEditingAccount(null);
      setFormData(EMPTY_FORM);
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingAccount(null);
    setFormData(EMPTY_FORM);
  };

  const handleChange = (field) => (e) =>
    setFormData((prev) => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const url = editingAccount
        ? `/api/accounts/${editingAccount.id}`
        : '/api/accounts';
      const method = editingAccount ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save account');
      }

      loadAccounts();
      handleCloseModal();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDeactivate = async (id) => {
    if (!window.confirm('Are you sure you want to deactivate this account?')) return;
    try {
      const response = await fetch(`/api/accounts/${id}/deactivate`, {
        method: 'PATCH',
        credentials: 'include',
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to deactivate account');
      }
      loadAccounts();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleReactivate = async (id) => {
    if (!window.confirm('Are you sure you want to reactivate this account?')) return;
    try {
      const response = await fetch(`/api/accounts/${id}/reactivate`, {
        method: 'PATCH',
        credentials: 'include',
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to reactivate account');
      }
      loadAccounts();
    } catch (err) {
      setError(err.message);
    }
  };

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
        <p>Loading accounts...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="content-header">
        <h2>Accounts Master</h2>
        <p>Manage your client accounts and contact information</p>
      </div>

      {!isAdmin && (
        <div className="alert alert-info">
          You have view-only access. Contact an administrator to add or modify accounts.
        </div>
      )}

      {error && <div className="alert alert-error">{error}</div>}

      <div className="card">
        <div className="card-header">
          <h3>Accounts</h3>
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
                + Add Account
              </button>
            )}
          </div>
        </div>

        {accounts.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📋</div>
            <p>No accounts found.</p>
            {isAdmin && filter === 'active' && (
              <p>Click "Add Account" to create your first account.</p>
            )}
          </div>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Short Name</th>
                  <th>Client #</th>
                  <th>Account Contact</th>
                  <th>Email</th>
                  <th>Country</th>
                  <th>Status</th>
                  {isAdmin && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {accounts.map((account) => (
                  <tr key={account.id}>
                    <td>
                      <div style={{ fontWeight: 500 }}>{account.name}</div>
                      {account.sites && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary, #6b7280)', marginTop: 2 }}>
                          {account.sites}
                        </div>
                      )}
                    </td>
                    <td>
                      {account.short_name ? (
                        <span className="badge badge-secondary" style={{ fontWeight: 600, letterSpacing: '0.03em' }}>
                          {account.short_name}
                        </span>
                      ) : (
                        <span style={{ color: '#9ca3af' }}>—</span>
                      )}
                    </td>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>
                      {account.client_number || <span style={{ color: '#9ca3af' }}>—</span>}
                    </td>
                    <td>{account.account_contact || <span style={{ color: '#9ca3af' }}>—</span>}</td>
                    <td>{account.email || <span style={{ color: '#9ca3af' }}>—</span>}</td>
                    <td>{account.country || <span style={{ color: '#9ca3af' }}>—</span>}</td>
                    <td>
                      <span className={`badge ${account.is_active ? 'badge-success' : 'badge-secondary'}`}>
                        {account.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    {isAdmin && (
                      <td>
                        <div className="icon-btn-group">
                          {account.is_active && (
                            <>
                              <button
                                className="icon-btn icon-btn-edit"
                                onClick={() => handleOpenModal(account)}
                                data-tooltip="Edit"
                              ><EditIcon /></button>
                              <button
                                className="icon-btn icon-btn-deactivate"
                                onClick={() => handleDeactivate(account.id)}
                                data-tooltip="Deactivate"
                              ><DeactivateIcon /></button>
                            </>
                          )}
                          {!account.is_active && (
                            <button
                              className="icon-btn icon-btn-activate"
                              onClick={() => handleReactivate(account.id)}
                              data-tooltip="Reactivate"
                            ><ActivateIcon /></button>
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
          {/* Wider modal, reduced padding — keeps all fields visible without scrolling */}
          <div className="modal" onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 660, padding: '1.25rem 1.5rem', maxHeight: 'none', overflow: 'visible' }}>
            <div className="modal-header" style={{ marginBottom: '1rem', paddingBottom: '0.75rem' }}>
              <h3>{editingAccount ? 'Edit Account' : 'Add Account'}</h3>
              <button className="modal-close" onClick={handleCloseModal}>×</button>
            </div>

            <form onSubmit={handleSubmit}>
              {/* ── Contact Information ─────────────────────────── */}
              <p className="modal-section-label">Contact Information</p>

              {/* Row 1: Account Name (full width) */}
              <div className="form-group form-group-sm">
                <label>Account Name <span style={{ color: '#ef4444' }}>*</span></label>
                <input
                  type="text"
                  className="form-control"
                  value={formData.name}
                  onChange={handleChange('name')}
                  placeholder="e.g. St Luke's Medical Center Global City Inc"
                  required
                />
              </div>

              {/* Row 2: Contact + Phone + Email — three columns */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.6rem' }}>
                <div className="form-group form-group-sm">
                  <label>Account Contact</label>
                  <input type="text" className="form-control" value={formData.account_contact}
                    onChange={handleChange('account_contact')} placeholder="Contact name" />
                </div>
                <div className="form-group form-group-sm">
                  <label>Phone</label>
                  <input type="tel" className="form-control" value={formData.phone}
                    onChange={handleChange('phone')} placeholder="+1 555 000 0000" />
                </div>
                <div className="form-group form-group-sm">
                  <label>Email</label>
                  <input type="email" className="form-control" value={formData.email}
                    onChange={handleChange('email')} placeholder="contact@client.com" />
                </div>
              </div>

              {/* Row 3: Notes (single row, resizable) */}
              <div className="form-group form-group-sm">
                <label>Notes</label>
                <textarea className="form-control" value={formData.notes}
                  onChange={handleChange('notes')} rows="1"
                  placeholder="Any additional notes about this account" />
              </div>

              {/* ── SOW Template Fields ──────────────────────────── */}
              <p className="modal-section-label" style={{ marginTop: '0.75rem', borderTop: '1px solid #e5e7eb', paddingTop: '0.75rem' }}>
                SOW Template Fields
              </p>
              <p style={{ fontSize: '0.73rem', color: '#6b7280', margin: '-0.35rem 0 0.5rem' }}>
                Auto-fills placeholders when generating Fixed SOW templates.
              </p>

              {/* Row 4: Short Name + Client Number + Country + Sites — four columns */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '0.6rem' }}>
                <div className="form-group form-group-sm">
                  <label>Short Name</label>
                  <input type="text" className="form-control" value={formData.short_name}
                    onChange={handleChange('short_name')} placeholder="e.g. SLMC" />
                </div>
                <div className="form-group form-group-sm">
                  <label>Client Number</label>
                  <input type="text" className="form-control" value={formData.client_number}
                    onChange={handleChange('client_number')} placeholder="e.g. 10311837" />
                </div>
                <div className="form-group form-group-sm">
                  <label>Country</label>
                  <input type="text" className="form-control" value={formData.country}
                    onChange={handleChange('country')} placeholder="e.g. Australia" />
                </div>
                <div className="form-group form-group-sm">
                  <label>Sites</label>
                  <input type="text" className="form-control" value={formData.sites}
                    onChange={handleChange('sites')} placeholder="e.g. Global City" />
                </div>
              </div>

              <div className="modal-footer" style={{ marginTop: '1rem', paddingTop: '0.75rem' }}>
                <button type="button" className="btn btn-outline" onClick={handleCloseModal}>Cancel</button>
                <button type="submit" className="btn btn-primary">
                  {editingAccount ? 'Update' : 'Create'} Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default AccountManagement;
