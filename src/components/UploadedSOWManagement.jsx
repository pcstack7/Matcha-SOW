import { useState, useEffect } from 'react';

function UploadedSOWManagement({ userRole }) {
  const [uploadedSOWs, setUploadedSOWs] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [products, setProducts] = useState([]);
  const [engagementTypes, setEngagementTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editingSOW, setEditingSOW] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [filter, setFilter] = useState('active');

  const [formData, setFormData] = useState({
    account_id: '',
    product_id: '',
    engagement_type_id: '',
    description: '',
    pricing: '',
    currency: 'USD',
    pm_hours: '',
    ic_hours: '',
    sa_hours: '',
    se_hours: '',
    trainer_hours: '',
    integration_hours: '',
    apac_testing_hours: '',
    apac_rd_hours: '',
  });

  const [selectedFile, setSelectedFile] = useState(null);

  useEffect(() => {
    loadData();
  }, [filter]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [sowsData, accountsData, productsData, typesData] = await Promise.all([
        fetch(`/api/uploaded-sows?filter=${filter}`, { credentials: 'include' }).then(res => res.json()),
        fetch('/api/accounts', { credentials: 'include' }).then(res => res.json()),
        fetch('/api/products', { credentials: 'include' }).then(res => res.json()),
        fetch('/api/engagement-types', { credentials: 'include' }).then(res => res.json()),
      ]);

      setUploadedSOWs(sowsData);
      setAccounts(accountsData);
      setProducts(productsData);
      setEngagementTypes(typesData);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (sow = null) => {
    if (sow) {
      setEditingSOW(sow);
      setFormData({
        account_id: sow.account_id || '',
        product_id: sow.product_id || '',
        engagement_type_id: sow.engagement_type_id || '',
        description: sow.description || '',
        pricing: sow.pricing || '',
        currency: sow.currency || 'USD',
        pm_hours: sow.pm_hours || '',
        ic_hours: sow.ic_hours || '',
        sa_hours: sow.sa_hours || '',
        se_hours: sow.se_hours || '',
        trainer_hours: sow.trainer_hours || '',
        integration_hours: sow.integration_hours || '',
        apac_testing_hours: sow.apac_testing_hours || '',
        apac_rd_hours: sow.apac_rd_hours || '',
      });
      setSelectedFile(null);
    } else {
      setEditingSOW(null);
      setFormData({
        account_id: '',
        product_id: '',
        engagement_type_id: '',
        description: '',
        pricing: '',
        currency: 'USD',
        pm_hours: '',
        ic_hours: '',
        sa_hours: '',
        se_hours: '',
        trainer_hours: '',
        integration_hours: '',
        apac_testing_hours: '',
        apac_rd_hours: '',
      });
      setSelectedFile(null);
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingSOW(null);
    setSelectedFile(null);
    setFormData({
      account_id: '',
      product_id: '',
      engagement_type_id: '',
      description: '',
      pricing: '',
      currency: 'USD',
      pm_hours: '',
      ic_hours: '',
      sa_hours: '',
      se_hours: '',
      trainer_hours: '',
      integration_hours: '',
      apac_testing_hours: '',
      apac_rd_hours: '',
    });
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const ext = file.name.toLowerCase();
      if (!ext.endsWith('.pdf') && !ext.endsWith('.docx')) {
        setError('Only PDF and DOCX files are allowed');
        e.target.value = '';
        return;
      }
      setSelectedFile(file);
      setError(null);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.account_id) {
      setError('Account is required');
      return;
    }

    try {
      setUploading(true);

      if (editingSOW) {
        // Update existing SOW (metadata only)
        const response = await fetch(`/api/uploaded-sows/${editingSOW.id}`, {
          method: 'PUT',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(formData),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to update SOW');
        }
      } else {
        // Create new SOW with file upload
        if (!selectedFile) {
          setError('Please select a file to upload');
          setUploading(false);
          return;
        }

        const uploadFormData = new FormData();
        uploadFormData.append('file', selectedFile);

        Object.keys(formData).forEach(key => {
          if (formData[key]) {
            uploadFormData.append(key, formData[key]);
          }
        });

        const response = await fetch('/api/uploaded-sows', {
          method: 'POST',
          credentials: 'include',
          body: uploadFormData,
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to upload SOW');
        }
      }

      loadData();
      handleCloseModal();
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDeactivate = async (id) => {
    if (!window.confirm('Are you sure you want to deactivate this SOW? It will be hidden from the list.')) {
      return;
    }

    try {
      const response = await fetch(`/api/uploaded-sows/${id}/deactivate`, {
        method: 'PUT',
        credentials: 'include',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to deactivate SOW');
      }

      loadData();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleReactivate = async (id) => {
    if (!window.confirm('Are you sure you want to reactivate this SOW?')) {
      return;
    }

    try {
      const response = await fetch(`/api/uploaded-sows/${id}/reactivate`, {
        method: 'PUT',
        credentials: 'include',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to reactivate SOW');
      }

      loadData();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatCurrency = (amount, currency) => {
    if (!amount) return '-';
    const symbol = currency === 'USD' ? '$' : currency === 'AUD' ? 'A$' : 'S$';
    return `${symbol}${parseFloat(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const calculateTotalHours = (sow) => {
    const hours = [
      sow.pm_hours,
      sow.ic_hours,
      sow.sa_hours,
      sow.se_hours,
      sow.trainer_hours,
      sow.integration_hours,
      sow.apac_testing_hours,
      sow.apac_rd_hours
    ];
    return hours.reduce((sum, h) => sum + (parseFloat(h) || 0), 0);
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading">Loading...</div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="header">
        <div className="header-content">
          <h1>SOW Knowledge Bank</h1>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <label htmlFor="filter-select" style={{ fontSize: '14px', color: '#5E63CD' }}>Filter:</label>
              <select
                id="filter-select"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="form-control"
                style={{ width: 'auto', minWidth: '120px' }}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="all">All</option>
              </select>
            </div>
            <button className="btn btn-primary" onClick={() => handleOpenModal()}>
              + Upload SOW
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="alert alert-error">
          {error}
          <button onClick={() => setError(null)} className="alert-close">&times;</button>
        </div>
      )}

      {uploadedSOWs.length === 0 ? (
        <div className="empty-state">
          <p>No SOWs uploaded yet. Upload your first finalized SOW to start building your knowledge bank.</p>
        </div>
      ) : (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>File Name</th>
                <th>Account</th>
                <th>Product</th>
                <th>Engagement Type</th>
                <th>Pricing</th>
                <th>Total Hours</th>
                <th>Uploaded By</th>
                <th>Date</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {uploadedSOWs.map((sow) => (
                <tr key={sow.id}>
                  <td>{sow.file_name}</td>
                  <td>{sow.account_name}</td>
                  <td>{sow.product_name || '-'}</td>
                  <td>{sow.engagement_type_name || '-'}</td>
                  <td>{formatCurrency(sow.pricing, sow.currency)}</td>
                  <td>{calculateTotalHours(sow).toFixed(1)}h</td>
                  <td>{sow.created_by_display_name || sow.created_by_username}</td>
                  <td>{formatDate(sow.created_at)}</td>
                  <td>
                    <span style={{
                      color: sow.is_active ? '#28a745' : '#6c757d',
                      fontWeight: '500'
                    }}>
                      {sow.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>
                    <div className="action-buttons">
                      <button
                        className="btn btn-sm btn-secondary"
                        onClick={() => handleOpenModal(sow)}
                        title="Edit"
                      >
                        Edit
                      </button>
                      {sow.is_active ? (
                        <button
                          className="btn btn-sm btn-danger"
                          onClick={() => handleDeactivate(sow.id)}
                          title="Deactivate"
                        >
                          Deactivate
                        </button>
                      ) : (
                        <button
                          className="btn btn-sm btn-success"
                          onClick={() => handleReactivate(sow.id)}
                          title="Reactivate"
                        >
                          Reactivate
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '800px', maxHeight: '90vh', overflow: 'auto' }}>
            <div className="modal-header">
              <h2>{editingSOW ? 'Edit SOW Details' : 'Upload New SOW'}</h2>
              <button className="modal-close" onClick={handleCloseModal}>&times;</button>
            </div>

            <form onSubmit={handleSubmit}>
              {!editingSOW && (
                <div className="form-group">
                  <label>SOW File *</label>
                  <input
                    type="file"
                    accept=".pdf,.docx"
                    onChange={handleFileChange}
                    required
                    disabled={uploading}
                  />
                  <small>Accepted formats: PDF, DOCX (Max 10MB)</small>
                </div>
              )}

              <div className="form-group">
                <label>Account *</label>
                <select
                  name="account_id"
                  value={formData.account_id}
                  onChange={handleChange}
                  required
                  disabled={uploading}
                >
                  <option value="">Select Account</option>
                  {accounts.map(account => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Product</label>
                  <select
                    name="product_id"
                    value={formData.product_id}
                    onChange={handleChange}
                    disabled={uploading}
                  >
                    <option value="">Select Product</option>
                    {products.map(product => (
                      <option key={product.id} value={product.id}>
                        {product.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Engagement Type</label>
                  <select
                    name="engagement_type_id"
                    value={formData.engagement_type_id}
                    onChange={handleChange}
                    disabled={uploading}
                  >
                    <option value="">Select Engagement Type</option>
                    {engagementTypes.map(type => (
                      <option key={type.id} value={type.id}>
                        {type.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>Description</label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  rows="3"
                  placeholder="What is this SOW about?"
                  disabled={uploading}
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Final SOW Pricing</label>
                  <input
                    type="number"
                    name="pricing"
                    value={formData.pricing}
                    onChange={handleChange}
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    disabled={uploading}
                  />
                </div>

                <div className="form-group">
                  <label>Currency</label>
                  <select
                    name="currency"
                    value={formData.currency}
                    onChange={handleChange}
                    disabled={uploading}
                  >
                    <option value="USD">USD</option>
                    <option value="AUD">AUD</option>
                    <option value="SGD">SGD</option>
                  </select>
                </div>
              </div>

              <h3 style={{ marginTop: '20px', marginBottom: '10px', fontSize: '14px', color: '#5E63CD' }}>
                Resource Hours (Optional)
              </h3>

              <div className="form-row">
                <div className="form-group">
                  <label>Project Management</label>
                  <input
                    type="number"
                    name="pm_hours"
                    value={formData.pm_hours}
                    onChange={handleChange}
                    step="0.5"
                    min="0"
                    placeholder="0"
                    disabled={uploading}
                  />
                </div>

                <div className="form-group">
                  <label>Implementation Consultant</label>
                  <input
                    type="number"
                    name="ic_hours"
                    value={formData.ic_hours}
                    onChange={handleChange}
                    step="0.5"
                    min="0"
                    placeholder="0"
                    disabled={uploading}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Solution Architect</label>
                  <input
                    type="number"
                    name="sa_hours"
                    value={formData.sa_hours}
                    onChange={handleChange}
                    step="0.5"
                    min="0"
                    placeholder="0"
                    disabled={uploading}
                  />
                </div>

                <div className="form-group">
                  <label>System Engineer</label>
                  <input
                    type="number"
                    name="se_hours"
                    value={formData.se_hours}
                    onChange={handleChange}
                    step="0.5"
                    min="0"
                    placeholder="0"
                    disabled={uploading}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Trainer</label>
                  <input
                    type="number"
                    name="trainer_hours"
                    value={formData.trainer_hours}
                    onChange={handleChange}
                    step="0.5"
                    min="0"
                    placeholder="0"
                    disabled={uploading}
                  />
                </div>

                <div className="form-group">
                  <label>Integration Consultant</label>
                  <input
                    type="number"
                    name="integration_hours"
                    value={formData.integration_hours}
                    onChange={handleChange}
                    step="0.5"
                    min="0"
                    placeholder="0"
                    disabled={uploading}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>APAC Testing Consultant</label>
                  <input
                    type="number"
                    name="apac_testing_hours"
                    value={formData.apac_testing_hours}
                    onChange={handleChange}
                    step="0.5"
                    min="0"
                    placeholder="0"
                    disabled={uploading}
                  />
                </div>

                <div className="form-group">
                  <label>APAC R&D</label>
                  <input
                    type="number"
                    name="apac_rd_hours"
                    value={formData.apac_rd_hours}
                    onChange={handleChange}
                    step="0.5"
                    min="0"
                    placeholder="0"
                    disabled={uploading}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleCloseModal}
                  disabled={uploading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={uploading}
                >
                  {uploading ? 'Uploading...' : editingSOW ? 'Update' : 'Upload'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default UploadedSOWManagement;
