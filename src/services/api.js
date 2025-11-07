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
