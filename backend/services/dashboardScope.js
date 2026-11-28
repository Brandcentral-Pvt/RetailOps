'use strict';
const {strictScope,AdsScopeError}=require('./adsCanonicalScope');
const {buildInClause}=require('../utils/sqlHelpers');

function managerSelection(value){
 if(value===undefined||value===null||value==='all')return null;
 if(typeof value!=='string'||!value.trim()||value!==value.trim()||value.length>50||/[,\s*]/.test(value))
  throw new AdsScopeError('invalid_manager_filter','Select a valid manager.');
 return value;
}
function intersectScope(base,ids){
 const selected=[...new Set(ids.filter(id=>typeof id==='string'&&id.length>0&&id.length<=50))];
 const sellerIds=base.unrestricted?selected:base.sellerIds.filter(id=>selected.includes(id));
 if(sellerIds.length>1000)throw new AdsScopeError('dashboard_scope_too_large','Select a narrower seller scope.',422);
 return {...base,sellerIds,unrestricted:false,empty:sellerIds.length===0};
}
async function resolveDashboardScope({pool,sql,user,sellerId,managerId}){
 const base=strictScope(user,sellerId);
 if(!base.unrestricted&&base.sellerIds.length>1000)throw new AdsScopeError('dashboard_scope_too_large','Select a narrower seller scope.',422);
 const manager=managerSelection(managerId);
 if(!manager)return {...base,managerId:null};
 if(base.empty)return {...base,managerId:manager};
 // UserSellers is authoritative; goals and display names are not assignments.
 const r=await pool.request().input('managerId',sql.VarChar(50),manager).query(
  "SELECT DISTINCT us.SellerId FROM dbo.UserSellers us JOIN dbo.Users u ON u.Id=us.UserId JOIN dbo.Roles r ON r.Id=u.RoleId JOIN dbo.Sellers s ON s.Id=us.SellerId WHERE u.Id=@managerId AND u.IsActive=1 AND (r.Name LIKE '%manager%' OR r.Name LIKE '%admin%' OR r.Level>=2)");
 return {...intersectScope(base,r.recordset.map(row=>row.SellerId)),managerId:manager};
}
function publicScope(scope){return {sellerIds:scope.sellerIds,unrestricted:scope.unrestricted,empty:scope.empty,managerId:scope.managerId};}
async function options({pool,sql,user}){
 const base=strictScope(user,undefined);
 if(base.empty)return {sellers:[],managers:[]};
 if(!base.unrestricted&&base.sellerIds.length>1000)throw new AdsScopeError('dashboard_scope_too_large','Select a narrower seller scope.',422);
 const sr=pool.request(),mr=pool.request();
 const sellerWhere=base.unrestricted?'':' WHERE s.Id IN ('+buildInClause(sr,'optionSeller',base.sellerIds)+')';
 const managerWhere=base.unrestricted?'':' AND EXISTS(SELECT 1 FROM dbo.UserSellers us WHERE us.UserId=u.Id AND us.SellerId IN ('+buildInClause(mr,'optionManagerSeller',base.sellerIds)+'))';
 const [s,m]=await Promise.all([
  sr.query('SELECT s.Id AS id,s.Name AS name FROM dbo.Sellers s'+sellerWhere+' ORDER BY s.Name,s.Id'),
  mr.query("SELECT u.Id AS id,COALESCE(NULLIF(LTRIM(RTRIM(CONCAT(u.FirstName,' ',u.LastName))),''),u.Id) AS name FROM dbo.Users u JOIN dbo.Roles r ON r.Id=u.RoleId WHERE u.IsActive=1 AND (r.Name LIKE '%manager%' OR r.Name LIKE '%admin%' OR r.Level>=2)"+managerWhere+' ORDER BY name,u.Id')
 ]);
 return {sellers:s.recordset,managers:m.recordset};
}
module.exports={managerSelection,intersectScope,resolveDashboardScope,publicScope,options};
