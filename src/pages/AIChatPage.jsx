import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { Button, Input, Tooltip, Dropdown, Modal, Drawer, Slider, Switch, Select, Skeleton, Tag } from 'antd';
import {
  DatabaseOutlined,
  ConsoleSqlOutlined,
  LineChartOutlined,
  AppstoreOutlined,
} from '@ant-design/icons';
import {
  Send,
  Square,
  Copy,
  Check,
  Plus,
  Search,
  Settings,
  Database,
  History,
  Pencil,
  Trash2,
  Menu,
  Sparkles,
  Bot,
  User,
  X,
  PanelLeftClose,
  PanelLeftOpen,
  Clock,
} from 'lucide-react';

import {
  Message,
  MessageAvatar,
  MessageContent,
  MessageActions,
  MessageAction,
} from '@/components/ui/message';
import {
  ChatContainerRoot,
  ChatContainerContent,
  ChatContainerScrollAnchor,
} from '@/components/ui/chat-container';
import { ScrollButton } from '@/components/ui/scroll-button';
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputActions,
  PromptInputAction,
} from '@/components/ui/prompt-input';
import { Tool } from '@/components/ui/tool';
import { Loader } from '@/components/ui/loader';
import { PromptSuggestion } from '@/components/ui/prompt-suggestion';
import { cn } from '@/lib/utils';

import { aiChatService } from '../services/aiChatService';

dayjs.extend(relativeTime);

const FALLBACK_MODELS = [
  { id: 'free/gpt-6-luna', name: 'GPT-6 Luna', category: 'Free', context: 1000000, weight: 3, notes: 'Fast general purpose' },
  { id: 'free/glm-5.3-flash', name: 'GLM-5.3 Flash', category: 'Free', context: 1000000, weight: 3, notes: 'Balanced & fast' },
  { id: 'free/deepseek-v4.1-flash', name: 'DeepSeek V4.1 Flash', category: 'Free', context: 1000000, weight: 3, notes: 'Reasoning tuned' },
  { id: 'free/deepseek-v4-pro-0813', name: 'DeepSeek V4 Pro', category: 'Free', context: 1000000, weight: 3, notes: 'Advanced reasoning' },
  { id: 'free/mimo-v2.6-pro', name: 'Mimo V2.6 Pro', category: 'Free', context: 1000000, weight: 2, notes: 'Coding & logic' },
  { id: 'free/minimax-m3.1', name: 'MiniMax M3.1', category: 'Free', context: 1000000, weight: 2, notes: 'Creative writing' },
  { id: 'free/minimax-m3', name: 'MiniMax M3', category: 'Free', context: 1000000, weight: 2, notes: 'Creative writing' },
  { id: 'free/mimo-v2.6-flash', name: 'Mimo V2.6 Flash', category: 'Free', context: 1000000, weight: 2, notes: 'Fast & lightweight' },
  { id: 'free/claude-sonnet-4.6', name: 'Claude 4.6 Sonnet', category: 'Subscription', context: 1000000, weight: 3, notes: 'Balanced premium' },
  { id: 'free/hy4', name: 'HY 4', category: 'Subscription', context: 1000000, weight: 2, notes: 'Efficient premium' },
  { id: 'free/claude-opus-4.6', name: 'Claude 4.6 Opus', category: 'Subscription', context: 1000000, weight: 3, notes: 'Top tier reasoning' },
  { id: 'free/gemini-3.8-flash', name: 'Gemini 3.8 Flash', category: 'Subscription', context: 1000000, weight: 3, notes: 'Fast Gemini' },
  { id: 'free/muse-spark-1.3', name: 'Muse Spark 1.3', category: 'Subscription', context: 1000000, weight: 3, notes: 'Creative spark' },
  { id: 'free/gemini-3.1-pro', name: 'Gemini 3.1 Pro', category: 'Subscription', context: 1000000, weight: 2, notes: 'Premium Gemini' },
  { id: 'free/deepseek-v4-flash-0731', name: 'DeepSeek V4 Flash', category: 'Subscription', context: 1000000, weight: 3, notes: 'Fast DeepSeek' },
  { id: 'free/qwen-3.8-max', name: 'Qwen 3.8 MAX', category: 'Subscription', context: 1000000, weight: 2, notes: 'Large context' },
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

const CONTEXT_LABEL = { 1000000: '1M', 1048576: '1M', 128000: '128K', 102400: '100K', 32768: '32K', 65536: '64K' };

function useIsMobile() {
  const [mobile, setMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth <= 920);
  useEffect(() => {
    const onResize = () => setMobile(window.innerWidth <= 920);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return mobile;
}

function useAppDark() {
  const [dark, setDark] = useState(() => typeof document !== 'undefined' && document.body.classList.contains('bc-dark'));
  useEffect(() => {
    if (typeof MutationObserver === 'undefined') return undefined;
    const obs = new MutationObserver(() => setDark(document.body.classList.contains('bc-dark')));
    obs.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);
  return dark;
}

const formatTokens = (n) => {
  if (n == null || Number.isNaN(Number(n))) return null;
  const v = Number(n);
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
  return String(v);
};

const normalizeModels = (raw) => {
  if (!Array.isArray(raw) || raw.length === 0) return FALLBACK_MODELS;
  const toCategory = (m) => {
    if (m.category && typeof m.category === 'string') {
      return m.category.toLowerCase() === 'subscription' ? 'Subscription' : 'Free';
    }
    return m.subscription === true ? 'Subscription' : 'Free';
  };
  return raw
    .map((m) => ({
      id: m.id || m.ModelId || m.model || '',
      name: m.name || m.displayName || m.id || m.model || '',
      category: toCategory(m),
      context: m.context || m.contextWindow || m.contextLength || null,
      weight: m.weight || m.tokenWeight || m.tokensPerDollarMultiplier || null,
      notes: m.notes || m.description || '',
    }))
    .filter((m) => m.id && m.name);
};

const toToolPart = (tool) => {
  if (!tool) return null;
  return {
    type: 'database_query',
    state: tool.error ? 'output-error' : 'output-available',
    input: { sql: tool.sql },
    output: tool.error ? undefined : { rowCount: tool.rowCount ?? 0 },
    errorText: tool.error,
    toolCallId: 'db-query',
  };
};

const MessagesSkeleton = () => (
  <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 py-8">
    <div className="flex justify-end">
      <div className="w-56 space-y-2">
        <div className="h-3 w-40 animate-pulse rounded bg-muted" />
        <div className="h-3 w-56 animate-pulse rounded bg-muted/70" />
      </div>
    </div>
    <div className="flex gap-3">
      <div className="h-8 w-8 shrink-0 animate-pulse rounded-full bg-muted" />
      <div className="w-full max-w-xl space-y-2">
        <div className="h-3 w-24 animate-pulse rounded bg-muted/70" />
        <div className="h-3 w-full animate-pulse rounded bg-muted" />
        <div className="h-3 w-11/12 animate-pulse rounded bg-muted/70" />
        <div className="h-3 w-4/5 animate-pulse rounded bg-muted/70" />
      </div>
    </div>
  </div>
);

const AIChatPage = () => {
  const isMobile = useIsMobile();
  const isDark = useAppDark();

  const [models, setModels] = useState(FALLBACK_MODELS);
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

  const composerRef = useRef(null);

  const activeModel = useMemo(() => models.find((m) => m.id === selectedModel) || models[0], [models, selectedModel]);
  const modelOptions = useMemo(() => {
    const items = (m) => ({
      key: `model:${m.id}`,
      label: (
        <div className="flex w-72 items-center justify-between gap-3 py-0.5">
          <span className="min-w-0 truncate text-sm font-medium">{m.name}</span>
          <span className="flex shrink-0 items-center gap-1">
            {m.context ? <Tag className="ai-tag">{CONTEXT_LABEL[m.context] || '—'}</Tag> : null}
            {m.weight ? <Tag className="ai-tag">{'×' + m.weight}</Tag> : null}
          </span>
          {m.id === selectedModel ? <Check className="h-3.5 w-3.5 text-primary" /> : null}
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

  const loadModels = useCallback(async () => {
    try {
      const res = await aiChatService.getModels();
      const rawAll =
        (Array.isArray(res.data?.all) && res.data.all.length ? res.data.all : null) ||
        (Array.isArray(res.all) && res.all.length ? res.all : null) ||
        (Array.isArray(res) && res.length ? res : null) ||
        (Array.isArray(res.data?.free) || Array.isArray(res.data?.subscription)
          ? [...(res.data.free || []), ...(res.data.subscription || [])]
          : null) ||
        null;
      const list = normalizeModels(rawAll);
      if (list.length) {
        setModels(list);
        setSelectedModel((prev) => (list.some((m) => m.id === prev) ? prev : list[0].id));
      }
    } catch (err) {
      setTopError(`Could not load models: ${err.message || 'unknown error'}`);
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
      const conv = res.data?.Id ? res.data : res.conversation || res.data?.conversation || null;
      const list = res.data?.messages || res.messages || res.data || res.message;
      setCurrentConversation((prev) => (prev && prev.Id === id ? prev : conv));
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
      try {
        setTopError('');
        if (!conv?.Id) {
          const created = await aiChatService.createConversation('New Conversation');
          conv = created?.data || created?.conversation || created;
          setCurrentConversation(conv);
          loadConversations();
        }

        const userMsgId = `u-${Date.now()}`;
        mid = `a-${Date.now()}`;
        const payload = {
          message: text,
          conversationId: conv.Id,
          modelId: selectedModel,
          temperature: settings.temperature,
          maxTokens: settings.maxTokens,
          options: {
            model: selectedModel,
            includeDatabase: settings.includeDatabase,
            systemPrompt: settings.systemPrompt,
            allowSubscription: true,
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
          } else if (ev.type === 'tool') {
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
            setMessages((prev) =>
              prev.map((m) => (m.id === mid ? { ...m, content: acc, streaming: false, tool: m.tool || null } : m)),
            );
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

  const renderModelTrigger = (variant = 'topbar') => (
    <button
      type="button"
      onClick={() => {}}
      className={cn(
        'inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium',
        variant === 'topbar'
          ? 'border border-border bg-background text-foreground hover:bg-accent'
          : 'text-foreground hover:bg-accent w-full justify-start',
      )}
    >
      <Sparkles className="h-4 w-4 text-primary" />
      {activeModel?.name || 'Select model'}
    </button>
  );

  const renderTokenUsage = () => {
    const total = Number(usage?.monthlyTokenLimit || usage?.totalTokensLimit || 0);
    const used = Number(usage?.totalTokensUsed || 0);
    const pct = usagePct;
    const tone = pct > 95 ? 'bg-destructive' : pct > 80 ? 'bg-orange-500' : 'bg-primary';
    const label = usageLoading ? 'Loading usage…' : `${formatTokens(used) || 0} / ${formatTokens(total) || '—'} tokens`;
    return (
      <button type="button" className="w-full text-left" onClick={() => setSettingsOpen(true)}>
        <div className="mb-1 flex items-center justify-between text-xs">
          <span className="font-medium text-foreground">Token usage</span>
          <span className="text-muted-foreground">{pct}%</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <span className={cn('block h-full rounded-full', tone)} style={{ width: `${pct}%` }} />
        </div>
        <div className="mt-1 text-xs text-muted-foreground">{label}</div>
      </button>
    );
  };

  const renderSidebar = () => (
    <>
      <div className="flex items-center gap-3 px-4 pb-4 pt-5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-rose-500 to-indigo-600 text-lg text-white shadow-sm">
          <Bot className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="truncate text-base font-semibold text-foreground">RetailOps AI</div>
          <div className="text-xs text-muted-foreground">Intelligent assistant · {models.length} models</div>
        </div>
      </div>

      <div className="space-y-2 px-3 pb-3">
        <Button className="w-full justify-start gap-2" onClick={startNewConversation}>
          <Plus className="h-4 w-4" />
          New conversation
        </Button>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            prefix={null}
            placeholder="Search conversations…"
            allowClear
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <div className="flex items-center justify-between px-4 pb-2 text-xs font-medium text-muted-foreground">
        <span>Recents</span>
        <span>{conversations.length}</span>
      </div>

      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        {conversationsLoading ? (
          <div className="space-y-2 px-2">
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
                className={cn(
                  'group flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2',
                  active ? 'bg-accent text-accent-foreground' : 'text-foreground hover:bg-accent/60',
                )}
                role="button"
                tabIndex={0}
                onClick={() => selectConversation(conv)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') selectConversation(conv);
                }}
              >
                <History className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{conv.Title || 'Untitled'}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {conv.UpdatedAt ? dayjs(conv.UpdatedAt).fromNow() : ''}
                  </div>
                </div>
                <div className="hidden shrink-0 items-center gap-0.5 group-hover:flex">
                  <Tooltip title="Rename">
                    <button
                      type="button"
                      className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-background hover:text-foreground"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRename(conv);
                      }}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  </Tooltip>
                  <Tooltip title="Delete">
                    <button
                      type="button"
                      className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-background hover:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteConversation(conv);
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </Tooltip>
                </div>
              </div>
            );
          })
        ) : (
          <div className="flex flex-col items-center gap-2 py-10 text-center text-sm text-muted-foreground">
            <History className="h-5 w-5" />
            <p>{searchText ? 'No conversations match your search.' : 'No conversations yet.'}</p>
          </div>
        )}
      </div>

      <div className="border-t border-border p-3">{renderTokenUsage()}</div>
    </>
  );

  const renderEmptyState = () => (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-10">
      <div className="flex max-w-xl flex-col items-center text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-rose-500 to-indigo-600 text-2xl text-white shadow-md">
          <Bot className="h-7 w-7" />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">How can I help you today?</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Ask questions about your catalog, listings, pricing and inventory. RetailOps AI can query your database tables with
          {settings.includeDatabase ? ' database context enabled.' : ' database context off.'}
        </p>
      </div>

      <div className="grid w-full max-w-2xl grid-cols-1 gap-3 sm:grid-cols-2">
        {QUICK_ACTIONS.map((action) => (
          <button
            type="button"
            key={action.key}
            className="flex items-start gap-3 rounded-xl border border-border bg-background p-3.5 text-left transition-colors hover:border-primary/40 hover:bg-accent/50"
            onClick={() => applyQuickAction(action)}
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-lg text-primary">
              {action.icon}
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-foreground">{action.title}</div>
              <div className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{action.desc}</div>
            </div>
          </button>
        ))}
      </div>

      <div className="flex max-w-2xl flex-wrap items-center justify-center gap-2">
        {PRIMARY_QUERIES.map((q) => (
          <PromptSuggestion key={q} size="default" onClick={() => runPrimaryQuery(q)}>
            {q}
          </PromptSuggestion>
        ))}
      </div>
    </div>
  );

  const renderMessage = (m) => {
    const isUser = m.role === 'user';
    const isTyping = m.streaming;
    const toolPart = toToolPart(m.tool);

    if (isUser) {
      return (
        <Message key={m.id} className="justify-end px-4">
          <div className="max-w-[85%] space-y-1">
            <div className="flex items-center justify-end gap-2 pr-1 text-xs text-muted-foreground">
              {m.createdAt ? <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{dayjs(m.createdAt).format('HH:mm')}</span> : null}
            </div>
            <MessageContent className="rounded-2xl rounded-br-sm bg-primary px-3.5 py-2.5 text-primary-foreground whitespace-pre-wrap">
              {m.content}
            </MessageContent>
          </div>
          <MessageAvatar
            src=""
            alt="You"
            fallback="You"
            className="bg-muted text-muted-foreground"
          />
        </Message>
      );
    }

    return (
      <Message key={m.id} className="px-4">
        <MessageAvatar src="" alt="RetailOps AI" fallback="AI" className="bg-primary text-primary-foreground" />
        <div className="max-w-[85%] min-w-[240px] space-y-1.5">
          <div className="flex flex-wrap items-center gap-2 pl-1 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">RetailOps AI</span>
            {m.model ? <span className="rounded-full bg-muted px-2 py-0.5">{m.model}</span> : null}
            {m.tokensUsed ? <span>{formatTokens(m.tokensUsed)} tokens</span> : null}
            {m.createdAt ? <span>{dayjs(m.createdAt).format('HH:mm')}</span> : null}
          </div>

          {toolPart ? <Tool toolPart={toolPart} /> : null}

          {m.streaming && !m.content ? (
            <div className="rounded-2xl rounded-bl-sm border border-border bg-secondary px-4 py-3">
              <Loader variant="typing" size="md" />
            </div>
          ) : (
            <MessageContent
              markdown
              id={m.id}
              className="max-w-none rounded-2xl rounded-bl-sm border border-border bg-secondary px-4 py-3 text-foreground"
            >
              {m.content || ' '}
            </MessageContent>
          )}

          {m.streaming && m.content ? (
            <div className="pl-1">
              <Loader variant="dots" size="sm" />
            </div>
          ) : null}

          {!isTyping ? (
            <MessageActions className="pl-1">
              {m.error ? (
                <span className="text-xs text-destructive">Failed — see message</span>
              ) : null}
              <MessageAction tooltip="Copy response">
                <button
                  type="button"
                  className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  onClick={() => handleCopy(m.id, m.content)}
                >
                  {copiedId === m.id ? <Check className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
              </MessageAction>
            </MessageActions>
          ) : null}
        </div>
      </Message>
    );
  };

  const renderComposer = () => (
    <div className="border-t border-border bg-background/80 px-4 py-3">
      {isStreaming ? (
        <div className="mx-auto mb-2 flex w-full max-w-3xl items-center gap-2 text-xs text-muted-foreground">
          <Loader variant="dots" size="sm" />
          <span>RetailOps AI is responding…</span>
        </div>
      ) : null}
      <PromptInput
        ref={composerRef}
        disabled={isStreaming}
        value={input}
        onValueChange={setInput}
        onSubmit={() => handleSend()}
        className="mx-auto w-full max-w-3xl rounded-2xl shadow-sm"
      >
        <PromptInputTextarea placeholder="Message RetailOps AI…  (Enter to send, Shift+Enter for a new line)" />
        <PromptInputActions>
          <PromptInputAction tooltip={settings.includeDatabase ? 'Database context is ON — answers are grounded in query results' : 'Database context is OFF'}>
            <button
              type="button"
              onClick={() => setSettings((s) => ({ ...s, includeDatabase: !s.includeDatabase }))}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
                settings.includeDatabase
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-accent',
              )}
            >
              <Database className="h-3.5 w-3.5" />
              Database
            </button>
          </PromptInputAction>
          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
            <Sparkles className="h-3 w-3 text-primary" />
            {activeModel?.name}
          </span>
          <div className="ml-auto flex items-center gap-1.5">
            {isStreaming ? (
              <Button size="icon" variant="ghost" aria-label="Stop" onClick={handleStop} className="h-9 w-9 rounded-full">
                <Square className="h-4 w-4" />
              </Button>
            ) : (
              <Button size="icon" aria-label="Send" disabled={!input.trim()} onClick={() => handleSend()} className="h-9 w-9 rounded-full">
                <Send className="h-4 w-4" />
              </Button>
            )}
          </div>
        </PromptInputActions>
      </PromptInput>
      <div className="mx-auto mt-2 max-w-3xl text-center text-xs text-muted-foreground">
        RetailOps AI can make mistakes. Verify important data before acting on it.
      </div>
    </div>
  );

  return (
    <div className={cn('ai-chat-page pk-root', isDark && 'dark')}>
      {topError ? (
        <div className="flex items-center gap-2 border-b border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-white">!</span>
          <span className="flex-1">{topError}</span>
          <button type="button" className="rounded p-0.5 hover:bg-destructive/10" onClick={() => setTopError('')}>
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1">
        {!isMobile && !sidebarCollapsed ? <aside className="flex w-72 shrink-0 flex-col border-r border-border bg-muted/20">{renderSidebar()}</aside> : null}

        <main className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-border px-3">
            <div className="flex min-w-0 items-center gap-2">
              {isMobile ? (
                <button type="button" className="rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground" onClick={() => setMobileOpen(true)}>
                  <Menu className="h-4 w-4" />
                </button>
              ) : (
                <Tooltip title={sidebarCollapsed ? 'Show conversations' : 'Hide conversations'}>
                  <button
                    type="button"
                    className="rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
                    onClick={() => setSidebarCollapsed((v) => !v)}
                  >
                    {sidebarCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
                  </button>
                </Tooltip>
              )}
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-foreground">{currentConversation?.Title || 'New conversation'}</div>
                <div className="truncate text-xs text-muted-foreground">
                  {messages.length > 0 ? `${messages.length} messages` : 'Start a conversation below'}
                </div>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <Dropdown menu={{ items: modelOptions, onClick: handleModelClick }} trigger={['click']} placement="bottomRight">
                {renderModelTrigger('topbar')}
              </Dropdown>
              <Tooltip title="Settings">
                <button type="button" className="rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground" onClick={() => setSettingsOpen(true)}>
                  <Settings className="h-4 w-4" />
                </button>
              </Tooltip>
            </div>
          </header>

          <div className="relative min-h-0 flex-1">
            <ChatContainerRoot className="h-full">
              <ChatContainerContent className="min-h-[200px] py-4">
                {messagesLoading ? (
                  <MessagesSkeleton />
                ) : messages.length ? (
                  messages.map(renderMessage)
                ) : (
                  renderEmptyState()
                )}
              </ChatContainerContent>
              <ChatContainerScrollAnchor />
              <div className="absolute bottom-4 right-4 z-10">
                <ScrollButton className="border-border text-muted-foreground shadow-md" />
              </div>
            </ChatContainerRoot>
          </div>

          {renderComposer()}
        </main>
      </div>

      {isMobile ? (
        <Drawer placement="left" width={316} open={mobileOpen} onClose={() => setMobileOpen(false)} closable={false} styles={{ body: { padding: 0 } }}>
          <div className="flex h-full flex-col bg-muted/20">{renderSidebar()}</div>
        </Drawer>
      ) : null}

      <Drawer title="AI settings" placement="right" width={380} open={settingsOpen} onClose={() => setSettingsOpen(false)}>
        <div className="space-y-6">
          <div className="space-y-2">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Sparkles className="h-4 w-4 text-primary" /> Model
            </h3>
            <p className="text-xs text-muted-foreground">Choose which model handles your messages.</p>
            <Dropdown menu={{ items: modelOptions, onClick: handleModelClick }} trigger={['click']}>
              {renderModelTrigger('settings')}
            </Dropdown>
            {activeModel?.notes ? <p className="text-xs text-muted-foreground">{activeModel.notes}</p> : null}
          </div>

          <div className="space-y-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Database className="h-4 w-4 text-primary" /> Response
            </h3>
            <div>
              <div className="mb-1 flex items-center justify-between">
                <span className="text-sm text-foreground">Temperature</span>
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
              <span className="text-xs text-muted-foreground">Lower = precise, higher = creative.</span>
            </div>
            <div className="space-y-1">
              <div className="text-sm text-foreground">Max output tokens</div>
              <Input
                type="number"
                min={256}
                max={8192}
                step={256}
                value={settings.maxTokens}
                onChange={(e) => setSettings((s) => ({ ...s, maxTokens: Number(e.target.value) || 2048 }))}
              />
            </div>
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm text-foreground">Stream responses</div>
                <div className="text-xs text-muted-foreground">Token-by-token answers.</div>
              </div>
              <Switch checked={settings.streaming} onChange={(v) => setSettings((s) => ({ ...s, streaming: v }))} />
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Database className="h-4 w-4 text-primary" /> Context
            </h3>
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm text-foreground">Include database</div>
                <div className="text-xs text-muted-foreground">Let the assistant run SQL over your tables and answer from query results.</div>
              </div>
              <Switch checked={settings.includeDatabase} onChange={(v) => setSettings((s) => ({ ...s, includeDatabase: v }))} />
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <User className="h-4 w-4 text-primary" /> Assistance
            </h3>
            <div className="text-sm text-foreground">System architecture</div>
            <Select
              style={{ width: '100%' }}
              value={settings.systemPrompt}
              onChange={(v) => setSettings((s) => ({ ...s, systemPrompt: v }))}
              options={SYSTEM_PROMPTS}
            />
          </div>

          <Button variant="outline" className="w-full" onClick={() => setSettings(DEFAULT_SETTINGS)}>
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
          background: var(--background);
          color: var(--foreground);
          overflow: hidden;
        }
        .ai-chat-page * {
          box-sizing: border-box;
        }
        .ai-tag { border: none; font-size: 11px; line-height: 18px; margin: 0; }
        .pk-root .prose {
          max-width: none;
        }
        .pk-root .prose :where(pre):not(:where([class~="not-prose"], [class~="not-prose"] *)) {
          margin: 0.5em 0;
        }
        .pk-root .prose :where(table):not(:where([class~="not-prose"], [class~="not-prose"] *)) {
          display: block;
          overflow-x: auto;
          font-size: 0.8125rem;
        }
        .scroll-thin::-webkit-scrollbar { width: 6px; }
        .scroll-thin::-webkit-scrollbar-thumb { background: var(--border); border-radius: 6px; }
        .scroll-thin::-webkit-scrollbar-track { background: transparent; }
      `}</style>
    </div>
  );
};

export default AIChatPage;