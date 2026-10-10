import { LineChart, Search, Target, ListChecks, Store, KeyRound } from 'lucide-react';
import { greetingFor } from './aiUtils';

const PROMPTS = [
  {
    kind: 'Analyze',
    icon: LineChart,
    text: 'Analyze my Amazon sales performance this month and highlight the key changes.',
    mode: 'analyze',
  },
  {
    kind: 'Investigate',
    icon: Search,
    text: 'Find ASINs with declining sales but increasing ad spend over the last 30 days.',
    mode: 'analyze',
  },
  {
    kind: 'Optimize',
    icon: Target,
    text: 'Find my top 20 listings that need content optimisation.',
    mode: 'analyze',
  },
  {
    kind: 'Tasks',
    icon: ListChecks,
    text: 'Show overdue high-priority operational tasks and recommend next steps.',
    mode: 'ask',
  },
  {
    kind: 'Sellers',
    icon: Store,
    text: 'Which sellers are underperforming this week, and what should be reviewed?',
    mode: 'analyze',
  },
  {
    kind: 'Keywords',
    icon: KeyRound,
    text: 'Find keyword opportunities for my top products.',
    mode: 'analyze',
  },
];

const KINDS = ['var(--bc-primary-600)', 'var(--dash-warning)', 'var(--bc-green-600)', 'var(--ai-accent)', 'var(--dash-info)', 'var(--dash-danger)'];

const EmptyState = ({ firstName, onCreatePrompt }) => {
  return (
    <div className="ai-ws__empty">
      <div style={{ textAlign: 'center' }}>
        <div className="ai-ws__empty-greet">{greetingFor(firstName)}</div>
        <div className="ai-ws__empty-sub">
          What would you like to investigate? RetailOps AI can analyze your marketplace, catalog, advertising and operations data, then act on it.
        </div>
      </div>

      <div className="ai-ws__prompt-grid">
        {PROMPTS.map((p, i) => {
          const Icon = p.icon;
          return (
            <button key={p.kind} type="button" className="ai-ws__prompt-card" onClick={() => onCreatePrompt(p.text, p.mode)}>
              <div className="ai-ws__prompt-kind" style={{ color: KINDS[i % KINDS.length] }}>
                {p.kind}
              </div>
              <div className="ai-ws__prompt-text">{p.text}</div>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 24,
                  height: 24,
                  borderRadius: 6,
                  marginTop: 10,
                  background: 'var(--bc-surface-hover)',
                  color: 'var(--bc-text-muted)',
                }}
              >
                <Icon size={13} />
              </span>
            </button>
          );
        })}
      </div>

      <div style={{ marginTop: 18, fontSize: 11.5, color: 'var(--bc-text-muted)' }}>
        Tip: use <strong>/commands</strong> or <strong>@entities</strong> to scope your investigation.
      </div>
    </div>
  );
};

export default EmptyState;