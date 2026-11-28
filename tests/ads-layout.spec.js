import {test,expect} from '@playwright/test';

const user={Id:'ads-layout-user',_id:'ads-layout-user',role:{name:'super_admin'},permissions:['adsreport_view','adsreport_import','adsreport_export']};
const longName='Seller '+ 'LongCatalogName'.repeat(18);
const period={startDate:'2026-10-29',endDate:'2026-11-28',prevStart:'2026-09-28',prevEnd:'2026-10-28',days:31};
const metricKeys=['spend','sales','totalSales','organicSales','orders','totalOrders','conversions','clicks','impressions'];
const summary={currency:'INR',rowCount:'30',unmappedRows:'0',
 totals:Object.fromEntries(metricKeys.map(k=>[k,'123456789012.1234567890'])),
 coverage:Object.fromEntries(metricKeys.map(k=>[k,{status:'partial'}])),
 ratios:Object.fromEntries(['acos','tacos','roas','cvr'].map(k=>[k,{value:'12.3456',status:'partial'}]))};
const rows=Array.from({length:20},(_,i)=>({key:'row-'+i,entityKey:'B'+String(i+1).padStart(9,'0'),sellerId:'s1',sellerName:longName,marketplace:'amazon.in',currency:'INR',title:'LongProductTitle'.repeat(25),current:summary,previous:summary}));
const mock=async(page,{empty=false,error=false,principal=user}={})=>{
 await page.route('**/api/**',route=>{
  const path=new URL(route.request().url()).pathname;
  const send=(data,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify({success:status===200,data,message:status!==200?'Report unavailable. Retry.':undefined})});
  if(path.endsWith('/auth/me'))return send(principal);
  if(path.endsWith('/canonical-options'))return send({sellers:[{id:'s1',name:longName}],brands:['B'.repeat(230)],categories:['C'.repeat(240)],currencies:['INR'],truncated:true,parentAvailable:true});
  if(path.endsWith('/canonical-report'))return error?send(null,503):send({period,empty,current:empty?[]:[summary],previous:empty?[]:[summary],series:empty?[]:[{...summary,periodKey:'current',bucket:'2026-11-01'}],rows:empty?[]:rows,total:empty?0:rows.length,page:1,limit:50});
  if(path.endsWith('/canonical-targets'))return send({rows:empty?[]:[{sellerId:'s1',sellerName:longName,month:'2026-11',goalType:'ADS',currency:'INR',target:'10000',actual:'1234',attainmentPct:'12.34',status:'insufficient_coverage'}]});
  if(path.endsWith('/ads-validation-sellers'))return send([{id:'s1',name:longName,marketplace:'Amazon India',context:{marketplace:'amazon.in',currency:'INR'}}]);
  if(path.endsWith('/ads-imports'))return send({rows:[],page:1,total:0,limit:10});
  return send([]);
 });
 await page.route('**/socket.io/**',route=>route.abort());
};
async function assertContained(page){
 const bounds=await page.evaluate(()=>{
  const shell=document.querySelector('.routes-container'),root=document.querySelector('.ads-workspace');
  const edge=Math.min(shell.getBoundingClientRect().right,window.innerWidth);
  const rects=[root,...root.querySelectorAll(':scope > *, .ads-heading-actions > *, .ads-filters > *, .ads-table-shell')].map(e=>{
   const r=e.getBoundingClientRect();return {name:e.className?.toString().slice(0,90),right:r.right,left:r.left};
  });
  return {edge,left:shell.getBoundingClientRect().left,rootWidth:root.clientWidth,rootScrollWidth:root.scrollWidth,shellWidth:shell.clientWidth,shellScrollWidth:shell.scrollWidth,rects};
 });
 expect(bounds.rootScrollWidth).toBeLessThanOrEqual(bounds.rootWidth+2);
 expect(bounds.shellScrollWidth).toBeLessThanOrEqual(bounds.shellWidth+2);
 for(const r of bounds.rects){expect(r.right,r.name+' right edge').toBeLessThanOrEqual(bounds.edge+2);expect(r.left,r.name+' left edge').toBeGreaterThanOrEqual(bounds.left-2);}
}
for(const width of [1920,1440,1024,768]){
 test('empty report and filters fit the shell at '+width+'px',async({page})=>{
  await page.setViewportSize({width,height:900});await mock(page,{empty:true});
  await page.goto('/tests/fixtures/ads-layout.html');
  await expect(page.getByText('No canonical advertising records in the selected dates.')).toBeVisible();
  await expect(page.getByText('No seller targets in the selected period')).toBeVisible();
  await expect(page.getByRole('button',{name:'Import CSV',exact:true})).toBeInViewport();
  await expect(page.getByRole('button',{name:'Export XLSX',exact:true})).toBeInViewport();
  await expect(page.getByRole('button',{name:'Refresh',exact:true})).toBeInViewport();
  await assertContained(page);
 });
}
test('wide tables scroll inside the workspace and preserve the pinned product column',async({page})=>{
 await page.setViewportSize({width:1440,height:900});await mock(page);
 await page.goto('/tests/fixtures/ads-layout.html');
 const table=page.getByTestId('ads-product-table');
 await expect(table.getByRole('button',{name:'B000000001',exact:true})).toBeVisible();
 await assertContained(page);
 const body=table.locator('.ant-table-body');
 // Ant inserts a hidden measurement row ahead of actual data rows.
 const pin=body.locator('tr[data-row-key="row-0"]').getByTestId('ads-pinned-product');
 await expect(pin).toBeVisible();
 const before=await pin.evaluate(e=>e.getBoundingClientRect().left);
 const sizes=await body.evaluate(e=>{const result={width:e.clientWidth,scrollWidth:e.scrollWidth};e.scrollLeft=600;return {...result,scrollLeft:e.scrollLeft};});
 expect(sizes.scrollWidth).toBeGreaterThan(sizes.width+300);expect(sizes.scrollLeft).toBeGreaterThan(0);
 await expect.poll(()=>pin.evaluate(e=>e.getBoundingClientRect().left)).toBeCloseTo(before,0);
 await expect(page.getByRole('button',{name:'Import CSV',exact:true})).toBeInViewport();
 await assertContained(page);
 // Resizing the application must not make the report width follow its content.
 await page.setViewportSize({width:1024,height:900});await assertContained(page);
});
test('error state stays inside the workspace and exposes retry',async({page})=>{
 await page.setViewportSize({width:1024,height:768});await mock(page,{error:true});
 await page.goto('/tests/fixtures/ads-layout.html');
 await expect(page.getByText('Report unavailable. Retry.')).toBeVisible();
 await expect(page.getByRole('button',{name:'Retry',exact:true})).toBeVisible();
 await assertContained(page);
});

test('Ads actions follow effective permissions rather than global role labels',async({page})=>{
 await mock(page,{empty:true,principal:{...user,role:{name:'operational_manager'},permissions:['adsreport_view']}});
 await page.goto('/tests/fixtures/ads-layout.html');
 await expect(page.getByText('No canonical advertising records in the selected dates.')).toBeVisible();
 await expect(page.getByRole('button',{name:'Import CSV',exact:true})).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Import a report',exact:true})).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Export XLSX',exact:true})).toHaveCount(0);
});
test('wildcard administrators retain Ads actions',async({page})=>{
 await mock(page,{empty:true,principal:{...user,permissions:['*']}});
 await page.goto('/tests/fixtures/ads-layout.html');
 await expect(page.getByRole('button',{name:'Import CSV',exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'Export XLSX',exact:true})).toBeVisible();
});

test('confirmation sends valid JSON and reconciles a lost response from job history',async({page})=>{
 const id='00000000-0000-4000-8000-000000000001';
 const ready={id,sellerId:'s1',marketplace:'amazon.in',currency:'INR',fileName:'report.csv',status:'READY',importsEnabled:true,
  summary:{rows:1,validRows:1,invalidRows:0,issueCount:0,startDate:'2026-11-01',endDate:'2026-11-01'},createdAt:'2026-11-28T00:00:00Z',expiresAt:'2026-11-29T00:00:00Z'};
 let confirmed=false,posts=0,body;
 const result={sellerId:'s1',currency:'INR',inserted:1,unchanged:0,startDate:'2026-11-01',endDate:'2026-11-01',persisted:true};
 await mock(page,{empty:true});
 await page.route('**/api/upload/ads-imports?*',route=>route.fulfill({json:{success:true,data:{rows:[ready],total:1,page:1,limit:10}}}));
 await page.route('**/api/upload/ads-imports/'+id,route=>route.fulfill({json:{success:true,data:confirmed?{...ready,status:'COMPLETED',result}:ready}}));
 await page.route('**/api/upload/ads-imports/'+id+'/confirm',route=>{
  posts++;body=route.request().postDataJSON();confirmed=true;
  return route.fulfill({status:502,contentType:'text/html',body:'Bad Gateway'});
 });
 await page.goto('/tests/fixtures/ads-layout.html');
 await page.getByRole('button',{name:'Import CSV',exact:true}).click();
 const dialog=page.getByRole('dialog');
 await dialog.getByRole('tab',{name:'Import history'}).click();
 await dialog.getByRole('button',{name:'Open',exact:true}).click();
 await dialog.getByRole('button',{name:'Confirm import',exact:true}).click();
 await expect(dialog.getByText('1 inserted · 0 unchanged')).toBeVisible();
 expect(posts).toBe(1);expect(body).toEqual({});
});
test('session restore retries a transient 502',async({page})=>{
 await mock(page,{empty:true});
 let calls=0;
 await page.route('**/api/auth/me',route=>{
  calls++;
  if(calls===1)return route.fulfill({status:502,contentType:'text/html',body:'Bad Gateway'});
  return route.fulfill({json:{success:true,data:user}});
 });
 await page.goto('/tests/fixtures/ads-layout.html');
 await expect(page.getByRole('button',{name:'Import CSV',exact:true})).toBeVisible();
 expect(calls).toBe(2);
});

test('confirmed import queues immediately and polls real stage progress',async({page})=>{
 const id='00000000-0000-4000-8000-000000000002';
 const ready={id,sellerId:'s1',marketplace:'amazon.in',currency:'INR',fileName:'queued.csv',status:'READY',importsEnabled:true,
  summary:{rows:10,validRows:10,invalidRows:0,issueCount:0,startDate:'2026-11-01',endDate:'2026-11-01'}};
 const result={sellerId:'s1',currency:'INR',inserted:10,unchanged:0,startDate:'2026-11-01',endDate:'2026-11-01',persisted:true};
 let queued=false,polls=0,posts=0;
 await mock(page,{empty:true});
 await page.route('**/api/upload/ads-imports?*',route=>route.fulfill({json:{success:true,data:{rows:[ready],total:1,page:1,limit:10}}}));
 await page.route('**/api/upload/ads-imports/'+id,route=>{
  const job=!queued?ready:++polls===1?{...ready,status:'PROCESSING',stage:'staging',attemptCount:1,stagedRows:5}:{...ready,status:'COMPLETED',stage:'completed',attemptCount:1,stagedRows:10,result};
  return route.fulfill({json:{success:true,data:job}});
 });
 await page.route('**/api/upload/ads-imports/'+id+'/confirm',route=>{
  posts++;queued=true;return route.fulfill({status:202,json:{success:true,data:{...ready,status:'QUEUED',stage:'queued',attemptCount:0,stagedRows:0}}});
 });
 await page.goto('/tests/fixtures/ads-layout.html');
 await page.getByRole('button',{name:'Import CSV',exact:true}).click();
 const dialog=page.getByRole('dialog');
 await dialog.getByRole('tab',{name:'Import history'}).click();
 await dialog.getByRole('button',{name:'Open',exact:true}).click();
 await dialog.getByRole('button',{name:'Confirm import',exact:true}).click();
 await expect(dialog.getByText('Waiting for worker',{exact:true})).toBeVisible();
 // Ant renders both a title-bar close control and a footer Close button.
 await expect(dialog.locator('.ant-modal-footer').getByRole('button',{name:'Close',exact:true})).toBeEnabled();
 await expect(dialog.getByText('50% staged',{exact:true})).toBeVisible();
 await expect(dialog.getByText('10 inserted · 0 unchanged')).toBeVisible({timeout:12000});
 expect(posts).toBe(1);
});

test('background validation can be reopened and becomes ready without reupload',async({page})=>{
 const id='00000000-0000-4000-8000-000000000003';
 const queued={id,sellerId:'s1',marketplace:'amazon.in',currency:'INR',fileName:'preview.csv',status:'PREVIEW_QUEUED',stage:'preview_queued',importsEnabled:true,summary:{valid:null,rows:null,validRows:null,issueCount:null}};
 const ready={...queued,status:'READY',stage:'ready',summary:{valid:true,rows:12,validRows:12,invalidRows:0,issueCount:0}};
 let reads=0,lastQuery;
 await mock(page,{empty:true});
 await page.route('**/api/upload/ads-imports?*',route=>{lastQuery=new URL(route.request().url()).searchParams;return route.fulfill({json:{success:true,data:{rows:[queued],total:1,page:1,limit:10}}});});
 await page.route('**/api/upload/ads-imports/'+id,route=>route.fulfill({json:{success:true,data:++reads===1?queued:reads===2?{...queued,status:'VALIDATING',stage:'preview_scanning',stagedRows:5,attemptCount:1}:ready}}));
 await page.goto('/tests/fixtures/ads-layout.html');
 await page.getByRole('button',{name:'Import CSV',exact:true}).click();
 const dialog=page.getByRole('dialog');
 await dialog.getByRole('tab',{name:'Import history'}).click();
 const search=dialog.getByRole('textbox',{name:'Search import history'});
 await search.fill('preview');await search.press('Enter');
 await expect.poll(()=>lastQuery?.get('search')).toBe('preview');
 await dialog.getByRole('button',{name:'Open',exact:true}).click();
 await expect(dialog.getByText('Waiting for validation worker',{exact:true})).toBeVisible();
 await expect(dialog.getByRole('button',{name:'Confirm import',exact:true})).toHaveCount(0);
 await expect(dialog.getByText(/5 data records scanned/)).toBeVisible();
 await expect(dialog.getByRole('button',{name:'Confirm import',exact:true})).toBeEnabled({timeout:12000});
});
