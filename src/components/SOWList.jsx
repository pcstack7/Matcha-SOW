import { useState, useEffect } from 'react';
import { sowApi, exportApi } from '../services/api';

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
                  <th>Company</th>
                  <th>Template</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredSOWs.map((sow) => (
                  <tr key={sow.id}>
                    <td>{sow.account_name}</td>
                    <td>{sow.account_company || '-'}</td>
                    <td>{sow.template_name || 'No template'}</td>
                    <td>{formatDate(sow.created_at)}</td>
                    <td>
                      <div className="action-buttons">
                        <button
                          className="btn btn-small btn-outline"
                          onClick={() => setSelectedSOW(sow)}
                        >
                          View
                        </button>
                        <button
                          className="btn btn-small btn-secondary"
                          onClick={() => handleExport(sow.id, 'pdf')}
                        >
                          PDF
                        </button>
                        <button
                          className="btn btn-small btn-danger"
                          onClick={() => handleDelete(sow.id)}
                        >
                          Delete
                        </button>
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
          <div className="modal" style={{ maxWidth: '900px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3>Statement of Work</h3>
                <p style={{ fontSize: '0.875rem', color: '#666', marginTop: '0.25rem' }}>
                  {selectedSOW.account_name} - {formatDate(selectedSOW.created_at)}
                </p>
              </div>
              <button className="modal-close" onClick={() => setSelectedSOW(null)}>
                ×
              </button>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <strong>Account:</strong> {selectedSOW.account_name}
              {selectedSOW.account_company && <> ({selectedSOW.account_company})</>}
              <br />
              {selectedSOW.template_name && (
                <>
                  <strong>Template:</strong> {selectedSOW.template_name}
                  <br />
                </>
              )}
              <strong>Created:</strong> {formatDate(selectedSOW.created_at)}
            </div>

            <div className="sow-preview">{selectedSOW.content}</div>

            <div className="modal-footer">
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
