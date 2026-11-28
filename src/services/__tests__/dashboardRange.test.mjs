import test from 'node:test';
import assert from 'node:assert/strict';
import {dashboardDateKey,dashboardRangeError,matchesDashboardPeriod,sameDashboardScope,dashboardErrorText} from '../../utils/dashboardRange.mjs';
test('calendar date serialization uses local day and rejects invalid inputs',()=>{
 assert.equal(dashboardDateKey(new Date(2026,10,28,0,0,0)),'2026-11-28');
 assert.equal(dashboardDateKey(new Date(2026,10,28,23,59,59)),'2026-11-28');
 assert.equal(dashboardDateKey(new Date(NaN)),'invalid');
 assert.equal(dashboardDateKey(null),undefined);
});
test('inclusive range validation supports single day and leap day',()=>{
 assert.equal(dashboardRangeError('2026-11-28','2026-11-28'),null);
 assert.equal(dashboardRangeError('2024-01-01','2024-12-31'),null);
 assert.equal(dashboardRangeError('2024-02-29','2024-02-29'),null);
 assert.ok(dashboardRangeError('2026-02-29','2026-03-01'));
 assert.ok(dashboardRangeError('2026-11-28','2026-11-27'));
 assert.ok(dashboardRangeError('2024-01-01','2025-01-01'));
 assert.ok(dashboardRangeError('2026-11-28',undefined));
});
test('late product response cannot replace selected scope or reporting dates',()=>{
 const data={period:{startDate:'2026-10-01',endDate:'2026-10-31'}};
 assert.ok(matchesDashboardPeriod(data,'2026-10-01','2026-10-31'));
 assert.ok(!matchesDashboardPeriod(data,'2026-11-01','2026-11-28'));
 const a={sellerIds:['a','b'],empty:false,unrestricted:false,managerId:'m'};
 assert.ok(sameDashboardScope(a,{...a,sellerIds:['b','a']}));
 assert.ok(!sameDashboardScope(a,{...a,sellerIds:['b']}));
 assert.ok(!sameDashboardScope(a,{...a,managerId:'n'}));
 assert.ok(!sameDashboardScope(a,null));
});
test('specific date and timeout failures are actionable',()=>{
 assert.equal(dashboardErrorText({response:{status:400,data:{error:'Invalid date range'}}}),'Invalid date range');
 assert.match(dashboardErrorText({response:{status:504}}),/timed out/);
});
