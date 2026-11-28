'use strict';
const {createHash}=require('node:crypto');
const {strictScope,explicitSeller,resolveContext}=require('./adsCanonicalScope');
const CHUNK=5000;
// Resolve globally, BEFORE authorization. A shared ASIN never becomes unique
// merely because the importer has access to only one of its owners.
async function resolveOwners({db,sql,user,keys,onIssue=()=>{},onChunk=()=>{}}){
 const scope=strictScope(user),allowed=new Set(scope.sellerIds),mapping=[],owners=new Map();
 let invalid=0;
 const issue=(r,code,message)=>{invalid++;onIssue({...r,column:'asin',code,message});};
 for(let offset=0;offset<keys.length;offset+=CHUNK){
  const part=keys.slice(offset,offset+CHUNK);
  const result=await db.request().input('keys',sql.NVarChar(sql.MAX),JSON.stringify(part.map(r=>r.asin))).query(
    "SELECT k.[asin],a.SellerId,s.Id AS SellerExists,s.Marketplace AS CatalogMarketplace FROM OPENJSON(@keys) WITH ([asin] varchar(10) '$') k LEFT JOIN dbo.Asins a ON UPPER(LTRIM(RTRIM(a.AsinCode)))=k.[asin] LEFT JOIN dbo.Sellers s ON s.Id=a.SellerId ORDER BY k.[asin];");
  const byAsin=new Map();
  for(const r of result.recordset){if(!byAsin.has(r.asin))byAsin.set(r.asin,[]);byAsin.get(r.asin).push(r);}
  for(const key of part){
   const rows=byAsin.get(key.asin)||[],r=rows[0];
   if(rows.length>1){issue(key,'catalog_mapping_ambiguous','ASIN has multiple catalog mappings. Resolve ownership before importing.');continue;}
   if(!r?.SellerId||!r.SellerExists){issue(key,'catalog_mapping_missing','ASIN has no verified seller assignment in RetailOps.');continue;}
   if(!scope.unrestricted&&!allowed.has(r.SellerId)){issue(key,'catalog_mapping_forbidden','You do not have import access to this ASIN.');continue;}
   // Validate each distinct owner once, not once per product.
   const prev=owners.get(r.SellerId);
   if(!prev){try{explicitSeller(user,r.SellerId);}catch{issue(key,'catalog_mapping_forbidden','ASIN seller assignment is invalid or inaccessible.');continue;}}
   const context=resolveContext({Id:r.SellerId,Marketplace:r.CatalogMarketplace});
   if(!context){issue(key,'seller_context_unverified','The mapped seller marketplace or currency is not verified.');continue;}
   if(prev&&(prev.marketplace!==context.marketplace||prev.currency!==context.currency)){issue(key,'seller_context_changed','Seller context is inconsistent.');continue;}
   mapping.push({asin:key.asin,sellerId:r.SellerId,...context});
   if(prev)prev.asinCount++;else owners.set(r.SellerId,{sellerId:r.SellerId,...context,asinCount:1});
  }
  await onChunk();
 }
 const sellerBreakdown=[...owners.values()].sort((a,b)=>a.sellerId.localeCompare(b.sellerId));
 const currencies=[...new Set(sellerBreakdown.map(x=>x.currency))];
 if(currencies.length>1){invalid++;onIssue({row:null,column:'currency',code:'mixed_currency_report',message:'This CSV has no currency column. Split reports by currency before importing.'});}
 await onChunk();
 mapping.sort((a,b)=>a.asin.localeCompare(b.asin));
 const hash=invalid||!mapping.length?null:createHash('sha256').update(JSON.stringify(mapping)).digest('hex');
 return {mapping,owners:sellerBreakdown,currency:currencies.length===1?currencies[0]:null,marketplace:new Set(sellerBreakdown.map(x=>x.marketplace)).size===1?sellerBreakdown[0].marketplace:null,hash,invalid};
}
async function stageOwners(tx,sql,mapping){
 await tx.request().batch('CREATE TABLE #AdsOwners(Asin varchar(10) COLLATE DATABASE_DEFAULT NOT NULL PRIMARY KEY,SellerId varchar(50) COLLATE DATABASE_DEFAULT NOT NULL,Marketplace nvarchar(50) COLLATE DATABASE_DEFAULT NOT NULL,Currency char(3) COLLATE DATABASE_DEFAULT NOT NULL);');
 for(let i=0;i<mapping.length;i+=CHUNK){
  await tx.request().input('owners',sql.NVarChar(sql.MAX),JSON.stringify(mapping.slice(i,i+CHUNK)))
   .query("INSERT #AdsOwners(Asin,SellerId,Marketplace,Currency) SELECT asin,sellerId,marketplace,currency FROM OPENJSON(@owners) WITH (asin varchar(10),sellerId varchar(50),marketplace nvarchar(50),currency char(3));");
 }
}
module.exports={resolveOwners,stageOwners};
