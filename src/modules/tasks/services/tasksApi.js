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

const tasksApi = {
  getTemplates: async (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return call(`/pems/templates${q ? `?${q}` : ''}`);
  },

  getTemplateById: async (id) => call(`/pems/templates/${id}`),

  createTemplate: async (data) => call(`/pems/templates`, { method: 'POST', body: data }),

  updateTemplate: async (id, data) => call(`/pems/templates/${id}`, { method: 'PUT', body: data }),

  deleteTemplate: async (id) => call(`/pems/templates/${id}`, { method: 'DELETE' }),

  getFilterOptions: async () => call(`/pems/templates/filters`),

  getTemplateSummary: async () => call(`/pems/templates/summary`),

  getInstances: async (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return call(`/pems/instances${q ? `?${q}` : ''}`);
  },

  getInstanceById: async (id) => call(`/pems/instances/${id}`),

  getInstanceAsins: async (id) => call(`/pems/instances/${id}/asins`),

  transitionStatus: async (id, toStatus, remarks) =>
    call(`/pems/instances/${id}/status`, { method: 'POST', body: { toStatus, remarks } }),

  addComment: async (id, text) =>
    call(`/pems/instances/${id}/comments`, { method: 'POST', body: { text } }),

  uploadEvidence: async (data) =>
    call(`/pems/instances/${data.taskInstanceId}/evidence`, { method: 'POST', body: data }),

  verifyFix: async (id) => call(`/pems/instances/${id}/verify`, { method: 'POST' }),

  completeActivity: async (actId) =>
    call(`/pems/activities/${actId}/complete`, { method: 'POST' }),

  completeSubTask: async (stId) =>
    call(`/pems/subtasks/${stId}/complete`, { method: 'POST' }),

  setBrandCheck: async (taskId, brandId, completed) =>
    call(`/pems/instances/${taskId}/brands/${brandId || 'all'}`, {
      method: 'POST',
      body: { completed },
    }),

  submitReview: async (data) =>
    call('/pems/reviews', { method: 'POST', body: data }),

  getTaskView: async (taskInstanceId) =>
    call(`/pems/instances/${taskInstanceId}/view`),

  getOosContext: async (taskInstanceId, sellerId) =>
    call(`/pems/instances/${taskInstanceId}/oos/context?sellerId=${sellerId}`),

  getOosRuns: async (taskInstanceId, sellerId) =>
    call(`/pems/instances/${taskInstanceId}/oos/sellers/${sellerId}/runs`),

  createOosRun: async (taskInstanceId, sellerId, data) =>
    call(`/pems/instances/${taskInstanceId}/oos/sellers/${sellerId}/runs`, { method: 'POST', body: data }),

  uploadOosFile: async (taskInstanceId, runId, formData) => {
    const res = await fetch(`${API_BASE}/pems/instances/${taskInstanceId}/oos/runs/${runId}/files`, {
      method: 'POST',
      headers: authHeaders(),
      body: formData,
    });
    let payload = null;
    try { payload = await res.json(); } catch { payload = null; }
    if (!res.ok || payload?.success === false) {
      const err = new Error(payload?.error || `Upload failed (${res.status})`);
      err.status = res.status;
      err.code = payload?.code;
      throw err;
    }
    return payload;
  },

  getOosUploads: async (taskInstanceId, runId) =>
    call(`/pems/instances/${taskInstanceId}/oos/runs/${runId}/files`),

  reconcileOosRun: async (taskInstanceId, runId) =>
    call(`/pems/instances/${taskInstanceId}/oos/runs/${runId}/reconcile`, { method: 'POST' }),

  getAffectedAsins: async (taskInstanceId, params = {}) => {
    const q = new URLSearchParams(params).toString();
    return call(`/pems/instances/${taskInstanceId}/oos/affected-asins${q ? `?${q}` : ''}`);
  },

  getAffectedAsinSummary: async (taskInstanceId) =>
    call(`/pems/instances/${taskInstanceId}/oos/affected-asins/summary`),

  getAffectedAsinDetail: async (taskInstanceId, caseId) =>
    call(`/pems/instances/${taskInstanceId}/oos/affected-asins/${caseId}`),

  requestResync: async (taskInstanceId, runId, caseId, data) =>
    call(`/pems/instances/${taskInstanceId}/oos/runs/${runId}/resync/${caseId}`, { method: 'POST', body: data }),

  getResyncStatus: async (taskInstanceId, runId, caseId) =>
    call(`/pems/instances/${taskInstanceId}/oos/runs/${runId}/resync/${caseId}`),

  updateIncident: async (taskInstanceId, caseId, data) =>
    call(`/pems/instances/${taskInstanceId}/oos/incidents/${caseId}`, { method: 'PATCH', body: data }),

  buildExport: async (taskInstanceId, body) =>
    call(`/pems/instances/${taskInstanceId}/oos/exports`, { method: 'POST', body }),

  downloadExport: async (taskInstanceId, exportId) => {
    const res = await fetch(`${API_BASE}/pems/instances/${taskInstanceId}/oos/exports/${exportId}/download`, {
      headers: authHeaders(),
    });
    if (!res.ok) throw new Error('Export download failed');
    return res.blob();
  },

  listExports: async (taskInstanceId) =>
    call(`/pems/instances/${taskInstanceId}/oos/exports`),

  submitOos: async (taskInstanceId, body) =>
    call(`/pems/instances/${taskInstanceId}/oos/submit`, { method: 'POST', body }),

  getSellers: async (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return call(`/pems/sellers${q ? `?${q}` : ''}`);
  },

  getLiveTasks: async (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return call(`/pems/dashboard/live-tasks${q ? `?${q}` : ''}`);
  },

  getAutomationStats: async (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return call(`/pems/automation-stats${q ? `?${q}` : ''}`);
  },
};

export default tasksApi;
