import React,{useMemo,useState} from 'react';
import {Alert,Button,Card,Empty,Progress,Select,Spin,Table,Tabs,Tag,Typography} from 'antd';
import {CartesianGrid,Legend,Line,LineChart,ResponsiveContainer,Tooltip,XAxis,YAxis} from 'recharts';
import {DeltaText} from './AdsPerformanceReview';

const metricOptions=[
 {value:'totalSales',label:'Total sales',unit:'money'},{value:'sales',label:'Ad sales',unit:'money'},
 {value:'spend',label:'Ad spend',unit:'money'},{value:'roas',label:'ROAS',unit:'x'},
 {value:'acos',label:'ACoS',unit:'%'},{value:'tacos',label:'TACoS',unit:'%'},
 {value:'clicks',label:'Clicks',unit:'count'},{value:'conversions',label:'Conversions',unit:'count'},
 {value:'ctr',label:'CTR',unit:'%'},{value:'cvr',label:'CVR',unit:'%'},{value:'cpc',label:'CPC',unit:'money'}
];
const fmt=(v,unit,currency)=>v==null?'N/A':(unit==='money'?currency+' ':'')+String(v)+(unit==='%'?'%':unit==='x'?'×':'');
const n=v=>v==null?'N/A':Number(v).toLocaleString('en-IN');
const asPlot=v=>v==null||!Number.isFinite(Number(v))?null:Number(v);
const compact=new Intl.NumberFormat('en',{notation:'compact',maximumFractionDigits:2});
const dateRange=(a,b)=>a===b?a:a+' to '+b;
const evidenceNames={complete_observed:'Complete observed',observed_partial:'Partial observation',observed_adjustment:'Signed adjustment',data_gap:'Data gap'};
const evidenceTag=v=><Tag color={v==='complete_observed'?'green':v==='observed_partial'?'gold':'default'}>{evidenceNames[v]||'Unknown'}</Tag>;
const amount=(v,c)=>fmt(v,'money',c);
const metricMeta=k=>metricOptions.find(m=>m.value===k)||metricOptions[0];
const trendIsRatio=k=>['roas','acos','tacos','ctr','cvr','cpc'].includes(k);
const trendVal=(r,k)=>trendIsRatio(k)?r?.ratios?.[k]?.value:r?.totals?.[k];
const trendChange=(r,k)=>(trendIsRatio(k)?r.comparison?.ratios:r.comparison?.metrics)?.[k];
const trendCoverage=(r,k)=>(trendIsRatio(k)?r?.ratios:r?.coverage)?.[k]?.status;
const ProductCell=({row,onOpen})=><><Button type="link" className="ads-entity-link" onClick={()=>onOpen(row)}>{row.entityKey}</Button><div>{row.sellerName}</div><div className="ads-analytics-note">{row.title||row.marketplace}</div></>;
function Stat({label,value,note}){return <div className="ads-portfolio-stat"><span>{label}</span><strong>{value}</strong>{note&&<small>{note}</small>}</div>;}
function Concentration({group,onOpen}){
 const [metric,setMetric]=useState('totalSales');
 const m=group.concentration.find(x=>x.metric===metric)||group.concentration[0],currency=group.currency;
 if(!m)return null;
 return <>
  <div className="ads-analytics-toolbar">
   <div><strong>80% contribution analysis</strong><div className="ads-analytics-note">Positive observed product contributions, ranked by value.</div></div>
   <Select aria-label="Concentration metric" value={m.metric} onChange={setMetric} options={metricOptions.slice(0,3).map(({value,label})=>({value,label}))} style={{width:165}}/>
  </div>
  <div className="ads-portfolio-stats">
   <Stat label="Positive contribution" value={amount(m.positiveTotal,currency)} note={n(m.positiveEntities)+' positive products'}/>
   <Stat label="Leading 80% group" value={n(m.leadingCount)} note={m.leadingSharePct==null?'No positive population':m.leadingSharePct+'% actual contribution'}/>
   <Stat label="Remaining positive group" value={n(m.remainingCount)} note={m.remainingSharePct==null?'No positive population':m.remainingSharePct+'% actual contribution'}/>
   <Stat label="Net observed amount" value={amount(m.netObserved,currency)} note="Includes signed adjustments"/>
  </div>
  {m.positiveEntities>0&&<div className="ads-pareto-bar">
   <Progress percent={Math.min(100,Math.max(0,Number(m.leadingSharePct)))} showInfo={false} strokeColor="#2563eb" trailColor="#cbd5e1"/>
   <div className="ads-analytics-toolbar"><span>Leading: {amount(m.leadingAmount,currency)} ({m.leadingSharePct}%)</span><span>Remaining: {amount(m.remainingAmount,currency)} ({m.remainingSharePct}%)</span></div>
  </div>}
  <div className="ads-analytics-note">Excluded from the positive denominator: {n(m.zeroEntities)} explicit zero, {n(m.negativeEntities)} negative, {n(m.unknownEntities)} unknown, {n(m.priorOnlyEntities)} prior-only. {n(m.partialPositiveEntities)} positive products have incomplete observed date or field coverage. The crossing product is included; actual share may exceed 80%.</div>
  {m.samples.length===0?<Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No positive observed product contributions"/>:<>
   <div className="ads-analytics-note" style={{marginTop:12}}>Top {m.samples.length} of {n(m.positiveEntities)} positive products; counts and amounts above include the full matching population.</div>
   <div className="ads-table-shell"><Table size="small" tableLayout="fixed" rowKey="key" dataSource={m.samples} pagination={false} scroll={{x:1020}} columns={[
    {title:'Rank',dataIndex:'rank',width:65},
    {title:'ASIN / seller',width:220,render:(_,r)=><ProductCell row={r} onOpen={onOpen}/>},
    {title:metricMeta(m.metric).label,width:160,render:(_,r)=>amount(r.amount,currency)},
    {title:'Contribution',width:130,render:(_,r)=>fmt(r.sharePct,'%',currency)},
    {title:'Cumulative',width:130,render:(_,r)=>fmt(r.cumulativePct,'%',currency)},
    {title:'Group',width:155,render:(_,r)=><Tag color={r.tier==='leading_80'?'blue':'default'}>{r.tier==='leading_80'?'Leading 80%':'Remaining positive'}</Tag>},
    {title:'Coverage',width:170,render:(_,r)=>evidenceTag(r.coverage)}
   ]}/></div>
  </>}
 </>;
}
function Segments({group,onOpen}){
 const [code,setCode]=useState(null);
 const segments=group.segments||[],selected=segments.find(s=>s.code===code)||segments.find(s=>s.count>0)||segments[0],currency=group.currency;
 const observed=(r,k,unit)=>{const o=r.observed?.[k];return <>{fmt(o?.value,unit,currency)}<div className="ads-analytics-note">{n(o?.entities)} products observed</div></>;};
 const paired=(r,k,unit)=><>{fmt(r[k]?.value,unit,currency)}<div className="ads-analytics-note">{n(r[k]?.entities)} compatible products</div></>;
 return <>
  <div className="ads-portfolio-stats">
   <Stat label="Weighted ROAS reference" value={fmt(group.reference?.roas,'x',currency)} note="Compatible positive-spend observations"/>
   <Stat label="Reference products" value={n(group.reference?.eligibleEntities)} note={n(group.reference?.completeObservedEntities)+' complete observed'}/>
   <Stat label="Reference ad spend" value={amount(group.reference?.spend,currency)}/>
   <Stat label="Reference ad sales" value={amount(group.reference?.sales,currency)}/>
  </div>
  <div className="ads-analytics-note">One mutually exclusive segment per product. Reference ROAS is weighted by observed ad spend in the selected currency and filters, not a profitability target. Matrix totals are independently observed; rates use compatible eligible observations only.</div>
  <div className="ads-table-shell" style={{marginTop:10}}><Table size="small" tableLayout="fixed" rowKey="code" pagination={false} dataSource={segments} scroll={{x:1190}} columns={[
   {title:'Segment',width:245,render:(_,r)=><Button type="link" className="ads-entity-link" aria-pressed={selected?.code===r.code} onClick={()=>setCode(r.code)}>{r.label}</Button>},
   {title:'Products',width:90,render:(_,r)=>n(r.count)},
   {title:'Complete',width:100,render:(_,r)=>n(r.completeObserved)},
   {title:'Ad spend',width:150,render:(_,r)=>observed(r,'spend','money')},
   {title:'Ad sales',width:150,render:(_,r)=>observed(r,'sales','money')},
   {title:'Clicks',width:120,render:(_,r)=>observed(r,'clicks','count')},
   {title:'Conversions',width:125,render:(_,r)=>observed(r,'conversions','count')},
   {title:'ROAS',width:140,render:(_,r)=>paired(r,'compatibleRoas','x')},
   {title:'CVR',width:140,render:(_,r)=>paired(r,'compatibleCvr','%')}
  ]}/></div>
  {selected&&<>
   <Alert showIcon type="info" message={selected.label} description={selected.action} style={{margin:'12px 0'}}/>
   <div className="ads-analytics-note">Showing {selected.items.length} of {n(selected.count)} products in the selected segment.</div>
   <div className="ads-table-shell"><Table size="small" tableLayout="fixed" rowKey="key" pagination={false} dataSource={selected.items} scroll={{x:1150}} columns={[
    {title:'ASIN / seller',width:235,render:(_,r)=><ProductCell row={r} onOpen={onOpen}/>},
    {title:'Spend',width:145,render:(_,r)=>amount(r.spend,currency)},{title:'Ad sales',width:145,render:(_,r)=>amount(r.sales,currency)},
    {title:'Total sales',width:145,render:(_,r)=>amount(r.totalSales,currency)},{title:'ROAS',width:95,render:(_,r)=>fmt(r.roas,'x',currency)},
    {title:'CVR',width:95,render:(_,r)=>fmt(r.cvr,'%',currency)},{title:'Evidence',width:260,render:(_,r)=><>{evidenceTag(r.evidenceStatus)}<div className="ads-analytics-note">Dates: {r.currentDays??'N/A'}/{r.expectedDays}; spend rows: {r.spendRows??'N/A'}/{r.currentRows??'N/A'}; sales rows: {r.salesRows??'N/A'}/{r.currentRows??'N/A'}</div></>}
   ]}/></div>
  </>}
 </>;
}
function ExactTooltip({active,payload,meta,currency}){
 if(!active||!payload?.length)return null;
 const r=payload[0]?.payload?.row;if(!r)return null;
 return <div className="ads-portfolio-tooltip">
  <strong>{meta.label}</strong>
  <div>Current {dateRange(r.currentStart,r.currentEnd)}: {fmt(trendVal(r.current,meta.value),meta.unit,currency)}</div>
  <div>Prior {dateRange(r.previousStart,r.previousEnd)}: {fmt(trendVal(r.previous,meta.value),meta.unit,currency)}</div>
  <div className="ads-analytics-note">Calendar days: {r.current?.coveredDays??'N/A'}/{r.days} current; {r.previous?.coveredDays??'N/A'}/{r.days} prior.</div>
 </div>;
}
function Trends({rows,currency,granularity,onGranularity}){
 const [metric,setMetric]=useState('totalSales'),meta=metricMeta(metric);
 const data=useMemo(()=>rows.map(r=>({bucket:r.bucket,current:asPlot(trendVal(r.current,metric)),previous:asPlot(trendVal(r.previous,metric)),row:r})),[rows,metric]);
 const has=data.some(r=>r.current!==null||r.previous!==null);
 return <>
  <div className="ads-analytics-toolbar">
   <div><strong>Aligned period trends</strong><div className="ads-analytics-note">Prior dates are aligned to equal-length current day, week or month slices.</div></div>
   <div className="ads-portfolio-controls">
    <Select aria-label="Portfolio trend granularity" value={granularity} onChange={onGranularity} options={[{value:'day',label:'Daily'},{value:'week',label:'Weekly'},{value:'month',label:'Monthly'}]} style={{width:120}}/>
    <Select aria-label="Portfolio trend metric" value={metric} onChange={setMetric} options={metricOptions.map(({value,label})=>({value,label}))} style={{width:160}}/>
   </div>
  </div>
  <div className="ads-analytics-note">Missing buckets are gaps, not zeros. Chart coordinates are approximate; hover values and table values use exact source aggregates. Partial observations remain visible and labelled.</div>
  {has?<div className="ads-portfolio-chart" role="img" aria-label={meta.label+' current and prior aligned trend, exact values in the table below'}>
   <ResponsiveContainer width="100%" height={270} minWidth={0}>
    <LineChart data={data} margin={{top:10,right:10,left:4,bottom:8}}>
     <CartesianGrid strokeDasharray="3 3" vertical={false}/>
     <XAxis dataKey="bucket" minTickGap={30} tick={{fontSize:11}}/>
     <YAxis width={60} tickFormatter={v=>compact.format(v)} tick={{fontSize:11}}/>
     <Tooltip content={<ExactTooltip meta={meta} currency={currency}/>}/>
     <Legend/>
     <Line dataKey="current" name="Current" stroke="#2563eb" strokeWidth={2} connectNulls={false} dot={data.length<=31} isAnimationActive={false}/>
     <Line dataKey="previous" name="Prior aligned" stroke="#64748b" strokeDasharray="5 4" strokeWidth={2} connectNulls={false} dot={data.length<=31} isAnimationActive={false}/>
    </LineChart>
   </ResponsiveContainer>
  </div>:<Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No observed values for this metric"/>}
  <div className="ads-table-shell"><Table size="small" tableLayout="fixed" rowKey="bucket" dataSource={rows} pagination={{pageSize:10,showSizeChanger:false}} scroll={{x:1050}} columns={[
   {title:'Current dates',width:180,render:(_,r)=>dateRange(r.currentStart,r.currentEnd)},
   {title:'Aligned prior dates',width:180,render:(_,r)=>dateRange(r.previousStart,r.previousEnd)},
   {title:'Current',width:145,render:(_,r)=>fmt(trendVal(r.current,metric),meta.unit,currency)},
   {title:'Prior',width:145,render:(_,r)=>fmt(trendVal(r.previous,metric),meta.unit,currency)},
   {title:'Change',width:185,render:(_,r)=><DeltaText change={trendChange(r,metric)} currency={currency} money={meta.unit==='money'&&!trendIsRatio(metric)}/>},
   {title:'Coverage',width:235,render:(_,r)=><><div>{r.current?.coveredDays??'N/A'}/{r.days} current · {r.previous?.coveredDays??'N/A'}/{r.days} prior</div><div className="ads-analytics-note">{trendCoverage(r.current,metric)?.replaceAll('_',' ')||'unknown'} / {trendCoverage(r.previous,metric)?.replaceAll('_',' ')||'unknown'}</div></>}
  ]}/></div>
 </>;
}
function Breakdown({data,currency,dimension,onFilter}){
 const group=data.find(x=>x.currency===currency&&x.dimension===dimension);
 if(!group)return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No comparison groups in this selection"/>;
 return <>
  <div className="ads-analytics-note">Showing {group.items.length} of {n(group.totalGroups)} {dimension} / marketplace groups, ranked by observed current total sales. Unknown brands remain separate. Currency and marketplace groups are never merged.</div>
  <div className="ads-table-shell" style={{marginTop:8}}><Table size="small" tableLayout="fixed" rowKey="key" pagination={false} dataSource={group.items} scroll={{x:1320}} columns={[
   {title:dimension==='seller'?'Seller / marketplace':'Brand / marketplace',width:240,render:(_,r)=><>{r.groupKey?<Button type="link" className="ads-entity-link" onClick={()=>onFilter(dimension,r)}>{r.label}</Button>:r.label}<div className="ads-analytics-note">{r.marketplace}</div></>},
   ...[['Total sales','totalSales','money'],['Ad sales','sales','money'],['Spend','spend','money'],['ACoS','acos','%'],['ROAS','roas','x'],['CVR','cvr','%']].map(([label,key,unit])=>({
    title:label,width:170,render:(_,r)=><>{fmt(trendVal(r.current,key),unit,currency)}<div className="ads-analytics-note">Prior: {fmt(trendVal(r.previous,key),unit,currency)}</div><DeltaText change={trendChange(r,key)} currency={currency} money={unit==='money'}/></>
   }))
  ]}/></div>
 </>;
}
export default function AdsPortfolioPanel({portfolio,requested,onAnalyze,onOpen,onFilter,granularity,onGranularity}){
 const [currency,setCurrency]=useState(null),[tab,setTab]=useState('concentration');
 const data=portfolio.data,groups=data?.groups||[],group=groups.find(g=>g.currency===currency)||groups[0];
 return <Card size="small" title="Portfolio intelligence" data-testid="ads-portfolio-panel">
  <div className="ads-analytics-toolbar">
   <Typography.Text type="secondary">Concentration, efficiency segments, trends and seller / brand comparisons across all matching products.</Typography.Text>
   <Button type={requested?'default':'primary'} onClick={onAnalyze} loading={requested&&portfolio.isFetching}>{requested?'Refresh portfolio':'Analyze portfolio'}</Button>
  </div>
  {!requested?<div className="ads-analytics-note">Run on demand. The analysis is independent of product table pagination.</div>:portfolio.isError?<Alert showIcon type="error" message={portfolio.error?.response?.data?.message||'Portfolio analytics could not be loaded.'}/>:portfolio.isPending?<div className="ads-inline-loading"><Spin size="small"/> Analyzing the authorized portfolio…</div>:data?.empty||!group?<Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No matching products for portfolio analysis"/>:<>
   <div className="ads-analytics-toolbar"><div><strong>{n(group.totalEntities)} products</strong> · {n(group.currentEntities)} with current records</div>
    {groups.length>1&&<Select aria-label="Portfolio currency" value={group.currency} onChange={setCurrency} options={groups.map(g=>({value:g.currency,label:g.currency}))} style={{width:130}}/>}
   </div>
   <Tabs activeKey={tab} onChange={setTab} items={[
    {key:'concentration',label:'80% concentration',children:<Concentration group={group} onOpen={onOpen}/>},
    {key:'segments',label:'Efficiency matrix',children:<Segments group={group} onOpen={onOpen}/>},
    {key:'trends',label:'Aligned trends',children:<Trends rows={(data.trends||[]).filter(r=>r.currency===group.currency)} currency={group.currency} granularity={granularity} onGranularity={onGranularity}/>},
    {key:'sellers',label:'Seller comparison',children:<Breakdown data={data.breakdowns||[]} currency={group.currency} dimension="seller" onFilter={onFilter}/>},
    {key:'brands',label:'Brand comparison',children:<Breakdown data={data.breakdowns||[]} currency={group.currency} dimension="brand" onFilter={onFilter}/>}
   ]}/>
  </>}
 </Card>;
}
