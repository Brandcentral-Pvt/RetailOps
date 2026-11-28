import React,{useState} from 'react';
import {Alert,Button,Card,Empty,Select,Space,Spin,Table,Tag,Typography} from 'antd';
import {formatAdsValue,adsCount} from './adsNumberFormat.mjs';

const labels={comparable:'Complete observed coverage',partial_coverage:'Partial field coverage',incomplete_calendar:'Incomplete dates',missing_current:'No current records',missing_previous:'No prior records',unknown_value:'Unknown metric',incompatible_coverage:'Incompatible coverage',currency_mismatch:'Different currencies'};
const evidenceLabels={complete_observed:'Complete observed coverage',observed_partial:'Partial observation',data_gap:'Data quality'};
const metricRows=[
 ['Ad spend','spend','money'],['Ad sales','sales','money'],['Total sales','totalSales','money'],
 ['Organic sales','organicSales','money'],['Ad orders','orders','count'],['Conversions','conversions','count'],
 ['Total orders','totalOrders','count'],['Impressions','impressions','count'],['Clicks','clicks','count'],
 ['CTR','ctr','%'],['CVR','cvr','%'],['Order rate','orderRate','%'],['ACoS','acos','%'],['TACoS','tacos','%'],
 ['ROAS','roas','x'],['CPC','cpc','currency'],['CPM','cpm','currency'],['Cost per ad order','costPerOrder','currency'],
 ['Ad AOV (per conversion)','aov','currency'],['Ad revenue per order','revenuePerOrder','currency'],['Ad sales share','adSharePct','%']
];
const value=(v,unit,currency)=>formatAdsValue(v,unit,currency);
function deltaLabel(change,{money=false,currency}={}){
 if(!change)return null;
 const comparable=change.status==='comparable';
 const delta=comparable?change.delta:change.observedDelta;
 if(delta==null)return null;
 const pct=comparable?change.percentChange:change.observedPercentChange;
 const unit=change.unit==='pp'?'pp':change.unit==='x'?'x':change.unit==='currency'||money?'money':'count';
 return formatAdsValue(delta,unit,currency,{signed:true})+(pct!=null?' ('+formatAdsValue(pct,'%',null,{signed:true})+')':'');
}
export function DeltaText({change,money,currency}){
 const label=deltaLabel(change,{money,currency});
 if(!change||!label)return null;
 return <div className="ads-delta" title={labels[change.status]||change.status}>
  {change.status!=='comparable'?'Observed only: ':'Change: '}{label}
 </div>;
}
const metricValue=(s,key,unit)=>['money','count'].includes(unit)?s?.totals?.[key]:s?.ratios?.[key]?.value;
export function AdsComparisonPanel({report}){
 const [selected,setSelected]=useState(null);
 const currencies=report?.comparisons||[];
 if(!currencies.length)return null;
 const c=currencies.find(r=>r.currency===selected)||currencies[0],currency=c.currency;
 const current=report.current.find(r=>r.currency===currency),previous=report.previous.find(r=>r.currency===currency);
 const rows=metricRows.map(([label,key,unit])=>{
  const additive=['money','count'].includes(unit);
  const change=(additive?c.metrics:c.ratios)?.[key];
  return {key,label,unit,change,current:metricValue(current,key,unit),previous:metricValue(previous,key,unit),
   coverageCurrent:(additive?current?.coverage:current?.ratios)?.[key]?.status,
   coveragePrevious:(additive?previous?.coverage:previous?.ratios)?.[key]?.status};
 });
 return <Card size="small" title="Comparative performance & efficiency" data-testid="ads-comparison-panel">
  <div className="ads-analytics-toolbar">
   <div><strong>{currency}</strong><div className="ads-analytics-note">Observed calendar days: {c.currentDays??'N/A'} / {c.expectedDays} current; {c.previousDays??'N/A'} / {c.expectedDays} prior.</div></div>
   {currencies.length>1&&<Select aria-label="Comparison currency" value={currency} onChange={setSelected} options={currencies.map(r=>({value:r.currency,label:r.currency}))} style={{width:140}}/>}
  </div>
  <div className="ads-analytics-note">Changes use equal-length periods. Observed-only deltas are not complete-period growth claims. Complete coverage refers to stored facts, not proof of a complete catalog.</div>
  <div className="ads-table-shell" style={{marginTop:10}}>
   <Table size="small" tableLayout="fixed" rowKey="key" pagination={{pageSize:10,showSizeChanger:false}} dataSource={rows} scroll={{x:900}} columns={[
    {title:'Metric',dataIndex:'label',width:200},
    {title:'Current',width:155,render:(_,r)=>value(r.current,r.unit,currency)},
    {title:'Previous',width:155,render:(_,r)=>value(r.previous,r.unit,currency)},
    {title:'Change',width:220,render:(_,r)=>{const label=deltaLabel(r.change,{money:r.unit==='money',currency});return <>{label||'N/A'}{label&&r.change?.status!=='comparable'&&<div className="ads-analytics-note">Observed only</div>}{r.change?.percentageStatus==='nonpositive_baseline'&&<div className="ads-analytics-note">No positive baseline for % change</div>}</>;}},
    {title:'Coverage',width:230,render:(_,r)=><><Tag color={r.change?.status==='comparable'?'green':r.change?.status==='partial_coverage'||r.change?.status==='incomplete_calendar'?'gold':'default'}>{labels[r.change?.status]||'Unavailable'}</Tag><div className="ads-analytics-note">Current: {r.coverageCurrent?.replaceAll('_',' ')||'unknown'}; prior: {r.coveragePrevious?.replaceAll('_',' ')||'unknown'}</div></>}
   ]}/>
  </div>
 </Card>;
}
export function AdsOpportunityPanel({review,requested,onAnalyze,onOpen,days}){
 const [selectedCurrency,setCurrency]=useState(null),[selectedCode,setCode]=useState(null);
 const data=review.data;
 const populations=data?.populations||[];
 const population=populations.find(p=>p.currency===selectedCurrency)||populations[0];
 const currency=population?.currency;
 const signals=(data?.signals||[]).filter(s=>s.currency===currency);
 const signal=signals.find(s=>s.code===selectedCode)||signals.find(s=>s.count!=='0')||signals[0];
 return <Card size="small" title="Product review signals" data-testid="ads-opportunities">
  <div className="ads-analytics-toolbar">
   <Typography.Text type="secondary">Review all matching ASINs across sellers, not just the current page.</Typography.Text>
   <Button type={requested?'default':'primary'} onClick={onAnalyze} loading={requested&&review.isFetching}>{requested?'Refresh analysis':'Analyze products'}</Button>
  </div>
  {!requested?<div className="ads-analytics-note">Run the analysis on demand to identify efficiency changes and data-quality gaps.</div>:review.isError?<Alert showIcon type="error" message={review.error?.response?.data?.message||'Product review could not be loaded.'}/>:review.isPending?<div className="ads-inline-loading"><Spin size="small"/> Analyzing the authorized report population…</div>:data?.empty||!population?<Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No matching products to review"/>:<>
   <div className="ads-analytics-toolbar">
    <div><strong>{adsCount(population.totalEntities)} products reviewed</strong> · {adsCount(population.currentEntities)} current · {adsCount(population.previousEntities)} prior<div className="ads-analytics-note">{adsCount(population.currentFullCalendar)} products have all {days} current dates; {adsCount(population.alignedSpendSales)} have aligned observed spend and ad sales.</div></div>
    {populations.length>1&&<Select aria-label="Review currency" value={currency} onChange={setCurrency} options={populations.map(p=>({value:p.currency,label:p.currency}))} style={{width:130}}/>}
   </div>
   <div className="ads-signal-grid">
    {signals.map(s=><button key={s.code} type="button" className={'ads-signal-choice'+(signal?.code===s.code?' active':'')} aria-pressed={signal?.code===s.code} onClick={()=>setCode(s.code)}>
     <strong>{adsCount(s.count)}</strong><span>{s.label}</span>
    </button>)}
   </div>
   {signal&&<>
    <Alert type="info" showIcon message={signal.label} description={<>{signal.description} {signal.action}</>} style={{margin:'12px 0'}}/>
    <div className="ads-analytics-note">Showing {adsCount(signal.sampleCount)} of {adsCount(signal.count)} matches in {currency}. Signals may overlap. These are review prompts, not automated bid or budget instructions.</div>
    <div className="ads-table-shell" style={{marginTop:8}}><Table tableLayout="fixed" size="small" rowKey="key" dataSource={signal.items} pagination={false} scroll={{x:1260}} columns={[
     {title:'ASIN / seller',width:230,render:(_,r)=><><Button type="link" className="ads-entity-link" onClick={()=>onOpen(r)}>{r.entityKey}</Button><div>{r.sellerName}</div><div className="ads-analytics-note">{r.title||r.marketplace}</div></>},
     {title:'Ad spend',width:145,render:(_,r)=><>{value(r.spend,'money',currency)}<div className="ads-analytics-note">Prior: {value(r.priorSpend,'money',currency)}</div></>},
     {title:'Ad sales',width:145,render:(_,r)=><>{value(r.sales,'money',currency)}<div className="ads-analytics-note">Prior: {value(r.priorSales,'money',currency)}</div></>},
     {title:'Total sales',width:145,render:(_,r)=>value(r.totalSales,'money',currency)},
     {title:'Clicks',width:100,render:(_,r)=>value(r.clicks,'count',currency)},
     {title:'Conversions',width:110,render:(_,r)=>value(r.conversions,'count',currency)},
     {title:'Evidence',width:300,render:(_,r)=><><Tag color={r.evidenceStatus==='complete_observed'?'green':r.evidenceStatus==='observed_partial'?'gold':'default'}>{evidenceLabels[r.evidenceStatus]||r.evidenceStatus}</Tag><div className="ads-analytics-note">Dates: {r.currentDays??'N/A'}/{days}; prior: {r.previousDays??'N/A'}/{days}. Spend rows: {adsCount(r.spendRows)}/{adsCount(r.currentRows)}; ad sales rows: {adsCount(r.salesRows)}/{adsCount(r.currentRows)}.</div></>}
    ]}/></div>
   </>}
  </>}
 </Card>;
}
