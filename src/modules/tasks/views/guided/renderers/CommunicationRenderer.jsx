import React, { useState, useCallback, useEffect } from 'react';
import { Card, Form, Input, Button, Typography, Space, Alert, List, Avatar, Tag, Modal } from 'antd';
import { SendOutlined, MailOutlined, PaperClipOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { useAuth } from '../../../../../contexts/AuthContext';
import tasksApi from '../../../services/tasksApi';

const { Text } = Typography;

/**
 * COMMUNICATION renderer - approved communication and records
 * Structured messaging with thread support, attachments, and approval workflow
 */

function ReplyForm({ parentMessage, onReply }) {
  const [replyText, setReplyText] = useState('');
  const [showReply, setShowReply] = useState(false);
  
  return (
    <div>
      {!showReply && (
        <Button size="small" type="text" icon={<ReplyOutlined />} onClick={() => setShowReply(true)}>Reply</Button>
      )}
      {showReply && (
        <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
          <Input.TextArea
            value={replyText}
            onChange={e => setReplyText(e.target.value)}
            placeholder="Write a reply..."
            rows={2}
            style={{ flex: 1 }}
          />
          <Button type="primary" size="small" onClick={() => onReply(parentMessage, replyText)}>Send</Button>
          <Button size="small" onClick={() => { setShowReply(false); setReplyText(''); }}>Cancel</Button>
        </div>
      )}
    </div>
  );
}

export default function CommunicationRenderer({ activity, task, onOutputChange, readOnly }) {
  const { hasPermission, user } = useAuth();
  const canEdit = !readOnly && hasPermission('tasks_execute');
  const canManage = hasPermission('tasks_manage');
  
  const commConfig = activity.commConfig || {};
  const [messages, setMessages] = useState(activity.outputValue?.messages || []);
  const [newMessage, setNewMessage] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [sending, setSending] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [viewingMessage, setViewingMessage] = useState(null);
  
  const handleSend = async (values) => {
    if (!canEdit) return;
    setSending(true);
    try {
      const messageObj = {
        id: `msg_${Date.now()}`,
        text: values.message,
        attachments: attachments,
        sentBy: user?.id,
        sentByName: user?.name || user?.firstName + ' ' + user?.lastName,
        sentAt: new Date().toISOString(),
        status: 'SENT',
        requiresApproval: commConfig.requiresApproval || false,
      };
      
      const newMessages = [...messages, messageObj];
      setMessages(newMessages);
      setNewMessage('');
      setAttachments([]);
      await onOutputChange({ ...activity.outputValue, messages: newMessages });
    } catch (err) {
      console.error(err);
    } finally {
      setSending(false);
    }
  };
  
  const handleReply = async (parentMessage, replyText) => {
    if (!replyText.trim()) return;
    const replyObj = {
      id: `reply_${Date.now()}`,
      text: replyText,
      sentBy: user?.id,
      sentByName: user?.name || user?.firstName + ' ' + user?.lastName,
      sentAt: new Date().toISOString(),
      parentId: parentMessage.id,
      status: 'SENT',
    };
    const newMessages = messages.map(m => 
      m.id === parentMessage.id ? { ...m, replies: [...(m.replies || []), replyObj] } : m
    );
    setMessages(newMessages);
    await onOutputChange({ ...activity.outputValue, messages: newMessages });
  };
  
  const renderMessage = (msg, depth = 0) => (
    <div key={msg.id} style={{ marginLeft: depth * 24, marginBottom: 12, padding: '12px', background: 'var(--bc-surface-subtle)', borderRadius: 8, border: '1px solid var(--bc-border-default)' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <Avatar size={32} style={{ background: 'var(--bc-blue-500)' }}>{msg.sentByName?.[0]?.toUpperCase() || 'U'}</Avatar>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <Text strong>{msg.sentByName}</Text>
            <Tag size="small" color={msg.status === 'SENT' ? 'green' : msg.status === 'PENDING' ? 'orange' : 'red'}>{msg.status}</Tag>
            {msg.requiresApproval && <Tag size="small" color="purple">Needs Approval</Tag>}
            <Text type="secondary" style={{ fontSize: 11, marginLeft: 'auto' }}>{new Date(msg.sentAt).toLocaleString()}</Text>
          </div>
          <Text>{msg.text}</Text>
          {msg.attachments?.length > 0 && (
            <List
              itemLayout="horizontal"
              dataSource={msg.attachments}
              renderItem={att => (
                <List.Item>
                  <List.Item.Meta
                    avatar={<PaperClipOutlined />}
                    title={att.fileName}
                    description={<Text type="secondary" style={{ fontSize: 11 }}>{(att.fileSize / 1024).toFixed(1)} KB</Text>}
                  />
                </List.Item>
              )}
            />
          )}
          {msg.replies?.length > 0 && (
            <div style={{ marginTop: 8, borderLeft: '2px solid var(--bc-border-default)', paddingLeft: 8 }}>
              {msg.replies.map(r => renderMessage(r, depth + 1))}
            </div>
          )}
          {canEdit && !msg.replies && (
            <div style={{ marginTop: 8 }}>
              <ReplyForm parentMessage={msg} onReply={handleReply} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
  
  return (
    <Card size="small" style={{ width: '100%' }}>
      {activity.instructions && (
        <Alert
          message={activity.title}
          description={activity.instructions}
          type="info"
          showIcon
          style={{ marginBottom: 12 }}
        />
      )}
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Form onFinish={handleSend} layout="horizontal" style={{ background: 'var(--bc-surface-subtle)', padding: 12, borderRadius: 8, border: '1px solid var(--bc-border-default)' }}>
          <Form.Item name="message" rules={[{ required: true, message: 'Message is required' }]}>
            <Input.TextArea
              value={newMessage}
              onChange={e => setNewMessage(e.target.value)}
              placeholder="Compose message..."
              rows={2}
              style={{ width: '100%' }}
              disabled={!canEdit}
            />
          </Form.Item>
          <Form.Item>
            <Space size={8}>
              <Button type="primary" htmlType="submit" loading={sending} disabled={!canEdit || !newMessage.trim()}>
                <SendOutlined /> Send
              </Button>
              {commConfig.requiresApproval && <Tag color="purple">Requires Approval</Tag>}
            </Space>
          </Form.Item>
        </Form>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 400, overflow: 'auto' }}>
          {messages.length === 0 ? (
            <Alert message="No messages yet" type="info" showIcon />
          ) : (
            messages.map(msg => renderMessage(msg))
          )}
        </div>
      </div>
      
      {!canEdit && <Text type="secondary" style={{ fontSize: 11, marginTop: 8, display: 'block' }}>Read-only mode</Text>}
    </Card>
  );
}