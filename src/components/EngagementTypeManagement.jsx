import { useState, useEffect } from 'react';

function EngagementTypeManagement({ userRole }) {
  const [engagementTypes, setEngagementTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editingType, setEditingType] = useState(null);
  const [filter, setFilter] = useState('active'); // 'active', 'inactive', or 'all'
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    description: '',
  });

  const isAdmin = userRole === 'admin';

  useEffect(() => {
    loadEngagementTypes();
  }, [filter]);

  const loadEngagementTypes = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/engagement-types?filter=${filter}`, { credentials: 'include' });

      if (!response.ok) {
        throw new Error('Failed to fetch engagement types');
      }

      const data = await response.json();
      setEngagementTypes(data);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (type = null) => {
    if (type) {
      setEditingType(type);
      setFormData({
        name: type.name,
        category: type.category || '',
        description: type.description || '',
      });
    } else {
      setEditingType(null);
      setFormData({
        name: '',
        category: '',
        description: '',
      });
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingType(null);
    setFormData({
      name: '',
      category: '',
      description: '',
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingType) {
        // Update existing engagement type
        const response = await fetch(`/api/engagement-types/${editingType.id}`, {
          method: 'PUT',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(formData),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to update engagement type');
        }
      } else {
        // Create new engagement type
        const response = await fetch('/api/engagement-types', {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(formData),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to create engagement type');
        }
      }
      loadEngagementTypes();
      handleCloseModal();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDeactivate = async (id) => {
    if (!window.confirm('Are you sure you want to deactivate this engagement type?')) {
      return;
    }

    try {
      const response = await fetch(`/api/engagement-types/${id}/deactivate`, {
        method: 'PATCH',
        credentials: 'include',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to deactivate engagement type');
      }

      loadEngagementTypes();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleReactivate = async (id) => {
    if (!window.confirm('Are you sure you want to reactivate this engagement type?')) {
      return;
    }

    try {
      const response = await fetch(`/api/engagement-types/${id}/reactivate`, {
        method: 'PATCH',
        credentials: 'include',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to reactivate engagement type');
      }

      loadEngagementTypes();
    } catch (err) {
      setError(err.message);
    }
  };

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
        <p>Loading engagement types...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="content-header">
        <h2>Engagement Types Master</h2>
        <p>Manage engagement categories and descriptions</p>
      </div>

      {!isAdmin && (
        <div className="alert alert-info">
          You have view-only access. Contact an administrator to add or modify engagement types.
        </div>
      )}

      {error && <div className="alert alert-error">{error}</div>}

      <div className="card">
        <div className="card-header">
          <h3>Engagement Types</h3>
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
                + Add Engagement Type
              </button>
            )}
          </div>
        </div>

        {engagementTypes.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">🤝</div>
            <p>No engagement types found.</p>
            {isAdmin && filter === 'active' && <p>Click "Add Engagement Type" to create your first engagement type.</p>}
          </div>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Category</th>
                  <th>Description</th>
                  <th>Status</th>
                  {isAdmin && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {engagementTypes.map((type) => (
                  <tr key={type.id}>
                    <td>{type.name}</td>
                    <td>{type.category || '-'}</td>
                    <td>{type.description || '-'}</td>
                    <td>
                      <span className={`badge ${type.is_active ? 'badge-success' : 'badge-secondary'}`}>
                        {type.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    {isAdmin && (
                      <td>
                        <div className="action-buttons">
                          {type.is_active && (
                            <>
                              <button
                                className="btn btn-small btn-outline"
                                onClick={() => handleOpenModal(type)}
                              >
                                Edit
                              </button>
                              <button
                                className="btn btn-small btn-warning"
                                onClick={() => handleDeactivate(type.id)}
                              >
                                Deactivate
                              </button>
                            </>
                          )}
                          {!type.is_active && (
                            <button
                              className="btn btn-small btn-success"
                              onClick={() => handleReactivate(type.id)}
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

      {/* Engagement Type Form Modal */}
      {showModal && isAdmin && (
        <div className="modal-overlay" onClick={handleCloseModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingType ? 'Edit Engagement Type' : 'Add Engagement Type'}</h3>
              <button className="modal-close" onClick={handleCloseModal}>
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Name *</label>
                <input
                  type="text"
                  className="form-control"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label>Category</label>
                <input
                  type="text"
                  className="form-control"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>Description</label>
                <textarea
                  className="form-control"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows="4"
                />
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={handleCloseModal}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingType ? 'Update' : 'Create'} Engagement Type
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default EngagementTypeManagement;
