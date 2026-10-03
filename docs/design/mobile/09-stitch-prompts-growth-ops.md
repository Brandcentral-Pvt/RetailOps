# RetailOps Android — Stitch Prompts: Growth, Ops

**Document ID:** `RO-MOB-DS-009` · Companion to `07-stitch-setup-and-workflow.md`
**Screens:** 42 (21 internal Growth · 21 Ops)

> These are all **internal surface** screens. Generate them in the `RetailOps Internal`
> project. The bottom navigation for this surface is always
> `Home · Catalog · Growth · Ops · More` — the shell lines below reflect that.

---

## 1. Growth (21 screens)

---

#### INT-GR-01 · Ads — overview ★ critical
`perm: adsreport_view` · `states: empty, offline, stale, error`

```
Role: internal RetailOps staff — Admin / Super Admin, Operational Manager, Brand Manager, Catalog Manager, Listing Team, Reviewer, Viewer. Scope: all/assigned. Permission: adsreport_view.
Required states: empty-true, offline-cached, stale-partial, error-recovery.

Design a single Android Material 3 mobile advertising overview screen for RetailOps, an internal
B2B e-commerce operations app.
Top app bar: a rounded "All sellers" chip with a caret, a search icon, and an overflow menu.
Bottom navigation bar with 5 items: Home, Catalog, Growth, Ops, More — show Growth selected.
Body, top to bottom:
1. A segmented control "7d / 30d / 90d" with 30d selected, and a small amber chip on the right
   reading "Synced 1 day ago".
2. A 2-column grid of 4 KPI cards: "Ad spend ₹1,24,300 ▲ +4.0%", "Sales ₹6,82,900 ▲ +9.1%",
   "ROAS 5.49x ▲ +0.3x", "ACoS 18.30% ▲ +1.2%" with the ACoS card in amber because rising ACoS is
   bad. Each card has a label, a large tabular value, and a delta row with an arrow and comparison
   basis.
3. A section header "Spend and sales" with a 30-day combo chart: bars for spend in light blue and
   a line for sales in deep blue, a small legend above, and a "View as table" text button.
4. A section header "Top campaigns" with a "See all" text button, followed by 3 campaign rows,
   each with the campaign name in 14sp medium, a secondary line with the ad type, and a
   right-aligned block with ROAS in tabular figures above a small coloured delta.
5. A final insight card with a lightbulb icon reading "3 campaigns have spent ₹18,400 with no
   sales in 14 days" and a "Review" text button.
Use Indian currency grouping. Flat white cards with hairline borders, 12dp radius, 16dp margins.
No gradients, no floating action button.
```

#### INT-GR-02 · Ads — trend series
`states: offline, stale`
```
Role: internal RetailOps staff — Admin / Super Admin, Operational Manager, Brand Manager, Catalog Manager, Listing Team, Reviewer, Viewer. Scope: all/assigned. Permission: adsreport_view.
Required states: offline-cached, stale-partial.

Design a single Android Material 3 mobile trend screen for RetailOps, an internal B2B e-commerce
operations app, showing advertising metrics over time.
Top app bar: back arrow, title "Ad trends", overflow menu. Bottom navigation with 5 items —
Home, Catalog, Growth, Ops, More — Growth selected.
Body: a metric selector as a horizontal row of chips — "Spend", "Sales", "ROAS", "ACoS", "Clicks",
"Impressions" — with "ROAS" selected. Below, a small row of legend chips with colour dots. Then a
full-width line chart with a light grid, smooth curves and no axis clutter, for the selected
metric. Under the chart, a "View as table" text button aligned right. Then a section header
"Compare" with a segmented control "Previous period / Previous year / Target" with previous period
selected, followed by 3 summary rows: "Average 5.49x", "Best day 7.12x on 18 Sep", "Worst day
4.02x on 2 Oct", each with a small coloured icon. Flat cards, 16dp margins, no gradients.
```

#### INT-GR-03 · Ads — campaign table
`states: empty, filtered-empty, selection, offline`
```
Role: internal RetailOps staff — Admin / Super Admin, Operational Manager, Brand Manager, Catalog Manager, Listing Team, Reviewer, Viewer. Scope: all/assigned. Permission: adsreport_view.
Required states: empty-true, empty-filtered, selection-bulk, offline-cached.

Design a single Android Material 3 mobile campaign list screen for RetailOps, an internal B2B
e-commerce operations app.
Top app bar: back arrow, title "Campaigns", a filter icon and an overflow menu.
Bottom navigation with 5 items — Home, Catalog, Growth, Ops, More — Growth selected.
Body: a search field labelled "Search campaigns", then a row of removable filter chips —
"Seller A ×", "Sponsored Products ×" — and a sort row "Sort: Spend descending" with a segmented
control for card and compact-row views, compact selected. Below, a compact table-style list of 6
rows on white cards: each row is a single line with three tabular columns — the campaign name
truncated on the left, then "Spend ₹24,300", "Sales ₹98,400", "ROAS 4.05x" — plus a small status
chip. Show one row with a red chip "No sales" and one with an amber chip "ACoS high". One row is
selected with a 2dp primary border and a filled checkbox, and a contextual bottom bar shows
"1 selected" with export and pause icons. At the end of the list, a centred text button
"Load more (25 of 348)". Flat cards, 16dp margins, no gradients.
```

#### INT-GR-04 · Ads — AI review
`states: empty, error`
```
Role: internal RetailOps staff — Admin / Super Admin, Operational Manager, Brand Manager, Catalog Manager, Listing Team, Reviewer, Viewer. Scope: all/assigned. Permission: adsreport_view.
Required states: empty-true, error-recovery.

Design a single Android Material 3 mobile AI review screen for RetailOps, an internal B2B
e-commerce operations app, showing generated advertising recommendations.
Top app bar: back arrow, title "AI review", an overflow menu and a small "Re-run" text button.
Bottom navigation with 5 items — Home, Catalog, Growth, Ops, More — Growth selected.
Body: at the top, a light violet card with a sparkle icon, the label "AI-generated · verify before
acting" in 12sp, and a secondary line "Based on 30 days to 2 Oct 2026". Below, a list of 4
recommendation cards, each with a priority chip ("High" in red, "Medium" in amber, "Low" in grey),
a 14sp headline such as "Pause 3 campaigns with ACoS above 45%", two lines of supporting text in
14sp, a small row of affected campaign chips, and two actions — a text button "Dismiss" and an
outlined button "Apply". One card is expanded to show a short bulleted rationale. At the bottom, a
full-width tonal button "Export recommendations". Flat cards, 16dp margins, no gradients.
```

#### INT-GR-05 · Ads — import workbook
`perm: adsreport_import` · `states: upload, conflict`
```
Role: internal RetailOps staff — Admin / Super Admin, Operational Manager. Scope: all/assigned. Permission: adsreport_import.
Required states: upload-download, conflict.

Design a single Android Material 3 mobile upload screen for RetailOps, an internal B2B e-commerce
operations app, for a daily advertising workbook.
Top app bar: back arrow, title "Import ads data". Bottom navigation with 5 items — Home, Catalog,
Growth, Ops, More — Growth selected.
Body: a dashed-border drop area with an upload icon and the text "Tap to choose a workbook" plus
the caption "XLSX or CSV, up to 10 MB". Below, a file card with a spreadsheet icon,
"Sponsored_Products_Oct.xlsx" in 14sp medium, a secondary line "1.8 MB · 30 Sep – 2 Oct", a
progress bar at 42% with "Uploading…", and a "Cancel" text button. Then a section header
"Validation" listing three rows — "12,480 rows parsed" with a green check, "Date range detected:
30 Sep – 2 Oct" with a green check, and "3 rows have missing campaign names" with an amber warning
and a "View" text button. At the bottom, a full-width filled button "Import 12,477 rows" and a
text button "Cancel". Flat cards, 16dp margins, no gradients.
```

#### INT-GR-06 · Ads — report / export
`perm: adsreport_export` · `states: download progress`
```
Role: internal RetailOps staff — Admin / Super Admin, Operational Manager, Brand Manager, Catalog Manager, Listing Team, Reviewer, Viewer. Scope: all/assigned. Permission: adsreport_export.
Required states: upload-download.

Design a single Android Material 3 mobile export screen for RetailOps, an internal B2B e-commerce
operations app, for advertising data.
Top app bar: back arrow, title "Export ads report". Bottom navigation with 5 items — Home, Catalog,
Growth, Ops, More — Growth selected.
Body: a summary card reading "30 days · All sellers · 348 campaigns" with a "Change" text button.
Below, a section header "Group by" above a segmented control "Campaign / Ad group / Keyword /
Seller" with Campaign selected, then a section header "Metrics" above a wrap layout of selected
chips — "Spend", "Sales", "ROAS", "ACoS", "Clicks", "Impressions" — and unselected ones "CPC",
"CTR". Then a section header "Format" with an XLSX / CSV segmented control. At the bottom, a
full-width filled button "Start export" and a caption "You'll get a notification when the file is
ready." Flat cards, 16dp margins, no gradients.
```

#### INT-GR-07 · Targets — dashboard
`perm: targets_view` · `states: empty, offline, stale`
```
Role: internal RetailOps staff — Admin / Super Admin, Operational Manager, Brand Manager, Catalog Manager, Listing Team, Reviewer, Viewer. Scope: all/assigned. Permission: targets_view.
Required states: empty-true, offline-cached, stale-partial.

Design a single Android Material 3 mobile targets dashboard for RetailOps, an internal B2B
e-commerce operations app.
Top app bar: a rounded "All sellers" chip with a caret, and an overflow menu. Bottom navigation
with 5 items — Home, Catalog, Growth, Ops, More — Growth selected.
Body: a month selector row reading "October 2026" with left and right chevrons. Below, an overall
progress card: a label "Monthly target", a large tabular value "₹1.24Cr" with the secondary
"of ₹1.60Cr achieved", a thick rounded progress bar at 78% in primary blue, and a footer row
"9 days left" and "Pace: 4% behind" in amber. Then a section header "By seller" with a "Sort"
text button, followed by 4 seller rows, each with the seller name in 14sp medium, a thin progress
bar, and right-aligned tabular figures "₹42.1L / ₹50L" above a small coloured percentage delta.
Include a small legend chip "Behind plan" in amber on one row. Flat cards, 16dp margins, no
gradients.
```

#### INT-GR-08 · Target detail vs achievement
`states: offline, stale`
```
Role: internal RetailOps staff — Admin / Super Admin, Operational Manager, Brand Manager, Catalog Manager, Listing Team, Reviewer, Viewer. Scope: all/assigned. Permission: targets_view.
Required states: offline-cached, stale-partial.

Design a single Android Material 3 mobile target detail screen for RetailOps, an internal B2B
e-commerce operations app, for one seller and month.
Top app bar: back arrow, a two-line title — "Targets" in 12sp grey above "Seller A · October 2026"
in 16sp medium — and an overflow menu. Bottom navigation with 5 items — Home, Catalog, Growth,
Ops, More — Growth selected.
Body: a hero card with three inline stats separated by dividers — "Target ₹50L", "Achieved ₹42.1L",
"Gap ₹7.9L" in amber. Below, a 30-day line chart with two series, actual sales as a solid line and
target as a dashed line, with a legend above and gridlines. Below that, a section header
"Month to date" with four label–value rows in tabular figures: "Revenue ₹42,10,300 · 84% of
target", "Units 8,420 · 88% of target", "ACoS 18.30% · target under 20%", "Avg. selling price
₹4,999 · 98% of target". Each row has a small status dot in green or amber. At the bottom, an
outlined button "Adjust target" shown only to permitted users. Flat cards, 16dp margins. No
gradients, no heavy shadows, no floating action button over the navigation bar.
```

#### INT-GR-09 · Target create / edit
`perm: targets_create | targets_edit`
```
Role: internal RetailOps staff — Admin / Super Admin, Operational Manager, Brand Manager. Scope: all/assigned. Permission: targets_create | targets_edit.
Required states: conflict, error-recovery.

Design a single Android Material 3 mobile form screen for RetailOps, an internal B2B e-commerce
operations app, for creating a sales target.
Top app bar: a close icon, title "New target", and a text button "Save". Bottom navigation with
5 items — Home, Catalog, Growth, Ops, More — Growth selected.
Body as a vertical form: a filled field "Seller" with a dropdown caret showing "Seller A"; a
segmented control "Monthly / Quarterly / Yearly" with Monthly selected; a row of two filled fields
side by side, "Month" showing "October 2026" and "Year" showing "2026"; a filled field
"Target amount (₹)" containing "50,00,000" with tabular figures and a helper line "Current
achievement: ₹42.1L"; a filled field "Target ACoS (%)" containing "20.0"; and a section header
"Split by month" above three label-and-field rows for Sep, Oct and Nov. At the bottom, a sticky
bar with an outlined "Cancel" and a filled "Save target". Flat fields, 16dp margins, no gradients.
```

#### INT-GR-10 · GMS Tracker
`perm: gms_tracker_view` · `states: empty, offline, stale`
```
Role: internal RetailOps staff — Admin / Super Admin, Operational Manager, Brand Manager, Catalog Manager, Listing Team, Reviewer, Viewer. Scope: all/assigned. Permission: gms_tracker_view.
Required states: empty-true, offline-cached, stale-partial.

Design a single Android Material 3 mobile GMS tracker screen for RetailOps, an internal B2B
e-commerce operations app.
Top app bar: back arrow, title "GMS Tracker", a filter icon and an overflow menu. Bottom
navigation with 5 items — Home, Catalog, Growth, Ops, More — Growth selected.
Body: a summary card with three inline stats — "GMS ₹4.82Cr", "Growth ▲ +14.2%", "Sellers 6" —
separated by dividers. Below, a segmented control "Month / Quarter / Year" with Month selected.
Then a list of 6 rows, each with the seller name in 14sp medium, a secondary line with the
marketplace, and a right-aligned block with GMS in tabular figures above a small coloured growth
delta. Include a thin 40dp horizontal bar under each row showing contribution to the total, and a
small amber chip "Not synced" on one row. At the bottom of the list, a centred text button
"Load more". Flat cards, 16dp margins, no gradients.
```

#### INT-GR-11 · GMS import
`perm: gms_tracker_import`
```
Role: internal RetailOps staff — Admin / Super Admin, Operational Manager. Scope: all/assigned. Permission: gms_tracker_import.
Required states: upload-download, error-recovery.

Design a single Android Material 3 mobile import screen for RetailOps, an internal B2B
e-commerce operations app, for GMS data.
Top app bar: back arrow, title "Import GMS". Bottom navigation with 5 items — Home, Catalog,
Growth, Ops, More — Growth selected.
Body: a dashed-border drop area with an upload icon reading "Tap to choose a CSV or XLSX file" and
the caption "Up to 10 MB". Below, a file card with a spreadsheet icon,
"gms_september.xlsx" in 14sp medium, a secondary line "3.1 MB · September 2026", a progress bar at
100% with a green check and "Uploaded". Then a section header "Preview" above a compact 3-column
table preview with a sticky header row — "Seller", "Month", "GMS" — and 4 data rows using tabular
figures. At the bottom, a full-width filled button "Import 312 rows" and a text button "Choose a
different file". Include a small inline notice with an info icon reading "Existing rows for
September will be replaced." Flat cards, 16dp margins, no gradients.
```

#### INT-GR-12 · Reports hub
`states: empty`
```
Role: internal RetailOps staff — Admin / Super Admin, Operational Manager, Brand Manager, Catalog Manager, Listing Team, Reviewer, Viewer. Scope: all/assigned. Permission: any *report_view.
Required states: empty-true.

Design a single Android Material 3 mobile reports hub screen for RetailOps, an internal B2B
e-commerce operations app.
Top app bar: a rounded "All sellers" chip with a caret, and a search icon. Bottom navigation with
5 items — Home, Catalog, Growth, Ops, More — Growth selected.
Body: a section header "Performance" above a list of 4 rows, each with a leading icon in a tinted
circular container, a 14sp title and a secondary line — "SKU report · SKU-level revenue and units",
"Parent ASIN report · Family-level performance", "Monthly trends · Month-over-month comparison"
and "Goals report · Achievement against goals" — each with a chevron. Then a section header
"Financial" above 2 similar rows: "P&L report · Revenue, fees and margin" and "Inventory report ·
Stock cover and ageing". Then a section header "Saved views" above a horizontally scrolling row of
3 small cards, each with a name such as "Weekly leadership pack", a secondary line "6 reports" and
a small "Updated 2 h ago" caption. Flat cards, 16dp margins, no gradients.
```

#### INT-GR-13 · SKU report
`states: empty, filtered-empty, offline`
```
Role: internal RetailOps staff — Admin / Super Admin, Operational Manager, Brand Manager, Catalog Manager, Listing Team, Reviewer, Viewer. Scope: all/assigned. Permission: skureport_view.
Required states: empty-true, empty-filtered, offline-cached.

Design a single Android Material 3 mobile data report screen for RetailOps, an internal B2B
e-commerce operations app, showing SKU-level performance.
Top app bar: back arrow, title "SKU report", an export icon and an overflow menu. Bottom
navigation with 5 items — Home, Catalog, Growth, Ops, More — Growth selected.
Body: a control row with a date range chip "1 Sep – 30 Sep", a seller chip "Seller A" and a
"Compare" chip. Below, a summary card with a large tabular value "₹12,48,300" and a delta
"▲ +12.4% vs previous period". Then a segmented control "Chart / Table / Sheet" with Table
selected, above a scrollable compact table of 6 SKUs. The table has a sticky header row — "SKU",
"Units", "Revenue" — and each data row uses tabular figures with a small coloured delta under
revenue. Include a search field above the table labelled "Find a SKU", and a sort indicator on the
Revenue column. At the bottom of the table, a centred text button "Load more (25 of 1,240)".
Flat cards, 16dp margins, no gradients.
```

#### INT-GR-14 · Parent ASIN report
`states: empty, filtered-empty, offline`
```
Role: internal RetailOps staff — Admin / Super Admin, Operational Manager, Brand Manager, Catalog Manager, Listing Team, Reviewer, Viewer. Scope: all/assigned. Permission: parentreport_view.
Required states: empty-true, empty-filtered, offline-cached.

Design a single Android Material 3 mobile report screen for RetailOps, an internal B2B e-commerce
operations app, showing parent ASIN family performance.
Top app bar: back arrow, title "Parent ASIN", an export icon and an overflow menu. Bottom
navigation with 5 items — Home, Catalog, Growth, Ops, More — Growth selected.
Body: a control row with a date range chip and a seller chip. Then a list of 5 expandable family
cards. Each collapsed card shows the parent ASIN in monospace, a family name in 14sp medium such
as "Pegasus 40", a secondary line "12 child ASINs · 4 sizes", and a right-aligned block with
revenue in tabular figures above a coloured delta. One card is expanded to reveal 3 child rows,
each with a small image placeholder square, the child ASIN in monospace, a size label and revenue
in tabular figures. Expanded cards carry a small red chip "2 out of stock". Flat cards with
hairline borders, 16dp margins, no gradients.
```

#### INT-GR-15 · Monthly trends
`states: empty, offline`
```
Role: internal RetailOps staff — Admin / Super Admin, Operational Manager, Brand Manager, Catalog Manager, Listing Team, Reviewer, Viewer. Scope: all/assigned. Permission: monthlyreport_view.
Required states: empty-true, offline-cached.

Design a single Android Material 3 mobile trends screen for RetailOps, an internal B2B e-commerce
operations app.
Top app bar: back arrow, title "Monthly trends", an export icon and an overflow menu. Bottom
navigation with 5 items — Home, Catalog, Growth, Ops, More — Growth selected.
Body: a metric selector row of chips — "Revenue", "Units", "ACoS", "Avg. price", "Rating" — with
Revenue selected. Below, a 12-month column chart with rounded bar tops in primary blue, the current
month highlighted in a darker shade, a light grid and minimal axis labels. Under the chart, a
"View as table" text button aligned right. Then a section header "Month over month" above 6 rows,
each with the month name in 14sp medium and a right-aligned pair showing the value in tabular
figures and a coloured percentage delta with an arrow. One row is marked with a small amber chip
"Partial month". Flat cards, 16dp margins, no gradients.
```

#### INT-GR-16 · P&L report
`states: empty, offline, stale`
```
Role: internal RetailOps staff — Admin / Super Admin, Operational Manager, Brand Manager, Catalog Manager, Listing Team, Reviewer, Viewer. Scope: all/assigned. Permission: pnlreport_view.
Required states: empty-true, offline-cached, stale-partial.

Design a single Android Material 3 mobile profit-and-loss screen for RetailOps, an internal B2B
e-commerce operations app.
Top app bar: back arrow, title "P&L", an export icon and an overflow menu. Bottom navigation with
5 items — Home, Catalog, Growth, Ops, More — Growth selected.
Body: a hero card with the net margin in 32sp tabular "₹2,41,900" and a delta "▲ +8.2% vs previous
period" in green, with a secondary line "Margin 19.4% · target 18%". Below, a waterfall-style
breakdown as a list of 7 label–value rows using tabular figures and Indian grouping: "Gross sales
₹12,48,300", "Amazon fees −₹2,12,200", "Advertising −₹1,24,300", "FBA fulfilment −₹98,400",
"Returns −₹62,100", "Cost of goods −₹5,09,400", and a final emphasised row "Net ₹2,41,900" with a
top divider. Negative values are shown in red with a minus sign. A segmented control at the top of
the breakdown switches "30d / 90d / 1y". Flat cards, 16dp margins, no gradients.
```

#### INT-GR-17 · Inventory report
`states: empty, offline, stale`
```
Role: internal RetailOps staff — Admin / Super Admin, Operational Manager, Brand Manager, Catalog Manager, Listing Team, Reviewer, Viewer. Scope: all/assigned. Permission: inventoryreport_view.
Required states: empty-true, offline-cached, stale-partial.

Design a single Android Material 3 mobile inventory report screen for RetailOps, an internal B2B
e-commerce operations app.
Top app bar: back arrow, title "Inventory", an export icon and an overflow menu. Bottom navigation
with 5 items — Home, Catalog, Growth, Ops, More — Growth selected.
Body: a 2-column grid of 4 KPI cards: "Units in stock 24,180", "Days of cover 38", "Older than 90
days 8,420 units" in amber, "Out of stock 12 ASINs" in red. Below, a segmented control "All /
Low stock / Overstock / Out of stock" with Low stock selected. Then a list of 5 rows, each with a
small product square, the product title on one line, a secondary line with the ASIN in monospace
and the seller, and a right-aligned block showing units in tabular figures above a small coloured
days-of-cover chip such as "12 days" in red or "96 days" in amber. Flat cards, 16dp margins, no
gradients.
```

#### INT-GR-18 · Goals report
`perm: goalsreport_view` · `states: empty, offline`
```
Role: internal RetailOps staff — Admin / Super Admin, Operational Manager, Brand Manager, Catalog Manager, Listing Team, Reviewer, Viewer. Scope: all/assigned. Permission: goalsreport_view.
Required states: empty-true, offline-cached.

Design a single Android Material 3 mobile goals screen for RetailOps, an internal B2B e-commerce
operations app.
Top app bar: back arrow, title "Goals", an overflow menu. Bottom navigation with 5 items — Home,
Catalog, Growth, Ops, More — Growth selected.
Body: a segmented control "Q3 / Q4 / YTD" with Q4 selected above a list of 5 goal cards. Each card
has a goal title in 14sp medium such as "Grow Seller A revenue to ₹60L", a category chip such as
"Revenue" or "Ad efficiency", a thin rounded progress bar at a percentage such as 72%, and a footer
row with tabular figures "₹43.2L of ₹60L" on the left and a due date "31 Dec" on the right. Two
cards carry a small green chip "On track" and one carries an amber chip "At risk". One card shows
a lightweight sparkline of weekly progress. Flat cards, 16dp margins, no gradients, no floating
action button over the nav bar.
```

#### INT-GR-19 · Revenue calculator
`perm: calculator_view`
```
Role: internal RetailOps staff — Admin / Super Admin, Operational Manager, Brand Manager, Catalog Manager, Listing Team, Reviewer, Viewer. Scope: all/assigned. Permission: calculator_view.
Required states: empty-true, error-recovery.

Design a single Android Material 3 mobile calculator screen for RetailOps, an internal B2B
e-commerce operations app, for marketplace fee and margin estimation.
Top app bar: back arrow, title "Revenue calculator", an overflow menu with "Save" and "Reset".
Bottom navigation with 5 items — Home, Catalog, Growth, Ops, More — Growth selected.
Body as a form of filled numeric fields, grouped with section headers:
"Product" — "Selling price (₹)" with "4,499", "Cost of goods (₹)" with "2,100", "Weight (kg)" with
"0.8".
"Marketplace & fulfilment" — a segmented control "FBA / Easy Ship / Self ship" with FBA selected,
and a dropdown field "Category" showing "Shoes & Accessories".
"Advertising" — "ACoS (%)" with "18.0", "Return rate (%)" with "4.5".
Below the fields, a result card with a tinted background showing "Net payout ₹1,182" in 28sp
tabular, then three label–value rows in tabular figures — "Amazon fees ₹786", "Advertising ₹810",
"Gross margin 26.3%". At the bottom, an outlined button "Save scenario" and a text button
"Recalculate". Flat cards, 16dp margins, no gradients.
```

#### INT-GR-20 · Report viewer (generic) ★ critical
`states: offline, stale, error`
```
Role: internal RetailOps staff — Admin / Super Admin, Operational Manager, Brand Manager, Catalog Manager, Listing Team, Reviewer, Viewer. Scope: all/assigned. Permission: per report.
Required states: offline-cached, stale-partial, error-recovery.

Design a single Android Material 3 mobile report viewer screen for RetailOps, an internal B2B
e-commerce operations app. It is a generic container used by every report.
Top app bar: back arrow, a two-line title — "Reports" in 12sp grey above the report name "SKU
report" in 16sp medium — with an export icon and an overflow menu. Bottom navigation with 5 items
— Home, Catalog, Growth, Ops, More — Growth selected.
Body, top to bottom:
1. A control row: a rounded chip "1 Sep – 30 Sep" with a calendar icon, a chip "Seller A" with a
   caret, a chip "vs previous period" with an icon, and a small amber freshness chip
   "Synced 1 day ago".
2. A summary card with 3 auto-derived sentences in 14sp, each preceded by a small coloured dot —
   "Revenue up 12.4% versus the previous 30 days", "Top 3 SKUs contributed 41% of revenue",
   "ACoS rose 1.2 points, driven by 2 campaigns".
3. A segmented control "Chart / Table / Sheet" with Chart selected.
4. A full-width chart with a legend above it (2 series) and a "View as table" text button at the
   top right, with a light grid and clean axis labels.
5. A section header "Breakdown" with a "Sort" text button, above 3 rows of label–value data using
   tabular figures and small coloured deltas.
Flat white cards, hairline borders, 12dp radius, 16dp margins. No gradients, no floating action
button.
```

#### INT-GR-21 · Report export
`perm: per report _export` · `states: download progress`
```
Role: internal RetailOps staff — Admin / Super Admin, Operational Manager, Brand Manager, Catalog Manager, Listing Team, Reviewer, Viewer. Scope: all/assigned. Permission: per report _export.
Required states: upload-download.

Design a single Android Material 3 mobile export screen for RetailOps, an internal B2B e-commerce
operations app, for the currently open report.
Top app bar: back arrow, title "Export report". Bottom navigation with 5 items — Home, Catalog,
Growth, Ops, More — Growth selected.
Body: a summary card showing the report name "SKU report", the secondary line "Seller A ·
1 Sep – 30 Sep", and a "Change" text button. Below, a section header "Rows" above two radio rows,
"All rows (1,240)" selected and "Current page only (25)". Then a section header "Include" with two
toggle rows, "Filters and chips description" on and "Summary sentences" on. Then a section header
"Format" with an XLSX / CSV segmented control, XLSX selected. At the bottom, a full-width filled
button "Start export" and a caption with a download icon reading "Large exports can take a few
minutes — we'll notify you." Flat cards, 16dp margins, no gradients.
```

---

## 2. Ops (21 screens)

---

#### INT-OP-01 · Tasks hub ★ critical
`perm: tasks_view` · `states: empty, filtered-empty, selection, offline`

```
Role: internal RetailOps staff — Admin / Super Admin, Operational Manager, Brand Manager, Catalog Manager, Listing Team, Reviewer, Viewer. Scope: all/assigned. Permission: tasks_view.
Required states: empty-true, empty-filtered, selection-bulk, offline-cached.

Design a single Android Material 3 mobile task list screen for RetailOps, an internal B2B
e-commerce operations app.
Top app bar: a rounded "All sellers" chip with a caret, a search icon, and an overflow menu.
Bottom navigation bar with 5 items: Home, Catalog, Growth, Ops, More — show Ops selected, with a
badge showing 7 on the Ops item.
Body, top to bottom:
1. A tab row with 4 tabs — "My tasks", "Team", "Overdue", "All" — with "My tasks" selected and a
   count badge next to Overdue.
2. A row of removable filter chips — "High priority ×", "This week ×" — plus a "Clear all" chip,
   and a sort row "Sort: SLA remaining" with a filter icon on the right.
3. A scrollable list of 5 task cards. Each card: a leading 4dp vertical priority stripe in red,
   amber or grey; a 14sp task title such as "Correct price on B0XXXXXXXXXX"; a row of small chips
   for the seller and the brand such as "Seller A · Nike"; a secondary line with the assignee
   avatar, the assignee name and the due time "Due today, 6:00 PM"; and a right-aligned SLA pill
   with icon and word — a red "Overdue 2 h", an amber "6 h left" and a green "2 d left" across
   different cards. One card shows subtask progress "2 / 5" with a thin progress bar.
4. At the bottom of the list, a centred text button "Load more (25 of 148)".
A filled floating action button with a plus icon labelled nothing sits at the bottom right, 16dp
above the navigation bar. Use tabular figures for times. Flat white cards, 12dp radius, hairline
borders, 16dp margins. No gradients.
```

#### INT-OP-02 · Task detail ★ critical
`perm: tasks_view` · `states: offline, conflict, error`

```
Role: internal RetailOps staff — Admin / Super Admin, Operational Manager, Brand Manager, Catalog Manager, Listing Team, Reviewer, Viewer. Scope: all/assigned. Permission: tasks_view.
Required states: offline-cached, conflict, error-recovery.

Design a single Android Material 3 mobile task detail screen for RetailOps, an internal B2B
e-commerce operations app.
Top app bar: back arrow, a two-line title — "Tasks" in 12sp grey above "TI-10482" in 16sp medium
monospace — with an overflow menu. Bottom navigation with 5 items — Home, Catalog, Growth, Ops,
More — Ops selected.
Body, top to bottom:
1. A full-width SLA strip in light red: an alert icon, the word "Overdue" in 14sp medium, and
   "by 2 h 14 m" in tabular figures on the right.
2. A white card with the task title in 18sp medium "Correct price on B0XXXXXXXXXX", and a row of
   chips — "High priority" in red, "Seller A", "Nike", "Price correction".
3. A details card with label–value rows: "Assignee" with a small avatar and name,
   "Reviewer" with an avatar and name, "Due 2 Oct, 6:00 PM", "Created 30 Sep by Priya Sharma",
   and "SLA policy Standard 48h".
4. A section header "Checklist" with a progress caption "2 of 5 done" and a thin progress bar,
   above 5 checkbox rows — two ticked with strikethrough text, three unticked.
5. A section header "Attachments (3)" above a row of 3 attachment tiles with file icons and names,
   one showing a small upload progress bar.
6. A section header "Activity" with a "Comment" text button, above 3 timeline entries, each with a
   small avatar, a sentence such as "Priya Sharma changed status to In progress" and a relative
   timestamp.
At the bottom, a sticky action bar with an outlined button "Add comment" and a filled button
"Mark complete". Flat cards, 16dp margins, no gradients.
```

#### INT-OP-03 · Task create
`perm: tasks_manage`
```
Role: internal RetailOps staff — Admin / Super Admin, Operational Manager, Brand Manager, Catalog Manager, Listing Team, Reviewer, Viewer. Scope: all/assigned. Permission: tasks_manage.
Required states: conflict, error-recovery.

Design a single Android Material 3 mobile task creation form for RetailOps, an internal B2B
e-commerce operations app.
Top app bar: a close icon, title "New task", and a text button "Save". Bottom navigation with
5 items — Home, Catalog, Growth, Ops, More — Ops selected.
Body as a vertical form: a filled field "Title"; a filled multiline field "Description" with a
supporting line showing a character count; a filled field "Template" with a dropdown caret showing
"Standard Quality Audit"; a filled field "Seller" with a caret showing "Seller A"; a segmented
control "Priority" with "Low / Medium / High / Urgent" and Medium selected; a filled field
"Assignee" showing a small avatar and a name; a filled field "Reviewer" with an avatar; a row of
two fields side by side, "Due date" showing "8 Oct 2026" with a calendar icon and "SLA" showing
"Standard 48h"; and a section header "Attachments" above a row of an add-file tile and one
attached file. At the bottom, a sticky bar with an outlined "Cancel" and a filled "Create task".
Flat fields, 16dp margins, no gradients.
```

#### INT-OP-04 · Task comments & activity
`states: empty, offline`
```
Role: internal RetailOps staff — Admin / Super Admin, Operational Manager, Brand Manager, Catalog Manager, Listing Team, Reviewer, Viewer. Scope: all/assigned. Permission: tasks_view.
Required states: empty-true, offline-cached.

Design a single Android Material 3 mobile comments screen for RetailOps, an internal B2B
e-commerce operations app, for one task.
Top app bar: back arrow, a two-line title — "TI-10482" above "Comments and activity" — with an
overflow menu. Bottom navigation with 5 items — Home, Catalog, Growth, Ops, More — Ops selected.
Body: a scrollable timeline of 6 entries. Comment entries have an avatar, the author name in 14sp
medium, the message text in 14sp, and a relative timestamp with a small "Edited" caption on one.
System entries are centred, smaller and grey, with a tiny icon — for example "Priya Sharma changed
status to In progress" or "SLA warning sent to assignee". One comment has a single attachment chip
with a file icon and name attached beneath it, and a small reaction row with two emoji and counts.
At the bottom, a sticky composer bar: a rounded multiline text field with the placeholder "Write a
comment", and a send button in a circular primary container. Flat, 16dp margins, dividers between
entries, no gradients.
```

#### INT-OP-05 · Task templates
`perm: templates_manage` · `states: empty`
```
Role: internal RetailOps staff — Admin / Super Admin, Operational Manager. Scope: all. Permission: templates_manage.
Required states: empty-true.

Design a single Android Material 3 mobile template list screen for RetailOps, an internal B2B
e-commerce operations app.
Top app bar: back arrow, title "Task templates", a plus icon. Bottom navigation with 5 items —
Home, Catalog, Growth, Ops, More — Ops selected.
Body: a search field labelled "Search templates", then a segmented control "All / Daily / Weekly /
One time" with All selected. Below, a list of 6 template cards. Each card has a template code chip
in monospace such as "TPL-0001", a 14sp name such as "Standard Quality Audit", a secondary line
with the category and department such as "Compliance · Operations", and a footer row with the
default assignee role and the default SLA "48 h". One card is inactive and dimmed with a grey
"Disabled" chip. Flat cards with hairline borders, 16dp margins, no gradients, no floating action
button over the nav bar.
```

#### INT-OP-06 · Task template detail
`perm: templates_manage` · `states: conflict`
```
Role: internal RetailOps staff — Admin / Super Admin, Operational Manager. Scope: all. Permission: templates_manage.
Required states: conflict.

Design a single Android Material 3 mobile template detail and edit screen for RetailOps, an
internal B2B e-commerce operations app.
Top app bar: back arrow, a two-line title — "Templates" above "TPL-0001" in monospace — and an
overflow menu. Bottom navigation with 5 items — Home, Catalog, Growth, Ops, More — Ops selected.
Body: a header card with the template name "Standard Quality Audit" in 16sp medium, a secondary
line "Compliance · Operations", and a row of small chips "Medium priority", "48 h SLA", "Active".
Below, a section header "Defaults" with label–value rows — "Assignee role Brand Manager",
"Reviewer role Reviewer", "SLA policy Standard 48h", "Frequency One time", "Business days only
Yes". Then a section header "Checklist template" with a reorderable list of 4 rows, each with a
drag handle and a description, plus an "+ Add item" row. Then a section header "Assignment rules"
with 2 rows describing conditions and a chevron. Flat cards, 16dp margins, no gradients.
```

#### INT-OP-07 · Approval queue
`states: empty, filtered-empty`
```
Role: internal RetailOps staff — Reviewer, Admin / Super Admin. Scope: all/assigned. Permission: tasks_manage.
Required states: empty-true, empty-filtered.

Design a single Android Material 3 mobile approval queue screen for RetailOps, an internal B2B
e-commerce operations app.
Top app bar: back arrow, title "Approvals", and a filter icon. Bottom navigation with 5 items —
Home, Catalog, Growth, Ops, More — Ops selected, with a badge showing 3.
Body: a summary row reading "3 waiting on you" with a secondary caption "Oldest 1 d 4 h". Below, a
segmented control "Waiting / Approved by me / Rejected" with Waiting selected. Then 3 approval
cards. Each card has a 14sp title such as "Price correction for 12 products", a secondary line
"Requested by Priya Sharma · 4 h ago", a row of chips with the seller and brand, and a short
preview line describing the change. At the bottom of each card, two full-width buttons side by
side — an outlined "Reject" and a filled "Approve" — plus a text button "View details" above them.
One card is expanded to show a small before/after comparison table with three rows. Flat cards,
16dp margins, no gradients.
```

#### INT-OP-08 · Escalations
`states: empty, stale`
```
Role: internal RetailOps staff — Admin / Super Admin, Operational Manager. Scope: all. Permission: tasks_view.
Required states: empty-true, stale-partial.

Design a single Android Material 3 mobile escalations screen for RetailOps, an internal B2B
e-commerce operations app.
Top app bar: back arrow, title "Escalations", a filter icon. Bottom navigation with 5 items —
Home, Catalog, Growth, Ops, More — Ops selected.
Body: a summary card with three inline stats separated by dividers — "Open 6", "Breached SLA 2" in
red, "Resolved this week 14". Below, a segmented control "Open / Breached / Resolved" with Open
selected. Then a list of 4 escalation cards. Each card has a level chip such as "Level 2" in amber
or "Level 3" in red, a 14sp description such as "SLA breached — nobody assigned", a secondary line
with the related task ID in monospace and the seller, a row noting "Escalated to Admin · 40 min
ago", and a right-aligned chevron. Flat cards, 16dp margins, no gradients.
```

#### INT-OP-09 · SLA policies
`perm: tasks_manage` · `states: empty`
```
Role: internal RetailOps staff — Admin / Super Admin. Scope: all. Permission: tasks_manage.
Required states: empty-true.

Design a single Android Material 3 mobile SLA policy list screen for RetailOps, an internal B2B
e-commerce operations app.
Top app bar: back arrow, title "SLA policies", a plus icon. Bottom navigation with 5 items — Home,
Catalog, Growth, Ops, More — Ops selected.
Body: a list of 4 policy cards. The first is marked as the default with a small blue chip
"Default". Each card shows the policy name in 14sp medium such as "Standard 48h", a secondary line
"Applies to 42 templates", and a row of three small stat chips — "48 h", "Warn at 24 h / 12 h / 6 h"
and "India calendar". Below the stats, a compact horizontal timeline showing a line with 4 dots
labelled "Start", "24 h", "12 h", "Breach" to visualise the warning thresholds. One card is
inactive and dimmed with a grey chip. Flat cards, 16dp margins, no gradients.
```

#### INT-OP-10 · PEMS daily routine
`states: empty, offline`
```
Role: internal RetailOps staff — Admin / Super Admin, Operational Manager, Brand Manager, Catalog Manager, Listing Team, Reviewer, Viewer. Scope: all/assigned. Permission: tasks_view.
Required states: empty-true, offline-cached.

Design a single Android Material 3 mobile daily routine screen for RetailOps, an internal B2B
e-commerce operations app.
Top app bar: back arrow, title "Daily routine", and a "Generate" text button. Bottom navigation
with 5 items — Home, Catalog, Growth, Ops, More — Ops selected.
Body: a header card showing today's date "3 October 2026" and the caption "42 tasks generated at
6:00 AM". Below, a horizontal scrollable row of 4 small summary tiles — "Generated 42",
"Assigned 38", "Completed 22", "Overdue 4" in red. Then a section header "By brand" above 5 rows,
each with the brand name in 14sp medium, a thin progress bar, and right-aligned tabular figures
"18 / 20" above a small coloured percentage. Include a small amber chip "Unassigned" on one row.
At the bottom, an outlined button "Re-assign unassigned" and a caption "Routine runs daily at
6:00 AM IST". Flat cards, 16dp margins, no gradients.
```

#### INT-OP-11 · Scorecards
`states: empty, offline`
```
Role: internal RetailOps staff — Admin / Super Admin, Operational Manager. Scope: all. Permission: tasks_view.
Required states: empty-true, offline-cached.

Design a single Android Material 3 mobile scorecard screen for RetailOps, an internal B2B
e-commerce operations app, showing team performance.
Top app bar: back arrow, title "Scorecards", and a date range chip. Bottom navigation with 5 items
— Home, Catalog, Growth, Ops, More — Ops selected.
Body: a segmented control "This week / This month / This quarter" with This week selected. Then a
podium-style summary card listing the top 3 performers with small avatars, names and scores in
tabular figures. Below, a section header "All team members" above a list of 6 rows. Each row has an
avatar, the person's name in 14sp medium, a secondary line "42 tasks · 96% on time", and a
right-aligned score in tabular figures with a small coloured delta versus last week. A thin
horizontal bar under each row shows relative score. One row is marked with an amber chip
"2 breached". Flat cards, 16dp margins, no gradients.
```

#### INT-OP-12 · Action Center list
`perm: actions_view` · `states: empty, filtered-empty, selection`
```
Role: internal RetailOps staff — Admin / Super Admin, Operational Manager, Brand Manager, Catalog Manager, Listing Team, Reviewer, Viewer. Scope: all/assigned. Permission: actions_view.
Required states: empty-true, empty-filtered, selection-bulk.

Design a single Android Material 3 mobile action center screen for RetailOps, an internal B2B
e-commerce operations app.
Top app bar: back arrow, title "Action Center", a search icon and an overflow menu. Bottom
navigation with 5 items — Home, Catalog, Growth, Ops, More — Ops selected.
Body: a segmented control "Assigned to me / My team / All" with Assigned to me selected. Then a
row of filter chips — "Today", "High impact ×" — plus "Clear all". Below, a list of 5 action
cards. Each card has a coloured impact chip such as "High impact" in red or "Medium" in amber, a
14sp action title such as "Reduce ad spend on 3 campaigns", a secondary line with the seller and
the expected effect, and a footer row with a due time and a small avatar for the owner. One card
shows a thin progress bar labelled "2 of 4 steps". One card is selected with a 2dp primary border
and a checkbox. Flat cards, 16dp margins, no gradients.
```

#### INT-OP-13 · Action detail
`states: offline, error`
```
Role: internal RetailOps staff — Admin / Super Admin, Operational Manager, Brand Manager, Catalog Manager, Listing Team, Reviewer, Viewer. Scope: all/assigned. Permission: actions_view.
Required states: offline-cached, error-recovery.

Design a single Android Material 3 mobile action detail screen for RetailOps, an internal B2B
e-commerce operations app.
Top app bar: back arrow, a two-line title — "Action Center" above "ACT-2081" in monospace — with
an overflow menu. Bottom navigation with 5 items — Home, Catalog, Growth, Ops, More — Ops
selected.
Body: a header card with the impact chip "High impact" in red, the action title in 18sp medium
"Reduce ad spend on 3 campaigns", and a secondary line "Seller A · expected saving ₹18,400/month".
Below, a details card with label–value rows — "Owner" with avatar and name, "Due 6 Oct",
"Created 1 Oct", "Source AI review". Then a section header "Steps" with a progress caption
"2 of 4 done" and a thin progress bar above 4 rows — two ticked with strikethrough, two unticked
with a small due time. Then a section header "Evidence" with a compact table of 3 rows showing
spend and sales for the affected campaigns, in tabular figures. At the bottom, a sticky bar with an
outlined "Snooze" and a filled "Mark step done". Flat cards, 16dp margins, no gradients.
```

#### INT-OP-14 · Rulesets list
`perm: rules_view` · `states: empty, filtered-empty`
```
Role: internal RetailOps staff — Admin / Super Admin, Operational Manager, Brand Manager, Catalog Manager, Listing Team, Reviewer, Viewer. Scope: all. Permission: rules_view.
Required states: empty-true, empty-filtered.

Design a single Android Material 3 mobile ruleset list screen for RetailOps, an internal B2B
e-commerce operations app.
Top app bar: back arrow, title "Rulesets", a search icon and a filter icon. Bottom navigation with
5 items — Home, Catalog, Growth, Ops, More — Ops selected.
Body: a summary strip with 4 small stat chips — "Total 24", "Active 18", "Auto-run 11", "Paused 6".
Below, a search field labelled "Search rules" and a sort row "Sort: Last run". Then a list of 5
ruleset cards. Each card has a 14sp name such as "Pricing guardrails", a secondary line describing
the trigger such as "Runs hourly · 6 sellers", a small chip for the type such as "Pricing" or
"Ranking", a footer row with "Last run 12 min ago · 148 actions" and a right-aligned switch that is
on for four cards and off for one. Flat cards, 16dp margins, no gradients.
```

#### INT-OP-15 · Ruleset detail
`states: offline`
```
Role: internal RetailOps staff — Admin / Super Admin, Operational Manager, Brand Manager, Catalog Manager, Listing Team, Reviewer, Viewer. Scope: all. Permission: rules_view.
Required states: offline-cached.

Design a single Android Material 3 mobile ruleset detail screen for RetailOps, an internal B2B
e-commerce operations app.
Top app bar: back arrow, a two-line title — "Rulesets" above "Pricing guardrails" — with an
overflow menu. Bottom navigation with 5 items — Home, Catalog, Growth, Ops, More — Ops selected.
Body: a header card with the ruleset name in 16sp medium, a row of chips "Active", "Hourly",
"6 sellers", and a footer line "Last run 12 min ago · next run in 48 min". Below, a section header
"Conditions" with a readable sentence block in a tinted card — "When Buy Box price decreases by
more than 15% for any tracked ASIN" — followed by chips listing the scoped sellers. Then a section
header "Actions" with 3 rows, each with a step number circle, an action description such as
"Create a high-priority task for the brand manager", and a small toggle. Then a section header
"Recent runs" with a "See all" text button, above 3 compact rows showing a timestamp, a result
summary such as "148 actions across 42 ASINs" and a small green or amber status chip. Flat cards,
16dp margins, no gradients.
```

#### INT-OP-16 · Ruleset run summary
`states: empty, stale`
```
Role: internal RetailOps staff — Admin / Super Admin, Operational Manager, Brand Manager, Catalog Manager, Listing Team, Reviewer, Viewer. Scope: all. Permission: rules_view.
Required states: empty-true, stale-partial.

Design a single Android Material 3 mobile run summary screen for RetailOps, an internal B2B
e-commerce operations app, for one ruleset execution.
Top app bar: back arrow, title "Run · 12 min ago", and an overflow menu. Bottom navigation with
5 items — Home, Catalog, Growth, Ops, More — Ops selected.
Body: a summary card with three inline stats separated by dividers — "142 evaluated", "148 actions"
and "4 errors" in red. Below, a segmented control "Actions / Evaluated / Errors" with Actions
selected. Then a list of 5 rows, each with a small icon, a 14sp description such as "Price
correction task created for B0XXXXXXXXXX", a secondary line with the seller and brand, and a
right-aligned relative timestamp. Error rows use a red icon and a short cause line such as "Seller
token expired". At the bottom, an outlined button "Export run log". Flat cards, 16dp margins, no
gradients.
```

#### INT-OP-17 · Scheduled runs
`perm: scraping_view` · `states: empty, filtered-empty, offline`
```
Role: internal RetailOps staff — Admin / Super Admin, Operational Manager, Brand Manager, Catalog Manager, Listing Team, Reviewer, Viewer. Scope: all. Permission: scraping_view.
Required states: empty-true, empty-filtered, offline-cached.

Design a single Android Material 3 mobile scheduled runs screen for RetailOps, an internal B2B
e-commerce operations app.
Top app bar: back arrow, title "Scheduled runs", a filter icon and an overflow menu. Bottom
navigation with 5 items — Home, Catalog, Growth, Ops, More — Ops selected.
Body: a segmented control "Today / This week / Failed" with Today selected. Then a list of 6 run
rows, each with a status icon in a tinted circle — green check for success, blue spinner for
running, red for failed — a run name in 14sp medium such as "Octoparse — ASIN price sync", a
secondary line with the schedule and duration such as "Every 6 h · ran for 18 min", and a
right-aligned relative time. A running row shows a thin indeterminate progress bar beneath it. A
failed row shows a short cause line in red such as "Login timeout on seller token" and a "Retry"
text button. Flat rows with dividers, 16dp margins, no gradients.
```

#### INT-OP-18 · Run detail & logs
`states: offline, error`
```
Role: internal RetailOps staff — Admin / Super Admin, Operational Manager, Brand Manager, Catalog Manager, Listing Team, Reviewer, Viewer. Scope: all. Permission: scraping_view.
Required states: offline-cached, error-recovery.

Design a single Android Material 3 mobile run detail screen for RetailOps, an internal B2B
e-commerce operations app.
Top app bar: back arrow, a two-line title — "Scheduled runs" above "Octoparse price sync" — with
an overflow menu. Bottom navigation with 5 items — Home, Catalog, Growth, Ops, More — Ops selected.
Body: a status card with a green check icon, "Succeeded" in 14sp medium, and three inline stats
separated by dividers — "Started 4:12 AM", "Duration 18 m 42 s", "Rows 1,24,802". Below, a section
header "Timeline" above 4 rows, each with a small dot connected by a vertical line, a stage name
such as "Authenticated", "Fetched 6 sellers", "Parsed 1,24,802 rows" or "Wrote to database", and a
right-aligned duration in tabular figures. Then a section header "Logs" with a "Copy" text button,
above a dark monospace log block with 6 timestamped lines in 12sp, one line highlighted in amber as
a warning. At the bottom, a segmented control "All / Warnings / Errors" with All selected. Flat
cards, 16dp margins, no gradients.
```

#### INT-OP-19 · Scraper tasks
`states: empty, offline, stale`
```
Role: internal RetailOps staff — Admin / Super Admin, Operational Manager, Brand Manager, Catalog Manager, Listing Team, Reviewer, Viewer. Scope: all. Permission: scraping_view.
Required states: empty-true, offline-cached, stale-partial.

Design a single Android Material 3 mobile scraper task list screen for RetailOps, an internal B2B
e-commerce operations app.
Top app bar: back arrow, title "Scraper tasks", a filter icon and an overflow menu. Bottom
navigation with 5 items — Home, Catalog, Growth, Ops, More — Ops selected.
Body: a summary card with three inline stats separated by dividers — "Active 12", "Paused 3",
"Failing 1" in red. Below, a list of 5 scraper cards. Each card has a 14sp task name such as
"Amazon BSR — Seller A", a secondary line with the cadence and last result such as "Every 12 h ·
last run 2 h ago", a small chip for the marketplace, and a right-aligned switch. One card carries a
red chip "Failing" with a secondary line "3 consecutive failures" and a "Retry" text button. Flat
cards, 16dp margins, no gradients.
```

#### INT-OP-20 · Scraper task detail
`states: offline, error`
```
Role: internal RetailOps staff — Admin / Super Admin, Operational Manager, Brand Manager, Catalog Manager, Listing Team, Reviewer, Viewer. Scope: all. Permission: scraping_view.
Required states: offline-cached, error-recovery.

Design a single Android Material 3 mobile scraper task detail screen for RetailOps, an internal
B2B e-commerce operations app.
Top app bar: back arrow, a two-line title — "Scraper tasks" above "Amazon BSR — Seller A" — with an
overflow menu. Bottom navigation with 5 items — Home, Catalog, Growth, Ops, More — Ops selected.
Body: a status card with an amber warning icon and the word "Failing" in 14sp medium, a secondary
line "3 consecutive failures since 1 Oct", and a "Retry now" tonal button on the right. Below, a
details card with label–value rows — "Seller Seller A", "Marketplace Amazon India", "Cadence Every
12 h", "Last success 1 Oct, 4:12 AM", "Next attempt 3 Oct, 4:12 AM", "Tracked ASINs 1,248". Then a
section header "Recent attempts" above 4 rows, each with a date and time in tabular figures, a
duration, and a red or green outcome chip. The most recent failed row expands to show a short error
message in a tinted red block with monospace text. At the bottom, an outlined button "Pause task"
and a filled button "Retry now". Flat cards, 16dp margins, no gradients.
```

#### INT-OP-21 · Live sync monitor
`states: offline, stale`
```
Role: internal RetailOps staff — Admin / Super Admin, Operational Manager, Brand Manager, Catalog Manager, Listing Team, Reviewer, Viewer. Scope: all. Permission: scraping_view.
Required states: offline-cached, stale-partial.

Design a single Android Material 3 mobile live sync monitor screen for RetailOps, an internal B2B
e-commerce operations app.
Top app bar: back arrow, title "Live sync", and a small "Auto-refresh on" chip. Bottom navigation
with 5 items — Home, Catalog, Growth, Ops, More — Ops selected.
Body: a wide status card at the top with a large circular progress ring showing 68% in primary
blue, a caption "Syncing 4 of 6 sellers" and a secondary line "Started 4:12 AM · 12 min elapsed".
Below, a section header "Sellers" with a "Live" indicator dot, above a list of 6 rows. Each row has
the seller name in 14sp medium, a status chip — a blue "Syncing" with a small spinner, a green
"Done", or a grey "Queued" — and right-aligned progress in tabular figures such as "18,420 / 24,180
ASINs" with a thin progress bar beneath the row. One row shows a red "Failed" chip with the caption
"Token expired" and a "Retry" text button. At the bottom, a caption "Last full sync 2 h ago". Flat
cards, 16dp margins, no gradients.
```
