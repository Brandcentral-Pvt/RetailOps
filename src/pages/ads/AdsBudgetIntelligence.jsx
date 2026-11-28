import React,{useMemo,useState} from 'react';
import {Alert,Button,Card,Descriptions,Empty,Modal,Progress,Segmented,Select,Spin,Table,Tag,Typography} from 'antd';

const labels={
 configured:'Configured',missing_target:'Target not configured',conflicting_target:'Conflicting target',unverified_context:'Unverified seller context',
 context_conflict:'Marketplace / currency conflict',not_started:'Not started',insufficient_coverage:'Insufficient coverage',
 signed_adjustment:'Signed adjustments',comparable:'Complete observed coverage',schedule_conflict:'Weekly schedule conflict',
 ahead_of_plan:'Above planned spend',behind_plan:'Below planned spend',on_plan:'On planned spend',
 above_target:'Above ACoS target',below_target:'Below ACoS target',at_target:'At ACoS target',
 calendar_linear:'Linear calendar reference',configured_weeks:'Configured weekly allocations',
 valid:'Valid',not_configured:'Not configured',linear_scenario:'Linear scenario',month_closed:'Month fully elapsed',
 complete:'Complete observed',partial:'Partial observation',unknown:'Unknown',incompatible_coverage:'Incompatible coverage',
 complete_observed:'Complete observed',observed_partial:'Observed only',missing_product:'No product records',missing_seller:'No seller records',
 unknown_value:'Unknown value',nonpositive_denominator:'Nonpositive reference denominator'
};
const label=v=>labels[v]||String(v||'Unknown').replaceAll('_',' ');
const fmt=(v,c,suffix='')=>v==null?'N/A':(c?c+' ':'')+String(v)+suffix;
const sign=v=>v==null?null:String(v).startsWith('-')||v==='0'?String(v):'+'+v;
const dayRange=s=>s?.through?(s.start===s.through?s.start:s.start+' to '+s.through):'Not started';
const color=status=>['above_target','context_conflict','conflicting_target','schedule_conflict'].includes(status)?'volcano':
 ['below_target','at_target','on_plan','comparable','complete','complete_observed'].includes(status)?'green':
 ['insufficient_coverage','signed_adjustment','observed_partial','partial','ahead_of_plan','incompatible_coverage'].includes(status)?'gold':'default';
const Status=({status})=><Tag color={color(status)}>{label(status)}</Tag>;
function Fact({title,children}){return <div className="ads-portfolio-stat"><span>{title}</span><strong>{children}</strong></div>;}
function BudgetDetail({row,onClose}){
 const b=row?.budget||{},a=row?.acos||{},cov=row?.coverage||{},slice=row?.slice||{},currency=row?.currency;
 return <Modal open={!!row} onCancel={onClose} width="min(860px, 95vw)" title={row?row.sellerName+' | '+row.month:'Budget details'} rootClassName="ads-budget-detail"
  styles={{body:{maxHeight:'65vh',overflowY:'auto'}}} footer={<Button onClick={onClose}>Close</Button>}>
  {row&&<>
   <div className="ads-analytics-note">{row.marketplace||'Unverified marketplace'} · {currency||'Unverified currency'} · {dayRange(slice)}</div>
   <div className="ads-portfolio-stats">
    <Fact title="Monthly budget">{fmt(b.target,currency)}</Fact>
    <Fact title="Planned through cutoff">{fmt(b.plannedSpend,currency)}</Fact>
    <Fact title="Observed net spend">{fmt(b.actualSpend,currency)}</Fact>
    <Fact title="Remaining budget">{fmt(b.remainingBudget,currency)}</Fact>
   </div>
   {b.observedOverBudget&&<Alert type="warning" showIcon message="Observed spend exceeds the monthly allocation" description="This uses the net spend actually present in stored records. Missing data or later adjustments can change the final result."/>}
   <Descriptions bordered size="small" column={{xs:1,sm:2}} style={{margin:'12px 0'}} items={[
    {key:'source',label:'Target source',children:b.targetSource||'N/A'},
    {key:'coverage',label:'Budget evidence',children:<Status status={b.status}/>},
    {key:'plan',label:'Plan basis',children:label(b.planSource)},
    {key:'planStatus',label:'Plan validation',children:<Status status={b.planStatus}/>},
    {key:'elapsed',label:'Elapsed / remaining days',children:(slice.elapsed??'N/A')+' / '+(slice.remaining??'N/A')},
    {key:'pace',label:'Pacing status',children:<Status status={b.paceStatus}/>},
    {key:'utilization',label:'Observed utilization',children:fmt(b.observedUtilizationPct,null,'%')},
    {key:'verifiedUtilization',label:'Comparable utilization',children:fmt(b.utilizationPct,null,'%')},
    {key:'variance',label:'Variance to plan',children:fmt(sign(b.varianceToPlan),currency)},
    {key:'projection',label:'Month-end scenario',children:fmt(b.projectedMonthEnd,currency)},
    {key:'projectionVariance',label:'Scenario vs allocation',children:fmt(sign(b.projectedVariance),currency)},
    {key:'allowance',label:'Remaining daily ceiling',children:fmt(b.remainingDailyAllowance,currency)},
    {key:'forecast',label:'Scenario status',children:label(b.forecastStatus)},
    {key:'context',label:'Seller context',children:label(row.contextStatus)}
   ]}/>
   <Typography.Text strong>ACoS target assessment</Typography.Text>
   <Descriptions bordered size="small" column={{xs:1,sm:2}} style={{margin:'8px 0 12px'}} items={[
    {key:'target',label:'Configured ACoS',children:fmt(a.target,null,'%')},
    {key:'actual',label:'Compatible observed ACoS',children:fmt(a.actual,null,'%')},
    {key:'gap',label:'Gap to target',children:fmt(sign(a.gapPp),null,' pp')},
    {key:'status',label:'Assessment',children:<Status status={a.status}/>},
    {key:'coverage',label:'Field / date coverage',children:label(a.coverage)},
    {key:'source',label:'Target source',children:a.targetSource||'N/A'}
   ]}/>
   <Typography.Text strong>Reporting evidence</Typography.Text>
   <Descriptions bordered size="small" column={{xs:1,sm:2}} style={{marginTop:8}} items={[
    {key:'calendar',label:'Stored fact days',children:(cov.coveredDays??0)+' / '+(slice.elapsed??0)},
    {key:'rows',label:'Stored fact rows',children:cov.rowCount??'N/A'},
    {key:'spend',label:'Spend coverage',children:(cov.spendRows??0)+' / '+(cov.rowCount??0)+' rows'},
    {key:'sales',label:'Ad sales coverage',children:(cov.salesRows??0)+' / '+(cov.rowCount??0)+' rows'},
    {key:'spendDays',label:'Days with spend values',children:cov.spendDays??0},
    {key:'salesDays',label:'Days with sales values',children:cov.salesDays??0},
    {key:'paired',label:'Paired spend / sales rows',children:cov.pairedRows??0},
    {key:'adjustments',label:'Negative spend / sales rows',children:(cov.negativeSpendRows??0)+' / '+(cov.negativeSalesRows??0)}
   ]}/>
   <p className="ads-analytics-note" style={{marginTop:10}}>The remaining daily ceiling is arithmetic, not a spend instruction. The month-end scenario assumes the same observed daily rate, not a prediction. Complete coverage means stored facts only; it does not establish that every source report or product was supplied. Lower ACoS is better.</p>
  </>}
 </Modal>;
}
export function AdsBudgetPanel({applicable,budget,onRetry}){
 const [month,setMonth]=useState(undefined),[filter,setFilter]=useState('all'),[selectedKey,setSelectedKey]=useState(null);
 const data=budget.data,rows=data?.rows||[];
 const months=[...new Set(rows.map(r=>r.month))].sort();
 const effectiveMonth=months.includes(month)?month:undefined;
 const shown=useMemo(()=>rows.filter(r=>(!effectiveMonth||r.month===effectiveMonth)&&(
  filter==='all'||filter==='above_plan'&&r.budget?.paceStatus==='ahead_of_plan'||
  filter==='over_budget'&&r.budget?.observedOverBudget===true||
  filter==='acos_above'&&r.acos?.status==='above_target'||
  filter==='missing_target'&&(r.budget?.targetStatus==='missing_target'||r.acos?.targetStatus==='missing_target')||
  filter==='data_gaps'&&(!['comparable','not_started','missing_target'].includes(r.budget?.status)||r.budget?.paceStatus==='schedule_conflict'||!['above_target','below_target','at_target','not_started','missing_target'].includes(r.acos?.status))
 )),[rows,effectiveMonth,filter]);
 const selected=applicable?rows.find(r=>r.key===selectedKey):null;
 const statRows=effectiveMonth?rows.filter(r=>r.month===effectiveMonth):rows;
 return <Card size="small" title="Seller targets & budget pacing" data-testid="ads-budget-panel">
  {!applicable?<Alert type="info" message="Clear brand, category, marketplace and product search to compare seller-wide targets."/>:
   budget.isError?<Alert showIcon type="error" message={budget.error?.response?.data?.message||'Budget intelligence could not be loaded.'} action={<Button onClick={onRetry}>Retry budget</Button>}/>:
   budget.isPending?<div className="ads-inline-loading"><Spin size="small"/> Loading seller budgets…</div>:<>
    <div className="ads-analytics-toolbar">
     <div><Typography.Text strong>Month-to-date budget assessment</Typography.Text><div className="ads-analytics-note">Reporting cutoff: {data?.asOf||'N/A'}. Each month includes records from its first day, even before the selected start date. The cutoff excludes the current UTC day.</div></div>
     <Button onClick={onRetry} loading={budget.isFetching}>Refresh budgets</Button>
    </div>
    {!rows.length?<Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No seller targets in the selected period"/>:<>
     <div className="ads-portfolio-stats">
      <Fact title="Seller-month groups">{statRows.length}</Fact>
      <Fact title="Complete budget evidence">{statRows.filter(r=>r.budget?.status==='comparable').length}</Fact>
      <Fact title="Observed above budget">{statRows.filter(r=>r.budget?.observedOverBudget===true).length}</Fact>
      <Fact title="ACoS above target">{statRows.filter(r=>r.acos?.status==='above_target').length}</Fact>
     </div>
     <div className="ads-analytics-toolbar">
      <div className="ads-portfolio-controls">
       <Select id="ads-budget-month" aria-label="Budget month" allowClear placeholder="All months" value={effectiveMonth} onChange={setMonth} options={months.map(value=>({value,label:value}))} style={{width:140}}/>
       <Select id="ads-budget-filter" aria-label="Budget review filter" value={filter} onChange={setFilter} style={{width:195}} options={[
        {value:'all',label:'All budget groups'},{value:'above_plan',label:'Above planned spend'},{value:'over_budget',label:'Observed above budget'},
        {value:'acos_above',label:'ACoS above target'},{value:'missing_target',label:'Missing targets'},{value:'data_gaps',label:'Data / plan conflicts'}
       ]}/>
      </div>
      <Typography.Text type="secondary">{shown.length} of {statRows.length} groups</Typography.Text>
     </div>
     <div className="ads-table-shell" data-testid="ads-target-table">
      <Table size="small" tableLayout="fixed" rowKey="key" dataSource={shown} loading={budget.isFetching} pagination={{pageSize:10,showSizeChanger:false}} scroll={{x:2050}} columns={[
       {title:'Seller / month',width:245,fixed:'left',className:'ads-pinned-cell',onHeaderCell:()=>({className:'ads-pinned-cell'}),render:(_,r)=><>
        <Button type="link" className="ads-entity-link" aria-label={'Budget details '+r.sellerName+' '+r.month} onClick={()=>setSelectedKey(r.key)}>{r.sellerName}</Button>
        <div className="ads-analytics-note">{r.month} · {r.marketplace||'Unverified'} · {r.currency||'N/A'}</div>
       </>},
       {title:'Monthly budget',width:155,render:(_,r)=><>{fmt(r.budget.target,r.currency)}<div className="ads-analytics-note">{r.budget.targetSource||label(r.budget.targetStatus)}</div></>},
       {title:'Planned through cutoff',width:180,render:(_,r)=><>{fmt(r.budget.plannedSpend,r.currency)}<div className="ads-analytics-note">{label(r.budget.planSource)}</div></>},
       {title:'Observed spend',width:165,render:(_,r)=><>{fmt(r.budget.actualSpend,r.currency)}<div className="ads-analytics-note">{r.coverage.coveredDays}/{r.slice.elapsed} stored days</div></>},
       {title:'Utilization',width:165,render:(_,r)=>{
        const b=r.budget,v=b.utilizationPct??b.observedUtilizationPct;
        return <>{fmt(v,null,'%')}{v!=null&&<><div className="ads-analytics-note">{b.utilizationPct==null?'Observed only':'Comparable'}</div><Progress percent={Math.max(0,Math.min(100,Number(v)))} showInfo={false} size="small" status={b.observedOverBudget?'exception':'normal'}/></>}</>;
       }},
       {title:'Variance / pacing',width:205,render:(_,r)=><>{fmt(sign(r.budget.varianceToPlan),r.currency)}<div><Status status={r.budget.paceStatus}/></div></>},
       {title:'Remaining budget',width:160,render:(_,r)=>fmt(r.budget.remainingBudget,r.currency)},
       {title:'Month-end scenario',width:190,render:(_,r)=><>{fmt(r.budget.projectedMonthEnd,r.currency)}<div className="ads-analytics-note">{label(r.budget.forecastStatus)}</div></>},
       {title:'Daily ceiling',width:155,render:(_,r)=>fmt(r.budget.remainingDailyAllowance,r.currency)},
       {title:'ACoS actual / target',width:190,render:(_,r)=><>{fmt(r.acos.actual,null,'%')} / {fmt(r.acos.target,null,'%')}<div><Status status={r.acos.status}/></div></>},
       {title:'Coverage',width:205,render:(_,r)=><><Status status={r.budget.status}/><div className="ads-analytics-note">Spend: {r.coverage.spendRows}/{r.coverage.rowCount} rows</div></>}
      ]}/>
     </div>
     <div className="ads-analytics-note">Currency amounts are never added across sellers or currencies here. Above plan is not automatically poor performance. Remaining budget, variance and extrapolation require compatible verified context, complete stored date/field coverage and no signed spend adjustments. Lower ACoS is better.</div>
    </>}
   </>}
  <BudgetDetail row={selected} onClose={()=>setSelectedKey(null)}/>
 </Card>;
}
const shareNames={spend:'Ad spend',sales:'Attributed ad sales',totalSales:'Explicit total sales',clicks:'Clicks',conversions:'Conversions'};
const ratioNames={acos:'ACoS',tacos:'TACoS',roas:'ROAS',ctr:'CTR',cvr:'CVR',cpc:'CPC',costPerOrder:'Cost per ad order'};
const observationNames={daysWithFacts:'Days with stored facts',positiveSpendDays:'Days with positive spend',zeroNetSalesSpendDays:'Spend with zero net ad sales',missingSalesSpendDays:'Spend with missing ad sales',clicksZeroConversionDays:'Clicks with zero net conversions',signedAdjustmentDays:'Days with signed adjustments'};
function ratioFmt(v,k,c){return fmt(v,['cpc','costPerOrder'].includes(k)?c:null,k==='roas'?'×':['cpc','costPerOrder'].includes(k)?'':'%');}
export function AdsProductDiagnosticPanel({diagnostics}){
 const [period,setPeriod]=useState('current');
 if(!diagnostics)return null;
 const d=diagnostics[period],currency=diagnostics.currency;
 const shareRows=Object.entries(d?.shares||{}).map(([key,r])=>({key,...r}));
 const benchmarkRows=Object.entries(d?.benchmarks||{}).map(([key,r])=>({key,...r}));
 return <Card size="small" title="ASIN contribution & diagnostics" data-testid="ads-product-diagnostics" style={{marginBottom:10}}>
  <div className="ads-analytics-toolbar">
   <Typography.Text type="secondary">{diagnostics.asin} · {diagnostics.marketplace} · {currency}</Typography.Text>
   <Segmented aria-label="Diagnostic comparison period" value={period} onChange={setPeriod} options={[{label:'Current',value:'current'},{label:'Previous',value:'previous'}]}/>
  </div>
  <div className="ads-analytics-note">Reference is the full same seller / marketplace / currency portfolio, including this ASIN, for the selected period. Product metadata filters are not applied to the reference. These are observed contributions, not product-level budget targets.</div>
  {!d?.product?<Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No product records for this period"/>:<>
   <div className="ads-portfolio-stats" style={{marginTop:12}}>
    <Fact title="Product share of seller spend">{fmt(d.shares?.spend?.value,null,'%')}</Fact>
    <Fact title="Product share of seller ad sales">{fmt(d.shares?.sales?.value,null,'%')}</Fact>
    <Fact title="Product share of seller total sales">{fmt(d.shares?.totalSales?.value,null,'%')}</Fact>
    <Fact title="Stored product days">{d.product.coveredDays??'N/A'} / {d.days}</Fact>
   </div>
   <div className="ads-table-shell"><Table size="small" tableLayout="fixed" rowKey="key" dataSource={shareRows} pagination={false} scroll={{x:800}} columns={[
    {title:'Metric',width:175,render:(_,r)=>shareNames[r.key]||r.key},
    {title:'Product',width:145,render:(_,r)=>fmt(r.product,['spend','sales','totalSales'].includes(r.key)?currency:null)},
    {title:'Seller portfolio',width:155,render:(_,r)=>fmt(r.seller,['spend','sales','totalSales'].includes(r.key)?currency:null)},
    {title:'Contribution',width:125,render:(_,r)=>fmt(r.value,null,'%')},
    {title:'Evidence',width:185,render:(_,r)=><Status status={r.status}/>}
   ]}/></div>
   <Typography.Text strong style={{display:'block',margin:'14px 0 6px'}}>Efficiency benchmark</Typography.Text>
   <div className="ads-table-shell"><Table size="small" tableLayout="fixed" rowKey="key" dataSource={benchmarkRows} pagination={false} scroll={{x:820}} columns={[
    {title:'Metric',width:160,render:(_,r)=>ratioNames[r.key]||r.key},
    {title:'Product',width:130,render:(_,r)=>ratioFmt(r.product,r.key,currency)},
    {title:'Seller reference',width:150,render:(_,r)=>ratioFmt(r.seller,r.key,currency)},
    {title:'Gap',width:185,render:(_,r)=><>{fmt(sign(r.delta??r.observedDelta),r.unit==='currency'?currency:null,r.unit==='pp'?' pp':r.unit==='x'?'×':'')}{r.delta==null&&r.observedDelta!=null&&<div className="ads-analytics-note">Observed only</div>}</>},
    {title:'Evidence',width:180,render:(_,r)=><Status status={r.status}/>}
   ]}/></div>
   <Typography.Text strong style={{display:'block',margin:'14px 0 6px'}}>Observed daily review signals</Typography.Text>
   <div className="ads-portfolio-stats">
    {Object.entries(d.observations||{}).map(([key,v])=><Fact key={key} title={observationNames[key]||key}>{v}</Fact>)}
   </div>
   <div className="ads-analytics-note">Daily signals may overlap. Unknown values are not zero; signed adjustments can produce negative or above-100% contribution. No profitability, campaign or keyword inference is made.</div>
  </>}
 </Card>;
}
