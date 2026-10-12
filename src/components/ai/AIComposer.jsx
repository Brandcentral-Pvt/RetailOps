import { useEffect, useRef, useState } from 'react';
import { Send, Square, Sparkles } from 'lucide-react';
import ModelMenu from './ModelMenu';

const AIComposer = ({
  value,
  onChange,
  onSend,
  onStop,
  isStreaming,
  disabled,
  models,
  modelId,
  onModelChange,
}) => {
  const taRef = useRef(null);
  const [focused, setFocused] = useState(false);

  const autoSize = () => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight, 160)}px`;
  };

  useEffect(autoSize, [value]);

  const submit = () => {
    if (isStreaming) return;
    const text = value.trim();
    if (!text) return;
    onChange('');
    onSend(text);
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    } else if (e.key === 'Escape' && isStreaming) {
      e.preventDefault();
      onStop();
    }
  };

  return (
    <div>
      <div className={`ai-ws__composer ${focused ? 'ai-ws__composer--focused' : ''}`}>
        <textarea
          ref={taRef}
          rows={1}
          value={value}
          disabled={disabled && !isStreaming}
          placeholder="Ask RetailOps AI anything…"
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 120)}
          onKeyDown={onKeyDown}
          aria-label="Message RetailOps AI"
        />

        <div className="ai-ws__composer-toolbar">
          <ModelMenu models={models} selectedId={modelId} onChange={onModelChange} variant="inline" />

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
          'Enter to send · Shift+Enter for a new line'
        )}
      </div>
    </div>
  );
};

export default AIComposer;