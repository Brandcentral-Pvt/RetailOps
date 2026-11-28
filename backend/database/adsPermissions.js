'use strict';
// Registration only. Never reset RolePermissions or grant new access to a role.
const ADS_PERMISSIONS=Object.freeze([
 Object.freeze({name:'adsreport_view',displayName:'Ads Intelligence: View',description:'View seller-scoped advertising performance and targets',category:'Ads Intelligence',action:'view'}),
 Object.freeze({name:'adsreport_import',displayName:'Ads Intelligence: Import',description:'Validate, confirm and cancel seller-scoped daily CSV imports; view own import history and download validation errors',category:'Ads Intelligence',action:'import'}),
 Object.freeze({name:'adsreport_export',displayName:'Ads Intelligence: Export',description:'Download seller-scoped advertising analytics workbooks',category:'Ads Intelligence',action:'export'})
]);
const literal=value=>"N'"+value.replace(/'/g,"''")+"'";
const names=ADS_PERMISSIONS.map(p=>literal(p.name)).join(',');
const values=ADS_PERMISSIONS.map(p=>'('+[p.name,p.displayName,p.description,p.category,p.action].map(literal).join(',')+')').join(',');
async function inspectAdsPermissions(pool){
 pool=pool||await require('./db').getPool();
 const r=await pool.request().query('SELECT Name,DisplayName,Description,Category,Action FROM dbo.Permissions WHERE Name IN ('+names+');');
 const missing=[],outdated=[];
 for(const expected of ADS_PERMISSIONS){
  const matches=r.recordset.filter(x=>String(x.Name).toLowerCase()===expected.name);
  if(matches.length!==1){missing.push(expected.name);continue;}
  const x=matches[0];
  if(x.Name!==expected.name||x.DisplayName!==expected.displayName||x.Description!==expected.description||x.Category!==expected.category||x.Action!==expected.action)outdated.push(expected.name);
 }
 return {ready:missing.length===0&&outdated.length===0,missing,outdated};
}
async function registerAdsPermissions(pool){
 pool=pool||await require('./db').getPool();
 await pool.request().query(
  "SET XACT_ABORT ON; BEGIN TRY BEGIN TRANSACTION; "+
  "DECLARE @lock int; EXEC @lock=sp_getapplock @Resource='retailops:ads-permissions-100',@LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=30000; "+
  "IF @lock<0 THROW 51050,'Ads permission registration lock unavailable',1; "+
  "DECLARE @definitions TABLE(Name nvarchar(100) PRIMARY KEY,DisplayName nvarchar(200),Description nvarchar(max),Category nvarchar(50),Action nvarchar(50)); "+
  "INSERT @definitions VALUES "+values+"; "+
  // Existing IDs are preserved: role mappings and per-user overrides refer to IDs.
  "UPDATE p SET Name=d.Name,DisplayName=d.DisplayName,Description=d.Description,Category=d.Category,Action=d.Action FROM dbo.Permissions p JOIN @definitions d ON p.Name=d.Name; "+
  "INSERT dbo.Permissions(Id,Name,DisplayName,Description,Category,Action,CreatedAt) "+
  "SELECT LOWER(LEFT(REPLACE(CONVERT(varchar(36),NEWID()),'-',''),24)),d.Name,d.DisplayName,d.Description,d.Category,d.Action,SYSUTCDATETIME() FROM @definitions d "+
  "WHERE NOT EXISTS(SELECT 1 FROM dbo.Permissions p WITH(UPDLOCK,HOLDLOCK) WHERE p.Name=d.Name); "+
  "COMMIT TRANSACTION; END TRY BEGIN CATCH IF XACT_STATE()<>0 ROLLBACK TRANSACTION; THROW; END CATCH;");
}
async function ensureAdsPermissions({pool,apply=false}={}){
 pool=pool||await require('./db').getPool();
 let state=await inspectAdsPermissions(pool);
 if(!state.ready&&apply){await registerAdsPermissions(pool);state=await inspectAdsPermissions(pool);}
 return state;
}
module.exports={ADS_PERMISSIONS,inspectAdsPermissions,registerAdsPermissions,ensureAdsPermissions};
