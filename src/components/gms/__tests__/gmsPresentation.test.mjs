import test from 'node:test';
import assert from 'node:assert/strict';
import {formatMoney,formatCount,formatRatio,compactMoney,changeLabel,changeTone,dailySeries,matrixPeriods,visibleMonth} from '../gmsPresentation.mjs';

test('unknown values, signed values and observed zeros remain distinct',()=>{
  assert.equal(formatMoney(null),'N/A');
  assert.equal(formatMoney(0),'₹0.00');
  assert.equal(formatMoney(-125.5),'-₹125.50');
  assert.equal(formatCount(0),'0');
  assert.equal(formatRatio(null),'N/A');
  assert.equal(formatRatio(-2.5),'-2.50%');
  assert.equal(compactMoney(-125000),'-₹1.25L');
  assert.equal(changeLabel({kind:'ratio'},2.5),'+2.50 pp');
  assert.equal(changeLabel({kind:'money'},null),null);
  assert.equal(changeLabel({kind:'money'},0),'0.00%');
  assert.equal(changeTone({invert:true},-2),'success');
  assert.equal(changeTone({neutral:true},20),'default');
});
test('chart fills gaps with nulls without changing observed data',()=>{
  const data=dailySeries([{date:'2026-11-25',orderedRevenue:0},{date:'2026-11-27',orderedRevenue:-125.5}],'orderedRevenue',{from:'2026-11-24',to:'2026-11-28'});
  assert.deepEqual(data.map(p=>p.y),[null,0,null,-125.5,null]);
  assert.equal(new Date(data[2].x).toISOString().slice(0,10),'2026-11-26');
  assert.deepEqual(dailySeries([],'orderedRevenue',null),[]);
});
test('daily and weekly views select a month, keep split ISO weeks distinct, and preserve server keys',()=>{
  const groups={
    '2025-01':{key:'2025-01',label:'January 2025',weeks:{'2025-01|2025-W01':{key:'2025-01|2025-W01',label:'Week 1',days:['2025-01-01','2025-01-02']}}},
    '2024-12':{key:'2024-12',label:'December 2024',weeks:{'2024-12|2025-W01':{key:'2024-12|2025-W01',label:'Week 1',days:['2024-12-30','2024-12-31']}}}
  };
  assert.equal(visibleMonth(groups,'missing'),'2025-01');
  assert.deepEqual(matrixPeriods(groups,'summary',null),[]);
  assert.deepEqual(matrixPeriods(groups,'month',null).map(x=>x.sortKey),['month-total-2024-12','month-total-2025-01']);
  assert.deepEqual(matrixPeriods(groups,'week','2024-12').map(x=>x.sortKey),['week-total-2024-12|2025-W01']);
  assert.deepEqual(matrixPeriods(groups,'day','2025-01').map(x=>x.sortKey),['day-2025-01-01','day-2025-01-02']);
});
