import { useState, useEffect } from 'react';
import { EyeIcon, DownloadIcon, DeleteIcon } from './Icons';
import { sowApi, exportApi } from '../services/api';
import { formatContent } from '../utils/formatContent';

function SOWList() {
  const [sows, setSows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedSOW, setSelectedSOW] = useState(null);
  const [filterAccount, setFilterAccount] = useState('');

  useEffect(() => {
    loadSOWs();
  }, []);

  const loadSOWs = async () => {
    try {
      setLoading(true);
      const data = await sowApi.getAll();
      setSows(data);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this SOW?')) {
      try {
        await sowApi.delete(id);
        loadSOWs();
        if (selectedSOW?.id === id) {
          setSelectedSOW(null);
        }
      } catch (err) {
        setError(err.message);
      }
    }
  };

  const handleExport = (id, format) => {
    switch (format) {
      case 'pdf':
        exportApi.downloadPdf(id);
        break;
      case 'docx':
        exportApi.downloadDocx(id);
        break;
      case 'txt':
        exportApi.downloadTxt(id);
        break;
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const uniqueAccounts = [...new Set(sows.map(sow => sow.account_name))];
  const filteredSOWs = filterAccount
    ? sows.filter(sow => sow.account_name === filterAccount)
    : sows;

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
        <p>Loading SOW history...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="content-header">
        <h2>SOW History</h2>
        <p>View and manage all generated SOWs</p>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="card">
        <div className="card-header">
          <h3>All SOWs ({filteredSOWs.length})</h3>
          {uniqueAccounts.length > 0 && (
            <div>
              <label style={{ marginRight: '0.5rem' }}>Filter by Account:</label>
              <select
                className="form-control"
                style={{ width: 'auto', display: 'inline-block' }}
                value={filterAccount}
                onChange={(e) => setFilterAccount(e.target.value)}
              >
                <option value="">All Accounts</option>
                {uniqueAccounts.map((account) => (
                  <option key={account} value={account}>
                    {account}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {filteredSOWs.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📝</div>
            <p>No SOWs generated yet. Create your first SOW to get started.</p>
          </div>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Account</th>
                  <th>Contact</th>
                  <th>Template</th>
                  <th>Created By</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredSOWs.map((sow) => (
                  <tr key={sow.id}>
                    <td>{sow.account_name}</td>
                    <td>{sow.account_contact || '-'}</td>
                    <td>{sow.template_name || 'No template'}</td>
                    <td>{sow.created_by_display_name || sow.created_by_username || '-'}</td>
                    <td>{formatDate(sow.created_at)}</td>
                    <td>
                      <div className="icon-btn-group">
                        <button
                          className="icon-btn icon-btn-view"
                          onClick={() => setSelectedSOW(sow)}
                          data-tooltip="View"
                        ><EyeIcon /></button>
                        <button
                          className="icon-btn icon-btn-download"
                          onClick={() => handleExport(sow.id, 'pdf')}
                          data-tooltip="Export PDF"
                        ><DownloadIcon /></button>
                        <button
                          className="icon-btn icon-btn-delete"
                          onClick={() => handleDelete(sow.id)}
                          data-tooltip="Delete"
                        ><DeleteIcon /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedSOW && (
        <div className="modal-overlay" onClick={() => setSelectedSOW(null)}>
          {/* Flex-column layout: header + meta are fixed height, only the SOW
              content area scrolls — the modal itself never gets a scrollbar */}
          <div className="modal" onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '900px', maxHeight: '90vh', overflow: 'hidden',
                     display: 'flex', flexDirection: 'column', padding: 0 }}>

            {/* Sticky header */}
            <div className="modal-header" style={{ flexShrink: 0, padding: '1.25rem 1.5rem 1rem', borderBottom: '2px solid var(--gray-light)', marginBottom: 0 }}>
              <div>
                <h3>Statement of Work</h3>
                <p style={{ fontSize: '0.875rem', color: '#666', marginTop: '0.25rem' }}>
                  {selectedSOW.account_name} - {formatDate(selectedSOW.created_at)}
                </p>
              </div>
              <button className="modal-close" onClick={() => setSelectedSOW(null)}>×</button>
            </div>

            {/* Meta strip — fixed, does not scroll */}
            <div style={{ flexShrink: 0, padding: '0.75rem 1.5rem', borderBottom: '1px solid var(--gray-light)', fontSize: '0.875rem', lineHeight: 1.6 }}>
              <strong>Account:</strong> {selectedSOW.account_name}
              {selectedSOW.account_contact && <> (Contact: {selectedSOW.account_contact})</>}
              {selectedSOW.template_name && <> &nbsp;·&nbsp; <strong>Template:</strong> {selectedSOW.template_name}</>}
              {selectedSOW.product_name && <> &nbsp;·&nbsp; <strong>Product:</strong> {selectedSOW.product_name}</>}
              {selectedSOW.engagement_type_name && <> &nbsp;·&nbsp; <strong>Engagement:</strong> {selectedSOW.engagement_type_name}</>}
              {(selectedSOW.created_by_display_name || selectedSOW.created_by_username) && <> &nbsp;·&nbsp; <strong>By:</strong> {selectedSOW.created_by_display_name || selectedSOW.created_by_username}</>}
              &nbsp;·&nbsp; <strong>Created:</strong> {formatDate(selectedSOW.created_at)}
            </div>

            {/* Scrollable SOW content — only this area scrolls */}
            <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
              <div className="sow-preview" style={{ maxHeight: 'none', borderRadius: 0 }}>
                {formatContent(selectedSOW.content)}
              </div>
            </div>

            <div className="modal-footer" style={{ flexShrink: 0, padding: '1rem 1.5rem', borderTop: '1px solid var(--gray-light)', marginTop: 0 }}>
              <button
                className="btn btn-secondary"
                onClick={() => handleExport(selectedSOW.id, 'pdf')}
              >
                Export PDF
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => handleExport(selectedSOW.id, 'docx')}
              >
                Export DOCX
              </button>
              <button
                className="btn btn-outline"
                onClick={() => handleExport(selectedSOW.id, 'txt')}
              >
                Export TXT
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default SOWList;
