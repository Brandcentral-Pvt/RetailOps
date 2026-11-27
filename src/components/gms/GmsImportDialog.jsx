import React, { useEffect, useRef, useState } from 'react';
import { Alert, Button, Card, Col, Collapse, Flex, Modal, Progress, Row, Space, Statistic, Steps, Table, Tabs, Tag, Tooltip, Typography, Upload } from 'antd';
import { UploadOutlined, ReloadOutlined, DownloadOutlined } from '@ant-design/icons';
import { gmsApi } from '../../services/api';
import './gmsImportDialog.css';

const colors = { READY: 'blue', REJECTED: 'red', QUEUED: 'processing', COMPLETED: 'green', FAILED: 'red', EXPIRED: 'default', CANCELLED: 'default' };
const formatDate = value => value ? new Date(value).toLocaleString('en-IN') : '-';
const count = value => Number(value || 0).toLocaleString('en-IN');
const maxBytes = 100 * 1024 * 1024;
const statusLabels={READY:'Ready to import',REJECTED:'Needs correction',QUEUED:'Import in progress',COMPLETED:'Completed',FAILED:'Failed',EXPIRED:'Expired',CANCELLED:'Cancelled'};

export default function GmsImportDialog({ open, initialTab='upload', onClose, onCommitted }) {
  const [tab,setTab]=useState(initialTab);
  const [file, setFile] = useState(null);
  const [job, setJob] = useState(null);
  const [history, setHistory] = useState([]);
  const [busy, setBusy] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState(null);
  const [downloading, setDownloading] = useState(null);
  const lock = useRef(false);
  const uploadScrollRef=useRef(null),historyScrollRef=useRef(null);
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
    setTab(initialTab);
    const controller = new AbortController();
    refreshHistory(controller.signal);
    return () => controller.abort();
  }, [open,initialTab]);

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
    if (lock.current||job?.status==='QUEUED') return Upload.LIST_IGNORE;
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
      setTab('upload');
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
  useEffect(()=>{
    if(open) (tab==='history'?historyScrollRef.current:uploadScrollRef.current)?.scrollTo({top:0,left:0});
  },[open,tab,job?.id]);
  useEffect(()=>{
    if(open&&error) (tab==='history'?historyScrollRef.current:uploadScrollRef.current)?.scrollTo({top:0});
  },[open,tab,error]);

  const summary=job?.summary;
  const queued=job?.status==='QUEUED';
  const step=!job?0:['READY','REJECTED'].includes(job.status)?1:2;
  const stepStatus=['REJECTED','FAILED'].includes(job?.status)?'error':job?.status==='COMPLETED'?'finish':'process';
  function downloadTemplate(){
    const columns=['ASIN','Product Title','Brand','Ordered Revenue','Ordered Units','Shipped Revenue','Shipped COGS','Shipped Units','Customer Returns','Date','storeCode'];
    const url=URL.createObjectURL(new Blob(['\ufeff'+columns.join(',')+'\r\n'],{type:'text/csv;charset=utf-8'}));
    const link=document.createElement('a');link.href=url;link.download='GMS_Import_Template.csv';document.body.appendChild(link);link.click();link.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  const startNewReport=()=>{
    if(busy||queued)return;
    setFile(null);setJob(null);setError('');setTab('upload');
  };
  const errorBanner=error?<Alert type="error" showIcon title={error}/>:null;
  const workflow=<Flex vertical gap={14}>
    <Steps size="small" current={step} status={stepStatus} items={[{title:'Choose report'},{title:'Review validation'},{title:'Import result'}]} />
    {errorBanner}
    {!job&&<>
      <Alert type="info" showIcon title="Amazon India daily reports" description="CSV, XLS or XLSX, up to 100 MB and 500,000 data rows. Empty financial cells become zero; valid negative values are retained. Import requires your confirmation."/>
      <Card size="small" title="Select a GMS report" extra={<Button aria-label="Download import template" size="small" icon={<DownloadOutlined/>} onClick={downloadTemplate} disabled={busy}>CSV template</Button>}>
        <Upload.Dragger accept=".csv,.xlsx,.xls" beforeUpload={selectFile} maxCount={1} disabled={busy}
          fileList={file?[file]:[]} onRemove={()=>{if(busy)return false;setFile(null);return true;}}>
          <p><UploadOutlined style={{fontSize:28}}/></p>
          <Typography.Text strong>Select or drop a GMS report</Typography.Text>
          <p><Typography.Text type="secondary">Excel or CSV. Files are validated before saving.</Typography.Text></p>
        </Upload.Dragger>
        <Collapse ghost size="small" items={[{key:'requirements',label:'Required columns and import rules',children:<Typography.Paragraph type="secondary" style={{marginBottom:0}}>ASIN, Date, Brand, StoreCode, Ordered Revenue, Ordered Units, Shipped Revenue, Shipped COGS, Shipped Units, Customer Returns. Product Title is optional. RetailOps matches the ASIN to its existing seller. Authorized global importers can retain unmatched ASINs. The CSV template contains headers only; add your report data before validation.</Typography.Paragraph>}]}/>
      </Card>
    </>}
    {progress!==null&&<Card size="small"><Progress percent={progress} status="active"/><Typography.Text type="secondary">{progress===100?'Validating report on server...':'Uploading report...'}</Typography.Text></Card>}
    {job&&summary&&<Card size="small" title={<Flex align="center" wrap gap={8} className="gms-import-result-title"><Tooltip title={job.fileName}><Typography.Text strong ellipsis>{job.fileName}</Typography.Text></Tooltip><Tag color={colors[job.status]}>{statusLabels[job.status]||job.status}</Tag></Flex>}>
      <Flex vertical gap={12}>
        <Row gutter={[8,8]}>
          {[
            ['Source rows',summary.total],['New records',summary.inserted],['Updates',summary.updated],['Unchanged',summary.unchanged],
            ['Matched rows',summary.matched],['Unmatched rows',summary.unmatched],['Validation issues',summary.invalid],['Blank cells set to zero',summary.defaultedCells]
          ].map(([label,value])=><Col key={label} xs={12} sm={6}><Card size="small" className="gms-import-stat"><Statistic title={label} value={count(value)} valueStyle={{fontSize:18}}/></Card></Col>)}
        </Row>
        <Space wrap><Typography.Text type="secondary">Identical duplicates: {count(summary.duplicates)}</Typography.Text><Typography.Text type="secondary">Negative-value rows: {count(summary.negativeRows)}</Typography.Text></Space>
        {job.status==='READY'&&<Alert type={summary.updated?'warning':'success'} showIcon title="Validation passed" description={summary.unmatched?'Unmatched rows are retained with Seller (DB) shown as a dash. Confirm to import the validated records.':summary.updated?'Confirmation updates existing records for the validated ASIN and date. No changes have been saved yet.':'No conflicts found. Confirm to queue the import.'}/>}
        {job.status==='REJECTED'&&<Alert type="error" showIcon title="Report rejected" description="Download the error report, follow the remarks and validate the corrected file again. No records were saved."/>}
        {queued&&<Alert type="info" showIcon title="Import queued or committing" description="RetailOps is rechecking the validated report and saving all changes together. You may close this window and review import history later."/>}
        {job.status==='COMPLETED'&&<Alert type="success" showIcon title="Import completed" description={count(summary.committed)+' records inserted or updated; '+count(summary.unchanged)+' unchanged.'}/>}
        {job.status==='FAILED'&&<Alert type="error" showIcon title="Import failed" description={summary.failure||'Validate a new batch before retrying.'}/>}
        {['EXPIRED','CANCELLED'].includes(job.status)&&<Alert type="warning" showIcon title={statusLabels[job.status]} description="Upload the report again to create a new validation."/>}
        {(summary.issues?.length>0||(job.status==='FAILED'&&summary.failure))&&<Card size="small" title={'Error report ('+count(summary.reportIssueCount??summary.issues?.length??1)+')'}>
          <Flex vertical gap={10}>
            <Space wrap>
              <Button aria-label="Download Excel error report" icon={<DownloadOutlined/>} loading={downloading==='xlsx'} disabled={busy||!!downloading} onClick={()=>downloadIssues('xlsx')}>Download Excel</Button>
              <Button aria-label="Download CSV error report" icon={<DownloadOutlined/>} loading={downloading==='csv'} disabled={busy||!!downloading} onClick={()=>downloadIssues('csv')}>Download CSV</Button>
            </Space>
            {summary.reportComplete!==true&&<Alert type="warning" showIcon title="Older error report" description="Some source ASINs or issues were not saved in this older import. Revalidate the original file to obtain the complete report."/>}
            {summary.reportIssueCount>(summary.issues?.length||0)&&<Typography.Text type="secondary">Showing the first {summary.issues.length} issues. The downloaded report includes every detected issue.</Typography.Text>}
            <Table size="small" rowKey={(row,index)=>String(row.row??'file')+'-'+String(index)} pagination={{pageSize:5,hideOnSinglePage:true}} dataSource={summary.issues||[]} scroll={{x:820}}
              columns={[{title:'Excel Row',dataIndex:'row',width:90,render:v=>v??'File'},{title:'ASIN',dataIndex:'asin',width:130,render:v=>v||'-'},{title:'Date',dataIndex:'date',width:115,render:v=>v||'-'},
                {title:'Affected Column',dataIndex:'column',width:145,render:v=>v||'Report'},{title:'Remarks / How to Fix',dataIndex:'remarks',render:(v,r)=>v||r.message||'Validate the original report again.'}]}/>
          </Flex>
        </Card>}
        {!!summary.sample?.length&&<Collapse size="small" defaultActiveKey={job.status==='READY'?['sample']:[]} items={[{key:'sample',label:'Validated record sample ('+summary.sample.length+')',children:
          <Table size="small" rowKey="row" pagination={false} scroll={{x:780}} dataSource={summary.sample}
            columns={[{title:'Row',dataIndex:'row',width:70},{title:'ASIN',dataIndex:'asin',width:120},{title:'Date',dataIndex:'date',width:110},
              {title:'Brand (Sheet)',dataIndex:'brand',width:130},{title:'Mapping',dataIndex:'mappingStatus',width:110,render:v=><Tag color={v==='UNMATCHED'?'warning':'default'}>{v==='UNMATCHED'?'Unmatched':'Matched'}</Tag>},
              {title:'Store',dataIndex:'storeCode',width:70},{title:'Ordered revenue',dataIndex:'orderedRevenue',width:120},{title:'Units',dataIndex:'orderedUnits',width:80},{title:'Action',dataIndex:'action',width:100}]}/>
        }]}/>}

      </Flex>
    </Card>}
  </Flex>;
  const historyContent=<Flex vertical gap={14}>
    {errorBanner}
    <Flex align="center" justify="space-between" wrap gap={8} className="gms-import-history-toolbar">
      <div>
        <Typography.Title level={5} style={{margin:0}}>Recent imports</Typography.Title>
        <Typography.Text type="secondary">Review your last 50 batches, validation results and error reports.</Typography.Text>
      </div>
      <Button aria-label="Refresh history" icon={<ReloadOutlined/>} loading={historyLoading} disabled={busy} onClick={()=>refreshHistory()}>Refresh history</Button>
    </Flex>
    {queued&&<Alert type="info" showIcon title="An import is currently processing" description="The current batch is being tracked. You can review other batches after it finishes."/>}
    <div className="gms-import-history-table">
      <Table size="small" rowKey="id" dataSource={history} loading={historyLoading} tableLayout="fixed"
        pagination={{pageSize:10,hideOnSinglePage:true,showSizeChanger:false,showTotal:(total,range)=>range[0]+'-'+range[1]+' of '+count(total)+' batches'}}
        scroll={{x:820}} locale={{emptyText:'No import history yet'}}
        columns={[
          {title:'Report',dataIndex:'fileName',width:280,ellipsis:{showTitle:false},render:v=><Tooltip title={v}><span className="gms-import-file-name">{v||'-'}</span></Tooltip>},
          {title:'Status',dataIndex:'status',width:156,render:v=><Tag color={colors[v]}>{statusLabels[v]||v}</Tag>},
          {title:'Created',dataIndex:'createdAt',width:190,render:formatDate},
          {title:'Rows',width:90,align:'right',render:(_,r)=>count(r.summary?.total)},
          {title:'Action',width:90,align:'right',render:(_,r)=><Button aria-label={'View import '+r.fileName+' ('+formatDate(r.createdAt)+')'} type="link" size="small" disabled={busy||(queued&&r.id!==job.id)} onClick={()=>inspect(r.id)}>View</Button>}
        ]}/>
    </div>
  </Flex>;
  const footerNote=tab==='history'
    ?count(history.length)+' recent '+(history.length===1?'batch':'batches')
    :queued?'Import is processing. Closing does not cancel it.'
    :job?statusLabels[job.status]||job.status
    :file?file.name:'Choose a report to validate. No records are saved yet.';
  const footer=<div className="gms-import-footer-bar">
    <Typography.Text type="secondary" className="gms-import-footer-note" ellipsis={{tooltip:footerNote}}>{footerNote}</Typography.Text>
    <div className="gms-import-footer-actions">
      <Button onClick={onClose} disabled={busy}>Close</Button>
      {tab==='upload'&&<>
        {!job&&<Button type="primary" onClick={validate} loading={busy&&progress!==null} disabled={!file||busy}>Validate report</Button>}
        {job&&!queued&&<Button disabled={busy||!!downloading} onClick={startNewReport}>New report</Button>}
        {job&&['READY','QUEUED'].includes(job.status)&&<Button disabled={busy} onClick={cancel}>Cancel batch</Button>}
        {job?.status==='READY'&&<Button type="primary" loading={busy} onClick={confirm}>Confirm import</Button>}
      </>}
    </div>
  </div>;
  return <Modal open={open} centered rootClassName="gms-import-modal-root" className="gms-import-modal" onCancel={()=>{if(!busy)onClose();}} keyboard={!busy}
    title="GMS Report Import" width={1040} footer={footer} closable={!busy} mask={{closable:false}}>
    <Tabs className="gms-import-tabs" activeKey={tab} onChange={setTab} items={[
      {key:'upload',label:'Import report',children:<section ref={uploadScrollRef} className="gms-import-scroll" role="region" aria-label="Import report content" tabIndex={0}>{workflow}</section>},
      {key:'history',label:'My import history',disabled:busy,children:<section ref={historyScrollRef} className="gms-import-scroll" role="region" aria-label="Import history content" tabIndex={0}>{historyContent}</section>}
    ]}/>
  </Modal>;
}
