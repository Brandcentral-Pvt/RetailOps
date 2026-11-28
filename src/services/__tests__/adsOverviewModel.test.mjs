import test from 'node:test';
import assert from 'node:assert/strict';
import {calendarBuckets,buildOverviewTrend,reportCurrencies,metricValue} from '../../pages/ads/adsOverviewModel.mjs';
const period={startDate:'2026-04-29',endDate:'2026-05-05',prevStart:'2026-04-22',prevEnd:'2026-04-28'};
test('actual current and prior date buckets clip calendar weeks and months',()=>{
 assert.deepEqual(calendarBuckets(period,'current','month'),[{bucket:'2026-04',start:'2026-04-29',end:'2026-04-30',days:2},{bucket:'2026-05',start:'2026-05-01',end:'2026-05-05',days:5}]);
 assert.deepEqual(calendarBuckets(period,'current','week').map(x=>[x.bucket,x.days]),[['2026-04-27',5],['2026-05-04',2]]);
 assert.equal(calendarBuckets(period,'previous','day')[0].bucket,'2026-04-22');
 assert.equal(calendarBuckets({startDate:'2024-02-28',endDate:'2024-03-01'},'current','day').length,3);
});
test('chart preserves null vs zero, currency isolation and exact raw values',()=>{
 const report={period,current:[{currency:'INR'}],previous:[{currency:'USD'}],series:[
  {currency:'INR',periodKey:'current',bucket:'2026-04-29',totals:{sales:'0',spend:'9007199254740993.1234567891'},ratios:{roas:{value:null}}},
  {currency:'USD',periodKey:'current',bucket:'2026-04-30',totals:{sales:'99'}},
  {currency:'INR',periodKey:'previous',bucket:'2026-04-22',totals:{sales:'4'}}
 ]};
 assert.deepEqual(reportCurrencies(report),['INR','USD']);
 const rows=buildOverviewTrend({report,currency:'INR',periodKey:'current',granularity:'day',keys:['sales','spend','roas']});
 assert.equal(rows.length,7);assert.equal(rows[0].sales,0);assert.equal(rows[0].exact.spend,'9007199254740993.1234567891');assert.equal(rows[0].roas,null);
 assert.equal(rows[1].source,null);assert.equal(rows[1].sales,null);assert.equal(rows[1].spend,null);
 assert.equal(buildOverviewTrend({report,currency:'INR',periodKey:'previous',granularity:'day',keys:['sales']})[0].sales,4);
 assert.equal(metricValue(null,'sales'),null);
});
