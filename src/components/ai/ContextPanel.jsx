import { useState } from 'react';
import {
  Plus,
  X,
  Database,
  Search,
  Check,
  FunctionSquare,
  Package,
  Users,
  Target,
  Megaphone,
  Keyboard,
  ListChecks,
} from 'lucide-react';

const ENTITY_TYPES = [
  { key: 'seller', label: 'Sellers', icon: Users, unit: 'seller' },
  { key: 'asin', label: 'ASINs', icon: Package, unit: 'ASIN' },
  { key: 'campaign', label: 'Campaigns', icon: Megaphone, unit: 'campaign' },
  { key: 'task', label: 'Tasks', icon: ListChecks, unit: 'task' },
  { key: 'marketplace', label: 'Marketplace', icon: FunctionSquare, unit: 'marketplace' },
  { key: 'date-range', label: 'Date range', icon: Keyboard, unit: 'range' },
];

const STATUS_ICON = { connected: <Check size={12} />, off: <X size={12} /> };

const ContextPanel = ({ scope, tools, session, insights, contextEntities, onAddContext, onRemoveContext }) => {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState(null);
  const [query, setQuery] = useState('');

  const selectKind = (k) => {
    setKind(k);
    setQuery('');
  };

  const addEntity = (label) => {
    const unit = ENTITY_TYPES.find((t) => t.key === kind)?.unit || kind;
    onAddContext?.({ type: kind, label, unit });
    setOpen(false);
    setKind(null);
  };

  const filteredEntities = ENTITY_TYPES.filter((t) => {
    if (!kind) return true;
    return t.key === kind;
  });

  return (
    <aside className="ai-ws__ctx" aria-label="AI context panel">
      <div className="ai-ws__ctx-section">
        <div className="ai-ws__ctx-title">
          <Database size={12} />
          Active scope
        </div>
        <div className="ai-ws__chip-row">
          {scope.map((s) => (
            <span key={s.label} className={s.accent ? 'ai-ws__chip ai-ws__chip--accent' : 'ai-ws__chip'}>
              {s.label}
            </span>
          ))}
          {contextEntities.map((c) => (
            <span key={`${c.type}-${c.label}`} className="ai-ws__chip ai-ws__chip--accent">
              {c.label}
              <button
                type="button"
                onClick={() => onRemoveContext(c)}
                aria-label={`Remove ${c.label}`}
                style={{ border: 'none', background: 'transparent', color: 'inherit', cursor: 'pointer', padding: 0, display: 'inline-flex' }}
              >
                <X size={11} />
              </button>
            </span>
          ))}
        </div>

        {!open ? (
          <button type="button" className="ai-ws__ctx-add" onClick={() => setOpen(true)}>
            <Plus size={13} /> Add context
          </button>
        ) : (
          <div style={{ marginTop: 8 }}>
            <div className="ai-ws__search" style={{ marginTop: 0 }}>
              <span className="ai-ws__icon-abs">
                <Search size={13} />
              </span>
              <input
                type="text"
                autoFocus
                placeholder={kind ? `Search ${ENTITY_TYPES.find((t) => t.key === kind)?.label || ''}…` : 'Search sellers, ASINs, campaigns, tasks…'}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <div style={{ marginTop: 6 }}>
              {filteredEntities.map((t) => {
                const Icon = t.icon;
                const matches = !query.trim() || t.label.toLowerCase().includes(query.toLowerCase());
                if (!matches) return null;
                return (
                  <button
                    key={t.key}
                    type="button"
                    className="ai-ws__ctx-row"
                    style={{ width: '100%', border: 'none', background: 'transparent', cursor: kind ? 'pointer' : 'default' }}
                    onClick={() => (kind ? addEntity(`${t.label} selected`) : selectKind(t.key))}
                    onMouseEnter={() => !kind && setKind(t.key)}
                  >
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <Icon size={13} style={{ color: 'var(--bc-text-muted)' }} />
                      {t.label}
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--bc-text-muted)' }}>{kind ? 'Add' : 'Select'}</span>
                  </button>
                );
              })}
              {!query.trim() && ENTITY_TYPES.filter((t) => t.key === kind).length === 0 && (
                <div style={{ fontSize: 11.5, color: 'var(--bc-text-muted)', padding: '6px 0' }}>
                  {kind ? 'Type to filter results.' : 'Pick an entity group to add context.'}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="ai-ws__ctx-section">
        <div className="ai-ws__ctx-title">Data sources</div>
        {tools.map((t) => (
          <div key={t.key} className="ai-ws__ctx-row">
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              {STATUS_ICON[t.state] || null}
              {t.label}
            </span>
            <strong style={{ fontSize: 11, color: t.state === 'connected' ? 'var(--bc-green-600)' : 'var(--bc-text-muted)' }}>
              {t.state === 'connected' ? 'Connected' : 'Off'}
            </strong>
          </div>
        ))}
      </div>

      <div className="ai-ws__ctx-section">
        <div className="ai-ws__ctx-title">Session</div>
        <div className="ai-ws__ctx-row">
          <span>Messages</span>
          <strong>{session.messages}</strong>
        </div>
        <div className="ai-ws__ctx-row">
          <span>Tools used</span>
          <strong>{session.toolsUsed}</strong>
        </div>
        <div className="ai-ws__ctx-row">
          <span>Data sources</span>
          <strong>{session.dataSources}</strong>
        </div>
      </div>

      {insights.length ? (
        <div className="ai-ws__ctx-section">
          <div className="ai-ws__ctx-title">Insights</div>
          {insights.map((ins) => (
            <div key={ins.label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, padding: '3px 0' }}>
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  background: ins.type === 'critical' ? 'var(--dash-danger)' : ins.type === 'warn' ? 'var(--dash-warning)' : 'var(--bc-green-600)',
                }}
              />
              {ins.label}
              <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--bc-text-muted)' }}>{ins.count}</span>
            </div>
          ))}
        </div>
      ) : null}

      <div style={{ padding: '10px 14px', fontSize: 11, color: 'var(--bc-text-muted)', lineHeight: 1.5 }}>
        {kind ? (
          <span>
            <Target size={11} style={{ verticalAlign: -1 }} /> Context is scoped to the current investigation. Added items are sent with your next
            message.
          </span>
        ) : (
          <span>
            The AI works with the scope, tools and entities you see here. Add context to focus its analysis.
          </span>
        )}
      </div>
    </aside>
  );
};

export default ContextPanel;