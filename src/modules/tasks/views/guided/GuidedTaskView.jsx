import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, Tabs, Steps, Alert, Spin, Tag, Space, Button, Typography, Tooltip, Modal, Collapse, Row, Col } from 'antd';
import { 
  CheckCircleOutlined, ClockCircleOutlined, ExclamationCircleOutlined, 
  LockOutlined, UploadOutlined, FileTextOutlined, EditOutlined,
  EyeOutlined, ArrowRightOutlined, ReloadOutlined, MenuOutlined,
  ExclamationCircleOutlined as ExclamationCircleOutlined2
} from '@ant-design/icons';
import { useAuth } from '../../../../contexts/AuthContext';
import tasksApi from '../../services/tasksApi';
import { VISIBILITY_STATES } from '../../constants/workflowStatuses';

// Import renderers
import ChecklistRenderer from './renderers/ChecklistRenderer';
import FormInputRenderer from './renderers/FormInputRenderer';
import SelectSourceRenderer from './renderers/SelectSourceRenderer';
import DataReviewRenderer from './renderers/DataReviewRenderer';
import TableReviewRenderer from './renderers/TableReviewRenderer';
import FileUploadRenderer from './renderers/FileUploadRenderer';
import CommunicationRenderer from './renderers/CommunicationRenderer';
import EvidenceReviewRenderer from './renderers/EvidenceReviewRenderer';

const { Text } = Typography;

const RENDERER_MAP = {
  CHECKLIST: ChecklistRenderer,
  FORM_INPUT: FormInputRenderer,
  SELECT_SOURCE: SelectSourceRenderer,
  DATA_REVIEW: DataReviewRenderer,
  TABLE_REVIEW: TableReviewRenderer,
  FILE_UPLOAD: FileUploadRenderer,
  COMMUNICATION: CommunicationRenderer,
  EVIDENCE_REVIEW: EvidenceReviewRenderer,
};

/**
 * GuidedTaskView - Renders a task using the pinned view definition
 * Shows phases, activities, conditional visibility, and evidence requirements
 */
export default function GuidedTaskView({ task, viewDefinition, onAction }) {
  const { hasPermission, isAdmin, isGlobalUser, user } = useAuth();
  const canEdit = hasPermission('tasks_execute') || isAdmin || isGlobalUser;
  const canManage = hasPermission('tasks_manage') || isAdmin || isGlobalUser;
  
  const [taskData, setTaskData] = useState(task);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [error, setError] = useState(null);
  const [activityOutputs, setActivityOutputs] = useState({});
  const [modalVisible, setModalVisible] = useState(false);
  const [modalData, setModalData] = useState(null);
  
  // Load task data and outputs
  const loadTask = useCallback(async () => {
    if (!task?.Id) return;
    setLoading(true);
    try {
      const res = await tasksApi.getInstanceById(task.Id);
      if (res.success) {
        setTaskData(res.data);
        // Load activity outputs
        const actsRes = await tasksApi.getInstanceById(task.Id);
        if (actsRes.success && actsRes.data.subTasks) {
          const outputs = {};
          actsRes.data.subTasks.forEach(st => {
            st.activities?.forEach(act => {
              if (act.OutputValue !== undefined) {
                outputs[act.Id] = act.OutputValue;
              }
            });
          });
          setActivityOutputs(outputs);
        }
      }
    } catch (err) {
      setError(err.message || 'Failed to load task');
    } finally {
      setLoading(false);
    }
  }, [task?.Id]);
  
  useEffect(() => {
    loadTask();
  }, [loadTask]);
  
  // Parse view definition
  const phases = useMemo(() => {
    if (!viewDefinition?.phases) return [];
    return viewDefinition.phases.map((phase, phaseIndex) => ({
      ...phase,
      index: phaseIndex,
      activities: (phase.activities || []).map((act, actIndex) => ({
        ...act,
        index: actIndex,
        phaseIndex,
        // Determine visibility from backend
        visibilityState: act.VisibilityState || VISIBILITY_STATES.VISIBLE,
        isVisible: (act.VisibilityState || VISIBILITY_STATES.VISIBLE) === VISIBILITY_STATES.VISIBLE,
        isSkipped: (act.VisibilityState || VISIBILITY_STATES.VISIBLE) === VISIBILITY_STATES.SKIPPED,
        isWaiting: (act.VisibilityState || VISIBILITY_STATES.VISIBLE) === VISIBILITY_STATES.WAITING,
      })),
    }));
  }, [viewDefinition]);
  
  // Calculate progress
  const progress = useMemo(() => {
    let total = 0, completed = 0, mandatoryTotal = 0, mandatoryCompleted = 0;
    phases.forEach(phase => {
      phase.activities.forEach(act => {
        if (act.isVisible || act.isWaiting) {
          total++;
          if (act.IsMandatory) mandatoryTotal++;
          if (act.IsCompleted) {
            completed++;
            if (act.IsMandatory) mandatoryCompleted++;
          }
        }
      });
    });
    return { total, completed, mandatoryTotal, mandatoryCompleted, pct: total > 0 ? Math.round((completed / total) * 100) : 0 };
  }, [phases]);
  
  const handleOutputChange = async (activityId, outputValue) => {
    setActivityOutputs(prev => ({ ...prev, [activityId]: outputValue }));
    try {
      await tasksApi.updateActivityOutput?.(activityId, outputValue, user?.id, user?.name);
    } catch (err) {
      console.error('Failed to save output:', err);
    }
  };
  
  const handleCompleteActivity = async (activityId) => {
    try {
      await tasksApi.completeActivity(activityId);
      loadTask();
      if (onAction) onAction({ type: 'ACTIVITY_COMPLETED', activityId });
    } catch (err) {
      setError(err.message || 'Failed to complete activity');
    }
  };
  
  const handleTransition = async (toStatus, remarks = '') => {
    if (onAction) {
      await onAction({ type: 'TRANSITION', toStatus, remarks });
    }
  };
  
  const getActivityRenderer = (activityType) => {
    return RENDERER_MAP[activityType] || DefaultRenderer;
  };
  
  if (!taskData && !loading) return null;
  
  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', padding: 24 }}>
        <Spin size="large" />
      </div>
    );
  }
  
  const forwardStatuses = taskData ? (['ASSIGNED', 'IN_PROGRESS', 'SUBMITTED', 'APPROVED', 'REJECTED', 'REWORK', 'CANCELLED'].filter(s => s !== taskData.Status)) : [];
  const primaryStatus = forwardStatuses[0];
  
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--bc-border-default)', background: 'var(--bc-surface-card)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Text code style={{ fontSize: 11 }}>{taskData.InstanceCode}</Text>
            <Tag style={{ fontSize: 10, borderRadius: 4, fontWeight: 700, margin: 0, background: '#16a34a15', color: '#16a34a', border: '1px solid #16a34a30' }}>
              {progress.pct}% Complete
            </Tag>
          </div>
          <div style={{ flex: 1 }} />
          <Space size={6}>
            {primaryStatus && (
              <Button size="small" type="primary" icon={<ArrowRightOutlined />} 
                onClick={() => handleTransition(primaryStatus)} style={{ fontWeight: 600 }}>
                {primaryStatus === 'SUBMITTED' ? 'Submit for review' : 'Continue'}
              </Button>
            )}
          </Space>
        </div>
        <Text strong style={{ fontSize: 18, color: 'var(--bc-text-heading)', display: 'block', marginBottom: 4 }}>{taskData.Title || taskData.TemplateName}</Text>
        {taskData.Description && <Text style={{ fontSize: 12, color: 'var(--bc-text-secondary)', display: 'block' }}>{taskData.Description}</Text>}
        
        {/* Progress bar */}
        <div style={{ marginTop: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <Text style={{ fontSize: 11, color: 'var(--bc-text-secondary)' }}>{progress.completed}/{progress.total} activities completed</Text>
            <Text strong style={{ fontSize: 11 }}>{progress.pct}%</Text>
          </div>
          <div style={{ height: 6, background: 'var(--bc-border-default)', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ 
              height: '100%', 
              width: `${progress.pct}%`, 
              background: progress.pct === 100 ? 'var(--bc-green-600)' : 'var(--bc-blue-600)',
              borderRadius: 3,
              transition: 'width 0.3s ease'
            }} />
          </div>
        </div>
      </div>
      
      {/* Phase Tabs */}
      <div style={{ flex: 1, overflow: 'auto', padding: '16px 24px' }}>
        {error && (
          <Alert type="error" message={error} onClose={() => setError(null)} style={{ marginBottom: 16 }} />
        )}
        
        {viewDefinition?.fallback && (
          <Alert type="warning" showIcon message="Using fallback view" style={{ marginBottom: 16 }} />
        )}
        
        <Tabs activeKey={activeTab} onChange={setActiveTab} type="card" style={{ height: 'calc(100% - 8px)' }}>
          {phases.map((phase, index) => (
            <Tabs.TabPane key={phase.id || index} tab={
              <Space>
                <Text strong>{phase.title || `Phase ${index + 1}`}</Text>
                {phase.activities.some(a => a.isWaiting) && <Tag color="orange">Waiting</Tag>}
                {phase.activities.some(a => a.isSkipped) && <Tag color="blue">Skipped</Tag>}
              </Space>
            }>
              <PhaseView 
                phase={phase} 
                task={taskData}
                activityOutputs={activityOutputs}
                canEdit={canEdit}
                canManage={canManage}
                onOutputChange={handleOutputChange}
                onCompleteActivity={handleCompleteActivity}
              />
            </Tabs.TabPane>
          ))}
          
          {/* Evidence tab if any activity requires evidence */}
          {phases.some(p => p.activities.some(a => a.evidenceRequired)) && (
            <Tabs.TabPane key="evidence" tab={<Space><Text strong>Evidence</Text><Tag color="blue">Review</Tag></Space>}>
              <EvidenceTab task={taskData} canManage={canManage} />
            </Tabs.TabPane>
          )}
          
          {/* Comments/Activity tab */}
          <Tabs.TabPane key="activity" tab={<Space><Text strong>Activity</Text></Space>}>
            <ActivityTab task={taskData} />
          </Tabs.TabPane>
        </Tabs>
      </div>
    </div>
  );
}

function PhaseView({ phase, task, activityOutputs, canEdit, canManage, onOutputChange, onCompleteActivity }) {
  if (!phase.activities || phase.activities.length === 0) {
    return (
      <Alert message="No activities defined for this phase" type="info" showIcon style={{ padding: 24 }} />
    );
  }
  
  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
      {phase.description && (
        <Alert message={phase.title} description={phase.description} type="info" showIcon style={{ marginBottom: 16 }} />
      )}
      
      <Collapse
        activeKey={phase.activities.map((_, i) => i)}
        ghost
        style={{ width: '100%' }}
      >
        {phase.activities.map((activity, actIndex) => (
          <Collapse.Panel key={activity.id || actIndex} header={
            <Space>
              <Text strong>{activity.title}</Text>
              <ActivityStatusBadge activity={activity} />
              {activity.IsMandatory && <Tag color="red" size="small">Mandatory</Tag>}
              {activity.evidenceRequired && <Tag color="purple" size="small"><FileTextOutlined /> Evidence Required</Tag>}
            </Space>
          }>
            <ActivityRenderer
              activity={activity}
              task={task}
              outputValue={activityOutputs[activity.Id]}
              canEdit={canEdit && !activity.isSkipped && !activity.isWaiting}
              canManage={canManage}
              onOutputChange={(value) => onOutputChange(activity.Id, value)}
              onComplete={() => onCompleteActivity(activity.Id)}
            />
          </Collapse.Panel>
        ))}
      </Collapse>
    </div>
  );
}

function ActivityRenderer({ activity, task, outputValue, canEdit, canManage, onOutputChange, onComplete }) {
  const Renderer = RENDERER_MAP[activity.type] || DefaultRenderer;
  const isCompleted = activity.IsCompleted;
  
  return (
    <div style={{ padding: '8px 0' }}>
      {activity.instructions && (
        <Alert description={activity.instructions} type="info" showIcon style={{ marginBottom: 12 }} />
      )}
      
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Renderer
            activity={activity}
            task={task}
            outputValue={outputValue}
            onOutputChange={onOutputChange}
            readOnly={!canEdit || activity.isSkipped || activity.isWaiting}
          />
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, minWidth: 120 }}>
          {activity.isWaiting && (
            <Alert message="Waiting for upstream data" type="info" showIcon style={{ width: 200, fontSize: 11 }} />
          )}
          {activity.isSkipped && (
            <Alert message="Skipped (condition not met)" type="warning" showIcon style={{ width: 200, fontSize: 11 }} />
          )}
          {activity.evidenceRequired && !isCompleted && (
            <Tag color="purple"><FileTextOutlined /> Evidence Required</Tag>
          )}
          
          {!isCompleted && canEdit && !activity.isSkipped && !activity.isWaiting && (
            <Button type="primary" size="small" icon={<CheckCircleOutlined />} onClick={onComplete} style={{ width: '100%' }}>
              Mark Complete
            </Button>
          )}
          
          {isCompleted && (
            <Tag color="success"><CheckCircleOutlined /> Completed</Tag>
          )}
        </div>
      </div>
    </div>
  );
}

function ActivityStatusBadge({ activity }) {
  if (activity.isWaiting) return <Tag color="orange"><ClockCircleOutlined /> Waiting</Tag>;
  if (activity.isSkipped) return <Tag color="blue"><ExclamationCircleOutlined /> Skipped</Tag>;
  if (activity.IsCompleted) return <Tag color="green"><CheckCircleOutlined /> Done</Tag>;
  return <Tag color="default">Pending</Tag>;
}

function EvidenceTab({ task, canManage }) {
  const [evidence, setEvidence] = useState([]);
  const [loading, setLoading] = useState(false);
   
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await tasksApi.getInstanceById(task.Id);
        if (res.success && res.data.evidence) {
          setEvidence(res.data.evidence);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [task?.Id]);
   
  if (loading) return <Spin size="large" style={{ padding: 24 }} />;
   
  return (
    <div style={{ padding: 8 }}>
      {evidence.length === 0 ? (
        <Alert message="No evidence uploaded" type="info" showIcon />
      ) : (
        <List
          itemLayout="horizontal"
          dataSource={evidence}
          renderItem={item => (
            <List.Item
              actions={canManage ? [
                <Button size="small" type="text" icon={<EyeOutlined />}>View</Button>,
                <Button size="small" type="text" icon={<DownloadOutlined />}>Download</Button>,
              ] : []}
            >
              <List.Item.Meta
                title={item.fileName}
                description={<Space><Tag color={item.verified ? 'green' : 'orange'}>{item.verified ? 'Verified' : 'Pending'}</Tag><Text type="secondary">Uploaded by {item.uploadedByName}</Text></Space>}
              />
            </List.Item>
          )}
        />
      )}
    </div>
  );
}

function ActivityTab({ task }) {
  const [audit, setAudit] = useState([]);
  const [loading, setLoading] = useState(false);
  
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await tasksApi.getInstanceById(task.Id);
        if (res.success && res.data.auditLogs) {
          setAudit(res.data.auditLogs);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
load();
  }, [task?.Id]);
   
  if (loading) return <Spin size="large" style={{ padding: 24 }} />;
   
  return (
    <div style={{ padding: 8 }}>
      <List
        dataSource={audit}
        renderItem={item => (
          <List.Item>
            <List.Item.Meta
              title={<Space><Text strong>{item.Action}</Text><Tag color={item.ToStatus === 'APPROVED' ? 'green' : item.ToStatus === 'REJECTED' ? 'red' : 'blue'}>{item.ToStatus || item.FromStatus}</Tag></Space>}
              description={<Space>{item.ActorName} · {new Date(item.CreatedAt).toLocaleString()}</Space>}
            />
          </List.Item>
        )}
      />
    </div>
  );
}
 
function DefaultRenderer({ activity, outputValue, readOnly }) {
  return (
    <Card size="small" style={{ width: '100%' }}>
      <Alert message="No renderer for this activity type" description={`Type: ${activity.type}`} type="warning" showIcon />
      <pre style={{ background: 'var(--bc-surface-subtle)', padding: 12, borderRadius: 6, fontSize: 11, overflow: 'auto' }}>
        {JSON.stringify(activity, null, 2)}
      </pre>
    </Card>
  );
}