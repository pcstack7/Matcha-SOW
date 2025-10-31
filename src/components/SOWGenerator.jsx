import { useState, useEffect } from 'react';
import { accountApi, templateApi, sowApi, exportApi } from '../services/api';

function SOWGenerator() {
  const [accounts, setAccounts] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [generatedSOW, setGeneratedSOW] = useState(null);

  const [formData, setFormData] = useState({
    account_id: '',
    template_id: '',
    project_notes: '',
    deliverables: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [accountsData, templatesData] = await Promise.all([
        accountApi.getAll(),
        templateApi.getAll(),
      ]);
      setAccounts(accountsData);
      setTemplates(templatesData);
    } catch (err) {
      setError('Failed to load data');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setGeneratedSOW(null);

    if (!formData.account_id || !formData.project_notes || !formData.deliverables) {
      setError('Please fill in all required fields');
      return;
    }

    try {
      setLoading(true);
      const sow = await sowApi.generate(formData);
      setGeneratedSOW(sow);
      setSuccess('SOW generated successfully!');

      // Reset form
      setFormData({
        account_id: '',
        template_id: '',
        project_notes: '',
        deliverables: '',
      });
    } catch (err) {
      setError(err.message || 'Failed to generate SOW');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = (format) => {
    if (!generatedSOW) return;

    switch (format) {
      case 'pdf':
        exportApi.downloadPdf(generatedSOW.id);
        break;
      case 'docx':
        exportApi.downloadDocx(generatedSOW.id);
        break;
      case 'txt':
        exportApi.downloadTxt(generatedSOW.id);
        break;
    }
  };

  const selectedAccount = accounts.find(a => a.id === parseInt(formData.account_id));

  return (
    <div>
      <div className="content-header">
        <h2>Generate Statement of Work</h2>
        <p>Create professional SOW documents with AI assistance</p>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <div className="card">
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Select Account *</label>
            <select
              className="form-control"
              value={formData.account_id}
              onChange={(e) => setFormData({ ...formData, account_id: e.target.value })}
              required
            >
              <option value="">Choose an account...</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name} {account.company ? `(${account.company})` : ''}
                </option>
              ))}
            </select>
            {accounts.length === 0 && (
              <p style={{ fontSize: '0.875rem', color: '#666', marginTop: '0.5rem' }}>
                No accounts available. Please create an account first.
              </p>
            )}
          </div>

          {selectedAccount && (
            <div className="alert alert-info">
              <strong>Account Details:</strong>
              <br />
              Name: {selectedAccount.name}
              {selectedAccount.company && <><br />Company: {selectedAccount.company}</>}
              {selectedAccount.email && <><br />Email: {selectedAccount.email}</>}
              {selectedAccount.phone && <><br />Phone: {selectedAccount.phone}</>}
            </div>
          )}

          <div className="form-group">
            <label>Select Template (Optional)</label>
            <select
              className="form-control"
              value={formData.template_id}
              onChange={(e) => setFormData({ ...formData, template_id: e.target.value })}
            >
              <option value="">No template (Generate from scratch)</option>
              {templates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))}
            </select>
            <p style={{ fontSize: '0.875rem', color: '#666', marginTop: '0.5rem' }}>
              Templates help guide the AI to generate SOWs in your preferred format
            </p>
          </div>

          <div className="form-group">
            <label>Project Notes *</label>
            <textarea
              className="form-control"
              value={formData.project_notes}
              onChange={(e) => setFormData({ ...formData, project_notes: e.target.value })}
              placeholder="Describe the project scope, objectives, requirements, and any specific details..."
              rows="6"
              required
            />
          </div>

          <div className="form-group">
            <label>Deliverables *</label>
            <textarea
              className="form-control"
              value={formData.deliverables}
              onChange={(e) => setFormData({ ...formData, deliverables: e.target.value })}
              placeholder="List all project deliverables (one per line or comma-separated)..."
              rows="6"
              required
            />
          </div>

          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? (
              <>
                <div className="spinner" style={{ width: '20px', height: '20px', borderWidth: '3px' }}></div>
                Generating SOW...
              </>
            ) : (
              'Generate SOW'
            )}
          </button>
        </form>
      </div>

      {generatedSOW && (
        <div className="card">
          <div className="card-header">
            <h3>Generated SOW</h3>
            <div className="action-buttons">
              <button className="btn btn-secondary btn-small" onClick={() => handleExport('pdf')}>
                Export PDF
              </button>
              <button className="btn btn-secondary btn-small" onClick={() => handleExport('docx')}>
                Export DOCX
              </button>
              <button className="btn btn-outline btn-small" onClick={() => handleExport('txt')}>
                Export TXT
              </button>
            </div>
          </div>
          <div className="sow-preview">{generatedSOW.content}</div>
        </div>
      )}
    </div>
  );
}

export default SOWGenerator;
