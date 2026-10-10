import { useState } from 'react';
import { Check, Copy, ChevronDown, ChevronRight, Database, Clock, Sparkles } from 'lucide-react';
import dayjs from 'dayjs';
import { Markdown } from '@/components/ui/markdown';
import ActivitySteps from './ActivitySteps';
import StructuredBlocks from './StructuredBlocks';
import { formatTokens } from './aiUtils';

const ToolChip = ({ tool }) => {
  const [open, setOpen] = useState(false);
  const isErr = !!tool?.error;
  const rowCount = tool?.rowCount;
  const isContent = tool?.tool === 'content_priority';

  return (
    <div>
      <button
        type="button"
        className={`ai-ws__toolchip ${isErr ? 'ai-ws__toolchip--err' : ''}`}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        {isContent ? <Sparkles size={12} /> : <Database size={12} />}
        {isErr
          ? isContent
            ? 'Content optimization failed'
            : 'Data query failed'
          : isContent
            ? `Content optimization · ${rowCount ?? 0} listings`
            : `Data query · ${rowCount ?? 0} rows`}
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
      </button>
      {open ? (
        <div className="ai-ws__toolchip-detail">
          <div style={{ fontSize: 10.5, fontWeight: 650, letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--bc-text-muted)', marginBottom: 4 }}>
            {isErr ? 'Error' : 'Executed query'}
          </div>
          <pre className="ai-ws__toolchip-pre">{isErr ? tool.error : tool.sql}</pre>
        </div>
      ) : null}
    </div>
  );
};

const TypingDots = () => (
  <span style={{ display: 'inline-flex', gap: 3, padding: '6px 0' }}>
    <span className="animate-pulse" style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--bc-text-muted)' }} />
    <span className="animate-pulse" style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--bc-text-muted)', animationDelay: '150ms' }} />
    <span className="animate-pulse" style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--bc-text-muted)', animationDelay: '300ms' }} />
  </span>
);

const AIMessage = ({ message, copied, onCopy, activity, activitySeconds }) => {
  const isUser = message.role === 'user';

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

  const showActivity = !!activity?.length;
  const isStreaming = !!message.streaming;

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

        {showActivity ? <ActivitySteps steps={activity} durationMs={!isStreaming ? activitySeconds : undefined} collapsed={!isStreaming} /> : null}

        {message.tool ? <ToolChip tool={message.tool} /> : null}

        {message.error ? (
          <div className="ai-ws__msg-err">The assistant hit an error: {message.error}</div>
        ) : isStreaming && !message.content ? (
          <div className="ai-ws__bubble ai-ws__bubble--ai" style={{ padding: '8px 14px' }}>
            <TypingDots />
          </div>
        ) : (
          <Markdown className="ai-ws__bubble ai-ws__bubble--ai prose">{message.content || ' '}</Markdown>
        )}

        {message.structured ? <StructuredBlocks structured={message.structured} /> : null}

        {isStreaming && message.content ? (
          <div className="ai-ws__typing">
            <TypingDots /> Analysing…
          </div>
        ) : null}

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
export { ToolChip };