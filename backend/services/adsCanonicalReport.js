'use strict';
// Canonical reporting: materialize the authorized current/prior fact population
// once per report, then compute all sections on that same immutable temp scope.
const {strictScope,explicitSeller,AdsScopeError}=require('./adsCanonicalScope');
const {METRICS,aggregateProjection,shapeSummary,validateWindow}=require('./adsCanonicalMetrics');
const {comparePeriods,compareCurrencies,readReviewSignals,emptyReview}=require('./adsAnalyticsV3');
const {readPortfolioAnalytics,emptyPortfolio}=require('./adsPortfolioAnalytics');
const GROUPS=new Set(['asin','parent','seller']);
const SORTS=new Set(['totalSales','sales','spend','organicSales','totalOrders','orders','conversions','clicks','impressions','units','entityKey']);
const GRANULARITIES=new Set(['day','week','month']);
const FILTERS=new Set(['sellerId','startDate','endDate','currency','marketplace','brand','category','search','groupBy','granularity','page','limit','sortBy','sortOrder','entityKey','reportType']);
const invalid=(message,code='invalid_ads_filter')=>{throw new AdsScopeError(code,message);};
function scalar(query,key,max){
  const value=query[key];
  if(value===undefined||value===null||value==='')return null;
  if(typeof value!=='string'||value.length>max||/[\u0000]/.test(value))invalid('Invalid '+key+'.');
  return value.trim()||null;
}
function integer(query,key,fallback,max){
  const v=query[key];
  if(v===undefined||v===null||v==='')return fallback;
  if(!/^\d+$/.test(String(v))||Array.isArray(v)||typeof v==='object'||!Number.isSafeInteger(Number(v))||Number(v)<1||Number(v)>max)invalid('Invalid '+key+'.');
  return Number(v);
}
function dateShift(value,days){
  const d=new Date(value+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+days);
  const s=d.toISOString().slice(0,10);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(s)||s.startsWith('0000'))invalid('The previous comparison window is outside the supported calendar.','invalid_date_range');
  return s;
}
function parseReport(user,query={}){
  for(const k of Object.keys(query))if(!FILTERS.has(k))invalid('Unsupported filter: '+k+'.');
  const scope=strictScope(user,query.sellerId);
  const period=validateWindow(query.startDate,query.endDate);
  period.prevStart=dateShift(period.startDate,-period.days);period.prevEnd=dateShift(period.startDate,-1);
  const groupBy=scalar(query,'groupBy',12)||'asin';
  const granularity=scalar(query,'granularity',12)||'day';
  const sortBy=scalar(query,'sortBy',40)||'totalSales';
  const sortOrder=scalar(query,'sortOrder',4)||'desc';
  const reportType=scalar(query,'reportType',20)||'daily';
  if(!GROUPS.has(groupBy)||!GRANULARITIES.has(granularity)||!SORTS.has(sortBy)||!['asc','desc'].includes(sortOrder)||reportType!=='daily')invalid('Invalid grouping, sorting, granularity or report type.');
  const currency=scalar(query,'currency',3),marketplace=scalar(query,'marketplace',50);
  if(currency&&!/^[A-Z]{3}$/.test(currency))invalid('Invalid currency.');
  if(marketplace&&!/^amazon\.[a-z.]{2,12}$/.test(marketplace))invalid('Invalid marketplace.');
  const entityKey=scalar(query,'entityKey',50);
  if(entityKey){
    explicitSeller(user,query.sellerId);
    if(!currency||!marketplace)invalid('Drill-down requires explicit seller, marketplace and currency.');
    if(groupBy!=='seller'&&!/^[A-Z0-9]{10}$/.test(entityKey))invalid('Invalid product key.');
    if(groupBy==='seller'&&entityKey!==query.sellerId)invalid('Invalid seller key.');
  }
  return {scope,period,groupBy,granularity,sortBy,sortOrder,currency,marketplace,entityKey,
    brand:scalar(query,'brand',255),category:scalar(query,'category',255),search:scalar(query,'search',120),
    page:integer(query,'page',1,1000000),limit:integer(query,'limit',50,100)};
}
function scopeWhere(request,sql,scope,column){
  if(scope.empty)return ' AND 1=0';
  if(scope.unrestricted)return '';
  request.input('scopeIds',sql.NVarChar(sql.MAX),JSON.stringify(scope.sellerIds));
  // Scope is based on the persisted fact owner, never an ASIN-only catalog join.
  return " AND EXISTS (SELECT 1 FROM OPENJSON(@scopeIds) WITH ([id] varchar(50) '$') ids WHERE ids.[id]="+column+")";
}
async function catalogColumns(request){
  const q=await request.query("SELECT [name] FROM sys.columns WHERE object_id=OBJECT_ID(N'dbo.Asins');");
  return new Set(q.recordset.map(r=>String(r.name).toLowerCase()));
}
const factColumns=[...new Set(Object.values(METRICS))].map(c=>'['+c+']');
const identity=['SellerId','Marketplace','Currency','Asin','Date'].map(c=>'['+c+']');
const baseCols=[...identity,...factColumns];
const metadataCols=['[CatalogTitle]','[CatalogBrand]','[CatalogCategory]','[CatalogMatches]','[EntityKey]','[SellerName]','[periodKey]'];
const metadataDDL="CAST(NULL AS nvarchar(512)) AS [CatalogTitle], CAST(NULL AS nvarchar(255)) AS [CatalogBrand], CAST(NULL AS nvarchar(255)) AS [CatalogCategory], CAST(0 AS bigint) AS [CatalogMatches], CAST(NULL AS nvarchar(50)) AS [EntityKey], CAST(NULL AS nvarchar(255)) AS [SellerName], CAST(NULL AS varchar(8)) AS [periodKey]";
const metaValue=(name)=>"CASE WHEN a.[matches]=1 THEN a.["+name+"] END";
function catalogApply(columns){
  const max=(name,size)=>columns.has(name.toLowerCase())?'MAX(CONVERT(nvarchar('+size+'),c.['+name+']))':'CAST(NULL AS nvarchar('+size+'))';
  return ' OUTER APPLY (SELECT COUNT_BIG(*) AS [matches],'+max('Title',512)+' AS [title],'+max('Brand',255)+' AS [brand],'+max('Category',255)+' AS [category],'+max('ParentAsin',50)+' AS [parent],'+max('Sku',255)+' AS [sku] FROM dbo.Asins c WHERE c.SellerId=p.SellerId AND c.AsinCode=p.Asin) a ';
}
function entityExpr(groupBy){
  if(groupBy==='seller')return 'CONVERT(nvarchar(50),p.SellerId)';
  if(groupBy==='parent')return "CASE WHEN a.[matches]=1 AND LEN(LTRIM(RTRIM(a.[parent])))=10 AND UPPER(LTRIM(RTRIM(a.[parent]))) COLLATE Latin1_General_100_BIN2 NOT LIKE '%[^A-Z0-9]%' THEN UPPER(LTRIM(RTRIM(a.[parent]))) ELSE CONVERT(nvarchar(50),p.Asin) END";
  return 'CONVERT(nvarchar(50),p.Asin)';
}
function bucketExpr(granularity){
  if(granularity==='month')return "CONVERT(varchar(7),p.[Date],23)";
  if(granularity==='week')return "CONVERT(varchar(10),DATEADD(day,-((DATEDIFF(day,CONVERT(date,'19000101',112),p.[Date])%7+7)%7),p.[Date]),23)";
  return "CONVERT(varchar(10),p.[Date],23)";
}
const unmapped="CONVERT(varchar(30),SUM(CONVERT(bigint,CASE WHEN p.[CatalogMatches]<>1 THEN 1 ELSE 0 END))) AS [unmappedRows]";
const dayCoverage='COUNT(DISTINCT p.[Date]) AS [coveredDays]';
function shape(row){return {...shapeSummary(row),unmappedRows:row.unmappedRows||'0',coveredDays:Number(row.coveredDays??0)};}
function keyOf(r){return JSON.stringify([r.SellerId,r.Marketplace,r.Currency,r.EntityKey]);}
function combineRows(rows){
  const out=new Map();
  for(const r of rows){
    const key=keyOf(r);
    if(!out.has(key))out.set(key,{key,sellerId:r.SellerId,sellerName:r.SellerName||r.SellerId,marketplace:r.Marketplace,currency:r.Currency,entityKey:r.EntityKey,title:r.CatalogTitle||null,brand:r.CatalogBrand||null,category:r.CatalogCategory||null,current:null,previous:null});
    out.get(key)[r.periodKey]=shape({...r,currency:r.Currency});
  }
  return [...out.values()];
}
function scopeMeta(filters){
  return {period:filters.period,reportType:'daily',source:'canonical_v1',groupBy:filters.groupBy,granularity:filters.granularity,sortBy:filters.sortBy,sortOrder:filters.sortOrder};
}
function emptyReport(filters){
  return {...scopeMeta(filters),current:[],previous:[],comparisons:[],series:[],rows:[],total:0,page:1,limit:filters.limit,totalPages:1,empty:true};
}
const MAX_EXPORT_ENTITIES=5000;
async function readCanonicalReport({pool,sql,user,query,exportAll=false,insightsOnly=false,portfolioOnly=false}){
  const f=parseReport(user,query),analysisOnly=insightsOnly||portfolioOnly;
  if(analysisOnly&&(f.entityKey||f.groupBy!=='asin'))invalid('Portfolio analysis requires ASIN grouping without entity drill-down.');
  if(f.scope.empty)return portfolioOnly?{...scopeMeta(f),...emptyPortfolio()}:insightsOnly?{...scopeMeta(f),...emptyReview()}:emptyReport(f);
  const tx=new sql.Transaction(pool);
  await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
  let stage='scope';
  try{
    const columns=await catalogColumns(tx.request());
    if(f.groupBy==='parent'&&!columns.has('parentasin'))throw new AdsScopeError('parent_mapping_unavailable','Parent ASIN mapping is unavailable in the catalog.',409);
    if((f.brand&&!columns.has('brand'))||(f.category&&!columns.has('category')))throw new AdsScopeError('catalog_filter_unavailable','The requested catalog filter is unavailable.',409);
    const entity=entityExpr(f.groupBy);
    await tx.request().batch('SELECT TOP (0) '+baseCols.map(c=>'p.'+c).join(',')+','+metadataDDL+' INTO #AdsScope FROM dbo.AdsProductDailyFacts p;');
    const request=tx.request().input('start',sql.VarChar(10),f.period.startDate).input('end',sql.VarChar(10),f.period.endDate).input('prevStart',sql.VarChar(10),f.period.prevStart);
    let where=" WHERE p.ReportType='daily' AND p.[Date]>=CONVERT(date,@prevStart,23) AND p.[Date]<=CONVERT(date,@end,23)"+scopeWhere(request,sql,f.scope,'p.SellerId');
    for(const [value,name,expr,max] of [[f.currency,'currency','p.Currency',3],[f.marketplace,'marketplace','p.Marketplace',50],[f.brand,'brand',metaValue('brand'),255],[f.category,'category',metaValue('category'),255],[f.entityKey,'entity',entity,50]]){
      if(value){request.input(name,sql.NVarChar(max),value);where+=' AND '+expr+'=@'+name;}
    }
    if(f.search){
      request.input('search',sql.NVarChar(120),f.search);
      where+=" AND (CHARINDEX(@search,p.Asin)>0 OR CHARINDEX(@search,COALESCE("+metaValue('title')+",''))>0 OR CHARINDEX(@search,COALESCE("+metaValue('sku')+",''))>0 OR CHARINDEX(@search,COALESCE(p.AdvertisedSku,''))>0 OR CHARINDEX(@search,"+entity+")>0)";
    }
    await request.query('INSERT #AdsScope ('+[...baseCols,...metadataCols].join(',')+') SELECT '+baseCols.map(c=>'p.'+c).join(',')+','+
      [metaValue('title'),metaValue('brand'),metaValue('category'),'a.[matches]',entity,'CONVERT(nvarchar(255),s.Name)',"CASE WHEN p.[Date]>=CONVERT(date,@start,23) THEN 'current' ELSE 'previous' END"].join(',')+
      ' FROM dbo.AdsProductDailyFacts p JOIN dbo.Sellers s ON s.Id=p.SellerId '+catalogApply(columns)+where+';');
    stage='aggregates';
    const totals=analysisOnly?{recordset:[]}:await tx.request().query('SELECT p.[Currency] AS [currency],p.[periodKey],'+aggregateProjection+','+unmapped+','+dayCoverage+' FROM #AdsScope p GROUP BY p.[Currency],p.[periodKey] ORDER BY p.[Currency],p.[periodKey];');
    const bucket=bucketExpr(f.granularity);
    const series=analysisOnly?{recordset:[]}:await tx.request().query('SELECT p.[Currency] AS [currency],p.[periodKey],'+bucket+' AS [bucket],'+aggregateProjection+','+unmapped+','+dayCoverage+
      ' FROM #AdsScope p GROUP BY p.[Currency],p.[periodKey],'+bucket+' ORDER BY p.[Currency],p.[periodKey],[bucket];');
    let total=0,page=1,totalPages=1,rows=[];
    if(!f.entityKey){
      stage='grouping';
      const groupFields=['[SellerId]','[Marketplace]','[Currency]','[EntityKey]','[periodKey]'];
      const keys=groupFields.slice(0,4);
      const aliases=keys.map(c=>'e.'+c).join(',');
      const equal=(a,b)=>keys.map(c=>a+'.'+c+'='+b+'.'+c).join(' AND ');
      // Include previous-only products as well as current products. Do not
      // average ratios, reconstruct business totals or collapse shared ASINs.
      await tx.request().batch('SELECT '+groupFields.map(c=>'p.'+c).join(',')+',MAX(p.[SellerName]) AS [SellerName],'+
        (f.groupBy==='asin'?'MAX(p.[CatalogTitle])':'CAST(NULL AS nvarchar(512))')+' AS [CatalogTitle],'+
        (f.groupBy==='asin'?'MAX(p.[CatalogBrand])':'CAST(NULL AS nvarchar(255))')+' AS [CatalogBrand],'+
        (f.groupBy==='asin'?'MAX(p.[CatalogCategory])':'CAST(NULL AS nvarchar(255))')+' AS [CatalogCategory],'+aggregateProjection+','+unmapped+','+dayCoverage+
        ' INTO #AdsGroups FROM #AdsScope p GROUP BY '+groupFields.map(c=>'p.'+c).join(',')+'; SELECT DISTINCT '+keys.join(',')+' INTO #AdsEntities FROM #AdsGroups; SELECT TOP(0) CAST(0 AS bigint) AS [rank],'+keys.join(',')+' INTO #AdsPage FROM #AdsEntities;');
      if(analysisOnly){
        stage=portfolioOnly?'portfolio_analytics':'review_signals';
        const review=portfolioOnly?await readPortfolioAnalytics({tx,sql,period:f.period,granularity:f.granularity}):await readReviewSignals({tx,sql,days:f.period.days});
        await tx.request().batch('DROP TABLE #AdsPage; DROP TABLE #AdsEntities; DROP TABLE #AdsGroups; DROP TABLE #AdsScope;');
        await tx.commit();return {...scopeMeta(f),...review};
      }
      const n=await tx.request().query('SELECT CONVERT(varchar(30),COUNT_BIG(*)) AS [total] FROM #AdsEntities;');
      total=Number(n.recordset[0].total);
      if(!Number.isSafeInteger(total)||total<0)throw new Error('Entity count exceeds supported pagination range.');
      if(exportAll&&total>MAX_EXPORT_ENTITIES)throw new AdsScopeError('export_too_large','This export exceeds 5,000 entities. Narrow seller, currency, date or catalog filters; no rows were truncated.',422);
      const effectiveLimit=exportAll?Math.max(1,total):f.limit;
      totalPages=Math.max(1,Math.ceil(total/effectiveLimit));page=exportAll?1:Math.min(f.page,totalPages);
      const sort=f.sortBy==='entityKey'?'e.[EntityKey]':'TRY_CONVERT(decimal(38,10),c.['+f.sortBy+'])';
      const ties=keys.filter(c=>c!=='[Currency]'&&(f.sortBy!=='entityKey'||c!=='[EntityKey]')).map(c=>'e.'+c).join(',');
      const ordering='e.[Currency] ASC,CASE WHEN '+sort+' IS NULL THEN 1 ELSE 0 END,'+sort+' '+f.sortOrder.toUpperCase()+(ties?','+ties:'');
      stage='page';
      await tx.request().input('offset',sql.BigInt,(page-1)*effectiveLimit).input('limit',sql.Int,effectiveLimit).query(
        'INSERT #AdsPage ([rank],'+keys.join(',')+') SELECT ROW_NUMBER() OVER (ORDER BY '+ordering+'),'+aliases+
        " FROM #AdsEntities e LEFT JOIN #AdsGroups c ON "+equal('e','c')+" AND c.[periodKey]='current' ORDER BY "+ordering+' OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY;');
      const result=await tx.request().query('SELECT g.* FROM #AdsPage e JOIN #AdsGroups g ON '+equal('e','g')+' ORDER BY e.[rank],g.[periodKey];');
      rows=combineRows(result.recordset);
      if(!exportAll)for(const row of rows)row.comparison=comparePeriods(row.current,row.previous,f.period.days);
    }
    stage='cleanup';
    await tx.request().batch('DROP TABLE IF EXISTS #AdsPage; DROP TABLE IF EXISTS #AdsEntities; DROP TABLE IF EXISTS #AdsGroups; DROP TABLE #AdsScope;');
    await tx.commit();
    const current=totals.recordset.filter(r=>r.periodKey==='current').map(shape);
    const previous=totals.recordset.filter(r=>r.periodKey==='previous').map(shape);
    return {...scopeMeta(f),current,previous,comparisons:compareCurrencies(current,previous,f.period.days),series:series.recordset.map(r=>({periodKey:r.periodKey,bucket:r.bucket,...shape(r)})),rows,total,page,limit:f.limit,totalPages,empty:current.length===0&&previous.length===0};
  }catch(error){
    try{await tx.rollback();}catch{/* SQL may have aborted already. */}
    if(error instanceof AdsScopeError)throw error;
    throw new Error('Canonical report SQL failed at '+stage+': '+error.message,{cause:error});
  }
}
async function readCanonicalOptions({pool,sql,user,sellerId}){
  const all=strictScope(user),selected=strictScope(user,sellerId);
  if(all.empty)return {sellers:[],brands:[],categories:[],currencies:[],marketplaces:[],truncated:false};
  const sellerReq=pool.request(),scope=scopeWhere(sellerReq,sql,all,'s.Id');
  const sellerRows=await sellerReq.query('SELECT TOP (1001) s.Id AS [id],s.Name AS [name],s.Marketplace AS [marketplace] FROM dbo.Sellers s WHERE 1=1'+scope+' ORDER BY s.Name,s.Id;');
  const columns=await catalogColumns(pool.request());
  async function distinct(column){
    if(!columns.has(column.toLowerCase()))return [];
    const req=pool.request(),predicate=scopeWhere(req,sql,selected,'a.SellerId');
    const r=await req.query('SELECT DISTINCT TOP (501) a.['+column+'] AS [value] FROM dbo.Asins a WHERE a.['+column+'] IS NOT NULL AND a.['+column+']<>\'\' '+predicate+' ORDER BY [value];');
    return r.recordset.map(x=>x.value);
  }
  const currencyReq=pool.request(),currencyScope=scopeWhere(currencyReq,sql,selected,'p.SellerId');
  const currencies=await currencyReq.query('SELECT DISTINCT p.Currency AS [value] FROM dbo.AdsProductDailyFacts p WHERE 1=1'+currencyScope+' ORDER BY [value]; SELECT DISTINCT p.Marketplace AS [value] FROM dbo.AdsProductDailyFacts p WHERE 1=1'+currencyScope+' ORDER BY [value];');
  const brands=await distinct('Brand'),categories=await distinct('Category');
  return {sellers:sellerRows.recordset.slice(0,1000),brands:brands.slice(0,500),categories:categories.slice(0,500),currencies:currencies.recordsets[0].map(x=>x.value),marketplaces:currencies.recordsets[1].map(x=>x.value),parentAvailable:columns.has('parentasin'),
    truncated:sellerRows.recordset.length>1000||brands.length>500||categories.length>500};
}
module.exports={parseReport,readCanonicalReport,readCanonicalOptions,combineRows,MAX_EXPORT_ENTITIES};
