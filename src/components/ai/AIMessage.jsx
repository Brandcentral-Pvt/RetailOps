import { Check, Copy, Clock } from 'lucide-react';
import dayjs from 'dayjs';
import { Markdown } from '@/components/ui/markdown';
import { formatTokens } from './aiUtils';

const TypingDots = () => (
  <span style={{ display: 'inline-flex', gap: 3, padding: '6px 0' }}>
    <span className="animate-pulse" style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--bc-text-muted)' }} />
    <span className="animate-pulse" style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--bc-text-muted)', animationDelay: '150ms' }} />
    <span className="animate-pulse" style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--bc-text-muted)', animationDelay: '300ms' }} />
  </span>
);

const AIMessage = ({ message, copied, onCopy }) => {
  const isUser = message.role === 'user';
  const isStreaming = !!message.streaming;

  if (isUser) {
    return (
      <div className="ai-ws__msg ai-ws__msg--user">
        <div className="ai-ws__bubble-wrap">
          <div className="ai-ws__msg-meta" style={{ justifyContent: 'flex-end' }}>
            <Clock size={11} /> {message.createdAt ? dayjs(message.createdAt).format('HH:mm') : ''}
          </div>
          <div className="ai-ws__bubble ai-ws__bubble--user">{message.content}</div>
        </div>
        <div className="ai-ws__avatar ai-ws__avatar--user">You</div>
      </div>
    );
  }

  return (
    <div className="ai-ws__msg">
      <div className="ai-ws__avatar ai-ws__avatar--ai">AI</div>
      <div className="ai-ws__bubble-wrap">
        <div className="ai-ws__msg-meta">
          <strong>RetailOps AI</strong>
          {message.model ? <span>{message.model}</span> : null}
          {message.tokensUsed ? <span>{formatTokens(message.tokensUsed)} tokens</span> : null}
          {message.createdAt ? <span>· {dayjs(message.createdAt).format('HH:mm')}</span> : null}
        </div>

        {message.error ? (
          <div className="ai-ws__msg-err">The assistant hit an error: {message.error}</div>
        ) : isStreaming && !message.content ? (
          <div className="ai-ws__bubble ai-ws__bubble--ai" style={{ padding: '8px 14px' }}>
            <TypingDots />
          </div>
        ) : (
          <Markdown className="ai-ws__bubble ai-ws__bubble--ai prose">{message.content || ' '}</Markdown>
        )}

        {!isStreaming ? (
          <div className="ai-ws__msg-actions">
            <button type="button" className="ai-ws__iconbtn" onClick={() => onCopy(message)} aria-label="Copy response">
              {copied ? <Check size={13} style={{ color: 'var(--bc-green-600)' }} /> : <Copy size={13} />}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default AIMessage;