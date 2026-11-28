// Fixture adapter for the consolidated multi-resultset dashboard SQL batch.
// Financial fixture rows never match independent request calls.
const {makeFakePool}=require('./fakePool');
function makeDashboardPool(fixtures){
 const financial=new Map(fixtures.filter(x=>x.section).map(x=>[x.section,x.rows]));
 return makeFakePool([{match:/INTO #DashSource/,recordsets:entry=>{
  const rows=k=>entry.sql.includes('WHERE g.Date>=@prevStart AND g.Date<DATEADD(day,1,@endDate)  AND 1=0')?[]:financial.get(k)||[];
  const daily=rows('daily'),overview=[rows('ads'),rows('sellers'),rows('selling')],products=[rows('products'),rows('spark')];
  const hasOverview=entry.sql.includes('SELECT COUNT(DISTINCT g.Asin) AS AsinsWithSales FROM #DashGms');
  const hasProducts=entry.sql.includes('INTO #DashLeaders');
  return [daily,...(hasOverview?overview:[]),...(hasProducts?products:[])];
 }},...fixtures.filter(x=>!x.section)]);
}
module.exports={makeDashboardPool};
