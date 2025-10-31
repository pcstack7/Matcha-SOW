import { useState, useEffect } from 'react';
import { sowApi, exportApi } from '../services/api';

// Helper function to parse markdown tables
function parseTable(lines, startIndex) {
  const tableLines = [];
  let i = startIndex;

  // Collect all consecutive table lines
  while (i < lines.length && lines[i].trim().startsWith('|')) {
    tableLines.push(lines[i]);
    i++;
  }

  if (tableLines.length < 2) return null;

  // Parse header
  const headerCells = tableLines[0]
    .split('|')
    .map(cell => cell.trim())
    .filter(cell => cell !== '');

  // Skip separator row (index 1)
  // Parse data rows
  const dataRows = [];
  for (let j = 2; j < tableLines.length; j++) {
    const cells = tableLines[j]
      .split('|')
      .map(cell => cell.trim())
      .filter(cell => cell !== '');
    if (cells.length > 0) {
      dataRows.push(cells);
    }
  }

  return {
    headers: headerCells,
    rows: dataRows,
    endIndex: i
  };
}

// Helper function to format SOW content with proper styling
function formatSOWContent(content) {
  if (!content) return null;

  const lines = content.split('\n');
  const elements = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.trim() === '') {
      elements.push(<br key={`br-${i}`} />);
      i++;
      continue;
    }

    // Check if this is the start of a table
    if (line.trim().startsWith('|')) {
      const table = parseTable(lines, i);
      if (table) {
        elements.push(
          <table
            key={`table-${i}`}
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              marginTop: '12px',
              marginBottom: '12px',
              fontFamily: 'Verdana, sans-serif',
              fontSize: '9.5px',
            }}
          >
            <thead>
              <tr>
                {table.headers.map((header, idx) => (
                  <th
                    key={idx}
                    style={{
                      border: '1px solid #ddd',
                      padding: '8px',
                      backgroundColor: '#707CF1',
                      color: '#FFFFFF',
                      fontWeight: 'bold',
                      textAlign: 'left',
                      fontFamily: 'Verdana, sans-serif',
                      fontSize: '9.5px',
                    }}
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.rows.map((row, rowIdx) => (
                <tr key={rowIdx}>
                  {row.map((cell, cellIdx) => (
                    <td
                      key={cellIdx}
                      style={{
                        border: '1px solid #ddd',
                        padding: '8px',
                        fontFamily: 'Verdana, sans-serif',
                        fontSize: '9.5px',
                      }}
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        );
        i = table.endIndex;
        continue;
      }
    }

    // Main headers (## or all caps)
    if (line.match(/^#{1,2}\s+/) || line.match(/^[A-Z\s]{3,}:?\s*$/)) {
      const headerText = line.replace(/^#{1,2}\s+/, '').trim();
      elements.push(
        <div
          key={i}
          style={{
            fontFamily: 'Verdana, sans-serif',
            fontSize: '16px',
            color: '#707CF1',
            fontWeight: 'bold',
            marginTop: '16px',
            marginBottom: '8px',
          }}
        >
          {headerText}
        </div>
      );
      i++;
      continue;
    }

    // Subheaders (### or **text**)
    if (line.match(/^#{3,4}\s+/) || line.match(/^\*\*.*\*\*$/)) {
      const subHeaderText = line.replace(/^#{3,4}\s+/, '').replace(/\*\*/g, '').trim();
      elements.push(
        <div
          key={i}
          style={{
            fontFamily: 'Verdana, sans-serif',
            fontSize: '14px',
            color: '#393392',
            fontWeight: 'bold',
            marginTop: '12px',
            marginBottom: '6px',
          }}
        >
          {subHeaderText}
        </div>
      );
      i++;
      continue;
    }

    // Regular content
    elements.push(
      <div
        key={i}
        style={{
          fontFamily: 'Verdana, sans-serif',
          fontSize: '9.5px',
          color: '#000000',
          lineHeight: '1.6',
        }}
      >
        {line}
      </div>
    );
    i++;
  }

  return elements;
}

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
              {selectedSOW.account_contact && <> (Contact: {selectedSOW.account_contact})</>}
              <br />
              {selectedSOW.template_name && (
                <>
                  <strong>Template:</strong> {selectedSOW.template_name}
                  <br />
                </>
              )}
              <strong>Created:</strong> {formatDate(selectedSOW.created_at)}
            </div>

            <div className="sow-preview">{formatSOWContent(selectedSOW.content)}</div>

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
