import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Layout,
  Menu,
  Input,
  Button,
  Select,
  Card,
  Avatar,
  Dropdown,
  Tooltip,
  Badge,
  Spin,
  Empty,
  Space,
  Switch,
  Tabs,
  List,
  Modal,
  Form,
  InputNumber,
  Collapse,
  Tag,
  Typography,
} from 'antd';
import {
  SendOutlined,
  PlusOutlined,
  DeleteOutlined,
  EditOutlined,
  RobotOutlined,
  DatabaseOutlined,
  ConsoleSqlOutlined,
  SettingOutlined,
  HistoryOutlined,
  StarOutlined,
  BarChartOutlined,
  AreaChartOutlined,
  CheckCircleOutlined,
  LeftOutlined,
  RightOutlined,
  UserOutlined,
  FileOutlined,
  LoadingOutlined,
} from '@ant-design/icons';
const { Title } = Typography;
import { useNavigate, useLocation } from 'react-router-dom';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { useAuth } from '../contexts/AuthContext';

dayjs.extend(relativeTime);

const { Content, Sider } = Layout;
const { SubMenu } = Menu;
const { TextArea } = Input;
const { Text } = Typography;

const WORKFLOW_STATUSES = {
  active: { label: 'Active', color: 'green' },
  pending: { label: 'Pending', color: 'gold' },
  completed: { label: 'Completed', color: 'blue' },
  failed: { label: 'Failed', color: 'red' },
};

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
  { label: 'Write SQL', icon: <ConsoleSqlOutlined />, prompt: 'Write SQL for: ', category: 'sql', fill: true },
  { label: 'Generate Report', icon: <FileOutlined />, prompt: 'Generate a weekly performance report', category: 'analysis' },
];

const SIDEBAR_WIDTH = 280;

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
  const [showSettings, setShowSettings] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [includeDatabase, setIncludeDatabase] = useState(true);
  const [searchConversations, setSearchConversations] = useState('');
  
  // Refs
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);
  
  // Token Stats
  const [availableTokens, setAvailableTokens] = useState(1000000);
  const [models, setModels] = useState({ free: [], subscription: [] });

  // Calculate Token Usage Stats Safely
  const TOTAL_TOKENS = 1000000;
  const usedTokens = Math.max(0, TOTAL_TOKENS - (availableTokens || 0));
  const usedPercentage = Math.min(100, Math.max(0, (usedTokens / TOTAL_TOKENS) * 100));

  const getUsageColor = (pct) => {
    if (pct >= 85) return '#ef4444'; // Red
    if (pct >= 65) return '#f59e0b'; // Amber
    return '#10b981'; // Green
  };

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
    setLoading(true);
    
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
    } finally {
      setLoading(false);
    }
  }, [currentConversation, selectedModel, temperature, maxTokens, includeDatabase]);

  const handleStreamMessage = useCallback(async (content) => {
    if (!content.trim() || !currentConversation) return;
    
    const userMessage = { role: 'user', content, timestamp: Date.now() };
    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setStreaming(true);
    
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
            }
          } catch (e) {
            console.error('Parse error:', e);
          }
        }
      }
    } catch (err) {
      console.error('Stream error:', err);
    } finally {
      setStreaming(false);
      setMessages(prev => {
        const next = [...prev];
        const last = next[next.length - 1];
        if (last) last.streaming = false;
        return next;
      });
    }
  }, [currentConversation, selectedModel, temperature, maxTokens, includeDatabase]);

  const handleSend = (text) => {
    const messageToSend = text || inputValue;
    if (messageToSend.trim()) {
      if (streaming) {
        handleStreamMessage(messageToSend);
      } else {
        sendMessage(messageToSend);
      }
    }
  };

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, streaming]);

  const handleModelChange = (modelId) => {
    setSelectedModel(modelId);
  };

  const filteredConversations = useMemo(() => {
    if (!searchConversations) return conversations;
    return conversations.filter(c => 
      c.title?.toLowerCase().includes(searchConversations.toLowerCase()) ||
      c.InstanceCode?.toLowerCase().includes(searchConversations.toLowerCase())
    );
  }, [conversations, searchConversations]);

  const renderSidebar = () => (
    <div style={{
      width: collapsed ? 64 : SIDEBAR_WIDTH,
      height: '100vh',
      background: 'var(--bc-surface-card, #fff)',
      borderRight: '1px solid var(--bc-border-default, #f0f0f0)',
      display: 'flex',
      flexDirection: 'column',
      transition: 'width 0.3s',
      overflow: 'hidden',
      position: 'sticky',
      top: 0,
      zIndex: 100,
    }}>
      {/* Sidebar Header */}
      <div style={{ padding: '16px', borderBottom: '1px solid var(--bc-border-default, #f0f0f0)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {!collapsed && (
          <Space>
            <RobotOutlined style={{ fontSize: 20, color: '#1677ff' }} />
            <Text strong style={{ fontSize: 16 }}>RetailOps AI</Text>
          </Space>
        )}
        <Button
          type="text"
          icon={collapsed ? <RightOutlined /> : <LeftOutlined />}
          onClick={() => setCollapsed(!collapsed)}
        />
      </div>

      {/* New Chat Button */}
      {!collapsed && (
        <div style={{ padding: '12px 16px' }}>
          <Button
            block
            type="primary"
            icon={<PlusOutlined />}
            onClick={createConversation}
            style={{ fontWeight: 600 }}
          >
            New Chat
          </Button>
        </div>
      )}

      {/* Search Input */}
      {!collapsed && (
        <div style={{ padding: '0 16px 12px' }}>
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
          !collapsed && (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="No conversations"
              style={{ textAlign: 'center', padding: '20px 0' }}
            >
              <Button type="primary" onClick={createConversation} size="small">
                Start Chat
              </Button>
            </Empty>
          )
        ) : (
          <List
            dataSource={filteredConversations}
            renderItem={(conv) => (
              <List.Item
                key={conv.id}
                onClick={() => loadConversation(conv.id)}
                style={{
                  cursor: 'pointer',
                  background: currentConversation?.id === conv.id ? '#e6f4ff' : 'transparent',
                  borderRadius: 8,
                  padding: '8px 12px',
                  marginBottom: 4,
                }}
                actions={!collapsed ? [
                  <Button 
                    key="del" 
                    type="text" 
                    icon={<DeleteOutlined />} 
                    danger 
                    size="small" 
                    onClick={(e) => { e.stopPropagation(); deleteConversation(conv.id); }} 
                  />,
                ] : []}
              >
                {!collapsed && (
                  <List.Item.Meta
                    title={
                      <Text strong style={{ fontSize: 13, display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {conv.title || 'Untitled'}
                      </Text>
                    }
                    description={
                      <Text style={{ fontSize: 11, color: '#8c8c8c' }}>
                        {dayjs(conv.UpdatedAt || Date.now()).fromNow()}
                      </Text>
                    }
                  />
                )}
              </List.Item>
            )}
          />
        )}
      </div>

      {/* Token Usage Widget */}
      {!collapsed && (
        <div style={{ padding: '16px', borderTop: '1px solid var(--bc-border-default, #f0f0f0)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <Text strong style={{ fontSize: 12 }}>Daily Token Usage</Text>
            <Badge 
              count={`${Math.round(usedPercentage)}%`} 
              style={{ backgroundColor: getUsageColor(usedPercentage) }} 
            />
          </div>
          <div style={{ height: 6, background: '#f0f0f0', borderRadius: 3, overflow: 'hidden' }}>
            <div 
              style={{ 
                width: `${usedPercentage}%`, 
                height: '100%', 
                backgroundColor: getUsageColor(usedPercentage),
                borderRadius: 3,
                transition: 'width 0.3s ease, background-color 0.3s ease',
              }} 
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 11, color: '#8c8c8c' }}>
            <span>{usedPercentage.toFixed(1)}% used</span>
            <span>{Math.max(0, Math.floor((availableTokens || 0) / 1000))}K remaining</span>
          </div>
        </div>
      )}
    </div>
  );

  const renderChatArea = () => (
    <Content style={{ 
      flex: 1, 
      display: 'flex', 
      flexDirection: 'column', 
      background: '#f8fafc', 
      height: '100vh',
      position: 'relative'
    }}>
      
      {/* 1. TOP HEADER (Fixed Title & Model Selector) */}
      <div style={{ 
        padding: '16px 24px', 
        borderBottom: '1px solid #e2e8f0',
        background: '#ffffff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
        zIndex: 10
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Text strong style={{ fontSize: 18, color: '#0f172a' }}>
            {currentConversation?.title || 'RetailOps AI Assistant'}
          </Text>
        </div>
        
        <Space size={12}>
          {/* Model Selector Pill */}
          <Dropdown trigger={['click']} overlay={
            <Menu style={{ width: 280 }}>
              <SubMenu key="free" title={<Space><StarOutlined style={{ color: '#f59e0b' }} /> Free Models</Space>}>
                {MODEL_CATEGORIES.free.models.map(m => (
                  <Menu.Item key={m.id} onClick={() => handleModelChange(m.id)}>
                    <Space>
                      <Text strong>{m.name}</Text>
                      {selectedModel === m.id && <CheckCircleOutlined style={{ color: '#1677ff' }} />}
                    </Space>
                  </Menu.Item>
                ))}
              </SubMenu>
              <SubMenu key="subscription" title={<Space><StarOutlined style={{ color: '#8b5cf6' }} /> Subscription Models</Space>}>
                {MODEL_CATEGORIES.subscription.models.map(m => (
                  <Menu.Item key={m.id} onClick={() => handleModelChange(m.id)}>
                    <Space>
                      <Text strong>{m.name}</Text>
                      {selectedModel === m.id && <CheckCircleOutlined style={{ color: '#1677ff' }} />}
                    </Space>
                  </Menu.Item>
                ))}
              </SubMenu>
            </Menu>
          }
          >
            <Button style={{ 
              borderRadius: '20px', 
              background: '#f1f5f9', 
              border: 'none', 
              fontWeight: 500 
            }} icon={<RobotOutlined style={{ color: '#3b82f6' }} />}>
              {MODEL_CATEGORIES.free.models.find(m => m.id === selectedModel)?.name || 
               MODEL_CATEGORIES.subscription.models.find(m => m.id === selectedModel)?.name || 
               'Select Model'}
            </Button>
          </Dropdown>
          
          <Button type="text" icon={<SettingOutlined />} onClick={() => setShowSettings(!showSettings)} />
        </Space>
      </div>

      {/* 2. CHAT HISTORY / EMPTY STATE */}
      <div style={{ 
        flex: 1, 
        overflowY: 'auto', 
        padding: '24px', 
        display: 'flex', 
        flexDirection: 'column',
        alignItems: 'center'
      }}>
        
        {/* Container to restrict chat width for better readability */}
        <div style={{ width: '100%', maxWidth: '800px', display: 'flex', flexDirection: 'column' }}>
          
          {messages.length === 0 ? (
            // ENHANCED EMPTY STATE
            <div style={{ marginTop: '10vh', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
              <div style={{ padding: '20px', background: '#eff6ff', borderRadius: '50%', marginBottom: 8 }}>
                <RobotOutlined style={{ fontSize: 48, color: '#3b82f6' }} />
              </div>
              <Title level={3} style={{ margin: 0, color: '#0f172a' }}>How can I help you today?</Title>
              <Text type="secondary" style={{ fontSize: 15 }}>Select a quick action below or type a message to start.</Text>
              
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(2, 1fr)', 
                gap: 12, 
                marginTop: 32, 
                width: '100%' 
              }}>
                {QUICK_ACTIONS.map((action, i) => (
                  <Card
                    key={i}
                    hoverable
                    onClick={() => handleSend(action.prompt)}
                    style={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: 'none' }}
                    bodyStyle={{ padding: '16px' }}
                  >
                    <Space align="start">
                      <div style={{ color: '#3b82f6', fontSize: 18 }}>{action.icon}</div>
                      <Text style={{ fontWeight: 500, color: '#334155' }}>{action.label}</Text>
                    </Space>
                  </Card>
                ))}
              </div>
            </div>
          ) : (
            // YOUR EXISTING MESSAGES MAP GOES HERE
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24, paddingBottom: '40px' }}>
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
                      background: msg.role === 'user' ? '#1677ff' : '#e6f4ff',
                      color: msg.role === 'user' ? '#fff' : '#1677ff',
                      flexShrink: 0,
                      marginTop: 4,
                    }}
                  />
                  <div style={{ maxWidth: '100%', minWidth: 100 }}>
                    <div style={{ 
                      padding: '10px 14px', 
                      borderRadius: 12,
                      background: msg.role === 'user' ? '#1677ff' : '#fff',
                      color: msg.role === 'user' ? '#fff' : 'inherit',
                      border: '1px solid #f0f0f0',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                    }}>
                      <div style={{ lineHeight: 1.6, whiteSpace: 'pre-wrap', fontSize: 14 }}>
                        {msg.content}
                      </div>
                      {msg.usage && (
                        <div style={{ marginTop: 8, display: 'flex', gap: 12, fontSize: 10, opacity: 0.7 }}>
                          <span>Tokens: {msg.usage.total_tokens || msg.usage.totalTokens || 'N/A'}</span>
                        </div>
                      )}
                    </div>
                    {msg.streaming && <Spin size="small" style={{ marginTop: 6 }} />}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>
      </div>

      {/* 3. REDESIGNED CHAT INPUT AREA (ChatGPT Style) */}
      <div style={{ 
        padding: '0 24px 24px 24px', 
        background: 'linear-gradient(180deg, transparent, #f8fafc 20%)',
        display: 'flex',
        justifyContent: 'center'
      }}>
        <div style={{ 
          width: '100%', 
          maxWidth: '800px', 
          background: '#ffffff', 
          border: '1px solid #cbd5e1', 
          borderRadius: '16px',
          boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.01)',
          overflow: 'hidden',
          transition: 'border-color 0.2s',
        }}>
          <TextArea
            ref={textareaRef}
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            onPressEnter={e => { if (!e.shiftKey) { e.preventDefault(); handleSend(inputValue); }}}
            placeholder="Ask RetailOps AI anything... (Shift+Enter for new line)"
            autoSize={{ minRows: 1, maxRows: 8 }}
            bordered={false}
            style={{ 
              padding: '16px', 
              fontSize: 15, 
              boxShadow: 'none',
              resize: 'none',
              border: 'none',
            }}
          />
          
          {/* Footer of the input box containing settings & send button */}
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            padding: '8px 12px',
            background: '#f8fafc',
            borderTop: '1px solid #f1f5f9'
          }}>
            <Space size={16}>
              <Tooltip title="Include Database Context">
                <Space size={6}>
                  <DatabaseOutlined style={{ color: includeDatabase ? '#3b82f6' : '#94a3b8' }} />
                  <Switch checked={includeDatabase} onChange={setIncludeDatabase} size="small" />
                </Space>
              </Tooltip>
              <Tooltip title="Model Creativity (Temperature)">
                <Space size={6}>
                  <Text type="secondary" style={{ fontSize: 12 }}>Temp:</Text>
                  <InputNumber 
                    min={0} max={2} step={0.1} size="small"
                    value={temperature} onChange={setTemperature}
                    style={{ width: 60, fontSize: 12 }} 
                  />
                </Space>
              </Tooltip>
            </Space>

            <Button
              type="primary"
              shape="circle"
              icon={streaming ? <LoadingOutlined /> : <SendOutlined />}
              onClick={() => handleSend(inputValue)}
              disabled={!inputValue.trim() || streaming || loading}
              style={{ 
                background: inputValue.trim() ? '#1677ff' : '#e2e8f0', 
                color: inputValue.trim() ? '#fff' : '#94a3b8',
                border: 'none'
              }}
            />
          </div>
        </div>
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