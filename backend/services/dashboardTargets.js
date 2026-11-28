'use strict';
const {validateWindow}=require('./adsCanonicalMetrics');
const {resolveContext,AdsScopeError}=require('./adsCanonicalScope');
const {buildOwnerBatch}=require('./dashboardFinancialRead');
const {metricProjection,exactSum}=require('./dashboardFinancialMetrics');
const {projection:adsProjection,summarize:adsSummary}=require('./dashboardAdsMetrics');
const {buildInClause}=require('../utils/sqlHelpers');
const pad=n=>String(n).padStart(2,'0');
const dayKey=d=>d instanceof Date?d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate()):String(d).slice(0,10);
const dayCount=(a,b)=>a>b?0:(Date.parse(b)-Date.parse(a))/86400000+1;
function targetPeriod(t){
 const y=Number(t.Year),m=Number(t.Month);
 if(!Number.isInteger(y)||y<2000||y>2099)return null;
 if(t.TargetType==='YEARLY')return {start:y+'-01-01',end:y+'-12-31'};
 if(t.TargetType!=='MONTHLY'||!Number.isInteger(m)||m<1||m>12)return null;
 return {start:y+'-'+pad(m)+'-01',end:y+'-'+pad(m)+'-'+pad(new Date(Date.UTC(y,m,0)).getUTCDate())};
}
function shapeTarget(t,{today,gmsRows,adsRows}){
 const period=targetPeriod(t);
 if(!period)return null;
 const through=period.end<today?period.end:today;
 const expectedDays=dayCount(period.start,through);
 const source=t.GoalType==='GMS'?gmsRows:adsRows;
 const rows=source.filter(r=>r.SellerId===t.SellerId&&dayKey(r.Date)>=period.start&&dayKey(r.Date)<=through);
 const coveredDays=new Set(rows.map(r=>dayKey(r.Date))).size;
 let observed=null,metricComplete=false;
 if(t.GoalType==='GMS'){
  observed=exactSum(rows,'Revenue');metricComplete=observed!=null;
 }else{
  const a=adsSummary(rows);
  observed=t.GoalType==='ADS'?a.totals.AdSpend:a.ratios.acos;
  metricComplete=(t.GoalType==='ADS'?a.coverage.AdSpend.status:a.ratioCoverage.acos)==='complete'&&observed!=null;
 }
 const complete=expectedDays>0&&coveredDays===expectedDays&&metricComplete;
 const target=Number(t.TotalTargetValue);
 const actual=complete?observed:null;
 const validTarget=Number.isFinite(target)&&target>0;
 const progress=validTarget&&actual!=null?(t.GoalType==='GMS'||t.GoalType==='ADS'?actual/target*100:null):null;
 const closed=today>=period.end;
 let status='unknown';
 if(expectedDays===0)status='not_started';
 else if(complete&&validTarget){
  if(t.GoalType==='GMS')status=actual>=target?'met':closed?'below_target':'in_progress';
  else status=actual>target?'over_limit':'within_limit';
 }
 return {...t,period,through:expectedDays?through:null,overallAchieved:actual,observedActual:observed,progress,status,closed,
  coverage:{coveredDays,expectedDays,complete},definition:'full_target_period_actual_through_today'};
}
async function readDashboardTargets({pool,sql,scope,startDate,endDate,today=dayKey(new Date())}){
 validateWindow(startDate,endDate);
 if(scope.empty)return [];
 const req=pool.request();
 const where=scope.unrestricted?'':' AND t.SellerId IN ('+buildInClause(req,'targetSeller',scope.sellerIds)+')';
 req.input('from',sql.VarChar(10),startDate).input('to',sql.VarChar(10),endDate);
 const r=await req.query(`
 SELECT TOP(1001) t.Id,t.SellerId,s.Name AS SellerName,t.BrandManager,UPPER(t.GoalType) AS GoalType,
 UPPER(t.TargetType) AS TargetType,t.[Year],t.[Month],CONVERT(varchar(50),t.TotalTargetValue) AS TotalTargetValue
 FROM dbo.GmsTargets t JOIN dbo.Sellers s ON s.Id=t.SellerId
 WHERE UPPER(t.GoalType) IN ('GMS','ADS','ACOS') ${where}
 AND ((UPPER(t.TargetType)='YEARLY' AND t.[Year] BETWEEN YEAR(CONVERT(date,@from,23)) AND YEAR(CONVERT(date,@to,23)))
 OR (UPPER(t.TargetType)='MONTHLY' AND t.[Month] BETWEEN 1 AND 12 AND t.[Year]*100+t.[Month] BETWEEN YEAR(CONVERT(date,@from,23))*100+MONTH(CONVERT(date,@from,23)) AND YEAR(CONVERT(date,@to,23))*100+MONTH(CONVERT(date,@to,23))))
 ORDER BY t.[Year],t.[Month],t.SellerId,t.GoalType,t.Id;
 `);
 if(r.recordset.length>1000)throw new AdsScopeError('dashboard_targets_too_large','Narrow the seller or date selection for target analytics.',422);
 const targets=r.recordset.filter(t=>targetPeriod(t));
 const active=targets.filter(t=>targetPeriod(t).start<=today);
 if(!active.length)return targets.map(t=>shapeTarget(t,{today,gmsRows:[],adsRows:[]}));
 const earliest=active.map(t=>targetPeriod(t).start).sort()[0];
 const latest=active.map(t=>targetPeriod(t).end).sort().at(-1);
 const through=latest<today?latest:today;
 const ids=[...new Set(active.map(t=>t.SellerId))];
 const targetScope={...scope,unrestricted:false,sellerIds:ids,empty:!ids.length};
 const request=pool.request().input('prevStart',sql.VarChar(10),earliest).input('endDate',sql.VarChar(10),through);
 ids.forEach((id,i)=>request.input('dashSeller_'+i,sql.VarChar,id));
 const gms=active.some(t=>t.GoalType==='GMS')?buildOwnerBatch(targetScope)+`
 SELECT g.SellerId,CONVERT(char(10),g.Date,23) AS [Date],${metricProjection('g.OrderedRevenue','Revenue')}
 FROM #DashGms g GROUP BY g.SellerId,g.Date; DROP TABLE #DashGms;`:"SELECT CAST(NULL AS varchar(50)) AS SellerId WHERE 1=0;";
 const ads=active.some(t=>t.GoalType!=='GMS')?`
 SELECT AP.SellerId,AP.Marketplace,AP.Currency,s.Marketplace AS CatalogMarketplace,CONVERT(char(10),AP.Date,23) AS [Date],${adsProjection('AP')}
 FROM dbo.AdsProductDailyFacts AP JOIN dbo.Sellers s ON s.Id=AP.SellerId
 WHERE AP.Date>=@prevStart AND AP.Date<DATEADD(day,1,@endDate) AND AP.ReportType='daily' AND AP.Currency='INR'
 AND AP.SellerId IN (${ids.map((_,i)=>'@dashSeller_'+i).join(',')})
 GROUP BY AP.SellerId,AP.Marketplace,AP.Currency,s.Marketplace,AP.Date;
 `:"SELECT CAST(NULL AS varchar(50)) AS SellerId WHERE 1=0;";
 const data=await request.query(gms+ads);
 if(data.recordsets?.length!==2)throw Error('Unexpected dashboard target result');
 const gmsRows=data.recordsets[0],adsRows=data.recordsets[1].filter(row=>{
  const ctx=resolveContext({Id:row.SellerId,Marketplace:row.CatalogMarketplace});
  return ctx&&ctx.marketplace===row.Marketplace&&ctx.currency===row.Currency;
 });
 // Index by seller instead of filtering every seller's entire history.
 const group=rows=>{const m=new Map();for(const row of rows){if(!m.has(row.SellerId))m.set(row.SellerId,[]);m.get(row.SellerId).push(row);}return m;};
 const g=group(gmsRows),a=group(adsRows);
 return targets.map(t=>shapeTarget(t,{today,gmsRows:g.get(t.SellerId)||[],adsRows:a.get(t.SellerId)||[]}));
}
module.exports={readDashboardTargets,shapeTarget,targetPeriod};
