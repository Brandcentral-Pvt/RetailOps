import { Dropdown, Tooltip } from 'antd';
import { Bot, Share2, Download, MoreHorizontal, PanelLeft, PanelRight, Copy, FileText, Sheet, Braces } from 'lucide-react';

const EXPORT_ITEMS = [
  { key: 'export:copy', icon: <Copy size={14} />, label: 'Copy transcript' },
  { key: 'export:md', icon: <FileText size={14} />, label: 'Markdown (.md)' },
  { key: 'export:csv', icon: <Sheet size={14} />, label: 'CSV (.csv)' },
  { key: 'export:json', icon: <Braces size={14} />, label: 'JSON (.json)' },
];

const AIHeader = ({
  conversationTitle,
  scopeChips = [],
  onShare,
  onExport,
  onRename,
  onClear,
  onToggleConv,
  onToggleContext,
  convHidden,
  contextHidden,
  isMobile,
}) => {
  const moreMenu = {
    items: [
      { key: 'share', label: 'Share conversation' },
      { type: 'divider' },
      { type: 'label', label: 'Export' },
      ...EXPORT_ITEMS.map((e) => ({
        key: e.key,
        label: (
          <span className="inline-flex items-center gap-2">
            {e.icon}
            {e.label}
          </span>
        ),
      })),
      { type: 'divider' },
      { key: 'rename', label: 'Rename' },
      { key: 'clear', label: 'Clear chat' },
    ],
    onClick: ({ key }) => {
      if (key === 'share') onShare?.();
      else if (key === 'rename') onRename?.();
      else if (key === 'clear') onClear?.();
      else if (key.startsWith('export:')) onExport?.(key.slice(7));
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
          {conversationTitle || 'New investigation'}
        </div>

        <div className="ai-ws__scope-chips">
          {scopeChips.filter((c) => c.show !== false).map((c) => (
            <span key={c.label} className={c.accent ? 'ai-ws__badge' : 'ai-ws__chip'} style={{ cursor: 'default' }}>
              {c.icon}
              {c.label}
            </span>
          ))}
        </div>
      </div>

      <div className="ai-ws__topbar-right">
        {(isMobile || !contextHidden) && (
          <Tooltip title={isMobile ? 'Open context' : 'Toggle context panel'}>
            <button type="button" className="ai-ws__iconbtn" onClick={onToggleContext} aria-label="Toggle context panel">
              <PanelRight size={16} />
            </button>
          </Tooltip>
        )}

        <Tooltip title="Share">
          <button type="button" className="ai-ws__iconbtn" onClick={onShare} aria-label="Share">
            <Share2 size={15} />
          </button>
        </Tooltip>
        <Tooltip title="Export">
          <button type="button" className="ai-ws__iconbtn" onClick={() => onExport?.('md')} aria-label="Export">
            <Download size={15} />
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