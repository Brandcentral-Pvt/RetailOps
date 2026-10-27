import React, { useState, useEffect, useCallback } from 'react';
import { App, Card, Table, Tag, Space, Button, Modal, Form, Input, Select, DatePicker, Popconfirm, Typography, Alert } from 'antd';
import { ReloadOutlined, EditOutlined, CheckCircleOutlined } from '@ant-design/icons';
import tasksApi from '../../../services/tasksApi';
import dayjs from 'dayjs';

const { Text } = Typography;

const INCIDENT_STATUSES = ['OPEN', 'RESOLVED', 'WAIVED'];
const COMM_STATUSES = ['NOT_REQUIRED', 'PENDING', 'APPROVED', 'SENT'];

function OosFollowupsTab({ task, activeRun, canManage }) {
  const { message } = App.useApp();
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingIncident, setEditingIncident] = useState(null);
  const [form] = Form.useForm();
  const [error, setError] = useState(null);

  const taskInstanceId = task?.Id;

  const loadIncidents = useCallback(async () => {
    if (!taskInstanceId || !activeRun) return;
    setLoading(true);
    try {
      const res = await tasksApi.getAffectedAsins(taskInstanceId, { runId: activeRun, incidentOnly: true });
      if (res.success) setIncidents(res.data?.incidents || res.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [activeRun, taskInstanceId]);

  useEffect(() => {
    if (!activeRun) return undefined;
    const timer = setTimeout(() => { loadIncidents(); }, 0);
    return () => clearTimeout(timer);
  }, [activeRun, loadIncidents]);

  const openEdit = (incident) => {
    setEditingIncident(incident);
    form.setFieldsValue({
      ownerId: incident.OwnerId,
      ownerName: incident.OwnerName,
      communicationStatus: incident.CommunicationStatus,
      nextAction: incident.NextAction,
      etaDate: incident.EtaDate ? dayjs(incident.EtaDate) : null,
      followUpDate: incident.FollowUpDate ? dayjs(incident.FollowUpDate) : null,
      remarks: incident.Remarks,
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      const payload = {
        ...values,
        etaDate: values.etaDate ? values.etaDate.format('YYYY-MM-DD') : null,
        followUpDate: values.followUpDate ? values.followUpDate.format('YYYY-MM-DD') : null,
      };
      await tasksApi.updateIncident(taskInstanceId, editingIncident.Id, payload);
      message.success('Incident updated');
      setModalOpen(false);
      loadIncidents();
    } catch (err) {
      message.error(err.message || 'Failed to update');
    }
  };

  const columns = [
    { title: 'ASIN', dataIndex: 'AsinCode', key: 'asin', width: 140 },
    { title: 'Channel', dataIndex: 'Channel', key: 'channel', width: 100, render: v => <Tag size="small">{v}</Tag> },
    { title: 'Status', dataIndex: 'Status', key: 'status', width: 100, render: v => <Tag color={v === 'OPEN' ? 'red' : v === 'RESOLVED' ? 'green' : 'gold'}>{v}</Tag> },
    { title: 'Owner', key: 'owner', render: (_, r) => r.OwnerName || r.OwnerId || <Text type="danger">Missing</Text> },
    { title: 'Communication', dataIndex: 'CommunicationStatus', key: 'comm', render: v => v ? <Tag>{v}</Tag> : <Text type="danger">Missing</Text> },
    { title: 'Next Action', dataIndex: 'NextAction', key: 'next', ellipsis: true },
    { title: 'ETA', dataIndex: 'EtaDate', key: 'eta', render: v => v ? dayjs(v).format('DD MMM YYYY') : <Text type="danger">Missing</Text> },
    { title: 'Follow-up', dataIndex: 'FollowUpDate', key: 'follow', render: v => v ? dayjs(v).format('DD MMM YYYY') : <Text type="danger">Missing</Text> },
    {
      title: 'Actions', key: 'actions', width: 150,
      render: (_, r) => (
        <Space size={4}>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} disabled={!canManage}>Edit</Button>
          {r.Status === 'OPEN' && (
            <Popconfirm
              title="Resolve this incident?"
              onConfirm={() => setError('Resolve is not implemented yet.')}
              disabled={!canManage}
            >
              <Button size="small" danger icon={<CheckCircleOutlined />} disabled={!canManage}>Resolve</Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <Card size="small" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
        <Space>
          <Text strong>Run: {activeRun ? dayjs(activeRun).format('DD MMM YYYY') : 'Select a run'}</Text>
        </Space>
        <Space size={8}>
          <Button icon={<ReloadOutlined />} onClick={loadIncidents} loading={loading} disabled={!activeRun}>Refresh</Button>
        </Space>
      </div>

      <Table
        columns={columns}
        dataSource={incidents}
        rowKey="Id"
        loading={loading}
        pagination={false}
        size="small"
        bordered
        scroll={{ x: 1000 }}
        locale={{ emptyText: 'No open incidents for this run' }}
      />

      {error && <Alert type="error" message={error} onClose={() => setError(null)} style={{ marginTop: 12 }} />}

      <Modal
        open={modalOpen}
        title="Edit incident follow-up"
        onCancel={() => setModalOpen(false)}
        onOk={handleSave}
        confirmLoading={loading}
        okText="Save"
        okButtonProps={{ disabled: !canManage }}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="ownerName" label="Owner"><Input placeholder="Incident owner" /></Form.Item>
          <Form.Item name="communicationStatus" label="Communication">
            <Select options={COMM_STATUSES.map(value => ({ value, label: value }))} />
          </Form.Item>
          <Form.Item name="nextAction" label="Next action"><Input placeholder="Next action" /></Form.Item>
          <Form.Item name="etaDate" label="ETA"><DatePicker style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="followUpDate" label="Follow-up"><DatePicker style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="remarks" label="Remarks"><Input.TextArea rows={2} /></Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}

export default OosFollowupsTab;