import { useState, useEffect, useRef } from 'react';
import { scopeItemApi, scopeSetApi } from '../services/api';

const CATEGORY_LABELS = {
  assumption: 'Assumptions',
  out_of_scope: 'Out of Scope',
};

function ScopeManagement() {
  const [activeCategory, setActiveCategory] = useState('assumption');
  const [activeTab, setActiveTab] = useState('items'); // 'items' or 'sets'

  return (
    <div>
      <div className="content-header">
        <h2>Scope Management</h2>
        <p>Manage assumptions and out-of-scope item sets for SOW generation</p>
      </div>

      {/* Category tabs */}
      <div className="tab-nav" style={{ marginBottom: '1.5rem' }}>
        {['assumption', 'out_of_scope'].map(cat => (
          <button
            key={cat}
            className={`tab-btn${activeCategory === cat ? ' active' : ''}`}
            onClick={() => { setActiveCategory(cat); setActiveTab('items'); }}
          >
            {CATEGORY_LABELS[cat]}
          </button>
        ))}
      </div>

      {/* Sub-tabs */}
      <div className="tab-nav" style={{ marginBottom: '1.5rem' }}>
        <button
          className={`tab-btn${activeTab === 'items' ? ' active' : ''}`}
          onClick={() => setActiveTab('items')}
        >
          Items (Master List)
        </button>
        <button
          className={`tab-btn${activeTab === 'sets' ? ' active' : ''}`}
          onClick={() => setActiveTab('sets')}
        >
          Sets
        </button>
      </div>

      {activeTab === 'items' ? (
        <ItemsPanel category={activeCategory} />
      ) : (
        <SetsPanel category={activeCategory} />
      )}
    </div>
  );
}

// ─── Items Panel ────────────────────────────────────────────────────────────

function ItemsPanel({ category }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [filter, setFilter] = useState('active');
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formText, setFormText] = useState('');
  const [excelFile, setExcelFile] = useState(null);
  const [importLoading, setImportLoading] = useState(false);
  const excelInputRef = useRef(null);

  useEffect(() => {
    loadItems();
  }, [category, filter]);

  const loadItems = async () => {
    try {
      setLoading(true);
      const data = await scopeItemApi.getAll(category, filter);
      setItems(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    try {
      if (editingItem) {
        await scopeItemApi.update(editingItem.id, { text: formText });
        setSuccess('Item updated successfully');
      } else {
        await scopeItemApi.create({ text: formText, category });
        setSuccess('Item created successfully');
      }
      setFormText('');
      setShowForm(false);
      setEditingItem(null);
      loadItems();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDeactivate = async (id) => {
    if (!confirm('Deactivate this item?')) return;
    try {
      await scopeItemApi.deactivate(id);
      loadItems();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleReactivate = async (id) => {
    try {
      await scopeItemApi.reactivate(id);
      loadItems();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleExcelImport = async () => {
    if (!excelFile) return;
    setImportLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await scopeItemApi.importExcel(excelFile, category);
      setSuccess(`Imported ${result.count} items successfully`);
      setExcelFile(null);
      if (excelInputRef.current) excelInputRef.current.value = '';
      loadItems();
    } catch (err) {
      setError(err.message);
    } finally {
      setImportLoading(false);
    }
  };

  return (
    <div>
      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <div className="card">
        <div className="card-header">
          <h3>{CATEGORY_LABELS[category]} Items</h3>
          <div className="action-buttons">
            <select
              className="form-control"
              style={{ width: 'auto', padding: '0.4rem 0.75rem' }}
              value={filter}
              onChange={e => setFilter(e.target.value)}
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="all">All</option>
            </select>
            <button className="btn btn-primary btn-small" onClick={() => { setShowForm(true); setEditingItem(null); setFormText(''); }}>
              + Add Item
            </button>
          </div>
        </div>

        {/* Excel import section */}
        <div style={{ padding: '1rem', background: '#f8f9fa', borderRadius: '6px', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.875rem', color: '#666' }}>Import from Excel (.xlsx):</span>
          <input
            ref={excelInputRef}
            type="file"
            accept=".xlsx,.xls"
            style={{ fontSize: '0.875rem' }}
            onChange={e => setExcelFile(e.target.files[0] || null)}
          />
          <button
            className="btn btn-secondary btn-small"
            onClick={handleExcelImport}
            disabled={!excelFile || importLoading}
          >
            {importLoading ? 'Importing...' : 'Import'}
          </button>
          <span style={{ fontSize: '0.75rem', color: '#888' }}>Column A = item text, row 1 = header (skipped)</span>
        </div>

        {showForm && (
          <form onSubmit={handleSubmit} style={{ marginBottom: '1rem', padding: '1rem', background: '#f8f9fa', borderRadius: '6px' }}>
            <div className="form-group" style={{ marginBottom: '0.75rem' }}>
              <label>{editingItem ? 'Edit Item Text' : 'New Item Text'}</label>
              <textarea
                className="form-control"
                value={formText}
                onChange={e => setFormText(e.target.value)}
                rows="2"
                required
                autoFocus
                placeholder={`Enter ${CATEGORY_LABELS[category].toLowerCase()} item text...`}
              />
            </div>
            <div className="action-buttons">
              <button type="submit" className="btn btn-primary btn-small">
                {editingItem ? 'Update' : 'Add Item'}
              </button>
              <button type="button" className="btn btn-outline btn-small" onClick={() => { setShowForm(false); setEditingItem(null); setFormText(''); }}>
                Cancel
              </button>
            </div>
          </form>
        )}

        {loading ? (
          <div style={{ textAlign: 'center', padding: '2rem' }}><div className="spinner"></div></div>
        ) : items.length === 0 ? (
          <p style={{ color: '#888', padding: '1rem 0' }}>No items found. Add items or import from Excel.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Text</th>
                <th>Status</th>
                <th>Created By</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map(item => (
                <tr key={item.id} style={{ opacity: item.is_active ? 1 : 0.5 }}>
                  <td>{item.text}</td>
                  <td>
                    <span className={`status-badge ${item.is_active ? 'status-active' : 'status-inactive'}`}>
                      {item.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>{item.created_by_display_name || '—'}</td>
                  <td>
                    <div className="action-buttons">
                      {!!item.is_active && (
                        <button
                          className="btn btn-outline btn-small"
                          onClick={() => { setEditingItem(item); setFormText(item.text); setShowForm(true); }}
                        >
                          Edit
                        </button>
                      )}
                      {item.is_active ? (
                        <button className="btn btn-danger btn-small" onClick={() => handleDeactivate(item.id)}>
                          Deactivate
                        </button>
                      ) : (
                        <button className="btn btn-secondary btn-small" onClick={() => handleReactivate(item.id)}>
                          Reactivate
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ─── Sets Panel ─────────────────────────────────────────────────────────────

function SetsPanel({ category }) {
  const [sets, setSets] = useState([]);
  const [allItems, setAllItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [filter, setFilter] = useState('active');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingSet, setEditingSet] = useState(null);
  const [selectedSet, setSelectedSet] = useState(null); // set detail modal
  const [createName, setCreateName] = useState('');
  const [createDescription, setCreateDescription] = useState('');

  useEffect(() => {
    loadSets();
    loadAllItems();
  }, [category, filter]);

  const loadSets = async () => {
    try {
      setLoading(true);
      const data = await scopeSetApi.getAll(category, filter);
      setSets(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadAllItems = async () => {
    try {
      const data = await scopeItemApi.getAll(category, 'active');
      setAllItems(data);
    } catch (err) {
      // silently fail
    }
  };

  const openSetDetail = async (setId) => {
    try {
      const data = await scopeSetApi.getById(setId);
      setSelectedSet(data);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleCreateSet = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    try {
      if (editingSet) {
        await scopeSetApi.update(editingSet.id, { name: createName, description: createDescription });
        setSuccess('Set updated successfully');
      } else {
        await scopeSetApi.create({ name: createName, category, description: createDescription });
        setSuccess('Set created successfully');
      }
      setCreateName('');
      setCreateDescription('');
      setShowCreateForm(false);
      setEditingSet(null);
      loadSets();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDeactivate = async (id) => {
    if (!confirm('Deactivate this set? It will no longer appear in SOW generation.')) return;
    try {
      await scopeSetApi.deactivate(id);
      loadSets();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleReactivate = async (id) => {
    try {
      await scopeSetApi.reactivate(id);
      loadSets();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleAddItemToSet = async (itemId) => {
    if (!selectedSet) return;
    try {
      const updated = await scopeSetApi.addItem(selectedSet.id, itemId);
      setSelectedSet(updated);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleRemoveItemFromSet = async (itemId) => {
    if (!selectedSet) return;
    try {
      const updated = await scopeSetApi.removeItem(selectedSet.id, itemId);
      setSelectedSet(updated);
    } catch (err) {
      setError(err.message);
    }
  };

  const setItemIds = selectedSet ? new Set((selectedSet.items || []).map(i => i.id)) : new Set();
  const availableToAdd = allItems.filter(i => !setItemIds.has(i.id));

  return (
    <div>
      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <div className="card">
        <div className="card-header">
          <h3>{CATEGORY_LABELS[category]} Sets</h3>
          <div className="action-buttons">
            <select
              className="form-control"
              style={{ width: 'auto', padding: '0.4rem 0.75rem' }}
              value={filter}
              onChange={e => setFilter(e.target.value)}
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="all">All</option>
            </select>
            <button className="btn btn-primary btn-small" onClick={() => { setShowCreateForm(true); setEditingSet(null); setCreateName(''); setCreateDescription(''); }}>
              + Create Set
            </button>
          </div>
        </div>

        {showCreateForm && (
          <form onSubmit={handleCreateSet} style={{ marginBottom: '1rem', padding: '1rem', background: '#f8f9fa', borderRadius: '6px' }}>
            <div className="form-group" style={{ marginBottom: '0.75rem' }}>
              <label>Set Name *</label>
              <input
                className="form-control"
                value={createName}
                onChange={e => setCreateName(e.target.value)}
                required
                autoFocus
                placeholder="e.g. Standard Implementation Assumptions"
              />
            </div>
            <div className="form-group" style={{ marginBottom: '0.75rem' }}>
              <label>Description (Optional)</label>
              <input
                className="form-control"
                value={createDescription}
                onChange={e => setCreateDescription(e.target.value)}
                placeholder="Brief description of this set"
              />
            </div>
            <div className="action-buttons">
              <button type="submit" className="btn btn-primary btn-small">
                {editingSet ? 'Update Set' : 'Create Set'}
              </button>
              <button type="button" className="btn btn-outline btn-small" onClick={() => { setShowCreateForm(false); setEditingSet(null); }}>
                Cancel
              </button>
            </div>
          </form>
        )}

        {loading ? (
          <div style={{ textAlign: 'center', padding: '2rem' }}><div className="spinner"></div></div>
        ) : sets.length === 0 ? (
          <p style={{ color: '#888', padding: '1rem 0' }}>No sets found. Create a set to group items together.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Items</th>
                <th>Status</th>
                <th>Locked</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sets.map(set => (
                <tr key={set.id} style={{ opacity: set.is_active ? 1 : 0.5 }}>
                  <td>
                    <div>
                      <strong>{set.name}</strong>
                      {set.description && <div style={{ fontSize: '0.8rem', color: '#666' }}>{set.description}</div>}
                    </div>
                  </td>
                  <td>{set.item_count > 0 ? `${set.item_count} item${set.item_count !== 1 ? 's' : ''}` : <span style={{ color: '#bbb', fontSize: '0.82rem' }}>No items</span>}</td>
                  <td>
                    <span className={`status-badge ${set.is_active ? 'status-active' : 'status-inactive'}`}>
                      {set.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>
                    {set.is_locked ? (
                      <span style={{ color: '#e67e22', fontSize: '0.85rem' }}>🔒 Locked</span>
                    ) : (
                      <span style={{ color: '#27ae60', fontSize: '0.85rem' }}>Unlocked</span>
                    )}
                  </td>
                  <td>
                    <div className="action-buttons">
                      <button className="btn btn-outline btn-small" onClick={() => openSetDetail(set.id)}>
                        Manage Items
                      </button>
                      {!set.is_locked && !!set.is_active && (
                        <button
                          className="btn btn-outline btn-small"
                          onClick={() => {
                            setEditingSet(set);
                            setCreateName(set.name);
                            setCreateDescription(set.description || '');
                            setShowCreateForm(true);
                          }}
                        >
                          Edit
                        </button>
                      )}
                      {set.is_active ? (
                        <button className="btn btn-danger btn-small" onClick={() => handleDeactivate(set.id)}>
                          Deactivate
                        </button>
                      ) : (
                        <button className="btn btn-secondary btn-small" onClick={() => handleReactivate(set.id)}>
                          Reactivate
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Set detail modal */}
      {selectedSet && (
        <div className="modal-overlay" onClick={() => setSelectedSet(null)}>
          <div className="modal-content" style={{ maxWidth: '700px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>
                {selectedSet.name}
                {!!selectedSet.is_locked && <span style={{ marginLeft: '0.5rem', fontSize: '0.85rem', color: '#e67e22' }}>🔒 Locked</span>}
              </h3>
              <button className="btn btn-outline btn-small" onClick={() => setSelectedSet(null)}>Close</button>
            </div>

            {!!selectedSet.is_locked && (
              <div className="alert alert-info" style={{ marginBottom: '1rem' }}>
                This set is locked because it has been used in a generated SOW. Items cannot be added or removed.
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
              {/* Items in set */}
              <div>
                <h4 style={{ marginBottom: '0.75rem' }}>Items in this Set{(selectedSet.items || []).length > 0 ? ` (${(selectedSet.items || []).length})` : ''}</h4>
                {(selectedSet.items || []).length === 0 ? (
                  <p style={{ color: '#888', fontSize: '0.875rem' }}>No items added yet.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '350px', overflowY: 'auto' }}>
                    {(selectedSet.items || []).map(item => (
                      <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '0.5rem 0.75rem', background: '#f8f9fa', borderRadius: '4px', gap: '0.5rem' }}>
                        <span style={{ fontSize: '0.875rem', flex: 1 }}>{item.text}</span>
                        {!selectedSet.is_locked && (
                          <button
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#e74c3c', fontSize: '1rem', flexShrink: 0 }}
                            onClick={() => handleRemoveItemFromSet(item.id)}
                            title="Remove from set"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Available items to add */}
              {!selectedSet.is_locked && (
                <div>
                  <h4 style={{ marginBottom: '0.75rem' }}>Available Items ({availableToAdd.length})</h4>
                  {availableToAdd.length === 0 ? (
                    <p style={{ color: '#888', fontSize: '0.875rem' }}>All active items are already in this set.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '350px', overflowY: 'auto' }}>
                      {availableToAdd.map(item => (
                        <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '0.5rem 0.75rem', background: '#fff', border: '1px solid #e0e0e0', borderRadius: '4px', gap: '0.5rem' }}>
                          <span style={{ fontSize: '0.875rem', flex: 1 }}>{item.text}</span>
                          <button
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#27ae60', fontSize: '1rem', flexShrink: 0 }}
                            onClick={() => handleAddItemToSet(item.id)}
                            title="Add to set"
                          >
                            +
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ScopeManagement;
