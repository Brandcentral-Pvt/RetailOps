import React from 'react';
import { Drawer, Tag, Space, Button, Descriptions, Card, Progress, Typography, Avatar, Divider, Tooltip, Checkbox } from 'antd';
import { CloseOutlined, EditOutlined, UserOutlined, LinkOutlined, CheckSquareOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { can, formatUserName, getInitials } from './modalHelpers';
import WorkflowActionButton from './WorkflowActionButton';
import TaskStatusTimeline from './TaskStatusTimeline';
import WorkflowNotification from './WorkflowNotification';
import { db } from '../../services/db';

const { Text } = Typography;

const TaskDetailDrawer = ({
  isOpen,
  onClose,
  action,
  currentUser,
  onEdit,
  onStart,
  onSubmit,
  onReview
}) => {
  if (!action) return null;

  const currentStatus = (action.status || 'PENDING').toUpperCase();

  const canEdit = can(currentUser, 'edit_any_task') ||
    (can(currentUser, 'edit_own_task') &&
      (action.assignedTo && (
        Array.isArray(action.assignedTo)
          ? action.assignedTo.some(u => (u._id || u.id) === (currentUser._id || currentUser.id))
          : (action.assignedTo._id || action.assignedTo.id) === (currentUser._id || currentUser.id)
      )));

  const getAssigneeName = (assignee) => {
    if (!assignee) return null;
    if (typeof assignee === 'string') return assignee;
    return formatUserName(assignee);
  };

  const handleNotificationAction = (type, t) => {
    onClose();
    if (type === 'SUBMIT') {
      onSubmit?.(t);
    } else if (type === 'REVIEW') {
      onReview?.(t);
    } else if (type === 'RESTART') {
      onStart?.(t);
    }
  };

  const linkedAsins = action.asins || action.linkedAsins || [];
  const subTasks = action.subTasks || [];
  const completedSubTasks = subTasks.filter(st => st.status === 'completed').length;
  const subTaskProgress = action.subTaskProgress || `${completedSubTasks}/${subTasks.length}`;
  const showAllAsins = linkedAsins.length > 5;
  const displayAsins = showAllAsins ? linkedAsins.slice(0, 5) : linkedAsins;

  const handleToggleSubTask = async (subIdx) => {
    try {
      await db.toggleSubTask(action.id || action._id, subIdx);
      // Refresh by triggering a page reload of the drawer
      window.dispatchEvent(new CustomEvent('task-subtask-updated', { detail: { taskId: action.id || action._id } }));
    } catch (err) {
      console.error('Failed to toggle subtask:', err);
    }
  };

  return (
    <Drawer
      open={isOpen}
      onClose={onClose}
      placement="right"
      styles={{ body: { padding: 0 }, wrapper: { width: 560 } }}
      destroyOnHidden
      closable
      title={null}
    >
      <div style={{ borderLeft: '4px solid var(--bc-ro-500)', padding: '20px 24px 12px', borderBottom: '1px solid var(--bc-slate-100)' }}>
        <Space orientation="vertical" size={8} style={{ width: '100%' }}>
          <Text strong style={{ fontSize: 'var(--font-size-lg)', color: 'var(--bc-slate-800)', lineHeight: 1.3 }}>
            {action.title || action.action || 'Untitled Task'}
          </Text>
          <Space size={8} wrap>
            <Tag style={{ borderRadius: 6, fontSize: 'var(--font-size-xs)', fontWeight: 600, margin: 0 }}>
              {action.status || 'PENDING'}
            </Tag>
            {action.priority && (
              <Tag color={action.priority === 'HIGH' ? 'red' : action.priority === 'LOW' ? 'blue' : 'orange'} style={{ borderRadius: 6, fontSize: 'var(--font-size-xs)', fontWeight: 600, margin: 0 }}>
                {action.priority}
              </Tag>
            )}
            {action.type && (
              <Tag style={{ borderRadius: 6, fontSize: 'var(--font-size-xs)', margin: 0 }}>
                {action.type}
              </Tag>
            )}
          </Space>
        </Space>
      </div>

      <div style={{ padding: '20px 24px', maxHeight: 'calc(100vh - 120px)', overflowY: 'auto' }}>
        {/* Workflow Notification Banner */}
        <WorkflowNotification
          task={action}
          currentUser={currentUser}
          onAction={handleNotificationAction}
        />

        <Descriptions column={1} size="small" colon={false} labelStyle={{ fontSize: 'var(--font-size-sm)', color: 'var(--bc-slate-400)', fontWeight: 500, paddingBottom: 4 }} contentStyle={{ fontSize: 'var(--font-size-sm)', color: 'var(--bc-slate-800)', paddingBottom: 8 }}>
          <Descriptions.Item label="Task ID">
            <Text copyable style={{ fontFamily: 'monospace', fontSize: 'var(--font-size-sm)' }}>{action._id || action.id}</Text>
          </Descriptions.Item>
          <Descriptions.Item label="Category / Type">
            {action.type || action.category || '—'}
          </Descriptions.Item>
          <Descriptions.Item label="Action Type">
            {action.actionType || '—'}
          </Descriptions.Item>
          <Descriptions.Item label="Created by">
            <Space size={6}>
              <Avatar size={22} icon={<UserOutlined />} style={{ background: 'var(--bc-indigo-50)', color: 'var(--bc-ro-500)' }} />
              <span>{formatUserName(action.createdBy)}</span>
            </Space>
          </Descriptions.Item>
          <Descriptions.Item label="Created at">
            {action.createdAt ? dayjs(action.createdAt).format('MMM D, YYYY h:mm A') : '—'}
          </Descriptions.Item>
        </Descriptions>

        <Divider style={{ margin: '12px 0' }} />

        <Text strong style={{ fontSize: 'var(--font-size-sm)', color: 'var(--bc-slate-800)', display: 'block', marginBottom: 8 }}>Assignment</Text>
        <Descriptions column={1} size="small" colon={false} labelStyle={{ fontSize: 'var(--font-size-sm)', color: 'var(--bc-slate-400)', fontWeight: 500, paddingBottom: 4 }} contentStyle={{ fontSize: 'var(--font-size-sm)', color: 'var(--bc-slate-800)', paddingBottom: 8 }}>
          <Descriptions.Item label="Assigned To">
            {Array.isArray(action.assignedTo) && action.assignedTo.length > 0 ? (
              <Avatar.Group size={24} max={{ count: 3 }}>
                {action.assignedTo.map((u, i) => (
                  <Tooltip key={i} title={getAssigneeName(u)}>
                    <Avatar style={{ background: 'var(--bc-ro-500)' }}>{getInitials(getAssigneeName(u))}</Avatar>
                  </Tooltip>
                ))}
              </Avatar.Group>
            ) : action.assignedTo ? (
              <Space size={6}>
                <Avatar size={22} icon={<UserOutlined />} style={{ background: 'var(--bc-indigo-50)', color: 'var(--bc-ro-500)' }} />
                <span>{formatUserName(action.assignedTo)}</span>
              </Space>
            ) : (
              <Text style={{ color: 'var(--bc-slate-400)' }}>—</Text>
            )}
          </Descriptions.Item>
          <Descriptions.Item label="Reviewer">
            {action.reviewer ? (
              <Space size={6}>
                <Avatar size={22} icon={<UserOutlined />} style={{ background: 'var(--bc-violet-50)', color: 'var(--bc-purple-500)' }} />
                <span>{formatUserName(action.reviewer)}</span>
              </Space>
            ) : (
              <Text style={{ color: 'var(--bc-slate-400)' }}>—</Text>
            )}
          </Descriptions.Item>
          <Descriptions.Item label="Seller">
            {action.seller
              ? (typeof action.seller === 'string' ? action.seller : action.seller.name || action.seller.sellerName || action.seller.businessName || '—')
              : <Text style={{ color: 'var(--bc-slate-400)' }}>—</Text>}
          </Descriptions.Item>
          <Descriptions.Item label="Linked Objective">
            {action.keyResultId ? (
              <Space size={4}>
                <LinkOutlined style={{ color: 'var(--bc-ro-500)', fontSize: 'var(--font-size-sm)' }} />
                <Text style={{ color: 'var(--bc-ro-500)' }}>
                  {typeof action.keyResultId === 'string' ? action.keyResultId : action.keyResultId.title || 'Linked Objective'}
                </Text>
              </Space>
            ) : (
              <Text style={{ color: 'var(--bc-slate-400)' }}>—</Text>
            )}
          </Descriptions.Item>
        </Descriptions>

        <Divider style={{ margin: '12px 0' }} />

        <Text strong style={{ fontSize: 'var(--font-size-sm)', color: 'var(--bc-slate-800)', display: 'block', marginBottom: 12 }}>Status Timeline</Text>
        <TaskStatusTimeline task={action} compact={false} />

        <Divider style={{ margin: '12px 0' }} />

        <Text strong style={{ fontSize: 'var(--font-size-sm)', color: 'var(--bc-slate-800)', display: 'block', marginBottom: 8 }}>Linked ASINs</Text>
        {linkedAsins.length > 0 ? (
          <Card styles={{ body: { padding: 0 } }} style={{ borderRadius: "var(--radius-md)", border: '1px solid var(--bc-slate-200)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--bc-slate-50)', borderBottom: '1px solid var(--bc-slate-200)' }}>
                  <th style={{ padding: '8px 12px', fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--bc-slate-400)', textAlign: 'left' }}>ASIN</th>
                  <th style={{ padding: '8px 12px', fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--bc-slate-400)', textAlign: 'left' }}>Title</th>
                  <th style={{ padding: '8px 12px', fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--bc-slate-400)', textAlign: 'left' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {displayAsins.map((a, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--bc-slate-100)' }}>
                    <td style={{ padding: '8px 12px', fontSize: 'var(--font-size-sm)', fontFamily: 'monospace' }}>
                      {typeof a === 'string' ? a : a.asin || a.code || '—'}
                    </td>
                    <td style={{ padding: '8px 12px', fontSize: 'var(--font-size-sm)' }}>
                      {typeof a === 'string' ? '—' : a.title || a.name || '—'}
                    </td>
                    <td style={{ padding: '8px 12px' }}>
                      {typeof a === 'string' ? '—' : (
                        <Tag style={{ fontSize: 10, borderRadius: "var(--radius-sm)" }}>{a.status || 'Active'}</Tag>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        ) : (
          <div style={{ padding: '12px 0' }}>
            <Text style={{ color: 'var(--bc-slate-400)', fontSize: 'var(--font-size-sm)' }}>No ASINs linked</Text>
          </div>
        )}

        <Divider style={{ margin: '12px 0' }} />

        {/* Sub-Tasks (for grouped tasks like price disputes) */}
        {subTasks.length > 0 && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <Text strong style={{ fontSize: 'var(--font-size-sm)', color: 'var(--bc-slate-800)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <CheckSquareOutlined style={{ fontSize: 'var(--font-size-base)' }} />
                Sub-Tasks ({subTaskProgress})
              </Text>
              <Progress
                percent={subTasks.length > 0 ? Math.round((completedSubTasks / subTasks.length) * 100) : 0}
                size="small"
                strokeColor="#2E7D32"
                railColor="var(--bc-slate-100)"
                style={{ width: 100, margin: 0 }}
              />
            </div>
            <Card styles={{ body: { padding: 0 } }} style={{ borderRadius: "var(--radius-md)", border: '1px solid var(--bc-slate-200)', marginBottom: 12 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--bc-slate-50)', borderBottom: '1px solid var(--bc-slate-200)' }}>
                    <th style={{ padding: '8px 12px', fontSize: 10, fontWeight: 600, color: 'var(--bc-slate-400)', textAlign: 'center', width: 36 }}></th>
                    <th style={{ padding: '8px 12px', fontSize: 10, fontWeight: 600, color: 'var(--bc-slate-400)', textAlign: 'left' }}>ASIN</th>
                    {subTasks[0]?.currentPrice !== undefined && (
                      <>
                        <th style={{ padding: '8px 12px', fontSize: 10, fontWeight: 600, color: 'var(--bc-slate-400)', textAlign: 'right' }}>Channel</th>
                        <th style={{ padding: '8px 12px', fontSize: 10, fontWeight: 600, color: 'var(--bc-slate-400)', textAlign: 'right' }}>Market</th>
                        <th style={{ padding: '8px 12px', fontSize: 10, fontWeight: 600, color: 'var(--bc-slate-400)', textAlign: 'right' }}>Diff</th>
                      </>
                    )}
                    {subTasks[0]?.currentPrice === undefined && subTasks[0]?.stockLevel !== undefined && (
                      <th style={{ padding: '8px 12px', fontSize: 10, fontWeight: 600, color: 'var(--bc-slate-400)', textAlign: 'right' }}>Stock</th>
                    )}
                    {subTasks[0]?.currentPrice === undefined && subTasks[0]?.lqs !== undefined && (
                      <th style={{ padding: '8px 12px', fontSize: 10, fontWeight: 600, color: 'var(--bc-slate-400)', textAlign: 'right' }}>LQS</th>
                    )}
                    {subTasks[0]?.currentPrice === undefined && subTasks[0]?.stockLevel === undefined && subTasks[0]?.lqs === undefined && (
                      <th style={{ padding: '8px 12px', fontSize: 10, fontWeight: 600, color: 'var(--bc-slate-400)', textAlign: 'left' }}>Details</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {subTasks.map((st, i) => {
                    const isCompleted = st.status === 'completed';
                    return (
                      <tr key={i} style={{ borderBottom: '1px solid var(--bc-slate-100)', opacity: isCompleted ? 0.6 : 1 }}>
                        <td style={{ padding: '8px 8px', textAlign: 'center' }}>
                          <Checkbox checked={isCompleted} onChange={() => handleToggleSubTask(i)} />
                        </td>
                        <td style={{ padding: '8px 12px', fontSize: 'var(--font-size-sm)', fontFamily: 'monospace', fontWeight: 600 }}>
                          <span style={{ textDecoration: isCompleted ? 'line-through' : 'none' }}>{st.asinCode}</span>
                          {st.brand && <span style={{ fontSize: 10, color: 'var(--bc-slate-400)', marginLeft: 4 }}>{st.brand}</span>}
                        </td>
                        {st.currentPrice !== undefined ? (
                          <>
                            <td style={{ padding: '8px 12px', fontSize: 'var(--font-size-sm)', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>₹{(st.currentPrice || 0).toLocaleString()}</td>
                            <td style={{ padding: '8px 12px', fontSize: 'var(--font-size-sm)', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>₹{(st.uploadedPrice || 0).toLocaleString()}</td>
                            <td style={{ padding: '8px 12px', fontSize: 'var(--font-size-sm)', textAlign: 'right' }}>
                              <Tag color={st.difference > 50 ? 'error' : 'warning'} style={{ borderRadius: "var(--radius-sm)", fontSize: 10 }}>₹{(st.difference || 0).toLocaleString()}</Tag>
                            </td>
                          </>
                        ) : st.stockLevel !== undefined ? (
                          <td style={{ padding: '8px 12px', fontSize: 'var(--font-size-sm)', textAlign: 'right' }}>
                            <Tag color={st.stockLevel === 0 ? 'error' : st.stockLevel < 10 ? 'warning' : 'success'} style={{ borderRadius: "var(--radius-sm)", fontSize: 10 }}>{st.stockLevel}</Tag>
                          </td>
                        ) : st.lqs !== undefined ? (
                          <td style={{ padding: '8px 12px', fontSize: 'var(--font-size-sm)', textAlign: 'right' }}>
                            <Tag color={st.lqs < 50 ? 'error' : st.lqs < 70 ? 'warning' : 'success'} style={{ borderRadius: "var(--radius-sm)", fontSize: 10 }}>{st.lqs}</Tag>
                          </td>
                        ) : (
                          <td style={{ padding: '8px 12px', fontSize: 'var(--font-size-xs)', color: 'var(--bc-slate-500)' }}>
                            {st.title || st.asinCode}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Card>
            <Divider style={{ margin: '12px 0' }} />
          </>
        )}

        <Text strong style={{ fontSize: 'var(--font-size-sm)', color: 'var(--bc-slate-800)', display: 'block', marginBottom: 8 }}>Progress</Text>
        <Progress
          percent={action.status === 'COMPLETED' ? 100 : action.status === 'IN_PROGRESS' ? 50 : 0}
          size="small"
          strokeColor="var(--bc-ro-500)"
          railColor="var(--bc-slate-100)"
          style={{ marginBottom: 12 }}
        />

        {(action.description || action.internalNotes || (action.tags && action.tags.length > 0)) && (
          <>
            <Divider style={{ margin: '12px 0' }} />
            <Text strong style={{ fontSize: 'var(--font-size-sm)', color: 'var(--bc-slate-800)', display: 'block', marginBottom: 8 }}>Notes &amp; Description</Text>
            {action.description && (
              <div style={{ background: 'var(--bc-slate-50)', borderRadius: "var(--radius-md)", padding: 12, marginBottom: 8 }}>
                <Text style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-primary)', whiteSpace: 'pre-wrap' }}>{action.description}</Text>
              </div>
            )}
            {action.internalNotes && (
              <div style={{ background: 'var(--bc-amber-50)', borderRadius: "var(--radius-md)", padding: 12, marginBottom: 8, border: '1px solid var(--bc-amber-200)' }}>
                <Text style={{ fontSize: 'var(--font-size-xs)', color: 'var(--bc-amber-800)', fontWeight: 600, display: 'block', marginBottom: 4 }}>Internal Notes</Text>
                <Text style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-primary)', whiteSpace: 'pre-wrap' }}>{action.internalNotes}</Text>
              </div>
            )}
            {action.tags && action.tags.length > 0 && (
              <Space size={4} wrap>
                {action.tags.map((tag, i) => (
                  <Tag key={i} style={{ borderRadius: 6, fontSize: 'var(--font-size-xs)' }}>{tag}</Tag>
                ))}
              </Space>
            )}
          </>
        )}
      </div>

      <div style={{ borderTop: '1px solid var(--bc-slate-100)', padding: '12px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Button icon={<CloseOutlined />} onClick={onClose} style={{ height: 36, borderRadius: "var(--radius-md)" }}>
          Close
        </Button>
        <Space size={8}>
          {canEdit && (
            <Button
              icon={<EditOutlined />}
              onClick={() => { onClose(); onEdit?.(action); }}
              style={{ height: 36, borderRadius: "var(--radius-md)", border: '1px solid var(--bc-slate-200)' }}
            >
              Edit
            </Button>
          )}
          <WorkflowActionButton
            task={action}
            currentUser={currentUser}
            onStart={(t) => { onClose(); onStart?.(t); }}
            onSubmit={(t) => { onClose(); onSubmit?.(t); }}
            onApprove={(t) => { onClose(); onReview?.(t); }}
            onReject={(t) => { onClose(); onReview?.(t); }}
            size="default"
          />
        </Space>
      </div>
    </Drawer>
  );
};

export default TaskDetailDrawer;
