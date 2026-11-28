const { getPool } = require('../database/db');
const { performance } = require('node:perf_hooks');
const { loadGmsFilters } = require('../services/gmsAnalyticsFilters');
const { pageSpec,loadPagedAnalytics } = require('../services/gmsAnalyticsPageService');
const { isGmsSchemaError, sendGmsSchemaUnavailable } = require('../database/gmsSchema');

const configured=Number(process.env.GMS_ANALYTICS_CONCURRENCY||8);
const maxConcurrent=Number.isInteger(configured)&&configured>=1&&configured<=32?configured:8;
let active=0;
exports.overview = async (req,res) => {
  const started=performance.now();
  const options=req.body||{};
  try { pageSpec(options); }
  catch(error) { return res.status(400).json({success:false,message:error.message}); }

  if(active>=maxConcurrent)return res.status(429).json({success:false,message:'Several GMS reports are loading. Please try again shortly.'});
  active++;
  // Closing an obsolete browser request also cancels its SQL work.
  const controller=new AbortController();
  let timedOut=false;
  const timeout=setTimeout(()=>{timedOut=true;controller.abort();},120000);
  timeout.unref?.();
  const close=()=>{if(!res.writableEnded)controller.abort();};
  res.once('close',close);
  try {
    const poolStarted=performance.now();
    const pool=await getPool();
    const poolMs=performance.now()-poolStarted;
    let timings={sqlMs:0,composeMs:0};
    const data=await loadPagedAnalytics(pool,req.user,options,{signal:controller.signal,onTiming:value=>{timings=value;}});
    const totalMs=performance.now()-started;
    res.set('Cache-Control','private, no-store');
    res.set('Server-Timing',`pool;dur=${poolMs.toFixed(1)}, sql;dur=${timings.sqlMs.toFixed(1)}, compose;dur=${timings.composeMs.toFixed(1)}, total;dur=${totalMs.toFixed(1)}`);
    if(totalMs>=1000)console.info('[GMS ANALYTICS TIMING]',JSON.stringify({poolMs:Math.round(poolMs),sqlMs:Math.round(timings.sqlMs),composeMs:Math.round(timings.composeMs),totalMs:Math.round(totalMs),records:data.meta.records,pageSize:data.pagination.pageSize}));
    if(timedOut&&!res.destroyed)return res.status(504).json({success:false,message:'This report took too long. Choose a shorter reporting period or try again.'});
    if(!controller.signal.aborted)return res.json({success:true,data});
  } catch(error) {
    if(res.destroyed)return;
    if(timedOut)return res.status(504).json({success:false,message:'This report took too long. Choose a shorter reporting period or try again.'});
    if(controller.signal.aborted)return;
    console.error('GMS analytics failed:',error.message);
    if(isGmsSchemaError(error))return sendGmsSchemaUnavailable(res);
    return res.status(500).json({success:false,message:'Failed to calculate GMS analytics. Narrow the date range or try again.'});
  } finally { clearTimeout(timeout);active--; res.removeListener('close',close); }
};

exports.filters=async(req,res)=>{
  const started=performance.now();
  try{
    const data=await loadGmsFilters(await getPool(),req.user);
    res.set('Cache-Control','private, no-store');
    res.set('Server-Timing','filters;dur='+ (performance.now()-started).toFixed(1));
    return res.json({success:true,data});
  }catch(error){
    console.error('GMS filter directory failed:',error.message);
    return res.status(500).json({success:false,message:'Unable to load report filter options. Refresh to try again.'});
  }
};
