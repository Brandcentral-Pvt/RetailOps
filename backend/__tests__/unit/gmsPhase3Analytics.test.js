const { makeFakePool }=require('../../testUtils/fakePool');
jest.mock('../../database/db',()=>({sql:require('../../testUtils/fakePool').FAKE_SQL}));
const { buildAnalytics,priorWindow,isoWeek,weekKey,filterSpec,queryFacts,loadAnalytics }=require('../../services/gmsAnalyticsService');
const fact=(date,revenue,extra={})=>({
  date,asin:'B000000001',sellerId:'S1',dbBrand:'Seller A',brand:'Sheet Brand',storeCode:'IN',productTitle:'Example',
  orderedRevenue:String(revenue),orderedUnits:2,shippedRevenue:'100.00',shippedCOGS:'60.00',shippedUnits:2,customerReturns:1,...extra
});
const report=(facts,from,to,filters={},level='asin')=>buildAnalytics(facts,{window:{from,to},filters,level});
const globalUser={role:{name:'admin'},assignedSellers:[]};
const scopedUser={role:{name:'brand_manager'},assignedSellers:['S1']};

describe('canonical calendar periods',()=>{
  test('prior period is equally long and adjacent across leap day',()=>{
    expect(priorWindow({from:'2024-03-01',to:'2024-03-02'})).toEqual({from:'2024-02-28',to:'2024-02-29',days:2});
    expect(priorWindow({from:'2026-11-27',to:'2026-11-27'})).toEqual({from:'2026-11-26',to:'2026-11-26',days:1});
    expect(isoWeek('2021-01-01')).toBe('2020-W53');
    expect(isoWeek('2024-12-30')).toBe('2025-W01');
  });
  test('same ISO week split by month never duplicates revenue',()=>{
    const r=report([fact('2024-12-30','10.01'),fact('2024-12-31','-2.02'),fact('2025-01-01','5.05')],'2024-12-30','2025-01-01');
    const row=r.matrixRows[0];
    expect(row.weeklyRev).toEqual({'2024-12|2025-W01':7.99,'2025-01|2025-W01':5.05});
    expect(row.monthlyRev).toEqual({'2024-12':7.99,'2025-01':5.05});
    expect(r.kpis.orderedRevenue).toBe(13.04);
    expect(Object.keys(r.monthGroups['2024-12'].weeks)).toEqual(['2024-12|2025-W01']);
    expect(Object.keys(r.monthGroups['2025-01'].weeks)).toEqual(['2025-01|2025-W01']);
  });
  test('DoD and clipped week segment compare exact prior calendar dates',()=>{
    const r=report([fact('2025-01-01','10'),fact('2025-01-02','20'),fact('2025-01-07','15'),fact('2025-01-08','20'),fact('2025-01-09','40')],'2025-01-08','2025-01-09');
    expect(r.matrixRows[0]._dodTrends['2025-01-08']).toBeCloseTo(100/3);
    expect(r.matrixRows[0]._dodTrends['2025-01-09']).toBe(100);
    expect(r.matrixRows[0]._wowTrends[weekKey('2025-01-08')]).toBe(100);
    expect(r.matrixRows[0]._momTrends['2025-01']).toBeNull();
  });
  test('MoM compares complete calendar months; missing daily record does not invent zero',()=>{
    const facts=[];
    for(let d=1;d<=28;d++)facts.push(fact('2025-02-'+String(d).padStart(2,'0'),'10'));
    for(let d=1;d<=31;d++)facts.push(fact('2025-03-'+String(d).padStart(2,'0'),'20'));
    expect(report(facts,'2025-03-01','2025-03-31').matrixRows[0]._momTrends['2025-03']).toBeCloseTo((620-280)/280*100);
    expect(report(facts.filter(r=>r.date!=='2025-02-15'),'2025-03-01','2025-03-31').matrixRows[0]._momTrends['2025-03']).toBeNull();
  });
});
describe('KPI integrity, grouping and filter parity',()=>{
  test('selected total and equal preceding period, signed baseline and ratio percentage points',()=>{
    const r=report([fact('2026-11-25','-10',{orderedUnits:2,customerReturns:1}),fact('2026-11-26','-10',{orderedUnits:2,customerReturns:1}),fact('2026-11-27','5',{orderedUnits:4,customerReturns:1}),fact('2026-11-28','10',{orderedUnits:4,customerReturns:1})],'2026-11-27','2026-11-28');
    expect(r.kpis).toMatchObject({orderedRevenue:15,orderedUnits:8,profit:80,marginPct:40,returnRatio:25});
    expect(r.comparison.baseline.orderedRevenue).toBe(-20);
    expect(r.comparison.changes.orderedRevenue).toBe(175);
    expect(r.comparison.changes.returnRatio).toBe(-25);
    expect(r.comparison.currentCoverage.complete).toBe(true);
    expect(r.matrixRows[0]).toMatchObject({orderedRevenue:15,shippedRevenue:200,shippedCOGS:120,profit:80,marginPct:40,returnRatio:25,periodCoverage:{currentDays:2,priorDays:2,expectedDays:2,comparable:true}});
    expect(r.matrixRows[0].periodChanges.orderedRevenue).toBe(175);
    expect(r.matrixRows[0].periodChanges.returnRatio).toBe(-25);
  });
  test('missing days, zero baseline and null metrics are explicit rather than fabricated',()=>{
    const r=report([fact('2026-11-25','0'),fact('2026-11-27','0',{shippedRevenue:null,orderedUnits:0})],'2026-11-27','2026-11-28');
    expect(r.kpis).toMatchObject({orderedRevenue:0,shippedRevenue:null,profit:null,marginPct:null,returnRatio:null});
    expect(r.comparison.changes.orderedRevenue).toBeNull();
    expect(r.comparison.currentCoverage).toMatchObject({observedDays:1,expectedDays:2,complete:false});
    expect(r.matrixRows[0].dailyRev['2026-11-27']).toBe(0);
    expect(r.matrixRows[0].dailyRev['2026-11-28']).toBeUndefined();
    expect(r.matrixRows[0].periodCoverage.comparable).toBe(false);
    expect(r.matrixRows[0].periodChanges.orderedRevenue).toBeNull();
  });
  test('same seller display name does not merge distinct IDs and unmatched revenue stays separate',()=>{
    const facts=[fact('2026-11-27','0.10'),fact('2026-11-27','0.20',{asin:'B000000002',sellerId:'S2'}),fact('2026-11-27','-0.05',{asin:'B000000003',sellerId:null,dbBrand:null})];
    const r=report(facts,'2026-11-27','2026-11-27',{},'seller');
    expect(r.kpis.orderedRevenue).toBe(0.25);
    expect(r.matrixRows).toHaveLength(3);
    expect(r.matrixRows.find(row=>row.isUnmatched)).toMatchObject({dbBrand:'-',brand:'Sheet Brand'});
    expect(r.meta).toMatchObject({records:3,sellers:2,unmatchedRecords:1});
    expect(report(facts,'2026-11-27','2026-11-27',{sellerIds:['S2'],search:'EXAMPLE'}).kpis.orderedRevenue).toBe(0.2);
    expect(report(facts,'2026-11-27','2026-11-27',{sellerIds:[]}).meta.records).toBe(0);
  });
});
describe('canonical SQL scope and historical fetch',()=>{
  test('date and seller IDs are bound; scoped roles keep catalog restrictions',async()=>{
    const db=makeFakePool([{match:/FROM GmsDailyPerformance g/,rows:[fact('2026-11-27','5')]}]);
    await loadAnalytics(db,scopedUser,{startDate:'2026-11-27',endDate:'2026-11-27',sellerIds:['S1'],search:'example',level:'asin'});
    const call=db.calls[0];
    expect(call.inputs).toMatchObject({fromDate:'2026-10-01',toDate:'2026-11-27',allowedSellerIds:'["S1"]',sellerIds:'["S1"]',search:'example'});
    expect(call.sql).toContain('OUTER APPLY');
    expect(call.sql).toContain('NOT EXISTS');
    expect(call.sql).toContain('OPENJSON(@sellerIds)');
    expect(call.sql).toContain('OPENJSON(@allowedSellerIds)');
    expect(call.sql).toContain('CHARINDEX(@search');
    expect(call.sql).not.toContain("'S1'");
  });
  test('empty selected seller intersection never widens scope',async()=>{
    const db=makeFakePool();
    expect(await queryFacts(db,globalUser,{from:null,to:null},{sellerIds:[]})).toEqual([]);
    expect(db.calls).toHaveLength(0);
    expect(()=>filterSpec({sellerIds:'S1'})).toThrow();
  });
});
