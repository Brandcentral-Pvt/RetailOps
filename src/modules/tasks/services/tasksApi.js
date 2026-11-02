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

async function callForm(path, formData) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: authHeaders(),
    body: formData,
  });
  let payload = null;
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

async function callDownload(path) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'GET',
    headers: authHeaders(),
  });
  if (!res.ok) {
    const payload = await res.json().catch(() => ({}));
    throw new Error(payload?.error || `Download failed (${res.status})`);
  }
  return res.blob();
}

const tasksApi = {
  // ── Templates ──
  getTemplates: async (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return call(`/pems/templates${q ? `?${q}` : ''}`);
  },

  getTemplateById: async (id) => call(`/pems/templates/${id}`),

  getTemplateDetail: async (id) => call(`/pems/templates/${id}/detail`),

  getTemplateSummary: async () => call(`/pems/templates/summary`),

  getFilterOptions: async () => call(`/pems/templates/filters`),

  createTemplate: async (data) => call(`/pems/templates`, { method: 'POST', body: data }),

  updateTemplate: async (id, data) => call(`/pems/templates/${id}`, { method: 'PUT', body: data }),

  deleteTemplate: async (id) => call(`/pems/templates/${id}`, { method: 'DELETE' }),

  validateTemplate: async (data) => call(`/pems/templates/validate`, { method: 'POST', body: data }),

  saveTemplateConfig: async (id, data) => call(`/pems/templates/config/${id}`, { method: 'PUT', body: data }),

  upsertAssignmentRules: async (templateId, data) =>
    call(`/pems/templates/${templateId}/assignment-rules`, { method: 'PUT', body: data }),

  // ── Task Instances ──
  getInstances: async (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return call(`/pems/instances${q ? `?${q}` : ''}`);
  },

  getInstanceById: async (id) => call(`/pems/instances/${id}`),

  createInstance: async (data) => call(`/pems/instances`, { method: 'POST', body: data }),

  transitionStatus: async (id, toStatus, remarks) =>
    call(`/pems/instances/${id}/status`, { method: 'POST', body: { toStatus, remarks } }),

  bulkTransition: async (data) => call(`/pems/instances/bulk/transition`, { method: 'POST', body: data }),

  addComment: async (id, text) =>
    call(`/pems/instances/${id}/comments`, { method: 'POST', body: { text } }),

  verifyFix: async (id) => call(`/pems/instances/${id}/verify-fix`, { method: 'POST' }),

  updateAchievement: async (id, data) =>
    call(`/pems/instances/${id}/achievement`, { method: 'PUT', body: data }),

  setBrandCheck: async (taskId, brandId, completed) =>
    call(`/pems/instances/${taskId}/brands/${brandId || 'all'}`, {
      method: 'PUT',
      body: { completed },
    }),

  getInstanceAsins: async (id) => call(`/pems/instances/${id}/asins`),

  updateAsinRemarks: async (id, asinId, data) =>
    call(`/pems/instances/${id}/asins/${asinId}/remarks`, { method: 'POST', body: data }),

  resolveAsin: async (id, asinId, data) =>
    call(`/pems/instances/${id}/asins/${asinId}/resolve`, { method: 'POST', body: data }),

  // ── Sub Tasks & Activities ──
  completeSubTask: async (stId) =>
    call(`/pems/subtasks/${stId}/complete`, { method: 'POST' }),

  completeActivity: async (actId) =>
    call(`/pems/activities/${actId}/complete`, { method: 'POST' }),

  // ── Evidence ──
  uploadEvidence: async (data) =>
    call(`/pems/evidence`, { method: 'POST', body: data }),

  // ── OOS (task-bound) ──
  getTaskView: async (taskInstanceId) =>
    call(`/pems/instances/${taskInstanceId}/view`),

  getOosContext: async (taskInstanceId, runId) =>
    call(`/pems/instances/${taskInstanceId}/oos/context?runId=${runId}`),

  getOosRuns: async (taskInstanceId, sellerId) =>
    call(`/pems/instances/${taskInstanceId}/oos/sellers/${sellerId}/runs`),

  createOosRun: async (taskInstanceId, sellerId, data) =>
    call(`/pems/instances/${taskInstanceId}/oos/sellers/${sellerId}/runs`, { method: 'POST', body: data }),

  uploadOosFile: async (taskInstanceId, runId, formData) =>
    callForm(`/pems/instances/${taskInstanceId}/oos/runs/${runId}/files`, formData),

  getOosUploads: async (taskInstanceId, runId) =>
    call(`/pems/instances/${taskInstanceId}/oos/runs/${runId}/files`),

  downloadOosImport: async (taskInstanceId, importId) =>
    callDownload(`/pems/instances/${taskInstanceId}/oos/imports/${importId}/download`),

  reconcileOosRun: async (taskInstanceId, runId) =>
    call(`/pems/instances/${taskInstanceId}/oos/runs/${runId}/reconcile`, { method: 'POST' }),

  uploadInventory: async (taskInstanceId, runId, vendorCentralFile, brandCentralFile) => {
    const formData = new FormData();
    if (vendorCentralFile) formData.append('vendorCentralFile', vendorCentralFile);
    if (brandCentralFile) formData.append('brandCentralFile', brandCentralFile);
    return callForm(`/pems/instances/${taskInstanceId}/oos/runs/${runId}/inventory-upload`, formData);
  },

  getAffectedAsins: async (taskInstanceId, runId, params = {}) => {
    const q = new URLSearchParams({ ...params, runId }).toString();
    return call(`/pems/instances/${taskInstanceId}/oos/affected-asins?${q}`);
  },

  getAffectedAsinSummary: async (taskInstanceId, runId) =>
    call(`/pems/instances/${taskInstanceId}/oos/affected-asins/summary?runId=${runId}`),

  getAffectedAsinDetail: async (taskInstanceId, caseId) =>
    call(`/pems/instances/${taskInstanceId}/oos/affected-asins/${caseId}`),

  requestResync: async (taskInstanceId, runId, caseId, data) =>
    call(`/pems/instances/${taskInstanceId}/oos/runs/${runId}/resync/${caseId}`, { method: 'POST', body: data }),

  getResyncStatus: async (taskInstanceId, runId, caseId) =>
    call(`/pems/instances/${taskInstanceId}/oos/runs/${runId}/resync/${caseId}`),

  verifyResync: async (taskInstanceId, runId, caseId) =>
    call(`/pems/instances/${taskInstanceId}/oos/runs/${runId}/resync/${caseId}/verify`, { method: 'POST' }),

  resolveIncident: async (taskInstanceId, caseId, data) =>
    call(`/pems/instances/${taskInstanceId}/oos/incidents/${caseId}/resolve`, { method: 'POST', body: data }),

  updateIncident: async (taskInstanceId, caseId, data) =>
    call(`/pems/instances/${taskInstanceId}/oos/incidents/${caseId}`, { method: 'PATCH', body: data }),

  buildExport: async (taskInstanceId, runId) =>
    call(`/pems/instances/${taskInstanceId}/oos/exports`, { method: 'POST', body: { runId } }),

  downloadExport: async (taskInstanceId, exportId) =>
    callDownload(`/pems/instances/${taskInstanceId}/oos/exports/${exportId}/download`),

  listExports: async (taskInstanceId, runId) =>
    call(`/pems/instances/${taskInstanceId}/oos/exports`),

  submitOos: async (taskInstanceId, body) =>
    call(`/pems/instances/${taskInstanceId}/oos/submit`, { method: 'POST', body }),

  reviewOos: async (taskInstanceId, body) =>
    call(`/pems/instances/${taskInstanceId}/oos/review`, { method: 'POST', body }),

  // ── Reviews ──
  submitReview: async (data) =>
    call('/pems/reviews', { method: 'POST', body: data }),

  bulkReview: async (data) =>
    call('/pems/reviews/bulk', { method: 'POST', body: data }),

  getReviewStats: async () => call('/pems/reviews/stats'),

  getReviewers: async () => call('/pems/reviewers'),

  // ── My Day & Dashboard ──
  getMyDay: async () => call('/pems/my-day'),

  getDashboardKPIs: async () => call('/pems/dashboard/kpis'),

  getDashboardSummary: async () => call('/pems/dashboard/summary'),

  getLiveTasks: async (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return call(`/pems/dashboard/live-tasks${q ? `?${q}` : ''}`);
  },

  getActivityFeed: async () => call('/pems/dashboard/activity-feed'),

  getAutomationStats: async (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return call(`/pems/automation-stats${q ? `?${q}` : ''}`);
  },

  // ── Sellers & Users ──
  getSellers: async (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return call(`/pems/sellers${q ? `?${q}` : ''}`);
  },

  getBrandManagers: async (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return call(`/pems/brand-managers${q ? `?${q}` : ''}`);
  },

  getReviewers: async () => call('/pems/reviewers'),

  // ── Daily Routine ──
  importDailyOps: async (data) => call('/pems/routine/import', { method: 'POST', body: data }),

  generateRoutineToday: async () => call('/pems/routine/generate', { method: 'POST' }),
};

export default tasksApi;