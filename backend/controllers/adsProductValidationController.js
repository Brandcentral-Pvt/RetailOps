'use strict';
const fs = require('node:fs/promises');
const { getPool,sql } = require('../database/db');
const { resolveSellerScope } = require('../utils/sellerScope');
const { validateReport,AdsValidationError } = require('../services/adsProductContract');

const error=(res,status,code,message,extra={})=>res.status(status).json({success:false,code,message,...extra});
const norm=v=>String(v||'').trim().toLowerCase();
function resolveContext(seller) {
  // Known India marketplace identifier supplies its configured currency. Ambiguous
  // labels require an explicit server configuration, never a client currency.
  const raw=norm(seller.Marketplace);
  if (['amazon.in','amazon india','amazon_in','amazon-in'].includes(raw)) return {marketplace:'amazon.in',currency:'INR'};
  let map={};
  try { map=JSON.parse(process.env.ADS_SELLER_CONTEXT_JSON||'{}'); } catch { return null; }
  const item=map && Object.hasOwn(map,seller.Id)?map[seller.Id]:null;
  if (!item || norm(item.catalogMarketplace)!==raw || typeof item.marketplace!=='string' ||
      !/^amazon\.[a-z.]{2,12}$/.test(item.marketplace) || !/^[A-Z]{3}$/.test(item.currency)) return null;
  return {marketplace:item.marketplace,currency:item.currency};
}
async function listSellers(req,res) {
  try {
    const scope=resolveSellerScope(req.user);
    if (scope.empty || scope.denied) return res.json({success:true,data:[]});
    const pool=await getPool();
    const request=pool.request();
    if (!scope.unrestricted) request.input('ids',sql.NVarChar(sql.MAX),JSON.stringify(scope.sellerIds));
    const result=await request.query('SELECT Id,Name,Marketplace FROM dbo.Sellers'+
      (scope.unrestricted?'':' WHERE Id IN (SELECT [value] FROM OPENJSON(@ids))')+' ORDER BY Name,Id');
    return res.json({success:true,data:result.recordset.map(s=>({id:s.Id,name:s.Name,marketplace:s.Marketplace,context:resolveContext(s)}))});
  } catch { return error(res,503,'seller_options_unavailable','Seller options are unavailable. Retry later.'); }
}
async function validate(req,res) {
  const file=req.file;
  try {
    if (!file) return error(res,400,'file_required','A CSV report is required.');
    const sellerId=typeof req.body?.sellerId==='string'?req.body.sellerId.trim():'';
    if (!sellerId || sellerId.length>50 || /[, *]/.test(sellerId) || norm(sellerId)==='all')
      return error(res,400,'seller_required','Select one explicit internal seller ID.');
    if (req.body?.reportType!=='daily') return error(res,400,'unsupported_report_type','Only product_daily v1 reports are supported.');
    const scope=resolveSellerScope(req.user,sellerId);
    if (scope.denied || scope.empty || !scope.sellerIds.includes(sellerId))
      return error(res,403,'forbidden_seller','You do not have access to this seller.');
    const pool=await getPool();
    const result=await pool.request().input('seller',sql.VarChar,sellerId).query('SELECT Id,Marketplace FROM dbo.Sellers WHERE Id=@seller');
    const seller=result.recordset[0];
    if (!seller) return error(res,404,'seller_not_found','Seller not found.');
    const context=resolveContext(seller);
    if (!context) return error(res,409,'seller_context_unverified','The seller marketplace/currency must be verified by an administrator.');
    const report=validateReport(await fs.readFile(file.path));
    return res.status(report.valid?200:422).json({success:report.valid,code:report.valid?'validated':'validation_failed',
      message:report.valid?'Report validated. No data was imported.':'Report has validation issues. No data was imported.',
      data:{...report,sellerId,...context,persisted:false}});
  } catch(e) {
    if (e instanceof AdsValidationError) return error(res,422,e.code,e.message,{row:e.row,column:e.column});
    return error(res,503,'validation_unavailable','Report validation is unavailable. No data was imported.');
  } finally {
    if (file?.path) await fs.unlink(file.path).catch(()=>{});
  }
}
module.exports={listSellers,validate,resolveContext};
