const { sql }=require('../database/db');
const { dateWindow,gmsCatalogApplySql,unambiguousSellerSql }=require('../utils/gmsPhase1');
const { resolveSellerScope }=require('../utils/sellerScope');
const { filterSpec,priorWindow,isoWeek,weekKey,buildGroups,buildOverview,buildAnalytics }=require('./gmsAnalyticsService');

const MAX_PAGE_SIZE=100;
const MAX_RANGE_DAYS=3660;
const DAY=86400000;
const dateAt=d=>new Date(d+'T00:00:00Z');
const iso=d=>d.toISOString().slice(0,10);
const shift=(d,n)=>iso(new Date(dateAt(d).getTime()+n*DAY));
const monthStart=d=>d.slice(0,7)+'-01';
function monthOffset(d,n){
  const v=dateAt(monthStart(d));v.setUTCMonth(v.getUTCMonth()+n);return iso(v);
}
function monday(d){return shift(d,-((dateAt(d).getUTCDay()+6)%7));}
function periodRange(key){
  let m;
  if((m=/^day-(\d{4}-\d{2}-\d{2})$/.exec(key))){
    const w=dateWindow(m[1],m[1],{required:true});return w;
  }
  if((m=/^month-total-(\d{4}-\d{2})$/.exec(key))){
    const from=dateWindow(m[1]+'-01',m[1]+'-01',{required:true}).from;
    return {from,to:shift(monthOffset(from,1),-1)};
  }
  if((m=/^week-total-(\d{4}-\d{2})\|(\d{4}-W\d{2})$/.exec(key))){
    const month=dateWindow(m[1]+'-01',m[1]+'-01',{required:true}).from;
    const year=m[2].slice(0,4),week=Number(m[2].slice(-2));
    const start=shift(monday(year+'-01-04'),(week-1)*7);
    if(isoWeek(start)!==m[2])throw new Error('Invalid week sort');
    const from=start>month?start:month;
    const last=shift(monthOffset(month,1),-1),end=shift(start,6);
    const to=end<last?end:last;
    if(from>to||weekKey(from)!==m[1]+'|'+m[2])throw new Error('Invalid week sort');
    return {from,to};
  }
  return null;
}
function pageSpec(input={}){
  const window=dateWindow(input.startDate,input.endDate,{required:true});
  if(window.from<'2000-01-01'||window.to>'2099-12-31')throw new Error('Choose dates between 2000 and 2099');
  if(priorWindow(window).days>MAX_RANGE_DAYS)throw new Error('Choose an interactive reporting range of 10 years or less; use export for longer history');
  const level=input.level??'asin';
  if(!['asin','seller'].includes(level))throw new Error('Invalid grouping');
  const page=input.page??1,pageSize=input.pageSize??50;
  if(!Number.isSafeInteger(page)||page<1||page>2147483647)throw new Error('Invalid page');
  if(!Number.isSafeInteger(pageSize)||pageSize<1||pageSize>MAX_PAGE_SIZE)throw new Error('Page size must be between 1 and 100');
  const sort=input.sort??{key:'orderedRevenue',direction:'desc'};
  if(!sort||typeof sort.key!=='string'||!['asc','desc'].includes(sort.direction))throw new Error('Invalid sort');
  const fixed={
    dbBrand:"MIN(CASE WHEN MetadataRank=1 THEN COALESCE(DbBrand,N'-') END)",
    asin:"MIN(Asin)",
    brand:"MIN(COALESCE(NULLIF(Brand,N''),N'-'))",
    storeCode:"MIN(COALESCE(NULLIF(StoreCode,N''),N'-'))",
    orderedUnits:"CASE WHEN COUNT_BIG(*)=COUNT_BIG(OrderedUnits) THEN SUM(CONVERT(bigint,OrderedUnits)) END",
    orderedRevenue:"CASE WHEN COUNT_BIG(*)=COUNT_BIG(OrderedRevenue) THEN SUM(OrderedRevenue) END",
  };
  const range=Object.prototype.hasOwnProperty.call(fixed,sort.key)?null:periodRange(sort.key);
  if(!range&&!Object.prototype.hasOwnProperty.call(fixed,sort.key))throw new Error('Invalid sort column');
  const expr=range?"CASE WHEN COUNT_BIG(CASE WHEN ReportDate BETWEEN @sortFrom AND @sortTo THEN 1 END)>0 AND COUNT_BIG(CASE WHEN ReportDate BETWEEN @sortFrom AND @sortTo THEN 1 END)=COUNT_BIG(CASE WHEN ReportDate BETWEEN @sortFrom AND @sortTo THEN OrderedRevenue END) THEN SUM(CASE WHEN ReportDate BETWEEN @sortFrom AND @sortTo THEN OrderedRevenue END) END":fixed[sort.key];
  return {window,level,page,pageSize,filters:filterSpec(input),sort:{key:sort.key,direction:sort.direction},sortSql:{expr,range,direction:sort.direction==='asc'?'ASC':'DESC'}};
}
const money=['OrderedRevenue','ShippedRevenue','ShippedCOGS'];
const units=['OrderedUnits','ShippedUnits','CustomerReturns'];
const lower=k=>k[0].toLowerCase()+k.slice(1);
const aggregateMetrics=[...money,...units].map(k=>
  'CASE WHEN COUNT_BIG(*)=COUNT_BIG('+k+') THEN CONVERT(varchar(80),SUM('+ (units.includes(k)?'CONVERT(bigint,'+k+')':k) +')) END AS '+lower(k)
).join(',\n');
const current='ReportDate BETWEEN @currentFrom AND @currentTo';
function buildPageQuery(q,user,spec){
  const {window,filters,level,sortSql}=spec;
  const scope=resolveSellerScope(user);
  const prior=priorWindow(window);
  const from=[prior.from,monthOffset(window.from,-1),shift(window.from,-7)].sort()[0];
  q.input('historyFrom',sql.Date,from).input('currentFrom',sql.Date,window.from).input('currentTo',sql.Date,window.to)
    .input('requestedPage',sql.Int,spec.page).input('pageSize',sql.Int,spec.pageSize);
  let mappingWhere='WHERE 1=1',factWhere='WHERE 1=1',sourceWhere='';
  if(!scope.isGlobal){
    q.input('allowedSellerIds',sql.NVarChar(sql.MAX),JSON.stringify(scope.allowed||[]));
    mappingWhere+=' AND EXISTS (SELECT 1 FROM OPENJSON(@allowedSellerIds) j WHERE j.value=a.SellerId) AND '+unambiguousSellerSql('a');
    sourceWhere+=' AND (g.SellerId IS NULL OR EXISTS (SELECT 1 FROM OPENJSON(@allowedSellerIds) j WHERE j.value=g.SellerId))';
  }
  if(filters.sellerIds!==null){
    q.input('selectedSellerIds',sql.NVarChar(sql.MAX),JSON.stringify(filters.sellerIds));
    mappingWhere+=' AND EXISTS (SELECT 1 FROM OPENJSON(@selectedSellerIds) j WHERE j.value=COALESCE(g.SellerId,a.SellerId))';
    sourceWhere+=' AND (g.SellerId IS NULL OR EXISTS (SELECT 1 FROM OPENJSON(@selectedSellerIds) j WHERE j.value=g.SellerId))';
  }
  if(filters.search){
    q.input('search',sql.NVarChar(200),filters.search);
    // CHARINDEX treats %, _ and brackets literally, just like JS includes.
    const fields=['g.Asin','COALESCE(g.ReportProductTitle,m.ProductTitle)','g.Brand','m.DbBrand','g.StoreCode'];
    factWhere+=' AND ('+fields.map(f=>"CHARINDEX(@search,LOWER(CONVERT(nvarchar(max),COALESCE("+f+",N''))) COLLATE Latin1_General_100_BIN2)>0").join(' OR ')+')';
  }
  if(sortSql.range)q.input('sortFrom',sql.Date,sortSql.range.from).input('sortTo',sql.Date,sortSql.range.to);
  const entity=level==='asin'?'CONVERT(nvarchar(300),g.Asin)':"CONVERT(nvarchar(300),CASE WHEN m.SellerId IS NOT NULL THEN N'seller:'+CONVERT(nvarchar(100),m.SellerId) ELSE N'unmatched:'+COALESCE(NULLIF(g.Brand,N''),N'-') END)";
  // Resolve catalog metadata once per distinct stored ASIN/owner, not once per
  // fact. All output derives from a single materialized, permission-scoped
  // dataset in this batch; no pagination or date filter changes the KPIs.
  return 'SET NOCOUNT ON;\n'+
  'SELECT g.Id AS FactId,g.Asin,g.SellerId,CONVERT(date,g.Date) AS ReportDate,g.Brand,g.ReportProductTitle,g.StoreCode,g.OrderedRevenue,g.OrderedUnits,g.ShippedRevenue,g.ShippedCOGS,g.ShippedUnits,g.CustomerReturns INTO #GmsSource FROM GmsDailyPerformance g WHERE g.Date>=@historyFrom AND g.Date<DATEADD(day,1,@currentTo)'+sourceWhere+';\n'+
  'SELECT DISTINCT Asin,SellerId INTO #GmsKeys FROM #GmsSource;\n'+
  'SELECT g.Asin,g.SellerId AS StoredSellerId,COALESCE(g.SellerId,a.SellerId) AS SellerId,s.Name AS DbBrand,a.Title AS ProductTitle INTO #GmsMap FROM #GmsKeys g '+gmsCatalogApplySql+' LEFT JOIN Sellers s ON COALESCE(g.SellerId,a.SellerId)=s.Id '+mappingWhere+';\n'+
  'SELECT '+entity+' COLLATE Latin1_General_100_BIN2 AS EntityKey,g.FactId,g.Asin,m.SellerId,m.DbBrand,m.ProductTitle,g.Brand,g.StoreCode,g.ReportDate,g.OrderedRevenue,g.OrderedUnits,g.ShippedRevenue,g.ShippedCOGS,g.ShippedUnits,g.CustomerReturns INTO #GmsFacts FROM #GmsSource g JOIN #GmsMap m ON g.Asin=m.Asin AND (g.SellerId=m.StoredSellerId OR (g.SellerId IS NULL AND m.StoredSellerId IS NULL)) '+factWhere+';\n'+
  'CREATE INDEX IX_GmsFacts_Entity_Date ON #GmsFacts(EntityKey,ReportDate);\n'+
  // Result set 0: aggregate all matching selected and prior days in SQL, not Node.
  'SELECT CONVERT(char(10),ReportDate,23) AS date,COUNT_BIG(*) AS recordCount,'+aggregateMetrics+' FROM #GmsFacts GROUP BY ReportDate ORDER BY ReportDate;\n'+
  // Result set 1: exact selected-range fact/entity counts, not just the page.
  'SELECT COUNT_BIG(*) AS records,COUNT_BIG(DISTINCT Asin) AS asins,COUNT_BIG(DISTINCT SellerId) AS sellers,COUNT_BIG(CASE WHEN SellerId IS NULL THEN 1 END) AS unmatchedRecords FROM #GmsFacts WHERE '+current+';\n'+
  'SELECT EntityKey,'+sortSql.expr+' AS SortValue INTO #GmsGroups FROM '+(spec.sort.key==='dbBrand'?'(SELECT *,ROW_NUMBER() OVER(PARTITION BY EntityKey ORDER BY ReportDate DESC,Asin,FactId) AS MetadataRank FROM #GmsFacts WHERE '+current+') f':'#GmsFacts')+' WHERE '+current+' GROUP BY EntityKey;\n'+
  'DECLARE @totalRows bigint=(SELECT COUNT_BIG(*) FROM #GmsGroups); DECLARE @actualPage int=CASE WHEN @totalRows=0 THEN 1 WHEN @requestedPage>((@totalRows+@pageSize-1)/@pageSize) THEN CONVERT(int,(@totalRows+@pageSize-1)/@pageSize) ELSE @requestedPage END;\n'+
  'SELECT EntityKey,ROW_NUMBER() OVER(ORDER BY CASE WHEN SortValue IS NULL THEN 1 ELSE 0 END,SortValue '+sortSql.direction+',EntityKey ASC) AS Ordinal INTO #GmsOrder FROM #GmsGroups;\n'+
  'SELECT EntityKey,Ordinal INTO #GmsPage FROM #GmsOrder WHERE Ordinal>CONVERT(bigint,@actualPage-1)*@pageSize AND Ordinal<=CONVERT(bigint,@actualPage)*@pageSize;\n'+
  // Result set 2: page info, including clamping after filtering or new data.
  'SELECT @totalRows AS totalRows,@actualPage AS page,@pageSize AS pageSize;\n'+
  // Result set 3: one compact aggregate per entity/date, including needed history.
  'SELECT f.EntityKey AS entityKey,CONVERT(char(10),f.ReportDate,23) AS date,'+aggregateMetrics+' FROM #GmsFacts f JOIN #GmsPage p ON f.EntityKey=p.EntityKey GROUP BY f.EntityKey,f.ReportDate ORDER BY f.EntityKey,f.ReportDate DESC;\n'+
  // Result set 4: newest metadata for each selected entity, deterministic order.
  'SELECT p.EntityKey AS entityKey,p.Ordinal AS ordinal,x.Asin AS asin,x.SellerId AS sellerId,x.DbBrand AS dbBrand,x.ProductTitle AS productTitle,x.Brand AS brand,x.StoreCode AS storeCode FROM #GmsPage p CROSS APPLY (SELECT TOP (1) f.Asin,f.SellerId,f.DbBrand,f.ProductTitle,f.Brand,f.StoreCode FROM #GmsFacts f WHERE f.EntityKey=p.EntityKey AND f.'+current+' ORDER BY f.ReportDate DESC,f.Asin,f.FactId) x ORDER BY p.Ordinal;\n'+
  // Result set 5: distinct labels for page rows only. Avoid shipping full ASIN
  // membership lists for seller groups (the tracker doesn't consume them).
  'SELECT DISTINCT f.EntityKey AS entityKey,f.Brand AS brand,f.StoreCode AS storeCode FROM #GmsFacts f JOIN #GmsPage p ON f.EntityKey=p.EntityKey WHERE f.'+current+';\n';
}
function emptyPage(spec){
  return {...buildOverview([],spec.window),matrixRows:[],monthGroups:{},pagination:{page:1,pageSize:spec.pageSize,totalRows:0},sort:spec.sort};
}
function composePage(recordsets,spec){
  if(!Array.isArray(recordsets)||recordsets.length!==6)throw new Error('Incomplete GMS analytics result');
  const [daily,counts,paging,days,entities,labels]=recordsets;
  const overview=buildOverview(daily,spec.window);
  const monthGroups=buildGroups(overview.daily.map(d=>d.date));
  const metadata=new Map(entities.map(r=>[r.entityKey,r]));
  const rows=days.map(d=>{
    const m=metadata.get(d.entityKey);
    if(!m)throw new Error('Missing GMS page metadata');
    return {...d,asin:m.asin,sellerId:m.sellerId,dbBrand:m.dbBrand,brand:m.brand,storeCode:m.storeCode,productTitle:m.productTitle};
  });
  const matrix=buildAnalytics(rows,{window:spec.window,level:spec.level,groups:monthGroups,includeOverview:false});
  const byKey=new Map(matrix.matrixRows.map(r=>[r.key,r]));
  const labelMap=new Map();
  for(const r of labels){
    if(!labelMap.has(r.entityKey))labelMap.set(r.entityKey,{brands:new Set(),stores:new Set()});
    const group=labelMap.get(r.entityKey);
    group.brands.add(r.brand||'-');group.stores.add(r.storeCode||'-');
  }
  const matrixRows=entities.map(e=>{
    const r=byKey.get(e.entityKey);
    if(!r)throw new Error('Missing GMS matrix row');
    const l=labelMap.get(e.entityKey)||{brands:new Set([e.brand||'-']),stores:new Set([e.storeCode||'-'])};
    const brandsList=[...l.brands].sort(),storeCodesList=[...l.stores].sort();
    const {asinsList,...rest}=r;
    return {...rest,brandsList,storeCodesList,brand:brandsList.join(', '),storeCode:storeCodesList.join(', ')};
  });
  const count=counts[0]||{},p=paging[0]||{};
  return {...overview,meta:{...overview.meta,records:Number(count.records||0),asins:Number(count.asins||0),sellers:Number(count.sellers||0),unmatchedRecords:Number(count.unmatchedRecords||0)},
    matrixRows,monthGroups,pagination:{page:Number(p.page||1),pageSize:spec.pageSize,totalRows:Number(p.totalRows||0)},sort:spec.sort};
}
async function loadPagedAnalytics(pool,user,options,{signal}={}){
  const spec=pageSpec(options),scope=resolveSellerScope(user);
  if(scope.empty||spec.filters.sellerIds?.length===0)return emptyPage(spec);
  if(signal?.aborted)throw new Error('Analytics request cancelled');
  const q=pool.request(),query=buildPageQuery(q,user,spec);
  const cancel=()=>{try{q.cancel?.();}catch(_){/* request already ended */}};
  signal?.addEventListener('abort',cancel,{once:true});
  try{
    const result=await q.query(query);
    return composePage(result.recordsets,spec);
  }finally{
    signal?.removeEventListener('abort',cancel);
  }
}
module.exports={pageSpec,periodRange,buildPageQuery,composePage,loadPagedAnalytics,MAX_PAGE_SIZE};
