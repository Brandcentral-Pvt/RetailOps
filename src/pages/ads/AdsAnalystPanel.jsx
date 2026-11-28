import React,{useEffect,useRef,useState} from 'react';
import {Alert,Button,Card,Empty,Space,Table,Tag,Typography,Select} from 'antd';
import {ResponsiveContainer,LineChart,Line,XAxis,YAxis,Tooltip,Legend} from 'recharts';
import {apiClient} from '../../lib/api-client';
import {adsCount,adsMoney,adsRate} from './adsNumberFormat.mjs';
const names={spend:'Ad spend',sales:'Ad sales',totalSales:'Total sales',orders:'Orders',conversions:'Conversions',clicks:'Clicks',impressions:'Impressions',acos:'ACoS',tacos:'TACoS',roas:'ROAS',ctr:'CTR',cvr:'CVR'};
const name=k=>names[k]||String(k).replaceAll('_',' ');
const money=['spend','sales','totalSales'],rates=['acos','tacos','ctr','cvr'];
function value(e){if(e.unit==='pp')return adsRate(e.value,'pp');if(e.metric==='roas')return adsRate(e.value,'x');if(rates.includes(e.metric))return adsRate(e.value);if(money.includes(e.metric))return adsMoney(e.value,e.currency);return adsCount(e.value);}
export default function AdsAnalystPanel({filters,onOpen}){
 const [data,setData]=useState(null),[busy,setBusy]=useState(null),[error,setError]=useState(null);
 const controller=useRef(null);
 const [history,setHistory]=useState([]),[currency,setCurrency]=useState(null);
 const loadHistory=async()=>{try{const r=await apiClient.get('/ads/canonical-analyst/history');setHistory(r.data.data);}catch(e){setError(e.response?.data?.message||'History unavailable.');}};
 const openHistory=async id=>{if(controller.current)return;const c=new AbortController();controller.current=c;setBusy('history');setError(null);try{const r=await apiClient.get('/ads/canonical-analyst/history/'+id,{signal:c.signal});if(!c.signal.aborted)setData(r.data.data);}catch(e){if(!c.signal.aborted)setError(e.response?.data?.message||'History unavailable.');}finally{if(controller.current===c){controller.current=null;if(!c.signal.aborted)setBusy(null);}}};
 useEffect(()=>()=>controller.current?.abort(),[]);
 const run=async mode=>{
  if(controller.current)return;
  const c=new AbortController();controller.current=c;setBusy(mode);setError(null);setData(null);
  try{
   const r=await apiClient.post('/ads/canonical-analyst/'+mode,{filters},{signal:c.signal,timeout:90000});
   if(!c.signal.aborted)setData(r.data.data);
  }catch(e){if(!c.signal.aborted)setError(e.response?.data?.message||e.message||'Analysis unavailable');}
  finally{if(controller.current===c){controller.current=null;if(!c.signal.aborted)setBusy(null);}}
 };
 const evidence=new Map((data?.evidence||[]).map(e=>[e.id,e]));
 const days=(Date.parse(filters.endDate)-Date.parse(filters.startDate))/86400000+1;
 return <section className="ads-analyst" data-testid="ads-analyst">
 <Card size="small" title="Ads AI Analyst">
  <Typography.Paragraph>Review uploaded advertising evidence and prioritize actions. AI ranking is optional; no campaign or budget changes are executed.</Typography.Paragraph>
  <Space wrap><Button type="primary" disabled={!!busy||days>90} loading={busy==='evidence'} onClick={()=>run('evidence')}>Analyze evidence</Button><Button disabled={!!busy||days>90} loading={busy==='review'} onClick={()=>run('review')}>Generate full AI analysis</Button></Space>
  {days>90&&<Alert type="warning" showIcon message="Select a reporting range of up to 90 days."/>}
  <Typography.Paragraph type="secondary" style={{marginTop:12,marginBottom:0}}>AI analyzes canonical financial totals, daily trends and anonymized product-level evidence. Validated AI reports are saved for later review.</Typography.Paragraph>
 </Card>
 <Card size="small" title="Saved analyses"><Space wrap><Button disabled={!!busy} onClick={loadHistory}>Load history</Button>{history.length>0&&<Select style={{minWidth:260}} placeholder="Open saved report" disabled={!!busy} onChange={openHistory} options={history.map(h=>({value:h.id,label:h.filters.startDate+' to '+h.filters.endDate+' · '+new Date(h.createdAt).toLocaleString()}))}/>}</Space></Card>
 {error&&<Alert type="error" showIcon message={error}/>}
 {data&&<>
  <Typography.Paragraph type="secondary">Report period: {data.period.startDate} to {data.period.endDate} · Generated: {new Date(data.generatedAt).toLocaleString()}</Typography.Paragraph>
  <Alert showIcon type={['ai_ranked','ai_analysis'].includes(data.mode)?'success':'info'} message={data.mode==='ai_ranked'?'AI intelligence report':'Deterministic evidence review'} description={data.reason==='provider_unavailable_or_invalid'?'AI provider unavailable or response invalid. Verified findings are shown instead.':data.reason==='ai_disabled'?'AI ranking is disabled. Ask an administrator to set ADS_ANALYST_AI_ENABLED=true.':data.reason==='provider_not_configured'?'NVIDIA NIM is not configured. Ask an administrator to configure NVIDIA_NIM_API_KEY.':data.reason==='usage_control_unavailable'?'Distributed usage control is unavailable. Verified findings are shown instead.':undefined}/>
  {data.analysis&&<Card size="small" title="Executive assessment">
   <Typography.Title level={4}>{data.analysis.executiveSummary.headline}</Typography.Title>
   <Typography.Paragraph>{data.analysis.executiveSummary.summary}</Typography.Paragraph>
   <Space wrap>{data.analysis.executiveSummary.evidenceIds.map(id=>{const e=evidence.get(id);return e?<Tag key={id}>{id}: {name(e.metric)} · {value(e)}</Tag>:null;})}</Space>
   <Typography.Paragraph type="secondary">Saved report: {data.reportId} · AI interpretation, not independently verified causation.</Typography.Paragraph>
   {data.analysis.findings.map(f=><Card size="small" key={f.id} title={name(f.category)} style={{marginBottom:12}} extra={<Tag color={f.severity==='high'?'red':f.severity==='medium'?'gold':'default'}>{f.severity}</Tag>}>
     <Typography.Paragraph>{f.observation}</Typography.Paragraph>
     <Typography.Paragraph><strong>Possible cause: </strong>{f.possibleCause}</Typography.Paragraph>
     <Typography.Paragraph><strong>Recommended action: </strong>{f.action}</Typography.Paragraph>
     <Space wrap>{f.evidenceIds.map(id=>{const e=evidence.get(id);return e?<Tag key={id}>{id}: {e.currency} · {name(e.metric)} · {value(e)} · {e.coverage}</Tag>:null;})}</Space>
     <Space wrap>{f.productRefs.map(id=>{const p=data.products?.find(x=>x.id===id);return p?<Tag key={id}>{p.entityKey} · {p.sellerName} · {adsMoney(p.spend,p.currency)} spend</Tag>:null;})}</Space>
   </Card>)}
   {data.analysis.limitations.map((s,i)=><Typography.Paragraph type="secondary" key={i}>{s}</Typography.Paragraph>)}
  </Card>}
  {!!data.trends?.length&&<Card size="small" title="Canonical daily performance"><Select value={currency&&data.trends.some(t=>t.currency===currency)?currency:data.trends[0].currency} onChange={setCurrency} options={[...new Set(data.trends.map(t=>t.currency))].map(v=>({value:v,label:v}))}/><div style={{height:280,width:'100%'}}><ResponsiveContainer><LineChart data={data.trends.filter(t=>t.period==='current'&&t.currency===(currency&&data.trends.some(x=>x.currency===currency)?currency:data.trends[0].currency)).map(t=>({...t,spend:t.spend==null?null:Number(t.spend),sales:t.sales==null?null:Number(t.sales)}))}><XAxis dataKey="date"/><YAxis/><Tooltip/><Legend/><Line dataKey="sales" name="Ad sales" stroke="#2563eb" dot={false} connectNulls={false}/><Line dataKey="spend" name="Spend" stroke="#b7791f" dot={false} connectNulls={false}/></LineChart></ResponsiveContainer></div></Card>}
  <Card size="small" title="Deterministic action plan">
   {data.recommendations.length===0?<Empty description={data.empty?'No stored advertising evidence in this scope':'No matching review findings'}/>:data.recommendations.map((f,i)=><Card key={f.id} size="small" style={{marginBottom:12}} title={String(i+1)+'. '+(f.label||name(f.code))}>
    <Typography.Paragraph>{f.action}</Typography.Paragraph>
    <Space wrap>{f.evidenceIds.map(id=>{const e=evidence.get(id);return e?<Tag key={id}>{id}: {e.currency} · {name(e.metric)} · {value(e)} · {e.coverage}</Tag>:null;})}</Space>
    {!!f.products?.length&&<div className="ads-table-shell" style={{marginTop:12}}><Typography.Paragraph type="secondary">Bounded product examples; signal count covers the full scope.</Typography.Paragraph><Table size="small" rowKey={r=>JSON.stringify([r.sellerId,r.marketplace,r.currency,r.entityKey])} pagination={false} scroll={{x:760}} dataSource={f.products} columns={[
     {title:'ASIN',width:160,render:(_,r)=><Button type="link" disabled={Boolean(data.reportId&&data.filters&&JSON.stringify(data.filters)!==JSON.stringify(filters))} onClick={()=>onOpen(r)}>{r.entityKey}</Button>},
     {title:'Seller',dataIndex:'sellerName',width:170,ellipsis:true},{title:'Spend',width:130,render:(_,r)=>adsMoney(r.spend,r.currency)},{title:'Ad sales',width:130,render:(_,r)=>adsMoney(r.sales,r.currency)},{title:'Evidence',dataIndex:'evidenceStatus',width:170}
    ]}/></div>}
   </Card>)}
  </Card>
  <Card size="small" title="Verified financial evidence"><div className="ads-table-shell"><Table size="small" rowKey="id" dataSource={data.evidence} pagination={{pageSize:12}} scroll={{x:700}} columns={[{title:'Evidence',dataIndex:'id',width:80},{title:'Metric',width:180,render:(_,e)=>name(e.metric)},{title:'Period',dataIndex:'period',width:110},{title:'Currency',dataIndex:'currency',width:90},{title:'Value',width:150,render:(_,e)=>value(e)},{title:'Coverage',dataIndex:'coverage',width:180}]}/></div></Card>
  <Card size="small" title="Data limitations">{data.limitations.map(s=><Typography.Paragraph key={s}>{s}</Typography.Paragraph>)}</Card>
 </>}
 </section>;
}
