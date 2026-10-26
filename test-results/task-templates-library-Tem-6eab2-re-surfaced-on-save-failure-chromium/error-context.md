# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: task-templates-library.spec.js >> Template Builder >> server validation errors are surfaced on save failure
- Location: tests/task-templates-library.spec.js:162:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByText(/sop missing|cannot be published/i).first()
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" getByText(/sop missing|cannot be published/i).first() with timeout 5000ms
  - waiting for getByText(/sop missing|cannot be published/i).first()

```

```yaml
- complementary "Main navigation":
  - img
  - text: RetailOps
  - button "Collapse Sidebar"
  - menu:
    - text: Overview
    - group:
      - menuitem "Dashboard"
      - menuitem "Sellers"
    - text: Catalog & Marketplace
    - group:
      - menuitem "ASIN Manager 0":
        - text: ASIN Manager
        - superscript: "0"
      - menuitem "Ads Intelligence"
      - menuitem "Keyword Research"
      - menuitem "GMS Tracker"
      - menuitem "Seller Tracker"
      - menuitem "Parent Trends"
      - menuitem "SKU Analysis"
    - text: Automation & Operations
    - group:
      - menuitem "Rule Sets"
      - menuitem "My Day"
      - menuitem "Task Performance"
      - menuitem "Task Templates"
      - menuitem "Tasks"
      - menuitem "Review Queue"
      - menuitem "Analytics"
      - menuitem "Scheduled Runs"
      - menuitem "Scraper"
      - menuitem "Live Sync Tracker"
      - menuitem "Live Data Inspector"
    - text: Intelligence
    - group:
      - menuitem "Profit & Loss"
      - menuitem "Inventory"
      - menuitem "Target vs Achievement"
      - menuitem "Monthly Recap"
    - text: System & Control
    - group:
      - menuitem "Activity Log"
      - menuitem "Users"
      - menuitem "Team Map"
      - menuitem "Data Migration"
      - menuitem "File Manager"
      - menuitem "API Keys"
      - menuitem "Settings"
      - menuitem "Webhooks"
  - text: PIPELINE IDLE LU Lead User super_admin
  - button "Logout"
- banner:
  - text: Workspace › Dashboard
  - heading "Unified Operations Dashboard" [level=1]
  - button "Open command palette":
    - img "search"
    - text: Search ASINs, sellers, reports, commands... Ctrl K
  - text: Live
  - button "calendar Custom 26 Sep – 26 Oct 2026 down":
    - img "calendar"
    - text: Custom 26 Sep – 26 Oct 2026
    - img "down"
  - button "Downloads":
    - img "download"
  - button "Sync data":
    - img "sync"
  - button "Notifications":
    - img "bell"
  - button "User menu": LU Lead super_admin
- main:
  - img "star"
  - text: Task Operating System
  - heading "Task Templates" [level=1]
  - paragraph: Define, automate and govern repeatable operational workflows.
  - text: 3 Templates 2 Active 1 With SOP
  - img "thunderbolt"
  - text: 3 Scheduled
  - button "plus New template":
    - img "plus"
    - text: New template
  - button "play-circle Run tasks":
    - img "play-circle"
    - text: Run tasks
  - button "bulb Rules that auto-create tasks":
    - img "bulb"
    - text: Rules that auto-create tasks
  - tablist "Filter by category":
    - tab "appstore All 3" [selected]:
      - img "appstore"
      - text: All 3
    - tab "file-text Listing 0":
      - img "file-text"
      - text: Listing 0
    - tab "dashboard Pricing 1":
      - img "dashboard"
      - text: Pricing 1
    - tab "tool Inventory 1":
      - img "tool"
      - text: Inventory 1
    - tab "fire Ads 0":
      - img "fire"
      - text: Ads 0
    - tab "dashboard Analytics 1":
      - img "dashboard"
      - text: Analytics 1
    - tab "safety-certificate Compliance 0":
      - img "safety-certificate"
      - text: Compliance 0
    - tab "check-square General 0":
      - img "check-square"
      - text: General 0
  - img "search"
  - textbox "Search by task name, code or description"
  - text: Frequency
  - combobox
  - img "down"
  - radiogroup "Status filter":
    - radio "All" [checked]
    - text: All
    - radio "Active"
    - text: Active
    - radio "Draft"
    - text: Draft
  - radiogroup "View mode":
    - radio "appstore Grid" [checked]
    - img "appstore"
    - text: Grid
    - radio "bars Table"
    - img "bars"
    - text: Table
  - button "upload Import daily ops":
    - img "upload"
    - text: Import daily ops
  - button "thunderbolt Generate today":
    - img "thunderbolt"
    - text: Generate today
  - button "reload Refresh":
    - img "reload"
    - text: Refresh
  - button "plus New template":
    - img "plus"
    - text: New template
  - button "tool DLY-004 High Draft OOS Data Monitoring Daily OOS routine Inventory Daily clock-circle 8h SLA 1 phases 1 steps Run template View Edit Clone Delete":
    - img "tool"
    - text: DLY-004 High Draft
    - heading "OOS Data Monitoring" [level=4]
    - paragraph: Daily OOS routine
    - text: Inventory Daily
    - img "clock-circle"
    - text: 8h SLA 1 phases 1 steps
    - button "Run template":
      - img "play-circle"
    - button "View":
      - img "eye"
    - button "Edit":
      - img "edit"
    - button "Clone":
      - img "copy"
    - button "Delete":
      - img "delete"
  - button "dashboard DLY-002 Medium Active Buy Box Monitoring Suppression check Pricing Daily clock-circle 24h SLA 0 phases 0 steps Run template View Edit Clone Delete":
    - img "dashboard"
    - text: DLY-002 Medium Active
    - heading "Buy Box Monitoring" [level=4]
    - paragraph: Suppression check
    - text: Pricing Daily
    - img "clock-circle"
    - text: 24h SLA 0 phases 0 steps
    - button "Run template":
      - img "play-circle"
    - button "View":
      - img "eye"
    - button "Edit":
      - img "edit"
    - button "Clone":
      - img "copy"
    - button "Delete":
      - img "delete"
  - button "dashboard DLY-0011 Low Active GMS Analysis Sales analytics Analytics Weekly clock-circle 48h SLA 0 phases 0 steps Run template View Edit Clone Delete":
    - img "dashboard"
    - text: DLY-0011 Low Active
    - heading "GMS Analysis" [level=4]
    - paragraph: Sales analytics
    - text: Analytics Weekly
    - img "clock-circle"
    - text: 48h SLA 0 phases 0 steps
    - button "Run template":
      - img "play-circle"
    - button "View":
      - img "eye"
    - button "Edit":
      - img "edit"
    - button "Clone":
      - img "copy"
    - button "Delete":
      - img "delete"
- tooltip "Downloads"
```

# Test source

```ts
  70  |     await expect(page.getByRole('heading', { name: /task templates/i })).toBeVisible();
  71  | 
  72  |     // 3 templates total but the list only renders a subset — the hero must read
  73  |     // from /templates/summary, never from the paginated list length.
  74  |     await expect(page.locator('.tpl-hero__stat').filter({ hasText: 'Templates' })).toContainText('3');
  75  |     await expect(page.locator('.tpl-hero__stat').filter({ hasText: 'Active' })).toContainText('2');
  76  |     await expect(page.locator('.tpl-hero__stat').filter({ hasText: 'With SOP' })).toContainText('1');
  77  |   });
  78  | 
  79  |   test('renders a table view with the modelled columns', async ({ page }) => {
  80  |     await seed(page);
  81  |     await page.goto('/tasks/templates');
  82  |     await expect(page.getByRole('heading', { name: /task templates/i })).toBeVisible();
  83  | 
  84  |     await page.locator('.ant-segmented-item', { hasText: 'Table' }).click();
  85  |     const table = page.getByRole('table');
  86  |     await expect(table).toBeVisible();
  87  |     // Columns with filters render an extra "filter" button inside the header,
  88  |     // so match on the prefix rather than exact text.
  89  |     for (const col of ['Code', 'Template', 'Category', 'Priority', 'Frequency', 'SOP', 'Assignment', 'Status']) {
  90  |       await expect(table.getByRole('columnheader', { name: col })).toBeVisible();
  91  |     }
  92  |     await expect(table.getByRole('cell', { name: 'OOS Data Monitoring' })).toBeVisible();
  93  |     await expect(table.getByRole('cell', { name: 'DLY-004' })).toBeVisible();
  94  |   });
  95  | 
  96  |   test('category chip filters the library', async ({ page }) => {
  97  |     await seed(page);
  98  |     await page.goto('/tasks/templates');
  99  |     await expect(page.getByRole('heading', { name: /task templates/i })).toBeVisible();
  100 | 
  101 |     const chip = page.getByRole('tab', { name: /Pricing/i });
  102 |     await chip.click();
  103 |     await expect(chip).toHaveAttribute('aria-selected', 'true');
  104 |     // Filtering triggers a fresh fetch with ?category=PRICING and re-renders.
  105 |     await expect(page.locator('.tpl-card__code', { hasText: 'DLY-002' })).toBeVisible();
  106 |   });
  107 | 
  108 |   test('empty result shows a clear state with a reset action', async ({ page }) => {
  109 |     await seed(page, { templateList: [] });
  110 |     await page.goto('/tasks/templates');
  111 |     await page.getByPlaceholder(/search by task name/i).fill('no-such-thing');
  112 |     await expect(page.getByText(/no templates match your filters/i)).toBeVisible();
  113 |     await expect(page.getByRole('button', { name: /clear filters/i })).toBeVisible();
  114 |   });
  115 | 
  116 |   test('load failure offers a retry instead of a blank page', async ({ page }) => {
  117 |     await seed(page, { templateList: [] });
  118 |     await page.route('**/api/pems/templates*', route => {
  119 |       const pathname = new URL(route.request().url()).pathname;
  120 |       if (pathname.endsWith('/templates') && route.request().method() === 'GET') {
  121 |         return json(route, { success: false, error: 'Database unavailable' }, 500);
  122 |       }
  123 |       return route.fallback();
  124 |     });
  125 |     await page.goto('/tasks/templates');
  126 |     await expect(page.getByText(/couldn't load templates/i)).toBeVisible();
  127 |     await expect(page.getByRole('button', { name: /retry/i })).toBeVisible();
  128 |   });
  129 | 
  130 |   test('a user without tasks_manage is denied the route entirely', async ({ page }) => {
  131 |     // The templates route is gated on tasks_manage at the router level, so a
  132 |     // view-only user must never reach an editable library (defence in depth on
  133 |     // top of the per-action gating inside the page).
  134 |     await seed(page, { user: viewerUser });
  135 |     await page.goto('/tasks/templates');
  136 |     await expect(page.getByRole('heading', { name: /access denied/i })).toBeVisible();
  137 |     await expect(page.getByRole('button', { name: /new template/i })).toHaveCount(0);
  138 |   });
  139 | });
  140 | 
  141 | test.describe('Template Builder', () => {
  142 |   test('blocks publishing an invalid template and surfaces the reason', async ({ page }) => {
  143 |     await seed(page);
  144 |     await page.goto('/tasks/templates');
  145 |     await page.getByRole('button', { name: /new template/i }).first().click();
  146 | 
  147 |     const drawer = page.getByRole('dialog');
  148 |     await expect(drawer.getByTestId('section-definition')).toBeVisible();
  149 | 
  150 |     // Save & activate is disabled while the publish checks fail, so an invalid
  151 |     // template cannot be published by clicking through the builder.
  152 |     await expect(drawer.getByTestId('publish')).toBeDisabled();
  153 | 
  154 |     // The section rail is live: the definition section reports an error, and
  155 |     // opening Validate & Publish spells out why publication is blocked.
  156 |     await drawer.getByRole('button', { name: /Validate & Publish/i }).click();
  157 |     const review = drawer.getByTestId('section-review');
  158 |     await expect(review).toBeVisible();
  159 |     await expect(review.getByText(/required|needs|missing|SOP/i).first()).toBeVisible();
  160 |   });
  161 | 
  162 |   test('server validation errors are surfaced on save failure', async ({ page }) => {
  163 |     await seed(page, { saveStatus: 400 });
  164 |     await page.goto('/tasks/templates');
  165 |     await page.getByRole('button', { name: /new template/i }).first().click();
  166 |     const drawer = page.getByRole('dialog');
  167 | 
  168 |     await drawer.getByRole('textbox').first().fill('My Template');
  169 |     await drawer.getByRole('button', { name: /save draft/i }).first().click();
> 170 |     await expect(page.getByText(/sop missing|cannot be published/i).first()).toBeVisible({ timeout: 5000 });
      |                                                                              ^ Error: expect(locator).toBeVisible() failed
  171 |   });
  172 | });
  173 | 
```