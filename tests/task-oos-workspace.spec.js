import { test, expect } from '@playwright/test';

// OOS-RECON-001 workspace: daily run, evidence uploads, channel-separated
// reconciliation, durable incidents and a submission gate. The backend rules
// are unit-tested; these tests lock the operator-facing behaviour.

const adminUser = {
  _id: 'u1', Id: 'u1', email: 'lead@example.com', firstName: 'Lead', lastName: 'User',
  role: { name: 'super_admin' }, isAdmin: true,
  permissions: ['tasks_view', 'tasks_manage', 'scraping_manage'],
};

const viewerUser = {
  _id: 'u2', Id: 'u2', email: 'viewer@example.com', firstName: 'View', lastName: 'Only',
  role: { name: 'viewer' }, isAdmin: false,
  permissions: ['tasks_view'],
};

const seller = { _id: 's1', Id: 's1', Name: 'Acme Brands' };

const manifest = {
  channel: 'amazon.in',
  eligibleActiveAsins: 12,
  retailOpsUnavailableCount: 3,
  missingAvailabilityCount: 2,
  lastRetailOpsObservation: '2026-10-23T09:00:00Z',
  gms: { windowDays: 30, asinCount: 0, revenue: null, verified: false, note: 'GMS_UNVERIFIED' },
};

const run = {
  Id: 'run-1', SellerId: 's1', SellerName: 'Acme Brands', Channel: 'amazon.in',
  RunDate: '2026-10-23', Status: 'RECONCILED', PolicyVersion: 'v1',
  ManifestJson: JSON.stringify(manifest),
};

const decisions = [
  {
    Id: 'd1', AsinCode: 'B00TEST001', Category: 'DISCREPANCY', RuleId: 'R2',
    Confidence: 85, Revision: 1, Reason: 'Both reports positive while RetailOps unavailable',
    EvidenceJson: JSON.stringify({
      retailOps: { state: 'OOS', quantity: null },
      brandCentral: { present: true, state: 'IN_STOCK', quantity: 5 },
      vendor: { present: true, state: 'IN_STOCK', quantity: 3 },
      vendorApplicable: true,
    }),
  },
  {
    Id: 'd2', AsinCode: 'B00TEST002', Category: 'CONFIRMED_CHANNEL_OOS', RuleId: 'R4',
    Confidence: 80, Revision: 2, Reason: 'No applicable report shows positive stock',
    EvidenceJson: JSON.stringify({
      retailOps: { state: 'OOS', quantity: null },
      brandCentral: { present: true, state: 'OOS_ZERO', quantity: 0 },
      vendor: { applicable: false },
      vendorApplicable: false,
    }),
  },
];

function json(route, body, status = 200) {
  return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

async function seed(page, { user = adminUser, submitStatus = 200, submitBody } = {}) {
  await page.route('**/socket.io/**', route => route.abort());
  await page.addInitScript((u) => {
    localStorage.setItem('authToken', 'test-token');
    localStorage.setItem('user', JSON.stringify(u));
  }, user);

  await page.route('**/api/**', route => {
    const pathname = new URL(route.request().url()).pathname;
    const method = route.request().method();

    if (pathname.endsWith('/auth/me')) return json(route, { success: true, data: user });
    if (pathname.endsWith('/notifications')) return json(route, { success: true, data: [] });
    if (pathname.endsWith('/pems/sellers')) return json(route, { success: true, data: [seller] });
    if (pathname.endsWith('/oos/policy')) return json(route, { success: true, policy: { version: 'v1', freshnessHoursRetailOps: 24 } });

    if (pathname.endsWith('/oos/runs') && method === 'POST') {
      return json(route, { success: true, created: true, run, manifest }, 201);
    }
    if (pathname.endsWith('/oos/runs/run-1') && method === 'GET') return json(route, { success: true, run });
    if (pathname.endsWith('/oos/runs/run-1/imports') && method === 'GET') return json(route, { success: true, imports: [] });
    if (pathname.endsWith('/oos/runs/run-1/imports') && method === 'POST') {
      return json(route, { success: true, accepted: 1, rejected: 0, invalid: [] }, 201);
    }
    if (pathname.endsWith('/oos/runs/run-1/decisions')) return json(route, { success: true, decisions });
    if (pathname.endsWith('/oos/runs/run-1/incidents')) {
      return json(route, {
        success: true,
        incidents: [{
          Id: 'inc-1', AsinCode: 'B00TEST001', Status: 'OPEN', Channel: 'amazon.in',
          OwnerId: null, CommunicationStatus: null, NextAction: null, FollowUpDate: null,
        }],
      });
    }
    if (pathname.endsWith('/oos/runs/run-1/resync')) return json(route, { success: true, jobs: [] });
    if (pathname.endsWith('/oos/runs/run-1/export') && method === 'GET') {
      return json(route, { success: false, error: 'No export exists' }, 404);
    }
    if (pathname.endsWith('/oos/runs/run-1/export') && method === 'POST') {
      return json(route, { success: true, export: { Version: 1, SheetCount: 4, FileHash: 'abcdef123456' }, version: 1 }, 201);
    }
    if (pathname.endsWith('/oos/runs/run-1/reconcile') && method === 'POST') {
      return json(route, { success: true, analysed: 2, counts: { DISCREPANCY: 1, CONFIRMED_CHANNEL_OOS: 1 } });
    }
    if (pathname.endsWith('/oos/runs/run-1/submit') && method === 'POST') {
      return json(route, submitBody || {
        success: false, ok: false,
        errors: ['Open incident amazon.in B00TEST001 has no owner.', 'An immutable export (with hash) is required before submission.'],
        checklist: [
          { key: 'ownership', label: 'Every open incident has owner, communication, next action and follow-up', ok: false },
          { key: 'export', label: 'Immutable export with hash', ok: false },
        ],
      }, submitStatus);
    }
    if (pathname.startsWith('/api/')) return json(route, { success: true, data: [] });
    return route.continue();
  });
}

async function startRun(page) {
  await page.goto('/tasks/oos');
  await expect(page.getByRole('heading', { name: /oos reconciliation/i })).toBeVisible();
  await page.getByTestId('oos-start-run').click();
  await expect(page.getByText(/run 23 oct 2026/i)).toBeVisible();
}

test.describe('OOS reconciliation workspace', () => {
  test('starts a run, shows manifest metrics and channel-separated cases', async ({ page }) => {
    await seed(page);
    await startRun(page);

    await expect(page.getByText('Eligible active ASINs')).toBeVisible();
    await expect(page.getByText('12', { exact: true })).toBeVisible();
    await expect(page.getByText('Unverified', { exact: true })).toBeVisible();
    await expect(page.getByText(/Pareto tiering will read GMS_UNVERIFIED/i)).toBeVisible();

    const table = page.getByTestId('oos-decisions');
    await expect(table.getByRole('cell', { name: 'B00TEST001' })).toBeVisible();
    await expect(table.getByRole('cell', { name: 'B00TEST002' })).toBeVisible();
    // Vendor Central is N/A for the Ajio-scope case and quantities stay apart.
    await expect(table.getByRole('cell', { name: 'N/A' })).toBeVisible();
    await expect(table.getByRole('cell', { name: /IN_STOCK 5/ })).toBeVisible();
    await expect(table.getByRole('cell', { name: /IN_STOCK 3/ })).toBeVisible();
  });

  test('uploads a spreadsheet and reports accepted/rejected counts', async ({ page }) => {
    await seed(page);
    await startRun(page);

    const input = page.locator('[data-testid="oos-upload-BRAND_CENTRAL"] input[type="file"]');
    await input.setInputFiles({
      name: 'brand-central.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from('asin,quantity,availability\nB00TEST001,0,\n'),
    });
    await page.getByRole('button', { name: /upload & validate/i }).click();
    await expect(page.getByText('1 accepted · 0 rejected')).toBeVisible();
  });

  test('viewer cannot run checks or use resync', async ({ page }) => {
    await seed(page, { user: viewerUser });
    await startRun(page);

    await expect(page.getByRole('button', { name: /run daily check/i })).toHaveCount(0);
    await expect(page.getByText('Resync jobs')).toHaveCount(0);
    await expect(page.getByTestId('oos-submit')).toBeDisabled();
  });

  test('submission gate surfaces ownership and export blockers', async ({ page }) => {
    await seed(page);
    await startRun(page);

    await page.getByPlaceholder('Reviewer user id').fill('reviewer-1');
    await page.getByTestId('oos-submit').click();

    await expect(page.getByText('Submission blocked')).toBeVisible();
    await expect(page.getByText(/has no owner/i)).toBeVisible();
    await expect(page.getByText(/immutable export \(with hash\) is required/i)).toBeVisible();
  });
});
