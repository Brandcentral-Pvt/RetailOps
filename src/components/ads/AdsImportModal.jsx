import React,{useEffect,useRef,useState} from 'react';
import {Alert,Button,Card,Col,Descriptions,Input,Modal,Progress,Row,Select,Space,Table,Tabs,Tag,Upload} from 'antd';
import {InboxOutlined,DownloadOutlined,ReloadOutlined} from '@ant-design/icons';
import {apiClient} from '../../lib/api-client';

const endpoint='/upload/ads-imports';
const colors={PREVIEW_QUEUED:'warning',VALIDATING:'processing',QUEUED:'warning',PROCESSING:'processing',READY:'processing',REJECTED:'error',COMPLETED:'success',FAILED:'error',CANCELLED:'default',EXPIRED:'default'};
const previewJob=status=>['PREVIEW_QUEUED','VALIDATING'].includes(status);
const activeJob=status=>previewJob(status)||['QUEUED','PROCESSING'].includes(status);
const historyStatuses=['PREVIEW_QUEUED','VALIDATING','READY','QUEUED','PROCESSING','COMPLETED','REJECTED','FAILED','CANCELLED','EXPIRED'];
const stageNames={preview_queued:'Waiting for validation worker',preview_scanning:'Scanning CSV records',preview_catalog:'Validating catalog ownership',queued:'Waiting for worker',retry_wait:'Waiting to retry',validating:'Revalidating source and access',staging:'Staging source records',seller_lock:'Acquiring seller lock',catalog_ownership:'Checking catalog ownership',historical_conflict_check:'Checking historical records',insert:'Inserting facts',reconcile:'Reconciling persisted records',commit:'Committing transaction',completed:'Completed'};
const count=v=>v==null?'Unknown':Number(v).toLocaleString('en-IN');
const time=v=>v?new Date(v).toLocaleString():'N/A';
const errText=(e,fallback)=>{
 const data=e.response?.data;
 if(data?.code==='entity.parse.failed'||data?.code==='INVALID_JSON')return 'Invalid request format. Refresh the application and retry.';
 return typeof data?.message==='string'?data.message:fallback;
};
const money=(v,c)=>v==null||!c?'N/A':c+' '+v;

export default function AdsImportModal({isOpen,onClose,onComplete}){
 const [tab,setTab]=useState('upload');
 const [sellers,setSellers]=useState([]);
 const [file,setFile]=useState(null),[job,setJob]=useState(null);
 const [history,setHistory]=useState({rows:[],page:1,total:0,limit:10});
 const [historyLoading,setHistoryLoading]=useState(false);
 const [historyFilters,setHistoryFilters]=useState({}),[historySearch,setHistorySearch]=useState('');
 const historyRequest=useRef(0);
 const [busy,setBusy]=useState(null),[error,setError]=useState(null),[uploadPct,setUploadPct]=useState(0);
 const summary=job?.summary||{};
 const completedCallback=useRef(onComplete),notified=useRef(new Set());
 completedCallback.current=onComplete;
 const notifyComplete=next=>{
  if(next?.status==='COMPLETED'&&next.result?.persisted&&!notified.current.has(next.id)){
   notified.current.add(next.id);completedCallback.current?.(next.result);
  }
 };
 // Poll only while the selected job is active and the modal is open. No
 // overlapping requests; closing the modal never cancels server work.
 useEffect(()=>{
  if(!isOpen||tab!=='detail'||!job?.id||!activeJob(job.status)||busy)return undefined;
  const controller=new AbortController();let timer;
  const tick=async()=>{
   try{
    const r=await apiClient.get(endpoint+'/'+encodeURIComponent(job.id),{signal:controller.signal,timeout:12000});
    if(controller.signal.aborted)return;
    const next=r.data?.data;
    if(next?.id===job.id){setJob(next);notifyComplete(next);if(!activeJob(next.status))return;}
   }catch(e){if(controller.signal.aborted)return;}
   if(!controller.signal.aborted)timer=setTimeout(tick,2500);
  };
  timer=setTimeout(tick,1500);
  return ()=>{controller.abort();clearTimeout(timer);};
 },[isOpen,tab,job?.id,job?.status,busy]);
 const loadHistory=async(page=1,filters=historyFilters)=>{
  const request=++historyRequest.current;
  setHistoryLoading(true);
  try{
   const res=await apiClient.get(endpoint,{params:{page,limit:10,...filters}});
   if(request===historyRequest.current)setHistory(res.data.data);
  }catch(e){if(request===historyRequest.current)setError(errText(e,'Import history could not be loaded.'));}
  finally{if(request===historyRequest.current)setHistoryLoading(false);}
 };
 const applyHistoryFilters=filters=>{setHistoryFilters(filters);setError(null);loadHistory(1,filters);};
 useEffect(()=>{
  if(!isOpen)return undefined;
  let active=true;
  setTab('upload');setSellers([]);setFile(null);setJob(null);setError(null);setUploadPct(0);
  setHistoryFilters({});setHistorySearch('');setHistory({rows:[],page:1,total:0,limit:10});setHistoryLoading(false);
  apiClient.get('/upload/ads-validation-sellers').then(r=>{if(active)setSellers(r.data?.data||[]);})
   .catch(e=>{if(active)setError(errText(e,'Seller options could not be loaded.'));});
  return ()=>{active=false;historyRequest.current++;};
 },[isOpen]);
 const openJob=async id=>{
  setBusy('load');setError(null);
  try{const r=await apiClient.get(endpoint+'/'+encodeURIComponent(id));setJob(r.data.data);setTab('detail');}
  catch(e){setError(errText(e,'Import details could not be loaded.'));}
  finally{setBusy(null);}
 };
 const validate=async()=>{
  if(!file||busy)return;
  setBusy('validate');setError(null);setUploadPct(0);
  try{
   const form=new FormData();
   form.append('reportType','daily');form.append('file',file);
   const r=await apiClient.post(endpoint,form,{timeout:180000,headers:{'Content-Type':undefined},
    onUploadProgress:event=>{if(event.total)setUploadPct(Math.min(100,Math.round(event.loaded/event.total*100)));}});
   setJob(r.data.data);setFile(null);setTab('detail');
  }catch(e){setError(errText(e,'Validation could not be completed. Check Import history before retrying.'));}
  finally{setBusy(null);}
 };
 const confirm=async()=>{
  if(!job||job.status!=='READY'||!job.importsEnabled||busy)return;
  setBusy('confirm');setError(null);
  try{
   const r=await apiClient.post(endpoint+'/'+encodeURIComponent(job.id)+'/confirm',{},{timeout:30000});
   const next=r.data.data;setJob(next);
   notifyComplete(next);
  }catch(e){
   const reported=e.response?.data?.data;
   if(reported?.id===job.id)setJob(reported);
   const status=e.response?.status;
   if(!status||status===408||status>=500){
    // Never automatically repeat a financial write after a lost response.
    // Read the authoritative job once; the completed result is atomic.
    try{
     const check=await apiClient.get(endpoint+'/'+encodeURIComponent(job.id),{timeout:15000});
     const current=check.data?.data;
     if(current?.id===job.id){
      setJob(current);
      if(current.status==='COMPLETED'&&current.result?.persisted){notifyComplete(current);return;}
      if(activeJob(current.status))return;
      if(current.status==='FAILED'){setError(current.result?.message||'Import failed. Check import details.');return;}
     }
    }catch{/* Reopen history before retrying. */}
    setError('The confirmation response was interrupted. Refresh status or reopen history before retrying. An identical retry is safe.');
   }else setError(errText(e,'The result could not be confirmed. Refresh this job or reopen history before retrying.'));
  }finally{setBusy(null);}
 };
 const cancel=async()=>{
  if(!job||!['PREVIEW_QUEUED','READY','QUEUED'].includes(job.status)||busy)return;
  setBusy('cancel');setError(null);
  try{const r=await apiClient.post(endpoint+'/'+encodeURIComponent(job.id)+'/cancel',{});setJob(r.data.data);}
  catch(e){setError(errText(e,'Cancellation failed. Refresh the job to check its current state.'));}
  finally{setBusy(null);}
 };
 const downloadErrors=async()=>{
  if(!job||busy)return;
  setBusy('errors');setError(null);
  try{
   const r=await apiClient.get(endpoint+'/'+encodeURIComponent(job.id)+'/errors',{responseType:'blob',timeout:120000});
   const type=r.headers['content-type']||'';
   const extension=type.includes('spreadsheetml')?'xlsx':type.includes('text/csv')?'csv':null;
   if(!extension)throw Error('Unexpected download response.');
   const url=URL.createObjectURL(r.data),a=document.createElement('a');
   a.href=url;a.download='ads-import-'+job.id+'-errors.'+extension;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }catch(e){
   let message='Error workbook could not be downloaded.';
   try{if(e.response?.data instanceof Blob)message=JSON.parse(await e.response.data.text()).message||message;}catch{}
   setError(message);
  }finally{setBusy(null);}
 };
 const newImport=()=>{setFile(null);setJob(null);setUploadPct(0);setError(null);setTab('upload');};
 const handleTab=key=>{if(busy)return;setError(null);setTab(key);if(key==='history')loadHistory(1);};
 const uploadContent=<Space direction="vertical" size="middle" style={{width:'100%'}}>
  <Alert showIcon type="info" message="Validate once, confirm from history"
   description="Seller ownership is detected from each ASIN in the RetailOps catalog. Shared, unknown or unauthorized ASINs and mixed currencies are rejected. Validation runs in the background after upload. Validated reports remain available for confirmation for 24 hours. No Ads facts are written until you confirm."/>
  <Space wrap><Tag color="blue">Automatic seller detection</Tag><Tag>Daily v1</Tag></Space>
  <Upload.Dragger accept=".csv" maxCount={1} disabled={!!busy} fileList={file?[file]:[]}
   beforeUpload={f=>{if(!/\.csv$/i.test(f.name)||f.size>32*1024*1024||!f.size){setError('Select a nonempty CSV up to 32 MiB.');return Upload.LIST_IGNORE;}setFile(f);setError(null);return false;}}
   onRemove={()=>{setFile(null);return true;}}>
   <p className="ant-upload-drag-icon"><InboxOutlined/></p><p>Choose or drop your daily product CSV</p><p>63 original headers • up to 200,000 data records • 32 MiB</p>
  </Upload.Dragger>
  {busy==='validate'&&<><Progress percent={uploadPct} status="active"/><div>{uploadPct===100?'File received; saving validation job…':'Uploading CSV…'}</div></>}
 </Space>;
 const historyContent=<Space direction="vertical" style={{width:'100%'}}>
  <Alert type="info" showIcon message="Your import history" description="Open a saved preview to confirm or cancel. Only jobs you created for sellers you can access are shown."/>
  <Space wrap>
   <Input.Search aria-label="Search import history" placeholder="Filename or job ID" maxLength={120} allowClear value={historySearch} onChange={e=>{setHistorySearch(e.target.value);if(!e.target.value)applyHistoryFilters({...historyFilters,search:undefined});}} onSearch={value=>applyHistoryFilters({...historyFilters,search:value.trim()||undefined})} style={{width:210}}/>
   <Select aria-label="Import status" placeholder="All statuses" allowClear value={historyFilters.status} onChange={status=>applyHistoryFilters({...historyFilters,status})} options={historyStatuses.map(value=>({value,label:value.replaceAll('_',' ')}))} style={{width:160}}/>
   <Select aria-label="Import history seller" placeholder="All sellers" allowClear showSearch optionFilterProp="label" value={historyFilters.sellerId} onChange={sellerId=>applyHistoryFilters({...historyFilters,sellerId})} options={sellers.map(v=>({value:v.id,label:v.name}))} style={{width:185}}/>
   <Button icon={<ReloadOutlined/>} onClick={()=>loadHistory(history.page)} loading={historyLoading}>Refresh history</Button>
  </Space>
  <Table size="small" rowKey="id" loading={historyLoading} dataSource={history.rows} scroll={{x:730}}
   pagination={{current:history.page,pageSize:history.limit,total:history.total,showSizeChanger:false,onChange:page=>loadHistory(page)}}
   columns={[
    {title:'Report',dataIndex:'fileName',width:205,ellipsis:true},
    {title:'Sellers',width:150,render:(_,r)=>r.summary?.sellerBreakdown?.length?r.summary.sellerBreakdown.length+' mapped sellers':r.sellerId?(sellers.find(s=>s.id===r.sellerId)?.name||r.sellerId):'Automatic'},
    {title:'Status',dataIndex:'status',width:120,render:v=><Tag color={colors[v]}>{v}</Tag>},
    {title:'Created',dataIndex:'createdAt',width:160,render:time},
    {title:'Data rows',width:90,render:(_,r)=>count(r.summary?.rows)},
    {title:'Action',width:90,render:(_,r)=><Button type="link" disabled={!!busy} onClick={()=>openJob(r.id)}>Open</Button>}
   ]}/>
 </Space>;
 const details=job&&<Space direction="vertical" size="middle" style={{width:'100%'}}>
  <Space wrap><Tag color={colors[job.status]}>{job.status}</Tag><strong>{job.fileName}</strong><Button icon={<ReloadOutlined/>} disabled={!!busy} onClick={()=>openJob(job.id)}>Refresh status</Button></Space>
  <Descriptions bordered size="small" column={2}>
   <Descriptions.Item label="Sellers">{summary.sellerBreakdown?.length?summary.sellerBreakdown.length+' mapped sellers':job.sellerId?(sellers.find(s=>s.id===job.sellerId)?.name||job.sellerId):'Automatic detection'}</Descriptions.Item>
   <Descriptions.Item label="Marketplace / currency">{job.marketplace||'N/A'} · {job.currency||'N/A'}</Descriptions.Item>
   <Descriptions.Item label="Report dates">{summary.startDate||'N/A'} to {summary.endDate||'N/A'}</Descriptions.Item>
   <Descriptions.Item label="Created">{time(job.createdAt)}</Descriptions.Item>
   <Descriptions.Item label="Preview expires">{previewJob(job.status)?'After validation':time(job.expiresAt)}</Descriptions.Item>
   <Descriptions.Item label="Validated">{time(job.validatedAt)}</Descriptions.Item>
   <Descriptions.Item label="Queued">{time(job.queuedAt)}</Descriptions.Item>
   <Descriptions.Item label="Worker started">{time(job.startedAt)}</Descriptions.Item>
   <Descriptions.Item label="Completed">{time(job.completedAt)}</Descriptions.Item>
  </Descriptions>
  <Row gutter={[10,10]}>{[['Data rows',summary.rows],['Valid rows',summary.validRows],['Invalid rows',summary.invalidRows],['Issues',summary.issueCount]].map(([label,v])=>
    <Col span={12} sm={6} key={label}><Card size="small"><div>{label}</div><strong style={{fontSize:18}}>{count(v)}</strong></Card></Col>)}</Row>
  {summary.skippedBlankRows>0&&<Alert showIcon type="info"
   message={count(summary.skippedBlankRows)+' completely blank rows skipped'}
   description="Empty rows are excluded from the imported data and validation counts. Original CSV record numbers are retained."/>}
  {!!summary.sellerBreakdown?.length&&<Table size="small" rowKey="sellerId" pagination={{pageSize:5}} dataSource={job.result?.sellerBreakdown||summary.sellerBreakdown} scroll={{x:600}} columns={[
   {title:'Seller',dataIndex:'sellerId',render:v=>sellers.find(s=>s.id===v)?.name||v},{title:'Marketplace',dataIndex:'marketplace'},{title:'Currency',dataIndex:'currency'},
   {title:'ASINs',dataIndex:'asinCount'},{title:'Inserted',dataIndex:'inserted',render:v=>v??'N/A'},{title:'Unchanged',dataIndex:'unchanged',render:v=>v??'N/A'}]}/>}
  {summary.totals&&<Descriptions bordered size="small" column={2}>
   <Descriptions.Item label="Ad spend">{money(summary.totals['metrics.spend'],job.currency)}</Descriptions.Item>
   <Descriptions.Item label="Ad sales">{money(summary.totals['metrics.sales'],job.currency)}</Descriptions.Item>
   <Descriptions.Item label="Total sales">{money(summary.totals['metrics.total_sales'],job.currency)}</Descriptions.Item>
   <Descriptions.Item label="Ad orders">{count(summary.totals['metrics.orders'])}</Descriptions.Item>
  </Descriptions>}
  {job.status==='READY'&&<Alert showIcon type={job.importsEnabled?'success':'warning'} message={job.importsEnabled?'Ready to confirm':'Import confirmation paused'}
   description={job.importsEnabled?'Confirm inserts new records and retains identical records. Changed historical facts are rejected.':'The server has explicitly paused import confirmation. Ask an administrator to check ADS_CANONICAL_IMPORT_ENABLED, then refresh this saved job. Validation and history remain available.'}/>}
  {previewJob(job.status)&&<Card size="small" title={stageNames[job.stage]||'Background validation'}>
   <Space direction="vertical" style={{width:'100%'}}>
    <Alert type="info" showIcon message="Background validation is active" description="You may close this window and reopen import history. No advertising facts are written during validation."/>
    <div>{count(job.stagedRows||0)} data records scanned · Attempt {job.attemptCount||0} of 3</div>
    {job.stage==='retry_wait'&&<div>Next retry: {time(job.nextAttemptAt)}</div>}
   </Space>
  </Card>}
  {!previewJob(job.status)&&activeJob(job.status)&&<Card size="small" title={stageNames[job.stage]||'Import processing'}>
   <Space direction="vertical" style={{width:'100%'}}>
    <Alert type={job.importsEnabled?'info':'warning'} showIcon message={job.importsEnabled?'Background import is active':'Imports are paused by server configuration'}
     description="You may close this window. Reopen import history to see the current status. Only unclaimed queued jobs can be cancelled."/>
    {job.stage==='staging'&&summary.validRows>0&&<Progress percent={Math.min(100,Math.floor(100*(job.stagedRows||0)/summary.validRows))} status="active" format={v=>v+'% staged'}/>}
    <div>{count(job.stagedRows||0)} / {count(summary.validRows)} source rows staged · Attempt {job.attemptCount||0} of 3</div>
    {job.stage==='retry_wait'&&<div>Next retry: {time(job.nextAttemptAt)}</div>}
    <div>Staging is not a database commit. Success is shown only after all facts and the job outcome are committed together.</div>
   </Space>
  </Card>}
  {job.status==='COMPLETED'&&<Alert showIcon type="success" message={count(job.result?.inserted)+' inserted · '+count(job.result?.unchanged)+' unchanged'} description="The database commit and job completion were reconciled together."/>}
  {job.status==='FAILED'&&<Alert showIcon type="error" message={job.result?.message||'Import failed'} description="No partial advertising records were committed by this job."/>}
  {job.status==='EXPIRED'&&<Alert type="warning" message="The staged file expired. Create a new preview."/>}
  {job.status==='CANCELLED'&&<Alert type="info" message="Import cancelled. No facts were written."/>}
  {job.status==='REJECTED'&&<Alert showIcon type="error" message="Validation rejected" description="Correct the listed problems in the source CSV and create a new import."/>}
  {summary.scanComplete===false&&<Alert type="warning" message="CSV scanning stopped at a fatal error. Remaining records have not been checked."/>}
  {summary.issues?.length>0&&<Table size="small" rowKey={(_,i)=>i} dataSource={summary.issues} scroll={{x:700}} pagination={{pageSize:5,showSizeChanger:false}}
   columns={[{title:'CSV record',dataIndex:'row',width:90},{title:'ASIN',dataIndex:'asin',width:120},{title:'Date',dataIndex:'date',width:110},{title:'Column',dataIndex:'column',width:150},{title:'Remarks',dataIndex:'message'}]}/>}
  {summary.issuesTruncated&&<Alert type="info" message={'Showing '+summary.issues.length+' of '+summary.issueCount+' detected issues.'}/>}
  {summary.issueReportTruncated&&<Alert type="warning" message={'Legacy error report retains '+summary.storedIssueCount+' issues. Revalidate the original file to capture all detected errors.'}/>}
  {job.errorReportExpired&&<Alert type="info" message="Detailed error report expired after 90 days. The import summary is retained."/>}
  {!job.errorReportExpired&&(summary.storedIssueCount>0||job.status==='FAILED')&&<Button icon={<DownloadOutlined/>} loading={busy==='errors'} disabled={!!busy&&busy!=='errors'} onClick={downloadErrors}>{summary.storedIssueCount>100000?'Download complete error CSV':'Download error workbook'}</Button>}
  {busy==='confirm'&&<Alert showIcon type="info" message="Submitting import confirmation" description="The server will queue the validated report. If the connection drops, check the job status before retrying."/>}
 </Space>;
 return <Modal title="Advertising report imports" open={isOpen} centered width={920} closable={!busy} maskClosable={!busy} keyboard={!busy}
  onCancel={busy?undefined:onClose} styles={{body:{maxHeight:'66vh',overflowY:'auto'}}}
  footer={<Space wrap>
   <Button disabled={!!busy} onClick={onClose}>Close</Button>
   {tab==='upload'&&<Button type="primary" loading={busy==='validate'} disabled={!!busy||!file} onClick={validate}>Validate CSV</Button>}
   {tab==='detail'&&['PREVIEW_QUEUED','READY','QUEUED'].includes(job?.status)&&<Button danger loading={busy==='cancel'} disabled={!!busy} onClick={cancel}>Cancel import</Button>}
   {tab==='detail'&&job?.status==='READY'&&<Button type="primary" loading={busy==='confirm'} disabled={!!busy||!job.importsEnabled} onClick={confirm}>Confirm import</Button>}
   {tab==='detail'&&job?.status==='COMPLETED'&&<Button type="primary" disabled={!!busy} onClick={()=>onComplete?.(job.result)}>View imported report</Button>}
   {tab==='detail'&&<Button disabled={!!busy} onClick={newImport}>New import</Button>}
  </Space>}>
  {error&&<Alert type="error" showIcon closable onClose={()=>setError(null)} message={error} style={{marginBottom:12}}/>}
  <Tabs activeKey={tab} onChange={handleTab} items={[
   {key:'upload',label:'Upload CSV',children:uploadContent,disabled:!!busy},
   {key:'history',label:'Import history',children:historyContent,disabled:!!busy},
   ...(job?[{key:'detail',label:'Import details',children:details,disabled:!!busy}]:[])
  ]}/>
 </Modal>;
}
