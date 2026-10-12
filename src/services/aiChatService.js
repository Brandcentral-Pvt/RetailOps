const API_BASE = import.meta.env.VITE_API_URL || '/api';

const getAuthHeader = () => {
  const token = localStorage.getItem('authToken');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const getJsonHeader = () => ({
  'Content-Type': 'application/json',
  ...getAuthHeader(),
});

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...getAuthHeader(),
      ...(options.headers || {}),
    },
  });

  if (res.status === 401) {
    const err = new Error('Authentication required. Please sign in again.');
    err.status = 401;
    throw err;
  }

  const contentType = res.headers.get('content-type') || '';
  const body = contentType.includes('application/json') ? await res.json().catch(() => ({})) : await res.text();

  if (!res.ok) {
    const message = body?.error || body?.message || `Request failed (${res.status})`;
    const err = new Error(message);
    err.status = res.status;
    throw err;
  }

  return body;
}

export const aiChatApi = {
  getModels: () => request('/ai/models'),
  getUsage: () => request('/ai/usage'),
  getStats: () => request('/ai/stats'),

  listConversations: (limit = 50, offset = 0) =>
    request(`/ai/chat/conversations?limit=${limit}&offset=${offset}`),

  getConversation: (id, limit = 100) =>
    request(`/ai/chat/conversations/${id}?limit=${limit}`),

  createConversation: (title = 'New Conversation', metadata = {}) =>
    request('/ai/chat/conversations', { method: 'POST', body: JSON.stringify({ title, metadata }) }),

  updateConversationTitle: (id, title) =>
    request(`/ai/chat/conversations/${id}`, { method: 'PUT', body: JSON.stringify({ title }) }),

  deleteConversation: (id) =>
    request(`/ai/chat/conversations/${id}`, { method: 'DELETE' }),

  sendMessage: (id, payload) =>
    request(`/ai/chat/conversations/${id}/messages`, { method: 'POST', body: JSON.stringify(payload) }),
};

export async function streamConversation(id, payload, onEvent, signal) {
  const res = await fetch(`${API_BASE}/ai/chat/conversations/${id}/stream`, {
    method: 'POST',
    headers: getJsonHeader(),
    body: JSON.stringify(payload),
    signal,
  });

  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      message = body.error || body.message || message;
    } catch { /* ignore */ }
    throw new Error(message);
  }
  if (!res.body) throw new Error('Streaming is not supported by this browser');

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split('\n\n');
    buffer = events.pop() || '';

    for (const raw of events) {
      const dataLine = raw.split('\n').find((l) => l.startsWith('data:'));
      if (!dataLine) continue;
      try {
        const data = JSON.parse(dataLine.slice(5).trim());
        onEvent(data);
      } catch {
        /* ignore malformed frame */
      }
    }
  }

  if (buffer.trim()) {
    const dataLine = buffer.split('\n').find((l) => l.startsWith('data:'));
    if (dataLine) {
      try {
        onEvent(JSON.parse(dataLine.slice(5).trim()));
      } catch { /* ignore */ }
    }
  }
}

export const aiChatService = {
  getModels: aiChatApi.getModels,
  getUsage: aiChatApi.getUsage,
  getStats: aiChatApi.getStats,
  listConversations: aiChatApi.listConversations,
  getConversation: aiChatApi.getConversation,
  createConversation: aiChatApi.createConversation,
  updateConversationTitle: aiChatApi.updateConversationTitle,
  deleteConversation: aiChatApi.deleteConversation,
  sendMessage: aiChatApi.sendMessage,
  streamConversation,
};

export default aiChatService;