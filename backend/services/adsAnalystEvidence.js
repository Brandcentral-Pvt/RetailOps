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
 for(const e of evidence.filter(e=>e.period==='current')){
  if(e.value===null||e.coverage!=='complete'||e.coveredDays!==e.expectedDays){
   findings.push({code:'coverage_review',evidenceIds:[e.id],action:'Verify source completeness before making a performance decision.'});
  }
 }
 return {period:report.period,empty:report.empty,evidence,findings,limitations:['Uploaded daily product reports only; no campaign or keyword evidence.','Reported total sales are independent of ad-attributed sales.','Missing data is not zero. Currency groups are never combined.','Stored coverage does not prove that all reports were uploaded.'],generatedAt:new Date().toISOString()};
}
async function loadEvidence({pool,sql,user,body}){
 const query=parseAnalystRequest(user,body);
 const report=await readCanonicalReport({pool,sql,user,query,overviewOnly:true});
 return buildEvidence(report);
}
module.exports={parseAnalystRequest,buildEvidence,loadEvidence};
