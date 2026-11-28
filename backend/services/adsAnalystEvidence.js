'use strict';
const {AdsScopeError}=require('./adsCanonicalScope');
const {parseReport,readCanonicalReport}=require('./adsCanonicalReport');
const METRICS=['spend','sales','totalSales','orders','conversions','clicks','impressions'];
const RATIOS=['acos','tacos','roas','ctr','cvr'];
function parseAnalystRequest(user,body){
 if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).some(k=>k!=='filters'))throw new AdsScopeError('invalid_analyst_request','Only report filters are accepted.');
 const input=body.filters;
 if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!['startDate','endDate','sellerId','currency','marketplace','brand','category','search'].includes(k)))throw new AdsScopeError('invalid_analyst_request','Invalid analyst report filters.');
 const query={...input,groupBy:'asin',granularity:'day'};
 const parsed=parseReport(user,query);
 if(parsed.period.days>90)throw new AdsScopeError('analyst_range_too_large','Select a reporting period of up to 90 days.',422);
 return query;
}
function buildEvidence(report){
 const evidence=[];
 const push=record=>evidence.push({id:'E'+(evidence.length+1),...record});
 for(const currency of [...new Set([...report.current,...report.previous].map(r=>r.currency))].sort()){
  for(const period of ['current','previous']){
   const row=report[period].find(r=>r.currency===currency);
   if(!row)continue;
   for(const metric of METRICS)push({currency,period,metric,value:row.totals[metric]??null,coverage:row.coverage[metric]?.status||'unknown',coveredDays:row.coveredDays,expectedDays:report.period.days});
   for(const metric of RATIOS)push({currency,period,metric,value:row.ratios[metric]?.value??null,coverage:row.ratios[metric]?.status||'unknown',coveredDays:row.coveredDays,expectedDays:report.period.days});
  }
 }
 const findings=[];
 const addFinding=(record)=>findings.push({id:'F'+(findings.length+1),...record});
 for(const currency of [...new Set(evidence.map(e=>e.currency))]){
  const gaps=evidence.filter(e=>e.currency===currency&&e.period==='current'&&(e.value===null||e.coverage!=='complete'||e.coveredDays!==e.expectedDays));
  if(gaps.length)addFinding({code:'coverage_review',currency,evidenceIds:gaps.map(e=>e.id),action:'Verify source completeness before making a performance decision.'});
 }
 // All population counts are authoritative; samples are bounded by the SQL rule engine.
 for(const signal of report.review?.signals||[]){
  if(signal.count==='0'||signal.count==null)continue;
  const id='E'+(evidence.length+1);
  push({currency:signal.currency,period:'current',metric:signal.code,value:signal.count,coverage:'signal_count',sampleCount:signal.items.length});
  addFinding({code:signal.code,evidenceIds:[id],action:signal.action,label:signal.label,currency:signal.currency,
    products:signal.items.map(p=>({key:JSON.stringify([p.sellerId,p.marketplace,p.currency,p.entityKey]),entityKey:p.entityKey,sellerId:p.sellerId,sellerName:p.sellerName,marketplace:p.marketplace,currency:p.currency,evidenceStatus:p.evidenceStatus,spend:p.spend,sales:p.sales,totalSales:p.totalSales,clicks:p.clicks,conversions:p.conversions,currentDays:p.currentDays,previousDays:p.previousDays}))});
 }
 for(const comparison of report.comparisons||[]){
  for(const metric of ['spend','sales','totalSales','acos','tacos','roas']){
   const change=(comparison.metrics[metric]||comparison.ratios[metric]);
   if(change?.status!=='comparable'||change.delta==null||change.delta==='0')continue;
   const id='E'+(evidence.length+1);
   push({currency:comparison.currency,period:'comparison',metric,value:change.delta,unit:change.unit,coverage:'complete',expectedDays:report.period.days});
   addFinding({code:'period_change',currency:comparison.currency,evidenceIds:[id],action:'Review the observed change against current and prior metrics before deciding on an action.'});
  }
 }
 return {period:report.period,empty:report.empty,evidence,findings,limitations:['Uploaded daily product reports only; no campaign or keyword evidence.','Reported total sales are independent of ad-attributed sales.','Missing data is not zero. Currency groups are never combined.','Stored coverage does not prove that all reports were uploaded.'],generatedAt:new Date().toISOString()};
}
async function loadEvidence({pool,sql,user,body}){
 const query=parseAnalystRequest(user,body);
 const report=await readCanonicalReport({pool,sql,user,query,analystOnly:true});
 return buildEvidence(report);
}
module.exports={parseAnalystRequest,buildEvidence,loadEvidence};
