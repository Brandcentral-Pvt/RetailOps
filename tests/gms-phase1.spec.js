import { test, expect } from '@playwright/test';

const user = { Id: 'u-test', id: 'u-test', firstName: 'Test', role: { name: 'admin' }, scope: 'global', permissions: ['*'] };

async function setup(page, nonempty=false) {
  let reads = 0, uploads = 0, commits = 0, fail = false, reject = false, status = 'READY';
  const batch = () => ({ id:'batch1',fileName:'report.csv',status,createdAt:'2026-11-27T10:00:00Z',summary:{total:1,inserted:1,updated:0,unchanged:0,duplicates:0,invalid:reject?1:0,issues:reject?[{row:2,asin:'B000000001',date:'2026-11-27',column:'Ordered Revenue',code:'INVALID_ROW',message:'Invalid monetary value',remarks:'Enter a valid amount in Ordered Revenue, such as 1250.50 or -250.00.'}]:[],reportIssueCount:reject?1:0,reportComplete:true,sample:[],committed:status==='COMPLETED'?1:0} });
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname;
    const send = (data, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });
    if (path.endsWith('/auth/me')) return send({ success: true, data: user });
    if (path.endsWith('/upload/gms-analytics')) {
      reads++;
      const data=nonempty?{
        matrixRows:[{key:'B000000001',asin:'B000000001',dbBrand:'-',brand:'Sheet Brand',storeCode:'IN',isUnmatched:true,orderedUnits:2,dailyRev:{'2026-11-27':0},weeklyRev:{'2026-11|2026-W48':0},monthlyRev:{'2026-11':0},_momTrends:{},_wowTrends:{},_dodTrends:{}}],
        monthGroups:{'2026-11':{key:'2026-11',label:'November 2026',weeks:{'2026-11|2026-W48':{key:'2026-11|2026-W48',label:'Week 48 (27 Nov - 27 Nov)',days:['2026-11-27']}}}},
        kpis:{orderedRevenue:0,orderedUnits:2,shippedRevenue:-10,shippedCOGS:5,shippedUnits:1,customerReturns:0,profit:-15,marginPct:null,returnRatio:0},
        comparison:{window:{from:'2026-11-26',to:'2026-11-26',days:1},changes:{orderedRevenue:null,returnRatio:0},currentCoverage:{observedDays:1,expectedDays:1,complete:true},previousCoverage:{observedDays:1,complete:true}},
        daily:[{date:'2026-11-27',orderedRevenue:0,orderedUnits:2,customerReturns:0}],meta:{records:1,asins:1,sellers:0,unmatchedRecords:1,last:'2026-11-27'}
      }:{matrixRows:[],monthGroups:{},kpis:{},comparison:{window:null},daily:[],meta:{records:0,asins:0,sellers:0,unmatchedRecords:0,last:null}};
      return fail ? send({ success:false,message:'Failed' },500) : send({success:true,data});
    }
    if (path.endsWith('/upload/gms-imports') && route.request().method()==='GET') return send({success:true,data:[]});
    if (path.endsWith('/upload/gms-imports') && route.request().method()==='POST') {
      uploads++;
      status=reject?'REJECTED':'READY';
      return send({success:true,data:batch()},201);
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
  return { reads: () => reads, uploads: () => uploads, commits: () => commits, setFailure: () => { fail = true; }, reject: () => { reject = true; } };
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
  await expect(page.getByRole('button',{name:'Download Excel'})).toBeVisible();
  const downloadPromise=page.waitForEvent('download');
  await page.getByRole('button',{name:'Download CSV'}).click();
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
  await expect(page.getByText('₹0',{exact:true}).first()).toBeVisible();
});
