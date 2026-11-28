import React,{useState} from 'react';
import {Alert,Button,Card,Empty,Spin,Table,Tag,Typography} from 'antd';
import {adsCount,adsMoney} from './adsNumberFormat.mjs';

const statuses={passed:['success','Passed'],failed:['error','Mismatch detected'],no_data:['default','No data'],not_applicable:['default','Not applicable']};
function Status({status}){
 const [color,text]=statuses[status]||['default','Unknown'];
 return <Tag color={color}>{text}</Tag>;
}
const qualityFields=[
 ['rowCount','Stored fact rows'],
 ['missingSpend','Missing spend'],
 ['zeroSpend','Explicit zero spend'],
 ['positiveSpendMissingSales','Positive spend / missing ad sales'],
 ['signedAdjustments','Signed adjustments'],
 ['unknownKeyMetrics','No key metric values'],
 ['catalogUnmapped','Unmapped / ambiguous catalog'],
 ['attributedRevenueOverlap','Ad sales exceed total sales'],
 ['nonAdditiveRevenueRows','Ad + organic differs from total sales'],
 ['nonAdditiveOrderRows','Ad + organic differs from total orders'],
 ['totalSalesAliasMismatch','Revenue alias mismatch'],
 ['totalOrdersAliasMismatch','Order alias mismatch'],
 ['totalUnitsAliasMismatch','Unit alias mismatch']
];
const exact=v=>v==null?'NULL':String(v);
export default function AdsReconciliationPanel({audit,requested,onRun}){
 const [expanded,setExpanded]=useState(false);
 const data=requested?audit.data:null,checks=data?.checks||[];
 const failed=checks.filter(c=>c.status==='failed'),passed=checks.filter(c=>c.status==='passed');
 const mismatches=checks.flatMap(c=>(c.mismatches||[]).map((m,i)=>({...m,key:JSON.stringify([c.code,i]),check:c.label})));
 return <Card size="small" title="Analytics reconciliation" data-testid="ads-reconciliation-panel">
  <div className="ads-analytics-toolbar">
   <div><Typography.Text strong>Verify the stored analytics against one authorized snapshot</Typography.Text>
    <div className="ads-analytics-note">Uses the selected dates, sellers, catalog filters, marketplace and currency, independent of the current table page. This check is read-only.</div></div>
   <Button type={requested?'default':'primary'} onClick={onRun} loading={requested&&audit.isFetching}>{requested?'Run again':'Run reconciliation'}</Button>
  </div>
  {!requested?<div className="ads-analytics-note">Run only when required. Reconciliation does not automatically scan the database on page load.</div>:
   audit.isError?<Alert type="error" showIcon message={audit.error?.response?.data?.message||'Reconciliation could not complete. Retry with a narrower scope.'}/>:
   audit.isPending||!data?<div className="ads-inline-loading"><Spin size="small"/> Checking exact financial totals and aggregation paths…</div>:
   data.empty?<Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No stored facts to reconcile"/>:<>
    <Alert showIcon type={data.status==='passed'?'success':'error'} message={data.status==='passed'?'Stored analytics checks passed':'Analytics discrepancies detected'}
     description="This checks internal consistency of stored facts and analytics. It does not verify that every source report or advertising record was uploaded. No data has been changed."/>
    <div className="ads-portfolio-stats">
     <div className="ads-portfolio-stat"><span>Checks passed</span><strong>{adsCount(passed.length)} / {adsCount(checks.length)}</strong></div>
     <div className="ads-portfolio-stat"><span>Failed checks</span><strong>{adsCount(failed.length)}</strong></div>
     <div className="ads-portfolio-stat"><span>Exact comparisons</span><strong>{adsCount(checks.reduce((n,c)=>n+c.comparisons,0))}</strong></div>
     <div className="ads-portfolio-stat"><span>Reported mismatches</span><strong>{adsCount(checks.reduce((n,c)=>n+c.mismatchCount,0))}</strong></div>
    </div>
    <div className="ads-table-shell"><Table size="small" tableLayout="fixed" rowKey="code" dataSource={checks} pagination={false} scroll={{x:740}} columns={[
     {title:'Verification',dataIndex:'label',width:365},
     {title:'Result',width:145,render:(_,r)=><Status status={r.status}/>},
     {title:'Comparisons',width:115,render:(_,r)=>adsCount(r.comparisons)},
     {title:'Mismatches',width:115,render:(_,r)=>adsCount(r.mismatchCount)}
    ]}/></div>
    {!!mismatches.length&&<>
     <Typography.Text strong style={{display:'block',margin:'12px 0 6px'}}>Exact mismatch details</Typography.Text>
     <div className="ads-analytics-note">Values are shown at original precision for troubleshooting. Up to 30 details per check; counts above include all detected mismatches.</div>
     <div className="ads-table-shell"><Table size="small" tableLayout="fixed" rowKey="key" dataSource={mismatches} pagination={{pageSize:10,showSizeChanger:false}} scroll={{x:1180}} columns={[
      {title:'Check',dataIndex:'check',width:235},
      {title:'Currency / period',width:145,render:(_,r)=>r.currency+' / '+r.periodKey},
      {title:'Field',dataIndex:'field',width:230},
      {title:'Expected',width:270,render:(_,r)=><code>{exact(r.expected)}</code>},
      {title:'Actual',width:270,render:(_,r)=><code>{exact(r.actual)}</code>}
     ]}/></div>
    </>}
    <div className="ads-analytics-toolbar" style={{marginTop:14}}>
     <Typography.Text strong>Source coverage & diagnostic observations</Typography.Text>
     <Button onClick={()=>setExpanded(v=>!v)} aria-expanded={expanded}>{expanded?'Hide source details':'View source details'}</Button>
    </div>
    {expanded&&<>
     <div className="ads-analytics-note">Missing fields, explicit zero, signed adjustments, and attribution overlap remain distinct. Ad sales plus organic sales is not necessarily total business revenue. Alias mismatches are genuine validation failures; other listed observations are not automatically errors.</div>
     <div className="ads-table-shell" style={{marginTop:8}}><Table size="small" tableLayout="fixed" rowKey={r=>JSON.stringify([r.currency,r.periodKey])} dataSource={data.quality||[]} pagination={{pageSize:10,showSizeChanger:false}} scroll={{x:2450}} columns={[
      {title:'Currency / period',width:160,render:(_,r)=>r.currency+' / '+r.periodKey},
      ...qualityFields.map(([key,label])=>({title:label,width:180,render:(_,r)=>adsCount(r[key])}))
     ]}/></div>
     <Typography.Text strong style={{display:'block',margin:'14px 0 6px'}}>Canonical baseline totals</Typography.Text>
     <div className="ads-table-shell"><Table size="small" tableLayout="fixed" rowKey={r=>JSON.stringify([r.currency,r.periodKey])} dataSource={data.baseline||[]} pagination={{pageSize:10,showSizeChanger:false}} scroll={{x:1000}} columns={[
      {title:'Currency / period',width:150,render:(_,r)=>r.currency+' / '+r.periodKey},
      {title:'Stored rows',width:120,render:(_,r)=>adsCount(r.rowCount)},
      {title:'Stored days',width:100,render:(_,r)=>adsCount(r.coveredDays)},
      ...[['spend','Spend'],['sales','Ad sales'],['totalSales','Total sales'],['organicSales','Organic sales']].map(([key,label])=>({title:label,width:160,render:(_,r)=><><span title={exact(r.totals?.[key])}>{adsMoney(r.totals?.[key],r.currency)}</span><div className="ads-analytics-note">{adsCount(r.coverage?.[key]?.populated)} populated rows</div></>}))
     ]}/></div>
    </>}
   </>}
 </Card>;
}
