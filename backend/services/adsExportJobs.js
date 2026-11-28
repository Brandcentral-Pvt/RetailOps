'use strict';
const {createReportExportJobs}=require('./reportExportJobs');
const {parseReport,readCanonicalReport}=require('./adsCanonicalReport');
const {strictScope,AdsScopeError}=require('./adsCanonicalScope');
const {writeCompleteWorkbook}=require('./adsCompleteWorkbook');
const {writeDailyCsv}=require('./adsExportCsv');
const {readBudgetIntelligence}=require('./adsBudgetIntelligence');
const err=(code,message,status=400)=>new AdsScopeError(code,message,status);
const permission=u=>['adsreport_view','adsreport_export'].every(p=>u.permissions?.includes('*')||u.permissions?.includes(p));
function freezeScope(user,filters){
 const scope=parseReport(user,filters,true).scope;
 if(scope.empty)throw err('empty_scope','No authorized sellers match this export.',403);
 if(scope.sellerIds.length>1000)throw err('scope_too_large','Select up to 1,000 sellers.',422);
 return {global:scope.unrestricted,ids:scope.sellerIds};
}
function scopedFilters(user,filters,frozen){
 if(!permission(user))throw err('access_changed','Export permission is no longer available.',403);
 if(frozen.global){if(!strictScope(user).unrestricted)throw err('access_changed','Global export scope is no longer available.',403);return {...filters,sellerId:undefined};}
 if(!Array.isArray(frozen.ids)||!frozen.ids.length)throw err('access_changed','Invalid stored export scope.',403);
 strictScope(user,frozen.ids);
 return {...filters,sellerId:frozen.ids};
}

function validateFilters(filters){
 const clean={...filters};delete clean.page;delete clean.limit;
 if(clean.entityKey)throw err('invalid_export','Export a report scope, not a drill-down.');
 return clean;
}
async function generate({pool,sql,user,filters,signal,filePath,format}){
  const writer=format==='csv'?writeDailyCsv:writeCompleteWorkbook;
  let budgetInfo=null;
  if(format==='xlsx'){
   if(filters.allHistory)budgetInfo={rows:[],reason:'Not applicable to unbounded history; choose a reporting window for seller-wide month budgets and targets.'};
   else if(filters.brand||filters.category||filters.search||filters.marketplace)budgetInfo={rows:[],reason:'Not applicable: seller-wide budget data cannot be attributed to catalog, marketplace or search filters.'};
   else{const query=Object.fromEntries(['sellerId','startDate','endDate','currency'].filter(k=>filters[k]!=null).map(k=>[k,filters[k]]));budgetInfo=await readBudgetIntelligence({pool,sql,user,query});}
  }
  return readCanonicalReport({pool,sql,user,query:filters,signal,backgroundExport:true,advancedExport:format==='xlsx',exportWorkbook:snapshot=>writer({filePath,...snapshot,filters,signal,advanced:format==='xlsx',budgetInfo})});
}
module.exports=createReportExportJobs({kind:'ads',permission,freezeScope,scopedFilters,validateFilters,generate,migration:require('../migrations/105_ads_export_jobs')});
