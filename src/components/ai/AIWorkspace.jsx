import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Drawer, Input } from 'antd';
import { ArrowDown, X } from 'lucide-react';
import dayjs from 'dayjs';
import { useAuth } from '@/contexts/AuthContext';
import { aiChatService } from '@/services/aiChatService';

import AIHeader from './AIHeader';
import ConversationSidebar from './ConversationSidebar';
import AIComposer from './AIComposer';
import AIMessage from './AIMessage';
import EmptyState from './EmptyState';
import { normalizeModels } from './aiUtils';
import { FALLBACK_MODELS } from '../../pages/aiModels';
import './index.css';

const TITLE_CHAR_LIMIT = 48;

const PIN_KEY = 'ai.pinned.v1';

const loadPinned = () => {
  try {
    return new Set(JSON.parse(localStorage.getItem(PIN_KEY) || '[]'));
  } catch {
    return new Set();
  }
};

const AIWorkspace = () => {
  const { user } = useAuth();

  const [models, setModels] = useState(FALLBACK_MODELS);
  const [modelId, setModelId] = useState(FALLBACK_MODELS[0]?.id);
  const [usage, setUsage] = useState(null);
  const [usageLoading, setUsageLoading] = useState(true);

  const [conversations, setConversations] = useState([]);
  const [convLoading, setConvLoading] = useState(true);
  const [pinned, setPinned] = useState(loadPinned);
  const [currentConv, setCurrentConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messagesLoading, setMessagesLoading] = useState(false);

  const [input, setInput] = useState('');
  const [search, setSearch] = useState('');

  const [convHidden, setConvHidden] = useState(false);
  const [mobile, setMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth <= 920);
  const [mobileConvOpen, setMobileConvOpen] = useState(false);

  const [isStreaming, setIsStreaming] = useState(false);
  const [abortRef] = useState(() => ({ current: null }));
  const [topError, setTopError] = useState('');
  const [copiedId, setCopiedId] = useState(null);
  const [renameTarget, setRenameTarget] = useState(null);
  const [renameValue, setRenameValue] = useState('');

  const scrollRef = useRef(null);
  const [atBottom, setAtBottom] = useState(true);

  const activeModel = useMemo(() => models.find((m) => m.id === modelId) || models[0], [models, modelId]);

  /* ── Layout ─────────────────────────────────────────────────────────────── */
  useEffect(() => {
    const onResize = () => setMobile(window.innerWidth <= 920);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    document.body.classList.add('chat-page-active');
    return () => document.body.classList.remove('chat-page-active');
  }, []);

  /* ── Dark-mode mirror for prompt-kit tokens ─────────────────────────────── */
  const rootRef = useRef(null);
  useEffect(() => {
    const apply = () => {
      const dark = document.body.classList.contains('bc-dark');
      rootRef.current?.classList.toggle('dark', dark);
    };
    apply();
    const obs = new MutationObserver(apply);
    obs.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);

  /* ── Data loading ───────────────────────────────────────────────────────── */
  const loadModels = useCallback(async () => {
    try {
      const res = await aiChatService.getModels();
      const raw =
        (Array.isArray(res.data?.all) && res.data.all.length ? res.data.all : null) ||
        (Array.isArray(res.all) && res.all.length ? res.all : null) ||
        (Array.isArray(res) && res.length ? res : null) ||
        (Array.isArray(res.data?.free) || Array.isArray(res.data?.subscription)
          ? [...(res.data.free || []), ...(res.data.subscription || [])]
          : null) ||
        null;
      const list = normalizeModels(raw);
      if (list.length) {
        setModels(list);
        setModelId((prev) => (list.some((m) => m.id === prev) ? prev : list[0].id));
      }
    } catch (err) {
      setTopError(`Could not load models: ${err.message || 'unknown error'}`);
    }
  }, []);

  const loadUsage = useCallback(async () => {
    try {
      const res = await aiChatService.getUsage();
      setUsage(res.usage || res.data?.usage || res.data || res);
    } finally {
      setUsageLoading(false);
    }
  }, []);

  const loadConversations = useCallback(async () => {
    setConvLoading(true);
    try {
      const res = await aiChatService.listConversations(50);
      const list = res.conversations || res.data?.conversations || res;
      setConversations(Array.isArray(list) ? list : []);
    } catch (err) {
      if (err.status === 401) setTopError('Your session has expired. Please sign in again.');
      else setTopError(`Could not load conversations: ${err.message || 'unknown error'}`);
    } finally {
      setConvLoading(false);
    }
  }, []);

  const loadConversation = useCallback(async (id) => {
    setMessagesLoading(true);
    setMessages([]);
    try {
      const res = await aiChatService.getConversation(id);
      const conv = res.data?.Id ? res.data : res.conversation || res.data?.conversation || null;
      const list = res.data?.messages || res.messages || res.data || res.message;
      setCurrentConv((prev) => (prev && prev.Id === id ? prev : conv));
      setMessages(
        Array.isArray(list)
          ? list.map((m) => ({
              id: m.Id || m.id || `m-${Date.now()}-${Math.random()}`,
              role: (m.Role || m.role || '').toLowerCase(),
              content: m.Content || m.content || '',
              model: activeModel?.name,
              createdAt: m.CreatedAt || m.createdAt,
            }))
          : [],
      );
    } catch (err) {
      setTopError(`Could not load conversation: ${err.message || 'unknown error'}`);
    } finally {
      setMessagesLoading(false);
    }
  }, [activeModel?.name]);

  useEffect(() => {
    loadModels();
    loadUsage();
    loadConversations();
  }, [loadModels, loadUsage, loadConversations]);

  /* ── Scroll to bottom while streaming ───────────────────────────────────── */
  useEffect(() => {
    if (atBottom) {
      const el = scrollRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    }
  }, [messages, atBottom]);

  const onScroll = (e) => {
    const el = e.target;
    const near = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    setAtBottom(near);
  };

  /* ── Conversation ops ───────────────────────────────────────────────────── */
  const persist = () => {
    try {
      localStorage.setItem(PIN_KEY, JSON.stringify([...pinned]));
    } catch { /* ignore */ }
  };
  useEffect(persist, [pinned]);

  const startNew = useCallback(() => {
    setCurrentConv(null);
    setMessages([]);
    setTopError('');
    setMobileConvOpen(false);
  }, []);

  const selectConv = useCallback(
    (conv) => {
      setCurrentConv(conv);
      setMobileConvOpen(false);
      loadConversation(conv.Id);
    },
    [loadConversation],
  );

  const handleDelete = (conv) => {
    Modal.confirm({
      title: 'Delete conversation?',
      content: `"${conv.Title || 'Untitled'}" will be permanently removed.`,
      okText: 'Delete',
      okType: 'danger',
      cancelText: 'Cancel',
      onOk: async () => {
        try {
          await aiChatService.deleteConversation(conv.Id);
          if (currentConv?.Id === conv.Id) startNew();
          loadConversations();
        } catch (err) {
          setTopError(`Could not delete: ${err.message || 'unknown error'}`);
        }
      },
    });
  };

  const handleRename = (conv) => {
    setRenameTarget(conv);
    setRenameValue(conv.Title || '');
  };

  const confirmRename = async () => {
    const title = renameValue.trim();
    if (!renameTarget || !title) {
      setRenameTarget(null);
      return;
    }
    try {
      await aiChatService.updateConversationTitle(renameTarget.Id, title);
      setCurrentConv((c) => (c && c.Id === renameTarget.Id ? { ...c, Title: title } : c));
      loadConversations();
    } catch (err) {
      setTopError(`Could not rename: ${err.message || 'unknown error'}`);
    } finally {
      setRenameTarget(null);
    }
  };

  const togglePin = (conv) => {
    setPinned((prev) => {
      const next = new Set(prev);
      if (next.has(conv.Id)) next.delete(conv.Id);
      else next.add(conv.Id);
      return next;
    });
  };

  const handleClear = () => {
    Modal.confirm({
      title: 'Clear this conversation?',
      content: 'Messages will be cleared from this view.',
      okText: 'Clear',
      cancelText: 'Cancel',
      onOk: () => setMessages([]),
    });
  };

  /* ── Send / stream ──────────────────────────────────────────────────────── */
  const doSend = useCallback(
    async (text) => {
      const content = text.trim();
      if (!content || isStreaming) return;

      let conv = currentConv;
      let mid = null;
      try {
        setTopError('');
        if (!conv?.Id) {
          const created = await aiChatService.createConversation('New Conversation');
          conv = created?.data || created?.conversation || created;
          setCurrentConv(conv);
          loadConversations();
        }

        const userMsgId = `u-${Date.now()}`;
        mid = `a-${Date.now()}`;
        const payload = {
          message: content,
          conversationId: conv.Id,
          modelId,
          temperature: 0.7,
          maxTokens: 4096,
          options: { model: modelId, allowSubscription: true },
        };

        setInput('');
        setMessages((prev) => [
          ...prev,
          { id: userMsgId, role: 'user', content, createdAt: dayjs().toISOString() },
          { id: mid, role: 'assistant', content: '', streaming: true, createdAt: dayjs().toISOString() },
        ]);
        setIsStreaming(true);
        const ac = new AbortController();
        abortRef.current = ac;

        let acc = '';
        let usedTokens = null;
        const onEvent = (ev) => {
          if (ev.type === 'chunk') {
            acc = acc + (ev.content || '');
            setMessages((prev) => prev.map((m) => (m.id === mid ? { ...m, content: acc } : m)));
          } else if (ev.type === 'complete') {
            usedTokens = ev.tokensUsed || ev.usage?.total_tokens || null;
          } else if (ev.type === 'error') {
            throw new Error(ev.error || 'The assistant hit an error while responding.');
          }
        };

        try {
          await aiChatService.streamConversation(conv.Id, payload, onEvent, ac.signal);
        } catch (err) {
          if (err.name === 'AbortError') {
            setMessages((prev) =>
              prev.map((m) => (m.id === mid ? { ...m, content: acc, streaming: false } : m)),
            );
            return;
          }
          throw err;
        }

        setMessages((prev) =>
          prev.map((m) => (m.id === mid ? { ...m, streaming: false, tokensUsed: usedTokens, model: activeModel?.name } : m)),
        );

        const isNew = !currentConv?.Id || !currentConv?.Title || currentConv.Title === 'New Conversation';
        if (isNew) {
          await aiChatService.updateConversationTitle(conv.Id, content.slice(0, TITLE_CHAR_LIMIT));
        }
        loadConversations();
        loadUsage();
      } catch (err) {
        setTopError(err.message || 'Unexpected error while sending your message.');
        setMessages((prev) =>
          prev.map((m) =>
            mid && m.id === mid
              ? { ...m, streaming: false, error: err.message || 'Unexpected error', content: '' }
              : m,
          ),
        );
      } finally {
        setIsStreaming(false);
        abortRef.current = null;
      }
    },
    [
      isStreaming,
      currentConv,
      modelId,
      activeModel?.name,
      abortRef,
      loadConversations,
      loadUsage,
    ],
  );

  const handleStop = () => {
    if (abortRef.current) abortRef.current.abort();
  };

  const handleCopy = (m) => {
    navigator.clipboard?.writeText(m.content).catch(() => {});
    setCopiedId(m.id);
    setTimeout(() => setCopiedId((c) => (c === m.id ? null : c)), 1400);
  };

  const conversationTitle = currentConv?.Title || (messages.length ? (messages[0].content || '').slice(0, 48) : '');

  /* ── Render ─────────────────────────────────────────────────────────────── */
  return (
    <div ref={rootRef} className="ai-ws pk-root">
      {topError ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '6px 14px',
            fontSize: 12.5,
            color: 'var(--dash-danger)',
            background: 'color-mix(in srgb, var(--dash-danger) 8%, transparent)',
            borderBottom: '1px solid color-mix(in srgb, var(--dash-danger) 30%, transparent)',
          }}
        >
          <span style={{ flex: 1 }}>{topError}</span>
          <button type="button" className="ai-ws__iconbtn" onClick={() => setTopError('')} aria-label="Dismiss">
            <X size={13} />
          </button>
        </div>
      ) : null}

      <AIHeader
        conversationTitle={conversationTitle}
        onRename={() => currentConv && handleRename(currentConv)}
        onClear={handleClear}
        onDelete={() => currentConv && handleDelete(currentConv)}
        onToggleConv={() => (mobile ? setMobileConvOpen((v) => !v) : setConvHidden((v) => !v))}
        convHidden={convHidden}
        isMobile={mobile}
      />

      <div className="ai-ws__body">
        {!mobile && !convHidden ? (
          <ConversationSidebar
            conversations={conversations}
            pinned={pinned}
            currentId={currentConv?.Id}
            loading={convLoading}
            search={search}
            onSearch={setSearch}
            onSelect={selectConv}
            onNew={startNew}
            onPin={togglePin}
            onDelete={handleDelete}
            onRename={handleRename}
            usage={usage}
            usageLoading={usageLoading}
            modelCount={models.length}
          />
        ) : null}

        <main className="ai-ws__main">
          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            <div style={{ position: 'relative', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
              <div className="ai-ws__messages" ref={scrollRef} onScroll={onScroll}>
                {messagesLoading ? (
                  <div style={{ padding: 30, textAlign: 'center', color: 'var(--bc-text-muted)' }} className="animate-pulse">
                    Loading conversation…
                  </div>
                ) : messages.length ? (
                  messages.map((m) => (
                    <AIMessage
                      key={m.id}
                      message={m}
                      modelName={activeModel?.name}
                      copied={copiedId === m.id}
                      onCopy={handleCopy}
                    />
                  ))
                ) : (
                  <EmptyState firstName={user?.firstName} onFill={setInput} />
                )}
              </div>

              {!atBottom ? (
                <button
                  type="button"
                  className="ai-ws__iconbtn"
                  onClick={() => {
                    const el = scrollRef.current;
                    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
                  }}
                  style={{ position: 'absolute', bottom: 14, right: 14, background: 'var(--bc-surface-card)', border: '1px solid var(--bc-border-default)', boxShadow: '0 2px 8px rgba(15,23,42,.14)', zIndex: 20 }}
                  aria-label="Scroll to latest"
                >
                  <ArrowDown size={16} />
                </button>
              ) : null}
            </div>

            <div className="ai-ws__composer-wrap">
              <AIComposer
                value={input}
                onChange={setInput}
                onSend={doSend}
                onStop={handleStop}
                isStreaming={isStreaming}
                disabled={messagesLoading}
                models={models}
                modelId={modelId}
                onModelChange={setModelId}
              />
            </div>
          </div>
        </main>
      </div>

      {mobile ? (
        <Drawer placement="left" width={300} open={mobileConvOpen} onClose={() => setMobileConvOpen(false)} closable={false} styles={{ body: { padding: 0 } }}>
          <div style={{ height: '100%' }}>
            <ConversationSidebar
              conversations={conversations}
              pinned={pinned}
              currentId={currentConv?.Id}
              loading={convLoading}
              search={search}
              onSearch={setSearch}
              onSelect={selectConv}
              onNew={startNew}
              onPin={togglePin}
              onDelete={handleDelete}
              onRename={handleRename}
              usage={usage}
              usageLoading={usageLoading}
              modelCount={models.length}
            />
          </div>
        </Drawer>
      ) : null}

      <Modal
        title="Rename conversation"
        open={!!renameTarget}
        onOk={confirmRename}
        onCancel={() => setRenameTarget(null)}
        okText="Save"
        cancelText="Cancel"
        destroyOnHidden
      >
        <Input
          value={renameValue}
          onChange={(e) => setRenameValue(e.target.value)}
          onPressEnter={confirmRename}
          placeholder="Conversation title"
          autoFocus
        />
      </Modal>
    </div>
  );
};

export default AIWorkspace;