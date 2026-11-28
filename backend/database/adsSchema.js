'use strict';
const contract=require('../contracts/ads-product-daily-v1.json');
const migration=require('../migrations/098_ads_product_daily_facts');
const metadata={SellerId:'varchar(50)',Marketplace:'nvarchar(50)',Currency:'char(3)',ReportType:'varchar(20)',SourceFileSha256:'char(64)',SourceRowNumber:'int',SourceSchemaVersion:'smallint',ImportedBy:'varchar(50)',ImportedAt:'datetime2(3)'};
const expected=[...contract.fields.map(f=>({name:f.canonicalColumn,type:f.sqlType,nullable:!f.requiredValue})),...Object.entries(metadata).map(([name,type])=>({name,type,nullable:false}))];
function typeMatches(column,type){
 const m=/^(\w+)(?:\((\d+)(?:,(\d+))?\))?$/.exec(type);
 if(!m||column.typeName!==m[1])return false;
 if(m[1]==='decimal')return Number(column.precision)===Number(m[2])&&Number(column.scale)===Number(m[3]);
 if(m[1]==='datetime2')return Number(column.scale)===Number(m[2]);
 if(['varchar','nvarchar','char'].includes(m[1]))return Number(column.maxLength)===Number(m[2])*(m[1]==='nvarchar'?2:1);
 return true;
}
async function inspectAdsSchema(pool){
 pool=pool||await require('./db').getPool();
 const r=await pool.request().query("SELECT c.name AS columnName,ty.name AS typeName,c.max_length AS maxLength,c.precision,c.scale,c.is_nullable AS nullable FROM sys.columns c JOIN sys.types ty ON ty.user_type_id=c.user_type_id WHERE c.object_id=OBJECT_ID(N'dbo.AdsProductDailyFacts',N'U'); SELECT compatibility_level AS level FROM sys.databases WHERE database_id=DB_ID(); SELECT c.name AS columnName FROM sys.indexes i JOIN sys.index_columns ic ON i.object_id=ic.object_id AND i.index_id=ic.index_id JOIN sys.columns c ON c.object_id=ic.object_id AND c.column_id=ic.column_id WHERE i.object_id=OBJECT_ID(N'dbo.AdsProductDailyFacts',N'U') AND i.is_primary_key=1 AND i.is_disabled=0 AND ic.key_ordinal>0 ORDER BY ic.key_ordinal; SELECT CASE WHEN OBJECT_ID(N'dbo.Sellers',N'U') IS NOT NULL THEN 1 ELSE 0 END AS sellers;");
 const columns=new Map(r.recordsets[0].map(c=>[String(c.columnName).toLowerCase(),c]));
 const missing=[],incompatible=[];
 for(const f of expected){
   const c=columns.get(f.name.toLowerCase());
   if(!c)missing.push(f.name);
   else if(!typeMatches(c,f.type)||Boolean(c.nullable)!==f.nullable)incompatible.push(f.name);
 }
 const key=r.recordsets[2].map(x=>String(x.columnName).toLowerCase()).join(',');
 if(key!=='sellerid,marketplace,reporttype,asin,date')incompatible.push('primary_key');
 const compatibility=Number(r.recordsets[1]?.[0]?.level||0),sellersPresent=Boolean(r.recordsets[3]?.[0]?.sellers);
 return {ready:missing.length===0&&incompatible.length===0&&compatibility>=130&&sellersPresent,tableExists:columns.size>0,sellersPresent,compatibility,missing,incompatible};
}
async function ensureAdsSchema({pool,apply=false}={}){
 pool=pool||await require('./db').getPool();
 let state=await inspectAdsSchema(pool);
 // Never silently modify an existing incompatible fact table; 098 is additive.
 if(!state.tableExists&&state.sellersPresent&&state.compatibility>=130&&apply){
   await migration.up(pool);
   state=await inspectAdsSchema(pool);
 }
 return state;
}
function isAdsSchemaError(error){
 for(let e=error;e;e=e.cause){
   if([207,208,195].includes(Number(e.number??e.originalError?.info?.number)))return true;
   if(/Invalid object name|Invalid column name|'OPENJSON' is not a recognized/i.test(String(e.message||'')))return true;
 }
 return false;
}
function sendAdsSchemaUnavailable(res){return res.status(503).json({success:false,code:'ADS_SCHEMA_NOT_READY',message:'Advertising database schema is not ready. Ask an administrator to check migration 098 and /api/health/ads.'});}
module.exports={inspectAdsSchema,ensureAdsSchema,isAdsSchemaError,sendAdsSchemaUnavailable,typeMatches};
