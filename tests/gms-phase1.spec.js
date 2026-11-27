import { test, expect } from '@playwright/test';

const user = { Id: 'u-test', id: 'u-test', firstName: 'Test', role: { name: 'admin' }, scope: 'global', permissions: ['*'] };

async function setup(page, nonempty=false, {historyCount=0,issueCount=1,wideMatrix=false}={}) {
  let reads = 0, uploads = 0, commits = 0, fail = false, reject = false, status = 'READY', lastRequest=null, lastExport=null;
  const batch = () => ({ id:'batch1',fileName:'report.csv',status,createdAt:'2026-11-27T10:00:00Z',summary:{total:1,inserted:1,updated:0,unchanged:0,duplicates:0,invalid:reject?1:0,issues:reject?[{row:2,asin:'B000000001',date:'2026-11-27',column:'Ordered Revenue',code:'INVALID_ROW',message:'Invalid monetary value',remarks:'Enter a valid amount in Ordered Revenue, such as 1250.50 or -250.00.'}]:[],reportIssueCount:reject?1:0,reportComplete:true,sample:[],committed:status==='COMPLETED'?1:0} });
  const historyFixture=Array.from({length:historyCount},(_,i)=>({
    ...batch(),id:i===0?'batch1':'history-'+i,fileName:'report-history-'+String(i+1).padStart(2,'0')+'.xlsx',
    status:i===0?'READY':i%3===0?'REJECTED':'COMPLETED',
    createdAt:'2026-11-27T10:00:00Z',summary:{...batch().summary,total:1052+i}
  }));
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname;
    const send = (data, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });
    if (path.endsWith('/auth/me')) return send({ success: true, data: user });
    if (path.endsWith('/upload/gms-analytics')) {
      reads++;
      lastRequest=route.request().postDataJSON();
      const currentPage=lastRequest.page||1, pageSize=lastRequest.pageSize||50;
      const currentAsin='B'+String((currentPage-1)*pageSize+1).padStart(9,'0');
      const data=nonempty?{
        matrixRows:[{key:currentAsin,asin:currentAsin,dbBrand:'-',brand:'Sheet Brand',storeCode:'IN',isUnmatched:true,orderedUnits:2,orderedRevenue:0,shippedRevenue:-10,shippedCOGS:5,shippedUnits:1,customerReturns:0,profit:-15,marginPct:null,returnRatio:0,periodBaseline:null,periodChanges:{orderedRevenue:null},periodCoverage:{currentDays:1,priorDays:0,expectedDays:31,comparable:false},productTitle:'Example product',dailyRev:{'2026-11-27':0},weeklyRev:{'2026-11|2026-W48':0},monthlyRev:{'2026-11':0},_momTrends:{},_wowTrends:{},_dodTrends:{}}],
        monthGroups:{'2026-11':{key:'2026-11',label:'November 2026',weeks:{'2026-11|2026-W48':{key:'2026-11|2026-W48',label:'Week 48 (27 Nov - 27 Nov)',days:['2026-11-27']}}}},
        kpis:{orderedRevenue:0,orderedUnits:2,shippedRevenue:-10,shippedCOGS:5,shippedUnits:1,customerReturns:0,profit:-15,marginPct:null,returnRatio:0},
        comparison:{window:{from:'2026-09-27',to:'2026-10-27',days:31},changes:{orderedRevenue:null,returnRatio:null},currentCoverage:{observedDays:1,expectedDays:31,complete:false},previousCoverage:{observedDays:0,complete:false}},selectedWindow:{from:'2026-10-28',to:'2026-11-27'},
        daily:[{date:'2026-11-27',orderedRevenue:0,shippedRevenue:-10,shippedCOGS:5,shippedUnits:1,orderedUnits:2,customerReturns:0,profit:-15,marginPct:null,returnRatio:0}],meta:{records:101,asins:101,sellers:0,unmatchedRecords:101,last:'2026-11-27'},pagination:{page:currentPage,pageSize,totalRows:101}
      }:{matrixRows:[],monthGroups:{},kpis:{},comparison:{window:null},daily:[],meta:{records:0,asins:0,sellers:0,unmatchedRecords:0,last:null},pagination:{page:1,pageSize,totalRows:0}};
      if(nonempty&&wideMatrix){
        const days=['2026-11-23','2026-11-24','2026-11-25','2026-11-26','2026-11-27'];
        const base=data.matrixRows[0];
        data.matrixRows=Array.from({length:Math.min(pageSize,101-(currentPage-1)*pageSize)},(_,i)=>{
          const n=(currentPage-1)*pageSize+i+1;
          const asin='B'+String(n).padStart(9,'0');
          const sellerId='seller-'+n;
          const seller=lastRequest.level==='seller';
          return {...base,key:seller?'seller:'+sellerId:asin,asin:seller?'-':asin,sellerId,dbBrand:'Seller '+n,
            isUnmatched:false,productTitle:'Long product title '+n+' for scroll testing',brand:'Sheet Brand',
            orderedRevenue:n*500,dailyRev:Object.fromEntries(days.map(day=>[day,n*100])),
            weeklyRev:{'2026-11|2026-W48':n*500},monthlyRev:{'2026-11':n*500},
            _dodTrends:Object.fromEntries(days.map(day=>[day,0]))};
        });
        data.monthGroups['2026-11'].weeks['2026-11|2026-W48']={key:'2026-11|2026-W48',label:'Week 48 (23 Nov - 27 Nov)',days};
      }
      return fail ? send({ success:false,message:'Failed' },500) : send({success:true,data});
    }
    if(path.endsWith('/export/start-gms')){lastExport=route.request().postDataJSON();return send({success:true,downloadId:'test-export',fileName:'gms.xlsx'});}
    if (path.endsWith('/upload/gms-imports') && route.request().method()==='GET') return send({success:true,data:historyFixture});
    if (path.endsWith('/upload/gms-imports') && route.request().method()==='POST') {
      uploads++;
      status=reject?'REJECTED':'READY';
      const result=batch();
      if(reject&&issueCount>1){result.summary.invalid=issueCount;result.summary.reportIssueCount=issueCount;result.summary.issues=Array.from({length:issueCount},(_,i)=>({...result.summary.issues[0],row:i+2,asin:'B'+String(i+1).padStart(9,'0')}));}
      return send({success:true,data:result},201);
    }
    if (path.endsWith('/upload/gms-imports/batch1/errors')) {
      const format=new URL(route.request().url()).searchParams.get('format');
      return route.fulfill({status:200,headers:{'content-type':format==='csv'?'text/csv':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','content-disposition':'attachment; filename="report_error_report.'+format+'"'},body:'Excel Row,ASIN,Remarks\n2,B000000001,Enter a valid amount'});
    }
    if (path.endsWith('/upload/gms-imports/batch1/confirm')) {
      commits++;
      status='QUEUED';
      return send({success:true,data:batch()},202);
    }
    if (path.endsWith('/upload/gms-imports/batch1')) {
      if (status==='QUEUED') status='COMPLETED';
      return send({success:true,data:batch()});
    }
    if (path.endsWith('/sellers')) return send({ success: true, data: { sellers: [] } });
    return send({ success: true, data: [] });
  });
  await page.goto('/tests/fixtures/gms-phase1.html');
  await expect(nonempty?page.getByLabel('Key performance indicators',{exact:true}):page.getByText('No GMS records in this selection')).toBeVisible({ timeout:15000 });
  return { reads: () => reads, lastRequest:()=>lastRequest,lastExport:()=>lastExport, uploads: () => uploads, commits: () => commits, setFailure: () => { fail = true; }, reject: () => { reject = true; } };
}

test('manual refresh works after initial load and failures do not show zero KPIs', async ({ page }) => {
  const state = await setup(page);
  const initial = state.reads();
  await page.getByRole('button', { name: 'Refresh data' }).click();
  await expect.poll(state.reads).toBeGreaterThan(initial);
  await expect(page.getByText('No GMS records in this selection')).toBeVisible();
  state.setFailure();
  await page.getByRole('button', { name: 'Refresh data' }).click();
  await expect(page.getByText('Sync failed', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Key performance indicators', { exact: true })).toHaveCount(0);
  await expect(page.getByText('No GMS records in this selection')).toHaveCount(0);
});

test('selection does not upload automatically; preview must precede explicit commit', async ({ page }) => {
  const state = await setup(page);
  await page.getByRole('button', { name: 'Upload Data' }).click();
  await page.locator('input[type=file]').setInputFiles({
    name: 'report.csv', mimeType: 'text/csv',
    buffer: Buffer.from('ASIN,Date,Brand,StoreCode,Ordered Revenue,Ordered Units,Shipped Revenue,Shipped COGS,Shipped Units,Customer Returns\nB000000001,2026-11-27,Brand A,IN,100,1,100,50,1,0')
  });
  await expect(page.getByRole('button', { name: 'Validate report' })).toBeEnabled();
  expect(state.uploads()).toBe(0);
  await page.getByRole('button', { name: 'Validate report' }).click();
  await expect(page.getByText('Validation passed', { exact: true })).toBeVisible();
  expect(state.uploads()).toBe(1);
  expect(state.commits()).toBe(0);
  const initial=state.reads();
  await page.getByRole('button', { name: 'Confirm import' }).click();
  await expect(page.getByText('Import completed', { exact: true })).toBeVisible();
  await expect.poll(state.commits).toBe(1);
  await expect.poll(state.reads).toBeGreaterThan(initial);
  await expect(page.getByText('Import completed', { exact: true })).toBeVisible();
});

test('invalid preview displays issues and cannot be confirmed', async ({page}) => {
  const state=await setup(page);
  state.reject();
  await page.getByRole('button',{name:'Upload Data'}).click();
  await page.locator('input[type=file]').setInputFiles({name:'invalid.csv',mimeType:'text/csv',buffer:Buffer.from('ASIN,Date\nB000000001,2026-11-27')});
  await page.getByRole('button',{name:'Validate report'}).click();
  await expect(page.getByText('Report rejected',{exact:true})).toBeVisible();
  await expect(page.getByText('Enter a valid amount in Ordered Revenue, such as 1250.50 or -250.00.',{exact:true})).toBeVisible();
  await expect(page.getByText('B000000001',{exact:true})).toBeVisible();
  await expect(page.getByText('INVALID_ROW',{exact:true})).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Download Excel error report',exact:true})).toBeVisible();
  const downloadPromise=page.waitForEvent('download');
  await page.getByRole('button',{name:'Download CSV error report',exact:true}).click();
  const download=await downloadPromise;
  expect(download.suggestedFilename()).toBe('report_error_report.csv');
  await expect(page.getByRole('button',{name:'Confirm import'})).toHaveCount(0);
  expect(state.commits()).toBe(0);
});

 test('server matrix shows actual zero and unmatched brand while ratios remain unavailable', async ({page}) => {
  await setup(page,true);
  await expect(page.getByText('B000000001',{exact:true})).toBeVisible();
  await expect(page.getByText('Sheet Brand',{exact:true})).toBeVisible();
  await expect(page.getByText('Margin unavailable',{exact:true})).toBeVisible();
  await expect(page.getByText('₹0.00',{exact:true}).first()).toBeVisible();
});

test('matrix pagination requests the next server page and sorts the full result', async ({page})=>{
  const state=await setup(page,true);
  await expect(page.getByText('B000000001',{exact:true})).toBeVisible();
  await page.locator('.ant-pagination-next').click();
  await expect.poll(()=>state.lastRequest()?.page).toBe(2);
  await expect(page.getByText('B000000051',{exact:true})).toBeVisible();
  await expect(page.getByText('B000000001',{exact:true})).toHaveCount(0);
  await expect(page.getByLabel('Key performance indicators',{exact:true})).toBeVisible();
  await page.getByRole('columnheader',{name:'ASIN',exact:true}).click();
  await expect.poll(()=>state.lastRequest()?.sort?.key).toBe('asin');
  await expect.poll(()=>state.lastRequest()?.page).toBe(1);
  await expect(page.getByText('B000000001',{exact:true})).toBeVisible();
});

test('metric focus and matrix granularity are presentation-only',async({page})=>{
  const state=await setup(page,true);
  const reads=state.reads();
  await page.getByRole('button',{name:'Show Shipped Revenue trend'}).click();
  await expect(page.getByLabel('Chart metric')).toBeVisible();
  await expect(page.getByText('Only one observed reporting day',{exact:true})).toBeVisible();
  await expect(page.locator('.gms-trend-chart')).toHaveCount(0);
  await page.getByRole('tab',{name:'Revenue matrix',exact:true}).click();
  await page.getByRole('radiogroup',{name:'Matrix granularity'}).getByText('Daily',{exact:true}).click();
  await expect(page.getByRole('combobox',{name:'Matrix month',exact:true})).toBeVisible();
  await expect(page.getByRole('columnheader',{name:'27 Nov',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Hide comparisons'}).click();
  await expect(page.getByRole('columnheader',{name:'DoD',exact:true})).toHaveCount(0);
  expect(state.reads()).toBe(reads);
});
test('complete export drawer sends full-report parameters rather than matrix pagination',async({page})=>{
  const state=await setup(page,true);
  await page.getByRole('button',{name:'Export',exact:true}).click();
  const drawer=page.getByRole('dialog',{name:'Export GMS report'});
  await expect(drawer.getByText('Complete financial workbook',{exact:true})).toBeVisible();
  await drawer.getByRole('radio',{name:'Custom dates',exact:true}).check();
  await drawer.getByRole('button',{name:'Export complete Excel',exact:true}).click();
  await expect(drawer.getByText('Select a start and end date')).toBeVisible();
  expect(state.lastExport()).toBeNull();
  await drawer.getByRole('radio',{name:/Current report range/}).check();
  await drawer.getByRole('radio',{name:'CSV: complete daily data',exact:true}).check();
  await expect(drawer.getByText('Complete daily records',{exact:true})).toBeVisible();
  await drawer.getByRole('button',{name:'Export complete CSV',exact:true}).click();
  await expect.poll(()=>state.lastExport()?.exportFileType).toBe('csv');
  expect(state.lastExport()).not.toHaveProperty('page');
  expect(state.lastExport()).not.toHaveProperty('pageSize');
  expect(state.lastExport()).toMatchObject({exportDateType:'current',exportBrandType:'current',sellerIds:null,search:''});
});
test('import history opens directly and template download retains canonical headings',async({page})=>{
  await setup(page);
  await page.getByRole('button',{name:'Import history',exact:true}).click();
  const modal=page.getByRole('dialog',{name:'GMS Report Import'});
  await expect(modal.getByRole('tab',{name:'My import history'})).toHaveAttribute('aria-selected','true');
  await modal.getByRole('tab',{name:'Import report'}).click();
  const downloadPromise=page.waitForEvent('download');
  await modal.getByRole('button',{name:'Download import template',exact:true}).click();
  expect((await downloadPromise).suggestedFilename()).toBe('GMS_Import_Template.csv');
});
test('mobile report layout keeps horizontal scrolling inside the matrix',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await setup(page,true);
  await expect(page.getByRole('button',{name:'Upload Data'})).toBeVisible();
  const layout=await page.locator('.gms-workspace').evaluate(el=>({width:el.clientWidth,scroll:el.scrollWidth}));
  expect(layout.scroll).toBeLessThanOrEqual(layout.width+2);
  await expect(page.getByText('B000000001',{exact:true})).toBeVisible();
});

test('row detail contains the same server-sourced financial metrics and missing prior values',async({page})=>{
  await setup(page,true);
  await expect(page.getByRole('tab',{name:'Revenue matrix',exact:true})).toHaveAttribute('aria-selected','true');
  await page.getByRole('button',{name:'View ASIN B000000001 details',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'ASIN financial details'});
  await expect(dialog.getByText('Example product',{exact:true})).toBeVisible();
  const row=dialog.getByRole('row').filter({has:page.getByRole('rowheader',{name:'Gross Profit',exact:true})});
  await expect(row).toContainText('-₹15.00');
  await expect(row).toContainText('N/A');
});

test('latest observed reporting date is an explicit date-range action',async({page})=>{
  const state=await setup(page,true);
  await expect(page.getByText('1/31 reporting days available',{exact:false})).toBeVisible();
  await page.getByRole('button',{name:'View 27 Nov only',exact:true}).click();
  await expect.poll(()=>state.lastRequest()?.startDate).toBe('2026-11-27');
  expect(state.lastRequest().endDate).toBe('2026-11-27');
});

async function modalGeometry(modal){
  return modal.evaluate(el=>{
    const bounds=node=>{const r=node.getBoundingClientRect();return {top:r.top,bottom:r.bottom,left:r.left,right:r.right,height:r.height};};
    const shell=el.querySelector('.ant-modal-container,.ant-modal-content');
    const content=el.querySelector('.ant-tabs-tabpane-active .gms-import-scroll');
    return {
      shell:bounds(shell),header:bounds(el.querySelector('.ant-modal-header')),
      tabs:bounds(el.querySelector('.ant-tabs-nav')),footer:bounds(el.querySelector('.ant-modal-footer')),
      scroll:{client:content.clientHeight,height:content.scrollHeight,top:content.scrollTop},
      viewport:{width:window.innerWidth,height:window.innerHeight},
      wrapScroll:el.closest('.ant-modal-wrap').scrollTop
    };
  });
}
function expectContained(g){
  expect(g.shell.top).toBeGreaterThanOrEqual(0);
  expect(g.shell.bottom).toBeLessThanOrEqual(g.viewport.height+1);
  expect(g.shell.left).toBeGreaterThanOrEqual(0);
  expect(g.shell.right).toBeLessThanOrEqual(g.viewport.width+1);
  expect(g.footer.bottom).toBeLessThanOrEqual(g.shell.bottom+1);
  expect(g.header.top).toBeGreaterThanOrEqual(g.shell.top-1);
  expect(g.wrapScroll).toBe(0);
}
test('import modal remains fixed while history and validation content scroll',async({page})=>{
  await page.setViewportSize({width:1280,height:620});
  const state=await setup(page,false,{historyCount:23});
  await page.getByRole('button',{name:'Import history',exact:true}).click();
  const modal=page.getByRole('dialog',{name:'GMS Report Import'});
  const history=modal.getByRole('region',{name:'Import history content'});
  await expect(history.getByText('report-history-01.xlsx',{exact:true})).toBeVisible();
  await expect(history.getByText('1-10 of 23 batches',{exact:true})).toBeVisible();
  // Wait for the modal entrance animation before measuring layout.
  await expect.poll(async()=>{const g=await modalGeometry(modal);return g.shell.top>=0&&g.shell.bottom<=g.viewport.height+1;}).toBe(true);
  const first=await modalGeometry(modal);
  expectContained(first);
  expect(first.scroll.height).toBeGreaterThan(first.scroll.client);
  await history.evaluate(el=>{el.scrollTop=el.scrollHeight;});
  await expect.poll(async()=>(await modalGeometry(modal)).scroll.top).toBeGreaterThan(0);
  const scrolled=await modalGeometry(modal);
  expectContained(scrolled);
  expect(Math.abs(scrolled.header.top-first.header.top)).toBeLessThan(2);
  expect(Math.abs(scrolled.tabs.top-first.tabs.top)).toBeLessThan(2);
  expect(Math.abs(scrolled.footer.bottom-first.footer.bottom)).toBeLessThan(2);
  await expect(modal.getByRole('button',{name:'Close',exact:true}).last()).toBeInViewport();
  await history.evaluate(el=>{el.scrollTop=0;});
  await history.getByRole('button',{name:/View import report-history-01.xlsx/}).click();
  await expect(modal.getByText('Validation passed',{exact:true})).toBeVisible();
  await expect(modal.getByRole('button',{name:'Confirm import',exact:true})).toBeInViewport();
  const review=await modalGeometry(modal);
  expectContained(review);
  expect(Math.abs(review.shell.height-first.shell.height)).toBeLessThan(2);
  expect(Math.abs(review.footer.bottom-first.footer.bottom)).toBeLessThan(2);
  expect(state.commits()).toBe(0);
  await modal.getByRole('button',{name:'New report',exact:true}).click();
  await expect(modal.getByRole('button',{name:'Validate report',exact:true})).toBeInViewport();
  await expect(modal.getByRole('button',{name:'Validate report',exact:true})).toBeDisabled();
  expect(state.uploads()).toBe(0);
});
test('mobile import dialog keeps footer and tabs accessible with long error reports',async({page})=>{
  await page.setViewportSize({width:390,height:640});
  const state=await setup(page,false,{historyCount:23,issueCount:20});
  state.reject();
  await page.getByRole('button',{name:'Upload Data',exact:true}).click();
  const modal=page.getByRole('dialog',{name:'GMS Report Import'});
  await expect(modal.getByRole('button',{name:'Validate report',exact:true})).toBeInViewport();
  await modal.locator('input[type=file]').setInputFiles({name:'invalid.csv',mimeType:'text/csv',buffer:Buffer.from('ASIN,Date\nB000000001,2026-11-27')});
  await modal.getByRole('button',{name:'Validate report',exact:true}).click();
  const content=modal.getByRole('region',{name:'Import report content'});
  await expect(content.getByText('Report rejected',{exact:true})).toBeVisible();
  await expect.poll(async()=>(await modalGeometry(modal)).scroll.height>(await modalGeometry(modal)).scroll.client).toBe(true);
  const initial=await modalGeometry(modal);
  await content.evaluate(el=>{el.scrollTop=el.scrollHeight;});
  await expect.poll(async()=>(await modalGeometry(modal)).scroll.top).toBeGreaterThan(0);
  const after=await modalGeometry(modal);
  expectContained(after);
  expect(Math.abs(after.header.top-initial.header.top)).toBeLessThan(2);
  expect(Math.abs(after.footer.bottom-initial.footer.bottom)).toBeLessThan(2);
  await expect(modal.getByRole('button',{name:'New report',exact:true})).toBeInViewport();
  await expect(modal.getByRole('button',{name:'Confirm import',exact:true})).toHaveCount(0);
  await modal.getByRole('tab',{name:'My import history',exact:true}).click();
  await expect(modal.getByRole('region',{name:'Import history content'})).toBeVisible();
  expectContained(await modalGeometry(modal));
  expect(state.commits()).toBe(0);
  await modal.getByRole('button',{name:'Close',exact:true}).last().click();
  await expect(modal).not.toBeVisible();
});

async function pinnedGeometry(matrix){
  return matrix.evaluate(el=>{
    const header=el.querySelector('.ant-table-header');
    const body=el.querySelector('.ant-table-body');
    const th=header?.querySelector('th.gms-matrix-pinned-cell');
    const td=body?.querySelector('tr.ant-table-row > td.gms-matrix-pinned-cell');
    if(!header||!body||!th||!td)return null;
    const bounds=node=>{const r=node.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width};};
    const hit=node=>{
      const r=node.getBoundingClientRect(),target=document.elementFromPoint(r.left+Math.min(12,r.width/2),r.top+r.height/2);
      return !!target&&node.contains(target);
    };
    const background=node=>getComputedStyle(node).backgroundColor;
    return {head:bounds(th),cell:bounds(td),viewport:bounds(body),
      scroll:body.scrollLeft,max:body.scrollWidth-body.clientWidth,headerScroll:header.scrollLeft,
      wrapperScroll:el.scrollLeft,wrapperWidth:el.clientWidth,wrapperScrollWidth:el.scrollWidth,
      headZ:Number(getComputedStyle(th).zIndex),bodyZ:Number(getComputedStyle(td).zIndex),
      regularHeadZ:Number(getComputedStyle(header.querySelector('th:not(.gms-matrix-pinned-cell)')).zIndex),
      headHit:hit(th),bodyHit:hit(td),headBackground:background(th),bodyBackground:background(td)};
  });
}
async function scrollMatrix(matrix,direction){
  await matrix.locator('.ant-table-body').evaluate((el,where)=>{el.scrollLeft=where==='end'?el.scrollWidth:where;el.dispatchEvent(new Event('scroll'));},direction);
}
function assertPinned(g,baseline){
  expect(g).not.toBeNull();
  expect(Math.abs(g.head.left-baseline.head.left)).toBeLessThan(2);
  expect(Math.abs(g.cell.left-baseline.cell.left)).toBeLessThan(2);
  expect(Math.abs(g.head.left-g.cell.left)).toBeLessThan(2);
  expect(Math.abs(g.head.width-g.cell.width)).toBeLessThan(2);
  expect(g.headZ).toBeGreaterThan(g.regularHeadZ);
  expect(g.bodyZ).toBeGreaterThan(0);
  expect(g.headBackground).not.toMatch(/transparent|rgba\(.*,\s*0\)/);
  expect(g.bodyBackground).not.toMatch(/transparent|rgba\(.*,\s*0\)/);
  expect(g.headHit).toBe(true);
  expect(g.bodyHit).toBe(true);
  expect(g.wrapperScroll).toBe(0);
}
test('wide daily matrix keeps ASIN header and cells pinned above scrolling columns',async({page})=>{
  await page.setViewportSize({width:1280,height:900});
  const state=await setup(page,true,{wideMatrix:true});
  const matrix=page.locator('#panel-matrix .gms-matrix-scroll');
  await page.getByRole('radiogroup',{name:'Matrix granularity'}).getByText('Daily',{exact:true}).click();
  await expect(matrix.locator('.ant-table-header th.gms-matrix-pinned-cell')).toHaveText('ASIN');
  await matrix.locator('.ant-table-header').scrollIntoViewIfNeeded();
  await expect.poll(async()=>{const g=await pinnedGeometry(matrix);return g?.max||0;}).toBeGreaterThan(300);
  const start=await pinnedGeometry(matrix);
  assertPinned(start,start);
  const reads=state.reads();
  await scrollMatrix(matrix,360);
  await expect.poll(async()=>{const g=await pinnedGeometry(matrix);return Math.abs(g.headerScroll-g.scroll);}).toBeLessThan(2);
  await expect.poll(async()=>(await pinnedGeometry(matrix)).scroll).toBeGreaterThan(300);
  assertPinned(await pinnedGeometry(matrix),start);
  await scrollMatrix(matrix,'end');
  await expect.poll(async()=>{const g=await pinnedGeometry(matrix);return Math.abs(g.scroll-g.max);}).toBeLessThan(2);
  await expect.poll(async()=>{const g=await pinnedGeometry(matrix);return Math.abs(g.headerScroll-g.scroll);}).toBeLessThan(2);
  assertPinned(await pinnedGeometry(matrix),start);
  await expect(matrix.getByRole('columnheader',{name:'27 Nov',exact:true})).toBeInViewport();
  expect(state.reads()).toBe(reads);
  // Switching grouping pins the seller identity, never a second column.
  await page.getByRole('radiogroup',{name:'Row grouping'}).getByText('Seller View',{exact:true}).click();
  await expect.poll(()=>state.lastRequest()?.level).toBe('seller');
  await expect(matrix.locator('.ant-table-header th.gms-matrix-pinned-cell')).toHaveText('Seller (DB)');
  await expect(matrix.locator('.ant-table-body tr.ant-table-row').first().locator('.gms-matrix-pinned-cell')).toHaveCount(1);
  await expect(matrix.getByText('Seller 1',{exact:true})).toBeVisible();
  await scrollMatrix(matrix,0);
  await expect.poll(async()=>(await pinnedGeometry(matrix)).scroll).toBe(0);
  const sellerStart=await pinnedGeometry(matrix);
  await scrollMatrix(matrix,360);
  await expect.poll(async()=>{const g=await pinnedGeometry(matrix);return Math.abs(g.headerScroll-g.scroll);}).toBeLessThan(2);
  assertPinned(await pinnedGeometry(matrix),sellerStart);
});
test('narrow matrix releases the pin while retaining native horizontal scroll',async({page})=>{
  await page.setViewportSize({width:1280,height:900});
  await setup(page,true,{wideMatrix:true});
  const matrix=page.locator('#panel-matrix .gms-matrix-scroll');
  await expect(matrix.locator('.ant-table-header th.gms-matrix-pinned-cell')).toHaveCount(1);
  // Simulate reduced content area (expanded sidebar/split-screen).
  await page.locator('.gms-workspace').evaluate(el=>{el.style.maxWidth='620px';});
  await expect(matrix.locator('.ant-table-header th.gms-matrix-pinned-cell')).toHaveCount(0);
  const overflow=await matrix.locator('.ant-table-body').evaluate(el=>el.scrollWidth-el.clientWidth);
  expect(overflow).toBeGreaterThan(200);
  await scrollMatrix(matrix,'end');
  await expect.poll(()=>matrix.locator('.ant-table-body').evaluate(el=>el.scrollLeft)).toBeGreaterThan(200);
  await expect.poll(()=>matrix.evaluate(el=>el.scrollLeft)).toBe(0);
  const width=await page.locator('.gms-workspace').evaluate(el=>({client:el.clientWidth,scroll:el.scrollWidth}));
  expect(width.scroll).toBeLessThanOrEqual(width.client+2);
});
