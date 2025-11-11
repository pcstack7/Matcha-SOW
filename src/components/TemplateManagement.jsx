import { useState, useEffect } from 'react';
import { templateApi } from '../services/api';
import { formatContent } from '../utils/formatContent';

function TemplateManagement() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [templateName, setTemplateName] = useState('');
  const [showViewModal, setShowViewModal] = useState(false);
  const [viewingTemplate, setViewingTemplate] = useState(null);
  const [templateContent, setTemplateContent] = useState('');
  const [contentType, setContentType] = useState('text');
  const [loadingContent, setLoadingContent] = useState(false);

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      const data = await templateApi.getAll();
      setTemplates(data);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
      setTemplateName(file.name);
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!selectedFile) {
      setError('Please select a file to upload');
      return;
    }

    try {
      setUploading(true);
      await templateApi.upload(selectedFile, templateName);
      loadTemplates();
      handleCloseModal();
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this template?')) {
      try {
        await templateApi.delete(id);
        loadTemplates();
      } catch (err) {
        setError(err.message);
      }
    }
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedFile(null);
    setTemplateName('');
  };

  const handleViewTemplate = async (template) => {
    try {
      setLoadingContent(true);
      setViewingTemplate(template);
      setShowViewModal(true);
      const data = await templateApi.getContent(template.id);
      setTemplateContent(data.content);
      setContentType(data.content_type || 'text');
      setError(null);
    } catch (err) {
      setError(err.message);
      setShowViewModal(false);
    } finally {
      setLoadingContent(false);
    }
  };

  const handleCloseViewModal = () => {
    setShowViewModal(false);
    setViewingTemplate(null);
    setTemplateContent('');
    setContentType('text');
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
        <p>Loading templates...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="content-header">
        <h2>Template Management</h2>
        <p>Upload and manage your SOW templates</p>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="card">
        <div className="card-header">
          <h3>Templates</h3>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            + Upload Template
          </button>
        </div>

        {templates.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📄</div>
            <p>No templates yet. Upload your first template to get started.</p>
            <p style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>
              Supported formats: PDF, DOCX, TXT
            </p>
          </div>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Uploaded</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {templates.map((template) => (
                  <tr key={template.id}>
                    <td>{template.name}</td>
                    <td>
                      <span
                        style={{
                          padding: '0.25rem 0.75rem',
                          borderRadius: '4px',
                          backgroundColor:
                            template.file_type === '.pdf'
                              ? '#F56E7B'
                              : template.file_type === '.docx'
                              ? '#707CF1'
                              : '#00BBBA',
                          color: 'white',
                          fontSize: '0.75rem',
                          fontWeight: '600',
                        }}
                      >
                        {template.file_type.toUpperCase().replace('.', '')}
                      </span>
                    </td>
                    <td>{formatDate(template.uploaded_at)}</td>
                    <td>
                      <button
                        className="btn btn-small btn-primary"
                        onClick={() => handleViewTemplate(template)}
                        style={{ marginRight: '0.5rem' }}
                      >
                        View
                      </button>
                      <button
                        className="btn btn-small btn-danger"
                        onClick={() => handleDelete(template.id)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={handleCloseModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Upload Template</h3>
              <button className="modal-close" onClick={handleCloseModal}>
                ×
              </button>
            </div>

            <form onSubmit={handleUpload}>
              <div className="form-group">
                <label>Template Name</label>
                <input
                  type="text"
                  className="form-control"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label>File</label>
                <div
                  className="file-upload"
                  onClick={() => document.getElementById('file-input').click()}
                >
                  <input
                    id="file-input"
                    type="file"
                    accept=".pdf,.docx,.txt"
                    onChange={handleFileChange}
                  />
                  {selectedFile ? (
                    <p>
                      <strong>Selected:</strong> {selectedFile.name}
                    </p>
                  ) : (
                    <div>
                      <p style={{ fontSize: '2rem' }}>📁</p>
                      <p>Click to select a file</p>
                      <p style={{ fontSize: '0.875rem', color: '#666', marginTop: '0.5rem' }}>
                        Supported: PDF, DOCX, TXT
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={handleCloseModal}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={uploading}>
                  {uploading ? 'Uploading...' : 'Upload'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showViewModal && (
        <div className="modal-overlay" onClick={handleCloseViewModal}>
          <div
            className="modal"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '800px', width: '90%' }}
          >
            <div className="modal-header">
              <h3>View Template: {viewingTemplate?.name}</h3>
              <button className="modal-close" onClick={handleCloseViewModal}>
                ×
              </button>
            </div>

            <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
              {loadingContent ? (
                <div style={{ textAlign: 'center', padding: '2rem' }}>
                  <div className="spinner"></div>
                  <p>Loading template content...</p>
                </div>
              ) : (
                <div>
                  <div style={{ marginBottom: '1rem' }}>
                    <span
                      style={{
                        padding: '0.25rem 0.75rem',
                        borderRadius: '4px',
                        backgroundColor:
                          viewingTemplate?.file_type === '.pdf'
                            ? '#F56E7B'
                            : viewingTemplate?.file_type === '.docx'
                            ? '#707CF1'
                            : '#00BBBA',
                        color: 'white',
                        fontSize: '0.75rem',
                        fontWeight: '600',
                      }}
                    >
                      {viewingTemplate?.file_type.toUpperCase().replace('.', '')}
                    </span>
                  </div>
                  <div
                    className="template-content-view"
                    style={{
                      padding: '1.5rem',
                      backgroundColor: '#fff',
                      maxHeight: '100%',
                      overflow: 'auto'
                    }}
                  >
                    {templateContent ? (
                      contentType === 'html' ? (
                        <div dangerouslySetInnerHTML={{ __html: templateContent }} />
                      ) : (
                        formatContent(templateContent)
                      )
                    ) : (
                      <p>No content available</p>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button className="btn btn-outline" onClick={handleCloseViewModal}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default TemplateManagement;
