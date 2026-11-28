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
  if(path.endsWith('/canonical-budget'))return send({asOf:'2026-11-27',rows:empty?[]:[{key:'budget-s1',sellerId:'s1',sellerName:longName,month:'2026-11',marketplace:'amazon.in',currency:'INR',slice:{start:'2026-11-01',through:'2026-11-27',elapsed:27,remaining:3,days:30},coverage:{coveredDays:10,spendRows:'10',rowCount:'30'},budget:{target:'10000',plannedSpend:'9000',actualSpend:'1234',observedUtilizationPct:'12.34',status:'insufficient_coverage',paceStatus:'insufficient_coverage',targetStatus:'configured',planSource:'calendar_linear',targetSource:'MONTHLY',forecastStatus:'insufficient_coverage'},acos:{target:'25',actual:null,status:'insufficient_coverage',targetStatus:'configured'}}]});
  if(path.endsWith('/ads-validation-sellers'))return send([{id:'s1',name:longName,marketplace:'Amazon India',context:{marketplace:'amazon.in',currency:'INR'}}]);
  if(path.endsWith('/ads-imports'))return send({rows:[],page:1,total:0,limit:10});
  return send([]);
 });
 await page.route('**/socket.io/**',route=>route.abort());
};
const goView=async(page,key)=>{await page.getByTestId('ads-view-'+key).click();await expect(page.getByTestId('ads-view-'+key)).toHaveAttribute('aria-current','page');};
async function assertContained(page){
 const bounds=await page.evaluate(()=>{
  const shell=document.querySelector('.routes-container'),root=document.querySelector('.ads-workspace');
  const edge=Math.min(shell.getBoundingClientRect().right,window.innerWidth);
  // Hidden Ant tab panes have no rendered client rectangles. Inspect every
  // rendered shell, while the root and app scroll widths remain unconditional.
  const rects=[root,...root.querySelectorAll(':scope > *, .ads-heading-actions > *, .ads-filters > *, .ads-table-shell')].filter(e=>e.getClientRects().length>0).map(e=>{
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
  await expect(page.getByRole('button',{name:'Import CSV',exact:true})).toBeInViewport();
  await expect(page.getByRole('button',{name:'Export XLSX',exact:true})).toBeInViewport();
  await expect(page.getByRole('button',{name:'Refresh',exact:true})).toBeInViewport();
  await assertContained(page);
  // Assert vertical dimensions, not only horizontal containment. Legacy
  // flex-basis on a column child used to produce a 148px select.
  const filters=page.getByTestId('ads-filters');
  const dims=await filters.evaluate(root=>[...root.querySelectorAll('.ads-filter-field > .ant-select, .ads-filter-field > .ant-picker-range, .ads-search-control > .ant-input-affix-wrapper, .ads-search-control > .ant-btn')].map(e=>({name:e.getAttribute('aria-label')||e.className,height:e.getBoundingClientRect().height,top:e.getBoundingClientRect().top})));
  expect(dims.length).toBeGreaterThanOrEqual(8);
  for(const d of dims){expect(d.height,d.name+' height').toBeGreaterThanOrEqual(28);expect(d.height,d.name+' height').toBeLessThanOrEqual(36);}
  const fields=await filters.locator('.ads-filter-field').evaluateAll(nodes=>nodes.map(e=>e.getBoundingClientRect().height));
  expect(Math.max(...fields)).toBeLessThanOrEqual(76);
  await goView(page,'budgets');
  await expect(page.getByText('No seller targets in the selected period')).toBeVisible();
  await assertContained(page);
 });
}
test('wide tables scroll inside the workspace and preserve the pinned product column',async({page})=>{
 await page.setViewportSize({width:1440,height:900});await mock(page);
 await page.goto('/tests/fixtures/ads-layout.html');
 await goView(page,'products');
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
 await expect(page.getByRole('button',{name:'Import history',exact:true})).toHaveCount(0);
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
 const search=dialog.locator('#ads-history-search');
 await expect(search).toBeVisible();
 await expect(search).toHaveAttribute('aria-label','Search import history');
 await search.fill('preview');await search.press('Enter');
 await expect.poll(()=>lastQuery?.get('search')).toBe('preview');
 await dialog.getByRole('button',{name:'Open',exact:true}).click();
 await expect(dialog.getByText('Waiting for validation worker',{exact:true})).toBeVisible();
 await expect(dialog.getByRole('button',{name:'Confirm import',exact:true})).toHaveCount(0);
 await expect(dialog.getByText(/5 data records scanned/)).toBeVisible();
 await expect(dialog.getByRole('button',{name:'Confirm import',exact:true})).toBeEnabled({timeout:12000});
});

test('new Ads upload has no seller picker and submits automatic ownership CSV',async({page})=>{
 await mock(page,{empty:true});
 let submitted;
 await page.route('**/api/upload/ads-imports',route=>{
  if(route.request().method()!=='POST')return route.fallback();
  submitted=route.request().postData();
  return route.fulfill({status:202,json:{success:true,data:{id:'00000000-0000-4000-8000-000000000007',sellerId:null,status:'PREVIEW_QUEUED',stage:'preview_queued',fileName:'auto.csv',summary:{}}}});
 });
 await page.route('**/api/upload/ads-imports/00000000-0000-4000-8000-000000000007',route=>route.fulfill({json:{success:true,data:{id:'00000000-0000-4000-8000-000000000007',sellerId:null,status:'PREVIEW_QUEUED',stage:'preview_queued',fileName:'auto.csv',summary:{}}}}));
 await page.goto('/tests/fixtures/ads-layout.html');await page.getByRole('button',{name:'Import CSV',exact:true}).click();
 const dialog=page.getByRole('dialog');
 await expect(dialog.getByText('Automatic seller detection',{exact:true})).toBeVisible();
 await expect(dialog.locator('#ads-job-seller')).toHaveCount(0);
 await dialog.locator('input[type=file]').setInputFiles({name:'auto.csv',mimeType:'text/csv',buffer:Buffer.from('asin,date\nB000000001,2026-04-01\n')});
 await dialog.getByRole('button',{name:'Validate CSV',exact:true}).click();
 await expect(dialog.getByText('Waiting for validation worker',{exact:true})).toBeVisible();
 expect(submitted).toContain('name="reportType"');expect(submitted).not.toContain('name="sellerId"');
});

test('Phase 3 comparisons and full-scope review load on demand without page truncation',async({page})=>{
 await page.setViewportSize({width:1440,height:900});await mock(page);
 const comparison={currency:'INR',expectedDays:31,currentDays:31,previousDays:30,metrics:{spend:{status:'incomplete_calendar',unit:'absolute',observedDelta:'15',observedPercentChange:'20'}},ratios:{}};
 await page.route('**/api/ads/canonical-report?*',route=>route.fulfill({json:{success:true,data:{period,empty:false,current:[summary],previous:[summary],comparisons:[comparison],series:[],rows,total:rows.length,page:1,limit:50}}}));
 let requests=0,filters;
 const signalItem={key:'review-1',entityKey:'B000000001',sellerId:'s1',sellerName:longName,currency:'INR',marketplace:'amazon.in',spend:'15',sales:'0',clicks:'25',conversions:'0',evidenceStatus:'observed_partial',currentDays:12,previousDays:null,currentRows:'30',spendRows:'12',salesRows:'12'};
 await page.route('**/api/ads/canonical-insights?*',route=>{
  requests++;filters=new URL(route.request().url()).searchParams;
  return route.fulfill({json:{success:true,data:{empty:false,populations:[{currency:'INR',totalEntities:'1200',currentEntities:'1100',previousEntities:'1000',currentFullCalendar:'900',alignedSpendSales:'700'}],signals:[{currency:'INR',code:'spend_zero_sales',label:'Spend with zero net ad sales',description:'Explicit zero net sales.',action:'Review attribution.',count:'126',sampleCount:1,items:[signalItem]}]}}});
 });
 await page.goto('/tests/fixtures/ads-layout.html');
 const panel=page.getByTestId('ads-comparison-panel');
 await expect(panel.getByText('Observed only',{exact:true})).toBeVisible();
 await goView(page,'opportunities');
 const opportunities=page.getByTestId('ads-opportunities');
 await expect(opportunities.getByRole('button',{name:'Analyze products'})).toBeVisible();
 expect(requests).toBe(0);
 await opportunities.getByRole('button',{name:'Analyze products'}).click();
 await expect(opportunities.getByText('1,200 products reviewed',{exact:true})).toBeVisible();
 await expect(opportunities.getByText('Showing 1 of 126 matches in INR.',{exact:false})).toBeVisible();
 await expect(opportunities.getByText('Partial observation',{exact:true})).toBeVisible();
 expect(filters.get('groupBy')).toBe('asin');expect(filters.has('page')).toBe(false);expect(filters.has('limit')).toBe(false);
 await assertContained(page);
 const open=opportunities.getByRole('button',{name:'B000000001',exact:true});
 await open.click();
 await expect(page.getByRole('dialog').getByText('B000000001 | '+longName,{exact:true})).toBeVisible();
});

test('Phase 3B portfolio analysis exposes full-population counts, segments, aligned trends and scoped breakdowns',async({page})=>{
 await page.setViewportSize({width:1440,height:900});await mock(page);
 const currency='INR',item={key:'portfolio-1',entityKey:'B000000001',sellerId:'s1',sellerName:'Seller One',currency,marketplace:'amazon.in',spend:'20',sales:'80',totalSales:'100',roas:'4',cvr:'10',currentDays:2,expectedDays:2,currentRows:'2',spendRows:'2',salesRows:'2',evidenceStatus:'complete_observed'};
 const concentration={metric:'totalSales',positiveTotal:'10000',netObserved:'9900',positiveEntities:95,leadingCount:22,leadingAmount:'8100',leadingSharePct:'81',remainingCount:73,remainingAmount:'1900',remainingSharePct:'19',zeroEntities:2,negativeEntities:1,unknownEntities:1,priorOnlyEntities:1,partialPositiveEntities:10,samples:[{...item,rank:1,amount:'100',tier:'leading_80',sharePct:'1',cumulativePct:'1',coverage:'complete_observed'}]};
 const group={currency,totalEntities:100,currentEntities:99,concentration:[concentration,{...concentration,metric:'spend'}],reference:{roas:'2.5',eligibleEntities:60,completeObservedEntities:45,spend:'1000',sales:'2500'},segments:[{code:'above_reference',label:'Above weighted ROAS reference',action:'Review efficiency.',count:34,completeObserved:20,observed:{spend:{value:'100',entities:34},sales:{value:'400',entities:34},clicks:{value:'50',entities:34},conversions:{value:'5',entities:34}},compatibleRoas:{value:'4',entities:34},compatibleCvr:{value:'10',entities:34},items:[item]}]};
 const current={currency,coveredDays:2,totals:{totalSales:'100',sales:'80',spend:'20'},coverage:{totalSales:{status:'complete'}},ratios:{roas:{value:'4',status:'complete'}}};
 const previous={...current,totals:{totalSales:'80',sales:'40',spend:'20'}};
 const trend={currency,bucket:'2026-05-01',currentStart:'2026-05-01',currentEnd:'2026-05-02',previousStart:'2026-04-29',previousEnd:'2026-04-30',days:2,current,previous,comparison:{metrics:{totalSales:{status:'comparable',unit:'absolute',delta:'20',percentChange:'25'}},ratios:{}}};
 const breakdown={currency,dimension:'seller',totalGroups:'25',items:[{key:'seller-s1',groupKey:'s1',label:'Seller One',marketplace:'amazon.in',current,previous,comparison:trend.comparison}]};
 let requests=0,lastPortfolio,lastReport;
 await page.route('**/api/ads/canonical-report?*',route=>{
  lastReport=new URL(route.request().url()).searchParams;
  return route.fulfill({json:{success:true,data:{period,empty:false,current:[summary],previous:[summary],series:[],rows,total:rows.length,page:1,limit:50}}});
 });
 await page.route('**/api/ads/canonical-options?*',route=>route.fulfill({json:{success:true,data:{sellers:[{id:'s1',name:'Seller One'}],currencies:['INR'],marketplaces:['amazon.in'],brands:[],categories:[],parentAvailable:true}}}));
 await page.route('**/api/ads/canonical-portfolio?*',route=>{
  requests++;lastPortfolio=new URL(route.request().url()).searchParams;
  return route.fulfill({json:{success:true,data:{empty:false,groups:[group],trends:[trend,{...trend,bucket:'2026-05-03',currentStart:'2026-05-03',currentEnd:'2026-05-03',previousStart:'2026-05-01',previousEnd:'2026-05-01',days:1,current:null,previous:null}],breakdowns:[breakdown,{...breakdown,dimension:'brand',items:[{...breakdown.items[0],key:'brand-a',groupKey:'Brand A',label:'Brand A'}]}]}}});
 });
 await page.goto('/tests/fixtures/ads-layout.html');
 await goView(page,'portfolio');
 const panel=page.getByTestId('ads-portfolio-panel');
 await expect(panel.getByRole('button',{name:'Analyze portfolio'})).toBeVisible();expect(requests).toBe(0);
 await panel.getByRole('button',{name:'Analyze portfolio'}).click();
 await expect(panel.getByText('100 products',{exact:true})).toBeVisible();
 await expect(panel.getByText('81% actual contribution',{exact:true})).toBeVisible();
 await expect(panel.getByText('Top 1 of 95 positive products',{exact:false})).toBeVisible();
 expect(lastPortfolio.get('groupBy')).toBe('asin');expect(lastPortfolio.get('granularity')).toBe('week');
 expect(lastPortfolio.has('page')).toBe(false);expect(lastPortfolio.has('limit')).toBe(false);
 await panel.getByRole('tab',{name:'Efficiency matrix'}).click();
 await expect(panel.getByText('Weighted ROAS reference',{exact:true})).toBeVisible();
 await expect(panel.getByText('34 compatible products',{exact:true}).first()).toBeVisible();
 await panel.getByRole('tab',{name:'Aligned trends'}).click();
 await expect(panel.getByRole('img',{name:/Total sales current and prior aligned trend/})).toBeVisible();
 await expect(panel.getByText('2026-04-29 to 2026-04-30',{exact:true})).toBeVisible();
 const missingBucket=panel.getByRole('row').filter({has:page.getByRole('cell',{name:'2026-05-03',exact:true})});
 await expect(missingBucket).toBeVisible();
 await expect(missingBucket.getByRole('cell',{name:'N/A',exact:true})).toHaveCount(2);
 await panel.locator('#ads-portfolio-trend-granularity').click();
 await page.getByRole('option',{name:'Monthly',exact:true}).click();
 await expect.poll(()=>lastPortfolio?.get('granularity')).toBe('month');
 await expect(panel.getByRole('img',{name:/Total sales current and prior aligned trend/})).toBeVisible();
 await panel.getByRole('tab',{name:'Brand comparison'}).click();
 await expect(panel.getByRole('button',{name:'Brand A',exact:true})).toBeVisible();
 await panel.getByRole('tab',{name:'Seller comparison'}).click();
 await expect(panel.getByText('Showing 1 of 25 seller / marketplace groups',{exact:false})).toBeVisible();
 await assertContained(page);
 await page.setViewportSize({width:1024,height:900});await assertContained(page);
 await panel.getByRole('button',{name:'Seller One',exact:true}).click();
 await expect(panel.getByRole('button',{name:'Analyze portfolio'})).toBeVisible();
 await goView(page,'products');
 await expect.poll(()=>[lastReport?.get('sellerId'),lastReport?.get('marketplace'),lastReport?.get('currency')]).toEqual(['s1','amazon.in','INR']);
});

test('Phase 3C seller budget pacing preserves incomplete coverage, details and scoped filters',async({page})=>{
 await page.setViewportSize({width:1440,height:900});await mock(page);
 const common={sellerId:'s1',sellerName:'Seller One',month:'2026-11',currency:'INR',marketplace:'amazon.in',contextStatus:'verified',slice:{start:'2026-11-01',end:'2026-11-30',through:'2026-11-10',elapsed:10,remaining:20,days:30},coverage:{coveredDays:10,spendDays:10,salesDays:10,rowCount:'10',spendRows:'10',salesRows:'10',pairedRows:'10',negativeSpendRows:'0',negativeSalesRows:'0'}};
 const full={...common,key:'full-budget',budget:{target:'3000',targetSource:'MONTHLY',targetStatus:'configured',status:'comparable',planSource:'configured_weeks',planStatus:'valid',plannedSpend:'1000',actualSpend:'1200',observedUtilizationPct:'40',utilizationPct:'40',observedOverBudget:false,paceStatus:'ahead_of_plan',varianceToPlan:'200',remainingBudget:'1800',projectedMonthEnd:'3600',projectedVariance:'600',remainingDailyAllowance:'90',forecastStatus:'linear_scenario'},acos:{target:'25',actual:'30',coverage:'complete',status:'above_target',targetStatus:'configured',gapPp:'5',targetSource:'YEARLY'}};
 const partial={...common,key:'partial-budget',sellerId:'s2',sellerName:'Seller Two',coverage:{...common.coverage,coveredDays:3,spendRows:'3'},budget:{...full.budget,status:'insufficient_coverage',paceStatus:'insufficient_coverage',utilizationPct:null,remainingBudget:null,projectedMonthEnd:null,projectedVariance:null,varianceToPlan:null,remainingDailyAllowance:null,forecastStatus:'insufficient_coverage'},acos:{...full.acos,status:'insufficient_coverage',coverage:'partial',gapPp:null}};
 let requestParams;
 await page.route('**/api/ads/canonical-budget?*',route=>{
  requestParams=new URL(route.request().url()).searchParams;
  return route.fulfill({json:{success:true,data:{asOf:'2026-11-10',rows:[full,partial]}}});
 });
 await page.goto('/tests/fixtures/ads-layout.html');
 await goView(page,'budgets');
 const panel=page.getByTestId('ads-budget-panel');
 await expect(panel.getByText('Reporting cutoff: 2026-11-10.',{exact:false})).toBeVisible();
 const table=panel.getByTestId('ads-target-table');
 const a=table.locator('tr[data-row-key="full-budget"]'),b=table.locator('tr[data-row-key="partial-budget"]');
 await expect(a.getByText('INR 3,600.00',{exact:true})).toBeVisible();
 await expect(a.getByText('Above planned spend',{exact:true})).toBeVisible();
 await expect(b.getByText('Observed only',{exact:true})).toBeVisible();
 await expect(b.getByText('INR 3,600.00',{exact:true})).toHaveCount(0);
 expect(requestParams.has('brand')).toBe(false);expect(requestParams.has('search')).toBe(false);expect(requestParams.has('marketplace')).toBe(false);
 await assertContained(page);
 await a.getByRole('button',{name:'Budget details Seller One 2026-11'}).click();
 const detail=page.getByRole('dialog');
 await expect(detail.getByText('Configured weekly allocations',{exact:true})).toBeVisible();
 await expect(detail.getByText('INR 90.00',{exact:true})).toBeVisible();
 await expect(detail.getByText('+5 pp',{exact:true})).toBeVisible();
 await detail.locator('.ant-modal-footer').getByRole('button',{name:'Close',exact:true}).click();
 await panel.locator('#ads-budget-filter').click();
 await page.getByRole('option',{name:'ACoS above target',exact:true}).click();
 await expect(a).toBeVisible();await expect(b).toHaveCount(0);
 await page.setViewportSize({width:1024,height:900});await assertContained(page);
});
test('Phase 3C ASIN diagnostics compare against the same owner portfolio and preserve prior gaps',async({page})=>{
 await mock(page);
 const seller={...summary,coveredDays:31,totals:{...summary.totals,spend:'400',sales:'1000',totalSales:'2000'}};
 const product={...summary,coveredDays:20,totals:{...summary.totals,spend:'100',sales:'300',totalSales:'500'}};
 const diag={asin:'B000000001',sellerId:'s1',marketplace:'amazon.in',currency:'INR',referenceScope:'full_seller_same_marketplace_currency',current:{
  product,seller,days:31,shares:{spend:{product:'100',seller:'400',value:'25',status:'observed_partial'},sales:{product:'300',seller:'1000',value:'30',status:'observed_partial'},totalSales:{product:'500',seller:'2000',value:'25',status:'observed_partial'}},
  benchmarks:{acos:{product:'20',seller:'25',delta:null,observedDelta:'-5',unit:'pp',status:'observed_partial'}},
  observations:{daysWithFacts:20,positiveSpendDays:15,zeroNetSalesSpendDays:2,missingSalesSpendDays:1,clicksZeroConversionDays:3,signedAdjustmentDays:0}
 },previous:{product:null,seller,days:31,shares:{},benchmarks:{},observations:null}};
 let identity;
 await page.route('**/api/ads/canonical-report?*',route=>{
  const params=new URL(route.request().url()).searchParams;
  const isDrill=params.has('entityKey');if(isDrill)identity=params;
  return route.fulfill({json:{success:true,data:{period,empty:false,current:[summary],previous:[summary],series:[],rows:isDrill?[]:rows,total:isDrill?0:rows.length,page:1,limit:50,...(isDrill?{diagnostics:diag}:{})}}});
 });
 await page.goto('/tests/fixtures/ads-layout.html');
 await goView(page,'products');
 await page.getByTestId('ads-product-table').getByRole('button',{name:'B000000001',exact:true}).click();
 await page.getByRole('dialog').getByRole('tab',{name:'ASIN diagnostics'}).click();
 const d=page.getByTestId('ads-product-diagnostics');
 await expect(d.getByText('Product share of seller spend',{exact:true})).toBeVisible();
 await expect(d.getByText('-5 pp',{exact:true})).toBeVisible();
 await expect(d.getByText('Spend with missing ad sales',{exact:true})).toBeVisible();
 expect([identity.get('sellerId'),identity.get('marketplace'),identity.get('currency'),identity.get('entityKey')]).toEqual(['s1','amazon.in','INR','B000000001']);
 await d.getByText('Previous',{exact:true}).click();
 await expect(d.getByText('No product records for this period',{exact:true})).toBeVisible();
});

test('Ads numeric display uses grouped currency and integer counts without raw SQL decimals',async({page})=>{
 await mock(page);
 const actual={...summary,totals:{...summary.totals,spend:'7100.0300000000',orders:'11.0000000000',sales:'1234567.1250000000'},ratios:{...summary.ratios,acos:{value:'12.3456000000',status:'complete'}}};
 const formattedRow={...rows[0],current:actual,previous:actual};
 await page.route('**/api/ads/canonical-report?*',route=>route.fulfill({json:{success:true,data:{period,empty:false,current:[actual],previous:[actual],series:[],rows:[formattedRow],total:1,page:1,limit:50}}}));
 await page.goto('/tests/fixtures/ads-layout.html');
 await expect(page.getByText('INR 7,100.03',{exact:true}).first()).toBeVisible();
 await expect(page.getByText('INR 12,34,567.13',{exact:true}).first()).toBeVisible();
 await expect(page.getByText('12.35%',{exact:true}).first()).toBeVisible();
 await goView(page,'products');
 const product=page.getByTestId('ads-product-table').locator('tr[data-row-key="row-0"]');
 await expect(product.getByText('11',{exact:false}).first()).toBeVisible();
 await expect(page.getByText('7100.0300000000',{exact:false})).toHaveCount(0);
 await expect(page.getByText('11.0000000000',{exact:false})).toHaveCount(0);
});

test('Phase 3D reconciliation is on demand, scoped, exact and distinguishes data gaps from failures',async({page})=>{
 await page.setViewportSize({width:1440,height:900});await mock(page);
 let requests=0,params;
 const checks=[{code:'entity_rollup',label:'ASIN aggregation',status:'passed',comparisons:86,mismatchCount:0,mismatches:[]},{code:'source_aliases',label:'Business alias equality',status:'failed',comparisons:3,mismatchCount:1,mismatches:[{currency:'INR',periodKey:'current',field:'totalSalesAliasMismatch',expected:'0.0000000000',actual:'0.0000000001'}]}];
 await page.route('**/api/ads/canonical-reconciliation?*',route=>{
  requests++;params=new URL(route.request().url()).searchParams;
  return route.fulfill({json:{success:true,data:{status:requests===1?'failed':'passed',empty:false,checks:requests===1?checks:[checks[0]],quality:[{currency:'INR',periodKey:'current',rowCount:'1000',missingSpend:'22',zeroSpend:'7',nonAdditiveRevenueRows:'15'}],baseline:[{...summary,periodKey:'current',coveredDays:20,totals:{...summary.totals,spend:'7100.0300000000'}}]}}});
 });
 await page.goto('/tests/fixtures/ads-layout.html');
 await goView(page,'quality');
 const panel=page.getByTestId('ads-reconciliation-panel');
 await expect(panel.getByRole('button',{name:'Run reconciliation'})).toBeVisible();expect(requests).toBe(0);
 await panel.getByRole('button',{name:'Run reconciliation'}).click();
 await expect(panel.getByText('Analytics discrepancies detected',{exact:true})).toBeVisible();
 await expect(panel.getByText('0.0000000001',{exact:true})).toBeVisible();
 expect(params.get('groupBy')).toBe('asin');expect(params.has('page')).toBe(false);expect(params.has('limit')).toBe(false);
 await panel.getByRole('button',{name:'View source details'}).click();
 await expect(panel.getByRole('columnheader',{name:'Ad + organic differs from total sales',exact:true})).toBeVisible();
 await expect(panel.getByText('INR 7,100.03',{exact:true})).toBeVisible();
 await assertContained(page);
 await panel.getByRole('button',{name:'Run again'}).click();
 await expect(panel.getByText('Stored analytics checks passed',{exact:true})).toBeVisible();
 await expect(panel.getByText('Exact mismatch details',{exact:true})).toHaveCount(0);
});

test('Phase 4 overview and focused views keep filter scope and defer heavy requests',async({page})=>{
 await page.setViewportSize({width:1440,height:900});await mock(page);
 const requests=[];
 page.on('request',r=>{if(r.url().includes('/api/ads/canonical-'))requests.push(new URL(r.url()));});
 await page.goto('/tests/fixtures/ads-layout.html');
 const overview=page.getByTestId('ads-overview');
 await expect(overview).toBeVisible();
 await expect(overview.locator('.ads-kpi')).toHaveCount(8);
 await expect(overview.getByTestId('ads-kpi-spend').locator('.ads-kpi-value')).toHaveText('INR 1,23,45,67,89,012.12');
 await expect(page.getByTestId('ads-product-table')).toHaveCount(0);
 await expect(page.getByTestId('ads-budget-panel')).toHaveCount(0);
 await expect(page.getByTestId('ads-reconciliation-panel')).toHaveCount(0);
 expect(requests.some(r=>/canonical-(budget|portfolio|insights|reconciliation)$/.test(r.pathname))).toBe(false);
 await expect(page.getByTestId('ads-overview-trend').getByRole('img',{name:'Ad sales & spend current trend in INR'})).toBeVisible();
 // Granularity changes trigger a new request; chart selections must survive
 // that loading transition, not silently return to the default metric.
 await page.locator('#ads-overview-trend-metric').click();
 await page.getByRole('option',{name:'Total sales',exact:true}).click();
 await page.locator('#ads-overview-trend-granularity').click();
 await page.getByRole('option',{name:'Monthly',exact:true}).click();
 await expect.poll(()=>requests.filter(r=>r.pathname.endsWith('/canonical-report')).at(-1)?.searchParams.get('granularity')).toBe('month');
 await expect(page.getByTestId('ads-overview-trend').locator('.ant-select').first()).toContainText('Total sales');
 // Return to the day view for the remainder of the shared-scope regression.
 await page.locator('#ads-overview-trend-granularity').click();
 await page.getByRole('option',{name:'Daily',exact:true}).click();
 await expect.poll(()=>requests.filter(r=>r.pathname.endsWith('/canonical-report')).at(-1)?.searchParams.get('granularity')).toBe('day');

 await assertContained(page);
 await page.locator('#ads-product-search').fill('B000000001');
 await page.getByRole('button',{name:'Apply',exact:true}).click();
 await expect.poll(()=>requests.filter(r=>r.pathname.endsWith('/canonical-report')).at(-1)?.searchParams.get('search')).toBe('B000000001');
 await goView(page,'opportunities');
 await expect(page.getByTestId('ads-opportunities').getByRole('button',{name:'Analyze products'})).toBeVisible();
 expect(requests.some(r=>r.pathname.endsWith('/canonical-insights'))).toBe(false);
 await goView(page,'portfolio');
 await expect(page.getByTestId('ads-portfolio-panel').getByRole('button',{name:'Analyze portfolio'})).toBeVisible();
 expect(requests.some(r=>r.pathname.endsWith('/canonical-portfolio'))).toBe(false);
 await goView(page,'quality');
 await expect(page.getByTestId('ads-reconciliation-panel').getByRole('button',{name:'Run reconciliation'})).toBeVisible();
 expect(requests.some(r=>r.pathname.endsWith('/canonical-reconciliation'))).toBe(false);
 await goView(page,'budgets');
 await expect(page.getByText('Clear brand, category, marketplace and product search to compare seller-wide targets.')).toBeVisible();
 expect(requests.some(r=>r.pathname.endsWith('/canonical-budget'))).toBe(false);
 await page.getByRole('button',{name:'Clear filters',exact:true}).click();
 await expect.poll(()=>requests.filter(r=>r.pathname.endsWith('/canonical-budget')).length).toBeGreaterThan(0);
 await expect(page.locator('#ads-product-search')).toHaveValue('');
 await goView(page,'overview');
 await expect(overview).toBeVisible();
 await page.setViewportSize({width:768,height:900});await assertContained(page);
});
test('Phase 4 product presets and comparison controls preserve pinned identity and server sorting',async({page})=>{
 await page.setViewportSize({width:1440,height:900});await mock(page);
 let lastReport;
 page.on('request',r=>{if(r.url().includes('/api/ads/canonical-report?'))lastReport=new URL(r.url()).searchParams;});
 await page.goto('/tests/fixtures/ads-layout.html');await goView(page,'products');
 const table=page.getByTestId('ads-product-table');
 await expect(table.getByRole('columnheader',{name:/Ad sales/})).toBeVisible();
 await expect(table.locator('.ads-table-prior').first()).toBeVisible();
 await page.getByText('Current only',{exact:true}).first().click();
 await expect(table.locator('.ads-table-prior')).toHaveCount(0);
 await page.locator('#ads-product-columns').click();
 await page.getByRole('option',{name:'Traffic & conversion',exact:true}).click();
 await expect(table.getByRole('columnheader',{name:/Impressions/})).toBeVisible();
 await expect(table.getByRole('columnheader',{name:/Ad sales/})).toHaveCount(0);
 await expect.poll(()=>lastReport?.get('sortBy')).toBe('clicks');
 await expect(table.getByRole('button',{name:'B000000001',exact:true})).toBeVisible();
 const cell=table.locator('tr[data-row-key="row-0"]').getByTestId('ads-pinned-product');
 const compactPadding=await cell.evaluate(e=>parseFloat(getComputedStyle(e).paddingTop));
 await page.getByText('Comfortable',{exact:true}).click();
 await expect(table).toHaveAttribute('data-density','comfortable');
 await expect.poll(()=>cell.evaluate(e=>parseFloat(getComputedStyle(e).paddingTop))).toBeGreaterThan(compactPadding);
 await assertContained(page);
 await table.getByRole('button',{name:'B000000001',exact:true}).click();
 const drawer=page.getByRole('dialog');
 await expect(drawer.getByRole('tab',{name:'Overview',exact:true})).toBeVisible();
 await drawer.getByRole('tab',{name:'Daily history',exact:true}).click();
 await expect(drawer.getByText('Daily report records',{exact:true})).toBeVisible();
});
test('Phase 4 direct import history opens the saved job list with bounded modal body',async({page})=>{
 await page.setViewportSize({width:1024,height:680});await mock(page,{empty:true});
 let historyRequests=0;
 await page.route('**/api/upload/ads-imports?*',route=>{
  historyRequests++;
  return route.fulfill({json:{success:true,data:{rows:[],page:1,total:0,limit:10}}});
 });
 await page.goto('/tests/fixtures/ads-layout.html');
 await page.getByRole('button',{name:'Import history',exact:true}).click();
 const dialog=page.getByRole('dialog');
 await expect(dialog.getByRole('tab',{name:'Import history',exact:true})).toHaveAttribute('aria-selected','true');
 await expect.poll(()=>historyRequests).toBe(1);
 const body=dialog.locator('.ant-modal-body');
 await expect(body).toBeVisible();
 const bounds=await body.evaluate(e=>({overflow:getComputedStyle(e).overflowY,height:e.getBoundingClientRect().height,viewport:window.innerHeight}));
 expect(bounds.overflow).toBe('auto');expect(bounds.height).toBeLessThanOrEqual(bounds.viewport*.66+2);
 await expect(dialog.locator('.ant-modal-footer').getByRole('button',{name:'Close',exact:true})).toBeVisible();
 await dialog.getByRole('tab',{name:'Upload CSV'}).click();
 await expect(dialog.getByText('Automatic seller detection',{exact:true})).toBeVisible();
 await expect(dialog.getByLabel('Import workflow')).toBeVisible();
});

test('Ads uses the shared GMS report calendar and preserves filters across date changes',async({page})=>{
 await page.setViewportSize({width:1440,height:900});
 await page.clock.setFixedTime(new Date('2026-11-28T12:00:00Z'));
 await mock(page);
 let lastReport,lastBudget;
 page.on('request',r=>{
  const url=new URL(r.url());
  if(url.pathname.endsWith('/canonical-report'))lastReport=url.searchParams;
  if(url.pathname.endsWith('/canonical-budget'))lastBudget=url.searchParams;
 });
 await page.goto('/tests/fixtures/ads-layout.html');
 const start=page.locator('#ads-report-range'),end=page.locator('#ads-report-range-end');
 await expect(start).toBeVisible();await expect(end).toBeVisible();
 await expect(page.getByTestId('ads-filters').locator('.report-date-range-picker')).toHaveCount(1);
 await page.locator('#ads-product-search').fill('B000000001');
 await page.getByRole('button',{name:'Apply',exact:true}).click();
 await expect.poll(()=>lastReport?.get('search')).toBe('B000000001');
 await start.click();
 for(const name of ['Today','Yesterday','Last 7 days','Last 30 days','This month','Previous month']){
  await expect(page.getByText(name,{exact:true})).toBeVisible();
 }
 await expect(page.getByText('Select up to 366 calendar days.',{exact:true})).toBeVisible();
 await page.getByText('Last 7 days',{exact:true}).click();
 await expect(start).toHaveValue('22 Nov 2026');await expect(end).toHaveValue('28 Nov 2026');
 await expect.poll(()=>[lastReport?.get('startDate'),lastReport?.get('endDate'),lastReport?.get('search')]).toEqual(['2026-11-22','2026-11-28','B000000001']);
 await goView(page,'products');
 await expect(start).toHaveValue('22 Nov 2026');
 await end.click();
 await page.getByText('Previous month',{exact:true}).click();
 await expect(start).toHaveValue('01 Oct 2026');await expect(end).toHaveValue('31 Oct 2026');
 await expect.poll(()=>[lastReport?.get('startDate'),lastReport?.get('endDate'),lastReport?.get('search'),lastReport?.get('page')]).toEqual(['2026-10-01','2026-10-31','B000000001','1']);
 await page.getByRole('button',{name:'Clear filters',exact:true}).click();
 await expect(start).toHaveValue('01 Oct 2026');await expect(end).toHaveValue('31 Oct 2026');
 await goView(page,'budgets');
 await expect.poll(()=>[lastBudget?.get('startDate'),lastBudget?.get('endDate')]).toEqual(['2026-10-01','2026-10-31']);
 await page.setViewportSize({width:768,height:900});await assertContained(page);
});

test('Ads export configures independent filters and keeps errors inside the drawer',async({page})=>{
 await mock(page,{empty:true});
 let calls=[];
 await page.route('**/api/ads/canonical-export?*',route=>{
  calls.push(Object.fromEntries(new URL(route.request().url()).searchParams));
  return route.fulfill({status:422,contentType:'application/json',body:JSON.stringify({message:'Export exceeds capacity.'})});
 });
 await page.goto('/tests/fixtures/ads-layout.html');
 await page.getByRole('button',{name:'Export XLSX',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'Export advertising report'});
 await expect(dialog).toBeVisible();
 expect(calls).toHaveLength(0);
 await dialog.getByText('Choose seller and filters',{exact:true}).click();
 await expect(dialog.getByRole('button',{name:'Export complete Excel'})).toBeDisabled();
 await dialog.getByLabel('Export seller',{exact:true}).click();
 await page.getByRole('option',{name:longName,exact:true}).click();
 await dialog.getByLabel('Export product search').fill('B000000001');
 await dialog.getByText('Weekly',{exact:true}).click();
 await dialog.getByRole('button',{name:'Export complete Excel'}).click();
 await expect(dialog.getByText('Export exceeds capacity.')).toBeVisible();
 expect(calls).toHaveLength(1);
 expect(calls[0]).toMatchObject({sellerId:'s1',search:'B000000001',granularity:'week'});
 expect(calls[0]).not.toHaveProperty('page');
 await dialog.getByText('All authorized sellers (no catalog filters)',{exact:true}).click();
 await dialog.getByRole('button',{name:'Export complete Excel'}).click();
 await expect.poll(()=>calls.length).toBe(2);
 expect(calls[1]).not.toHaveProperty('sellerId');
 expect(calls[1]).not.toHaveProperty('search');
 await dialog.getByRole('button',{name:'Cancel',exact:true}).click();
 await expect(dialog).toHaveCount(0);
 await expect(page.getByLabel('Search products',{exact:true})).toHaveValue('');
});
