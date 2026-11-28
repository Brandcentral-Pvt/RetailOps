'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {check,compareAggregates,rollupRows,emptyReconciliation,COUNTS,AMOUNTS}=require('../services/adsAnalyticsReconciliation');
function raw(over={}){return {currency:'INR',periodKey:'current',coveredDays:1,...Object.fromEntries(COUNTS.map(k=>[k,'0'])),...Object.fromEntries(AMOUNTS.map(k=>[k,null])),...over};}
test('rollups preserve exact signed totals, all-null populations, paired inputs and counts',()=>{
 const a=raw({rowCount:'1',spend:'9007199254740993.1234567891',spendCount:'1',sales:'0',salesCount:'1',roasPairCount:'1',roasPairNumerator:'0',roasPairDenominator:'9007199254740993.1234567891'});
 const b=raw({rowCount:'1',spend:'-0.1234567891',spendCount:'1',sales:null});
 const rolled=rollupRows([a,b],{days:true})[0];
 assert.equal(rolled.spend,'9007199254740993');assert.equal(rolled.rowCount,'2');assert.equal(rolled.spendCount,'2');
 assert.equal(rolled.sales,'0');assert.equal(rolled.organicSales,null);assert.equal(rolled.roasPairCount,'1');assert.equal(rolled.roasPairDenominator,'9007199254740993.1234567891');assert.equal(rolled.coveredDays,'2');
 const out=check('rollup','Rollup');compareAggregates({baseline:[rolled],candidate:[{...rolled,spend:'9007199254740993.0000000000'}],check:out});
 assert.equal(out.result().status,'passed');
});
test('detect missing period, zero vs null, count and sub-cent financial mismatches',()=>{
 const base=raw({rowCount:'1',spend:'0.0000000001',spendCount:'1'});
 const out=check('test','Test');compareAggregates({baseline:[base,raw({currency:'USD',periodKey:'previous'})],candidate:[{...base,spend:'0',spendCount:'0',sales:'0'}],check:out});
 const result=out.result();assert.equal(result.status,'failed');assert.equal(result.mismatchCount,4);
 assert.deepEqual(result.mismatches.map(m=>m.field),['spendCount','spend','sales','period_present']);
 assert.equal(result.mismatches.find(m=>m.field==='sales').expected,null);
});
test('bounded detail count never conceals failure or claims a pass for no data',()=>{
 const out=check('many','Many');
 for(let i=0;i<100;i++)out.compare('INR','current','field'+i,'1','2');
 assert.equal(out.result().mismatchCount,100);assert.equal(out.result().mismatches.length,30);
 assert.equal(check('empty','Empty').result().status,'not_applicable');assert.equal(emptyReconciliation().status,'no_data');
});
