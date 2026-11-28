'use strict';
const {randomUUID}=require('node:crypto');
const {strictScope,AdsScopeError}=require('./adsCanonicalScope');
const owner=user=>String(user.Id||user.id||user._id||'');
function assertAccess(user,frozen){
 if(!frozen||typeof frozen.unrestricted!=='boolean'||!Array.isArray(frozen.ids))throw new AdsScopeError('analysis_scope_invalid','Saved report scope is invalid.',403);
 const current=strictScope(user,undefined);
 if(frozen.unrestricted&&!current.unrestricted)throw new AdsScopeError('forbidden_seller','Saved report access has changed.',403);
 if(!current.unrestricted&&frozen.ids.some(id=>!current.sellerIds.includes(id)))throw new AdsScopeError('forbidden_seller','Saved report access has changed.',403);
}
async function save({pool,sql,user,filters,snapshot,result}){
 const scope=strictScope(user,filters.sellerId),frozen={unrestricted:scope.unrestricted,ids:scope.sellerIds};
 const id=randomUUID(),evidence=JSON.stringify({...snapshot,products:result.products}),analysis=JSON.stringify({...result.analysis,usage:result.usage,durationMs:result.durationMs});
 if(Buffer.byteLength(evidence)>5000000||Buffer.byteLength(analysis)>100000)throw new AdsScopeError('analysis_too_large','Analysis exceeds storage limits.',422);
 await pool.request().input('id',sql.VarChar(36),id).input('owner',sql.VarChar(50),owner(user)).input('scope',sql.NVarChar(sql.MAX),JSON.stringify(frozen)).input('filters',sql.NVarChar(sql.MAX),JSON.stringify(filters)).input('evidence',sql.NVarChar(sql.MAX),evidence).input('analysis',sql.NVarChar(sql.MAX),analysis).input('model',sql.NVarChar(160),result.model).input('prompt',sql.VarChar(24),result.analysis.promptVersion).query('INSERT dbo.AdsAiAnalysisReports(Id,OwnerId,SellerScope,Filters,Evidence,Analysis,Model,PromptVersion) VALUES(@id,@owner,@scope,@filters,@evidence,@analysis,@model,@prompt)');
 return id;
}
async function list({pool,sql,user}){
 const r=await pool.request().input('owner',sql.VarChar(50),owner(user)).query('SELECT TOP(50) Id,SellerScope,Filters,CreatedAt,Model FROM dbo.AdsAiAnalysisReports WHERE OwnerId=@owner ORDER BY CreatedAt DESC,Id DESC');
 return r.recordset.flatMap(row=>{try{assertAccess(user,JSON.parse(row.SellerScope));return [{id:row.Id,filters:JSON.parse(row.Filters),createdAt:row.CreatedAt,model:row.Model}];}catch{return [];}});
}
async function get({pool,sql,user,id}){
 if(typeof id!=='string'||!/^[0-9a-f-]{36}$/i.test(id))throw new AdsScopeError('analysis_not_found','Analysis not found.',404);
 const r=await pool.request().input('owner',sql.VarChar(50),owner(user)).input('id',sql.VarChar(36),id).query('SELECT SellerScope,Filters,Evidence,Analysis,Model,CreatedAt FROM dbo.AdsAiAnalysisReports WHERE OwnerId=@owner AND Id=@id');
 const row=r.recordset[0];if(!row)throw new AdsScopeError('analysis_not_found','Analysis not found.',404);
 assertAccess(user,JSON.parse(row.SellerScope));
 return {...JSON.parse(row.Evidence),analysis:JSON.parse(row.Analysis),reportId:id,model:row.Model,mode:'ai_analysis',reason:null,filters:JSON.parse(row.Filters)};
}
module.exports={save,list,get,assertAccess};
