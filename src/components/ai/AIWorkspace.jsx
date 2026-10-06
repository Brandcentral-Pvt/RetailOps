import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Drawer, App as AntdApp, Input } from 'antd';
import { ArrowDown, X } from 'lucide-react';
import dayjs from 'dayjs';
import { useAuth } from '@/contexts/AuthContext';
import { useDateRange } from '@/contexts/DateRangeContext';
import { format } from 'date-fns';
import { aiChatService } from '@/services/aiChatService';

import AIHeader from './AIHeader';
import ConversationSidebar from './ConversationSidebar';
import ContextPanel from './ContextPanel';
import { DEFAULT_TOOLS } from './ToolSelector';
import ToolSelector from './ToolSelector';
import AISettingsPanel from './AISettingsPanel';
import AIComposer from './AIComposer';
import AIMessage from './AIMessage';
import EmptyState from './EmptyState';
import ConfirmationDialog from './ConfirmationDialog';
import { buildSteps } from './ActivitySteps';
import { normalizeModels } from './aiUtils';
import { FALLBACK_MODELS } from '../../pages/aiModels';
import './index.css';

const DEFAULT_SETTINGS = {
  temperature: 0.7,
  maxTokens: 2048,
  includeDatabase: true,
  systemPrompt: 'default',
  streaming: true,
};

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
  const { startDate, endDate } = useDateRange();
  const { message: antdMessage } = AntdApp.useApp();

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
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [mode, setMode] = useState('ask');
  const [tools, setTools] = useState(DEFAULT_TOOLS);
  const [contextEntities, setContextEntities] = useState([]);

  const [convHidden, setConvHidden] = useState(false);
  const [contextHidden, setContextHidden] = useState(() => typeof window !== 'undefined' && window.innerWidth < 1280);
  const [mobile, setMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth <= 920);
  const [mobileConvOpen, setMobileConvOpen] = useState(false);
  const [mobileCtxOpen, setMobileCtxOpen] = useState(false);

  const [toolsOpen, setToolsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const [isStreaming, setIsStreaming] = useState(false);
  const [abortRef] = useState(() => ({ current: null }));
  const [topError, setTopError] = useState('');
  const [copiedId, setCopiedId] = useState(null);
  const [renameTarget, setRenameTarget] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const [pendingSend, setPendingSend] = useState(null);

  const [activity, setActivity] = useState(null);
  const startedAt = useRef(0);
  const scrollRef = useRef(null);
  const [atBottom, setAtBottom] = useState(true);

  const activeModel = useMemo(() => models.find((m) => m.id === modelId) || models[0], [models, modelId]);

  /* ── Layout ─────────────────────────────────────────────────────────────── */
  useEffect(() => {
    const onResize = () => {
      setMobile(window.innerWidth <= 920);
      if (window.innerWidth >= 1280) setContextHidden(false);
      if (window.innerWidth <= 1279) setContextHidden(true);
    };
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
          ? list.map((m) => {
              let meta = {};
              try {
                meta = JSON.parse(m.Metadata || m.metadata || '{}');
              } catch { /* ignore */ }
              return {
                id: m.Id || m.id || `m-${Date.now()}-${Math.random()}`,
                role: (m.Role || m.role || '').toLowerCase(),
                content: m.Content || m.content || '',
                model: activeModel?.name,
                createdAt: m.CreatedAt || m.createdAt,
                tool: meta.toolUsed || null,
              };
            })
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
  }, [messages, activity, atBottom]);

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
    setActivity(null);
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

  const handleArchive = (conv) => {
    setConversations((prev) => prev.filter((c) => c.Id !== conv.Id));
  };

  const handleClear = () => {
    Modal.confirm({
      title: 'Clear this conversation?',
      content: 'Messages will be cleared from this view.',
      okText: 'Clear',
      cancelText: 'Cancel',
      onOk: () => {
        setMessages([]);
        setActivity(null);
      },
    });
  };

  /* ── Send / stream ──────────────────────────────────────────────────────── */
  const doSend = useCallback(
    async (text) => {
      const content = text.trim();
      if (!content || isStreaming) return;

      let conv = currentConv;
      let mid = null;
      const started = Date.now();
      startedAt.current = started;
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
          temperature: settings.temperature,
          maxTokens: settings.maxTokens,
          options: {
            model: modelId,
            includeDatabase: settings.includeDatabase,
            systemPrompt: settings.systemPrompt,
            allowSubscription: true,
            ...(contextEntities.length ? { context: contextEntities } : {}),
          },
        };

        setInput('');
        setMessages((prev) => [
          ...prev,
          { id: userMsgId, role: 'user', content, createdAt: dayjs().toISOString() },
          { id: mid, role: 'assistant', content: '', streaming: true, createdAt: dayjs().toISOString() },
        ]);
        setIsStreaming(true);
        setActivity({ done: [], receivedTool: false, firstChunk: false });
        const ac = new AbortController();
        abortRef.current = ac;

        let acc = '';
        let usedTokens = null;
        const onEvent = (ev) => {
          if (ev.type === 'chunk') {
            acc = acc + (ev.content || '');
            setActivity((a) => (a && !a.firstChunk ? { ...a, firstChunk: true } : a));
            setMessages((prev) => prev.map((m) => (m.id === mid ? { ...m, content: acc } : m)));
          } else if (ev.type === 'complete') {
            usedTokens = ev.tokensUsed || ev.usage?.total_tokens || null;
            setActivity((a) => (a ? { ...a, done: true } : a));
          } else if (ev.type === 'tool') {
            setActivity((a) => ({ ...a, receivedTool: true }));
            setMessages((prev) =>
              prev.map((m) =>
                m.id === mid
                  ? { ...m, tool: { tool: ev.tool, sql: ev.sql, rowCount: ev.rowCount, error: ev.error } }
                  : m,
              ),
            );
          } else if (ev.type === 'error') {
            throw new Error(ev.error || 'The assistant hit an error while responding.');
          }
        };

        try {
          await aiChatService.streamConversation(conv.Id, payload, onEvent, ac.signal);
        } catch (err) {
          if (err.name === 'AbortError') {
            setActivity((a) => (a ? { ...a, done: true } : a));
            setMessages((prev) =>
              prev.map((m) => (m.id === mid ? { ...m, content: acc, streaming: false } : m)),
            );
            return;
          }
          throw err;
        }

        const seconds = (Date.now() - started) / 1000;
        setMessages((prev) =>
          prev.map((m) => (m.id === mid ? { ...m, streaming: false, tokensUsed: usedTokens, model: activeModel?.name } : m)),
        );
        setActivity((a) => (a ? { ...a, done: true, duration: seconds } : a));

        const isNew = !currentConv?.Id || !currentConv?.Title || currentConv.Title === 'New Conversation';
        if (isNew) {
          await aiChatService.updateConversationTitle(conv.Id, content.slice(0, 48));
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
        setTimeout(() => {
          setActivity((a) => (a && a.done ? null : a));
        }, 4000);
      }
    },
    [
      isStreaming,
      currentConv,
      modelId,
      settings,
      contextEntities,
      activeModel?.name,
      abortRef,
      loadConversations,
      loadUsage,
    ],
  );

  const steps = useMemo(
    () =>
      activity
        ? buildSteps({
            inFlight: !activity.done,
            receivedTool: activity?.receivedTool,
            firstChunk: activity?.firstChunk,
          })
        : null,
    [activity],
  );

  const handleSend = useCallback(
    (text) => {
      if (mode === 'execute' && !confirmOpen) {
        setPendingSend(text);
        setConfirmOpen(true);
        return;
      }
      doSend(text);
    },
    [mode, confirmOpen, doSend],
  );

  const confirmExecute = () => {
    setConfirmOpen(false);
    if (pendingSend) doSend(pendingSend);
    setPendingSend(null);
  };

  const cancelExecute = () => {
    setConfirmOpen(false);
    setPendingSend(null);
  };

  const handleStop = () => {
    if (abortRef.current) abortRef.current.abort();
  };

  /* ── Header scope / formats ─────────────────────────────────────────────── */
  const dateLabel = `${format(startDate, 'dd MMM')} – ${format(endDate, 'dd MMM')}`;

  const lastTool = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      if (messages[i].tool) return messages[i].tool;
    }
    return null;
  }, [messages]);

  const scopeChips = useMemo(() => {
    const chips = [
      { label: dateLabel, accent: true, show: !mobile },
      { label: 'Amazon', show: !mobile },
      ...contextEntities.map((c) => ({
        label: c.label,
        accent: true,
        show: true,
      })),
    ];
    if (lastTool && lastTool.rowCount != null) {
      chips.push({ label: `${lastTool.rowCount} rows analysed`, accent: true, show: true });
    }
    return chips;
  }, [dateLabel, contextEntities, lastTool, mobile]);

  const conversationTitle = currentConv?.Title || (messages.length ? (messages[0].content || '').slice(0, 48) : '');

  const toolStates = useMemo(
    () =>
      tools.map((t) => ({
        key: t.key,
        label: t.label,
        state: t.on ? 'connected' : 'off',
      })),
    [tools],
  );

  const session = useMemo(
    () => ({
      messages: messages.filter((m) => !m.streaming).length,
      toolsUsed: messages.filter((m) => m.tool).length,
      dataSources: tools.filter((t) => t.on).length,
    }),
    [messages, tools],
  );

  const insights = useMemo(() => {
    const out = [];
    const errors = messages.filter((m) => m.tool?.error).length;
    if (errors) out.push({ type: 'critical', label: 'Failed queries', count: errors });
    const recs = messages.filter((m) => m.structured?.recommendations?.length).length;
    if (recs) out.push({ type: 'ok', label: 'Recommendations', count: recs });
    if (lastTool && !lastTool.error) out.push({ type: 'ok', label: 'Data grounded', count: 1 });
    if (!out.length) out.push({ type: 'info', label: 'Session healthy', count: 0 });
    return out;
  }, [messages, lastTool]);

  /* ── Export / share ─────────────────────────────────────────────────────── */
  const handleCopy = (m) => {
    navigator.clipboard?.writeText(m.content).catch(() => {});
    setCopiedId(m.id);
    setTimeout(() => setCopiedId((c) => (c === m.id ? null : c)), 1400);
  };

  const buildTranscript = () =>
    messages
      .filter((m) => !m.streaming)
      .map((m) => `${m.role.toUpperCase()}\n${m.content}`)
      .join('\n\n---\n\n');

  const download = (name, body, type) => {
    const blob = new Blob([body], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExport = (type) => {
    const title = (currentConv?.Title || 'RetailOps-AI').replace(/[^\w\- ]+/g, '').trim();
    const stamp = dayjs().format('YYYYMMDD-HHmm');
    if (type === 'copy') {
      navigator.clipboard?.writeText(buildTranscript()).then(
        () => antdMessage?.success('Transcript copied'),
        () => antdMessage?.error('Could not copy'),
      );
      return;
    }
    if (type === 'md') download(`${title}-${stamp}.md`, `# ${title}\n\n${buildTranscript()}`, 'text/markdown');
    if (type === 'json') download(`${title}-${stamp}.json`, JSON.stringify(messages.filter((m) => !m.streaming), null, 2), 'application/json');
    if (type === 'csv') {
      const rows = ['role,createdAt,content'];
      messages.forEach((m) => {
        if (m.streaming) return;
        rows.push(`${m.role},"${String(m.content).replaceAll('"', '""')}"`);
      });
      download(`${title}-${stamp}.csv`, rows.join('\n'), 'text/csv');
    }
    antdMessage?.success(`Exported ${type.toUpperCase()}`);
  };

  const handleShare = () => {
    navigator.clipboard
      ?.writeText(window.location.href)
      .then(() => antdMessage?.success('Share link copied'))
      .catch(() => antdMessage?.error('Could not copy link'));
  };

  /* ── Confirmation summary ───────────────────────────────────────────────── */
  const confirmActions = useMemo(() => {
    if (!pendingSend) return [];
    const text = pendingSend.toLowerCase();
    const isTask = text.includes('task') || text.startsWith('/create-task');
    return [
      {
        label: isTask ? 'Create operational tasks' : 'Run investigation',
        detail: pendingSend.length > 40 ? `${pendingSend.slice(0, 40)}…` : pendingSend,
      },
      ...(lastTool?.rowCount ? [{ label: 'Affected records', detail: `${lastTool.rowCount} rows` }] : []),
    ];
  }, [pendingSend, lastTool]);

  const confirmScope = useMemo(
    () => [
      dateLabel,
      ...contextEntities.map((c) => c.label),
      lastTool?.rowCount ? `${lastTool.rowCount} records` : null,
      settings.includeDatabase ? 'Database connected' : 'Database off',
    ].filter(Boolean),
    [dateLabel, contextEntities, lastTool, settings.includeDatabase],
  );

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
        scopeChips={scopeChips}
        onShare={handleShare}
        onExport={handleExport}
        onRename={() => currentConv && handleRename(currentConv)}
        onClear={handleClear}
        onToggleConv={() => (mobile ? setMobileConvOpen((v) => !v) : setConvHidden((v) => !v))}
        onToggleContext={() => (mobile ? setMobileCtxOpen((v) => !v) : setContextHidden((v) => !v))}
        convHidden={convHidden}
        contextHidden={contextHidden}
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
            onArchive={handleArchive}
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
                  messages.map((m) => {
                    const active = activity && messages[messages.length - 1]?.id === m.id && m.streaming;
                    return (
                      <AIMessage
                        key={m.id}
                        message={m}
                        modelName={activeModel?.name}
                        copied={copiedId === m.id}
                        onCopy={handleCopy}
                        activity={active ? steps : null}
                        activitySeconds={activity?.duration}
                      />
                    );
                  })
                ) : (
                  <EmptyState
                    firstName={user?.firstName}
                    onCreatePrompt={(text, modeName) => {
                      setInput((prev) => (prev ? `${prev}\n${text}` : text));
                      setMode(modeName === 'execute' ? 'execute' : modeName === 'analyze' ? 'analyze' : 'ask');
                    }}
                  />
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
                onSend={handleSend}
                onStop={handleStop}
                isStreaming={isStreaming}
                disabled={messagesLoading}
                mode={mode}
                onModeChange={setMode}
                models={models}
                modelId={modelId}
                onModelChange={setModelId}
                databaseOn={settings.includeDatabase}
                onToggleDatabase={() => setSettings((s) => ({ ...s, includeDatabase: !s.includeDatabase }))}
                onOpenTools={() => setToolsOpen(true)}
                onUseMention={(ent) =>
                  setContextEntities((prev) => {
                    const exists = prev.some((c) => c.type === ent.id);
                    if (exists) return prev;
                    return [...prev, { type: ent.id, label: entriesLabel(ent.id), unit: ent.id }];
                  })
                }
              />
            </div>
          </div>
        </main>

        {!mobile && !contextHidden ? (
          <ContextPanel
            scope={[
              { label: dateLabel, accent: true },
              { label: 'Amazon' },
            ]}
            tools={toolStates}
            session={session}
            insights={insights}
            contextEntities={contextEntities}
            onAddContext={(c) =>
              setContextEntities((prev) =>
                prev.some((e) => e.type === c.type && e.label === c.label) ? prev : [...prev, c],
              )
            }
            onRemoveContext={(c) => setContextEntities((prev) => prev.filter((e) => !(e.type === c.type && e.label === c.label)))}
          />
        ) : null}

        {!mobile && contextHidden ? (
          <button
            type="button"
            className="ai-ws__ctx-pill"
            onClick={() => setContextHidden(false)}
            aria-label="Open context panel"
          >
            Context ›
          </button>
        ) : null}
      </div>

      {mobile ? (
        <>
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
                onArchive={handleArchive}
                onDelete={handleDelete}
                onRename={handleRename}
                usage={usage}
                usageLoading={usageLoading}
                modelCount={models.length}
              />
            </div>
          </Drawer>
          <Drawer placement="right" width={300} open={mobileCtxOpen} onClose={() => setMobileCtxOpen(false)} styles={{ body: { padding: 0 } }}>
            <ContextPanel
              scope={[{ label: dateLabel, accent: true }, { label: 'Amazon' }]}
              tools={toolStates}
              session={session}
              insights={insights}
              contextEntities={contextEntities}
              onAddContext={(c) => setContextEntities((prev) => [...prev, c])}
              onRemoveContext={(c) => setContextEntities((prev) => prev.filter((e) => !(e.type === c.type && e.label === c.label)))}
            />
          </Drawer>
        </>
      ) : null}

      <ToolSelector
        open={toolsOpen}
        onClose={() => setToolsOpen(false)}
        tools={tools}
        onToggle={(key) => {
          setTools((prev) => prev.map((t) => (t.key === key ? { ...t, on: !t.on } : t)));
          if (key === 'database') setSettings((s) => ({ ...s, includeDatabase: !s.includeDatabase }));
        }}
      />

      <AISettingsPanel
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={settings}
        onUpdate={(patch) => setSettings((s) => ({ ...s, ...patch }))}
        onReset={() => setSettings(DEFAULT_SETTINGS)}
        models={models}
        modelId={modelId}
        onModelChange={setModelId}
      />

      <ConfirmationDialog
        open={confirmOpen}
        onCancel={cancelExecute}
        onConfirm={confirmExecute}
        actions={confirmActions}
        scope={confirmScope}
        intensity={lastTool?.rowCount > 50 ? 'high' : 'medium'}
      />

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

const entriesLabel = (type) => {
  const map = {
    seller: '@ Seller',
    asin: '@ ASIN/SKU',
    campaign: '@ Campaign',
    task: '@ Task',
    marketplace: '@ Marketplace',
  };
  return map[type] || `@${type}`;
};

export default AIWorkspace;