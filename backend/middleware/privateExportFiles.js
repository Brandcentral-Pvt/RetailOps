const path=require('node:path');
// Generated financial exports must be delivered only by the authenticated
// owner-scoped download endpoint, not the public upload static server.
function privateExportFiles(req,res,next){
  let decoded;
  try{decoded=decodeURIComponent(req.path);}
  catch(_){return res.sendStatus(400);}
  const normalized=path.posix.normalize('/'+decoded.replace(/\\/g,'/')).toLowerCase();
  if(normalized==='/exports'||normalized.startsWith('/exports/'))return res.sendStatus(404);
  return next();
}
module.exports=privateExportFiles;
