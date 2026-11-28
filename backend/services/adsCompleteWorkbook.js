'use strict';
const {createWriteStream}=require('node:fs');
const {finished}=require('node:stream/promises');
const fs=require('node:fs/promises');
const {createStreamingWorkbook}=require('./streamingWorkbook');
const {numericCell}=require('./adsCanonicalExport');
const {METRICS,RATIOS}=require('./adsCanonicalMetrics');
const {comparePeriods}=require('./adsAnalyticsV3');
const {SOURCE_FIELDS,abort,rawReconciler}=require('./adsExportSnapshot');
const MONEY=new Set(['spend','sales','organicSales','totalSales','sameSkuSales','newToBrandSales','orderedRevenue','shippedRevenue','shippedCogs','cpc','cpm','costPerOrder','aov','revenuePerOrder']);
const PCT=new Set(['acos','tacos','ctr','cvr','orderRate','adSharePct']);
const MULTIPLE=new Set(['roas']);
const METRIC_KEYS=Object.keys(METRICS),RATIO_KEYS=Object.keys(RATIOS),ALL=[...METRIC_KEYS,...RATIO_KEYS];
const LABELS={spend:'Ad spend',sales:'Ad sales',organicSales:'Organic sales',totalSales:'Total sales',orders:'Ad orders',totalOrders:'Total orders',organicOrders:'Organic orders',units:'Total units',acos:'ACoS',tacos:'TACoS',roas:'ROAS',ctr:'CTR',cvr:'CVR',cpc:'CPC',cpm:'CPM',aov:'Ad AOV (per conversion)',costPerOrder:'Cost per ad order',adSharePct:'Ad sales share',newToBrandSales:'New-to-brand sales',sameSkuSales:'Same-SKU sales'};
const label=k=>LABELS[k]||k.replace(/([a-z0-9])([A-Z])/g,'$1 $2').replace(/^./,c=>c.toUpperCase());
const FORMAT={money:'#,##0.00;[Red](#,##0.00);0.00',integer:'#,##0;[Red](#,##0);0',ratio:'0.00%;[Red]-0.00%;0.00%',pp:'0.00" pp";[Red]-0.00" pp";0.00" pp"',multiple:'0.00"x";[Red]-0.00"x";0.00"x"'};
const kind=k=>MONEY.has(k)?'money':PCT.has(k)?'ratio':MULTIPLE.has(k)?'multiple':'integer';
function cell(value,type='raw'){
 const c=numericCell(value==null?null:String(value),type==='ratio');
 if(c.value===null||c.numFmt==='@'||type==='raw')return c;
 return {...c,numFmt:FORMAT[type]||c.numFmt};
}
function metricValue(s,k){return METRICS[k]?s?.totals?.[k]:s?.ratios?.[k]?.value;}
const evidence=(s,k)=>METRICS[k]?s?.coverage?.[k]:s?.ratios?.[k];
const deltaKind=k=>PCT.has(k)?'pp':kind(k);
const comparison=(c,k)=>METRICS[k]?c?.metrics?.[k]:c?.ratios?.[k];
function compareCells(current,previous,comparisonData,k){
 const c=comparison(comparisonData,k),complete=c?.status==='comparable';
 return [cell(metricValue(current,k),kind(k)),cell(metricValue(previous,k),kind(k)),
  cell(complete?c?.delta:c?.observedDelta,deltaKind(k)),
  ...(METRICS[k]?[cell(complete?c?.percentChange:c?.observedPercentChange,'ratio')]:[]),
  c?.status||'unknown'];
}
const compareHeaders=ALL.flatMap(k=>[label(k)+' current',label(k)+' prior',label(k)+' change (observed if partial)',...(METRICS[k]?[label(k)+' change %']:[]),label(k)+' comparison status']);
const COVERAGE_HEADERS=['Period','Seller ID','Seller','Marketplace','Currency','Entity','Stored rows','Stored days','Unmapped rows',
 ...METRIC_KEYS.flatMap(k=>[label(k)+' populated',label(k)+' coverage']),
 ...RATIO_KEYS.flatMap(k=>[label(k)+' paired rows',label(k)+' coverage',label(k)+' observed ratio',label(k)+' matched ratio'])];
const RAW_META=[['SellerId','Seller ID'],['SellerName','Seller'],['Marketplace','Marketplace'],['Currency','Currency'],['ReportType','Report type'],['periodKey','Period'],['CatalogTitle','Catalog title'],['CatalogBrand','Catalog brand'],['CatalogCategory','Catalog category'],['CatalogMatches','Catalog matches'],['SourceFileSha256','Source file SHA-256'],['SourceRowNumber','Source record'],['SourceSchemaVersion','Schema version'],['ImportedBy','Imported by'],['ImportedAt','Imported UTC']];
const RAW_NUMERIC=new Set(['CatalogMatches','SourceRowNumber','SourceSchemaVersion']);
const rawValues=r=>[...SOURCE_FIELDS.map(f=>['decimal','integer'].includes(f.type)?cell(r[f.canonicalColumn],f.type==='integer'?'integer':'raw'):r[f.canonicalColumn]??null),
 ...RAW_META.map(([k])=>RAW_NUMERIC.has(k)?cell(r[k],'integer'):r[k]??null)];
const yieldTurn=()=>new Promise(resolve=>setImmediate(resolve));
function styleHeader(row){row.font={bold:true,color:{argb:'FFFFFFFF'},size:10};row.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF243B53'}};row.alignment={vertical:'middle',wrapText:true};row.height=34;}
function width(h){return /title/i.test(h)?42:/SHA-256/.test(h)?68:/status|coverage|remarks/i.test(h)?25:/Seller ID|ASIN|Entity|Date|Bucket/i.test(h)?20:Math.min(32,Math.max(14,h.length+1));}
function add(sheet,items){
 const r=sheet.addRow(items.map(x=>x&&typeof x==='object'&&Object.hasOwn(x,'value')?x.value:x??null));
 items.forEach((x,i)=>{if(x&&typeof x==='object'&&x.numFmt)r.getCell(i+1).numFmt=x.numFmt;});
 r.commit();
}
function sheetWriter(book,expectedSheets,{name,headers,count,freeze=2}){
 if(count>1048575||!Number.isSafeInteger(count)||count<0)throw Error('Workbook sheet row limit exceeded: '+name);
 if(headers.length>16384)throw Error('Workbook sheet column limit exceeded');
 const sheet=book.addWorksheet(name,{views:[{state:'frozen',ySplit:1,xSplit:Math.min(freeze,headers.length)}]});
 sheet.columns=headers.map(h=>({width:width(h)}));
 if(count)sheet.autoFilter={from:{row:1,column:1},to:{row:count+1,column:headers.length}};
 const h=sheet.addRow(headers);styleHeader(h);h.commit();
 let written=0;
 return {add(items){if(items.length!==headers.length)throw Error('Workbook column mismatch: '+name);if(written>=count)throw Error('Unexpected extra rows: '+name);add(sheet,items);written++;},finish(){if(written!==count)throw Error('Workbook row mismatch: '+name);sheet.commit();expectedSheets.set(name,written+1);}};
}
const identity=r=>[r.sellerId,r.sellerName,r.marketplace,r.currency,r.entityKey,r.title,r.brand,r.category];
function coverageRow(r,period){
 const s=r[period];
 return [period,...identity(r).slice(0,5),cell(s?.rowCount,'integer'),cell(s?.coveredDays,'integer'),cell(s?.unmappedRows,'integer'),
 ...METRIC_KEYS.flatMap(k=>[cell(s?.coverage?.[k]?.populated,'integer'),s?.coverage?.[k]?.status||'unknown']),
 ...RATIO_KEYS.flatMap(k=>[cell(s?.ratios?.[k]?.pairedRows,'integer'),s?.ratios?.[k]?.status||'unknown',cell(s?.ratios?.[k]?.observedValue,kind(k)),cell(s?.ratios?.[k]?.matchedValue,kind(k))])];
}
const HISTORY_HEADERS=['Period','Bucket','Currency','Stored days','Stored rows',...ALL.flatMap(k=>[label(k),label(k)+' coverage'])];
const historyRow=r=>[r.periodKey,r.bucket,r.currency,cell(r.coveredDays,'integer'),cell(r.rowCount,'integer'),...ALL.flatMap(k=>[cell(metricValue(r,k),kind(k)),evidence(r,k)?.status||'unknown'])];
const ALIGNED_KEYS=['spend','sales','totalSales','organicSales','orders','conversions','clicks','impressions','acos','tacos','roas','ctr','cvr','cpc'];
const alignedHeaders=['Currency','Bucket','Current start','Current end','Prior start','Prior end','Expected days','Current stored days','Prior stored days',...ALIGNED_KEYS.flatMap(k=>[label(k)+' current',label(k)+' prior',label(k)+' change',...(METRICS[k]?[label(k)+' change %']:[]),label(k)+' comparison status'])];
function dictionary(){
 const raw=SOURCE_FIELDS.map(f=>['Daily Source',f.header,f.canonicalColumn,f.type,'Normalized source value; numeric scale unchanged. Blank = unknown.']);
 const lineage=RAW_META.map(([k,h])=>['Daily Source',h,k,'metadata','Persisted fact ownership, catalog context or original import lineage. Catalog metadata is current, not historic.']);
 const metrics=METRIC_KEYS.map(k=>['Analytics',label(k),METRICS[k],kind(k),'Sum of explicit populated stored source values; never infer missing.']);
 const ratios=RATIO_KEYS.map(k=>['Analytics',label(k),RATIOS[k].join(' / '),kind(k),'Ratio of sums with compatible populated rows; not an average of source ratios.']);
 return [...raw,...lineage,...metrics,...ratios];
}
async function writeCompleteWorkbook({filePath,report,rawCount,rawRows,entityRows,aligned,filters,signal}){
 abort(signal);
 const expectedSheets=new Map(),stream=createWriteStream(filePath,{flags:'wx'});
 let streamError;
 const failure=new Promise((_,reject)=>stream.once('error',e=>{streamError=e;reject(e);}));
 failure.catch(()=>{});
 const cancel=()=>stream.destroy(new Error('Export interrupted'));
 signal?.addEventListener('abort',cancel,{once:true});
 const check=()=>{abort(signal);if(streamError)throw streamError;};
 const book=createStreamingWorkbook({stream,useStyles:true,useSharedStrings:false});
 const table=(name,headers,count,freeze)=>sheetWriter(book,expectedSheets,{name,headers,count,freeze});
 try{
  const scope=[
   ['Report','Ads Intelligence | Complete stored report'],['Source','canonical_v1 / normalized persisted facts'],['Current start',report.period.startDate],['Current end',report.period.endDate],['Previous start',report.period.prevStart],['Previous end',report.period.prevEnd],
   ['Grouping',report.groupBy],['Granularity',report.granularity],['Complete entities',cell(report.total,'integer')],['Complete daily records (both windows)',cell(rawCount,'integer')],
   ['Filter scope',JSON.stringify(filters)],['Currency','Currencies and marketplaces remain separately identified. No FX conversion.'],
   ['Source fields','All 63 v1 source columns in their original order, followed by persisted ownership and lineage. This is normalized stored data, not the original CSV bytes.'],
   ['Nulls','Blank numeric cells mean unknown. Explicit zero remains numeric zero. Missing periods remain blank.'],
   ['Precision','Excel numeric cells support 15 significant digits. Larger values are exact text; percentage-point text remains in points. Daily Source preserves original numeric scale, including source fractional rates.'],
   ['Comparison','Current/prior periods are equal-length. Changes on incomplete data are labelled observed only by comparison status.'],
   ['Ratios','Recomputed from compatible populated numerator/denominator rows. Source ratios are preserved only in Daily Source.'],
   ['Completeness','All matching stored records; no table-page or column-preset truncation. Complete stored coverage does not prove all source reports were supplied.'],
   ['Ordering','Daily Source sorted by currency, owner, marketplace, ASIN and date. Source record retains original CSV position.'],
   ['Export verification','Raw row counts, all 24 additive totals and populated counts are reconciled with the canonical summary; XLSX structure and row counts verified before download.']
  ];
  let w=table('Report Scope',['Property','Value'],scope.length,1);for(const row of scope)w.add(row);w.finish();
  const groups=[...new Set([...report.current,...report.previous].map(r=>r.currency))].sort();
  w=table('Summary',['Currency','Metric','Current','Previous','Change (observed if partial)','Change %','Comparison status','Current coverage','Prior coverage','Current populated / paired rows','Prior populated / paired rows','Current stored days','Prior stored days'],groups.length*ALL.length,2);
  for(const currency of groups){
   const c=report.current.find(x=>x.currency===currency),p=report.previous.find(x=>x.currency===currency),cmp=report.comparisons?.find(x=>x.currency===currency)||comparePeriods(c,p,report.period.days);
   for(const k of ALL){const v=compareCells(c,p,cmp,k),e=evidence(c,k),b=evidence(p,k);
    w.add([currency,label(k),v[0],v[1],v[2],METRICS[k]?v[3]:null,v.at(-1),e?.status||'unknown',b?.status||'unknown',cell(e?.populated??e?.pairedRows,'integer'),cell(b?.populated??b?.pairedRows,'integer'),cell(c?.coveredDays,'integer'),cell(p?.coveredDays,'integer')]);}
  }
  w.finish();
  const entities=table('Entity Comparisons',['Seller ID','Seller','Marketplace','Currency','Entity','Title','Brand','Category',...compareHeaders],report.total,5);
  const coverage=table('Entity Coverage',COVERAGE_HEADERS,report.total*2,6);
  let entityCount=0;
  for await(const r of entityRows()){
   check();const cmp=r.comparison||comparePeriods(r.current,r.previous,report.period.days);
   entities.add([...identity(r),...ALL.flatMap(k=>compareCells(r.current,r.previous,cmp,k))]);
   for(const period of ['current','previous'])coverage.add(coverageRow(r,period));
   if(++entityCount%100===0)await yieldTurn();
  }
  entities.finish();coverage.finish();
  w=table('History',HISTORY_HEADERS,report.series.length,3);for(const r of report.series){check();w.add(historyRow(r));}w.finish();
  w=table('Aligned Trends',alignedHeaders,aligned.length,2);
  for(const r of aligned){check();w.add([r.currency,r.bucket,r.currentStart,r.currentEnd,r.previousStart,r.previousEnd,cell(r.days,'integer'),cell(r.current?.coveredDays,'integer'),cell(r.previous?.coveredDays,'integer'),...ALIGNED_KEYS.flatMap(k=>compareCells(r.current,r.previous,r.comparison,k))]);}w.finish();
  w=table('Daily Source',[...SOURCE_FIELDS.map(f=>f.header),...RAW_META.map(([,h])=>h)],rawCount,3);
  const reconcile=rawReconciler(report);let count=0;
  for await(const r of rawRows()){
   check();reconcile.add(r);w.add(rawValues(r));if(++count%256===0)await yieldTurn();
  }
  w.finish();reconcile.finish(rawCount);
  const dict=dictionary();w=table('Data Dictionary',['Sheet','Field','Canonical column / formula','Type','Definition'],dict.length,2);
  for(const row of dict)w.add(row);w.finish();
  check();await Promise.race([book.commit(),failure]);await finished(stream,{cleanup:true});check();
  return {expectedSheets,rawCount,entityCount};
 }catch(e){if(!stream.destroyed)stream.destroy();await fs.unlink(filePath).catch(()=>{});throw e;}
 finally{signal?.removeEventListener('abort',cancel);}
}
module.exports={writeCompleteWorkbook,rawValues,RAW_META,compareCells,FORMAT};
