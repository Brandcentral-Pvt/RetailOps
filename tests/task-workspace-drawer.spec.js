/**
 * Task details drawer contract.
 *
 * The drawer was a leftover from the old consumer-styled task UI: gradient
 * banners, gradient pills and per-category colour washes. The Task Execution
 * Center brief is neutral surfaces with one primary accent, so this guards the
 * two things that actually break the page: a rule task failing to open at all,
 * and gradients creeping back into the drawer.
 */
import { test, expect } from '@playwright/test';
const user = { _id:'u-1', Id:'u-1', email:'lead@example.com', firstName:'Priya', lastName:'Sharma', role:{name:'super_admin'}, isAdmin:true, permissions:['tasks_view','tasks_manage'] };
const task = {
  Id:'inst-1', InstanceCode:'PT-0001', Title:'Reconcile Amazon listing buybox', Description:'desc',
  SellerName:'Nova Retail LLC', AssignedTo:'u-1', AssigneeName:'Priya Sharma', Status:'IN_PROGRESS',
  Priority:'HIGH', Category:'PRICING', Source:'RULESET', IsRuleTask:true, SourceRef:'Buybox Guard',
  Asins:'["B01","B02"]', ProgressPct:45, SubTasks:[], Activities:[], AuditLogs:[],
};
test.use({ viewport:{ width:1600, height:1000 } });
test('task details drawer renders without errors', async ({ page }) => {
  const errors = [];
  page.on('console', m => { if (m.type()==='error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push('PAGEERROR '+e.message));
  await page.route('**/socket.io/**', r => r.abort());
  await page.addInitScript(u => { localStorage.setItem('authToken','t'); localStorage.setItem('user', JSON.stringify(u)); }, user);
  await page.route('**/api/**', route => {
    const p = new URL(route.request().url()).pathname;
    const json = b => route.fulfill({ status:200, contentType:'application/json', body:JSON.stringify(b) });
    if (p.endsWith('/auth/me')) return json({ success:true, data:user });
    if (p.endsWith('/auth/permissions')) return json({ success:true, data:user.permissions });
    if (p.endsWith('/notifications')) return json({ success:true, data:[] });
    if (/\/pems\/instances\/[^/]+$/.test(p)) return json({ success:true, data:{ ...task, subTasks:[], activities:[], auditLogs:[] } });
    if (p.includes('/pems/instances')) return json({ success:true, instances:[task], pagination:{page:1,limit:25,total:1,totalPages:1} });
    if (p.includes('/automation-stats')) return json({ success:true, data:{total:0,open:0,overdue:0,byRuleset:[]} });
    return json({ success:true, data:[] });
  });
  await page.goto('/tasks/tasks');
  await page.waitForLoadState('networkidle');
  await page.locator('.tasks-task-row, .tasks-row').first().click();
  await expect(page.locator('.ant-drawer')).toBeVisible({ timeout: 10000 });
  await expect(page.locator('.ant-drawer')).toContainText('PT-0001');
  await expect(page.locator('.ant-drawer')).toContainText('Buybox Guard');
  // no gradients should be used anywhere in the drawer
  const grads = await page.locator('.ant-drawer *').evaluateAll(els =>
    els.filter(e => getComputedStyle(e).backgroundImage.includes('gradient')).map(e => e.className));
  expect(grads, 'drawer must not use gradients').toEqual([]);
  const real = errors.filter(e => !/DevTools|antd|deprecated/i.test(e));
  expect(real, 'no console/page errors').toEqual([]);
});
