'use strict';
const {strictScope,resolveContext,AdsScopeError}=require('./adsCanonicalScope');
const {validateWindow,aggregateProjection,shapeSummary,ratio}=require('./adsCanonicalMetrics');
function monthBounds(key){
  const [y,m]=key.split('-').map(Number),last=new Date(Date.UTC(y,m,0)).getUTCDate();
  return {start:key+'-01',end:key+'-'+String(last).padStart(2,'0')};
}
function chooseTargets(rows){
  const groups=new Map();
  for(const r of rows){
    const key=JSON.stringify([r.sellerId,r.month,r.goalType]);
    if(!groups.has(key))groups.set(key,[]);
    groups.get(key).push(r);
  }
  return [...groups.values()].map(group=>{
    const monthly=group.filter(x=>x.targetType==='MONTHLY');
    const candidates=monthly.length?monthly:group.filter(x=>x.targetType==='YEARLY');
    const first=candidates[0],valid=candidates.length===1&&typeof first?.target==='string'&&/^\d+(?:\.\d{1,10})?$/.test(first.target);
    return {...(first||group[0]),target:valid?first.target:null,targetStatus:valid?'configured':'conflicting_or_missing'};
  });
}
function targetResult(target,actual,period){
  const context=resolveContext({Id:target.sellerId,Marketplace:target.catalogMarketplace});
  const bounds=monthBounds(target.month),fullMonth=period.startDate<=bounds.start&&period.endDate>=bounds.end;
  const metric=target.goalType==='ADS'?actual?.totals?.spend:actual?.ratios?.acos?.value;
  const coverage=target.goalType==='ADS'?actual?.coverage?.spend?.status:actual?.ratios?.acos?.status;
  const configured=target.targetStatus==='configured'&&!!context;
  const comparable=configured&&fullMonth&&metric!=null&&coverage==='complete'&&Number(target.target)>0;
  return {sellerId:target.sellerId,sellerName:target.sellerName,month:target.month,goalType:target.goalType,target:configured?target.target:null,
    targetSource:target.targetType,currency:context?.currency||null,marketplace:context?.marketplace||null,actual:metric??null,coverage:coverage||'unknown',
    fullMonth,status:!context?'unverified_context':!configured?'conflicting_or_missing':!fullMonth?'partial_month':coverage!=='complete'||metric==null?'insufficient_coverage':Number(target.target)<=0?'zero_target':'comparable',
    attainmentPct:comparable?ratio(metric,target.target,100):null};
}
async function readCanonicalTargets({pool,sql,user,query}){
  for(const key of Object.keys(query))if(!['sellerId','startDate','endDate','currency'].includes(key))throw new AdsScopeError('invalid_ads_filter','Targets are seller/month level only.');
  const scope=strictScope(user,query.sellerId),period=validateWindow(query.startDate,query.endDate);
  const currency=query.currency;
  if(currency!==undefined&&(typeof currency!=='string'||!(/^[A-Z]{3}$/).test(currency)))throw new AdsScopeError('invalid_currency','Invalid currency.');
  if(scope.empty)return {period,rows:[]};
  const tx=new sql.Transaction(pool);await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
  try{
    const bind=(req,alias)=>{
      req.input('start',sql.VarChar(10),period.startDate).input('end',sql.VarChar(10),period.endDate);
      if(scope.unrestricted)return '';
      req.input('ids',sql.NVarChar(sql.MAX),JSON.stringify(scope.sellerIds));
      return " AND EXISTS(SELECT 1 FROM OPENJSON(@ids) WITH ([id] varchar(50) '$') x WHERE x.[id]="+alias+'.SellerId)';
    };
    const targetReq=tx.request(),targetScope=bind(targetReq,'t');
    // Monthly target overrides a yearly allocation. Duplicate same-priority
    // definitions are flagged instead of added or arbitrarily selected.
    const tr=await targetReq.query("SELECT t.SellerId AS [sellerId],s.Name AS [sellerName],s.Marketplace AS [catalogMarketplace],UPPER(t.GoalType) AS [goalType],UPPER(t.TargetType) AS [targetType],CONCAT(t.[Year],'-',RIGHT('0'+CONVERT(varchar(2),m.[monthNo]),2)) AS [month],CONVERT(varchar(80),CONVERT(decimal(38,10),m.[target])) AS [target] FROM dbo.GmsTargets t JOIN dbo.Sellers s ON s.Id=t.SellerId CROSS APPLY (SELECT t.[Month] AS [monthNo],t.TotalTargetValue AS [target] WHERE UPPER(t.TargetType)='MONTHLY' UNION ALL SELECT b.PeriodValue,b.TargetValue FROM dbo.GmsTargetBreakdowns b WHERE b.TargetId=t.Id AND UPPER(b.PeriodType)='MONTH' AND UPPER(t.TargetType)='YEARLY') m WHERE UPPER(t.GoalType) IN ('ADS','ACOS') AND m.[monthNo] BETWEEN 1 AND 12 AND t.[Year]*100+m.[monthNo] BETWEEN YEAR(CONVERT(date,@start,23))*100+MONTH(CONVERT(date,@start,23)) AND YEAR(CONVERT(date,@end,23))*100+MONTH(CONVERT(date,@end,23))"+targetScope+";");
    const actualReq=tx.request(),actualScope=bind(actualReq,'p');
    const a=await actualReq.query("SELECT p.SellerId,p.Marketplace,p.Currency AS [currency],CONVERT(varchar(7),p.[Date],23) AS [month],"+aggregateProjection+" FROM dbo.AdsProductDailyFacts p WHERE p.ReportType='daily' AND p.[Date]>=CONVERT(date,@start,23) AND p.[Date]<=CONVERT(date,@end,23)"+actualScope+" GROUP BY p.SellerId,p.Marketplace,p.Currency,CONVERT(varchar(7),p.[Date],23);");
    const actuals=new Map(a.recordset.map(r=>[JSON.stringify([r.SellerId,r.Marketplace,r.currency,r.month]),shapeSummary(r)]));
    const rows=chooseTargets(tr.recordset).map(t=>{
      const c=resolveContext({Id:t.sellerId,Marketplace:t.catalogMarketplace});
      const actual=c?actuals.get(JSON.stringify([t.sellerId,c.marketplace,c.currency,t.month])):null;
      return targetResult(t,actual,period);
    }).filter(r=>!currency||r.currency===currency).sort((a,b)=>a.sellerName.localeCompare(b.sellerName)||a.month.localeCompare(b.month)||a.goalType.localeCompare(b.goalType));
    await tx.commit();return {period,rows};
  }catch(e){try{await tx.rollback();}catch{}throw e;}
}
module.exports={chooseTargets,targetResult,readCanonicalTargets};
