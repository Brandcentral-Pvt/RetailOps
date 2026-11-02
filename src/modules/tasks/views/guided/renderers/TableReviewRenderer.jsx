import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, Table, Tag, Typography, Space, Alert, Button, Input, Popconfirm, Spin, Tooltip, Modal } from 'antd';
import { ReloadOutlined, EditOutlined, CheckCircleOutlined, ExclamationCircleOutlined, DownloadOutlined, SearchOutlined, FilterOutlined } from '@ant-design/icons';
import { useAuth } from '../../../../../contexts/AuthContext';
import tasksApi from '../../../services/tasksApi';

const { Text } = Typography;

/**
 * TABLE_REVIEW renderer - ASINs, listings or discrepancies review
 * Interactive table with inline editing, row actions, and bulk operations
 */
export default function TableReviewRenderer({ activity, task, onOutputChange, readOnly }) {
  const { hasPermission, isAdmin, isGlobalUser } = useAuth();
  const canEdit = !readOnly && (isAdmin || isGlobalUser || hasPermission('tasks_execute'));
  const canManage = isAdmin || isGlobalUser || hasPermission('tasks_manage');
  
  const tableConfig = activity.tableConfig || {};
  const [tableData, setTableData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 50, total: 0 });
  const [filters, setFilters] = useState({});
  const [sorter, setSorter] = useState({});
  const [selectedRows, setSelectedRows] = useState([]);
  const [editingRow, setEditingRow] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalData, setModalData] = useState(null);
  
  const loadData = useCallback(async () => {
    if (!tableConfig.endpoint) return;
    setLoading(true);
    setError(null);
    try {
      const params = {
        ...tableConfig.params,
        taskInstanceId: task.Id,
        page: pagination.current,
        pageSize: pagination.pageSize,
        ...filters,
        sortBy: sorter.field,
        sortOrder: sorter.order,
      };
      const res = await tasksApi.getInstances(params);
      if (res.success) {
        setTableData(res.data || res.rows || []);
        setPagination(prev => ({ ...prev, total: res.pagination?.total || 0 }));
      }
    } catch (err) {
      setError(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [task.Id, tableConfig.endpoint, tableConfig.params, pagination.current, pagination.pageSize, filters, sorter]);
  
  useEffect(() => {
    loadData();
  }, [loadData]);
  
  const handleTableChange = useCallback((newPagination, newFilters, newSorter) => {
    setPagination(prev => ({ ...prev, current: newPagination.current, pageSize: newPagination.pageSize }));
    setFilters(newFilters);
    setSorter(newSorter);
  }, []);
  
  const handleRowEdit = (record) => {
    if (!canEdit) return;
    setEditingRow(record);
  };
  
  const handleSaveEdit = async (record) => {
    if (!tableConfig.onRowSave) return;
    try {
      await tableConfig.onRowSave(record, task.Id);
      await onOutputChange({ ...activity.outputValue, lastEdited: record.id, editedAt: new Date().toISOString() });
      setEditingRow(null);
      loadData();
    } catch (err) {
      setError(err.message || 'Save failed');
    }
  };
  
  const handleBulkAction = async (action) => {
    if (!tableConfig.bulkActions || !tableConfig.bulkActions[action]) return;
    if (selectedRows.length === 0) return;
    try {
      await tableConfig.bulkActions[action](selectedRows, task.Id);
      loadData();
      setSelectedRows([]);
    } catch (err) {
      setError(err.message || 'Bulk action failed');
    }
  };
  
const columns = useMemo(() => {
    const baseColumns = (tableConfig.columns || []).map(col => ({
      ...col,
      render: col.render || ((value, record) => {
        if (col.editable && editingRow?.id === record.id) {
          return (
            <Input
              value={record[col.dataIndex] || ''}
              onChange={e => {
                const updated = { ...record, [col.dataIndex]: e.target.value };
                setEditingRow(updated);
              }}
              style={{ width: '100%' }}
              size="small"
              autoFocus
              onBlur={() => handleSaveEdit({ ...record, [col.dataIndex]: record[col.dataIndex] })}
              onPressEnter={() => handleSaveEdit({ ...record, [col.dataIndex]: record[col.dataIndex] })}
            />
          );
        }
        return value;
      }),
    }));

    // Add action column if editable or has actions
    if (canEdit || tableConfig.actions) {
      baseColumns.push({
        title: 'Actions',
        key: 'actions',
        width: 120,
        align: 'center',
        render: (_, record) => {
          const actions = [];
          if (canEdit && tableConfig.editable) {
            actions.push(
              <Tooltip key="edit" title="Edit">
                <Button size="small" type="text" icon={<EditOutlined />} onClick={() => handleRowEdit(record)} />
              </Tooltip>
            );
          }
          if (tableConfig.actions?.view) {
            actions.push(
              <Tooltip key="view" title="View">
                <Button size="small" type="text" onClick={() => { setModalData(record); setModalVisible(true); }}>
                  <SearchOutlined />
                </Button>
              </Tooltip>
            );
          }
          if (tableConfig.actions?.resolve && record.status === 'OPEN' && canManage) {
            actions.push(
              <Popconfirm key="resolve" title="Resolve this item?" onConfirm={() => tableConfig.actions.resolve(record, task.Id).then(loadData)} okText="Yes" cancelText="No">
                <Button size="small" danger type="text" icon={<CheckCircleOutlined />}>Resolve</Button>
              </Popconfirm>
            );
          }
          return <Space size={4}>{actions}</Space>;
        },
      });
    }

    return baseColumns;
  }, [canEdit, canManage, tableConfig, editingRow]);
  
  return (
    <Card size="small" style={{ width: '100%', display: 'flex', flexDirection: 'column', height: '100%' }}>
      {activity.instructions && (
        <Alert
          message={activity.title}
          description={activity.instructions}
          type="info"
          showIcon
          style={{ marginBottom: 12 }}
        />
      )}
      
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <Space>
          <Text strong>{activity.title}</Text>
          {tableConfig.showCount && <Tag color="blue">{pagination.total} records</Tag>}
        </Space>
        <Space size={8}>
          {tableConfig.bulkActions && selectedRows.length > 0 && (
            <Space size={4}>
              {Object.keys(tableConfig.bulkActions).map(action => (
                <Button key={action} size="small" onClick={() => handleBulkAction(action)}>{action}</Button>
              ))}
            </Space>
          )}
          <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading} size="small">Refresh</Button>
        </Space>
      </div>
      
      {error && <Alert type="error" message={error} onClose={() => setError(null)} style={{ marginBottom: 12 }} />}
      
      <div style={{ flex: 1, overflow: 'auto', minHeight: 300 }}>
        {loading && tableData.length === 0 ? (
          <Spin size="large" style={{ padding: 24 }} />
        ) : (
          <Table
            columns={columns}
            dataSource={tableData}
            rowKey={tableConfig.rowKey || 'id'}
            loading={loading}
            pagination={pagination.total > pagination.pageSize ? {
              current: pagination.current,
              pageSize: pagination.pageSize,
              total: pagination.total,
              showSizeChanger: true,
              pageSizeOptions: ['10', '25', '50', '100'],
              onChange: (page, pageSize) => setPagination(prev => ({ ...prev, current: page, pageSize })),
            } : false}
            rowSelection={{
              selectedRowKeys: selectedRows,
              onChange: setSelectedRows,
            }}
            onChange={handleTableChange}
            size="small"
            bordered
            scroll={{ x: tableConfig.scrollX || true }}
            locale={{ emptyText: 'No records found' }}
          />
        )}
      </div>
      
      {modalVisible && modalData && (
        <Modal
          open={true}
          title="Record Details"
          onCancel={() => setModalVisible(false)}
          width={800}
        >
          <Descriptions size="small" column={2}>
            {Object.entries(modalData).map(([key, value]) => (
              <Descriptions.Item key={key} label={key}>
                <Text code>{typeof value === 'object' ? JSON.stringify(value, null, 2) : value}</Text>
              </Descriptions.Item>
            ))}
          </Descriptions>
        </Modal>
      )}
      
      {!canEdit && <Text type="secondary" style={{ fontSize: 11, marginTop: 8 }}>Read-only mode</Text>}
    </Card>
  );
}