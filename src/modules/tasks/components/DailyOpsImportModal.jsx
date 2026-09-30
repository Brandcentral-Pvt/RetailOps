import React, { useState, useMemo } from 'react';
import { Modal, Upload, Button, Table, Tag, Alert, Switch, Input, InputNumber, Space, Typography, Tooltip, App } from 'antd';
import { InboxOutlined, CheckCircleOutlined, ThunderboltOutlined } from '@ant-design/icons';
import * as XLSX from 'xlsx';
import tasksApi from '../services/tasksApi';
import { PRIORITIES } from '../constants';

const { Text } = Typography;
const { Dragger } = Upload;

/** Read a CSV/XLSX file into an array of rows (the server finds the header row itself). */
async function readSheet(file) {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array', cellDates: false });
  const ws = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: false, blankrows: false });
}

/**
 * Import the Daily Operations Master: upload → preview (nothing saved) → adjust → import.
 * Re-importing the same sheet updates the templates in place and keeps their routine settings.
 */
export default function DailyOpsImportModal({ open, onClose, onDone }) {
  const { message } = App.useApp();
  const [rows, setRows] = useState(null);
  const [fileName, setFileName] = useState('');
  const [preview, setPreview] = useState(null);
  const [overrides, setOverrides] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const reset = () => { setRows(null); setFileName(''); setPreview(null); setOverrides({}); setError(''); };
  const close = () => { reset(); onClose(); };

  const setOv = (code, patch) => setOverrides(o => ({ ...o, [code]: { ...(o[code] || {}), ...patch } }));

  const runPreview = async (r, ov = overrides) => {
    setBusy(true); setError('');
    try { setPreview(await tasksApi.importDailyOps({ rows: r, overrides: ov, dryRun: true })); }
    catch (e) { setError(e.message); setPreview(null); }
    finally { setBusy(false); }
  };

  const onFile = async (file) => {
    try {
      const r = await readSheet(file);
      setRows(r); setFileName(file.name); setOverrides({});
      await runPreview(r, {});
    } catch (e) { setError(`Could not read the file: ${e.message}`); }
    return false; // never auto-upload
  };

  const doImport = async () => {
    setBusy(true);
    try {
      const res = await tasksApi.importDailyOps({ rows, overrides, dryRun: false, generateNow: true });
      message.success(`${res.created} created, ${res.updated} updated${res.generatedToday ? ` · ${res.generatedToday} tasks generated for today` : ''}`);
      onDone?.(res); reset(); onClose();
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };

  const view = useMemo(() => (preview?.templates || []).map(t => ({ ...t, ...(overrides[t.code] || {}) })), [preview, overrides]);
  const autoCount = view.filter(t => t.autoAssign).length;

  const columns = [
    { title: 'ID', dataIndex: 'code', width: 96, render: v => <Text code>{v}</Text> },
    {
      title: 'Task', dataIndex: 'name',
      render: (v, t) => (
        <div>
          <div style={{ fontWeight: 600 }}>{v}</div>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {t.subTaskCount} sub-tasks · {t.activityCount} steps · {t.owner}
            {t.scheduledSubTasks?.length ? ` · ${t.scheduledSubTasks.length} not daily` : ''}
          </Text>
        </div>
      ),
    },
    {
      title: 'Priority', dataIndex: 'priority', width: 104,
      render: (v, t) => <Tooltip title={`Sheet says ${t.sourcePriority || '—'}`}><Tag color={PRIORITIES[v]?.color ? undefined : 'default'} style={{ color: PRIORITIES[v]?.color, background: PRIORITIES[v]?.bg, border: 'none' }}>{PRIORITIES[v]?.label || v}</Tag></Tooltip>,
    },
    {
      title: 'Create daily', dataIndex: 'autoAssign', width: 100,
      render: (v, t) => <Switch size="small" checked={!!v} onChange={c => setOv(t.code, { autoAssign: c })} />,
    },
    {
      title: 'Due by', dataIndex: 'dueTime', width: 92,
      render: (v, t) => <Input size="small" value={v} maxLength={5} style={{ width: 70 }} disabled={!t.autoAssign} onChange={e => setOv(t.code, { dueTime: e.target.value })} />,
    },
    {
      title: 'Est. min', dataIndex: 'estimatedExecutionMinutes', width: 92,
      render: (v, t) => <InputNumber size="small" min={5} max={480} value={v} style={{ width: 66 }} onChange={n => setOv(t.code, { estimatedExecutionMinutes: n })} />,
    },
    { title: '', dataIndex: 'action', width: 70, render: v => <Tag color={v === 'create' ? 'green' : 'blue'}>{v === 'create' ? 'New' : 'Update'}</Tag> },
  ];

  return (
    <Modal open={open} onCancel={close} width={960} destroyOnHidden
      title={<span><ThunderboltOutlined /> Import Daily Operations Master</span>}
      footer={preview ? (
        <Space>
          <Button onClick={reset}>Choose another file</Button>
          <Button onClick={() => runPreview(rows)} loading={busy}>Re-check</Button>
          <Button type="primary" icon={<CheckCircleOutlined />} loading={busy} onClick={doImport} disabled={!view.length}>
            Import {view.length} templates{autoCount ? ` · start ${autoCount} daily` : ''}
          </Button>
        </Space>
      ) : <Button onClick={close}>Cancel</Button>}>
      {!preview && (
        <Dragger accept=".csv,.xlsx,.xls" multiple={false} showUploadList={false} beforeUpload={onFile} disabled={busy}>
          <p className="ant-upload-drag-icon"><InboxOutlined /></p>
          <p className="ant-upload-text">Drop the Daily Operations Master (CSV or Excel) here</p>
          <p className="ant-upload-hint">You'll see exactly what will be created before anything is saved.</p>
        </Dragger>
      )}
      {error && <Alert type="error" showIcon message={error} style={{ marginTop: 12 }} />}
      {preview && (
        <>
          <Alert type="info" showIcon style={{ marginBottom: 12 }}
            message={`${fileName}: ${view.length} tasks found`}
            description={<>
              Each task becomes a template. "Create daily" tasks are generated every Mon–Sat for everyone in the owning role, due by the time shown;
              steps marked weekly/Monday etc. only appear on those days. Tasks that depend on need (priority-based, catalogue optimisation) are left off — switch them on if you want them daily.
              Re-importing updates the templates and keeps your settings.
            </>} />
          {preview.warnings?.length > 0 && (
            <Alert type="warning" showIcon style={{ marginBottom: 12 }} message={`${preview.warnings.length} things to check`}
              description={<ul style={{ margin: 0, paddingLeft: 18 }}>{preview.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>} />
          )}
          <Table size="small" rowKey="code" columns={columns} dataSource={view} pagination={false} scroll={{ y: 360 }}
            expandable={{
              rowExpandable: t => t.scheduledSubTasks?.length > 0,
              expandedRowRender: t => (
                <div style={{ fontSize: 12 }}>
                  {t.scheduledSubTasks.map((s, i) => <div key={i}><Tag>{s.runs}</Tag>{s.title}</div>)}
                </div>
              ),
            }} />
        </>
      )}
    </Modal>
  );
}
