import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { Button, Input, Tooltip, Avatar, Tag, Dropdown, Modal, Drawer, Slider, Switch, Select, Skeleton } from 'antd';
import {
  SendOutlined,
  PlusOutlined,
  DeleteOutlined,
  EditOutlined,
  RobotFilled,
  RobotOutlined,
  DatabaseOutlined,
  ConsoleSqlOutlined,
  LineChartOutlined,
  AppstoreOutlined,
  SettingOutlined,
  MenuOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  ThunderboltOutlined,
  StopOutlined,
  SearchOutlined,
  CopyOutlined,
  CheckOutlined,
  UserOutlined,
  StarOutlined,
  ExperimentOutlined,
  CloseOutlined,
  HistoryOutlined,
} from '@ant-design/icons';

import { aiChatService } from '../services/aiChatService';

dayjs.extend(relativeTime);

const FALLBACK_MODELS = [
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', category: 'Free', context: '1048576', weight: '3', notes: 'Fast, general purpose' },
  { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', category: 'Subscription', context: '1048576', weight: '12', notes: 'Advanced reasoning' },
  { id: 'gemini-3-flash', name: 'Gemini 3 Flash', category: 'Free', context: '1048576', weight: '4', notes: 'Latest fast model' },
  { id: 'gemini-3-pro', name: 'Gemini 3 Pro', category: 'Subscription', context: '1048576', weight: '15', notes: 'Latest premium model' },
];

const QUICK_ACTIONS = [
  {
    key: 'database',
    icon: <DatabaseOutlined />,
    title: 'Database analyst',
    desc: 'Ask questions across your product, listing and sales tables as SQL.',
    template: 'Analyze the latest 50 products and summarize the most important metrics for me:',
  },
  {
    key: 'listing',
    icon: <ConsoleSqlOutlined />,
    title: 'Listing writer',
    desc: 'Draft listings, A+ copy, bullets and search terms from table data.',
    template: 'Write a compelling listing title and feature bullets for ',
  },
  {
    key: 'pricing',
    icon: <LineChartOutlined />,
    title: 'Price strategist',
    desc: 'Compare pricing, margins and repricing signals across products.',
    template: 'Review my products\u2019 pricing versus the competition and flag opportunities:',
  },
  {
    key: 'inventory',
    icon: <AppstoreOutlined />,
    title: 'Inventory planner',
    desc: 'Replenishment, aging stock and forecasting guidance for your catalog.',
    template: 'Summarize my inventory levels and flag low-stock and overstock items:',
  },
];

const PRIMARY_QUERIES = [
  'Compare margin, price and units across the last 30 days',
  'Summarize the top 10 products by revenue',
  'Which ASINs are at risk of going out of stock?',
];

const SYSTEM_PROMPTS = [
  { value: 'default', label: 'Standard assistant' },
  { value: 'brand', label: 'Brand & listing expert' },
  { value: 'analyst', label: 'Strict data analyst' },
];

const DEFAULT_SETTINGS = {
  temperature: 0.7,
  maxTokens: 2048,
  includeDatabase: true,
  systemPrompt: 'default',
  streaming: true,
};

const CONTEXT_LABEL = { 1048576: '1M', 128000: '128K', 102400: '100K', 32768: '32K', 65536: '64K' };

function useIsMobile() {
  const [mobile, setMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth <= 920);
  useEffect(() => {
    const onResize = () => setMobile(window.innerWidth <= 920);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return mobile;
}

const formatTokens = (n) => {
  if (n == null || Number.isNaN(Number(n))) return null;
  const v = Number(n);
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
  return String(v);
};

const normalizeModels = (raw) => {
  if (!Array.isArray(raw)) return FALLBACK_MODELS;
  return raw.map((m) => ({
    id: m.id || m.ModelId || m.model || '',
    name: m.name || m.displayName || m.id || m.model || '',
    category: (m.category || 'Free').toLowerCase() === 'subscription' ? 'Subscription' : 'Free',
    context: m.context || m.contextLength || null,
    weight: m.weight || m.tokenWeight || m.tokensPerDollarMultiplier || null,
    notes: m.notes || m.description || '',
  }));
};

const MessagesSkeleton = () => (
  <div className="ai-chat-skeleton-wrap">
    <div className="ai-chat-skeleton-row right">
      <Skeleton active paragraph={{ rows: 2 }} title={false} />
    </div>
    <div className="ai-chat-skeleton-row">
      <Skeleton active paragraph={{ rows: 4 }} title={false} />
    </div>
    <div className="ai-chat-skeleton-row right">
      <Skeleton active paragraph={{ rows: 1 }} title={false} />
    </div>
    <div className="ai-chat-skeleton-row">
      <Skeleton active paragraph={{ rows: 3 }} title={false} />
    </div>
  </div>
);

const AIChatPage = () => {
  const isMobile = useIsMobile();

  const [models, setModels] = useState(FALLBACK_MODELS);
  const [modelsLoading, setModelsLoading] = useState(true);
  const [usage, setUsage] = useState(null);
  const [usageLoading, setUsageLoading] = useState(true);

  const [conversations, setConversations] = useState([]);
  const [conversationsLoading, setConversationsLoading] = useState(true);
  const [currentConversation, setCurrentConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messagesLoading, setMessagesLoading] = useState(false);

  const [selectedModel, setSelectedModel] = useState(FALLBACK_MODELS[0]?.id);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [abortRef] = useState(() => ({ current: null }));

  const [searchText, setSearchText] = useState('');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);

  const [topError, setTopError] = useState('');
  const [copiedId, setCopiedId] = useState(null);
  const [renameTarget, setRenameTarget] = useState(null);
  const [renameValue, setRenameValue] = useState('');

  const scrollRef = useRef(null);
  const composerRef = useRef(null);

  const activeModel = useMemo(() => models.find((m) => m.id === selectedModel) || models[0], [models, selectedModel]);
  const modelOptions = useMemo(() => {
    const items = (m) => ({
      key: `model:${m.id}`,
      label: (
        <div className="ai-model-opt">
          <span className="ai-model-opt-name">{m.name}</span>
          <span className="ai-model-opt-badges">
            {m.context ? <Tag className="ai-tag ai-tag-context">{CONTEXT_LABEL[m.context] || '—'}</Tag> : null}
            {m.weight ? <Tag className="ai-tag ai-tag-weight">×{m.weight}</Tag> : null}
          </span>
          {m.id === selectedModel ? <CheckOutlined className="ai-model-opt-check" /> : null}
        </div>
      ),
    });
    return [
      { type: 'group', label: 'Free', children: models.filter((m) => m.category === 'Free').map(items) },
      { type: 'group', label: 'Subscription', children: models.filter((m) => m.category === 'Subscription').map(items) },
    ];
  }, [models, selectedModel]);

  const filteredConversations = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter((c) => (c.Title || '').toLowerCase().includes(q));
  }, [conversations, searchText]);

  const usagePct = useMemo(() => {
    if (!usage) return 0;
    const total = Number(usage.monthlyTokenLimit || usage.totalTokensLimit || 0);
    const used = Number(usage.totalTokensUsed || 0);
    if (!total) return 0;
    return Math.min(100, Math.round((used / total) * 100));
  }, [usage]);

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const loadModels = useCallback(async () => {
    setModelsLoading(true);
    try {
      const res = await aiChatService.getModels();
      const list = normalizeModels(res.models || res.data?.models || res.data?.data || res);
      if (list.length) setModels(list);
    } catch (err) {
      setTopError(`Could not load models: ${err.message || 'unknown error'}`);
    } finally {
      setModelsLoading(false);
    }
  }, []);

  const loadUsage = useCallback(async () => {
    setUsageLoading(true);
    try {
      const res = await aiChatService.getUsage();
      setUsage(res.usage || res.data?.usage || res.data || res);
    } catch {
      /* usage is non-critical */
    } finally {
      setUsageLoading(false);
    }
  }, []);

  const loadConversations = useCallback(async () => {
    setConversationsLoading(true);
    try {
      const res = await aiChatService.listConversations(50);
      const list = res.conversations || res.data?.conversations || res;
      setConversations(Array.isArray(list) ? list : []);
    } catch (err) {
      if (err.status === 401) setTopError('Your session has expired. Please sign in again.');
      else setTopError(`Could not load conversations: ${err.message || 'unknown error'}`);
    } finally {
      setConversationsLoading(false);
    }
  }, []);

  const loadConversation = useCallback(async (id) => {
    setMessagesLoading(true);
    setMessages([]);
    try {
      const res = await aiChatService.getConversation(id);
      const conv = res.conversation || res.data?.conversation || null;
      const list = res.messages || res.data?.messages || res.message;
      setCurrentConversation((prev) => (prev && prev.Id === id ? prev : conv));
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

  const startNewConversation = useCallback(() => {
    setCurrentConversation(null);
    setMessages([]);
    setTopError('');
    setMobileOpen(false);
  }, []);

  const selectConversation = useCallback(
    (conv) => {
      setCurrentConversation(conv);
      setMobileOpen(false);
      loadConversation(conv.Id);
    },
    [loadConversation],
  );

  const handleDeleteConversation = (conv) => {
    Modal.confirm({
      title: 'Delete conversation?',
      content: `"${conv.Title || 'Untitled'}" will be permanently removed.`,
      okText: 'Delete',
      okType: 'danger',
      cancelText: 'Cancel',
      onOk: async () => {
        try {
          await aiChatService.deleteConversation(conv.Id);
          if (currentConversation?.Id === conv.Id) startNewConversation();
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
      setCurrentConversation((c) => (c && c.Id === renameTarget.Id ? { ...c, Title: title } : c));
      loadConversations();
    } catch (err) {
      setTopError(`Could not rename: ${err.message || 'unknown error'}`);
    } finally {
      setRenameTarget(null);
    }
  };

  const handleCopy = (mId, content) => {
    navigator.clipboard?.writeText(content).catch(() => {});
    setCopiedId(mId);
    setTimeout(() => setCopiedId((c) => (c === mId ? null : c)), 1400);
  };

  const handleStop = () => {
    if (abortRef.current) abortRef.current.abort();
  };

  const handleSend = useCallback(
    async (rawText) => {
      const text = (rawText ?? input).trim();
      if (!text || isStreaming) return;

      let conv = currentConversation;
      let mid = null;
      let userMsgId = null;
      try {
        setTopError('');
        if (!conv?.Id) {
          conv = await aiChatService.createConversation('New Conversation');
          setCurrentConversation(conv);
          loadConversations();
        }

        userMsgId = `u-${Date.now()}`;
        mid = `a-${Date.now()}`;
        const payload = {
          message: text,
          conversationId: conv.Id,
          options: {
            model: selectedModel,
            temperature: settings.temperature,
            maxTokens: settings.maxTokens,
            includeDatabase: settings.includeDatabase,
            systemPrompt: settings.systemPrompt,
          },
        };

        setInput('');
        setMessages((prev) => [
          ...prev,
          { id: userMsgId, role: 'user', content: text, createdAt: dayjs().toISOString() },
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
            setMessages((prev) => prev.map((m) => (m.id === mid ? { ...m, content: acc, streaming: false } : m)));
            return;
          }
          throw err;
        }

        setMessages((prev) => prev.map((m) => (m.id === mid ? { ...m, streaming: false, tokensUsed: usedTokens, model: activeModel?.name } : m)));

        const isNew = !currentConversation?.Id || !currentConversation?.Title || currentConversation.Title === 'New Conversation';
        if (isNew && text.length > 0) {
          await aiChatService.updateConversationTitle(conv.Id, text.slice(0, 48));
        }
        loadConversations();
        loadUsage();
      } catch (err) {
        setTopError(err.message || 'Unexpected error while sending your message.');
        setMessages((prev) =>
          prev.map((m) => (mid && m.id === mid ? { ...m, streaming: false, error: err.message || 'Unexpected error', content: '' } : m)),
        );
      } finally {
        setIsStreaming(false);
        abortRef.current = null;
      }
    },
    [input, isStreaming, currentConversation, selectedModel, settings, activeModel, abortRef, loadConversations, loadUsage],
  );

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const applyQuickAction = (action) => {
    setInput(action.template);
    requestAnimationFrame(() => {
      const ta = composerRef.current?.querySelector('textarea');
      if (ta) {
        ta.focus();
        ta.setSelectionRange(ta.value.length, ta.value.length);
      }
    });
  };

  const runPrimaryQuery = (q) => {
    setInput(q);
    requestAnimationFrame(() => handleSend(q));
  };

  const handleModelClick = ({ key }) => {
    const id = key.startsWith('model:') ? key.slice(6) : key;
    if (id) setSelectedModel(id);
  };

  const renderContent = (content) => {
    if (!content) return null;
    const parts = content.split('```');
    return parts.map((part, i) => {
      if (i % 2 === 0) {
        if (!part.trim()) return null;
        return (
          <p key={i} className="ai-chat-par">
            {part}
          </p>
        );
      }
      return (
        <pre key={i} className="ai-chat-code">
          <code>{part}</code>
        </pre>
      );
    });
  };

  const renderTokenUsage = () => {
    const total = Number(usage?.monthlyTokenLimit || usage?.totalTokensLimit || 0);
    const used = Number(usage?.totalTokensUsed || 0);
    const pct = usagePct;
    const tone = pct > 95 ? 'danger' : pct > 80 ? 'warn' : 'ok';
    const label = usageLoading ? 'Loading usage…' : `${formatTokens(used) || 0} / ${formatTokens(total) || '—'} tokens`;
    return (
      <div className="ai-chat-usage">
        <div className="ai-chat-usage-head">
          <Tooltip title="Open settings">
            <button type="button" className="ai-chat-usage-title" onClick={() => setSettingsOpen(true)}>
              <ThunderboltOutlined /> Token usage
            </button>
          </Tooltip>
          <span className={`ai-chat-usage-pct tone-${tone}`}>{pct}%</span>
        </div>
        <div className="ai-chat-usage-bar">
          <span className={`fill tone-${tone}`} style={{ width: `${pct}%` }} />
        </div>
        <div className="ai-chat-usage-label">{label}</div>
      </div>
    );
  };

  const renderModelDropdown = (ghost = false) => (
    <Dropdown menu={{ items: modelOptions, onClick: handleModelClick }} trigger={['click']} placement="bottomRight">
      <Button className={ghost ? 'ai-model-trigger ghost' : 'ai-model-trigger'} loading={modelsLoading} icon={<StarOutlined />}>
        <span className="ai-model-trigger-label">{activeModel?.name || 'Select model'}</span>
        {activeModel?.context ? <Tag className="ai-tag ai-tag-context">{CONTEXT_LABEL[activeModel.context] || '—'}</Tag> : null}
      </Button>
    </Dropdown>
  );

  const renderSidebar = () => (
    <>
      <div className="ai-chat-brand">
        <div className="ai-chat-brand-avatar">
          <RobotFilled />
        </div>
        <div className="ai-chat-brand-text">
          <span className="ai-chat-brand-name">RetailOps AI</span>
          <span className="ai-chat-brand-sub">Intelligent assistant</span>
        </div>
        <Tag className="ai-tag ai-tag-models">{models.length} models</Tag>
      </div>

      <div className="ai-chat-sidebar-actions">
        <Button type="primary" block icon={<PlusOutlined />} onClick={startNewConversation} className="ai-new-chat-btn">
          New conversation
        </Button>
        <Input
          prefix={<SearchOutlined />}
          placeholder="Search conversations…"
          allowClear
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          className="ai-search-input"
        />
      </div>

      <div className="ai-chat-conv-label">
        <span>Recents</span>
        <span className="ai-chat-conv-count">{conversations.length}</span>
      </div>

      <div className="ai-chat-conv-list">
        {conversationsLoading ? (
          <div className="ai-chat-conv-skeleton">
            {[1, 2, 3, 4].map((n) => (
              <Skeleton key={n} active avatar={{ shape: 'square', size: 36 }} paragraph={{ rows: 1, width: '70%' }} title={false} />
            ))}
          </div>
        ) : filteredConversations.length ? (
          filteredConversations.map((conv) => {
            const active = currentConversation?.Id === conv.Id;
            return (
              <div
                key={conv.Id}
                className={`ai-chat-conv-item${active ? ' active' : ''}`}
                role="button"
                tabIndex={0}
                onClick={() => selectConversation(conv)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') selectConversation(conv);
                }}
              >
                <div className="ai-chat-conv-icon">
                  <HistoryOutlined />
                </div>
                <div className="ai-chat-conv-body">
                  <div className="ai-chat-conv-title">{conv.Title || 'Untitled'}</div>
                  <div className="ai-chat-conv-meta">
                    <span>{conv.UpdatedAt ? dayjs(conv.UpdatedAt).fromNow() : 'now'}</span>
                    <span className="dot">·</span>
                    <span>{conv.MessageCount ?? conv.messageCount ?? 0} msgs</span>
                  </div>
                </div>
                <div className="ai-chat-conv-tools">
                  <Tooltip title="Rename">
                    <button type="button" className="ai-round-btn" onClick={(e) => { e.stopPropagation(); handleRename(conv); }}>
                      <EditOutlined />
                    </button>
                  </Tooltip>
                  <Tooltip title="Delete">
                    <button type="button" className="ai-round-btn danger" onClick={(e) => { e.stopPropagation(); handleDeleteConversation(conv); }}>
                      <DeleteOutlined />
                    </button>
                  </Tooltip>
                </div>
              </div>
            );
          })
        ) : (
          <div className="ai-chat-conv-empty">
            <RobotOutlined />
            <p>{searchText ? 'No conversations match your search.' : 'No conversations yet.'}</p>
          </div>
        )}
      </div>

      <div className="ai-chat-sidebar-footer">{renderTokenUsage()}</div>
    </>
  );

  const renderEmptyState = () => (
    <div className="ai-chat-empty">
      <div className="ai-chat-empty-hero">
        <div className="ai-chat-empty-logo">
          <RobotFilled />
        </div>
      </div>
      <h1 className="ai-chat-empty-title">How can I help you today?</h1>
      <p className="ai-chat-empty-sub">
        Ask questions about your catalog, listings, pricing and inventory. RetailOps AI can query your database tables with
        {settings.includeDatabase ? ' database context enabled.' : ' database context off.'}
      </p>

      <div className="ai-chat-quick-grid">
        {QUICK_ACTIONS.map((action) => (
          <button type="button" key={action.key} className="ai-quick-card" onClick={() => applyQuickAction(action)}>
            <div className="ai-quick-icon">{action.icon}</div>
            <div className="ai-quick-text">
              <span className="ai-quick-title">{action.title}</span>
              <span className="ai-quick-desc">{action.desc}</span>
            </div>
          </button>
        ))}
      </div>

      <div className="ai-chat-primary-row">
        {PRIMARY_QUERIES.map((q) => (
          <Tag key={q} className="ai-query-chip" onClick={() => runPrimaryQuery(q)}>
            {q}
          </Tag>
        ))}
      </div>
    </div>
  );

  const renderMessageBubble = (m) => {
    const isUser = m.role === 'user';
    const isTyping = m.streaming;
    return (
      <div key={m.id} className={`ai-msg-row ${isUser ? 'user' : 'assistant'}`}>
        {!isUser ? (
          <div className="ai-msg-avatar">
            <Avatar size={34} icon={<RobotOutlined />} className={m.error ? 'error' : ''} />
          </div>
        ) : null}
        <div className={`ai-msg-stack ${isUser ? 'user' : 'assistant'}`}>
          {!isUser ? (
            <div className="ai-msg-meta">
              <span className="ai-msg-author">RetailOps AI</span>
              {m.model ? <Tag className="ai-tag ai-tag-model">{m.model}</Tag> : null}
              {m.tokensUsed ? <span className="ai-msg-tokens">{formatTokens(m.tokensUsed)} tokens</span> : null}
              {m.createdAt ? <span className="ai-msg-time">{dayjs(m.createdAt).format('HH:mm')}</span> : null}
            </div>
          ) : null}

          <div className={`ai-msg-bubble${isUser ? ' user' : ''}${m.error ? ' error' : ''}`}>
            {m.error ? (
              <>
                <strong>Something went wrong.</strong>
                <span className="ai-msg-error-text">{m.error}</span>
              </>
            ) : (
              renderContent(m.content)
            )}
            {isTyping ? (
              <span className="ai-typing">
                <i />
                <i />
                <i />
              </span>
            ) : null}
          </div>

          {!isUser && !isTyping ? (
            <div className="ai-msg-tools">
              <Tooltip title="Copy response">
                <button type="button" className="ai-round-btn sm" onClick={() => handleCopy(m.id, m.content)}>
                  {copiedId === m.id ? <CheckOutlined /> : <CopyOutlined />}
                </button>
              </Tooltip>
              <span className="ai-msg-hint">{m.stopped ? 'Stopped' : null}</span>
            </div>
          ) : null}
        </div>
        {isUser ? (
          <div className="ai-msg-avatar user">
            <Avatar size={34} icon={<UserOutlined />} />
          </div>
        ) : null}
      </div>
    );
  };

  const renderComposer = () => (
    <div className="ai-chat-composer-wrap">
      {isStreaming ? (
        <div className="ai-chat-streaming-note">
          <span className="ai-typing">
            <i />
            <i />
            <i />
          </span>
          <span>RetailOps AI is responding…</span>
        </div>
      ) : null}
      <div className="ai-chat-composer">
        <Input.TextArea
          ref={composerRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Message RetailOps AI…  (Enter to send, Shift+Enter for a new line)"
          autoSize={{ minRows: 1, maxRows: 8 }}
          variant="borderless"
          disabled={isStreaming}
        />
        <div className="ai-chat-composer-actions">
          <div className="ai-chat-composer-left">
            <Tooltip title={settings.includeDatabase ? 'Database context is ON' : 'Database context is OFF'}>
              <button
                type="button"
                className={`ai-db-chip${settings.includeDatabase ? ' on' : ''}`}
                onClick={() => setSettings((s) => ({ ...s, includeDatabase: !s.includeDatabase }))}
              >
                <DatabaseOutlined />
                <span>Database</span>
              </button>
            </Tooltip>
            <span className="ai-composer-model">{activeModel?.name}</span>
          </div>
          <div className="ai-chat-composer-right">
            {isStreaming ? (
              <Button type="primary" danger shape="circle" icon={<StopOutlined />} onClick={handleStop} className="ai-send-btn" />
            ) : (
              <Button
                type="primary"
                shape="circle"
                icon={<SendOutlined />}
                onClick={() => handleSend()}
                disabled={!input.trim()}
                className="ai-send-btn"
              />
            )}
          </div>
        </div>
      </div>
      <div className="ai-chat-composer-foot">
        <span>RetailOps AI can make mistakes. Verify important data before acting on it.</span>
      </div>
    </div>
  );

  return (
    <div className="ai-chat-page">
      {topError ? (
        <div className="ai-chat-error-banner">
          <span className="ai-chat-error-icon">!</span>
          <span className="ai-chat-error-text">{topError}</span>
          <button type="button" className="ai-btn-close" onClick={() => setTopError('')}>
            <CloseOutlined />
          </button>
        </div>
      ) : null}

      <div className="ai-chat-body">
        {!isMobile && !sidebarCollapsed ? <aside className="ai-chat-sidebar">{renderSidebar()}</aside> : null}

        <main className="ai-chat-main">
          <header className="ai-chat-topbar">
            <div className="ai-chat-topbar-left">
              {isMobile ? (
                <button type="button" className="ai-round-btn sm" onClick={() => setMobileOpen(true)}>
                  <MenuOutlined />
                </button>
              ) : (
                <Tooltip title={sidebarCollapsed ? 'Show conversations' : 'Hide conversations'}>
                  <button
                    type="button"
                    className="ai-round-btn sm"
                    onClick={() => setSidebarCollapsed((v) => !v)}
                  >
                    {sidebarCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
                  </button>
                </Tooltip>
              )}
              <div className="ai-chat-title-block">
                <span className="ai-chat-title">{currentConversation?.Title || 'New conversation'}</span>
                <span className="ai-chat-title-meta">
                  {messages.length > 0 ? `${messages.length} messages` : 'Start a conversation below'}
                </span>
              </div>
            </div>
            <div className="ai-chat-topbar-right">
              {renderModelDropdown()}
              <Tooltip title="Settings">
                <button type="button" className="ai-round-btn" onClick={() => setSettingsOpen(true)}>
                  <SettingOutlined />
                </button>
              </Tooltip>
            </div>
          </header>

          <div className="ai-chat-scroll" ref={scrollRef}>
            <div className="ai-chat-scroll-inner">
              {messagesLoading ? (
                <MessagesSkeleton />
              ) : messages.length ? (
                messages.map(renderMessageBubble)
              ) : (
                renderEmptyState()
              )}
            </div>
          </div>

          {renderComposer()}
        </main>
      </div>

      {isMobile ? (
        <Drawer
          placement="left"
          width={316}
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          closable={false}
          styles={{ body: { padding: 0 } }}
          className="ai-chat-mobile-drawer"
        >
          <div className="ai-chat-sidebar mobile">{renderSidebar()}</div>
        </Drawer>
      ) : null}

      <Drawer
        title="AI settings"
        placement="right"
        width={380}
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        className="ai-chat-settings"
      >
        <div className="ai-settings-section">
          <h3 className="ai-settings-head">
            <StarOutlined /> Model
          </h3>
          <p className="ai-settings-desc">Choose which Gemini model handles your messages.</p>
          {renderModelDropdown(true)}
          {activeModel?.notes ? <p className="ai-settings-note">{activeModel.notes}</p> : null}
        </div>

        <div className="ai-settings-section">
          <h3 className="ai-settings-head">
            <ExperimentOutlined /> Response
          </h3>
          <div className="ai-settings-field">
            <div className="ai-settings-field-label">
              <span>Temperature</span>
              <Tag className="ai-tag">{settings.temperature.toFixed(1)}</Tag>
            </div>
            <Slider
              min={0}
              max={2}
              step={0.1}
              value={settings.temperature}
              onChange={(v) => setSettings((s) => ({ ...s, temperature: v }))}
              tooltip={{ open: false }}
            />
            <span className="ai-settings-hint">Lower = precise, higher = creative.</span>
          </div>
          <div className="ai-settings-field">
            <div className="ai-settings-field-label">
              <span>Max output tokens</span>
            </div>
            <Input
              type="number"
              min={256}
              max={8192}
              step={256}
              value={settings.maxTokens}
              onChange={(e) => setSettings((s) => ({ ...s, maxTokens: Number(e.target.value) || 2048 }))}
            />
          </div>
          <div className="ai-settings-field">
            <div className="ai-settings-field-label">
              <span>Stream responses</span>
            </div>
            <Switch checked={settings.streaming} onChange={(v) => setSettings((s) => ({ ...s, streaming: v }))} />
          </div>
        </div>

        <div className="ai-settings-section">
          <h3 className="ai-settings-head">
            <DatabaseOutlined /> Context
          </h3>
          <div className="ai-settings-field row">
            <div className="ai-settings-field-label">
              <span>Include database</span>
              <span className="ai-settings-hint">Let the assistant run SQL over your tables.</span>
            </div>
            <Switch
              checked={settings.includeDatabase}
              onChange={(v) => setSettings((s) => ({ ...s, includeDatabase: v }))}
            />
          </div>
        </div>

        <div className="ai-settings-section">
          <h3 className="ai-settings-head">
            <RobotOutlined /> Assistance
          </h3>
          <div className="ai-settings-field">
            <span className="ai-settings-field-label">System architecture</span>
            <Select
              style={{ width: '100%' }}
              value={settings.systemPrompt}
              onChange={(v) => setSettings((s) => ({ ...s, systemPrompt: v }))}
              options={SYSTEM_PROMPTS}
            />
          </div>
        </div>

        <div className="ai-settings-actions">
          <Button block onClick={() => setSettings(DEFAULT_SETTINGS)}>
            Reset defaults
          </Button>
        </div>
      </Drawer>

      <Modal
        title="Rename conversation"
        open={!!renameTarget}
        onOk={confirmRename}
        onCancel={() => setRenameTarget(null)}
        okText="Save"
        cancelText="Cancel"
        destroyOnClose
      >
        <Input
          value={renameValue}
          onChange={(e) => setRenameValue(e.target.value)}
          onPressEnter={confirmRename}
          placeholder="Conversation title"
          autoFocus
        />
      </Modal>

      <style>{`
        .ai-chat-page {
          height: 100%;
          display: flex;
          flex-direction: column;
          background: var(--bc-surface-page);
          color: var(--bc-text-body);
          overflow: hidden;
        }
        .ai-chat-error-banner {
          display: flex;
          align-items: center;
          gap: var(--bc-space-3);
          padding: var(--bc-space-3) var(--bc-space-5);
          background: var(--bc-red-50);
          border-bottom: 1px solid var(--bc-red-200);
          color: var(--bc-red-700);
          font-size: var(--bc-text-sm);
        }
        body.bc-dark .ai-chat-error-banner { background: rgba(239, 68, 68, 0.12); color: #fca5a5; border-color: var(--bc-red-800); }
        .ai-chat-error-icon {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 18px; height: 18px;
          border-radius: var(--bc-radius-full);
          background: var(--bc-red-500);
          color: var(--bc-white);
          font-weight: var(--bc-weight-bold);
          font-size: 11px;
          flex-shrink: 0;
        }
        .ai-chat-error-text { flex: 1; }
        .ai-btn-close {
          border: none;
          background: transparent;
          color: inherit;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 4px;
        }
        .ai-chat-body { flex: 1; display: flex; min-height: 0; }
        .ai-chat-sidebar {
          width: 304px;
          flex-shrink: 0;
          border-right: 1px solid var(--bc-border-subtle);
          background: var(--bc-surface-card);
          display: flex;
          flex-direction: column;
          min-height: 0;
        }
        .ai-chat-sidebar.mobile { width: 100%; height: 100%; border-right: none; }
        .ai-chat-brand {
          display: flex;
          align-items: center;
          gap: var(--bc-space-3);
          padding: var(--bc-space-5) var(--bc-space-4) var(--bc-space-3);
        }
        .ai-chat-brand-avatar {
          width: 40px; height: 40px;
          border-radius: var(--bc-radius-xl);
          background: linear-gradient(135deg, var(--bc-ro-500), var(--bc-primary-600));
          color: var(--bc-white);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 20px;
          box-shadow: var(--bc-shadow-sm);
          flex-shrink: 0;
        }
        .ai-chat-brand-text { display: flex; flex-direction: column; min-width: 0; }
        .ai-chat-brand-name { font-weight: var(--bc-weight-semibold); color: var(--bc-text-heading); font-size: var(--bc-text-base); }
        .ai-chat-brand-sub { color: var(--bc-text-muted); font-size: var(--bc-text-xs); }
        .ai-tag { border: none; font-size: 11px; line-height: 18px; }
        .ai-tag-models { background: var(--bc-primary-50); color: var(--bc-primary-500); margin: 0; }
        .ai-tag-context { background: var(--bc-slate-100); color: var(--bc-slate-600); margin: 0; }
        body.bc-dark .ai-tag-context { background: var(--bc-surface-hover); color: var(--bc-text-secondary); }
        .ai-tag-weight { background: var(--bc-amber-100); color: var(--bc-amber-800); margin: 0; }
        body.bc-dark .ai-tag-weight { background: rgba(245, 158, 11, 0.18); color: #fbbf24; }
        .ai-tag-model { background: var(--bc-ro-50); color: var(--bc-ro-700); margin: 0; }
        body.bc-dark .ai-tag-model { background: rgba(25, 118, 210, 0.18); color: #90caf9; }
        .ai-chat-sidebar-actions { display: flex; flex-direction: column; gap: var(--bc-space-3); padding: var(--bc-space-2) var(--bc-space-4) var(--bc-space-3); }
        .ai-new-chat-btn { height: 38px; border-radius: var(--bc-radius-lg); font-weight: var(--bc-weight-medium); }
        .ai-new-chat-btn.ant-btn-primary { background: var(--bc-primary-500); box-shadow: none; }
        .ai-new-chat-btn.ant-btn-primary:hover { background: var(--bc-primary-600); }
        .ai-search-input.ant-input-affix-wrapper { background: var(--bc-surface-page); border-color: var(--bc-border-default); border-radius: var(--bc-radius-lg); }
        body.bc-dark .ai-search-input.ant-input-affix-wrapper { background: var(--bc-surface-muted); }
        .ai-search-input .ant-input-prefix { color: var(--bc-text-muted); }
        .ai-chat-conv-label {
          display: flex; align-items: center; justify-content: space-between;
          padding: var(--bc-space-2) var(--bc-space-4);
          color: var(--bc-text-muted);
          font-size: var(--bc-text-xs);
          text-transform: uppercase;
          letter-spacing: var(--bc-tracking-wide);
        }
        .ai-chat-conv-count { background: var(--bc-slate-100); color: var(--bc-slate-600); padding: 0 8px; border-radius: var(--bc-radius-full); font-size: 11px; }
        body.bc-dark .ai-chat-conv-count { background: var(--bc-surface-hover); color: var(--bc-text-secondary); }
        .ai-chat-conv-list { flex: 1; overflow-y: auto; padding: 0 var(--bc-space-2); min-height: 0; }
        .ai-chat-conv-skeleton { padding: var(--bc-space-2) var(--bc-space-2); }
        .ai-chat-conv-skeleton .ant-skeleton { margin-bottom: var(--bc-space-4); }
        .ai-chat-conv-item {
          display: flex; align-items: center; gap: var(--bc-space-3);
          padding: var(--bc-space-3);
          border-radius: var(--bc-radius-lg);
          cursor: pointer;
          transition: background var(--bc-transition-fast);
          position: relative;
        }
        .ai-chat-conv-item:hover { background: var(--bc-surface-hover); }
        .ai-chat-conv-item.active { background: var(--bc-primary-50); }
        body.bc-dark .ai-chat-conv-item.active { background: var(--bc-primary-100); }
        .ai-chat-conv-item.active::before {
          content: '';
          position: absolute; left: -2px; top: 20%; bottom: 20%;
          width: 3px; border-radius: var(--bc-radius-full);
          background: var(--bc-primary-500);
        }
        .ai-chat-conv-icon {
          width: 34px; height: 34px; flex-shrink: 0;
          border-radius: var(--bc-radius-md);
          background: var(--bc-surface-page);
          border: 1px solid var(--bc-border-subtle);
          color: var(--bc-text-secondary);
          display: flex; align-items: center; justify-content: center;
          font-size: 14px;
        }
        body.bc-dark .ai-chat-conv-icon { background: var(--bc-surface-muted); }
        .ai-chat-conv-item.active .ai-chat-conv-icon { background: var(--bc-primary-500); border-color: var(--bc-primary-500); color: var(--bc-white); }
        .ai-chat-conv-body { flex: 1; min-width: 0; }
        .ai-chat-conv-title { color: var(--bc-text-heading); font-size: var(--bc-text-sm); font-weight: var(--bc-weight-medium); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .ai-chat-conv-meta { color: var(--bc-text-muted); font-size: var(--bc-text-xs); margin-top: 2px; }
        .ai-chat-conv-meta .dot { margin: 0 4px; }
        .ai-chat-conv-tools { display: none; align-items: center; gap: 2px; flex-shrink: 0; }
        .ai-chat-conv-item:hover .ai-chat-conv-tools { display: flex; }
        .ai-round-btn {
          border: none; background: transparent; cursor: pointer;
          width: 30px; height: 30px;
          display: inline-flex; align-items: center; justify-content: center;
          border-radius: var(--bc-radius-md);
          color: var(--bc-text-secondary);
          transition: background var(--bc-transition-fast), color var(--bc-transition-fast);
          font-size: 14px;
        }
        .ai-round-btn:hover { background: var(--bc-surface-hover); color: var(--bc-text-heading); }
        .ai-round-btn.danger:hover { background: var(--bc-red-50); color: var(--bc-red-600); }
        body.bc-dark .ai-round-btn.danger:hover { background: rgba(239, 68, 68, 0.15); }
        .ai-round-btn.sm { width: 28px; height: 28px; font-size: 14px; }
        .ai-chat-conv-empty { display: flex; flex-direction: column; align-items: center; gap: var(--bc-space-2); padding: var(--bc-space-10) var(--bc-space-4); color: var(--bc-text-muted); font-size: var(--bc-text-sm); text-align: center; }
        .ai-chat-conv-empty .anticon { font-size: 26px; color: var(--bc-slate-300); }
        body.bc-dark .ai-chat-conv-empty .anticon { color: var(--bc-slate-600); }
        .ai-chat-sidebar-footer { padding: var(--bc-space-4); border-top: 1px solid var(--bc-border-subtle); }
        .ai-chat-usage-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--bc-space-2); }
        .ai-chat-usage-title { border: none; background: none; cursor: pointer; color: var(--bc-text-secondary); font-size: var(--bc-text-xs); font-weight: var(--bc-weight-medium); display: inline-flex; align-items: center; gap: 6px; padding: 0; }
        .ai-chat-usage-title:hover { color: var(--bc-text-heading); }
        .ai-chat-usage-pct { font-size: var(--bc-text-xs); font-weight: var(--bc-weight-semibold); }
        .ai-chat-usage-pct.tone-ok { color: var(--bc-green-600); }
        .ai-chat-usage-pct.tone-warn { color: var(--bc-amber-600); }
        .ai-chat-usage-pct.tone-danger { color: var(--bc-red-600); }
        .ai-chat-usage-bar { height: 6px; border-radius: var(--bc-radius-full); background: var(--bc-surface-hover); overflow: hidden; }
        .ai-chat-usage-bar .fill { display: block; height: 100%; border-radius: var(--bc-radius-full); transition: width 0.4s var(--bc-ease-out); }
        .ai-chat-usage-bar .fill.tone-ok { background: var(--bc-green-500); }
        .ai-chat-usage-bar .fill.tone-warn { background: var(--bc-amber-500); }
        .ai-chat-usage-bar .fill.tone-danger { background: var(--bc-red-500); }
        .ai-chat-usage-label { margin-top: var(--bc-space-2); color: var(--bc-text-muted); font-size: var(--bc-text-xs); }

        .ai-chat-main { flex: 1; display: flex; flex-direction: column; min-width: 0; min-height: 0; }
        .ai-chat-topbar {
          display: flex; align-items: center; justify-content: space-between;
          gap: var(--bc-space-3);
          padding: var(--bc-space-3) var(--bc-space-5);
          border-bottom: 1px solid var(--bc-border-subtle);
          background: var(--bc-surface-page);
        }
        .ai-chat-topbar-left { display: flex; align-items: center; gap: var(--bc-space-3); min-width: 0; }
        .ai-chat-title-block { display: flex; flex-direction: column; min-width: 0; }
        .ai-chat-title { color: var(--bc-text-heading); font-weight: var(--bc-weight-semibold); font-size: var(--bc-text-md); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .ai-chat-title-meta { color: var(--bc-text-muted); font-size: var(--bc-text-xs); }
        .ai-chat-topbar-right { display: flex; align-items: center; gap: var(--bc-space-2); }
        .ai-model-trigger {
          display: inline-flex; align-items: center; gap: 8px;
          border-color: var(--bc-border-default);
          color: var(--bc-text-body);
          background: var(--bc-surface-card);
          border-radius: var(--bc-radius-lg);
          height: 34px;
          max-width: 260px;
        }
        .ai-model-trigger:hover { border-color: var(--bc-primary-500); color: var(--bc-primary-500); }
        .ai-model-trigger .ai-model-trigger-label { max-width: 160px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: var(--bc-text-sm); }
        .ai-model-trigger .ai-tag { margin-left: auto; }
        .ai-model-opt { display: flex; align-items: center; gap: 8px; width: 100%; min-width: 220px; }
        .ai-model-opt-name { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .ai-model-opt-badges { display: flex; gap: 4px; flex-shrink: 0; }
        .ai-model-opt-check { color: var(--bc-primary-500); flex-shrink: 0; }

        .ai-chat-scroll { flex: 1; overflow-y: auto; min-height: 0; scroll-behavior: smooth; }
        .ai-chat-scroll-inner { max-width: 860px; margin: 0 auto; padding: var(--bc-space-8) var(--bc-space-5) var(--bc-space-4); display: flex; flex-direction: column; gap: var(--bc-space-6); }
        .ai-chat-skeleton-wrap { display: flex; flex-direction: column; gap: var(--bc-space-6); }
        .ai-chat-skeleton-row { max-width: 78%; }
        .ai-chat-skeleton-row.right { align-self: flex-end; width: 60%; }
        .ai-chat-skeleton-row .ant-skeleton-paragraph > li, .ai-chat-skeleton-row .ant-skeleton-title {
          border-radius: var(--bc-radius-md);
        }
        .ai-chat-skeleton-row .ant-skeleton-title { border-radius: var(--bc-radius-md); }

        .ai-msg-row { display: flex; gap: var(--bc-space-3); align-items: flex-start; }
        .ai-msg-row.user { justify-content: flex-end; }
        .ai-msg-avatar { flex-shrink: 0; margin-top: 2px; }
        .ai-msg-avatar .ant-avatar { background: var(--bc-surface-hover); color: var(--bc-primary-500); border: 1px solid var(--bc-border-subtle); }
        .ai-msg-avatar .ant-avatar.error { background: var(--bc-red-50); color: var(--bc-red-600); border-color: var(--bc-red-200); }
        .ai-msg-avatar.user .ant-avatar { background: var(--bc-primary-500); color: var(--bc-white); border: none; }
        .ai-msg-stack { display: flex; flex-direction: column; gap: var(--bc-space-2); max-width: 78%; min-width: 0; }
        .ai-msg-stack.user { align-items: flex-end; }
        .ai-msg-meta { display: flex; align-items: center; gap: 8px; padding-left: 2px; }
        .ai-msg-author { font-size: var(--bc-text-xs); font-weight: var(--bc-weight-semibold); color: var(--bc-text-secondary); }
        .ai-msg-time, .ai-msg-tokens { font-size: var(--bc-text-xs); color: var(--bc-text-muted); }
        .ai-msg-bubble {
          background: var(--bc-surface-card);
          border: 1px solid var(--bc-border-subtle);
          border-radius: var(--bc-radius-xl);
          border-top-left-radius: var(--bc-radius-sm);
          padding: var(--bc-space-4) var(--bc-space-5);
          box-shadow: var(--bc-shadow-card);
          color: var(--bc-text-body);
          font-size: var(--bc-text-sm);
          line-height: 1.6;
        }
        .ai-msg-bubble.user {
          background: var(--bc-primary-500);
          border-color: var(--bc-primary-500);
          border-radius: var(--bc-radius-xl);
          border-top-right-radius: var(--bc-radius-sm);
          color: var(--bc-white);
          box-shadow: var(--bc-shadow-sm);
        }
        .ai-msg-bubble.error {
          background: var(--bc-red-50);
          border-color: var(--bc-red-200);
          color: var(--bc-red-700);
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        body.bc-dark .ai-msg-bubble.error { background: rgba(239,68,68,0.12); border-color: var(--bc-red-800); color: #fca5a5; }
        .ai-msg-error-text { color: inherit; opacity: 0.85; }
        .ai-msg-bubble.user strong { color: var(--bc-white); }
        .ai-chat-par { margin: 0 0 8px; white-space: pre-wrap; overflow-wrap: anywhere; }
        .ai-chat-par:last-child { margin-bottom: 0; }
        .ai-chat-code {
          margin: var(--bc-space-3) 0;
          padding: var(--bc-space-3) var(--bc-space-4);
          background: var(--bc-slate-900);
          color: #e2e8f0;
          border-radius: var(--bc-radius-md);
          font-family: var(--bc-font-mono);
          font-size: var(--bc-text-xs);
          overflow-x: auto;
          white-space: pre-wrap;
          word-break: break-word;
        }
        .ai-msg-bubble.user .ai-chat-code { background: rgba(0, 0, 0, 0.28); color: #fff; }
        .ai-typing { display: inline-flex; gap: 4px; align-items: center; padding: 4px 2px; }
        .ai-typing i { width: 6px; height: 6px; border-radius: var(--bc-radius-full); background: var(--bc-text-muted); animation: ai-blink 1.2s infinite; }
        .ai-typing i:nth-child(2) { animation-delay: 0.2s; }
        .ai-typing i:nth-child(3) { animation-delay: 0.4s; }
        .ai-msg-bubble.user .ai-typing i { background: rgba(255,255,255,0.8); }
        @keyframes ai-blink { 0%, 80%, 100% { opacity: 0.3; transform: scale(0.85); } 40% { opacity: 1; transform: scale(1); } }
        .ai-msg-tools { display: flex; align-items: center; gap: 4px; padding-left: 2px; }
        .ai-msg-hint { font-size: var(--bc-text-xs); color: var(--bc-text-muted); }
        body.bc-dark .ai-msg-bubble.user { background: var(--bc-primary-600); border-color: var(--bc-primary-600); }

        .ai-chat-composer-wrap { padding: var(--bc-space-3) var(--bc-space-5) var(--bc-space-4); background: var(--bc-surface-page); }
        .ai-chat-streaming-note { display: flex; align-items: center; gap: 8px; max-width: 860px; margin: 0 auto 8px; color: var(--bc-text-muted); font-size: var(--bc-text-xs); }
        .ai-chat-composer {
          max-width: 860px;
          margin: 0 auto;
          background: var(--bc-surface-card);
          border: 1px solid var(--bc-border-default);
          border-radius: var(--bc-radius-2xl);
          box-shadow: var(--bc-shadow-card);
          padding: var(--bc-space-3) var(--bc-space-4) var(--bc-space-2);
          transition: border-color var(--bc-transition-fast), box-shadow var(--bc-transition-fast);
        }
        .ai-chat-composer:focus-within {
          border-color: var(--bc-primary-500);
          box-shadow: var(--bc-shadow-focus);
        }
        .ai-chat-composer .ant-input { color: var(--bc-text-body); font-size: var(--bc-text-sm); }
        .ai-chat-composer .ant-input::placeholder { color: var(--bc-text-muted); }
        .ai-chat-composer-actions { display: flex; align-items: center; justify-content: space-between; margin-top: var(--bc-space-2); }
        .ai-chat-composer-left { display: flex; align-items: center; gap: var(--bc-space-3); min-width: 0; }
        .ai-db-chip {
          display: inline-flex; align-items: center; gap: 6px;
          border: 1px solid var(--bc-border-default);
          background: var(--bc-surface-page);
          color: var(--bc-text-secondary);
          border-radius: var(--bc-radius-full);
          padding: 3px 10px;
          font-size: var(--bc-text-xs);
          font-weight: var(--bc-weight-medium);
          cursor: pointer;
          transition: all var(--bc-transition-fast);
        }
        .ai-db-chip:hover { border-color: var(--bc-primary-500); color: var(--bc-primary-500); }
        .ai-db-chip.on { background: var(--bc-green-50); border-color: var(--bc-green-200); color: var(--bc-green-700); }
        body.bc-dark .ai-db-chip.on { background: rgba(34,197,94,0.14); border-color: var(--bc-green-800); color: #4ade80; }
        .ai-composer-model { color: var(--bc-text-muted); font-size: var(--bc-text-xs); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .ai-send-btn.ant-btn-primary { background: var(--bc-primary-500); box-shadow: none; }
        .ai-send-btn.ant-btn-primary:hover, .ai-send-btn.ant-btn-primary:focus { background: var(--bc-primary-600); }
        .ai-send-btn.ant-btn-primary[disabled] { background: var(--bc-slate-200); color: var(--bc-slate-500); }
        .ai-chat-composer-foot { max-width: 860px; margin: var(--bc-space-2) auto 0; text-align: center; color: var(--bc-text-muted); font-size: var(--bc-text-xs); }

        .ai-chat-empty { display: flex; flex-direction: column; align-items: center; text-align: center; padding: var(--bc-space-10) var(--bc-space-4) var(--bc-space-6); }
        .ai-chat-empty-hero { margin-bottom: var(--bc-space-6); }
        .ai-chat-empty-logo {
          width: 72px; height: 72px;
          border-radius: var(--bc-radius-3xl);
          background: linear-gradient(135deg, var(--bc-ro-500), var(--bc-primary-600));
          color: var(--bc-white);
          display: flex; align-items: center; justify-content: center;
          font-size: 36px;
          box-shadow: var(--bc-shadow-lg);
        }
        .ai-chat-empty-title { color: var(--bc-text-heading); font-size: var(--bc-text-3xl); font-weight: var(--bc-weight-bold); margin: 0 0 var(--bc-space-2); letter-spacing: var(--bc-tracking-tight); }
        .ai-chat-empty-sub { color: var(--bc-text-muted); font-size: var(--bc-text-sm); max-width: 560px; margin: 0 0 var(--bc-space-8); line-height: 1.6; }
        .ai-chat-quick-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--bc-space-3); width: 100%; max-width: 640px; }
        .ai-quick-card {
          display: flex; align-items: flex-start; gap: var(--bc-space-3);
          text-align: left;
          background: var(--bc-surface-card);
          border: 1px solid var(--bc-border-subtle);
          border-radius: var(--bc-radius-xl);
          padding: var(--bc-space-4);
          cursor: pointer;
          transition: border-color var(--bc-transition-fast), box-shadow var(--bc-transition-fast), transform var(--bc-transition-fast);
          font-family: inherit;
        }
        .ai-quick-card:hover { border-color: var(--bc-primary-500); box-shadow: var(--bc-shadow-md); transform: translateY(-1px); }
        .ai-quick-icon {
          width: 38px; height: 38px; flex-shrink: 0;
          border-radius: var(--bc-radius-lg);
          background: var(--bc-primary-50);
          color: var(--bc-primary-500);
          display: flex; align-items: center; justify-content: center;
          font-size: 17px;
        }
        body.bc-dark .ai-quick-icon { background: rgba(25,118,210,0.16); color: #90caf9; }
        .ai-quick-text { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
        .ai-quick-title { color: var(--bc-text-heading); font-size: var(--bc-text-sm); font-weight: var(--bc-weight-semibold); }
        .ai-quick-desc { color: var(--bc-text-muted); font-size: var(--bc-text-xs); line-height: 1.5; }
        .ai-chat-primary-row { display: flex; flex-wrap: wrap; gap: var(--bc-space-2); justify-content: center; max-width: 640px; margin-top: var(--bc-space-6); }
        .ai-query-chip {
          border: 1px solid var(--bc-border-default);
          background: var(--bc-surface-card);
          color: var(--bc-text-secondary);
          border-radius: var(--bc-radius-full);
          padding: 3px 12px;
          font-size: var(--bc-text-xs);
          cursor: pointer;
          transition: all var(--bc-transition-fast);
          font-weight: var(--bc-weight-medium);
        }
        .ai-query-chip:hover { border-color: var(--bc-primary-500); color: var(--bc-primary-500); }

        .ai-settings-section { border: 1px solid var(--bc-border-subtle); border-radius: var(--bc-radius-xl); padding: var(--bc-space-4); margin-bottom: var(--bc-space-4); }
        .ai-settings-head { display: flex; align-items: center; gap: 8px; color: var(--bc-text-heading); font-size: var(--bc-text-md); font-weight: var(--bc-weight-semibold); margin: 0 0 4px; }
        .ai-settings-desc, .ai-settings-note { color: var(--bc-text-muted); font-size: var(--bc-text-xs); margin: 0 0 var(--bc-space-3); }
        .ai-settings-note { margin-top: var(--bc-space-3); margin-bottom: 0; }
        .ai-settings-field { margin-bottom: var(--bc-space-3); }
        .ai-settings-field:last-child { margin-bottom: 0; }
        .ai-settings-field.row { display: flex; align-items: flex-start; justify-content: space-between; gap: var(--bc-space-4); }
        .ai-settings-field-label { display: flex; align-items: center; justify-content: space-between; gap: 8px; color: var(--bc-text-body); font-size: var(--bc-text-sm); font-weight: var(--bc-weight-medium); margin-bottom: 4px; }
        .ai-settings-hint { display: block; color: var(--bc-text-muted); font-size: var(--bc-text-xs); font-weight: var(--bc-weight-regular); margin-top: 2px; }
        .ai-settings-actions { margin-top: var(--bc-space-4); }

        .ai-chat-mobile-drawer .ant-drawer-body { padding: 0; }
        @media (max-width: 920px) {
          .ai-chat-quick-grid { grid-template-columns: 1fr; }
          .ai-chat-scroll-inner { padding: var(--bc-space-6) var(--bc-space-3) var(--bc-space-3); }
          .ai-chat-composer-wrap, .ai-chat-topbar { padding-left: var(--bc-space-3); padding-right: var(--bc-space-3); }
          .ai-msg-stack { max-width: 88%; }
        }
      `}</style>
    </div>
  );
};

export default AIChatPage;