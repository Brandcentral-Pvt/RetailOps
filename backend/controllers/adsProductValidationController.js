'use strict';
const {isAdsSchemaError,sendAdsSchemaUnavailable}=require('../database/adsSchema');
const fs = require('node:fs/promises');
const { getPool,sql } = require('../database/db');
const { validateReport,replayValidatedRows,AdsValidationError } = require('../services/adsProductContract');
const { ingestCanonicalReport,AdsIngestionError }=require('../services/adsCanonicalIngestion');
const {issueConfirmation,verifyConfirmation,importsEnabled}=require('../services/adsImportConfirmation');
const {createHash}=require('node:crypto');

const error=(res,status,code,message,extra={})=>res.status(status).json({success:false,code,message,...extra});
const {resolveContext,strictScope,explicitSeller,AdsScopeError}=require('../services/adsCanonicalScope');
async function listSellers(req,res) {
  try {
    const scope=strictScope(req.user);
    if (scope.empty || scope.denied) return res.json({success:true,data:[]});
    const pool=await getPool();
    const request=pool.request();
    if (!scope.unrestricted) request.input('ids',sql.NVarChar(sql.MAX),JSON.stringify(scope.sellerIds));
    const result=await request.query('SELECT Id,Name,Marketplace FROM dbo.Sellers'+
      (scope.unrestricted?'':' WHERE Id IN (SELECT [value] FROM OPENJSON(@ids))')+' ORDER BY Name,Id');
    return res.json({success:true,data:result.recordset.map(s=>({id:s.Id,name:s.Name,marketplace:s.Marketplace,context:resolveContext(s)}))});
  } catch(e) { if(isAdsSchemaError(e))return sendAdsSchemaUnavailable(res);return error(res,503,'seller_options_unavailable','Seller options are unavailable. Retry later.'); }
}
async function validate(req,res) {
  const file=req.file;
  try {
    if (!file) return error(res,400,'file_required','A CSV report is required.');
    const sellerId=explicitSeller(req.user,req.body?.sellerId);
    if(req.body?.reportType!=='daily')return error(res,400,'unsupported_report_type','Only product_daily v1 reports are supported.');
    const pool=await getPool();
    const result=await pool.request().input('seller',sql.VarChar,sellerId).query('SELECT Id,Marketplace FROM dbo.Sellers WHERE Id=@seller');
    const seller=result.recordset[0];
    if (!seller || seller.Id!==sellerId) return error(res,404,'seller_not_found','Seller not found.');
    const context=resolveContext(seller);
    if (!context) return error(res,409,'seller_context_unverified','The seller marketplace/currency must be verified by an administrator.');
    const input=await fs.readFile(file.path);
    const report=validateReport(input);
    let invalidKeys=0,confirmationToken=null;
    if(report.valid){
      const keys=new Set();
      // ASIN is the first canonical field, after logical source row number.
      for(const row of replayValidatedRows(input,report.sourceFileSha256))keys.add(row[1]);
      const ownership=await pool.request().input('seller',sql.VarChar(50),sellerId)
        .input('keys',sql.NVarChar(sql.MAX),JSON.stringify([...keys])).query(
          "SELECT COUNT_BIG(*) AS invalidKeys FROM (SELECT k.[asin] FROM OPENJSON(@keys) WITH ([asin] varchar(10) '$') k LEFT JOIN dbo.Asins a ON a.AsinCode=k.[asin] AND a.SellerId=@seller GROUP BY k.[asin] HAVING COUNT_BIG(a.AsinCode)<>1) x;");
      invalidKeys=Number(ownership.recordset[0].invalidKeys);
      if(invalidKeys===0&&importsEnabled())confirmationToken=issueConfirmation({user:req.user,sellerId,...context,sourceFileSha256:report.sourceFileSha256});
    }
    const valid=report.valid&&invalidKeys===0;
    return res.status(valid?200:422).json({success:valid,code:valid?'validated':invalidKeys?'catalog_ownership_conflict':'validation_failed',
      message:valid?'Report validated. No data was imported.':invalidKeys?'Some products lack an unambiguous catalog mapping for the selected seller. No data was imported.':'Report has validation issues. No data was imported.',
      data:{...report,valid,sellerId,...context,persisted:false,invalidCatalogKeys:invalidKeys,importsEnabled:importsEnabled(),confirmationToken}});
  } catch(e) {
    if(e instanceof AdsScopeError)return error(res,e.status,e.code,e.message);
    if(isAdsSchemaError(e))return sendAdsSchemaUnavailable(res);
    if (e instanceof AdsValidationError) return error(res,422,e.code,e.message,{row:e.row,column:e.column});
    return error(res,503,'validation_unavailable','Report validation is unavailable. No data was imported.');
  } finally {
    if (file?.path) await fs.unlink(file.path).catch(()=>{});
  }
}
async function confirm(req,res){
  const file=req.file;
  try{
    if(!importsEnabled())return error(res,409,'ads_import_disabled','Ads confirmation is paused by server configuration.');
    if(!file)return error(res,400,'file_required','Select the previously validated CSV.');
    const sellerId=explicitSeller(req.user,req.body?.sellerId);
    if(req.body?.reportType!=='daily')return error(res,400,'unsupported_report_type','Only daily v1 is supported.');
    const input=await fs.readFile(file.path);
    const hash=createHash('sha256').update(input).digest('hex');
    const expectedContext=verifyConfirmation({token:req.body?.confirmationToken,user:req.user,sellerId,sourceFileSha256:hash});
    const data=await ingestCanonicalReport({pool:await getPool(),sql,user:req.user,sellerId,reportType:'daily',input,expectedContext});
    // Cache invalidation is best effort. Do not report a committed write as failed
    // if the shared cache is unavailable. Canonical report reads are uncached.
    try{await require('../services/cacheService').invalidateNamespace('data:dashboard');}catch{}
    return res.json({success:true,code:'imported',message:'Advertising facts committed and reconciled.',data:{
      sellerId:data.sellerId,marketplace:data.marketplace,currency:data.currency,inserted:data.inserted,unchanged:data.unchanged,
      sourceFileSha256:data.sourceFileSha256,startDate:data.report.startDate,endDate:data.report.endDate,totals:data.report.totals,persisted:true}});
  }catch(e){
    if(e instanceof AdsScopeError)return error(res,e.status,e.code,e.message);
    if(isAdsSchemaError(e))return sendAdsSchemaUnavailable(res);
    if(e instanceof AdsValidationError)return error(res,422,e.code,e.message,{row:e.row,column:e.column});
    if(e instanceof AdsIngestionError)return error(res,409,e.code,e.message,{details:e.details});
    console.error('[ads canonical import]',e.message);
    return error(res,503,'import_outcome_unavailable','Could not confirm the import outcome. Revalidate and replay the identical file to reconcile safely.');
  }finally{if(file?.path)await fs.unlink(file.path).catch(()=>{});}
}
function importGate(_req,res,next){
  if(!importsEnabled())return error(res,409,'ads_import_disabled','Ads confirmation is paused by server configuration.');
  next();
}
module.exports={listSellers,validate,confirm,importGate,resolveContext};
