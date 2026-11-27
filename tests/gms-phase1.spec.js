import { test, expect } from '@playwright/test';

const user = { Id: 'u-test', id: 'u-test', firstName: 'Test', role: { name: 'admin' }, scope: 'global', permissions: ['*'] };

async function setup(page) {
  let reads = 0, uploads = 0, fail = false;
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname;
    const send = (data, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });
    if (path.endsWith('/auth/me')) return send({ success: true, data: user });
    if (path.endsWith('/upload/gms-data')) {
      reads++;
      return fail ? send({ success: false, message: 'Failed' }, 500) : send({ success: true, data: [] });
    }
    if (path.endsWith('/upload/upload-gms')) {
      uploads++;
      return send({ success: true, processed: 1, skipped: 0, duplicatesCondensed: 0 });
    }
    if (path.endsWith('/sellers')) return send({ success: true, data: { sellers: [] } });
    return send({ success: true, data: [] });
  });
  await page.goto('/tests/fixtures/gms-phase1.html');
  await expect(page.getByText('No GMS records in this selection')).toBeVisible({ timeout: 15000 });
  return { reads: () => reads, uploads: () => uploads, setFailure: () => { fail = true; } };
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

test('selecting a report never uploads before confirmation, and refreshes after success', async ({ page }) => {
  const state = await setup(page);
  await page.getByRole('button', { name: 'Upload Data' }).click();
  await page.locator('input[type=file]').setInputFiles({
    name: 'report.csv', mimeType: 'text/csv',
    buffer: Buffer.from('ASIN,Date,Ordered Revenue\nB000000001,2026-11-27,100')
  });
  await expect(page.getByText('Confirm GMS Upload', { exact: true })).toBeVisible();
  expect(state.uploads()).toBe(0);
  const initial = state.reads();
  await page.getByRole('button', { name: 'Confirm Upload', exact: true }).click();
  await expect.poll(state.uploads).toBe(1);
  await expect.poll(state.reads).toBeGreaterThan(initial);
});
