/**
 * OOS-RECON-001 affected-ASIN grid contract.
 *
 * Guards the three server priority groups and the New ASIN badge without
 * recomputing priority from GMS on the client.
 */
import { test, expect } from '@playwright/test';

test.use({ viewport: { width: 1800, height: 1000 } });

test('grid renders server priority groups and only badges isNewAsin rows', async ({ page }) => {
  const errors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(`PAGEERROR ${error.message}`));

  await page.goto('/tests/fixtures/grid.html');

  const root = page.locator('#root');
  await expect(root).toContainText('Nova Retail LLC');
  await expect(root.getByText('80%', { exact: true })).toHaveCount(2);
  await expect(root.getByText('20%', { exact: true })).toHaveCount(1);
  await expect(root.getByText('GMS_UNVERIFIED', { exact: true })).toHaveCount(1);
  await expect(root.getByText('New ASIN', { exact: true })).toHaveCount(1);
  await expect(root.getByText('PRIORITY_PENDING', { exact: true })).toHaveCount(0);

  const real = errors.filter((error) => !/DevTools|antd|deprecated|Download the React DevTools/i.test(error));
  expect(real, 'no console or page errors').toEqual([]);
});
