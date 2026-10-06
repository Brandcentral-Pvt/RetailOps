import { useMemo } from 'react';
import { Button, Skeleton } from 'antd';
import { Plus, Search, Bot, Sparkles } from 'lucide-react';
import dayjs from 'dayjs';
import ConversationItem from './ConversationItem';
import { formatTokens } from './aiUtils';

const GROUP_ORDER = ['today', 'this-week', 'earlier'];

const groupLabel = {
  saved: 'SAVED',
  today: 'TODAY',
  'this-week': 'THIS WEEK',
  earlier: 'EARLIER',
};

const groupFor = (conv) => {
  const d = conv.UpdatedAt ? dayjs(conv.UpdatedAt) : dayjs();
  const days = dayjs().startOf('day').diff(d.startOf('day'), 'day');
  if (days <= 0) return 'today';
  if (days <= 6) return 'this-week';
  return 'earlier';
};

const ConversationSidebar = ({
  conversations,
  pinned,
  currentId,
  loading,
  search,
  onSearch,
  onSelect,
  onNew,
  onPin,
  onArchive,
  onDelete,
  onRename,
  usage,
  usageLoading,
  modelCount,
}) => {
  const groups = useMemo(() => {
    const q = (search || '').trim().toLowerCase();
    const filtered = q
      ? conversations.filter((c) => (c.Title || '').toLowerCase().includes(q))
      : conversations;

    const buckets = { saved: [], today: [], 'this-week': [], earlier: [] };
    filtered.forEach((c) => {
      if (pinned.has(c.Id)) buckets.saved.push(c);
      else buckets[groupFor(c)].push(c);
    });
    return Object.entries(buckets)
      .filter(([, v]) => v.length)
      .sort(([a], [b]) => (a === 'saved' ? -1 : b === 'saved' ? 1 : GROUP_ORDER.indexOf(a) - GROUP_ORDER.indexOf(b)));
  }, [conversations, pinned, search]);

  const total = Number(usage?.monthlyTokenLimit || usage?.totalTokensLimit || 0);
  const used = Number(usage?.totalTokensUsed || 0);
  const pct = total ? Math.min(100, Math.round((used / total) * 100)) : 0;

  return (
    <aside className="ai-ws__conv">
      <div className="ai-ws__conv-head">
        <div className="ai-ws__logo">
          <Bot size={16} />
        </div>
        <div>
          <div className="ai-ws__conv-title">RetailOps AI</div>
          <div className="ai-ws__conv-sub">Operations Intelligence</div>
        </div>
      </div>

      <div className="ai-ws__conv-actions">
        <Button
          type="primary"
          block
          icon={<Plus size={14} />}
          onClick={onNew}
          style={{ height: 32, fontSize: 12.5, borderRadius: 8 }}
        >
          New conversation
        </Button>
        <div className="ai-ws__search">
          <span className="ai-ws__icon-abs">
            <Search size={13} />
          </span>
          <input
            type="text"
            placeholder="Search conversations…"
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            aria-label="Search conversations"
          />
        </div>
      </div>

      <div className="ai-ws__conv-list">
        {loading ? (
          <div style={{ padding: '0 6px', marginTop: 10 }}>
            {[1, 2, 3].map((n) => (
              <Skeleton key={n} active avatar={{ size: 26 }} paragraph={{ rows: 1, width: '72%' }} title={false} style={{ marginBottom: 10 }} />
            ))}
          </div>
        ) : groups.length ? (
          groups.map(([key, items]) => (
            <div key={key}>
              <div className="ai-ws__conv-group">
                <div className="ai-ws__conv-group-label">{groupLabel[key]}</div>
                {items.map((conv) => (
                  <ConversationItem
                    key={conv.Id}
                    conv={conv}
                    active={currentId === conv.Id}
                    pinned={pinned.has(conv.Id)}
                    onSelect={onSelect}
                    onPin={onPin}
                    onArchive={onArchive}
                    onDelete={onDelete}
                    onRename={onRename}
                  />
                ))}
              </div>
            </div>
          ))
        ) : (
          <div style={{ padding: '26px 10px', textAlign: 'center', fontSize: 12, color: 'var(--bc-text-muted)' }}>
            <Search size={16} style={{ opacity: 0.5, marginBottom: 6 }} />
            <div>{search ? 'No conversations match.' : 'Start a new conversation to begin.'}</div>
          </div>
        )}
      </div>

      <div className="ai-ws__conv-foot">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11, color: 'var(--bc-text-muted)', marginBottom: 6 }}>
          <span>Token usage</span>
          <span>{pct}%</span>
        </div>
        <div className="ai-ws__usage-bar">
          <span className="ai-ws__usage-fill" style={{ width: `${pct}%` }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 11, color: 'var(--bc-text-muted)' }}>
          <span>{usageLoading ? 'Loading…' : `${formatTokens(used) || 0} / ${formatTokens(total) || '—'}`}</span>
          <span>
            <Sparkles size={10} style={{ verticalAlign: -1 }} /> {modelCount} models
          </span>
        </div>
      </div>
    </aside>
  );
};

export default ConversationSidebar;