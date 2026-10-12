import { Sparkles, Rocket, ClipboardList, HelpCircle } from 'lucide-react';
import { greetingFor } from './aiUtils';

const PROMPTS = [
  {
    kind: 'General',
    icon: Sparkles,
    text: 'How can you help me with my retail business today?',
  },
  {
    kind: 'Strategy',
    icon: Rocket,
    text: 'What are some growth strategies for an Amazon seller?',
  },
  {
    kind: 'Operations',
    icon: ClipboardList,
    text: 'How do I improve my daily listing operations workflow?',
  },
  {
    kind: 'How-to',
    icon: HelpCircle,
    text: 'Explain the key metrics I should track for my e-commerce store.',
  },
];

const KINDS = ['var(--bc-primary-600)', 'var(--dash-warning)', 'var(--bc-green-600)', 'var(--ai-accent)'];

const EmptyState = ({ firstName, onFill }) => {
  return (
    <div className="ai-ws__empty">
      <div style={{ textAlign: 'center' }}>
        <div className="ai-ws__empty-greet">{greetingFor(firstName)}</div>
        <div className="ai-ws__empty-sub">
          Chat with RetailOps AI. Ask about your business, listings, or anything else you need help with.
        </div>
      </div>

      <div className="ai-ws__prompt-grid">
        {PROMPTS.map((p, i) => {
          const Icon = p.icon;
          return (
            <button key={p.kind} type="button" className="ai-ws__prompt-card" onClick={() => onFill(p.text)}>
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
    </div>
  );
};

export default EmptyState;