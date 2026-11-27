const { getPool } = require('../database/db');
const { dateWindow } = require('../utils/gmsPhase1');
const { filterSpec, loadAnalytics } = require('../services/gmsAnalyticsService');
const { isGmsSchemaError, sendGmsSchemaUnavailable } = require('../database/gmsSchema');

exports.overview = async (req,res) => {
  const options=req.body||{};
  try {
    dateWindow(options.startDate,options.endDate,{required:true});
    filterSpec(options);
    if (options.level!=null&&!['asin','seller'].includes(options.level)) throw new Error('Invalid grouping');
  } catch(error) { return res.status(400).json({success:false,message:error.message}); }
  try {
    const data=await loadAnalytics(await getPool(),req.user,options);
    return res.json({success:true,data});
  } catch(error) {
    console.error('GMS analytics failed:',error.message);
    if(isGmsSchemaError(error))return sendGmsSchemaUnavailable(res);
    return res.status(500).json({success:false,message:'Failed to calculate GMS analytics'});
  }
};
