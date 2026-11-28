'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {up}=require('../migrations/098_ads_product_daily_facts');
const {readCanonicalReport,readCanonicalOptions}=require('../services/adsCanonicalReport');
const {readCanonicalTargets}=require('../services/adsCanonicalTargets');
const {readBudgetIntelligence}=require('../services/adsBudgetIntelligence');
const {rawReconciler,SOURCE_FIELDS}=require('../services/adsExportSnapshot');
test('SQL: canonical scope, duplicate catalog protection, current/prior comparison, exact metrics and pagination',{skip:process.env.ADS_SQL_SMOKE!=='1',timeout:120000},async()=>{
 const sql=require(process.env.ADS_TEST_MSSQL_MODULE||'mssql');
 const config={server:'127.0.0.1',user:'sa',password:process.env.ADS_TEST_SQL_PASSWORD,options:{trustServerCertificate:true,encrypt:false}};
 let admin,pool;const database='AdsReport_'+Date.now();
 for(let i=0;i<40;i++){const c=new sql.ConnectionPool(config);try{admin=await c.connect();break;}catch{await c.close().catch(()=>{});await new Promise(r=>setTimeout(r,1000));}}
 assert.ok(admin);
 const user={Id:'u',role:{Name:'brand_manager'},assignedSellers:['s1','s2']};
 const range={startDate:'2026-04-01',endDate:'2026-04-30'};
 try{
  await admin.request().query('CREATE DATABASE ['+database+']');
  pool=await new sql.ConnectionPool({...config,database}).connect();
  await pool.request().query("CREATE TABLE dbo.Sellers(Id varchar(50) PRIMARY KEY,Name nvarchar(255),Marketplace nvarchar(50)); INSERT dbo.Sellers VALUES('s1','One','amazon.in'),('s2','Two','amazon.com'),('s3','Foreign','amazon.in'); CREATE TABLE dbo.Asins(AsinCode nvarchar(30),SellerId varchar(50),Title nvarchar(max),Brand nvarchar(255),Category nvarchar(255),ParentAsin nvarchar(30),Sku nvarchar(255)); INSERT dbo.Asins VALUES('B000000001','s1','First','A','Cat','B000000010','sku1'),('B000000001','s1','Duplicate','Other','Cat','B000000099','skuX'),('B000000002','s1','Second','A','Cat','B000000010','sku2'),('B000000003','s1','Prior','A','Cat','B000000010','sku3'),('B000000001','s2','Other seller','B','Cat','B000000020','sku1'),('B000000001','s3','Foreign','C','Cat','B000000030','sku1');");
  await up(pool);
  const prefix="INSERT dbo.AdsProductDailyFacts (SellerId,Marketplace,Currency,ReportType,Asin,[Date],SourceFileSha256,SourceRowNumber,SourceSchemaVersion,ImportedBy,TotalSales,AdSales,AdSpend,Orders,Conversions,TotalOrders,Clicks) VALUES ";
  const row=(s,m,c,a,d,total,sales,spend,orders,conversions,totalOrders,clicks)=>"('"+s+"','"+m+"','"+c+"','daily','"+a+"','"+d+"',REPLICATE('a',64),2,1,'test',"+[total,sales,spend,orders,conversions,totalOrders,clicks].map(v=>v===null?'NULL':v).join(',')+")";
  await pool.request().query(prefix+[
   row('s1','amazon.in','INR','B000000001','2026-04-01','100.01','120','10',2,1,3,4),
   row('s1','amazon.in','INR','B000000001','2026-04-02','-1.25',null,null,null,null,-1,null),
   row('s1','amazon.in','INR','B000000002','2026-04-01','50','20','5',1,1,2,10),
   row('s1','amazon.in','INR','B000000003','2026-03-31','80','25','8',1,1,2,8),
   row('s2','amazon.com','USD','B000000001','2026-04-01','10','8','2',1,1,1,4),
   row('s3','amazon.in','INR','B000000001','2026-04-01','9999','9','1',1,1,1,1)
  ].join(','));
  const read=(extra={},actor=user)=>readCanonicalReport({pool,sql,user:actor,query:{...range,...extra}});
  const r=await read({sellerId:'s1',limit:'2',page:'99'});
  assert.equal(r.current[0].totals.totalSales,'148.76');assert.equal(r.current[0].rowCount,'3');
  assert.equal(r.current[0].unmappedRows,'2');assert.equal(r.current[0].ratios.tacos.value,null);
  assert.equal(r.current[0].ratios.cvr.value,'14.285714');assert.equal(r.previous[0].totals.totalSales,'80');
  assert.equal(r.total,3);assert.equal(r.page,2);assert.equal(r.rows.length,1);assert.equal(r.rows[0].current,null);assert.equal(r.rows[0].previous.totals.totalSales,'80');
  const overview=await readCanonicalReport({pool,sql,user,query:{...range,sellerId:'s1'},overviewOnly:true});
  const normal=await read({sellerId:'s1'});
  for(const key of ['current','previous','comparisons','series','period','empty'])assert.deepEqual(overview[key],normal[key],key);
  assert.deepEqual(overview.rows,[]);
  const full=await readCanonicalReport({pool,sql,user,query:{...range,sellerId:'s1',limit:'1',page:'2'},exportAll:true});
  assert.equal(full.rows.length,3);assert.equal(full.total,3);assert.equal(full.page,1);
  await pool.request().query("UPDATE dbo.AdsProductDailyFacts SET AdvertisedSku=N'00123',ProductPrice=7100.0300000001,ACoS=0.255,ViewImpressions=9007199254740993,SourceRowNumber=7 WHERE SellerId='s1' AND Asin='B000000001' AND [Date]='2026-04-01';");
  const snapshot=async(extra={},actor=user)=>readCanonicalReport({pool,sql,user:actor,query:{...range,...extra},exportWorkbook:async snap=>{
   const raw=[],entities=[],rec=rawReconciler(snap.report);
   for await(const r of snap.rawRows()){rec.add(r);raw.push(r);}
   rec.finish(snap.rawCount);
   for await(const r of snap.entityRows())entities.push(r);
   assert.equal(entities.length,snap.report.total);
   return {report:snap.report,raw,entities,aligned:snap.aligned};
  }});
  const exported=await snapshot({sellerId:'s1',page:'99',limit:'1'});
  assert.equal(exported.raw.length,4);assert.equal(exported.entities.length,3);assert.equal(exported.report.total,3);
  assert.equal(exported.raw.filter(r=>r.periodKey==='previous').length,1);
  const extraSource=exported.raw.find(r=>r.Asin==='B000000001'&&r.Date==='2026-04-01');
  assert.equal(extraSource.AdvertisedSku,'00123');assert.equal(extraSource.ProductPrice,'7100.0300000001');
  assert.equal(extraSource.ViewImpressions,'9007199254740993');assert.equal(extraSource.ACoS,'0.2550000000');assert.equal(extraSource.SourceRowNumber,'7');
  assert.ok(SOURCE_FIELDS.every(f=>Object.hasOwn(extraSource,f.canonicalColumn)));
  assert.equal(exported.entities.find(r=>r.entityKey==='B000000003').current,null);
  assert.equal(exported.aligned.length,30);
  const scoped=await snapshot();assert.equal(scoped.raw.length,5);assert.ok(scoped.raw.every(r=>r.SellerId!=='s3'));
  assert.equal((await snapshot({sellerId:'s1',brand:'A'})).raw.length,2);
  assert.equal((await snapshot({sellerId:'s1',groupBy:'parent'})).entities.length,2);
  await assert.rejects(()=>snapshot({sellerId:'s1,s3'}),{code:'forbidden_seller'});
  const noExport=await snapshot({}, {...user,assignedSellers:[]});assert.equal(noExport.raw.length,0);

  const byKey=await read({sellerId:'s1',sortBy:'entityKey',sortOrder:'asc'});
  assert.deepEqual(byKey.rows.map(x=>x.entityKey),['B000000001','B000000002','B000000003']);
  const first=await read({sellerId:'s1',limit:'2',sortBy:'totalSales',sortOrder:'desc'});
  assert.equal(first.rows[0].entityKey,'B000000001');assert.equal(first.rows[0].title,null);
  assert.equal(first.rows[0].current.totals.totalSales,'98.76');
  const parent=await read({sellerId:'s1',groupBy:'parent',granularity:'month'});
  assert.equal(parent.total,2);assert.equal(parent.rows.find(x=>x.entityKey==='B000000010').current.totals.totalSales,'50');
  assert.equal(parent.series.find(x=>x.periodKey==='current').bucket,'2026-04');
  const filtered=await read({sellerId:'s1',brand:'A'});
  assert.equal(filtered.current[0].totals.totalSales,'50');
  const portfolio=await read({groupBy:'seller'});
  assert.equal(portfolio.current.length,2);assert.equal(portfolio.current.find(x=>x.currency==='INR').totals.totalSales,'148.76');
  assert.equal(portfolio.current.find(x=>x.currency==='USD').totals.totalSales,'10');
  const drill=await read({sellerId:'s1',entityKey:'B000000001',marketplace:'amazon.in',currency:'INR'});
  assert.equal(drill.current[0].totals.totalSales,'98.76');assert.equal(drill.rows.length,0);
  assert.equal(drill.diagnostics.sellerId,'s1');assert.equal(drill.diagnostics.current.seller.totals.totalSales,'148.76');
  assert.equal(drill.diagnostics.current.shares.spend.value,'66.666667');assert.equal(drill.diagnostics.current.shares.spend.status,'observed_partial');
  assert.equal(drill.diagnostics.current.observations.positiveSpendDays,1);assert.equal(drill.diagnostics.current.observations.signedAdjustmentDays,1);
  const weekly=await read({sellerId:'s1',granularity:'week'});
  assert.equal(weekly.current[0].totals.totalSales,'148.76');assert.ok(weekly.series.some(x=>x.bucket==='2026-03-30'));
  await assert.rejects(()=>read({sellerId:'s1,s3'}),{code:'forbidden_seller'});
  const opts=await readCanonicalOptions({pool,sql,user,sellerId:'s1'});
  assert.deepEqual(opts.sellers.map(s=>s.id),['s1','s2']);assert.deepEqual(opts.brands,['A','Other']);assert.equal(opts.parentAvailable,true);
  await pool.request().query("CREATE TABLE dbo.GmsTargets(Id varchar(50),SellerId varchar(50),GoalType varchar(20),TargetType varchar(20),[Year] int,[Month] int,TotalTargetValue decimal(18,2)); CREATE TABLE dbo.GmsTargetBreakdowns(TargetId varchar(50),PeriodType varchar(20),PeriodValue int,TargetValue decimal(18,2)); INSERT dbo.GmsTargets VALUES('m1','s1','ADS','MONTHLY',2026,4,100),('y1','s1','ADS','YEARLY',2026,NULL,1200),('m2','s1','ACOS','MONTHLY',2026,4,20),('m3','s3','ADS','MONTHLY',2026,4,9999); INSERT dbo.GmsTargetBreakdowns VALUES('y1','MONTH',4,200);");
  const target=await readCanonicalTargets({pool,sql,user,query:{...range,sellerId:'s1'}});
  assert.equal(target.rows.length,2);assert.equal(Number(target.rows.find(x=>x.goalType==='ADS').target),100);assert.equal(target.rows.find(x=>x.goalType==='ADS').actual,'15');
  assert.equal(target.rows.find(x=>x.goalType==='ADS').attainmentPct,null);
  await assert.rejects(()=>readCanonicalTargets({pool,sql,user,query:{...range,sellerId:'s1,s3'}}),{code:'forbidden_seller'});
  // Full month-to-date even when selected start is mid-month; no cross-currency
  // or unauthorized target attachment. Actual rows with no target remain visible.
  await pool.request().query("INSERT dbo.GmsTargetBreakdowns VALUES('m1','WEEK',1,20),('m1','WEEK',2,30),('m1','WEEK',3,20),('m1','WEEK',4,20),('m1','WEEK',5,10);");
  const budget=(query,actor=user)=>readBudgetIntelligence({pool,sql,user:actor,query,now:new Date('2026-11-28T12:00:00Z')});
  const pacing=await budget({startDate:'2026-04-02',endDate:'2026-04-10',sellerId:'s1'});
  assert.equal(pacing.rows.length,1);
  const pace=pacing.rows[0];assert.equal(pace.slice.start,'2026-04-01');assert.equal(pace.slice.elapsed,10);assert.equal(pace.budget.actualSpend,'15');
  assert.equal(pace.budget.target,'100');assert.equal(pace.budget.planSource,'configured_weeks');assert.equal(pace.budget.plannedSpend,'32.8571428571');
  assert.equal(pace.budget.status,'insufficient_coverage');assert.equal(pace.budget.projectedMonthEnd,null);
  assert.equal(pace.acos.status,'insufficient_coverage');
  const scopedBudget=await budget({...range});
  assert.ok(scopedBudget.rows.every(x=>x.sellerId!=='s3'));
  assert.equal(scopedBudget.rows.find(x=>x.sellerId==='s2').budget.target,null);
  await assert.rejects(()=>budget({...range,sellerId:'s1,s3'}),{code:'forbidden_seller'});
  await assert.rejects(()=>budget({...range,brand:'A'}),{code:'invalid_ads_filter'});
  // A complete seller month slice uses the yearly month allocation, not the
  // yearly total; exact observed ACoS and weighted scenario are independent.
  await pool.request().query("INSERT dbo.Sellers VALUES('s4','Complete pacing','amazon.in'); INSERT dbo.GmsTargets VALUES('y4','s4','ADS','YEARLY',2026,NULL,36000),('a4','s4','ACOS','YEARLY',2026,NULL,25); INSERT dbo.GmsTargetBreakdowns VALUES('y4','MONTH',4,3000),('a4','MONTH',4,25),('y4','WEEK',41,700),('y4','WEEK',42,700),('y4','WEEK',43,700),('y4','WEEK',44,700),('y4','WEEK',45,200);");
  const completeActor={...user,assignedSellers:['s4']};
  await pool.request().query(prefix+Array.from({length:10},(_,i)=>row('s4','amazon.in','INR','B000000041','2026-04-'+String(i+1).padStart(2,'0'),500,400,120,1,1,2,10)).join(','));
  const completePacing=await budget({startDate:'2026-04-08',endDate:'2026-04-10'},completeActor);
  const cp=completePacing.rows[0];
  assert.equal(cp.budget.target,'3000');assert.equal(cp.budget.targetSource,'YEARLY');assert.equal(cp.budget.plannedSpend,'1000');assert.equal(cp.budget.status,'comparable');
  assert.equal(cp.budget.projectedMonthEnd,'3600');assert.equal(cp.budget.remainingDailyAllowance,'90');assert.equal(cp.budget.varianceToPlan,'200');
  assert.equal(cp.acos.status,'above_target');assert.equal(cp.acos.gapPp,'5');
  // A currency filter must not hide competing historical context.
  await pool.request().query(prefix+row('s4','amazon.com','USD','B000000041','2026-04-01',2,2,1,1,1,1,10));
  const conflict=await budget({startDate:'2026-04-01',endDate:'2026-04-10',currency:'INR'},completeActor);
  assert.equal(conflict.rows.length,1);assert.equal(conflict.rows[0].contextStatus,'context_conflict');assert.equal(conflict.rows[0].budget.projectedMonthEnd,null);
  // Duplicate same-priority allocation fails closed and a seller without facts
  // retains its configured target.
  await pool.request().query("INSERT dbo.GmsTargets VALUES('m4a','s4','ADS','MONTHLY',2026,12,100),('m4b','s4','ADS','MONTHLY',2026,12,150);");
  const future=await budget({startDate:'2026-12-01',endDate:'2026-12-31'},completeActor);
  assert.equal(future.rows[0].slice.elapsed,0);assert.equal(future.rows[0].budget.targetStatus,'conflicting_target');assert.equal(future.rows[0].budget.actualSpend,null);


  const empty=await read({startDate:'2026-11-01',endDate:'2026-11-30'});
  assert.equal(empty.empty,true);assert.equal(empty.total,0);
  // Two complete 2-day windows. Add 12 zero-sales entities to prove
  // counts are computed across all products, not the current page or top ten.
  const signalRows=[];
  const add=(seller,currency,asin,date,total,sales,spend,conversions,clicks)=>{
    signalRows.push(row(seller,currency==='USD'?'amazon.com':'amazon.in',currency,asin,date,total,sales,spend,conversions,conversions,1,clicks));
  };
  for(let i=11;i<=22;i++){
   const asin='B'+String(i).padStart(9,'0');
   add('s1','INR',asin,'2026-05-01',10,0,5,0,10);
   add('s1','INR',asin,'2026-05-02',10,0,5,0,10);
  }
  for(const [d,spend,sales] of [['2026-04-29',5,20],['2026-04-30',5,20],['2026-05-01',7,10],['2026-05-02',7,10]])add('s1','INR','B000000031',d,30,sales,spend,1,10);
  for(const [d,spend,sales] of [['2026-04-29',8,10],['2026-04-30',8,10],['2026-05-01',4,15],['2026-05-02',4,15]])add('s1','INR','B000000032',d,30,sales,spend,1,10);
  add('s1','INR','B000000033','2026-05-01',null,null,9,null,5);
  add('s1','INR','B000000034','2026-05-01',null,20,4,1,5);
  add('s1','INR','B000000034','2026-05-02',30,null,null,null,null);
  add('s1','INR','B000000035','2026-04-30',30,10,5,1,5);
  add('s1','INR','B000000036','2026-05-01',null,0,3,0,25);
  add('s1','INR','B000000036','2026-05-02',30,null,null,null,null);
  add('s2','USD','B000000011','2026-05-01',10,0,2,0,22);
  add('s3','INR','B000000011','2026-05-01',10,0,999,0,30);
  await pool.request().query(prefix+signalRows.join(','));
  const signalQuery={startDate:'2026-05-01',endDate:'2026-05-02'};
  const insights=(extra={},actor=user)=>readCanonicalReport({pool,sql,user:actor,query:{...signalQuery,...extra},insightsOnly:true});
  const review=await insights({limit:'1',page:'99'});
  const rule=(code,currency='INR')=>review.signals.find(s=>s.code===code&&s.currency===currency);
  assert.deepEqual(review.populations.map(r=>r.currency),['INR','USD']);
  assert.equal(review.populations[0].totalEntities,'18');
  assert.equal(rule('spend_zero_sales').count,'13');
  assert.equal(rule('spend_zero_sales').items.length,10);
  assert.ok(rule('spend_zero_sales').items.every(r=>r.sellerId==='s1'&&r.evidenceStatus==='complete_observed'));
  assert.equal(rule('clicks_zero_conversions').count,'13');
  assert.equal(rule('clicks_zero_conversions','USD').count,'1');
  assert.equal(rule('spend_up_sales_down').items[0].entityKey,'B000000031');
  assert.equal(rule('sales_up_spend_down').items[0].entityKey,'B000000032');
  assert.equal(rule('missing_ad_sales').count,'1');
  assert.equal(rule('tacos_coverage_mismatch').count,'2');
  assert.equal(rule('prior_only').items[0].entityKey,'B000000035');
  assert.ok(review.signals.flatMap(s=>s.items).every(r=>r.sellerId!=='s3'));
  const single=await insights({sellerId:'s1',search:'B000000036'});
  assert.equal(single.signals.find(s=>s.code==='spend_zero_sales').items[0].evidenceStatus,'observed_partial');
  const noMatch=await insights({brand:'nonexistent'});assert.equal(noMatch.empty,true);
  await assert.rejects(()=>insights({sellerId:'s1,s3'}),{code:'forbidden_seller'});
  const comparison=await readCanonicalReport({pool,sql,user,query:{...signalQuery,sellerId:'s1',search:'B000000031'}});
  assert.equal(comparison.rows[0].current.coveredDays,2);
  assert.equal(comparison.rows[0].comparison.metrics.spend.percentChange,'40');
  assert.equal(comparison.rows[0].comparison.metrics.sales.percentChange,'-50');
  assert.equal(comparison.comparisons[0].ratios.acos.delta,'45');
  const analyze=(extra={},actor=user)=>readCanonicalReport({pool,sql,user:actor,query:{...signalQuery,...extra},portfolioOnly:true});
  const analytics=await analyze({limit:'1',page:'99'});
  assert.deepEqual(analytics.groups.map(x=>x.currency),['INR','USD']);
  const g=analytics.groups[0],spend=g.concentration.find(x=>x.metric==='spend');
  assert.equal(g.totalEntities,18);assert.equal(g.currentEntities,17);
  assert.equal(spend.positiveTotal,'158');assert.equal(spend.positiveEntities,17);assert.equal(spend.priorOnlyEntities,1);
  assert.equal(spend.leadingCount,13);assert.equal(spend.samples.length,10);
  assert.equal(g.segments.reduce((n,x)=>n+x.count,0),18);
  assert.equal(g.segments.find(x=>x.code==='spend_zero_sales').count,13);
  assert.equal(g.segments.find(x=>x.code==='prior_only').count,1);
  assert.equal(g.segments.find(x=>x.code==='insufficient_coverage').count,1);
  assert.ok(g.segments.flatMap(x=>x.items).every(x=>x.sellerId==='s1'));
  assert.equal(analytics.trends.filter(x=>x.currency==='INR').length,2);
  const trend=analytics.trends.find(x=>x.currency==='INR'&&x.bucket==='2026-05-01');
  assert.equal(trend.previousStart,'2026-04-29');assert.equal(trend.currentStart,'2026-05-01');
  assert.equal(trend.current.totals.spend,'87');assert.equal(trend.previous.totals.spend,'13');
  const brand=analytics.breakdowns.find(x=>x.dimension==='brand'&&x.currency==='INR');
  assert.equal(brand.items[0].label,'Brand unavailable');
  const sellerBreakdown=analytics.breakdowns.find(x=>x.dimension==='seller'&&x.currency==='INR');
  assert.equal(sellerBreakdown.totalGroups,'1');assert.equal(sellerBreakdown.items[0].groupKey,'s1');
  assert.equal(sellerBreakdown.items[0].current.totals.spend,'158');
  const month=await analyze({granularity:'month',sellerId:'s1'});
  assert.equal(month.trends.length,1);assert.equal(month.trends[0].days,2);
  assert.equal(month.trends[0].previousStart,'2026-04-29');assert.equal(month.trends[0].current.totals.spend,'158');
  assert.equal((await analyze({brand:'not-a-brand'})).empty,true);
  await assert.rejects(()=>analyze({sellerId:'s1,s3'}),{code:'forbidden_seller'});
  await assert.rejects(()=>analyze({groupBy:'parent'}),{code:'invalid_ads_filter'});
  const noScope=await analyze({}, {...user,assignedSellers:[]});assert.equal(noScope.empty,true);
  const optionsAfter=await readCanonicalOptions({pool,sql,user,sellerId:'s1'});
  assert.deepEqual(optionsAfter.marketplaces,['amazon.in']);
  const filteredMarket=await analyze({marketplace:'amazon.com'});assert.deepEqual(filteredMarket.groups.map(x=>x.currency),['USD']);
  assert.equal(g.segments.find(x=>x.code==='spend_zero_sales').compatibleRoas.value,'0');
  assert.equal(g.segments.find(x=>x.code==='spend_zero_sales').compatibleRoas.entities,13);
  // Cross both entity and ranked-page boundaries. Brand sample must remain
  // bounded while reporting all 25 matching groups.
  const large=Array.from({length:2005},(_,i)=>({asin:'L'+String(i+1).padStart(9,'0'),brand:'Brand'+String(i%25).padStart(2,'0')}));
  await pool.request().input('data',sql.NVarChar(sql.MAX),JSON.stringify(large)).query(
    "INSERT dbo.Asins(AsinCode,SellerId,Brand) SELECT asin,'s1',brand FROM OPENJSON(@data) WITH(asin nvarchar(30),brand nvarchar(255)); "+
    "INSERT dbo.AdsProductDailyFacts(SellerId,Marketplace,Currency,ReportType,Asin,[Date],SourceFileSha256,SourceRowNumber,SourceSchemaVersion,ImportedBy,AdSpend,AdSales,TotalSales,Clicks,Conversions) "+
    "SELECT 's1','amazon.in','INR','daily',asin,'2026-06-01',REPLICATE('a',64),2,1,'test',1,2,4,10,1 FROM OPENJSON(@data) WITH(asin varchar(10));");
  const many=await readCanonicalReport({pool,sql,user,query:{startDate:'2026-06-01',endDate:'2026-06-01',sellerId:'s1',limit:'1'},portfolioOnly:true});
  const mg=many.groups[0],mc=mg.concentration.find(x=>x.metric==='totalSales');
  assert.equal(mg.totalEntities,2005);assert.equal(mc.leadingCount,1604);assert.equal(mc.remainingCount,401);assert.equal(mc.positiveTotal,'8020');assert.equal(mc.leadingSharePct,'80');
  assert.equal(mc.samples.length,10);assert.equal(mc.samples[0].entityKey,large[0].asin);
  assert.equal(mg.segments.find(x=>x.code==='at_reference').count,2005);
  assert.deepEqual(mg.segments.find(x=>x.code==='at_reference').compatibleCvr,{value:'10',entities:2005});
  const brandMany=many.breakdowns.find(x=>x.dimension==='brand');
  assert.equal(brandMany.totalGroups,'25');assert.equal(brandMany.items.length,20);
  assert.equal(brandMany.items[0].label,'Brand00');assert.equal(brandMany.items[0].current.totals.totalSales,'324');
  // Complete snapshot crosses both SQL cursor sizes; ignores UI page/limit.
  const bigExport=await snapshot({startDate:'2026-06-01',endDate:'2026-06-01',sellerId:'s1',page:'99',limit:'1'});
  assert.equal(bigExport.raw.length,2005);assert.equal(bigExport.entities.length,2005);
  assert.equal(new Set(bigExport.raw.map(r=>r.Asin)).size,2005);
  assert.equal(new Set(bigExport.entities.map(r=>r.key)).size,2005);
  // Full reconciliation runs against the same scope, not a current page.
  const certify=(extra={},actor=user)=>readCanonicalReport({pool,sql,user:actor,query:{...signalQuery,...extra},reconciliationOnly:true});
  const reconciled=await certify({limit:'1',page:'99'});
  assert.equal(reconciled.status,'passed',JSON.stringify(reconciled.checks));
  assert.equal(reconciled.checks.length,9);
  assert.ok(reconciled.checks.every(c=>c.status==='passed'&&c.mismatchCount===0));
  assert.deepEqual([...new Set(reconciled.baseline.map(x=>x.currency))],['INR','USD']);
  assert.equal(reconciled.baseline.find(x=>x.currency==='INR'&&x.periodKey==='current').totals.spend,'158');
  assert.equal((await certify({brand:'does-not-exist'})).status,'no_data');
  assert.equal((await certify({}, {...user,assignedSellers:[]})).status,'no_data');
  await assert.rejects(()=>certify({sellerId:'s1,s3'}),{code:'forbidden_seller'});
  // Simulate a direct database inconsistency outside the validated importer.
  await pool.request().query("UPDATE dbo.AdsProductDailyFacts SET OrderedRevenue=99 WHERE SellerId='s1' AND Asin='B000000031' AND [Date]='2026-05-01';");
  const mismatch=await certify({sellerId:'s1'});
  assert.equal(mismatch.status,'failed');
  assert.equal(mismatch.checks.find(c=>c.code==='source_aliases').mismatchCount,1);
  assert.equal(mismatch.checks.find(c=>c.code==='entity_rollup').status,'passed');
  assert.equal(mismatch.quality.find(r=>r.periodKey==='current').totalSalesAliasMismatch,'1');



 }finally{if(pool)await pool.close();await admin.request().query('ALTER DATABASE ['+database+'] SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE ['+database+'];').catch(()=>{});await admin.close();}
});
