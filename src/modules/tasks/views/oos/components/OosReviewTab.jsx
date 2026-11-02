import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { App, Card, Alert, Space, Button, Form, Input, Checkbox, Tag, List, Typography, Divider, Descriptions } from 'antd';
import tasksApi from '../../../services/tasksApi';
import dayjs from 'dayjs';

const { Text } = Typography;

function OosReviewTab({ task, activeRun, runs, canManage }) {
  const { message } = App.useApp();
  const [submission, setSubmission] = useState(null);
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();

  const taskInstanceId = task?.Id;

  const runDate = useMemo(() => {
    if (!activeRun || !runs?.length) return null;
    const run = runs.find(r => r.Id === activeRun);
    return run?.RunDate || null;
  }, [activeRun, runs]);

  const loadSubmission = useCallback(async () => {
    if (!taskInstanceId || !activeRun) return;
    try {
      const res = await tasksApi.getAffectedAsins(taskInstanceId, activeRun, { runId: activeRun });
      if (res.success) setSubmission(res.data?.submission || res.data || null);
    } catch (err) {
      console.error(err);
    }
  }, [activeRun, taskInstanceId]);

  useEffect(() => {
    if (!activeRun) return undefined;
    const timer = setTimeout(() => { loadSubmission(); }, 0);
    return () => clearTimeout(timer);
  }, [activeRun, loadSubmission]);

  const handleSubmit = async (values) => {
    if (!taskInstanceId || !canManage) return;
    setLoading(true);
    try {
      const res = await tasksApi.submitOos(taskInstanceId, { runId: activeRun, ...values });
      if (res.success) {
        message.success(res.ok ? 'Submitted for review' : 'Submission blocked: ' + (res.errors?.join('; ') || 'Unknown'));
        loadSubmission();
      }
    } catch (err) {
      message.error(err.message || 'Submission failed');
    } finally {
      setLoading(false);
    }
  };

  const checklist = submission?.checklist || [
    { key: 'sources', label: 'Sources validated or exceptions recorded', ok: false },
    { key: 'dispositions', label: 'Every analysed case has a disposition', ok: false },
    { key: 'ownership', label: 'Every open incident has owner, communication, next action and follow-up', ok: false },
    { key: 'export', label: 'Immutable export with hash', ok: false },
    { key: 'reviewer', label: 'Independent reviewer named', ok: false },
    { key: 'blocking', label: 'No unresolved blocking reasons', ok: false },
  ];

  return (
    <Card size="small" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
        <Space>
          <Text strong>Run: {runDate ? dayjs(runDate).format('DD MMM YYYY') : 'Select a run'}</Text>
        </Space>
      </div>

      {submission && (
        <Alert
          type={submission.ok ? 'success' : 'error'}
          message={submission.ok ? 'Submitted for Independent Review' : 'Submission Blocked'}
          description={submission.errors?.join(', ') || submission.checklist?.filter(c => !c.ok).map(c => c.label).join(', ')}
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}

      <Card title="Submission Checklist" style={{ marginBottom: 16 }}>
        <List
          itemLayout="horizontal"
          dataSource={checklist}
          renderItem={item => (
            <List.Item
              actions={[
                <Tag color={item.ok ? 'green' : 'red'}>{item.ok ? '✓' : '✗'}</Tag>
              ]}
            >
              <List.Item.Meta
                title={item.label}
                description={<Text type="secondary" style={{ fontSize: 11 }}>{item.key}</Text>}
              />
            </List.Item>
          )}
        />
      </Card>

      <Divider style={{ margin: '16px 0' }} />

      <Form form={form} layout="vertical" onFinish={handleSubmit} initialValues={{ sourcesValidated: true, exceptionsRecorded: false }}>
        <Form.Item name="reviewerId" label="Independent Reviewer ID" rules={[{ required: true, message: 'Required' }]}>
          <Input placeholder="Reviewer user ID" disabled={!canManage} />
        </Form.Item>
        <Form.Item name="sourcesValidated" valuePropName="checked" label="Sources validated">
          <Checkbox disabled={!canManage}>All source reports validated</Checkbox>
        </Form.Item>
        <Form.Item name="exceptionsRecorded" valuePropName="checked" label="Exceptions recorded">
          <Checkbox disabled={!canManage}>All exceptions recorded instead</Checkbox>
        </Form.Item>
        <Form.Item name="note" label="Reviewer Note">
          <Input.TextArea rows={3} maxLength={500} placeholder="Notes for the reviewer" disabled={!canManage} />
        </Form.Item>
        <Button type="primary" htmlType="submit" loading={loading} disabled={!canManage || !activeRun} style={{ marginTop: 8 }}>
          Submit for Independent Review
        </Button>
      </Form>

      <>
        {submission?.review && (
          <>
            <Divider style={{ margin: '16px 0' }} />
            <Card title="Review Decision" style={{ marginTop: 16 }}>
              <Descriptions size="small" column={2}>
                <Descriptions.Item label="Reviewer">{submission.review.ReviewerId}</Descriptions.Item>
                <Descriptions.Item label="Status"><Tag color={submission.review.Status === 'APPROVED' ? 'green' : 'red'}>{submission.review.Status}</Tag></Descriptions.Item>
                <Descriptions.Item label="Decided At">{dayjs(submission.review.CreatedAt).format('DD MMM YYYY HH:mm')}</Descriptions.Item>
                <Descriptions.Item label="Blocking Reasons">{submission.review.BlockingReasons?.join(', ') || 'None'}</Descriptions.Item>
              </Descriptions>
            </Card>
          </>
        )}
      </>
    </Card>
  );
}

export default OosReviewTab;