const { getPool } = require('../database/db');
const { pageSpec,loadPagedAnalytics } = require('../services/gmsAnalyticsPageService');
const { isGmsSchemaError, sendGmsSchemaUnavailable } = require('../database/gmsSchema');

exports.overview = async (req,res) => {
  const options=req.body||{};
  try { pageSpec(options); }
  catch(error) { return res.status(400).json({success:false,message:error.message}); }

  // Closing an obsolete browser request also cancels its SQL work.
  const controller=new AbortController();
  const close=()=>{if(!res.writableEnded)controller.abort();};
  res.once('close',close);
  try {
    const data=await loadPagedAnalytics(await getPool(),req.user,options,{signal:controller.signal});
    if(!controller.signal.aborted)return res.json({success:true,data});
  } catch(error) {
    if(controller.signal.aborted||res.destroyed)return;
    console.error('GMS analytics failed:',error.message);
    if(isGmsSchemaError(error))return sendGmsSchemaUnavailable(res);
    return res.status(500).json({success:false,message:'Failed to calculate GMS analytics. Narrow the date range or try again.'});
  } finally { res.removeListener('close',close); }
};
