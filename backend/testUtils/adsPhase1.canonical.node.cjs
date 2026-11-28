'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {HEADERS,validateReport,replayValidatedRows}=require('../services/adsProductContract');
const {strictScope,explicitSeller,resolveContext}=require('../services/adsCanonicalScope');
const {METRICS,RATIOS,ratio,shapeSummary,validateWindow,readCanonicalSummary}=require('../services/adsCanonicalMetrics');
const user={Id:'u1',role:{Name:'brand_manager'},assignedSellers:['s1','s2']};
const quote=v=>'"'+String(v??'').replace(/"/g,'""')+'"';
const csv=(rows,headers=HEADERS)=>Buffer.from(headers.map(quote).join(',')+'\n'+rows.map(r=>headers.map(h=>quote(r[h])).join(',')).join('\n')+'\n');
test('strict authorization rejects mixed scope, missing identity and mixed sentinels',()=>{
 assert.deepEqual(strictScope(user,'s1,s2').sellerIds,['s1','s2']);
 assert.throws(()=>strictScope(user,'s1,foreign'),{code:'forbidden_seller'});
 assert.throws(()=>strictScope(user,'all,s1'),{code:'invalid_seller_filter'});
 assert.throws(()=>strictScope(null,'s1'),{code:'authentication_required'});
 assert.throws(()=>explicitSeller(user,'all'),{code:'seller_required'});
 assert.throws(()=>explicitSeller(user,'foreign'),{code:'forbidden_seller'});
 assert.equal(strictScope({...user,assignedSellers:[]}).empty,true);
 assert.deepEqual(resolveContext({Id:'s1',Marketplace:'amazon.in'}),{marketplace:'amazon.in',currency:'INR'});
});
test('replay retains exact strings, source row, null and signed adjustments',()=>{
 const input=csv([{asin:'B000000001',date:'"2026-04-01"',sku:'None','metrics.spend':'0','metrics.total_sales':'-123456789012345678.1234567890'}],[...HEADERS].reverse());
 const report=validateReport(input);assert.equal(report.valid,true);
 const rows=[...replayValidatedRows(input,report.sourceFileSha256)];
 assert.equal(rows.length,1);assert.equal(rows[0][0],2);
 assert.equal(rows[0][HEADERS.indexOf('sku')+1],null);
 assert.equal(rows[0][HEADERS.indexOf('metrics.spend')+1],'0');
 assert.equal(rows[0][HEADERS.indexOf('metrics.total_sales')+1],'-123456789012345678.123456789');
 assert.throws(()=>[...replayValidatedRows(csv([{asin:'B000000002',date:'2026-04-01'}]),report.sourceFileSha256)],{code:'source_changed'});
});
function raw({rows='3',metrics={}}={}){
 const r={currency:'INR',rowCount:rows};
 for(const k of Object.keys(METRICS)){r[k]=null;r[k+'Count']='0';}
 for(const [k,[n,d]] of Object.entries(RATIOS)){r[k+'PairCount']='0';r[k+'PairNumerator']=null;r[k+'PairDenominator']=null;}
 return Object.assign(r,metrics);
}
test('explicit sales/orders and conversion metrics are not reconstructed',()=>{
 const r=raw({metrics:{spend:'10.25',spendCount:'2',sales:'25.50',salesCount:'2',organicSales:'8',organicSalesCount:'1',
 totalSales:'20',totalSalesCount:'1',orders:'2',ordersCount:'2',conversions:'1',conversionsCount:'2',totalOrders:'3',totalOrdersCount:'1',clicks:'4',clicksCount:'2',
 acosPairCount:'2',acosPairNumerator:'10.25',acosPairDenominator:'25.50',
 tacosPairCount:'1',tacosPairNumerator:'10.25',tacosPairDenominator:'20',
 cvrPairCount:'2',cvrPairNumerator:'1',cvrPairDenominator:'4',
 aovPairCount:'2',aovPairNumerator:'25.5',aovPairDenominator:'1'}});
 const a=shapeSummary(r);
 assert.equal(a.totals.totalSales,'20');assert.equal(a.totals.totalOrders,'3');
 assert.equal(a.ratios.acos.value,'40.196078');assert.equal(a.ratios.acos.status,'partial');
 assert.equal(a.ratios.tacos.value,null);assert.equal(a.ratios.tacos.observedValue,'51.25');
 assert.equal(a.ratios.tacos.status,'incompatible_coverage');
 assert.equal(a.ratios.cvr.value,'25');assert.equal(a.ratios.aov.value,'25.5');
 assert.equal(a.coverage.spend.missing,'1');
});
test('null, zero, negative, overflow-safe ratios and window bounds',()=>{
 const unknown=shapeSummary(raw());
 assert.equal(unknown.totals.spend,null);assert.equal(unknown.ratios.acos.value,null);
 assert.equal(ratio('0','100',100),'0');
 assert.equal(ratio('-10','100',100),'-10');
 assert.equal(ratio('1','0',100),null);
 assert.equal(ratio('1','-1',100),null);
 assert.equal(ratio('123456789012345678.123456789','1',1),'123456789012345678.123457');
 assert.throws(()=>ratio(1,'2',1));
 assert.equal(validateWindow('2024-01-01','2024-12-31').days,366);
 assert.throws(()=>validateWindow('2024-01-01','2025-01-01'));
 assert.throws(()=>validateWindow('2026-02-30','2026-03-01'));
});
test('summary short-circuits no scope and does not query mixed scope',async()=>{
 const args={pool:{request(){throw new Error('unexpected SQL');}},sql:{},user:{...user,assignedSellers:[]},startDate:'2026-04-01',endDate:'2026-04-30'};
 assert.equal((await readCanonicalSummary(args)).empty,true);
 await assert.rejects(()=>readCanonicalSummary({...args,user,sellerId:'s1,foreign'}),{code:'forbidden_seller'});
});
