import React, { useEffect, useRef, useState } from 'react';
import { Alert, Button, Divider, Modal, Progress, Space, Table, Tag, Typography, Upload } from 'antd';
import { UploadOutlined, ReloadOutlined, DownloadOutlined } from '@ant-design/icons';
import { gmsApi } from '../../services/api';

const colors = { READY: 'blue', REJECTED: 'red', QUEUED: 'processing', COMPLETED: 'green', FAILED: 'red', EXPIRED: 'default', CANCELLED: 'default' };
const formatDate = value => value ? new Date(value).toLocaleString('en-IN') : '-';
const count = value => Number(value || 0).toLocaleString('en-IN');
const maxBytes = 100 * 1024 * 1024;

export default function GmsImportDialog({ open, onClose, onCommitted }) {
  const [file, setFile] = useState(null);
  const [job, setJob] = useState(null);
  const [history, setHistory] = useState([]);
  const [busy, setBusy] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState(null);
  const [downloading, setDownloading] = useState(null);
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
  // while this page is mounted; reopening history also resumes inspection.
  useEffect(() => {
    if (!job?.id || job.status !== 'QUEUED') return;
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
  }, [job?.id, job?.status]);
  useEffect(() => {
    if (job?.status !== 'COMPLETED' || notified.current.has(job.id)) return;
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
      setError('Choose a non-empty CSV or Excel report up to 100 MB.');
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
  async function downloadIssues(format) {
    if (!job?.id || downloading) return;
    setDownloading(format);
    setError('');
    try {
      const {blob,filename}=await gmsApi.downloadImportIssues(job.id,format);
      const url=URL.createObjectURL(blob);
      const link=document.createElement('a');
      link.href=url;
      link.download=filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(()=>URL.revokeObjectURL(url),1000);
    } catch(err) { setError(err.message || 'Unable to download the error report. Try again.'); }
    finally { setDownloading(null); }
  }
  const summary = job?.summary;
  return (
    <Modal open={open} onCancel={() => { if (!busy) onClose(); }} keyboard={!busy} title="GMS Report Import" width={900}
      footer={<Button onClick={onClose} disabled={busy}>Close</Button>} closable={!busy} mask={{closable:!busy}}>
      <Space direction="vertical" size="middle" style={{ width:'100%' }}>
        <Alert type="info" showIcon title="Validate before importing"
          description="Amazon India daily reports only. CSV, XLS or XLSX; maximum 100 MB and 500,000 data rows per report. Blank financial cells become zero; signed adjustments are preserved. Seller assignments are inherited automatically from RetailOps ASINs. No revenue is changed until a valid preview is confirmed." />
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
                ['Unchanged',summary.unchanged],['Matched ASINs',summary.matched],['Unmatched ASINs',summary.unmatched],['Identical duplicates',summary.duplicates],['Blank metrics → 0',summary.defaultedCells],['Negative-value rows',summary.negativeRows],['Validation issues',summary.invalid]
              ].map(([label,value])=><Tag key={label}>{label}: {count(value)}</Tag>)}
            </Space>
            {job.status==='READY' && <Alert type={summary.updated?'warning':'success'} showIcon title="Validation passed"
              description={summary.unmatched ? 'Unmatched ASIN revenue will be retained with Seller (DB) shown as a dash and the original sheet brand. Changes since preview will block the import.' : summary.updated ? 'Confirmation will update existing records under the validated ASIN/date and owner. Changes since preview will block the import.' : 'No conflicts found. Confirm to queue the import.'}/>}
            {job.status==='REJECTED' && <Alert type="error" showIcon title="Report rejected" description="Correct the listed issues and upload a new file. No records were changed." />}
            {job.status==='QUEUED' && <Alert type="info" showIcon title="Import queued or committing" description="The server rechecks permissions and the validated snapshot. You may close this window and reopen import history later." />}
            {job.status==='COMPLETED' && <Alert type="success" showIcon title="Import completed" description={count(summary.committed)+' records inserted or updated; '+count(summary.unchanged)+' unchanged.'}/>}
            {job.status==='FAILED' && <Alert type="error" showIcon title="Import failed" description={summary.failure || 'Validate a new batch before retrying.'}/>}
            {summary.sample?.length>0 && (
              <Table size="small" rowKey="row" pagination={false} scroll={{x:650,y:180}} dataSource={summary.sample}
                columns={[
                  {title:'Row',dataIndex:'row'}, {title:'ASIN',dataIndex:'asin'}, {title:'Date',dataIndex:'date'},
                  {title:'Brand (Sheet)',dataIndex:'brand'}, {title:'Mapping',dataIndex:'mappingStatus'}, {title:'Store',dataIndex:'storeCode'}, {title:'Ordered revenue',dataIndex:'orderedRevenue'}, {title:'Units',dataIndex:'orderedUnits'}, {title:'Action',dataIndex:'action'}
                ]}/>
            )}
            {(summary.issues?.length>0 || (job.status==='FAILED' && summary.failure)) && (
              <>
                <Space wrap>
                  <Typography.Text strong>Error report ({count(summary.reportIssueCount ?? summary.issues?.length ?? 1)} issue{(summary.reportIssueCount ?? summary.issues?.length ?? 1)===1?'':'s'})</Typography.Text>
                  <Button size="small" icon={<DownloadOutlined/>} loading={downloading==='xlsx'} disabled={busy||!!downloading} onClick={()=>downloadIssues('xlsx')}>Download Excel</Button>
                  <Button size="small" icon={<DownloadOutlined/>} loading={downloading==='csv'} disabled={busy||!!downloading} onClick={()=>downloadIssues('csv')}>Download CSV</Button>
                </Space>
                {summary.reportComplete!==true && <Alert type="warning" showIcon title="Older error report" description="Some ASIN details or errors may not have been saved in this older import. Validate the original file again for the complete report."/>}
                {summary.reportIssueCount>(summary.issues?.length||0)&&<Typography.Text type="secondary">Showing the first {summary.issues.length} issues here. The downloaded report includes every detected issue.</Typography.Text>}
                <Table size="small" rowKey={(row,index)=>String(row.row??'file')+'-'+String(index)} pagination={{pageSize:5,hideOnSinglePage:true}} dataSource={summary.issues||[]} scroll={{x:790}}
                  columns={[
                    {title:'Excel Row',dataIndex:'row',width:90,render:v=>v??'File'},
                    {title:'ASIN',dataIndex:'asin',width:130,render:v=>v||'-'},
                    {title:'Date',dataIndex:'date',width:110,render:v=>v||'-'},
                    {title:'Affected Column',dataIndex:'column',width:150,render:v=>v||'Report'},
                    {title:'Remarks / How to Fix',dataIndex:'remarks',render:(v,r)=>v||r.message||'Validate the original report again.'}
                  ]}/>
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
