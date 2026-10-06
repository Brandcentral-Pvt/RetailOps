export const CONTEXT_LABEL = {
  1000000: '1M',
  1048576: '1M',
  128000: '128K',
  102400: '100K',
  65536: '64K',
  32768: '32K',
  16384: '16K',
};

export const formatTokens = (n) => {
  if (n == null || Number.isNaN(Number(n))) return null;
  const v = Number(n);
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
  return String(v);
};

export const formatINR = (n) => {
  if (n == null || Number.isNaN(Number(n))) return '—';
  const v = Number(n);
  const abs = Math.abs(v);
  const sign = v < 0 ? '−' : '';
  if (abs >= 1e7) return `${sign}₹${(abs / 1e7).toFixed(1)}L`;
  if (abs >= 1e5) return `${sign}₹${(abs / 1e5).toFixed(1)}L`;
  if (abs >= 1e3) return `${sign}₹${(abs / 1e3).toFixed(1)}K`;
  return `${sign}₹${v.toFixed(0)}`;
};

export const greetingFor = (firstName) => {
  const h = new Date().getHours();
  const part = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  const name = firstName || 'there';
  return `${part}, ${name}.`;
};

export const severityTag = (value) => {
  const s = String(value || '').toLowerCase();
  if (s.startsWith('crit') || s.includes('critical')) return 'crit';
  if (s.startsWith('high') || s.includes('high')) return 'high';
  if (s.startsWith('warn')) return 'high';
  return 'ok';
};

export const normalizeModels = (raw) => {
  if (!Array.isArray(raw) || raw.length === 0) return [];
  const toCategory = (m) =>
    m.category && String(m.category).toLowerCase() === 'subscription'
      ? 'Subscription'
      : 'Free';
  return raw
    .map((m) => ({
      id: m.id || m.ModelId || m.model || '',
      name: m.name || m.displayName || m.id || m.model || '',
      category: toCategory(m),
      context: m.context || m.contextWindow || m.contextLength || null,
      notes: m.notes || m.description || '',
    }))
    .filter((m) => m.id && m.name);
};