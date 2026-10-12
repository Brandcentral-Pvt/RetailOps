import { Dropdown, Tooltip } from 'antd';
import { Bot, PanelLeft, MoreHorizontal, Pencil, Eraser } from 'lucide-react';

const AIHeader = ({ conversationTitle, onRename, onClear, onDelete, onToggleConv, convHidden, isMobile }) => {
  const moreMenu = {
    items: [
      { key: 'rename', label: 'Rename conversation' },
      { key: 'clear', label: 'Clear chat' },
      { type: 'divider' },
      { key: 'delete', label: 'Delete conversation', danger: true },
    ],
    onClick: ({ key }) => {
      if (key === 'rename') onRename?.();
      else if (key === 'clear') onClear?.();
      else if (key === 'delete') onDelete?.();
    },
  };

  return (
    <header className="ai-ws__topbar">
      <div className="ai-ws__topbar-left">
        {(isMobile || convHidden) && (
          <Tooltip title={isMobile ? 'Conversations' : 'Show conversations'}>
            <button type="button" className="ai-ws__iconbtn" onClick={onToggleConv} aria-label="Toggle conversations">
              <PanelLeft size={16} />
            </button>
          </Tooltip>
        )}

        <div className="ai-ws__topbar-title">
          <Bot size={17} style={{ color: 'var(--ai-accent)' }} />
          <span>RetailOps AI</span>
        </div>
        <div className="ai-ws__topbar-conv" title={conversationTitle}>
          {conversationTitle || 'New conversation'}
        </div>
      </div>

      <div className="ai-ws__topbar-right">
        <Tooltip title="Rename">
          <button type="button" className="ai-ws__iconbtn" onClick={onRename} aria-label="Rename conversation">
            <Pencil size={15} />
          </button>
        </Tooltip>
        <Tooltip title="Clear chat">
          <button type="button" className="ai-ws__iconbtn" onClick={onClear} aria-label="Clear chat">
            <Eraser size={15} />
          </button>
        </Tooltip>
        <Dropdown menu={moreMenu} trigger={['click']}>
          <button type="button" className="ai-ws__iconbtn" aria-label="More actions">
            <MoreHorizontal size={16} />
          </button>
        </Dropdown>
      </div>
    </header>
  );
};

export default AIHeader;