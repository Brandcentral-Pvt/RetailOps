'use strict';
const {strictScope,resolveContext,AdsScopeError}=require('./adsCanonicalScope');
const {validateWindow,toFixedUnits:fixed,fromFixedUnits:decimal,ratio,difference}=require('./adsCanonicalMetrics');
const {monthBounds,readTargetDefinitions,bindTargetScope}=require('./adsCanonicalTargets');
const MAX_ROWS=5000;
const textValue=v=>v==null?null:decimal(fixed(v));
const round=(n,d)=>{if(d<=0n)throw Error('Invalid budget denominator');return n<0n?-((-n+d/2n)/d):(n+d/2n)/d;};
const money=(n,d=1n)=>decimal(round(n,d));
const max0=n=>n<0n?0n:n;
const sameContext=(a,b)=>a?.marketplace===b?.marketplace&&a?.currency===b?.currency;
const contextKey=(marketplace,currency)=>JSON.stringify([marketplace,currency]);
const monthKey=(sellerId,month)=>JSON.stringify([sellerId,month]);
function reportingCutoff(endDate,now=new Date()){
 const d=new Date(now.getTime());d.setUTCHours(0,0,0,0);d.setUTCDate(d.getUTCDate()-1);
 const closed=d.toISOString().slice(0,10);
 return endDate<closed?endDate:closed;
}
function monthSlice(month,asOf){
 const bounds=monthBounds(month),days=Number(bounds.end.slice(-2));
 const through=asOf<bounds.start?null:asOf<bounds.end?asOf:bounds.end;
 const elapsed=through?Number(through.slice(-2)):0;
 return {start:bounds.start,end:bounds.end,through,days,elapsed,remaining:days-elapsed};
}
// Use the actual configured week allocations (1-7, 8-14, 15-21, 22-28,
// 29-end). Never consume legacy auto-generated DAY rows: their 7-day
// generation can spill across short weeks/months and duplicate dates.
function budgetPlan(target,slice,weekly=[]){
 if(target==null)return {status:'not_configured',source:null,value:null,numerator:null,denominator:null};
 const total=fixed(target),days=BigInt(slice.days);
 if(total<0n)return {status:'schedule_conflict',source:null,value:null,numerator:null,denominator:null};
 if(!weekly.length){
  const numerator=total*BigInt(slice.elapsed);
  return {status:'valid',source:'calendar_linear',value:money(numerator,days),numerator,denominator:days};
 }
 const values=new Map(),weeks=Math.ceil(slice.days/7);
 let invalid=false;
 for(const r of weekly){
  const week=Number(r.weekNo);
  if(!Number.isInteger(week)||week<1||week>5||values.has(week)||r.target==null){invalid=true;continue;}
  let value;try{value=fixed(r.target);}catch{invalid=true;continue;}
  if(value<0n||(week>weeks&&value!==0n))invalid=true;
  values.set(week,value);
 }
 // W5 may be omitted by existing yearly allocations. Only accept it as
 // unallocated zero when all first four weeks exist and the sum reconciles.
 for(let w=1;w<=4;w++)if(!values.has(w))invalid=true;
 if([...values.values()].reduce((n,v)=>n+v,0n)!==total)invalid=true;
 if(invalid)return {status:'schedule_conflict',source:'configured_weeks',value:null,numerator:null,denominator:null};
 let completed=0n,numerator=0n,denominator=1n;
 for(let w=1;w<=weeks;w++){
  const start=(w-1)*7+1,end=Math.min(w*7,slice.days),span=end-start+1;
  const elapsed=Math.max(0,Math.min(slice.elapsed,end)-start+1),v=values.get(w)||0n;
  if(elapsed===span){completed+=v;continue;}
  if(elapsed>0){denominator=BigInt(span);numerator=v*BigInt(elapsed);}
  break;
 }
 numerator+=completed*denominator;
 return {status:'valid',source:'configured_weeks',value:money(numerator,denominator),numerator,denominator};
}
function actualCoverage(a,slice){
 const rows=BigInt(a?.rowCount||'0'),spendRows=BigInt(a?.spendRows||'0'),salesRows=BigInt(a?.salesRows||'0'),pairs=BigInt(a?.pairedRows||'0');
 if(spendRows>rows||salesRows>rows||pairs>spendRows||pairs>salesRows)throw Error('Budget coverage count mismatch');
 const completeCalendar=slice.elapsed>0&&a?.coveredDays===slice.elapsed;
 const spendComplete=completeCalendar&&rows>0n&&spendRows===rows&&a.spendDays===slice.elapsed&&a.spend!=null;
 const aligned=pairs>0n&&pairs===spendRows&&pairs===salesRows;
 const salesPositive=a?.sales!=null&&fixed(a.sales)>0n;
 const acos=aligned&&salesPositive?ratio(a.spend,a.sales,100):null;
 const acosComplete=spendComplete&&salesRows===rows&&a.salesDays===slice.elapsed&&acos!==null;
 return {rowCount:rows.toString(),coveredDays:a?.coveredDays||0,spendDays:a?.spendDays||0,salesDays:a?.salesDays||0,spendRows:spendRows.toString(),salesRows:salesRows.toString(),pairedRows:pairs.toString(),
  negativeSpendRows:a?.negativeSpendRows||'0',negativeSalesRows:a?.negativeSalesRows||'0',
  spendComplete,acosComplete,acos,acosCoverage:!aligned&&spendRows>0n&&salesRows>0n?'incompatible_coverage':acos===null?'unknown':acosComplete?'complete':'partial'};
}
function targetState(t,context,conflict,matched){
 if(!context)return 'unverified_context';
 if(!matched||conflict)return 'context_conflict';
 if(!t)return 'missing_target';
 if(t.targetStatus!=='configured'||t.target==null)return 'conflicting_target';
 return 'configured';
}
function budgetResult({target,context,matched=true,conflict=false,actual,slice,coverage,weekly=[]}){
 const targetStatus=targetState(target,context,conflict,matched);
 // Only attach a configured value to the verified currency/marketplace.
 const value=matched&&context&&target?.targetStatus==='configured'?textValue(target.target):null;
 const observed=textValue(actual?.spend);
 const plan=budgetPlan(value,slice,weekly);
 const signed=BigInt(coverage.negativeSpendRows)>0n||observed!==null&&fixed(observed)<0n;
 let status=targetStatus;
 if(status==='configured')status=!slice.elapsed?'not_started':!coverage.spendComplete?'insufficient_coverage':signed?'signed_adjustment':'comparable';
 const comparable=status==='comparable';
 const remaining=comparable?difference(value,observed):null;
 const utilization=comparable?ratio(observed,value,100):null;
 let paceStatus=status,varianceToPlan=null;
 if(comparable){
  if(plan.status!=='valid')paceStatus='schedule_conflict';
  else{
   const delta=fixed(observed)*plan.denominator-plan.numerator;
   varianceToPlan=money(delta,plan.denominator);
   paceStatus=delta>0n?'ahead_of_plan':delta<0n?'behind_plan':'on_plan';
  }
 }
 const projected=comparable&&slice.remaining>0?money(fixed(observed)*BigInt(slice.days),BigInt(slice.elapsed)):null;
 const projectionVariance=projected!==null?difference(projected,value):null;
 const remainingDaily=comparable&&slice.remaining>0?money(max0(fixed(remaining)),BigInt(slice.remaining)):null;
 return {target:value,targetSource:target?.targetType||null,targetStatus,status,planSource:plan.source,planStatus:plan.status,plannedSpend:plan.value,actualSpend:observed,
  observedUtilizationPct:observed!==null&&value!==null?ratio(observed,value,100):null,
  observedOverBudget:observed!==null&&value!==null?fixed(observed)>fixed(value):null,
  utilizationPct:utilization,remainingBudget:remaining,remainingDailyAllowance:remainingDaily,
  varianceToPlan,paceStatus,projectedMonthEnd:projected,projectedVariance:projectionVariance,
  forecastStatus:!comparable?status:slice.remaining===0?'month_closed':'linear_scenario'};
}
function acosResult({target,context,matched=true,conflict=false,actual,slice,coverage}){
 const targetStatus=targetState(target,context,conflict,matched);
 const value=matched&&context&&target?.targetStatus==='configured'?textValue(target.target):null;
 const signed=BigInt(coverage.negativeSpendRows)>0n||BigInt(coverage.negativeSalesRows)>0n;
 let status=targetStatus;
 if(status==='configured'){
  if(!slice.elapsed)status='not_started';
  else if(!coverage.acosComplete)status='insufficient_coverage';
  else if(signed||fixed(actual.spend)<0n)status='signed_adjustment';
  else{
   // Compare unrounded ratio against target percentage points.
   const delta=fixed(actual.spend)*100n*10000000000n-fixed(value)*fixed(actual.sales);
   status=delta>0n?'above_target':delta<0n?'below_target':'at_target';
  }
 }
 const comparable=['above_target','below_target','at_target'].includes(status);
 return {target:value,targetSource:target?.targetType||null,targetStatus,actual:coverage.acos,coverage:coverage.acosCoverage,status,
  gapPp:comparable?difference(coverage.acos,value):null};
}
function assembleBudgetRows({targets,actuals,weekly,asOf,currency}){
 const groups=new Map();
 function ensure(r){
  const k=monthKey(r.sellerId,r.month);
  if(!groups.has(k))groups.set(k,{sellerId:r.sellerId,sellerName:r.sellerName,catalogMarketplace:r.catalogMarketplace,month:r.month,targets:{},actuals:new Map()});
  return groups.get(k);
 }
 for(const t of targets)ensure(t).targets[t.goalType]=t;
 for(const a of actuals)ensure(a).actuals.set(contextKey(a.marketplace,a.currency),a);
 const rows=[];
 for(const g of groups.values()){
  const context=resolveContext({Id:g.sellerId,Marketplace:g.catalogMarketplace}),slice=monthSlice(g.month,asOf);
  const contexts=new Map();
  if(Object.keys(g.targets).length)contexts.set(contextKey(context?.marketplace||null,context?.currency||null),context||{marketplace:null,currency:null});
  for(const a of g.actuals.values())contexts.set(contextKey(a.marketplace,a.currency),{marketplace:a.marketplace,currency:a.currency});
  const conflict=!!context&&[...g.actuals.values()].some(a=>!sameContext(context,a));
  for(const c of contexts.values()){
   if(currency&&c.currency!==currency)continue;
   const matched=!!context&&sameContext(context,c),a=g.actuals.get(contextKey(c.marketplace,c.currency)),coverage=actualCoverage(a,slice);
   const common={context,matched,conflict,actual:a,slice,coverage};
   rows.push({key:JSON.stringify([g.sellerId,g.month,c.marketplace,c.currency]),sellerId:g.sellerId,sellerName:g.sellerName,month:g.month,marketplace:c.marketplace,currency:c.currency,
    slice,coverage,contextStatus:!context?'unverified_context':!matched||conflict?'context_conflict':'verified',
    budget:budgetResult({...common,target:g.targets.ADS,weekly:weekly.get(monthKey(g.sellerId,g.month))||[]}),
    acos:acosResult({...common,target:g.targets.ACOS})});
  }
 }
 if(rows.length>MAX_ROWS)throw new AdsScopeError('budget_scope_too_large','More than 5,000 seller-month groups match. Narrow the seller or date filters.',422);
 rows.sort((a,b)=>(a.currency||'').localeCompare(b.currency||'')||a.sellerName.localeCompare(b.sellerName)||a.month.localeCompare(b.month)||a.key.localeCompare(b.key));
 return rows;
}
async function readBudgetIntelligence({pool,sql,user,query,now=new Date()}){
 for(const k of Object.keys(query))if(!['sellerId','startDate','endDate','currency'].includes(k))throw new AdsScopeError('invalid_ads_filter','Budget pacing is seller/month level only.');
 const scope=strictScope(user,query.sellerId),period=validateWindow(query.startDate,query.endDate),currency=query.currency;
 if(currency!==undefined&&(typeof currency!=='string'||!/^[A-Z]{3}$/.test(currency)))throw new AdsScopeError('invalid_currency','Invalid currency.');
 const asOf=reportingCutoff(period.endDate,now);
 const envelope={period,asOf,cutoffPolicy:'selected_end_or_previous_utc_day',basis:'month_start_through_cutoff',rows:[]};
 if(scope.empty)return envelope;
 const tx=new sql.Transaction(pool);await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
 try{
  const targets=await readTargetDefinitions({tx,sql,scope,period});
  if(targets.length>MAX_ROWS*2)throw new AdsScopeError('budget_scope_too_large','Too many seller-month targets. Narrow seller or date filters.',422);
  const plans=targets.filter(t=>t.goalType==='ADS'&&t.targetStatus==='configured').map(t=>({targetId:t.targetId,sellerId:t.sellerId,month:t.month,targetType:t.targetType,monthNo:Number(t.month.slice(-2))}));
  const weekly=new Map();
  // Read only the selected target records and relevant week allocations.
  for(let i=0;i<plans.length;i+=1000){
   const r=await tx.request().input('plans',sql.NVarChar(sql.MAX),JSON.stringify(plans.slice(i,i+1000))).query(
    "SELECT p.sellerId,p.[month],CASE WHEN p.targetType='YEARLY' THEN b.PeriodValue-p.monthNo*10 ELSE b.PeriodValue END AS weekNo,CONVERT(varchar(80),CONVERT(decimal(38,10),b.TargetValue)) AS target FROM OPENJSON(@plans) WITH(targetId varchar(50),sellerId varchar(50),[month] varchar(7),targetType varchar(10),monthNo int) p JOIN dbo.GmsTargetBreakdowns b ON b.TargetId=p.targetId AND UPPER(b.PeriodType)='WEEK' AND (p.targetType='MONTHLY' OR (b.PeriodValue>=p.monthNo*10 AND b.PeriodValue<p.monthNo*10+10));");
   for(const v of r.recordset){const k=monthKey(v.sellerId,v.month);if(!weekly.has(k))weekly.set(k,[]);weekly.get(k).push(v);}
  }
  const request=tx.request(),expanded={startDate:period.startDate.slice(0,7)+'-01',endDate:asOf};
  const where=bindTargetScope(request,sql,scope,expanded,'p');
  const sum=c=>'CONVERT(varchar(80),SUM(CONVERT(decimal(38,10),p.['+c+'])))';
  const count=c=>'CONVERT(varchar(30),COUNT_BIG('+c+'))';
  const a=await request.query(
   "SELECT TOP (5001) p.SellerId AS sellerId,s.Name AS sellerName,s.Marketplace AS catalogMarketplace,p.Marketplace AS marketplace,p.Currency AS currency,CONVERT(varchar(7),p.[Date],23) AS [month],"+
   sum('AdSpend')+" AS spend,"+sum('AdSales')+" AS sales,"+count('*')+" AS rowCount,"+count('p.AdSpend')+" AS spendRows,"+count('p.AdSales')+" AS salesRows,"+
   count('CASE WHEN p.AdSpend IS NOT NULL AND p.AdSales IS NOT NULL THEN 1 END')+" AS pairedRows,"+
   count('CASE WHEN p.AdSpend<0 THEN 1 END')+" AS negativeSpendRows,"+count('CASE WHEN p.AdSales<0 THEN 1 END')+" AS negativeSalesRows,"+
   "COUNT(DISTINCT p.[Date]) AS coveredDays,COUNT(DISTINCT CASE WHEN p.AdSpend IS NOT NULL THEN p.[Date] END) AS spendDays,COUNT(DISTINCT CASE WHEN p.AdSales IS NOT NULL THEN p.[Date] END) AS salesDays "+
   "FROM dbo.AdsProductDailyFacts p JOIN dbo.Sellers s ON s.Id=p.SellerId WHERE p.ReportType='daily' AND p.[Date]>=CONVERT(date,@start,23) AND p.[Date]<=CONVERT(date,@end,23)"+where+
   " GROUP BY p.SellerId,s.Name,s.Marketplace,p.Marketplace,p.Currency,CONVERT(varchar(7),p.[Date],23) ORDER BY p.SellerId,[month],p.Marketplace,p.Currency;");
  if(a.recordset.length>MAX_ROWS)throw new AdsScopeError('budget_scope_too_large','Too many seller-month fact groups. Narrow seller or date filters.',422);
  const rows=assembleBudgetRows({targets,actuals:a.recordset,weekly,asOf,currency});
  await tx.commit();return {...envelope,rows};
 }catch(e){try{await tx.rollback();}catch{}throw e;}
}
module.exports={readBudgetIntelligence,reportingCutoff,monthSlice,budgetPlan,actualCoverage,budgetResult,acosResult,assembleBudgetRows};
