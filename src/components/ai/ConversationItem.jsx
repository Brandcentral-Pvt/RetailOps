import { Dropdown } from 'antd';
import { Pin, Pencil, Trash2, Archive, MoreHorizontal, History, Database } from 'lucide-react';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

const ConversationItem = ({ conv, active, onSelect, onRename, onDelete, onPin, onArchive, pinned }) => {
  const menu = {
    items: [
      {
        key: 'pin',
        label: (
          <span className="inline-flex items-center gap-2">
            <Pin size={13} />
            {pinned ? 'Unpin' : 'Pin'}
          </span>
        ),
      },
      {
        key: 'rename',
        label: (
          <span className="inline-flex items-center gap-2">
            <Pencil size={13} />
            Rename
          </span>
        ),
      },
      {
        key: 'archive',
        label: (
          <span className="inline-flex items-center gap-2">
            <Archive size={13} />
            Archive
          </span>
        ),
      },
      { type: 'divider' },
      {
        key: 'delete',
        label: (
          <span className="inline-flex items-center gap-2" style={{ color: 'var(--dash-danger)' }}>
            <Trash2 size={13} />
            Delete
          </span>
        ),
        danger: true,
      },
    ],
    onClick: ({ key, domEvent }) => {
      domEvent.stopPropagation();
      if (key === 'pin') onPin?.(conv);
      else if (key === 'rename') onRename?.(conv);
      else if (key === 'archive') onArchive?.(conv);
      else if (key === 'delete') onDelete?.(conv);
    },
  };

  const hasTool = !!conv.LastToolUsed;

  return (
    <div
      className={`ai-ws__item ${active ? 'ai-ws__item--active' : ''}`}
      role="button"
      tabIndex={0}
      onClick={() => onSelect(conv)}
      onKeyDown={(e) => e.key === 'Enter' && onSelect(conv)}
    >
      <span className="ai-ws__item-meta" style={{ gap: 6 }}>
        {pinned ? <Pin size={12} style={{ color: 'var(--ai-accent)' }} /> : <History size={12} />}
      </span>
      <span className="ai-ws__item-title">{conv.Title || 'Untitled'}</span>
      <span className="ai-ws__item-meta">
        {hasTool ? (
          <span className="ai-ws__badge">
            <Database size={9} /> Data
          </span>
        ) : null}
        <span className="ai-ws__item-time">{conv.UpdatedAt ? dayjs(conv.UpdatedAt).fromNow() : ''}</span>
      </span>
      <Dropdown menu={menu} trigger={['click']}>
        <button
          type="button"
          className="ai-ws__item-menu"
          aria-label="Conversation actions"
          onClick={(e) => e.stopPropagation()}
        >
          <MoreHorizontal size={13} />
        </button>
      </Dropdown>
    </div>
  );
};

export default ConversationItem;