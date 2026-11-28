/* Administrator-run, read-only GMS cold-query diagnostics. No report values,
 * seller names, ASINs, credentials, or raw execution plans are printed.
 * Uses a dedicated connection so STATISTICS settings never affect the API.
 */
const {performance}=require('node:perf_hooks');
const {isDeepStrictEqual}=require('node:util');
const net=require('node:net');
const {sql}=require('../database/db');
const {pageSpec,buildPageQuery,composePage}=require('../services/gmsAnalyticsPageService');
const {readReportRevision}=require('../services/gmsAnalyticsReportCache');

function parseArgs(argv){
  const params={strategy:'compare',page:1,pageSize:50,level:'asin',repeats:1,sellerIds:[]};
  const allowed=new Set(['start','end','level','page','page-size','strategy','repeats','seller-id']);
  let all=false;
  for(let i=0;i<argv.length;i++){
    const flag=argv[i];
    if(flag==='--all-sellers'){all=true;continue;}
    const key=flag.startsWith('--')?flag.slice(2):'';
    if(!allowed.has(key)||i+1>=argv.length||argv[i+1].startsWith('--'))throw new Error('Invalid diagnostic argument: '+flag);
    const value=argv[++i];
    if(key==='seller-id'){params.sellerIds.push(value);continue;}
    if(key==='start')params.startDate=value;
    else if(key==='end')params.endDate=value;
    else if(key==='page-size')params.pageSize=Number(value);
    else if(key==='page'||key==='repeats')params[key]=Number(value);
    else params[key]=value;
  }
  if(all===Boolean(params.sellerIds.length))throw new Error('Choose --all-sellers or at least one --seller-id, not both');
  if(!['compare','baseline','optimized'].includes(params.strategy)||!Number.isInteger(params.repeats)||params.repeats<1||params.repeats>3)
    throw new Error('Strategy must be compare, baseline or optimized; repeats must be 1-3');
  params.sellerIds=all?null:params.sellerIds;
  const spec=pageSpec(params);
  if((Date.parse(spec.window.to)-Date.parse(spec.window.from))/86400000+1>90)throw new Error('Diagnostic date ranges are limited to 90 days');
  return {spec,strategy:params.strategy,repeats:params.repeats};
}

function addIo(target,message){
  // Only parse numeric STATISTICS IO fields. Do not log arbitrary SQL messages.
  const match=/Table '([^']+)'\. Scan count (\d+), logical reads (\d+), physical reads (\d+)/i.exec(String(message||''));
  if(!match)return;
  const name=match[1].replace(/^([#]Gms[A-Za-z]+)_+.*$/,'$1');
  const row=target[name]||(target[name]={scans:0,logicalReads:0,physicalReads:0,lobLogicalReads:0});
  row.scans+=Number(match[2]);row.logicalReads+=Number(match[3]);row.physicalReads+=Number(match[4]);
  row.lobLogicalReads+=Number(/\blob logical reads (\d+)/i.exec(message)?.[1]||0);
}

async function indexInventory(pool){
  const result=await pool.request().query(
    "SELECT t.name AS tableName,i.name AS indexName,i.type_desc AS type,i.is_disabled AS disabled,i.has_filter AS filtered,"+
    "c.name AS columnName,ic.key_ordinal AS keyOrdinal,ic.is_included_column AS included "+
    "FROM sys.tables t JOIN sys.schemas s ON s.schema_id=t.schema_id JOIN sys.indexes i ON i.object_id=t.object_id "+
    "JOIN sys.index_columns ic ON ic.object_id=i.object_id AND ic.index_id=i.index_id "+
    "JOIN sys.columns c ON c.object_id=ic.object_id AND c.column_id=ic.column_id "+
    "WHERE s.name='dbo' AND t.name IN ('GmsDailyPerformance','Asins') AND i.type IN (1,2) "+
    "ORDER BY t.name,i.name,ic.key_ordinal,c.name"
  );
  return result.recordset;
}

async function profile(pool,spec,strategy){
  const q=pool.request(),io=Object.create(null),actor={role:{name:'admin'},assignedSellers:[]};
  q.on('info',info=>addIo(io,info.message));
  const statement=buildPageQuery(q,actor,spec,{strategy});
  const start=performance.now();
  // No persistent writes. Temp tables are session-local. Use a dedicated
  // connection and close it even if a statement or cancellation fails.
  const result=await q.query('SET STATISTICS IO ON; SET STATISTICS TIME ON;\n'+statement+'\nSET STATISTICS IO OFF; SET STATISTICS TIME OFF;');
  const sqlMs=performance.now()-start;
  const composeStart=performance.now();
  const report=composePage(result.recordsets,spec);
  const composeMs=performance.now()-composeStart;
  return {report,timing:{strategy,sqlMs:Math.round(sqlMs),composeMs:Math.round(composeMs),responseBytes:Buffer.byteLength(JSON.stringify(report),'utf8'),io}};
}
async function run(){
  const {spec,strategy,repeats}=parseArgs(process.argv.slice(2));
  // Do not use getPool(): application startup can initialize shared database
  // objects. These credentials are used solely for the bounded read workload.
  const host=process.env.DB_SERVER;
  if(!host||!process.env.DB_NAME)throw new Error('Configure DB_SERVER and DB_NAME before profiling');
  const pool=new sql.ConnectionPool({
    server:host,database:process.env.DB_NAME,port:Number(process.env.DB_PORT||1433),
    user:process.env.GMS_PROFILE_DB_USER||process.env.DB_USER,
    password:process.env.GMS_PROFILE_DB_PASSWORD||process.env.DB_PASSWORD,
    options:{encrypt:process.env.DB_ENCRYPT!==undefined?process.env.DB_ENCRYPT==='true':net.isIP(host)===0,trustServerCertificate:process.env.DB_TRUST_SERVER_CERT==='true',enableArithAbort:true,useUTC:false},
    requestTimeout:120000,connectionTimeout:10000,cancelTimeout:5000,pool:{min:0,max:1,idleTimeoutMillis:5000},
  });
  try{
    await pool.connect();
    const indexes=await indexInventory(pool);
    const before=await readReportRevision(pool);
    const samples=[];
    let equal=null;
    for(let n=0;n<repeats;n++){
      const order=strategy==='compare'?(n%2===0?['baseline','optimized']:['optimized','baseline']):[strategy];
      const results={};
      for(const name of order){
        results[name]=await profile(pool,spec,name);
        samples.push({iteration:n+1,...results[name].timing});
      }
      if(strategy==='compare')equal=(equal===null||equal)&&isDeepStrictEqual(results.baseline.report,results.optimized.report);
    }
    const after=await readReportRevision(pool);
    const sourceStable=before&&after?before===after:null;
    console.log(JSON.stringify({window:spec.window,level:spec.level,page:spec.page,pageSize:spec.pageSize,
      sourceStable,resultsEqual:sourceStable===true?equal:null,samples,indexes},null,2));
    if(sourceStable===true&&equal===false)process.exitCode=2;
  }finally{await pool.close();}
}
if(require.main===module)run().catch(err=>{console.error('GMS profile failed:',err.code||err.name||'Error');process.exitCode=1;});
module.exports={parseArgs,addIo,indexInventory,profile};
