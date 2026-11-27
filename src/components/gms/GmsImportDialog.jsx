import React, { useEffect, useRef, useState } from 'react';
import { Alert, Button, Divider, Modal, Progress, Space, Table, Tag, Typography, Upload } from 'antd';
import { UploadOutlined, ReloadOutlined, DownloadOutlined } from '@ant-design/icons';
import { gmsApi } from '../../services/api';

const colors = { READY: 'blue', REJECTED: 'red', QUEUED: 'processing', COMPLETED: 'green', FAILED: 'red', EXPIRED: 'default', CANCELLED: 'default' };
const formatDate = value => value ? new Date(value).toLocaleString('en-IN') : '-';
const count = value => Number(value || 0).toLocaleString('en-IN');
const maxBytes = 25 * 1024 * 1024;

export default function GmsImportDialog({ open, onClose, onCommitted }) {
  const [file, setFile] = useState(null);
  const [job, setJob] = useState(null);
  const [history, setHistory] = useState([]);
  const [busy, setBusy] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState(null);
  const lock = useRef(false);
  const onCommittedRef = useRef(onCommitted);
  const notified = useRef(new Set());
  useEffect(() => { onCommittedRef.current = onCommitted; }, [onCommitted]);

  function store(next) {
    setJob(next);
    if (next?.id) setHistory(prev => [next, ...prev.filter(j => j.id !== next.id)].slice(0,50));
  }
  async function refreshHistory(signal) {
    setHistoryLoading(true);
    try {
      const result = await gmsApi.listImports({ signal });
      if (!signal?.aborted) {
        setHistory(Array.isArray(result.data) ? result.data : []);
      }
    } catch (err) {
      if (!signal?.aborted) setError(err.message);
    } finally {
      if (!signal?.aborted) setHistoryLoading(false);
    }
  }
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    refreshHistory(controller.signal);
    return () => controller.abort();
  }, [open]);

  // SQL persists queued work across page closes or server restarts. Poll only
  // while the dialog is visible; reopening the history resumes inspection.
  useEffect(() => {
    if (!open || !job?.id || job.status !== 'QUEUED') return;
    const controller = new AbortController();
    let timer;
    async function poll() {
      try {
        const result = await gmsApi.getImport(job.id, { signal: controller.signal });
        if (controller.signal.aborted) return;
        store(result.data);
        setError('');
        if (result.data?.status === 'QUEUED') timer = setTimeout(poll, 2500);
      } catch (err) {
        if (!controller.signal.aborted) {
          setError('Status check failed. The import may still be queued. ' + err.message);
          timer = setTimeout(poll, 5000);
        }
      }
    }
    timer = setTimeout(poll, 1000);
    return () => { controller.abort(); clearTimeout(timer); };
  }, [open, job?.id, job?.status]);
  useEffect(() => {
    if (!open || job?.status !== 'COMPLETED' || notified.current.has(job.id)) return;
    notified.current.add(job.id);
    onCommittedRef.current?.();
  }, [open, job?.id, job?.status]);

  async function run(action) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError('');
    try { await action(); }
    catch (err) { setError(err.message || 'GMS import request failed'); }
    finally { lock.current = false; setBusy(false); setProgress(null); }
  }
  function selectFile(next) {
    if (lock.current) return Upload.LIST_IGNORE;
    if (!/\.(csv|xlsx|xls)$/i.test(next.name) || !next.size || next.size > maxBytes) {
      setError('Choose a non-empty CSV or Excel report up to 25 MB.');
      return Upload.LIST_IGNORE;
    }
    setFile(next);
    setJob(null);
    setError('');
    return false;
  }
  async function validate() {
    if (!file) return;
    await run(async () => {
      setProgress(0);
      const result = await gmsApi.previewImport(file, setProgress);
      store(result.data);
      setFile(null);
    });
  }
  function confirm() {
    if (job?.status !== 'READY') return;
    return run(async () => store((await gmsApi.confirmImport(job.id)).data));
  }
  function cancel() {
    if (!job || !['READY','QUEUED'].includes(job.status)) return;
    return run(async () => store((await gmsApi.cancelImport(job.id)).data));
  }
  function inspect(id) {
    return run(async () => {
      const result = await gmsApi.getImport(id);
      setFile(null);
      store(result.data);
    });
  }
  function downloadIssues() {
    const blob = new Blob([JSON.stringify({ id: job.id, fileName: job.fileName, invalid: job.summary.invalid, issues: job.summary.issues }, null, 2)], { type:'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'gms-validation-' + job.id + '.json';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const summary = job?.summary;
  return (
    <Modal open={open} onCancel={onClose} title="GMS Report Import" width={900}
      footer={<Button onClick={onClose} disabled={busy}>Close</Button>} closable={!busy} mask={{closable:!busy}}>
      <Space direction="vertical" size="middle" style={{ width:'100%' }}>
        <Alert type="info" showIcon title="Validate before importing"
          description="Amazon India daily reports only. CSV, XLS or XLSX; maximum 25 MB and 100,000 data rows per report. No revenue is changed until a valid preview is confirmed." />
        {error && <Alert type="error" showIcon title={error} />}
        <Upload.Dragger accept=".csv,.xlsx,.xls" beforeUpload={selectFile} maxCount={1} disabled={busy}
          fileList={file ? [file] : []} onRemove={() => {setFile(null);return true;}}>
          <p><UploadOutlined style={{fontSize:26}} /></p>
          <p>Select or drop a GMS report</p>
          <Typography.Text type="secondary">Required: ASIN, Date, Brand, StoreCode, Ordered Revenue, Ordered Units, Shipped Revenue, Shipped COGS, Shipped Units, Customer Returns</Typography.Text>
        </Upload.Dragger>
        <Space>
          <Button type="primary" onClick={validate} loading={busy && progress !== null} disabled={!file || busy}>Validate report</Button>
          {file && <Typography.Text ellipsis>{file.name}</Typography.Text>}
        </Space>
        {progress !== null && <div><Progress percent={progress} status="active" /><Typography.Text type="secondary">{progress===100?'Validating report on server...':'Uploading report...'}</Typography.Text></div>}
        {job && summary && (
          <>
            <Divider style={{margin:'8px 0'}} />
            <Space wrap><Typography.Text strong>{job.fileName}</Typography.Text><Tag color={colors[job.status]}>{job.status}</Tag></Space>
            <Space wrap size={[8,8]}>
              {[
                ['Source rows',summary.total],['New',summary.inserted],['Updates',summary.updated],
                ['Unchanged',summary.unchanged],['Identical duplicates',summary.duplicates],['Validation issues',summary.invalid]
              ].map(([label,value])=><Tag key={label}>{label}: {count(value)}</Tag>)}
            </Space>
            {job.status==='READY' && <Alert type={summary.updated?'warning':'success'} showIcon title="Validation passed"
              description={summary.updated ? 'Confirmation will replace existing records only where verified seller and store match. Changes since preview will block the import.' : 'No conflicts found. Confirm to queue the import.'}/>}
            {job.status==='REJECTED' && <Alert type="error" showIcon title="Report rejected" description="Correct the listed issues and upload a new file. No records were changed." />}
            {job.status==='QUEUED' && <Alert type="info" showIcon title="Import queued or committing" description="The server rechecks permissions and the validated snapshot. You may close this window and reopen import history later." />}
            {job.status==='COMPLETED' && <Alert type="success" showIcon title="Import completed" description={count(summary.committed)+' records inserted or updated; '+count(summary.unchanged)+' unchanged.'}/>}
            {job.status==='FAILED' && <Alert type="error" showIcon title="Import failed" description={summary.failure || 'Validate a new batch before retrying.'}/>}
            {summary.sample?.length>0 && (
              <Table size="small" rowKey="row" pagination={false} scroll={{x:650,y:180}} dataSource={summary.sample}
                columns={[
                  {title:'Row',dataIndex:'row'}, {title:'ASIN',dataIndex:'asin'}, {title:'Date',dataIndex:'date'},
                  {title:'Store',dataIndex:'storeCode'}, {title:'Ordered revenue',dataIndex:'orderedRevenue'}, {title:'Units',dataIndex:'orderedUnits'}, {title:'Action',dataIndex:'action'}
                ]}/>
            )}
            {summary.issues?.length>0 && (
              <>
                <Space wrap><Typography.Text strong>Validation issues (first {summary.issues.length})</Typography.Text><Button size="small" icon={<DownloadOutlined/>} onClick={downloadIssues}>Download issue report</Button></Space>
                <Table size="small" rowKey={(_,i)=>i} pagination={{pageSize:5,hideOnSinglePage:true}} dataSource={summary.issues}
                  columns={[{title:'Row',dataIndex:'row',width:70},{title:'Code',dataIndex:'code',width:180},{title:'Issue',dataIndex:'message'}]}/>
              </>
            )}
            <Space wrap>
              {job.status==='READY' && <Button type="primary" loading={busy} onClick={confirm}>Confirm import</Button>}
              {['READY','QUEUED'].includes(job.status) && <Button danger disabled={busy} onClick={cancel}>Cancel batch</Button>}
            </Space>
          </>
        )}
        <Divider style={{margin:'8px 0'}} />
        <Space><Typography.Text strong>My import history</Typography.Text><Button size="small" icon={<ReloadOutlined/>} loading={historyLoading} disabled={busy} onClick={()=>refreshHistory()}>Refresh history</Button></Space>
        <Table size="small" rowKey="id" dataSource={history} loading={historyLoading} pagination={{pageSize:5,hideOnSinglePage:true}}
          scroll={{x:630}} columns={[
            {title:'Report',dataIndex:'fileName',ellipsis:true},
            {title:'Status',dataIndex:'status',render:value=><Tag color={colors[value]}>{value}</Tag>},
            {title:'Created',dataIndex:'createdAt',render:formatDate},
            {title:'Records',render:(_,item)=>count(item.summary?.total)},
            {title:'Action',render:(_,item)=><Button type="link" size="small" disabled={busy} onClick={()=>inspect(item.id)}>View</Button>}
          ]}/>
      </Space>
    </Modal>
  );
}
