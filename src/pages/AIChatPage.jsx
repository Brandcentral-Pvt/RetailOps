import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Layout,
  Menu,
  Input,
  Button,
  Select,
  Card,
  Avatar,
  ScrollArea,
  Textarea,
  Dropdown,
  Tooltip,
  Badge,
  Spin,
  Empty,
  Divider,
  Space,
  Switch,
  Popover,
  Tabs,
  List,
  Modal,
  Form,
  InputNumber,
  Collapse,
  Alert,
} from 'antd';
import {
  SendOutlined,
  PlusOutlined,
  DeleteOutlined,
  EditOutlined,
  SearchOutlined,
  RobotOutlined,
  DatabaseOutlined,
  TerminalOutlined,
  CopyOutlined,
  ReloadOutlined,
  SettingOutlined,
  HistoryOutlined,
  TrashOutlined,
  StarOutlined,
  MenuOutlined,
  XOutlined,
  UploadOutlined,
  DownloadOutlined,
  CodeOutlined,
  TableOutlined,
  BarChartOutlined,
  PieChartOutlined,
  LineChartOutlined,
  AreaChartOutlined,
  DashboardOutlined,
  InfoCircleOutlined,
  ExclamationCircleOutlined,
  CheckCircleOutlined,
  CloseOutlined,
  LeftOutlined,
  RightOutlined,
  EyeOutlined,
  PlayCircleOutlined,
  PauseCircleOutlined,
  StopOutlined,
  UserOutlined,
  FileOutlined,
} from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { apinexService } from '../../services/apiClient';

const { Header, Content, Sider, Footer } = Layout;
const { SubMenu } = Menu;
const { Option } = Select;
const { TextArea } = Input;
const { Meta } = Card;
const { TabPane } = Tabs;
const { Item } = List;
const { Title, Text, Paragraph } = Typography;
const { Panel } = Collapse;

const MODEL_CATEGORIES = {
  free: {
    label: 'Free Models',
    icon: <StarOutlined style={{ color: '#f59e0b' }} />,
    models: [
      { id: 'free/gpt-6-luna', name: 'GPT-6 Luna', weight: 3, context: '1M' },
      { id: 'free/glm-5.3-flash', name: 'GLM-5.3 Flash', weight: 3, context: '1M' },
      { id: 'free/deepseek-v4.1-flash', name: 'DeepSeek V4.1 Flash', weight: 3, context: '1M' },
      { id: 'free/deepseek-v4-pro-0813', name: 'DeepSeek V4 Pro', weight: 3, context: '1M' },
      { id: 'free/mimo-v2.6-pro', name: 'Mimo V2.6 Pro', weight: 2, context: '1M' },
      { id: 'free/minimax-m3.1', name: 'MiniMax M3.1', weight: 2, context: '1M' },
      { id: 'free/minimax-m3', name: 'MiniMax M3', weight: 2, context: '1M' },
      { id: 'free/mimo-v2.6-flash', name: 'Mimo V2.6 Flash', weight: 2, context: '1M' },
    ],
  },
  subscription: {
    label: 'Subscription Models',
    icon: <StarOutlined style={{ color: '#8b5cf6' }} />,
    models: [
      { id: 'free/claude-sonnet-4.6', name: 'Claude 4.6 Sonnet', weight: 3, context: '1M', sub: true },
      { id: 'free/hy4', name: 'HY 4', weight: 2, context: '1M', sub: true },
      { id: 'free/claude-opus-4.6', name: 'Claude 4.6 Opus', weight: 3, sub: true },
      { id: 'free/gemini-3.8-flash', name: 'Gemini 3.8 Flash', weight: 3, sub: true },
      { id: 'free/muse-spark-1.3', name: 'Muse Spark 1.3', weight: 3, sub: true },
      { id: 'free/gemini-3.1-pro', name: 'Gemini 3.1 Pro', weight: 2, sub: true },
      { id: 'free/deepseek-v4-flash-0731', name: 'DeepSeek V4 Flash', weight: 3, sub: true },
      { id: 'free/qwen-3.8-max', name: 'Qwen 3.8 MAX', weight: 2, sub: true },
    ],
  },
};

const SYSTEM_PROMPT_TEMPLATES = {
  default: 'You are RetailOps AI Assistant - an expert business analyst for e-commerce operations. You help users analyze their data, answer questions, and provide actionable insights.',
  sql_expert: 'You are an expert SQL analyst. Convert natural language questions into valid, optimized SQL queries. Return ONLY the SQL query with brief explanation.',
  data_analyst: 'You are a senior data analyst. Analyze the provided data and answer the user\'s question with actionable insights, visualizations, and recommendations.',
  code_assistant: 'You are an expert code assistant. Help write, debug, and optimize code.',
};

const QUICK_ACTIONS = [
  { label: 'Analyze Sales', icon: <BarChartOutlined />, prompt: 'Analyze my sales performance for the last 30 days', category: 'analysis' },
  { label: 'Top Products', icon: <BarChartOutlined />, prompt: 'Show me top 10 products by revenue', category: 'query' },
  { label: 'Inventory Health', icon: <DatabaseOutlined />, prompt: 'Check inventory health and low stock alerts', category: 'query' },
  { label: 'Ad Performance', icon: <AreaChartOutlined />, prompt: 'Analyze advertising ROAS and ACOS trends', category: 'analysis' },
  { label: 'Write SQL', icon: <TerminalOutlined />, prompt: 'Write SQL for: ', category: 'sql', fill: true },
  { label: 'Generate Report', icon: <FileOutlined />, prompt: 'Generate a weekly performance report', category: 'analysis' },
];

const SIDEBAR_WIDTH = 280;
const CHAT_WIDTH = 'calc(100% - 280px)';

export default function AIChatPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  // State
  const [collapsed, setCollapsed] = useState(false);
  const [currentConversation, setCurrentConversation] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [selectedModel, setSelectedModel] = useState('free/gpt-6-luna');
  const [systemPrompt, setSystemPrompt] = useState(SYSTEM_PROMPT_TEMPLATES.default);
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(4096);
  const [streaming, setStreaming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showModelSelector, setShowModelSelector] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [systemPromptMode, setSystemPromptMode] = useState('default');
  const [includeDatabase, setIncludeDatabase] = useState(true);
  const [showModelSelectorPanel, setShowModelSelectorPanel] = useState(false);
  const [searchConversations, setSearchConversations] = useState('');
  
  // Refs
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);
  const conversationListRef = useRef(null);
  
  // Models from API
  const [models, setModels] = useState({ free: [], subscription: [] });
  const [availableTokens, setAvailableTokens] = useState(1000000);
  const [tokenUsage, setTokenUsage] = useState({ totalTokens: 0, byModel: {} });

  // Fetch models and stats on mount
  useEffect(() => {
    loadModels();
    loadUsage();
    loadConversations();
  }, []);

  const loadModels = async () => {
    try {
      const res = await fetch('/api/ai/models', { credentials: 'include' });
      const data = await res.json();
      if (data.success) {
        setModels({ free: data.data.free, subscription: data.data.subscription });
      }
    } catch (err) {
      console.error('Failed to load models:', err);
    }
  };

  const loadUsage = async () => {
    try {
      const res = await fetch('/api/ai/usage', { credentials: 'include' });
      const data = await res.json();
      if (data.success) {
        setTokenUsage(data.data);
        setAvailableTokens(data.data.availableTokens || 1000000);
      }
    } catch (err) {
      console.error('Failed to load usage:', err);
    }
  };

  const loadConversations = async () => {
    try {
      const res = await fetch('/api/ai/chat/conversations?limit=50', { credentials: 'include' });
      const data = await res.json();
      if (data.success) {
        setConversations(data.data.conversations || []);
      }
    } catch (err) {
      console.error('Failed to load conversations:', err);
    }
  };

  const loadConversation = async (conversationId) => {
    try {
      const res = await fetch(`/api/ai/chat/conversations/${conversationId}?limit=100`, { credentials: 'include' });
      const data = await res.json();
      if (data.success) {
        setCurrentConversation(data.data);
        setMessages(data.data.messages || []);
        scrollToBottom();
      }
    } catch (err) {
      console.error('Failed to load conversation:', err);
    }
  };

  const createConversation = async () => {
    try {
      const res = await fetch('/api/ai/chat/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ title: 'New Conversation' }),
      });
      const data = await res.json();
      if (data.success) {
        await loadConversations();
        setCurrentConversation(data.data);
        setMessages([]);
      }
    } catch (err) {
      console.error('Failed to create conversation:', err);
    }
  };

  const deleteConversation = async (id) => {
    if (!window.confirm('Delete this conversation?')) return;
    try {
      await fetch(`/api/ai/chat/conversations/${id}`, { method: 'DELETE', credentials: 'include' });
      await loadConversations();
      if (currentConversation?.id === id) {
        setCurrentConversation(null);
        setMessages([]);
      }
    } catch (err) {
      console.error('Failed to delete conversation:', err);
    }
  };

  const sendMessage = useCallback(async (content) => {
    if (!content.trim() || !currentConversation) return;
    
    const userMessage = { role: 'user', content, timestamp: Date.now() };
    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    
    try {
      const res = await fetch(`/api/ai/chat/conversations/${currentConversation.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          message: content,
          modelId: selectedModel,
          temperature,
          maxTokens,
          options: { includeDatabase },
        }),
      });
      
      const data = await res.json();
      if (data.success) {
        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: data.data.content, 
          timestamp: Date.now(),
          model: data.data.model,
          usage: data.data.usage,
        }]);
      }
    } catch (err) {
      console.error('Failed to send message:', err);
    }
  }, [currentConversation, selectedModel, temperature, maxTokens, includeDatabase]);

  const handleStreamMessage = useCallback(async (content) => {
    if (!content.trim() || !currentConversation) return;
    
    const userMessage = { role: 'user', content, timestamp: Date.now() };
    setMessages(prev => [...prev, userMessage]);
    const handleStreamMessage = useCallback(async (content) => {
    if (!content.trim() || !currentConversation) return;
    
    const userMessage = { role: 'user', content, timestamp: Date.now() };
    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    
    try {
      const res = await fetch(`/api/ai/chat/conversations/${currentConversation.id}/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          message: content,
          modelId: selectedModel,
          temperature,
          maxTokens,
          options: { includeDatabase },
        }),
      });
      
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      
      setMessages(prev => [...prev, { role: 'assistant', content: '', timestamp: Date.now(), streaming: true }]);
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = new TextDecoder().decode(value);
        const lines = chunk.split('\n\n').filter(l => l.startsWith('data:'));
        
        for (const line of lines) {
          try {
            const data = JSON.parse(line.replace('data: ', ''));
            if (data.type === 'chunk') {
              setMessages(prev => {
                const next = [...prev];
                const last = next[next.length - 1];
                if (last && last.role === 'assistant') {
                  next[next.length - 1] = { ...last, content: last.content + data.content };
                }
                return next;
              });
            } else if (data.type === 'complete') {
              // Message complete
            } else if (data.type === 'error') {
              console.error('Stream error:', data.error);
            }
          } catch (e) {
            console.error('Parse error:', e);
          }
        }
      }
    } catch (err) {
      console.error('Stream error:', err);
    }
  }, [currentConversation, selectedModel, temperature, maxTokens, includeDatabase]);

  const handleSend = (e) => {
    e.preventDefault();
    if (inputValue.trim()) {
      if (streaming) {
        handleStreamMessage(inputValue);
      } else {
        sendMessage(inputValue);
      }
    }
  };

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, streaming]);

  // Load conversations on mount
  useEffect(() => {
    loadConversations();
  }, []);

  // Scroll to bottom when messages change
  useEffect(() => {
    setTimeout(scrollToBottom, 100);
  }, [messages]);

  const handleModelChange = (modelId) => {
    setSelectedModel(modelId);
    setShowModelSelector(false);
  };

  const handleNewChat = () => {
    createConversation();
  };

  const filteredConversations = useMemo(() => {
    if (!searchConversations) return conversations;
    return conversations.filter(c => 
      c.title?.toLowerCase().includes(searchConversations.toLowerCase()) ||
      c.InstanceCode?.toLowerCase().includes(searchConversations.toLowerCase())
    );
  }, [conversations, searchConversations]);

  // Render model option
const renderModelOption = (model) => (
    <div key={model.id} style={{ 
      display: 'flex', 
      alignItems: 'center', 
      gap: 8, 
      padding: '8px 12px',
      borderRadius: 8,
      cursor: 'pointer',
      transition: 'background 0.2s',
      background: selectedModel === model.id ? 'var(--bc-blue-50)' : 'transparent',
    }} onClick={() => handleModelChange(model.id)}>
      <span style={{ fontWeight: 500 }}>{model.name}</span>
      <span style={{ fontSize: 11, color: 'var(--bc-text-muted)' }}>
        {model.context} · {model.weight}×
      </span>
      {model.sub && <Badge style={{ marginLeft: 8, fontSize: 9 }}>Sub</Badge>}
      {selectedModel === model.id && <CheckCircleOutlined style={{ color: 'var(--bc-blue-600)', marginLeft: 'auto' }} />}
    </div>
  );

  const sidebarStyle = {
    width: collapsed ? 64 : SIDEBAR_WIDTH,
    height: '100vh',
    background: 'var(--bc-surface-card)',
    borderRight: '1px solid var(--bc-border-default)',
    display: 'flex',
    flexDirection: 'column',
    transition: 'width 0.3s',
    overflow: 'hidden',
    position: 'sticky',
    top: 0,
    zIndex: 100,
  };

  const renderSidebar = () => (
    <div style={sidebarStyle}>
      {/* Header */}
      <div style={{ padding: '16px', borderBottom: '1px solid var(--bc-border-default)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {!collapsed && (
          <Space>
            <RobotOutlined style={{ fontSize: 20, color: 'var(--bc-blue-600)' }} />
            <Text strong style={{ fontSize: 16 }}>RetailOps AI</Text>
          </Space>
        )}
        <Button
          type="text"
          icon={collapsed ? <RightOutlined /> : <LeftOutlined />}
          onClick={() => setCollapsed(!collapsed)}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        />
      </div>

      {/* New Chat Button */}
      {!collapsed && (
        <div style={{ padding: '12px 16px' }}>
          <Button
            block
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleNewChat}
            style={{ fontWeight: 600 }}
          >
            New Chat
          </Button>
        </div>
      )}

      {/* Search */}
      {!collapsed && (
        <div style={{ padding: '0 16px 16px' }}>
          <Input.Search
            placeholder="Search conversations..."
            value={searchConversations}
            onChange={e => setSearchConversations(e.target.value)}
            allowClear
            style={{ width: '100%' }}
          />
        </div>
      )}

      {/* Conversations List */}
      <div style={{ flex: 1, overflow: 'auto', padding: collapsed ? '8px' : '0 16px' }}>
        {filteredConversations.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="No conversations yet"
            imageStyle={{ height: 40 }}
            style={{ textAlign: 'center', padding: '20px' }}
          >
            <Button type="primary" onClick={handleNewChat} size="small">
              <PlusOutlined /> Start New Chat
            </Button>
          </Empty>
        ) : (
          <List
            dataSource={filteredConversations}
            renderItem={(conv) => (
              <Item
                key={conv.id}
                actions={[
                  <Button type="text" icon={<EditOutlined />} size="small" onClick={() => { /* edit title */ }} />,
                  <Button type="text" icon={<TrashOutlined />} danger size="small" onClick={() => deleteConversation(conv.id)} />,
                ]}
                extra={
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    {dayjs(conv.UpdatedAt).fromNow()}
                  </Text>
                }
              >
                <List.Item.Meta
                  title={
                    <Text strong style={{ fontSize: 13, display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {conv.title || 'Untitled'}
                    </Text>
                  }
                  description={
                    <Text style={{ fontSize: 11, color: 'var(--bc-text-muted)' }}>
                      {conv.InstanceCode || conv.Status} • {dayjs(conv.UpdatedAt).fromNow()}
                    </Text>
                  }
                />
              </Item>
            )}
          </List>
        )}
      </div>

      {/* Token Usage */}
      {!collapsed && (
        <div style={{ padding: '16px', borderTop: '1px solid var(--bc-border-default)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <Text strong>Daily Token Usage</Text>
            <Badge count={Math.round((1000000 - availableTokens) / 1000000 * 100)} color="blue" />
          </div>
          <div style={{ height: 6, background: 'var(--bc-border-default)', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ 
              width: `${Math.max(0, (1000000 - availableTokens) / 1000000 * 100)}%`, 
              height: '100%', 
              background: 'linear-gradient(90deg, #10b981, #f59e0b, #ef4444)',
              borderRadius: 3,
              transition: 'width 0.3s',
            }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 11, color: 'var(--bc-text-muted)' }}>
            <span>{((1000000 - availableTokens) / 1000000 * 100).toFixed(1)}% used</span>
            <span>{Math.floor(availableTokens / 1000)}K remaining</span>
          </div>
        </div>
      )}
    </div>
  );

  const renderChatArea = () => (
    <Content style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bc-surface-canvas)' }}>
      {/* Header */}
      <div style={{ 
        padding: '16px 24px', 
        borderBottom: '1px solid var(--bc-border-default)',
        background: 'var(--bc-surface-card)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
          <Text strong style={{ fontSize: 18, color: 'var(--bc-text-heading)' }}>
            {currentConversation?.title || 'Select a conversation'}
          </Text>
          {currentConversation?.InstanceCode && (
            <Badge style={{ fontSize: 11 }}>{currentConversation.InstanceCode}</Badge>
          )}
          {currentConversation?.Status && (
            <Tag color={WORKFLOW_STATUSES[currentConversation.Status]?.color || 'default'}>
              {WORKFLOW_STATUSES[currentConversation.Status]?.label || currentConversation.Status}
            </Tag>
          )}
        </div>
        
        <Space size={8}>
          {/* Model Selector */}
          <Dropdown
            trigger={['click']}
            overlay={
              <Menu style={{ width: 320 }}>
                <SubMenu key="free" title={<Space><StarOutlined style={{color:'#f59e0b'}/> Free Models</Space>}>
                  {MODEL_CATEGORIES.free.models.map(m => (
                    <Menu.Item key={m.id} onClick={() => handleModelChange(m.id)} selected={selectedModel === m.id}>
                      <Space>
                        <Text strong>{m.name}</Text>
                        <Text type="secondary" style={{fontSize:11}}>{m.context} • {m.weight}×</Text>
                        {selectedModel === m.id && <CheckCircleOutlined style={{color:'var(--bc-blue-600)'}}/>}
                      </Space>
                    </Menu.Item>
                  ))}
                </SubMenu>
                <SubMenu key="subscription" title={<Space><StarOutlined style={{color:'#8b5cf6'}}/><Text style={{color:'#8b5cf6'}}>Subscription Models</Text></Space>}>
                  {MODEL_CATEGORIES.subscription.models.map(m => (
                    <Menu.Item key={m.id} onClick={() => handleModelChange(m.id)} selected={selectedModel === m.id}>
                      <Space>
                        <Text strong>{m.name}</Text>
                        <Text type="secondary" style={{fontSize:11}}>{m.context} • {m.weight}×</Text>
                        <Badge style={{marginLeft:8, fontSize:9}}>Sub</Badge>
                        {selectedModel === m.id && <CheckCircleOutlined style={{color:'var(--bc-blue-600)'}}/>}
                      </Space>
                    </Menu.Item>
                  ))}
                </SubMenu>
              </Menu>
            >
            <Button style={{ minWidth: 160 }} icon={<RobotOutlined />}>
              {MODEL_CATEGORIES.free.models.find(m => m.id === selectedModel)?.name || 
               MODEL_CATEGORIES.subscription.models.find(m => m.id === selectedModel)?.name || 
               'Select Model'}
            </Button>
          </Dropdown>

          {/* Settings */}
          <Dropdown
            trigger={['click']}
            overlay={
              <Menu style={{ width: 280 }}>
                <Menu.Item key="settings" icon={<SettingOutlined />} onClick={() => setShowSettings(!showSettings)}>
                  <Space><SettingOutlined /> Settings</Space>
                </Menu.Item>
                <Menu.Item key="history" icon={<HistoryOutlined />} onClick={() => setShowHistory(!showHistory)}>
                  <Space><HistoryOutlined /> History</Space>
                </Menu.Item>
                <Menu.Item key="clear" icon={<DeleteOutlined />} danger onClick={() => { if(confirm('Clear chat?')) setMessages([]); }}>
                  <Space><DeleteOutlined /> Clear Chat</Space>
                </Menu.Item>
              </Menu>
            >
              <Button icon={<SettingOutlined />} />
            </Dropdown>
        </Space>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflow: 'auto', padding: '24px', display: 'flex', flexDirection: 'column' }}>
        {messages.length === 0 ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24, color: 'var(--bc-text-muted)' }}>
            <RobotOutlined style={{ fontSize: 64, color: 'var(--bc-blue-200)' }} />
            <Text strong style={{ fontSize: 20 }}>Welcome to RetailOps AI</Text>
            <Text style={{ color: 'var(--bc-text-muted)' }}>Ask me anything about your business data</Text>
            
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginTop: 16 }}>
              {QUICK_ACTIONS.map((action, i) => (
                <Button
                  key={i}
                  type="text"
                  icon={action.icon}
                  onClick={() => {
                    const prompt = action.fill ? action.prompt : action.prompt + ' ' + (currentConversation?.InstanceCode || '');
                    handleSend(action.fill ? '' : prompt);
                    if (action.fill) setInputValue(prompt);
                  }}
                  style={{ fontSize: 13 }}
                >
                  {action.label}
                </Button>
              ))}
            </div>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {messages.map((msg, i) => (
                <div key={i} style={{ 
                  display: 'flex', 
                  gap: 12, 
                  alignItems: 'flex-start',
                  maxWidth: '85%',
                  marginLeft: msg.role === 'user' ? 'auto' : 0,
                  marginRight: msg.role === 'user' ? 0 : 'auto',
                }}>
                  <Avatar 
                    size={32} 
                    icon={msg.role === 'user' ? <UserOutlined /> : <RobotOutlined />}
                    style={{ 
                      background: msg.role === 'user' ? 'var(--bc-blue-600)' : 'var(--bc-blue-100)',
                      color: msg.role === 'user' ? '#fff' : 'var(--bc-blue-600)',
                      flexShrink: 0,
                      marginTop: 4,
                    }}
                  />
                  <div style={{ maxWidth: '100%', minWidth: 100 }}>
                    <div style={{ 
                      padding: '10px 14px', 
                      borderRadius: 12,
                      background: msg.role === 'user' ? 'var(--bc-blue-600)' : 'var(--bc-surface-card)',
                      border: '1px solid var(--bc-border-default)',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                    }}>
                      <div style={{ 
                        color: msg.role === 'user' ? '#fff' : 'var(--bc-text-body)',
                        lineHeight: 1.6,
                        whiteSpace: 'pre-wrap',
                        fontSize: 14,
                      }}>
                        {msg.content}
                      </div>
                      {msg.usage && (
                        <div style={{ marginTop: 8, display: 'flex', gap: 12, fontSize: 10, color: 'var(--bc-text-muted)' }}>
                          <span>Tokens: {msg.usage.total_tokens || msg.usage.totalTokens || 'N/A'}</span>
                          {msg.model && <span>{msg.model}</span>}
                        </div>
                      )}
                    </div>
                    {msg.streaming && <Spin size="small" />}
                  </div>
                ))}
            </>
          )}
        </div>
      </div>

      {/* Input Area */}
      <div style={{ 
        padding: '16px 24px', 
        borderTop: '1px solid var(--bc-border-default)',
        background: 'var(--bc-surface-card)',
      }}>
        <Form onFinish={handleSend} layout="inline">
          <Space style={{ width: '100%', alignItems: 'flex-end' }} size="middle">
            <TextArea
              ref={textareaRef}
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              onPressEnter={e => { if (!e.shiftKey) { e.preventDefault(); handleSend(inputValue); }}}
              placeholder="Ask me anything about your data... (Shift+Enter for new line)"
              rows={1}
              autoSize={{ minRows: 1, maxRows: 6 }}
              style={{ flex: 1, minWidth: 0 }}
            />
            <Space size={8}>
              <Tooltip title="Include database context">
                <Switch checked={includeDatabase} onChange={setIncludeDatabase} size="small" />
              </Tooltip>
              <Tooltip title="Temperature">
                <InputNumber
                  min={0} max={2} step={0.1} style={{ width: 80 }}
                  value={temperature} onChange={setTemperature}
                />
              </Tooltip>
              <Tooltip title="Max Tokens">
                <InputNumber
                  min={256} max={32768} step={256} style={{ width: 100 }}
                  value={maxTokens} onChange={setMaxTokens}
                />
              </Tooltip>
              <Button
                type="primary"
                size="large"
                icon={streaming ? <LoadingOutlined /> : <SendOutlined />}
                loading={streaming || loading}
                onClick={() => handleSend(inputValue)}
                disabled={!inputValue.trim() || streaming || loading}
                style={{ height: 42 }}
              >
                {streaming ? 'Streaming...' : 'Send'}
              </Button>
            </Space>
          </Space>
        </Form>
      </div>
    </Content>
  );

  return (
    <Layout style={{ minHeight: '100vh' }}>
      {sidebarOpen && <Sider collapsible collapsed={collapsed} trigger={null} style={{ width: SIDEBAR_WIDTH }}>{renderSidebar()}</Sider>}
      {renderChatArea()}
    </Layout>
  );
}
