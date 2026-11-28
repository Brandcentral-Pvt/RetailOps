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
 return products?{scope,period,tableData,gmsRevenue:revenue}:{scope,period,productsIncluded:false,kpi:[],tableData:[],stats:{totalSellers:1,totalAsins:1,activeAsins:1},labels:[],gms:{revenue,units:1,series:[],unitsSeries:[],coverage:{complete:true,observedDays:days,expectedDays:days},dailyAverage:revenue,asinsWithSales:1},ads:{},previous:{},gmsBySeller:[],gmsByMarketplace:[],category:[]};
}
async function mock(page,{failYesterday=false}={}){
 const calls=[];let release;
 const firstProducts=new Promise(r=>{release=r;});
 const yesterday=await page.evaluate(()=>{const d=new Date();d.setDate(d.getDate()-1);return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');});
 await page.route('**/socket.io/**',r=>r.abort());
 await page.route('**/api/**',async route=>{
  const u=new URL(route.request().url()),path=u.pathname;
  const send=(body,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
  if(path.endsWith('/auth/me'))return send({success:true,data:user});
  if(path.endsWith('/dashboard/options'))return send({success:true,data:{sellers:[{id:'s1',name:'Seller'}],managers:[]}});
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
