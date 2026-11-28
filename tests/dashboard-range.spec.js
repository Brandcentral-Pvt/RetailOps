import {test,expect} from '@playwright/test';
const user={Id:'dashboard-user',_id:'dashboard-user',role:{name:'brand_manager'},permissions:['dashboard_view'],assignedSellers:['s1']};
const scope={sellerIds:['s1'],unrestricted:false,empty:false,managerId:null};
const pad=n=>String(n).padStart(2,'0');
const localDay=d=>d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
const dayShift=(d,n)=>new Date(d.getFullYear(),d.getMonth(),d.getDate()+n);
function response(start,end,revenue,products=false){
 const days=(Date.parse(end)-Date.parse(start))/86400000+1;
 const period={startDate:start,endDate:end,days,granularity:'day',prevStartDate:start,prevEndDate:start};
 const tableData=products?[{id:'a1',asin:'B000000001',sellerId:'s1',sellerName:'Seller',title:'Product '+start,rank:1,gmsRevenue:revenue,gmsUnits:1,share:100,deltaPct:null}]:[];
 return products?{scope,period,tableData,gmsRevenue:revenue,portfolio:{positiveProducts:206,headProducts:145,tailProducts:61,headProductShare:70.39,headRevenueShare:80.01,positiveRevenue:305.03,headRevenue:244.03,tailRevenue:61,top3RevenueShare:33.45,top3Revenue:102.03,observedDays:days,expectedDays:days,unknownProducts:0,unmatchedProducts:0,zeroProducts:0,negativeProducts:0,status:'observed_complete'}}:{scope,period,productsIncluded:false,kpi:[],tableData:[],stats:{totalSellers:1,totalAsins:1,activeAsins:1},labels:[],gms:{revenue,units:1,series:[],unitsSeries:[],coverage:{complete:true,observedDays:days,expectedDays:days},dailyAverage:revenue,asinsWithSales:1},ads:{roas:2,tacos:10,cvr:20,adSales:20,adSpend:10},roasSeries:[2],previous:{},gmsBySeller:[],gmsByMarketplace:[],category:[]};
}
async function mock(page,{failYesterday=false,withOperations=false}={}){
 const calls=[];let release;
 const firstProducts=new Promise(r=>{release=r;});
 const yesterday=await page.evaluate(()=>{const d=new Date();d.setDate(d.getDate()-1);return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');});
 await page.route('**/socket.io/**',r=>r.abort());
 await page.route('**/api/**',async route=>{
  const u=new URL(route.request().url()),path=u.pathname;
  const send=(body,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
  if(path.endsWith('/auth/me'))return send({success:true,data:withOperations?{...user,permissions:[...user.permissions,'tasks_view','targets_view']}:user});
  if(path.endsWith('/dashboard/options'))return send({success:true,data:{sellers:[{id:'s1',name:'Seller'}],managers:[]}});
  if(path.endsWith('/dashboard/tasks'))return send({success:true,scope,instances:[{Id:'t1',Title:'Priority example',Status:'ASSIGNED',DashboardStatus:'PENDING',SellerId:'s1',SellerName:'Seller',Priority:'HIGH'}],summary:{total:205,overdue:40,slaBreached:2,slaAtRisk:3,counts:{PENDING:205}}});
  if(path.endsWith('/dashboard/targets'))return send({success:true,scope,data:[{Id:'goal1',SellerId:'s1',SellerName:'Seller',GoalType:'GMS',TotalTargetValue:'1000',overallAchieved:null,observedActual:100,period:{start:'2026-11-01',end:'2026-11-30'},coverage:{coveredDays:1,expectedDays:28},status:'unknown'}]});
  if(path.endsWith('/dashboard')){
   const start=u.searchParams.get('startDate'),end=u.searchParams.get('endDate'),mode=u.searchParams.get('mode');
   calls.push({start,end,mode});
   const selected=start===yesterday&&end===yesterday;
   if(selected&&failYesterday)return send({error:'Gateway timeout'},504);
   if(mode==='products'&&!selected)await firstProducts;
   try{return await send(response(start,end,selected?222:111,mode==='products'));}catch(e){if(!route.request().failure())throw e;}
  }
  return send({success:true,data:[]});
 });
 return {calls,yesterday,release};
}
const gmsTile=page=>page.locator('.ops-tile').filter({has:page.locator('.ops-tile__label').getByText('GMS',{exact:true})}).locator('.ops-tile__value');
test('overview renders before products and changing the header date rejects old data',async({page})=>{
 const {calls,yesterday,release}=await mock(page);
 try{
  await page.goto('/tests/fixtures/dashboard-range.html');
  await expect(gmsTile(page)).toHaveText('₹111');
  await expect(page.getByText('Loading product analytics',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:/Date range:/}).click();
  await page.getByRole('button',{name:'Yesterday',exact:true}).click();
  await expect(gmsTile(page)).toHaveText('₹222');
  await expect(page.getByText('Product '+yesterday,{exact:true})).toBeVisible();
  expect(calls.filter(c=>c.start===yesterday&&c.end===yesterday).map(c=>c.mode)).toEqual(['overview','products']);
  release();
  await expect(gmsTile(page)).toHaveText('₹222');
 }finally{release();}
});
test('failed range stays actionable and does not retry a gateway timeout',async({page})=>{
 const {calls,yesterday,release}=await mock(page,{failYesterday:true});
 try{
  await page.goto('/tests/fixtures/dashboard-range.html');
  await expect(gmsTile(page)).toHaveText('₹111');
  await page.getByRole('button',{name:/Date range:/}).click();
  await page.getByRole('button',{name:'Yesterday',exact:true}).click();
  await expect(page.getByText(/Dashboard request timed out/).first()).toBeVisible();
  await expect(page.getByRole('button',{name:/Date range:/})).toBeVisible();
  expect(calls.filter(c=>c.start===yesterday&&c.end===yesterday).map(c=>c.mode)).toEqual(['overview']);
 }finally{release();}
});

test('Phase 3 shows independent ratio KPIs, full portfolio and task counts, and unknown target actuals',async({page})=>{
 const {release}=await mock(page,{withOperations:true});
 try{
  await page.goto('/tests/fixtures/dashboard-range.html');
  await expect(gmsTile(page)).toHaveText('₹111');
  const tile=label=>page.locator('.ops-tile').filter({has:page.locator('.ops-tile__label').getByText(label,{exact:true})});
  await expect(tile('TACoS').locator('.ops-tile__value')).toHaveText('10.0%');
  await tile('ROAS').click();
  await expect(page.getByRole('tab',{name:'ROAS',exact:true})).toHaveAttribute('aria-selected','true');
  await expect(page.locator('#ops-tasks')).toContainText('205 workspace instances');
  await expect(page.locator('#ops-tasks')).toContainText('40 overdue');
  await expect(page.locator('#ops-goals')).toContainText('Insufficient coverage');
  await expect(page.locator('#ops-goals')).toContainText('Observed only:');
  release();
  await expect(page.locator('#ops-portfolio')).toContainText('145 / 206');
  await expect(page.locator('#ops-portfolio')).toContainText('Full scoped population');
 }finally{release();}
});
