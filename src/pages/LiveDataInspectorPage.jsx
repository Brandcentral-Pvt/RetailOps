import { Spinner } from "@/components/Spinner";
import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Table, Tag, Typography, Space, Spin, Button, Checkbox, Input, Empty, Select, message, Divider } from 'antd';
import { ReloadOutlined, DownloadOutlined, SearchOutlined, ThunderboltOutlined, TableOutlined } from '@ant-design/icons';
import * as XLSX from 'xlsx';

const { Text } = Typography;
const API_BASE = import.meta.env?.VITE_API_URL || '/api';

const authHeaders = (extra) => {
  const token = localStorage.getItem('authToken');
  return token ? { Authorization: `Bearer ${token}`, ...extra } : { ...extra };
};

export default function LiveDataInspectorPage() {
  const [metrics, setMetrics] = useState([]);
  const [selectedMetrics, setSelectedMetrics] = useState([]);
  const [asinInput, setAsinInput] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [lastFetch, setLastFetch] = useState(null);

  useEffect(() => {
    fetch(`${API_BASE}/live-data/metrics`, { headers: authHeaders() }).then(r => r.json()).then(r => {
      if (r.success) { setMetrics(r.data); setSelectedMetrics(r.data.map(m => m.key)); }
    }).catch(() => {});
  }, []);

  const handleFetch = async () => {
    const asins = asinInput.split(/[\n,]+/).map(a => a.trim()).filter(a => a.length > 0);
    if (asins.length === 0) { message.warning('Enter at least one ASIN'); return; }
    if (selectedMetrics.length === 0) { message.warning('Select at least one metric'); return; }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/live-data/v2/fetch`, {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ asins, metrics: selectedMetrics }),
      }).then(r => r.json());

      if (res.success) {
        setResults(res.data || []);
        setLastFetch(new Date());
        message.success(`Fetched data for ${res.total} ASINs`);
      } else {
        message.error(res.error || 'Failed to fetch data');
      }
    } catch (err) {
      message.error('Failed to fetch live data');
    } finally { setLoading(false); }
  };

  const handleExport = () => {
    if (results.length === 0) { message.warning('No data to export'); return; }
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(results);
    XLSX.utils.book_append_sheet(wb, ws, 'Live Data');
    XLSX.writeFile(wb, `live_data_${new Date().toISOString().split('T')[0]}.xlsx`);
    message.success('Exported to Excel');
  };

  const columns = [
    { title: 'ASIN', dataIndex: 'asin', key: 'asin', width: 120, render: (v) => <Text code style={{ fontSize: 10 }}>{v}</Text> },
    { title: 'Seller', dataIndex: 'seller', key: 'seller', width: 160 },
    ...selectedMetrics.map(key => {
      const m = metrics.find(x => x.key === key);
      const renderValue = (v) => {
        if (v === null || v === undefined) return <Text type="secondary">-</Text>;
        if (key === 'mainImage') return <a href={v} target="_blank" rel="noreferrer"><img src={v} alt="main" onError={(e) => { e.target.style.visibility = 'hidden'; }} style={{ width: 34, height: 34, objectFit: 'contain', border: '1px solid #e2e8f0', borderRadius: 6, background: '#fff' }} /></a>;
        if (key === 'lqsGrade') {
          const color = { A: '#059669', B: '#2563eb', C: '#d97706', D: '#dc2626' }[String(v)] || '#6b7280';
          return <Tag color={color} style={{ fontSize: 10, fontWeight: 600 }}>{v}</Tag>;
        }
        if (key === 'mainImageBackground') {
          const color = v === 'White' ? 'green' : v === 'Possibly non-white' ? 'orange' : v === 'Non-white' ? 'red' : 'default';
          return <Tag color={color} style={{ fontSize: 10 }}>{v}</Tag>;
        }
        return <Text style={{ fontSize: 'var(--font-size-xs)' }}>{String(v)}</Text>;
      };
      return {
        title: m?.label || key,
        dataIndex: key,
        key,
        width: key === 'title' || key === 'lqsIssues' ? 220 : key === 'mainImage' ? 50 : 100,
        render: renderValue,
      };
    }),
  ];

  return (
    <div style={{ background: '#f8fafc', minHeight: '100%', padding: '0 24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 0', marginBottom: 16 }}>
        <Space>
          <ThunderboltOutlined style={{ fontSize: 'var(--font-size-xl)', color: '#2563eb' }} />
          <div>
            <Text strong style={{ fontSize: 18 }}>Live Data Inspector</Text>
            <Text style={{ fontSize: 'var(--font-size-sm)', color: '#94a3b8', display: 'block' }}>Fetch real-time data from Amazon Creators API</Text>
          </div>
        </Space>
        <Space>
          {results.length > 0 && <Button icon={<DownloadOutlined />} onClick={handleExport} size="small">Export ({results.length} rows)</Button>}
          {lastFetch && <Text style={{ fontSize: 'var(--font-size-xs)', color: '#94a3b8' }}>Last fetch: {lastFetch.toLocaleTimeString()}</Text>}
        </Space>
      </div>

      <Row gutter={[16, 16]}>
        {/* Left: Input */}
        <Col xs={24} md={10}>
          <Card size="small" title="ASIN Input" style={{ borderRadius: 10 }}>
            <div style={{ marginBottom: 12 }}>
              <Text style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, display: 'block', marginBottom: 4 }}>Enter ASINs (one per line or comma-separated)</Text>
              <Input.TextArea
                rows={6}
                value={asinInput}
                onChange={e => setAsinInput(e.target.value)}
                placeholder={"B08FGPZNR6\nB09R9BGH3P\nB0D44SP9D7"}
                style={{ borderRadius: "var(--radius-md)", fontFamily: 'monospace', fontSize: 'var(--font-size-sm)' }}
              />
              <Text style={{ fontSize: 10, color: '#94a3b8', marginTop: 4 }}>
                {asinInput.split(/[\n,]+/).filter(a => a.trim()).length} ASINs entered
              </Text>
            </div>

            <Button type="primary" block onClick={handleFetch} loading={loading} icon={<ThunderboltOutlined />}
              style={{ borderRadius: "var(--radius-md)", fontWeight: 600, marginBottom: 12 }}>
              Fetch Live Data
            </Button>

            {/* Metrics Selection */}
            <Text style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, display: 'block', marginBottom: 6 }}>Select Metrics to Fetch</Text>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 300, overflow: 'auto' }}>
              <div style={{ padding: '4px 8px', borderRadius: 6, background: '#f8fafc', cursor: 'pointer', border: '1px solid #e5e7eb' }}
                onClick={() => setSelectedMetrics(selectedMetrics.length === metrics.length ? [] : metrics.map(m => m.key))}>
                <Checkbox checked={selectedMetrics.length === metrics.length} indeterminate={selectedMetrics.length > 0 && selectedMetrics.length < metrics.length}>
                  <Text style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600 }}>Select All ({selectedMetrics.length}/{metrics.length})</Text>
                </Checkbox>
              </div>
              {metrics.map(m => (
                <div key={m.key} style={{ padding: '4px 8px', borderRadius: 6, background: '#fff', border: '1px solid #e5e7eb', cursor: 'pointer' }}
                  onClick={() => setSelectedMetrics(prev => prev.includes(m.key) ? prev.filter(k => k !== m.key) : [...prev, m.key])}>
                  <Checkbox checked={selectedMetrics.includes(m.key)}>
                    <Text style={{ fontSize: 'var(--font-size-xs)' }}>{m.label}</Text>
                  </Checkbox>
                </div>
              ))}
            </div>
          </Card>
        </Col>

        {/* Right: Results */}
        <Col xs={24} md={14}>
          <Card size="small" title={<Space><TableOutlined /> Results {results.length > 0 && <Tag>{results.length}</Tag>}</Space>} style={{ borderRadius: 10 }}>
            {results.length === 0 ? (
              <Empty description="Enter ASINs and click Fetch to see results" style={{ padding: '40px 0' }} />
            ) : (
              <Table dataSource={results} columns={columns} rowKey="asin" size="small"
                pagination={results.length > 20 ? { pageSize: 20, showTotal: t => <Text type="secondary" style={{ fontSize: 'var(--font-size-xs)' }}>{t} rows</Text> } : false}
                scroll={{ x: 'max-content' }}
              />
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
}
