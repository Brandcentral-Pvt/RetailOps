const {createHash}=require('node:crypto');
const {performance}=require('node:perf_hooks');
const {resolveSellerScope}=require('../utils/sellerScope');
const {pageSpec,loadPageSpec}=require('./gmsAnalyticsPageService');
const sharedCache=require('./cacheService');
const {sources}=require('../migrations/096_gms_report_revision');

const TTL_SECONDS=60;
const MAX_BLOCK_ROWS=200;
const MAX_CACHE_BYTES=1500000;
const MAX_WINDOW_DAYS=90;
const CACHE_DEADLINE_MS=150;
const REVISION_DEADLINE_MS=750;
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const sorted=values=>[...new Set(values)].sort();
const cancelled=signal=>{if(signal?.aborted)throw new Error('Analytics request cancelled');};

async function boundedCacheCall(fn){
  let timer;
  try{
    return await Promise.race([
      Promise.resolve().then(fn).catch(()=>null),
      new Promise(resolve=>{timer=setTimeout(()=>resolve(null),CACHE_DEADLINE_MS);timer.unref?.();}),
    ]);
  }finally{clearTimeout(timer);}
}

// A cache hit is permitted only if all three revision triggers still exist,
// are enabled and their committed revision rows are readable. No revision
// metadata (including on a pre-migration deployment) means use live SQL.
async function readReportRevision(pool,signal){
  cancelled(signal);
  const q=pool.request();
  const checks=sources.map(s=>"EXISTS (SELECT 1 FROM sys.triggers WHERE object_id=OBJECT_ID(N'dbo."+s.trigger+"') AND parent_id=OBJECT_ID(N'dbo."+s.table+"') AND is_disabled=0)").join(' AND ');
  let timer;
  const cancel=()=>{try{q.cancel?.();}catch(_){}};
  signal?.addEventListener('abort',cancel,{once:true});
  try{
    const result=await Promise.race([
      q.query("SELECT SourceName AS source,CONVERT(varchar(36),Revision) AS revision FROM dbo.GmsReportRevision WHERE "+checks+" ORDER BY SourceName"),
      new Promise(resolve=>{timer=setTimeout(()=>{cancel();resolve(null);},REVISION_DEADLINE_MS);timer.unref?.();}),
    ]);
    cancelled(signal);
    const rows=result?.recordset;
    if(!Array.isArray(rows)||rows.length!==sources.length)return null;
    const map=new Map(rows.map(r=>[r.source,r.revision]));
    if(!sources.every(s=>/^[a-f0-9-]{36}$/i.test(map.get(s.name)||'')))return null;
    return sources.map(s=>map.get(s.name)).join(':');
  }catch(error){
    cancelled(signal);
    return null;
  }finally{
    clearTimeout(timer);
    signal?.removeEventListener('abort',cancel);
  }
}

function cacheIdentity(user,spec){
  const id=user?.Id??user?._id??user?.id;
  if(id==null||String(id)==='')return null;
  const scope=resolveSellerScope(user);
  if(scope.empty||spec.filters.sellerIds?.length===0)return null;
  const days=(Date.parse(spec.window.to)-Date.parse(spec.window.from))/86400000+1;
  if(days>MAX_WINDOW_DAYS)return null;
  const pagesPerBlock=Math.min(4,Math.floor(MAX_BLOCK_ROWS/spec.pageSize));
  if(pagesPerBlock<2)return null;
  const blockPage=Math.floor((spec.page-1)/pagesPerBlock)+1;
  const blockSize=pagesPerBlock*spec.pageSize;
  // A single active block per user keeps the key cardinality bounded. The
  // fingerprint includes every filter, effective scope and ordering input.
  const fingerprint=hash({
    user:String(id),global:scope.isGlobal,allowed:sorted(scope.allowed||[]),
    window:spec.window,level:spec.level,
    sellerIds:spec.filters.sellerIds===null?null:sorted(spec.filters.sellerIds),
    search:spec.filters.search,sort:spec.sort,pageSize:spec.pageSize,blockPage,blockSize,
  });
  return {userHash:hash(String(id)),fingerprint,blockSpec:{...spec,page:blockPage,pageSize:blockSize}};
}

function sliceBlock(report,spec,blockSpec){
  const p=report?.pagination,total=p?.totalRows;
  if(!Number.isSafeInteger(total)||total<0||p.pageSize!==blockSpec.pageSize||
    !Number.isSafeInteger(p.page)||p.page<1||!Array.isArray(report.matrixRows))return null;
  const expectedBlock=Math.max(1,Math.min(blockSpec.page,Math.ceil(total/blockSpec.pageSize)));
  if(p.page!==expectedBlock)return null;
  const offset=(p.page-1)*blockSpec.pageSize;
  if(report.matrixRows.length!==Math.min(blockSpec.pageSize,Math.max(0,total-offset)))return null;
  const page=Math.max(1,Math.min(spec.page,Math.ceil(total/spec.pageSize)));
  const start=(page-1)*spec.pageSize-offset;
  const count=Math.min(spec.pageSize,Math.max(0,total-(page-1)*spec.pageSize));
  if(start<0||start+count>report.matrixRows.length)return null;
  return {...report,matrixRows:report.matrixRows.slice(start,start+count),pagination:{page,pageSize:spec.pageSize,totalRows:total}};
}

function createReportLoader({cache=sharedCache,readRevision=readReportRevision,load=loadPageSpec}={}){
  return async function loadReportAnalytics(pool,user,options,{signal,onTiming}={}){
    const spec=pageSpec(options);
    const identity=cacheIdentity(user,spec);
    const started=performance.now();
    let sqlMs=0,composeMs=0;
    const collect=t=>{sqlMs+=t.sqlMs;composeMs+=t.composeMs;};
    const emit=status=>onTiming?.({sqlMs,composeMs,cacheMs:Math.max(0,performance.now()-started-sqlMs-composeMs),cacheStatus:status});
    async function live(status){
      cancelled(signal);
      const report=await load(pool,user,spec,{signal,onTiming:collect});
      emit(status);return report;
    }
    if(process.env.GMS_REPORT_CACHE_ENABLED==='false'||!identity||!await boundedCacheCall(()=>cache.isEnabled()))return live('bypass');
    const key=cache.key('gms-report-block-v1',identity.userHash);
    const cached=options.refresh===true?null:await boundedCacheCall(()=>cache.get(key));
    cancelled(signal);
    const revision=await readRevision(pool,signal);
    if(!revision)return live('no-revision');
    if(cached?.fingerprint===identity.fingerprint&&cached.revision===revision){
      const page=sliceBlock(cached.report,spec,identity.blockSpec);
      if(page){emit('hit');return page;}
    }

    const block=await load(pool,user,identity.blockSpec,{signal,onTiming:collect});
    cancelled(signal);
    const page=sliceBlock(block,spec,identity.blockSpec);
    if(!page)return live('invalid-block');
    const after=await readRevision(pool,signal);
    // Do not publish a block spanning a source change. Use the original,
    // authoritative page path instead of mixing revisions between pages.
    if(!after||after!==revision)return live('revision-changed');
    const entry={fingerprint:identity.fingerprint,revision,report:block};
    if(Buffer.byteLength(JSON.stringify(entry),'utf8')>MAX_CACHE_BYTES){
      emit('oversize');return page;
    }
    await boundedCacheCall(()=>cache.set(key,entry,TTL_SECONDS));
    cancelled(signal);
    emit(options.refresh===true?'refresh':'miss');return page;
  };
}
const loadReportAnalytics=createReportLoader();
module.exports={loadReportAnalytics,createReportLoader,readReportRevision,cacheIdentity,sliceBlock};
