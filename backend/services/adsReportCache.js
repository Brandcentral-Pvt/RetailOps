'use strict';
const {createHash}=require('node:crypto');
const {sources}=require('../migrations/108_ads_report_revision');
const TTL=60,MAX_BYTES=1500000,MAX_WINDOW_DAYS=90;
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const sorted=values=>[...new Set(values||[])].map(String).sort();
async function bounded(fn,ms=150){
 let timer;
 try{return await Promise.race([Promise.resolve().then(fn).catch(()=>null),new Promise(resolve=>{timer=setTimeout(()=>resolve(null),ms);timer.unref?.();})]);}
 finally{clearTimeout(timer);}
}
async function readRevision(pool){
 const request=pool.request();
 const checks=sources.map(s=>"EXISTS(SELECT 1 FROM sys.triggers WHERE object_id=OBJECT_ID(N'dbo."+s.trigger+"') AND parent_id=OBJECT_ID(N'dbo."+s.table+"') AND is_disabled=0)").join(' AND ');
 let timer;
 try{
  const result=await Promise.race([request.query("SELECT SourceName AS source,CONVERT(varchar(36),Revision) AS revision FROM dbo.AdsReportRevision WITH(READCOMMITTEDLOCK) WHERE "+checks+" ORDER BY SourceName;"),new Promise(resolve=>{timer=setTimeout(()=>{try{request.cancel?.();}catch{}resolve(null);},750);timer.unref?.();})]);
  const rows=result?.recordset;
  if(!Array.isArray(rows)||rows.length!==sources.length)return null;
  const map=new Map(rows.map(r=>[r.source,r.revision]));
  if(!sources.every(s=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(map.get(s.name)||'')))return null;
  return sources.map(s=>map.get(s.name)).join(':');
 }catch{return null;}finally{clearTimeout(timer);}
}
function identity(user,parsed,mode){
 const id=user?.Id||user?.id||user?._id;
 if(!id||parsed.scope.empty||parsed.period.days>MAX_WINDOW_DAYS||parsed.entityKey||!['overview','report'].includes(mode))return null;
 const scope={unrestricted:parsed.scope.unrestricted,ids:sorted(parsed.scope.sellerIds)};
 const fingerprint=hash({id:String(id),mode,role:user?.role?.Name||user?.role?.name||user?.RoleName||null,permissions:sorted(user?.permissions),parsed:{...parsed,scope}});
 // One entry per principal and report mode bounds cache cardinality.
 return {userHash:hash(String(id)),fingerprint,mode};
}
function createReportCache({cache,read=readRevision}={}){
 return async function loadReport({pool,user,parsed,mode,load,refresh=false}){
  const keyInfo=identity(user,parsed,mode);
  if(process.env.ADS_REPORT_CACHE_ENABLED==='false'||!keyInfo)return {data:await load(),status:'bypass'};
  const store=cache||require('./cacheService');
  if(!await bounded(()=>store.isEnabled()))return {data:await load(),status:'bypass'};
  const key=store.key('ads-report-v1',keyInfo.userHash,keyInfo.mode);
  // Read the revision after the cache read, so a commit during the cache
  // lookup cannot validate an entry against the earlier revision.
  const cached=refresh?null:await bounded(()=>store.get(key));
  const revision=await bounded(()=>read(pool),800);
  if(!revision)return {data:await load(),status:'no-revision'};
  if(cached?.fingerprint===keyInfo.fingerprint&&cached.revision===revision&&cached.data&&Array.isArray(cached.data.current)&&Array.isArray(cached.data.previous)&&Array.isArray(cached.data.rows)&&Array.isArray(cached.data.series))return {data:cached.data,status:'hit'};
  const data=await load();
  const after=await bounded(()=>read(pool),800);
  if(!after||after!==revision)return {data,status:'revision-changed'};
  const entry={fingerprint:keyInfo.fingerprint,revision,data};
  if(Buffer.byteLength(JSON.stringify(entry),'utf8')>MAX_BYTES)return {data,status:'oversize'};
  await bounded(()=>store.set(key,entry,TTL));
  return {data,status:refresh?'refresh':'miss'};
 };
}
module.exports={createReportCache,readRevision,identity};
