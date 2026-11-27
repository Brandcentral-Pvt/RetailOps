const { getPool } = require('../database/db');
const { pageSpec,loadPagedAnalytics } = require('../services/gmsAnalyticsPageService');
const { isGmsSchemaError, sendGmsSchemaUnavailable } = require('../database/gmsSchema');

const configured=Number(process.env.GMS_ANALYTICS_CONCURRENCY||8);
const maxConcurrent=Number.isInteger(configured)&&configured>=1&&configured<=32?configured:8;
let active=0;
exports.overview = async (req,res) => {
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
    const data=await loadPagedAnalytics(await getPool(),req.user,options,{signal:controller.signal});
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
