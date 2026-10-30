import { test, expect } from '@playwright/test';

test('worklist preserves saved zero and opens the selected task with the keyboard', async ({ page }) => {
  await page.goto('/tests/fixtures/task-worklist.html');
  await expect(page.getByRole('progressbar', { name: 'Check inventory availability progress' })).toHaveAttribute('aria-valuenow', '0');
  const open = page.getByRole('button', { name: 'Continue: Check inventory availability' });
  await open.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog', { name: 'Selected task' })).toContainText('Check inventory availability');
});

test('mobile worklist fits the viewport and keeps actions visible', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/tests/fixtures/task-worklist.html');
  await expect(page.getByRole('button', { name: 'Review feedback: Correct listing evidence' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('load failure can be retried and empty state offers a reset', async ({ page }) => {
  await page.goto('/tests/fixtures/task-worklist.html?state=error');
  await expect(page.getByRole('alert')).toContainText('Connection unavailable');
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.getByRole('button', { name: 'Continue: Check inventory availability' })).toBeVisible();
  await page.goto('/tests/fixtures/task-worklist.html?state=empty');
  await expect(page.getByRole('heading', { name: 'No tasks in this view' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Reset view' })).toBeVisible();
});
