// A complete export is built from the same scoped facts and exact aggregation
// contract as GMS Tracker. No matrix page limit is used here.
const {buildAnalytics,priorWindow,buildGroups,summarizeMetrics,pct}=require('./gmsAnalyticsService');
const DAY=86400000;
const shift=(d,n)=>new Date(Date.parse(d+'T00:00:00Z')+n*DAY).toISOString().slice(0,10);
const countDays=(a,b)=>Math.round((Date.parse(b+'T00:00:00Z')-Date.parse(a+'T00:00:00Z'))/DAY)+1;
const inWindow=(r,w)=>(!w.from||r.date>=w.from)&&(!w.to||r.date<=w.to);
const METRICS=[
  {key:'orderedRevenue',label:'Ordered Revenue',kind:'money'},
  {key:'orderedUnits',label:'Ordered Units',kind:'units'},
  {key:'shippedRevenue',label:'Shipped Revenue',kind:'money'},
  {key:'shippedCOGS',label:'Shipped COGS',kind:'money'},
  {key:'shippedUnits',label:'Shipped Units',kind:'units'},
  {key:'customerReturns',label:'Customer Returns',kind:'units'},
  {key:'profit',label:'Gross Profit',kind:'money'},
  {key:'marginPct',label:'Gross Margin',kind:'ratio'},
  {key:'returnRatio',label:'Return Ratio',kind:'ratio'}
];
const col=(label,width=18,kind='text')=>({label,width,kind});
const rawColumns=[
  col('ASIN',16),col('Product Title',48),col('Brand',26),
  col('Ordered Revenue',20,'money'),col('Ordered Units',17,'units'),
  col('Shipped Revenue',20,'money'),col('Shipped COGS',20,'money'),
  col('Shipped Units',17,'units'),col('Customer Returns',19,'units'),
  col('Date',14),col('storeCode',13),
  col('Seller (DB)',28),col('Seller ID',28),col('Mapping Status',19),
  col('Catalog Product Title',48),col('Title Source',24),
];
function excelAmount(value){
  if(value==null)return null;
  const s=String(value),n=Number(s);
  // Excel supports 15 significant digits. Keep higher precision as exact text
  // instead of destroying digits. Ordinary amounts remain numeric.
  const digits=s.replace(/^[+-]/,'').replace('.','').replace(/^0+/,'').replace(/0+$/,'');
  return Number.isFinite(n)&&digits.length<=15?n:s;
}
function rawRow(r){
  return [r.asin,r.reportProductTitle??null,r.brand??null,excelAmount(r.orderedRevenue),excelAmount(r.orderedUnits),
    excelAmount(r.shippedRevenue),excelAmount(r.shippedCOGS),excelAmount(r.shippedUnits),excelAmount(r.customerReturns),
    r.date,r.storeCode??null,r.dbBrand||'-',r.sellerId??null,r.sellerId==null?'Unmatched':'Matched',
    r.catalogProductTitle??null,r.reportProductTitle!=null?'Uploaded report':r.catalogProductTitle!=null?'Catalog only':'Unavailable'];
}
function rawSheet(name,rows){
  return {name,columns:rawColumns,rowCount:rows.length,rows:function*(){for(const r of rows)yield rawRow(r);}};
}
function covered(rows,w){
  return {observed:new Set(rows.map(r=>r.date)).size,expected:w?.from&&w?.to?countDays(w.from,w.to):null};
}
function metricValues(a,b,comparable){
  const result=[];
  for(const m of METRICS){
    const current=a[m.key],previous=b[m.key],ratio=m.kind==='ratio';
    const delta=comparable&&current!=null&&previous!=null?current-previous:null;
    const change=ratio?delta:comparable?pct(current,previous):null;
    result.push(current==null?null:ratio?current/100:current,previous==null?null:ratio?previous/100:previous,change==null?null:ratio?change:change/100);
  }
  return result;
}
function comparisonRow(current,previous,w,p,reason=null){
  const a=summarizeMetrics(current),b=summarizeMetrics(previous),c=covered(current,w),d=covered(previous,p);
  const comparable=!reason&&p&&c.expected!=null&&d.expected!=null&&c.observed===c.expected&&d.observed===d.expected;
  const status=reason||(!p?'No prior period':!current.length?'No selected-period records':!previous.length?'No prior records':!comparable?'Incomplete date coverage':'Comparable; blank changes indicate missing metrics or zero baseline');
  return [c.observed,c.expected,d.observed,d.expected,status,...metricValues(a,b,comparable)];
}
const compareColumns=[
  col('Observed Days',16,'units'),col('Expected Days',16,'units'),
  col('Prior Observed Days',20,'units'),col('Prior Expected Days',20,'units'),col('Comparison Status',48),
  ...METRICS.flatMap(m=>[
    col(m.label+' | Current',23,m.kind),col(m.label+' | Prior',23,m.kind),
    col(m.label+(m.kind==='ratio'?' | Change (pp)':' | Change (%)'),25,m.kind==='ratio'?'pp':'ratio')
  ])
];
function entityKey(r,level){
  return level==='asin'?r.asin:r.sellerId!=null?'seller:'+String(r.sellerId):'unmatched:'+String(r.brand||'-');
}
function entitySheet(name,level,current,previous,window,prior){
  // Group the union, so products with prior activity but no current records
  // are visible. Missing data is never silently turned into a zero sale.
  const groups=new Map();
  for(const [kind,rows] of [['current',current],['prior',previous]])for(const r of rows){
    const k=entityKey(r,level);
    if(!groups.has(k))groups.set(k,{current:[],prior:[],meta:r});
    groups.get(k)[kind].push(r);
  }
  const prefix=level==='asin'?[col('ASIN',16),col('Product Title',48),col('Seller (DB)',28),col('Brand (Sheet)',26)]
    :[col('Seller ID',28),col('Seller (DB)',28),col('Brands (Sheet)',40),col('Mapping Status',20)];
  return {name,columns:[...prefix,...compareColumns],rowCount:groups.size,rows:function*(){
    for(const [,g] of groups){
      const m=g.meta,brands=[...new Set([...g.current,...g.prior].map(r=>r.brand||'-'))].sort().join(', ');
      const identity=level==='asin'?[m.asin,m.productTitle||'-',m.dbBrand||'-',brands]:
        [m.sellerId??null,m.dbBrand||'-',brands,m.sellerId==null?'Unmatched':'Matched'];
      yield [...identity,...comparisonRow(g.current,g.prior,window,prior)];
    }
  }};
}
function monthBounds(key){
  const from=key+'-01',next=new Date(from+'T00:00:00Z');next.setUTCMonth(next.getUTCMonth()+1);
  return {from,to:shift(next.toISOString().slice(0,10),-1)};
}
function periodSheet(name,period,history,current,window){
  const byDate=new Map();
  for(const r of history){
    if(!byDate.has(r.date))byDate.set(r.date,[]);
    byDate.get(r.date).push(r);
  }
  const observed=[...new Set(current.map(r=>r.date))].sort(),groups=buildGroups(observed);
  const rows=[];
  const range=(w)=>{
    if(!w)return [];
    const records=[];
    for(let day=w.from;day<=w.to;day=shift(day,1))for(const r of byDate.get(day)||[])records.push(r);
    return records;
  };
  const clipped=(w)=>({from:window.from&&window.from>w.from?window.from:w.from,to:window.to&&window.to<w.to?window.to:w.to});
  if(period==='day'){
    for(const day of observed)rows.push({label:day,w:{from:day,to:day},p:{from:shift(day,-1),to:shift(day,-1)}});
  }else if(period==='week'){
    for(const month of Object.values(groups))for(const week of Object.values(month.weeks)){
      const w={from:week.from,to:week.to};
      rows.push({label:week.key,w,p:{from:shift(w.from,-7),to:shift(w.to,-7)}});
    }
  }else{
    for(const m of Object.values(groups)){
      const full=monthBounds(m.key),w=clipped(full);
      const prev=monthBounds(shift(full.from,-1).slice(0,7));
      const partial=w.from!==full.from||w.to!==full.to;
      rows.push({label:m.key,w,p:partial?null:prev,reason:partial?'Partial month; full-month comparison unavailable':null});
    }
  }
  return {name,columns:[col('Period',22),col('From',15),col('To',15),col('Prior From',15),col('Prior To',15),...compareColumns],
    rowCount:rows.length,rows:function*(){
      for(const r of rows)yield [r.label,r.w.from,r.w.to,r.p?.from??null,r.p?.to??null,...comparisonRow(range(r.w),range(r.p),r.w,r.p,r.reason)];
    }};
}
function executiveRows(report,complete){
  const c=report.comparison;
  const data=[
    ['GMS COMPLETE FINANCIAL REPORT','RetailOps snapshot'],
    ['Selected period start',report.selectedWindow.from||complete.firstDate||'All time'],
    ['Selected period end',report.selectedWindow.to||complete.lastDate||'All time'],
    ['Prior period start',c.window?.from||'Not applicable'],
    ['Prior period end',c.window?.to||'Not applicable'],
    ['Selected daily records',complete.selectedCount],
    ['Prior daily records',complete.priorCount],
    ['Unique ASINs',report.meta.asins],
    ['Assigned sellers',report.meta.sellers],
    ['Unmatched daily records',report.meta.unmatchedRecords],
    ['Current date coverage',c.currentCoverage.observedDays+' / '+(c.currentCoverage.expectedDays??'All time')],
    ['Prior date coverage',c.previousCoverage?c.previousCoverage.observedDays+' / '+c.previousCoverage.expectedDays:'Not applicable'],
    ['Comparison rule','Immediately preceding equal-length calendar period. Blank means unavailable, not zero. Ratios compare in percentage points.'],
    ['Week comparison','Same observed week segment seven days earlier. Weeks spanning months are split so revenue is not counted twice.'],
    ['Month comparison','Complete calendar months only; partial month changes are unavailable.'],
    ['Title retention','Product Title is the uploaded title. Older records may only have Catalog Product Title.'],
    ['Data basis','One row per stored daily fact. Prior Period Data is a separate baseline, excluded from selected totals.'],
    ['Precision','Money is aggregated from exact stored decimal values. Large values beyond Excel precision are stored as text.'],
    [],
    ['Metric','Current','Prior','Change','Change unit'],
  ];
  for(const m of METRICS){
    const ratio=m.kind==='ratio',v=report.kpis[m.key],p=c.baseline[m.key],delta=c.changes[m.key];
    data.push([m.label,v==null?null:ratio?v/100:v,p==null?null:ratio?p/100:p,delta==null?null:ratio?delta:delta/100,ratio?'pp':'%']);
  }
  return data;
}
function buildDailyExport(facts,{window}){
  const current=facts.filter(r=>inWindow(r,window));
  return {report:{matrixRows:[],monthGroups:{}},complete:{raw:rawSheet('Complete Data',current),selectedCount:current.length,sheets:[]}};
}
function buildCompleteExport(facts,{window,level='asin'}){
  const current=facts.filter(r=>inWindow(r,window));
  const prior=priorWindow(window),previous=prior?facts.filter(r=>inWindow(r,prior)):[];
  const report=buildAnalytics(facts,{window,level,rowComparisons:false});
  if(report.meta.records!==current.length)throw new Error('GMS export row-count reconciliation failed');
  const sortedDates=report.daily.map(d=>d.date);
  const complete={selectedCount:current.length,priorCount:previous.length,firstDate:sortedDates[0],lastDate:sortedDates.at(-1)};
  const raw=rawSheet('Complete Data',current);
  complete.raw=raw;
  complete.sheets=[
    raw,
    {name:'Executive Summary',columns:[col('Metric / Detail',34),col('Value / Current',48),col('Prior',24),col('Change',24),col('Change unit',18)],
      rows:()=>executiveRows(report,complete),summary:true,rowCount:20+METRICS.length},
    entitySheet('ASIN Analytics','asin',current,previous,window,prior),
    entitySheet('Seller Analytics','seller',current,previous,window,prior),
    periodSheet('Daily Analytics','day',facts,current,window),
    periodSheet('Weekly Analytics','week',facts,current,window),
    periodSheet('Monthly Analytics','month',facts,current,window),
  ];
  if(prior)complete.sheets.push(rawSheet('Prior Period Data',previous));
  return {report,complete};
}
module.exports={buildCompleteExport,buildDailyExport,rawColumns,rawRow,excelAmount,comparisonRow,METRICS};
