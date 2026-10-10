import { Dropdown } from 'antd';
import { Check, ChevronDown, Sparkles } from 'lucide-react';
import { CONTEXT_LABEL } from './aiUtils';
import { cn } from '@/lib/utils';

const ModelMenu = ({ models, selectedId, onChange, variant = 'button' }) => {
  const active = models.find((m) => m.id === selectedId) || models[0];
  const items = (m) => ({
    key: m.id,
    label: (
      <div className="flex w-64 items-center gap-2">
        <span className="min-w-0 flex-1 truncate text-sm font-medium">{m.name}</span>
        {m.context ? <span className="text-[10px] text-muted-foreground">{CONTEXT_LABEL[m.context] || '—'}</span> : null}
        {m.id === (selectedId || models[0]?.id) ? <Check size={14} className="text-primary" /> : null}
      </div>
    ),
  });

  const menu = {
    items: [
      { type: 'label', label: 'Free models' },
      ...models.filter((m) => m.category === 'Free').map(items),
      { type: 'divider' },
      { type: 'label', label: 'Subscription' },
      ...models.filter((m) => m.category === 'Subscription').map(items),
    ],
    onClick: ({ key }) => onChange(key),
  };

  if (variant === 'inline') {
    return (
      <Dropdown menu={menu} trigger={['click']} placement="topRight">
        <button type="button" className="ai-ws__composer-chip" aria-label="Change AI model">
          <Sparkles size={12} style={{ color: 'var(--ai-accent)' }} />
          {active?.name}
          <ChevronDown size={12} />
        </button>
      </Dropdown>
    );
  }

  return (
    <Dropdown menu={menu} trigger={['click']}>
      <button
        type="button"
        className={cn('inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium border border-[var(--bc-border-default)] bg-[var(--bc-surface-subtle)] text-[var(--bc-text-body)] hover:bg-[var(--bc-surface-hover)]')}
        aria-label="Select AI model"
      >
        <Sparkles size={14} style={{ color: 'var(--ai-accent)' }} />
        {active?.name || 'Select model'}
        <ChevronDown size={13} />
      </button>
    </Dropdown>
  );
};

export default ModelMenu;