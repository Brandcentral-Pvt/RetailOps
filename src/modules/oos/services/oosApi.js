const API_BASE = import.meta.env?.VITE_API_URL || '/api';

const authHeaders = () => {
  const token = localStorage.getItem('authToken');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

async function call(path, { method = 'GET', body } = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...authHeaders(),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  let payload;
  try { payload = await res.json(); } catch { payload = null; }
  if (!res.ok || payload?.success === false) {
    const err = new Error(payload?.error || `Request failed (${res.status})`);
    err.status = res.status;
    err.code = payload?.code;
    err.payload = payload;
    throw err;
  }
  return payload;
}

const oosApi = {
  getPolicy: () => call('/oos/policy'),

  createRun: (body) => call('/oos/runs', { method: 'POST', body }),
  listRuns: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return call(`/oos/runs${q ? `?${q}` : ''}`);
  },
  getRun: (id) => call(`/oos/runs/${id}`),

  ingestUpload: (runId, body) => call(`/oos/runs/${runId}/imports`, { method: 'POST', body }),
  listImports: (runId) => call(`/oos/runs/${runId}/imports`),

  reconcile: (runId) => call(`/oos/runs/${runId}/reconcile`, { method: 'POST', body: {} }),
  listDecisions: (runId, params = {}) => {
    const q = new URLSearchParams(params).toString();
    return call(`/oos/runs/${runId}/decisions${q ? `?${q}` : ''}`);
  },
  listRunIncidents: (runId) => call(`/oos/runs/${runId}/incidents`),

  updateIncident: (id, body) => call(`/oos/incidents/${id}`, { method: 'PATCH', body }),
  resolveIncident: (id, body = {}) => call(`/oos/incidents/${id}/resolve`, { method: 'POST', body }),

  getPareto: (sellerId, params = {}) => {
    const q = new URLSearchParams(params).toString();
    return call(`/oos/sellers/${sellerId}/pareto${q ? `?${q}` : ''}`);
  },

  requestResync: (runId, body) => call(`/oos/runs/${runId}/resync`, { method: 'POST', body }),
  listResync: (runId) => call(`/oos/runs/${runId}/resync`),
  verifyResync: (jobId, body) => call(`/oos/resync/${jobId}/verify`, { method: 'POST', body }),

  buildExport: (runId) => call(`/oos/runs/${runId}/export`, { method: 'POST', body: {} }),
  getLatestExport: (runId) => call(`/oos/runs/${runId}/export`),
  downloadExport: async (runId) => {
    const res = await fetch(`${API_BASE}/oos/runs/${runId}/export/download`, { headers: authHeaders() });
    if (!res.ok) throw new Error('Export download failed');
    const blob = await res.blob();
    const disposition = res.headers.get('content-disposition') || '';
    const match = disposition.match(/filename="?([^"]+)"?/i);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = match?.[1] || `oos-${runId}.xlsx`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  },

  submit: (runId, body) => call(`/oos/runs/${runId}/submit`, { method: 'POST', body }),
};

export default oosApi;
