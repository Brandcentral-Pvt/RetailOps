'use strict';
const contract=require('../contracts/ads-product-daily-v1.json');
const {AdsScopeError}=require('./adsCanonicalScope');
const {METRICS,toFixedUnits:fixed,fromFixedUnits:decimal}=require('./adsCanonicalMetrics');
const SOURCE_FIELDS=contract.fields;
const LINEAGE=['ReportType','SourceFileSha256','SourceRowNumber','SourceSchemaVersion','ImportedBy','ImportedAt'];
const FULL_COLUMNS=[...new Set([...SOURCE_FIELDS.map(f=>f.canonicalColumn),...LINEAGE])].map(c=>'['+c+']');
const MAX_RAW_ROWS=250000,MAX_ENTITIES=25000,RAW_PAGE=1000,ENTITY_PAGE=250;
const BACKGROUND_RAW_ROWS=2000000,BACKGROUND_ENTITIES=250000;
const abort=signal=>{if(signal?.aborted)throw new AdsScopeError('export_interrupted','Export was interrupted or exceeded its time limit. Narrow the scope and retry.',408);};
function checkCount(value,max,label){
 const n=Number(value);
 if(!Number.isSafeInteger(n)||n<0)throw Error('Invalid '+label+' count');
 if(n>max)throw new AdsScopeError('export_too_large','Complete export exceeds '+max.toLocaleString('en-US')+' '+label+'. Narrow the dates, seller or currency. No rows were truncated.',422);
 return n;
}
const keys=['SellerId','Marketplace','Currency','Asin','Date'];
const eq=(a,b,columns=keys)=>columns.map(k=>a+'.['+k+']='+b+'.['+k+']').join(' AND ');
const fieldSelect=f=>{
 const c='p.['+f.canonicalColumn+']';
 return (f.type==='date'?'CONVERT(varchar(10),'+c+',23)':f.type==='decimal'||f.type==='integer'?'CONVERT(varchar(80),'+c+')':c)+' AS ['+f.canonicalColumn+']';
};
const rawProjection=[
 ...SOURCE_FIELDS.map(fieldSelect),
 'p.[SellerId]','p.[SellerName]','p.[Marketplace]','p.[Currency]','p.[ReportType]','p.[periodKey]',
 'p.[CatalogTitle]','p.[CatalogBrand]','p.[CatalogCategory]','CONVERT(varchar(30),p.[CatalogMatches]) AS [CatalogMatches]',
 'p.[SourceFileSha256]','CONVERT(varchar(30),p.[SourceRowNumber]) AS [SourceRowNumber]',
 'CONVERT(varchar(30),p.[SourceSchemaVersion]) AS [SourceSchemaVersion]','p.[ImportedBy]',
 "CONVERT(varchar(33),p.[ImportedAt],126)+'Z' AS [ImportedAt]"
].join(',');
async function countRaw(tx,max=MAX_RAW_ROWS){
 const r=await tx.request().query('SELECT CONVERT(varchar(30),COUNT_BIG(*)) AS n FROM #AdsScope;');
 return checkCount(r.recordset[0].n,max,'daily records (current plus prior)');
}
async function prepareRaw(tx){
 await tx.request().batch('CREATE UNIQUE CLUSTERED INDEX IX_AdsExportScope ON #AdsScope([SellerId],[Marketplace],[Currency],[Asin],[Date]); SELECT ROW_NUMBER() OVER(ORDER BY p.[Currency],p.[SellerId],p.[Marketplace],p.[Asin],p.[Date]) AS [exportRank],'+keys.map(k=>'p.['+k+']').join(',')+' INTO #AdsRawExport FROM #AdsScope p; CREATE UNIQUE CLUSTERED INDEX IX_AdsRawExportRank ON #AdsRawExport([exportRank]);');
}
async function* rawRows({tx,sql,signal}){
 let after=0;
 while(true){
  abort(signal);
  const r=await tx.request().input('after',sql.BigInt,after).input('size',sql.Int,RAW_PAGE).query('SELECT TOP (@size) e.[exportRank],'+rawProjection+' FROM #AdsRawExport e JOIN #AdsScope p ON '+eq('e','p')+' WHERE e.[exportRank]>@after ORDER BY e.[exportRank];');
  if(!r.recordset.length)break;
  for(const row of r.recordset){abort(signal);const next=Number(row.exportRank);if(next!==after+1)throw Error('Daily export cursor mismatch');after=next;yield row;}
 }
}
async function* entityRows({tx,sql,signal,combineRows,days,comparePeriods}){
 let after=0;
 while(true){
  abort(signal);
  const r=await tx.request().input('after',sql.BigInt,after).input('size',sql.Int,ENTITY_PAGE)
   .query(';WITH picked AS (SELECT TOP(@size) * FROM #AdsPage WHERE [rank]>@after ORDER BY [rank]) SELECT e.[rank],g.* FROM picked e JOIN #AdsGroups g ON '+eq('e','g',['SellerId','Marketplace','Currency','EntityKey'])+' ORDER BY e.[rank],g.[periodKey];');
  if(!r.recordset.length)break;
  const rows=combineRows(r.recordset),last=Number(r.recordset.at(-1).rank);
  if(last!==after+rows.length)throw Error('Entity export cursor mismatch');
  after=last;
  for(const row of rows){abort(signal);row.comparison=comparePeriods(row.current,row.previous,days);yield row;}
 }
}
function rawReconciler(report){
 const expected=new Map(),actual=new Map(),fields=Object.entries(METRICS);
 for(const [period,list] of [['current',report.current],['previous',report.previous]])for(const s of list)expected.set(JSON.stringify([period,s.currency]),s);
 let total=0;
 return {
  add(row){
   const key=JSON.stringify([row.periodKey,row.Currency]);
   if(!expected.has(key))throw Error('Unexpected exported fact currency or period');
   if(!actual.has(key))actual.set(key,{rows:0n,totals:Object.fromEntries(fields.map(([k])=>[k,null])),counts:Object.fromEntries(fields.map(([k])=>[k,0n]))});
   const g=actual.get(key);g.rows++;total++;
   for(const [k,col] of fields){const v=row[col];if(v!=null){g.totals[k]=(g.totals[k]??0n)+fixed(v);g.counts[k]++;}}
  },
  finish(expectedRows){
   if(total!==expectedRows||expected.size!==actual.size)throw Error('Export daily population mismatch');
   for(const [key,s] of expected){
    const g=actual.get(key);if(!g||g.rows.toString()!==s.rowCount)throw Error('Export daily row count mismatch');
    for(const [k] of fields)if(decimal(g.totals[k])!==s.totals[k]||g.counts[k].toString()!==s.coverage[k].populated)throw Error('Export daily metric reconciliation failed: '+k);
   }
   return total;
  }
 };
}
module.exports={SOURCE_FIELDS,FULL_COLUMNS,LINEAGE,MAX_RAW_ROWS,MAX_ENTITIES,BACKGROUND_RAW_ROWS,BACKGROUND_ENTITIES,RAW_PAGE,ENTITY_PAGE,abort,checkCount,countRaw,prepareRaw,rawRows,entityRows,rawReconciler};
