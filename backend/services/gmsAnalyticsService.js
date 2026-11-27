const { dateWindow, gmsCatalogApplySql, unambiguousSellerSql } = require('../utils/gmsPhase1');
const { resolveSellerScope } = require('../utils/sellerScope');
const { sql } = require('../database/db');

const MONEY=['orderedRevenue','shippedRevenue','shippedCOGS'];
const UNITS=['orderedUnits','shippedUnits','customerReturns'];
const FIELDS=[...MONEY,...UNITS];
const DAY=86400000;
const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
const dateAt=d=>new Date(d+'T00:00:00Z');
const iso=d=>d.toISOString().slice(0,10);
const shift=(d,n)=>iso(new Date(dateAt(d).getTime()+n*DAY));
const dayCount=(a,b)=>Math.round((dateAt(b)-dateAt(a))/DAY)+1;
function priorWindow(window) {
  if (!window.from || !window.to) return null;
  const days=dayCount(window.from,window.to);
  return {from:shift(window.from,-days),to:shift(window.from,-1),days};
}
function monthStart(d){return d.slice(0,7)+'-01';}
function monthOffset(d,n){
  const v=dateAt(monthStart(d));v.setUTCMonth(v.getUTCMonth()+n);return iso(v);
}
function monday(d){return shift(d,-((dateAt(d).getUTCDay()+6)%7));}
function isoWeek(d){
  const mon=monday(d), thu=shift(mon,3), year=thu.slice(0,4);
  const first=monday(year+'-01-04');
  return year+'-W'+String(1+Math.round((dateAt(mon)-dateAt(first))/(7*DAY))).padStart(2,'0');
}
const weekKey=d=>d.slice(0,7)+'|'+isoWeek(d);
const fmt=(d,opts)=>dateAt(d).toLocaleDateString('en-IN',{...opts,timeZone:'UTC'});
function filterSpec(input={}){
  const ids=input.sellerIds;
  if(ids!=null&&(!Array.isArray(ids)||ids.length>10000||ids.some(v=>typeof v!=='string'||!v.trim()||v.length>100))) throw new Error('Invalid seller filter');
  if(input.search!=null&&(typeof input.search!=='string'||input.search.length>200)) throw new Error('Invalid search filter');
  return {sellerIds:ids==null?null:[...new Set(ids)],search:(input.search||'').trim().toLowerCase()};
}
// Shared SQL text-search predicate; all field expressions are authored by
// trusted callers and the search value is a bound parameter.
function literalSearchSql(fields){
  return '('+fields.map(f=>"CHARINDEX(@search,LOWER(CONVERT(nvarchar(max),COALESCE("+f+",N''))) COLLATE Latin1_General_100_BIN2)>0").join(' OR ')+')';
}
function selectFacts(rows,filters={}){
  const spec=filterSpec(filters), sellers=spec.sellerIds===null?null:new Set(spec.sellerIds);
  return rows.filter(r=>{
    if(sellers&&!sellers.has(String(r.sellerId??'')))return false;
    return !spec.search||[r.asin,r.productTitle,r.brand,r.dbBrand,r.storeCode].some(v=>String(v??'').toLowerCase().includes(spec.search));
  });
}
function cents(value){
  if(value==null)return null;
  const s=String(value).replace(/(\.\d{2})0+$/,'$1');
  if(!/^[+-]?\d+(?:\.\d{1,2})?$/.test(s))throw new Error('Invalid stored GMS monetary precision');
  const neg=s.startsWith('-'),[w,f='']=s.replace(/^[+-]/,'').split('.');
  return (neg?-1n:1n)*(BigInt(w)*100n+BigInt(f.padEnd(2,'0')));
}
function quantity(value){
  if(value==null)return null;
  const s=String(value);
  if(!/^[+-]?\d+$/.test(s))throw new Error('Invalid stored GMS quantity');
  return BigInt(s);
}
function safeNumber(v,divisor=1){
  if(v>BigInt(Number.MAX_SAFE_INTEGER)||v<BigInt(Number.MIN_SAFE_INTEGER))throw new Error('GMS total exceeds safe reporting precision');
  return Number(v)/divisor;
}
function accumulator(){return {values:Object.fromEntries(FIELDS.map(k=>[k,0n])),counts:Object.fromEntries(FIELDS.map(k=>[k,0])),records:0};}
function add(a,r){
  a.records++;
  for(const k of FIELDS){
    const v=MONEY.includes(k)?cents(r[k]):quantity(r[k]);
    if(v!==null){a.values[k]+=v;a.counts[k]++;}
  }
}
function metrics(a){
  const out={};
  for(const k of FIELDS)out[k]=a.counts[k]===a.records&&a.records>0?safeNumber(a.values[k],MONEY.includes(k)?100:1):null;
  out.profit=out.shippedRevenue==null||out.shippedCOGS==null?null:safeNumber(a.values.shippedRevenue-a.values.shippedCOGS,100);
  out.marginPct=out.shippedRevenue>0&&out.profit!=null?out.profit/out.shippedRevenue*100:null;
  out.returnRatio=out.orderedUnits>0&&out.customerReturns!=null?out.customerReturns/out.orderedUnits*100:null;
  return out;
}
function pct(curr,prev){return curr==null||prev==null||prev===0?null:(curr-prev)/Math.abs(prev)*100;}
function inWindow(r,w){return (!w.from||r.date>=w.from)&&(!w.to||r.date<=w.to);}
function coverage(rows,w){
  const dates=new Set(rows.map(r=>r.date));
  const days=w.from&&w.to?dayCount(w.from,w.to):null;
  return {observedDays:dates.size,expectedDays:days,complete:days!==null&&dates.size===days,records:rows.reduce((n,r)=>n+Number(r.recordCount??1),0)};
}
function keyOf(r,level){
  if(r.entityKey!=null)return r.entityKey; // internal SQL-aggregated page rows
  return level==='asin'?r.asin:r.sellerId!=null?'seller:'+String(r.sellerId):'unmatched:'+String(r.brand||'-');
}
function buildGroups(dates){
  const groups={};
  for(const d of [...new Set(dates)].sort()){
    const m=d.slice(0,7),w=weekKey(d);
    if(!groups[m])groups[m]={key:m,label:fmt(d,{month:'long',year:'numeric'}),weeks:{}};
    if(!groups[m].weeks[w])groups[m].weeks[w]={key:w,isoWeek:isoWeek(d),days:[]};
    groups[m].weeks[w].days.push(d);
  }
  for(const m of Object.values(groups))for(const w of Object.values(m.weeks)){
    w.from=w.days[0];w.to=w.days[w.days.length-1];
    w.label='Week '+Number(w.isoWeek.split('-W')[1])+' ('+fmt(w.from,{day:'2-digit',month:'short'})+' - '+fmt(w.to,{day:'2-digit',month:'short'})+')';
  }
  return groups;
}
function addDaily(map,r){
  const k=r.date;
  if(!map.has(k))map.set(k,{value:0n,unknown:false});
  const entry=map.get(k), v=cents(r.orderedRevenue);
  if(v===null)entry.unknown=true;else entry.value+=v;
}
function revenueOn(map,dates){
  let value=0n;
  for(const d of dates){
    const x=map.get(d);
    if(!x||x.unknown)return null;
    value+=x.value;
  }
  return safeNumber(value,100);
}
function rangeDates(from,to){
  const out=[];
  for(let d=from;d<=to;d=shift(d,1))out.push(d);
  return out;
}
// Shared summary computation accepts raw facts or lossless SQL day aggregates.
function summarizeMetrics(facts){
  const acc=accumulator();
  for(const row of facts)add(acc,row);
  return metrics(acc);
}
function historyWindow(window){
  if(!window.from||!window.to)return {from:null,to:window.to};
  const prior=priorWindow(window);
  return {from:[prior.from,monthOffset(window.from,-1),shift(window.from,-7)].sort()[0],to:window.to};
}
function buildOverview(facts,window){
  const prior=priorWindow(window);
  const current=facts.filter(r=>inWindow(r,window));
  const previous=prior?facts.filter(r=>inWindow(r,prior)):[];
  const nowAcc=accumulator(),prevAcc=accumulator(),dailyAcc=new Map();
  for(const r of previous)add(prevAcc,r);
  for(const r of current){
    add(nowAcc,r);
    if(!dailyAcc.has(r.date))dailyAcc.set(r.date,accumulator());
    add(dailyAcc.get(r.date),r);
  }
  const kpis=metrics(nowAcc),baseline=metrics(prevAcc);
  const currentCoverage=coverage(current,window),previousCoverage=prior?coverage(previous,prior):null;
  const comparable=currentCoverage.complete&&previousCoverage?.complete;
  const changes=Object.fromEntries(Object.keys(kpis).map(k=>[k,comparable?(k==='returnRatio'||k==='marginPct'?(kpis[k]==null||baseline[k]==null?null:kpis[k]-baseline[k]):pct(kpis[k],baseline[k])):null]));
  const dates=[...dailyAcc.keys()].sort();
  const daily=dates.map(date=>({date,...metrics(dailyAcc.get(date))}));
  return {kpis,comparison:{window:prior,changes,baseline,currentCoverage,previousCoverage},daily,
    meta:{records:current.reduce((n,r)=>n+Number(r.recordCount??1),0),asins:new Set(current.map(r=>r.asin)).size,sellers:new Set(current.map(r=>r.sellerId).filter(v=>v!=null)).size,
      unmatchedRecords:current.filter(r=>r.sellerId==null).reduce((n,r)=>n+Number(r.recordCount??1),0),last:dates[dates.length-1]||null},selectedWindow:window};
}
function buildAnalytics(raw,{window,filters={},level='asin',groups=null,includeOverview=true,rowComparisons=true}){
  if(!['asin','seller'].includes(level))throw new Error('Invalid grouping');
  const facts=selectFacts(raw,filters);
  const current=facts.filter(r=>inWindow(r,window));
  const rows=new Map(),history=new Map();
  const prior=priorWindow(window),previousByKey=new Map();
  for(const r of facts){
    const key=keyOf(r,level);
    if(!history.has(key))history.set(key,new Map());
    addDaily(history.get(key),r);
    if(rowComparisons&&prior&&inWindow(r,prior)){
      if(!previousByKey.has(key))previousByKey.set(key,{acc:accumulator(),dates:new Set()});
      const previous=previousByKey.get(key);add(previous.acc,r);previous.dates.add(r.date);
    }
  }
  for(const r of current){
    const key=keyOf(r,level);
    if(!rows.has(key))rows.set(key,{key,asin:level==='asin'?r.asin:'-',dbBrand:r.dbBrand||'-',sellerId:r.sellerId??null,
      isUnmatched:r.sellerId==null,productTitle:r.productTitle||'-',asins:new Set(),brands:new Set(),stores:new Set(),acc:accumulator(),daily:new Map()});
    const row=rows.get(key);
    row.asins.add(r.asin);row.brands.add(r.brand||'-');row.stores.add(r.storeCode||'-');
    add(row.acc,r);addDaily(row.daily,r);
  }
  const monthGroups=groups||buildGroups(current.map(r=>r.date));
  const matrixRows=[];
  for(const r of rows.values()){
    const all=history.get(r.key),dailyRev={},weeklyRev={},monthlyRev={},_dodTrends={},_wowTrends={},_momTrends={};
    for(const d of r.daily.keys()){
      dailyRev[d]=revenueOn(r.daily,[d]);
      _dodTrends[d]=pct(dailyRev[d],revenueOn(all,[shift(d,-1)]));
    }
    // Sum observed values for a subtotal, but never turn an unknown stored metric into zero.
    const subtotal=dates=>{
      const observed=dates.filter(d=>r.daily.has(d));
      return observed.length?revenueOn(r.daily,observed):null;
    };
    const rowMonths=new Set([...r.daily.keys()].map(d=>d.slice(0,7)));
    const rowWeeks=new Set([...r.daily.keys()].map(weekKey));
    for(const month of rowMonths){
      const m=monthGroups[month];
      const monthDays=Object.values(m.weeks).flatMap(w=>w.days);
      monthlyRev[m.key]=subtotal(monthDays);
      const from=m.key+'-01',to=shift(monthOffset(from,1),-1);
      const prevFrom=monthOffset(from,-1),prevTo=shift(from,-1);
      // MoM is a calendar-month comparison; do not label a partial month as a full month.
      _momTrends[m.key]=inWindow({date:from},window)&&inWindow({date:to},window)
        ?pct(revenueOn(r.daily,rangeDates(from,to)),revenueOn(all,rangeDates(prevFrom,prevTo))):null;
      for(const w of Object.values(m.weeks)){
        if(!rowWeeks.has(w.key))continue;
        weeklyRev[w.key]=subtotal(w.days);
        // A week spanning months is split into non-overlapping month segments.
        // Compare exactly the same weekdays one week earlier, never the whole week twice.
        const days=rangeDates(w.from,w.to);
        _wowTrends[w.key]=pct(revenueOn(r.daily,days),revenueOn(all,days.map(d=>shift(d,-7))));
      }
    }
    const brandsList=[...r.brands].sort(),storeCodesList=[...r.stores].sort();
    const currentMetrics=metrics(r.acc),previous=previousByKey.get(r.key),baseline=previous?metrics(previous.acc):null;
    const comparable=Boolean(prior&&r.daily.size===prior.days&&previous?.dates.size===prior.days);
    const periodChanges=rowComparisons?Object.fromEntries(Object.keys(currentMetrics).map(k=>[k,comparable?(k==='marginPct'||k==='returnRatio'?(currentMetrics[k]==null||baseline[k]==null?null:currentMetrics[k]-baseline[k]):pct(currentMetrics[k],baseline[k])):null])):null;
    matrixRows.push({key:r.key,asin:r.asin,dbBrand:r.dbBrand,sellerId:r.sellerId,isUnmatched:r.isUnmatched,productTitle:r.productTitle,
      asinsList:[...r.asins],brandsList,storeCodesList,brand:brandsList.join(', '),storeCode:storeCodesList.join(', '),
      ...currentMetrics,...(rowComparisons?{periodBaseline:baseline,periodChanges,periodCoverage:{currentDays:r.daily.size,priorDays:previous?.dates.size??0,expectedDays:prior?.days??null,comparable}}:{}),dailyRev,weeklyRev,monthlyRev,_dodTrends,_wowTrends,_momTrends});
  }
  return {matrixRows,monthGroups,...(includeOverview?buildOverview(facts,window):{})};
}
async function queryFacts(pool,user,window,filters={}, {signal}={}){
  if(signal?.aborted)throw new Error('GMS query cancelled');
  const scope=resolveSellerScope(user),spec=filterSpec(filters);
  if(scope.empty||spec.sellerIds?.length===0)return [];
  const q=pool.request();let where='WHERE 1=1';
  if(!scope.isGlobal){
    q.input('allowedSellerIds',sql.NVarChar(sql.MAX),JSON.stringify(scope.allowed));
    where+=' AND EXISTS (SELECT 1 FROM OPENJSON(@allowedSellerIds) j WHERE j.value=a.SellerId)';
    where+=' AND '+unambiguousSellerSql('a');
  }
  if(window.from){q.input('fromDate',sql.Date,window.from);where+=' AND g.Date>=@fromDate';}
  if(window.to){q.input('toDate',sql.Date,window.to);where+=' AND g.Date<DATEADD(day,1,@toDate)';}
  if(spec.sellerIds!==null){
    q.input('sellerIds',sql.NVarChar(sql.MAX),JSON.stringify(spec.sellerIds));
    where+=' AND EXISTS (SELECT 1 FROM OPENJSON(@sellerIds) j WHERE j.value=COALESCE(g.SellerId,a.SellerId))';
  }
  if(spec.search){
    q.input('search',sql.NVarChar(200),spec.search);
    where+=' AND '+literalSearchSql(['g.Asin','COALESCE(g.ReportProductTitle,a.Title)','g.Brand','s.Name','g.StoreCode']);
  }
  // Money is read as exact decimal text, not an imprecise JS float.
  const cancel=()=>{try{q.cancel?.();}catch(_){}};
  signal?.addEventListener('abort',cancel,{once:true});
  try {
  const result=await q.query(
    'SELECT CONVERT(char(10),g.Date,23) AS date,g.Asin AS asin,g.Brand AS brand,g.StoreCode AS storeCode,'+
    'CONVERT(varchar(50),g.OrderedRevenue) AS orderedRevenue,g.OrderedUnits AS orderedUnits,'+
    'CONVERT(varchar(50),g.ShippedRevenue) AS shippedRevenue,CONVERT(varchar(50),g.ShippedCOGS) AS shippedCOGS,'+
    'g.ShippedUnits AS shippedUnits,g.CustomerReturns AS customerReturns,COALESCE(g.SellerId,a.SellerId) AS sellerId,s.Name AS dbBrand,g.ReportProductTitle AS reportProductTitle,a.Title AS catalogProductTitle,COALESCE(g.ReportProductTitle,a.Title) AS productTitle '+
    'FROM GmsDailyPerformance g '+gmsCatalogApplySql+' LEFT JOIN Sellers s ON COALESCE(g.SellerId,a.SellerId)=s.Id '+where+' ORDER BY g.Date DESC,g.Asin,g.Id'
  );
  return result.recordset.filter(r=>r.date);
  }finally{signal?.removeEventListener('abort',cancel);}
}
async function loadAnalytics(pool,user,options,requestOptions={}){
  const window=dateWindow(options.startDate,options.endDate,{required:true});
  const filters=filterSpec(options);
  const facts=await queryFacts(pool,user,historyWindow(window),filters,requestOptions);
  return buildAnalytics(facts,{window,level:options.level??'asin'});
}
module.exports={filterSpec,selectFacts,literalSearchSql,priorWindow,isoWeek,weekKey,buildGroups,buildOverview,buildAnalytics,queryFacts,loadAnalytics,pct,summarizeMetrics,historyWindow};
