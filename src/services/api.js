const API_BASE = '/api';

// Helper function to make authenticated fetch calls
const fetchWithAuth = (url, options = {}) => {
  return fetch(url, {
    ...options,
    credentials: 'include', // Required for session cookies
    headers: {
      ...options.headers,
    },
  });
};

// Account API
export const accountApi = {
  getAll: async () => {
    const response = await fetchWithAuth(`${API_BASE}/accounts`);
    if (!response.ok) throw new Error('Failed to fetch accounts');
    return response.json();
  },

  getById: async (id) => {
    const response = await fetchWithAuth(`${API_BASE}/accounts/${id}`);
    if (!response.ok) throw new Error('Failed to fetch account');
    return response.json();
  },

  create: async (account) => {
    const response = await fetchWithAuth(`${API_BASE}/accounts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(account),
    });
    if (!response.ok) throw new Error('Failed to create account');
    return response.json();
  },

  update: async (id, account) => {
    const response = await fetchWithAuth(`${API_BASE}/accounts/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(account),
    });
    if (!response.ok) throw new Error('Failed to update account');
    return response.json();
  },

  delete: async (id) => {
    const response = await fetchWithAuth(`${API_BASE}/accounts/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) throw new Error('Failed to delete account');
    return response.json();
  },
};

// Template API
export const templateApi = {
  getAll: async () => {
    const response = await fetchWithAuth(`${API_BASE}/templates`);
    if (!response.ok) throw new Error('Failed to fetch templates');
    return response.json();
  },

  upload: async (file, name) => {
    const formData = new FormData();
    formData.append('file', file);
    if (name) formData.append('name', name);

    const response = await fetchWithAuth(`${API_BASE}/templates`, {
      method: 'POST',
      body: formData,
    });
    if (!response.ok) throw new Error('Failed to upload template');
    return response.json();
  },

  delete: async (id) => {
    const response = await fetchWithAuth(`${API_BASE}/templates/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) throw new Error('Failed to delete template');
    return response.json();
  },

  getContent: async (id) => {
    const response = await fetchWithAuth(`${API_BASE}/templates/${id}/content`);
    if (!response.ok) throw new Error('Failed to fetch template content');
    return response.json();
  },
};

// SOW API
export const sowApi = {
  getAll: async () => {
    const response = await fetchWithAuth(`${API_BASE}/sows`);
    if (!response.ok) throw new Error('Failed to fetch SOWs');
    return response.json();
  },

  getById: async (id) => {
    const response = await fetchWithAuth(`${API_BASE}/sows/${id}`);
    if (!response.ok) throw new Error('Failed to fetch SOW');
    return response.json();
  },

  getByAccountId: async (accountId) => {
    const response = await fetchWithAuth(`${API_BASE}/sows/account/${accountId}`);
    if (!response.ok) throw new Error('Failed to fetch SOWs');
    return response.json();
  },

  generate: async (data) => {
    const response = await fetchWithAuth(`${API_BASE}/sows/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error('Failed to generate SOW');
    return response.json();
  },

  delete: async (id) => {
    const response = await fetchWithAuth(`${API_BASE}/sows/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) throw new Error('Failed to delete SOW');
    return response.json();
  },
};

// Scope Items API (Assumptions & Out of Scope master items)
export const scopeItemApi = {
  getAll: async (category, filter = 'active') => {
    const params = new URLSearchParams();
    if (category) params.set('category', category);
    params.set('filter', filter);
    const response = await fetchWithAuth(`${API_BASE}/scope-items?${params}`);
    if (!response.ok) throw new Error('Failed to fetch scope items');
    return response.json();
  },

  create: async (item) => {
    const response = await fetchWithAuth(`${API_BASE}/scope-items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(item),
    });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Failed to create scope item');
    }
    return response.json();
  },

  update: async (id, item) => {
    const response = await fetchWithAuth(`${API_BASE}/scope-items/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(item),
    });
    if (!response.ok) throw new Error('Failed to update scope item');
    return response.json();
  },

  deactivate: async (id) => {
    const response = await fetchWithAuth(`${API_BASE}/scope-items/${id}/deactivate`, { method: 'PATCH' });
    if (!response.ok) throw new Error('Failed to deactivate scope item');
    return response.json();
  },

  reactivate: async (id) => {
    const response = await fetchWithAuth(`${API_BASE}/scope-items/${id}/reactivate`, { method: 'PATCH' });
    if (!response.ok) throw new Error('Failed to reactivate scope item');
    return response.json();
  },

  importExcel: async (file, category) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('category', category);
    const response = await fetchWithAuth(`${API_BASE}/scope-items/import-excel`, {
      method: 'POST',
      body: formData,
    });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Failed to import Excel file');
    }
    return response.json();
  },
};

// Scope Sets API
export const scopeSetApi = {
  getAll: async (category, filter = 'active') => {
    const params = new URLSearchParams();
    if (category) params.set('category', category);
    params.set('filter', filter);
    const response = await fetchWithAuth(`${API_BASE}/scope-sets?${params}`);
    if (!response.ok) throw new Error('Failed to fetch scope sets');
    return response.json();
  },

  getById: async (id) => {
    const response = await fetchWithAuth(`${API_BASE}/scope-sets/${id}`);
    if (!response.ok) throw new Error('Failed to fetch scope set');
    return response.json();
  },

  create: async (scopeSet) => {
    const response = await fetchWithAuth(`${API_BASE}/scope-sets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(scopeSet),
    });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Failed to create scope set');
    }
    return response.json();
  },

  update: async (id, scopeSet) => {
    const response = await fetchWithAuth(`${API_BASE}/scope-sets/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(scopeSet),
    });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Failed to update scope set');
    }
    return response.json();
  },

  deactivate: async (id) => {
    const response = await fetchWithAuth(`${API_BASE}/scope-sets/${id}/deactivate`, { method: 'PATCH' });
    if (!response.ok) throw new Error('Failed to deactivate scope set');
    return response.json();
  },

  reactivate: async (id) => {
    const response = await fetchWithAuth(`${API_BASE}/scope-sets/${id}/reactivate`, { method: 'PATCH' });
    if (!response.ok) throw new Error('Failed to reactivate scope set');
    return response.json();
  },

  addItem: async (setId, itemId) => {
    const response = await fetchWithAuth(`${API_BASE}/scope-sets/${setId}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ item_id: itemId }),
    });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Failed to add item to scope set');
    }
    return response.json();
  },

  removeItem: async (setId, itemId) => {
    const response = await fetchWithAuth(`${API_BASE}/scope-sets/${setId}/items/${itemId}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Failed to remove item from scope set');
    }
    return response.json();
  },
};

// Document extraction API
export const extractionApi = {
  extractFromDocuments: async (files) => {
    const formData = new FormData();
    for (const file of files) {
      formData.append('files', file);
    }
    const response = await fetchWithAuth(`${API_BASE}/sows/extract-from-documents`, {
      method: 'POST',
      body: formData,
    });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Failed to extract content from documents');
    }
    return response.json();
  },
};

// Export API
export const exportApi = {
  downloadPdf: async (id) => {
    const response = await fetchWithAuth(`${API_BASE}/export/${id}/pdf`);
    if (!response.ok) throw new Error('Failed to download PDF');
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SOW-${id}.pdf`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  },

  downloadDocx: async (id) => {
    const response = await fetchWithAuth(`${API_BASE}/export/${id}/docx`);
    if (!response.ok) throw new Error('Failed to download DOCX');
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SOW-${id}.docx`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  },

  downloadTxt: async (id) => {
    const response = await fetchWithAuth(`${API_BASE}/export/${id}/txt`);
    if (!response.ok) throw new Error('Failed to download TXT');
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SOW-${id}.txt`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  },
};
