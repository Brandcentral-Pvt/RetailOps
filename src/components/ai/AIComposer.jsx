import { useEffect, useRef, useState } from 'react';
import {
  Send,
  Square,
  Paperclip,
  AtSign,
  Wrench,
  Sparkles,
  Command,
  Database,
  Check,
  Mic,
  Eraser,
} from 'lucide-react';
import ModelMenu from './ModelMenu';

const SLASH_COMMANDS = [
  { id: '/analyze', label: 'Analyze', desc: 'Deep analysis of a metric or scope', template: 'Analyze ' },
  { id: '/find', label: 'Find', desc: 'Find entities matching conditions', template: 'Find ' },
  { id: '/compare', label: 'Compare', desc: 'Compare sellers, ASINs or periods', template: 'Compare ' },
  { id: '/optimize', label: 'Optimize', desc: 'Optimization recommendations', template: 'Find optimisation opportunities for ' },
  { id: '/create-task', label: 'Create Task', desc: 'Create operational tasks', template: 'Create tasks for ', mode: 'execute' },
  { id: '/report', label: 'Report', desc: 'Generate a structured report', template: 'Generate a report on ' },
  { id: '/keyword', label: 'Keyword', desc: 'Keyword research', template: 'Research keywords for ' },
  { id: '/seller', label: 'Seller', desc: 'Seller intelligence', template: 'Analyze seller ' },
  { id: '/asin', label: 'ASIN', desc: 'ASIN analysis', template: 'Analyze ASIN ' },
  { id: '/ads', label: 'Ads', desc: 'Advertising analysis', template: 'Analyze advertising for ' },
];

const MENTIONS = [
  { id: 'seller', label: 'Seller', desc: 'Scope to a seller' },
  { id: 'asin', label: 'ASIN', desc: 'Scope to an ASIN/SKU' },
  { id: 'campaign', label: 'Campaign', desc: 'Scope to an advertising campaign' },
  { id: 'task', label: 'Task', desc: 'Reference a task' },
  { id: 'marketplace', label: 'Marketplace', desc: 'Amazon · Ajio · Myntra · Flipkart' },
];

const AIComposer = ({
  value,
  onChange,
  onSend,
  onStop,
  isStreaming,
  disabled,
  mode,
  onModeChange,
  models,
  modelId,
  onModelChange,
  databaseOn,
  onToggleDatabase,
  onOpenTools,
  onUseMention,
}) => {
  const taRef = useRef(null);
  const wrapRef = useRef(null);
  const [focused, setFocused] = useState(false);
  const [menu, setMenu] = useState(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const [files, setFiles] = useState([]);
  const fileRef = useRef(null);

  const autoSize = () => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight, 160)}px`;
  };

  useEffect(autoSize, [value]);

  const onValueChange = (val) => {
    const nextSlash = val.startsWith('/') && !/\s/.test(val);
    const nextAt = val.match(/@([\w-]*)$/);
    const nextMenu = nextSlash ? 'slash' : nextAt ? 'mention' : null;
    if (nextMenu !== menu) setActiveIdx(0);
    setMenu(nextMenu);
    onChange(val);
  };

  const selectSlash = (cmd) => {
    const next = value.replace(/^\/[\w-]*/, cmd.template);
    onValueChange(next);
    if (cmd.mode) onModeChange?.(cmd.mode);
    requestAnimationFrame(() => {
      taRef.current?.focus();
      const el = taRef.current;
      if (el) {
        el.selectionStart = el.selectionEnd = el.value.length;
        autoSize();
      }
    });
  };

  const selectMention = (ent) => {
    const next = value.replace(/@[\w-]*$/, `@${ent.id} `);
    onValueChange(next);
    onUseMention?.(ent);
    requestAnimationFrame(() => {
      const el = taRef.current;
      if (el) {
        el.selectionStart = el.selectionEnd = el.value.length;
        el.focus();
      }
    });
  };

  const submit = () => {
    if (isStreaming) return;
    const text = value.trim();
    if (!text) return;
    onValueChange('');
    setFiles([]);
    onSend(text);
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (menu === 'slash') selectSlash(SLASH_COMMANDS[activeIdx] || SLASH_COMMANDS[0]);
      else if (menu === 'mention') selectMention(MENTIONS[activeIdx] || MENTIONS[0]);
      else submit();
      return;
    }
    if (e.key === 'ArrowDown' && menu) {
      e.preventDefault();
      const n = menu === 'slash' ? SLASH_COMMANDS.length : MENTIONS.length;
      setActiveIdx((i) => (i + 1) % n);
      return;
    }
    if (e.key === 'ArrowUp' && menu) {
      e.preventDefault();
      const n = menu === 'slash' ? SLASH_COMMANDS.length : MENTIONS.length;
      setActiveIdx((i) => (i - 1 + n) % n);
      return;
    }
    if (e.key === 'Escape') {
      if (menu) {
        onValueChange(value.replace(/^\/[\w-]*/, '').replace(/@[\w-]*$/, ''));
      } else if (isStreaming) {
        onStop();
      }
    }
  };

  const onFileChange = (e) => {
    const list = Array.from(e.target.files || []).slice(0, 4);
    if (list.length) setFiles((f) => [...f, ...list]);
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <div ref={wrapRef}>
      <div className="ai-ws__modebar">
        <div className="ai-ws__mode-seg" role="tablist" aria-label="AI mode">
          {[
            { id: 'ask', label: 'Ask' },
            { id: 'analyze', label: 'Analyze' },
            { id: 'execute', label: 'Execute' },
          ].map((m) => (
            <button
              key={m.id}
              type="button"
              role="tab"
              aria-selected={mode === m.id}
              className={`ai-ws__mode-btn ${mode === m.id ? 'ai-ws__mode-btn--on' : ''}`}
              onClick={() => onModeChange(m.id)}
            >
              {m.label}
            </button>
          ))}
        </div>
        {mode === 'execute' ? (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10.5, color: 'var(--dash-warning)' }}>
            <Check size={11} /> Execution mode — confirmations required before high-impact ops
          </span>
        ) : mode === 'analyze' ? (
          <span style={{ fontSize: 10.5, color: 'var(--bc-text-muted)' }}>Deep analysis with structured insights</span>
        ) : null}
      </div>

      <div className={`ai-ws__composer ${focused ? 'ai-ws__composer--focused' : ''}`}>
        {files.length ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '10px 14px 0' }}>
            {files.map((f, i) => (
              <span key={i} className="ai-ws__composer-chip">
                <Paperclip size={11} /> {f.name}
                <button
                  type="button"
                  style={{ border: 'none', background: 'transparent', color: 'inherit', cursor: 'pointer', padding: 0, display: 'inline-flex' }}
                  onClick={() => setFiles((fl) => fl.filter((_, j) => j !== i))}
                  aria-label={`Remove ${f.name}`}
                >
                  <Eraser size={10} />
                </button>
              </span>
            ))}
          </div>
        ) : null}

        <textarea
          ref={taRef}
          rows={1}
          value={value}
          disabled={disabled && !isStreaming}
          placeholder="Ask RetailOps AI anything…  Try /analyze, /find, or @sellers"
          onChange={onValueChange}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 120)}
          onKeyDown={onKeyDown}
          aria-label="Message RetailOps AI"
        />

        {menu === 'slash' ? (
          <div className="ai-ws__pop" role="menu">
            {SLASH_COMMANDS.map((c, i) => (
              <div
                key={c.id}
                role="menuitem"
                className={`ai-ws__pop-item ${i === activeIdx ? 'ai-ws__pop-item--active' : ''}`}
                onMouseEnter={() => setActiveIdx(i)}
                onClick={() => selectSlash(c)}
              >
                <span className="ai-ws__pop-icon">
                  <Command size={13} />
                </span>
                <span className="ai-ws__pop-body">
                  <div className="ai-ws__pop-title">{c.label}</div>
                  <div className="ai-ws__pop-desc">{c.desc}</div>
                </span>
                <span className="ai-ws__pop-hint">{i === activeIdx ? '↵' : ''}</span>
              </div>
            ))}
          </div>
        ) : null}

        {menu === 'mention' ? (
          <div className="ai-ws__pop" role="menu">
            {MENTIONS.map((c, i) => (
              <div
                key={c.id}
                role="menuitem"
                className={`ai-ws__pop-item ${i === activeIdx ? 'ai-ws__pop-item--active' : ''}`}
                onMouseEnter={() => setActiveIdx(i)}
                onClick={() => selectMention(c)}
              >
                <span className="ai-ws__pop-icon">
                  <AtSign size={13} />
                </span>
                <span className="ai-ws__pop-body">
                  <div className="ai-ws__pop-title">@ {c.label}</div>
                  <div className="ai-ws__pop-desc">{c.desc}</div>
                </span>
                <span className="ai-ws__pop-hint">{i === activeIdx ? '↵' : ''}</span>
              </div>
            ))}
          </div>
        ) : null}

        <div className="ai-ws__composer-toolbar">
          <input ref={fileRef} type="file" multiple style={{ display: 'none' }} onChange={onFileChange} />

          <button type="button" className="ai-ws__composer-chip" onClick={() => fileRef.current?.click()} aria-label="Attach file">
            <Paperclip size={12} />
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
              Attach {files.length ? <span style={{ color: 'var(--ai-accent-strong)' }}>({files.length})</span> : null}
            </span>
          </button>

          <button
            type="button"
            className={`ai-ws__composer-chip ${databaseOn ? 'ai-ws__composer-chip--on' : ''}`}
            onClick={onToggleDatabase}
            title="Toggle RetailOps database grounding"
          >
            <Database size={12} />
            Database
          </button>

          <button type="button" className="ai-ws__composer-chip" onClick={onOpenTools} aria-label="Choose tools">
            <Wrench size={12} />
            Tools
          </button>

          <ModelMenu models={models} selectedId={modelId} onChange={onModelChange} variant="inline" />

          <button type="button" className="ai-ws__composer-chip" disabled aria-label="Voice input coming soon">
            <Mic size={12} style={{ opacity: 0.4 }} />
          </button>

          {isStreaming ? (
            <button type="button" className="ai-ws__send ai-ws__send--stop" onClick={onStop} aria-label="Stop generation">
              <Square size={14} fill="currentColor" />
            </button>
          ) : (
            <button type="button" className="ai-ws__send" disabled={!value.trim() || disabled} onClick={submit} aria-label="Send message">
              <Send size={14} />
            </button>
          )}
        </div>
      </div>

      <div className="ai-ws__composer-hint">
        {isStreaming ? (
          <span style={{ color: 'var(--ai-accent-strong)', fontWeight: 550 }}>
            <Sparkles size={11} style={{ verticalAlign: -1 }} /> RetailOps AI is working — Esc to stop
          </span>
        ) : (
          'Enter to send · Shift+Enter for a new line · / for commands · @ to scope context'
        )}
      </div>
    </div>
  );
};

export default AIComposer;