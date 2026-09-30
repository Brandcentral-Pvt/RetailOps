const API_BASE = import.meta.env?.VITE_API_URL || '/api';

const authHeaders = () => {
  const token = localStorage.getItem('authToken');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const tasksApi = {
  // ── Templates ──
  getTemplates: async (params = {}) => {
    const q = new URLSearchParams(params).toString();
    const res = await fetch(`${API_BASE}/pems/templates${q ? `?${q}` : ''}`, { headers: authHeaders() });
    if (!res.ok) throw new Error('Failed to fetch templates');
    return res.json();
  },

  getTemplateById: async (id) => {
    const res = await fetch(`${API_BASE}/pems/templates/${id}`, { headers: authHeaders() });
    if (!res.ok) throw new Error('Failed to fetch template');
    return res.json();
  },

  createTemplate: async (data) => {
    const res = await fetch(`${API_BASE}/pems/templates`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to create template');
    return res.json();
  },

  updateTemplate: async (id, data) => {
    const res = await fetch(`${API_BASE}/pems/templates/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to update template');
    return res.json();
  },

  deleteTemplate: async (id) => {
    const res = await fetch(`${API_BASE}/pems/templates/${id}`, { method: 'DELETE', headers: authHeaders() });
    if (!res.ok) throw new Error('Failed to delete template');
    return res.json();
  },

  getFilterOptions: async () => {
    const res = await fetch(`${API_BASE}/pems/templates/filters`, { headers: authHeaders() });
    if (!res.ok) throw new Error('Failed to fetch filter options');
    return res.json();
  },

  // ── Task Instances ──
  getInstances: async (params = {}) => {
    const q = new URLSearchParams(params).toString();
    const res = await fetch(`${API_BASE}/pems/instances${q ? `?${q}` : ''}`, { headers: authHeaders() });
    if (!res.ok) throw new Error('Failed to fetch instances');
    return res.json();
  },

  getInstanceById: async (id) => {
    const res = await fetch(`${API_BASE}/pems/instances/${id}`, { headers: authHeaders() });
    if (!res.ok) throw new Error('Failed to fetch instance');
    return res.json();
  },

  createInstance: async (data) => {
    const res = await fetch(`${API_BASE}/pems/instances`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to create instance');
    return res.json();
  },

  transitionStatus: async (id, toStatus, details = '') => {
    const res = await fetch(`${API_BASE}/pems/instances/${id}/transition`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ toStatus, details }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || 'Failed to transition status');
    return body;
  },

  bulkTransition: async (ids, toStatus, details = '') => {
    const res = await fetch(`${API_BASE}/pems/instances/bulk/transition`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ ids, toStatus, details }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body?.error || 'Failed to bulk transition');
    }
    return res.json();
  },

  updateAchievement: async (id, achievement) => {
    const res = await fetch(`${API_BASE}/pems/instances/${id}/achievement`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ achievement }),
    });
    if (!res.ok) throw new Error('Failed to update achievement');
    return res.json();
  },

  // ── Sub Tasks & Activities ──
  completeSubTask: async (subTaskId) => {
    const res = await fetch(`${API_BASE}/pems/subtasks/${subTaskId}/complete`, {
      method: 'POST', headers: authHeaders(),
    });
    if (!res.ok) throw new Error('Failed to complete subtask');
    return res.json();
  },

  completeActivity: async (activityId) => {
    const res = await fetch(`${API_BASE}/pems/activities/${activityId}/complete`, {
      method: 'POST', headers: authHeaders(),
    });
    if (!res.ok) throw new Error('Failed to complete activity');
    return res.json();
  },

  // ── Evidence ──
  uploadEvidence: async (data) => {
    const res = await fetch(`${API_BASE}/pems/evidence`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to upload evidence');
    return res.json();
  },

  // ── Reviews ──
  // Review + workflow transition happen atomically on the server
  // (claim → record → decide). Do NOT call transitionStatus afterwards.
  submitReview: async (data) => {
    const res = await fetch(`${API_BASE}/pems/reviews`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: JSON.stringify(data),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || 'Failed to submit review');
    return body;
  },

  // { ids, decision: 'APPROVE'|'REJECT', feedback } → { data: { reviewed:[{id,to}], skipped:[{id,reason}] } }
  bulkReview: async ({ ids, decision, feedback = '' }) => {
    const res = await fetch(`${API_BASE}/pems/reviews/bulk`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: JSON.stringify({ ids, decision, feedback }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || 'Bulk review failed');
    return body;
  },

  // ── Daily routine (Daily Operations Master) ──
  importDailyOps: async ({ rows, overrides, dryRun = true, generateNow = true }) => {
    const res = await fetch(`${API_BASE}/pems/routine/import`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ rows, overrides, dryRun, generateNow }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || body.success === false) throw new Error(body.message || 'Import failed');
    return body.data;
  },
  generateRoutineToday: async (templateId) => {
    const res = await fetch(`${API_BASE}/pems/routine/generate`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: JSON.stringify({ templateId }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || body.success === false) throw new Error(body.message || 'Could not generate today\'s routine');
    return body.data;
  },

  // Everything the current user has to act on (optionally a teammate's day for global roles).
  getMyDay: async (userId) => {
    const q = userId ? `?userId=${encodeURIComponent(userId)}` : '';
    const res = await fetch(`${API_BASE}/pems/my-day${q}`, { headers: authHeaders() });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || 'Failed to load your day');
    return body;
  },

  getReviewStats: async () => {
    const res = await fetch(`${API_BASE}/pems/reviews/stats`, { headers: authHeaders() });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || 'Failed to load review stats');
    return body;
  },

  // ── Dashboard (Legacy) ──
  getDashboardKPIs: async (params = {}) => {
    const q = new URLSearchParams(params).toString();
    const res = await fetch(`${API_BASE}/pems/dashboard/kpis${q ? `?${q}` : ''}`, { headers: authHeaders() });
    if (!res.ok) throw new Error('Failed to fetch dashboard KPIs');
    return res.json();
  },

  getSellerPerformance: async (params = {}) => {
    const q = new URLSearchParams(params).toString();
    const res = await fetch(`${API_BASE}/pems/dashboard/seller-performance${q ? `?${q}` : ''}`, { headers: authHeaders() });
    if (!res.ok) throw new Error('Failed to fetch seller performance');
    return res.json();
  },

  refreshSLA: async () => {
    const res = await fetch(`${API_BASE}/pems/dashboard/refresh-sla`, { method: 'POST', headers: authHeaders() });
    if (!res.ok) throw new Error('Failed to refresh SLA');
    return res.json();
  },

  // ── V2: Notifications ──
  getNotifications: async (params = {}) => {
    const q = new URLSearchParams(params).toString();
    const res = await fetch(`${API_BASE}/pems/notifications${q ? `?${q}` : ''}`, { headers: authHeaders() });
    if (!res.ok) throw new Error('Failed to fetch notifications');
    return res.json();
  },

  markNotificationRead: async (id) => {
    const res = await fetch(`${API_BASE}/pems/notifications/${id}/read`, { method: 'POST', headers: authHeaders() });
    if (!res.ok) throw new Error('Failed');
    return res.json();
  },

  markAllNotificationsRead: async () => {
    const res = await fetch(`${API_BASE}/pems/notifications/read-all`, { method: 'POST', headers: authHeaders() });
    if (!res.ok) throw new Error('Failed');
    return res.json();
  },

  // ── V2: Department & Analytics ──
  getDepartmentPerformance: async (params = {}) => {
    const q = new URLSearchParams(params).toString();
    const res = await fetch(`${API_BASE}/pems/dashboard/department-performance${q ? `?${q}` : ''}`, { headers: authHeaders() });
    if (!res.ok) throw new Error('Failed');
    return res.json();
  },

  getBrandManagerPerformance: async (params = {}) => {
    const q = new URLSearchParams(params).toString();
    const res = await fetch(`${API_BASE}/pems/dashboard/brand-manager-performance${q ? `?${q}` : ''}`, { headers: authHeaders() });
    if (!res.ok) throw new Error('Failed');
    return res.json();
  },

  getReviewerPerformance: async (params = {}) => {
    const q = new URLSearchParams(params).toString();
    const res = await fetch(`${API_BASE}/pems/dashboard/reviewer-performance${q ? `?${q}` : ''}`, { headers: authHeaders() });
    if (!res.ok) throw new Error('Failed');
    return res.json();
  },

  getRiskPanel: async () => {
    const res = await fetch(`${API_BASE}/pems/dashboard/risk-panel`, { headers: authHeaders() });
    if (!res.ok) throw new Error('Failed');
    return res.json();
  },

  getTopPerformers: async () => {
    const res = await fetch(`${API_BASE}/pems/dashboard/top-performers`, { headers: authHeaders() });
    if (!res.ok) throw new Error('Failed');
    return res.json();
  },

  checkEscalations: async () => {
    const res = await fetch(`${API_BASE}/pems/dashboard/check-escalations`, { method: 'POST', headers: authHeaders() });
    if (!res.ok) throw new Error('Failed');
    return res.json();
  },

  // ── V2: Dynamic Data Sources ──
  getSellers: async (params = {}) => {
    const q = new URLSearchParams(params).toString();
    const res = await fetch(`${API_BASE}/pems/sellers${q ? `?${q}` : ''}`, { headers: authHeaders() });
    if (!res.ok) throw new Error('Failed');
    return res.json();
  },

  getBrandManagers: async () => {
    const res = await fetch(`${API_BASE}/pems/brand-managers`, { headers: authHeaders() });
    if (!res.ok) throw new Error('Failed');
    return res.json();
  },

  getReviewers: async () => {
    const res = await fetch(`${API_BASE}/pems/reviewers`, { headers: authHeaders() });
    if (!res.ok) throw new Error('Failed');
    return res.json();
  },

  // ── V2: Consolidated Dashboard (3 endpoints) ──
  getDashboardSummary: async (params = {}) => {
    const q = new URLSearchParams(params).toString();
    const res = await fetch(`${API_BASE}/pems/dashboard/summary${q ? `?${q}` : ''}`, { headers: authHeaders() });
    if (!res.ok) throw new Error('Failed to fetch dashboard summary');
    return res.json();
  },

  getLiveTasks: async (params = {}) => {
    const q = new URLSearchParams(params).toString();
    const res = await fetch(`${API_BASE}/pems/dashboard/live-tasks${q ? `?${q}` : ''}`, { headers: authHeaders() });
    if (!res.ok) throw new Error('Failed to fetch live tasks');
    return res.json();
  },

  getActivityFeed: async () => {
    const res = await fetch(`${API_BASE}/pems/dashboard/activity-feed`, { headers: authHeaders() });
    if (!res.ok) throw new Error('Failed to fetch activity feed');
    return res.json();
  },

  // ── V3: Template Detail + Assignment Rules ──
  getTemplateDetail: async (id) => {
    const res = await fetch(`${API_BASE}/pems/templates/${id}/detail`, { headers: authHeaders() });
    if (!res.ok) throw new Error('Failed to fetch template detail');
    return res.json();
  },

  upsertAssignmentRules: async (templateId, data) => {
    const res = await fetch(`${API_BASE}/pems/templates/${templateId}/assignment-rules`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed');
    return res.json();
  },

  recalculateProgress: async () => {
    const res = await fetch(`${API_BASE}/pems/recalculate-progress`, { method: 'POST', headers: authHeaders() });
    if (!res.ok) throw new Error('Failed');
    return res.json();
  },

  verifyFix: async (taskId) => {
    const res = await fetch(`${API_BASE}/pems/instances/${taskId}/verify-fix`, { method: 'POST', headers: authHeaders() });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || 'Verification failed');
    return body;
  },

  addComment: async (taskId, text) => {
    const res = await fetch(`${API_BASE}/pems/instances/${taskId}/comments`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: JSON.stringify({ text }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || 'Failed to add comment');
    return body;
  },

  // ── Automation / ruleset linkage ──
  getAutomationStats: async () => {
    const r = await fetchJson('/pems/automation-stats');
    return r.data;
  },
};

export default tasksApi;
