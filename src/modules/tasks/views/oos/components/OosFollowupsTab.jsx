import React, { useState, useEffect, useCallback } from 'react';
import { Card, Table, Tag, Space, Button, Alert, Empty, Spin, Modal, Form, Input, Select, DatePicker, Tooltip, Popconfirm } from 'antd';
import { ReloadOutlined, UserOutlined, EditOutlined, CheckCircleOutlined, ExclamationCircleOutlined, CalendarOutlined, SendOutlined } from '@ant-design/icons';
import { useAuth } from '../../../../../../contexts/AuthContext';
import tasksApi from '../../../../../../services/tasksApi';
import dayjs from 'dayjs';

const INCIDENT_STATUSES = ['OPEN', 'RESOLVED', 'WAIVED'];
const COMM_STATUSES = ['NOT_REQUIRED', 'PENDING', 'APPROVED', 'SENT'];

function OosFollowupsTab({ task, activeRun, canManage }) {
  const { hasPermission, isAdmin, isGlobalUser } = useAuth();
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingIncident, setEditingIncident] = useState(null);
  const [form] = Form.useForm();
  const [error, setError] = useState(null);

  const runId = activeRun;
  const taskInstanceId = task?.Id;

  const loadIncidents = useCallback(async () => {
    if (!activeRun) return;
    setLoading(true);
    try {
      const res = await tasksApi.getAffectedAsins(task.Id, { runId: activeRun, incidentOnly: true });
      if (res.success) setIncidents(res.data?.incidents || res.data || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [activeRun, task.Id]);

  useEffect(() => { if (activeRun) loadIncidents(); }, [activeRun, loadIncidents]);

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
      await tasksApi.updateIncident(task.Id, editingIncident.Id, payload);
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
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)}>Edit</Button>
          {r.Status === 'OPEN' && (
            <Popconfirm title="Resolve this incident?" onConfirm={() => setError('Resolve not implemented')}>
              <Button size="small" danger icon={<CheckCircleOutlined />}>Resolve</Button>
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
        rowKey="Id"
        locale={{ emptyText: 'No open incidents for this run' }}
      />
    </Card>
  );
}

export default OosFollowupsTab;