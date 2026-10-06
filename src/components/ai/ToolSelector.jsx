import { Drawer, Switch } from 'antd';
import { Database, Globe, Megaphone, Search, Users, ListChecks, FileText, Radio, Sparkles } from 'lucide-react';

export const DEFAULT_TOOLS = [
  { key: 'database', label: 'RetailOps Database', desc: 'Run approved read-only queries over business tables', icon: Database, on: true },
  { key: 'content', label: 'Content Optimization', desc: 'Score listing urgency and generate concrete fixes', icon: Sparkles, on: true },
  { key: 'marketplace', label: 'Marketplace Data', desc: 'Amazon, Ajio, Myntra, Flipkart performance', icon: Radio, on: true },
  { key: 'ads', label: 'Advertising Intelligence', desc: 'Campaigns, ad spend, ROAS, trends', icon: Megaphone, on: true },
  { key: 'keywords', label: 'Keyword Research', desc: 'Search term and keyword opportunities', icon: Search, on: false },
  { key: 'sellers', label: 'Seller Intelligence', desc: 'Seller performance and comparisons', icon: Users, on: true },
  { key: 'tasks', label: 'Task Management', desc: 'Create and manage operational tasks', icon: ListChecks, on: false },
  { key: 'web', label: 'Web Research', desc: 'Live web sources (currently disabled)', icon: Globe, on: false, disabled: true },
  { key: 'reports', label: 'Reports', desc: 'Generate structured report artifacts', icon: FileText, on: false, disabled: true },
];

const ToolSelector = ({ open, onClose, tools, onToggle }) => {
  return (
    <Drawer title="AI tools" placement="right" width={380} open={open} onClose={onClose}>
      <div style={{ fontSize: 12.5, color: 'var(--bc-text-secondary)', marginBottom: 14 }}>
        Choose which capabilities RetailOps AI may use. Enabling a tool lets the assistant query the matching data layer to ground its answers.
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {tools.map((t) => {
          const Icon = t.icon;
          return (
            <div
              key={t.key}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 12px',
                border: '1px solid var(--bc-border-default)',
                borderRadius: 12,
                background: 'var(--bc-surface-card)',
              }}
            >
              <span
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'var(--ai-accent-soft)',
                  color: 'var(--ai-accent-strong)',
                  flexShrink: 0,
                }}
              >
                <Icon size={15} />
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--bc-text-heading)' }}>{t.label}</div>
                <div style={{ fontSize: 11.5, color: 'var(--bc-text-muted)' }}>{t.desc}</div>
              </div>
              <Switch
                size="small"
                checked={t.on}
                disabled={t.disabled}
                onChange={() => onToggle(t.key)}
                aria-label={`Toggle ${t.label}`}
              />
            </div>
          );
        })}
      </div>
    </Drawer>
  );
};

export default ToolSelector;