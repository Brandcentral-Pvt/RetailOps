# RetailOps Android — Stitch Prompts: Seller Surface

**Document ID:** `RO-MOB-DS-011` · Companion to `07-stitch-setup-and-workflow.md`
**Screens:** 26

> **Generate these in the `RetailOps Seller` project**, with `DESIGN.md` set to the **teal**
> surface accent (`#0E7490`), because this is a different product with a different reader.
> Two rules apply to every prompt here:
>
> 1. **No seller switcher, ever.** The account is fixed. The app bar shows the seller's name.
> 2. **Plain merchant language only.** "Sales (GMS)", "Advertising", "Requests", "Data refresh",
>    "Products". Never "PESM", "scraper", "ruleset", "ASIN Manager", "SLA breach".
>
> The bottom navigation for this surface is always
> `Home · Performance · My Products · Requests · More`.

---

## 1. Home (3 screens)

---

#### SEL-HM-01 · Home — snapshot ★ critical
```
Role: seller client (paying merchant) — Seller. Scope: own. Permission: dashboard_view.
Required states: empty-true, offline-cached, stale-partial, error-recovery.

Design a single Android Material 3 mobile home screen for RetailOps Seller, a merchant app where
an Amazon seller tracks their own account.
Top app bar: the seller name "Seller A" in 16sp medium with a small teal chip beneath reading
"Seller", and a notification bell on the right. There is no seller switcher.
Bottom navigation bar with 5 items: Home, Performance, My Products, Requests, More — show Home
selected, with a badge showing 2 on the Requests item.
Body, top to bottom:
1. A friendly greeting block: "Good morning, Rahul" in 20sp, with a secondary line
   "Seller A · Amazon India" and a small teal "Seller" chip on the right.
2. A slim freshness strip with a refresh icon reading "Updated 12 min ago" and a right-aligned
   "Refresh".
3. A 2-column grid of 2 KPI cards: "Sales (GMS) ₹12.5L ▲ +12.4% vs last month" and
   "Ad spend ₹1.2L ▲ +4.0% in amber". Each card has a label, a large tabular value, and a delta
   row with an arrow.
4. A wide target progress card: a label "This month vs target", a bold teal progress bar at 78%,
   then a footer row with tabular figures "₹12.5L of ₹16L" on the left and "9 days left" on the
   right.
5. A section header "Needs your input (2)" with a "See all" text button, followed by 2 cards with
   an amber left accent and a chevron — "Approve price change for 3 products" with the secondary
   line "Waiting 4 hours", and "Share your Diwali stock plan" with the secondary line
   "Due 8 October".
6. A section header "What changed" with a "See all" text button, followed by 2 short lines with
   icons — "4 products lost the Buy Box" in amber and "12 products improved their rank" in green.
7. An account manager card: a circular avatar, "Priya Sharma" in 14sp medium, a secondary line
   "Your account manager · Replies within 2 hours" with a small green dot, and two small buttons on
   the right, a filled "Chat" and an outlined "Call".
Use Indian currency grouping. Teal accents, generous spacing, calm and reassuring. Flat white cards
with hairline borders, 12dp radius, 16dp margins. No gradients, no imagery.
```

#### SEL-HM-02 · What changed
```
Role: seller client (paying merchant) — Seller. Scope: own. Permission: dashboard_view.
Required states: empty-true, offline-cached.

Design a single Android Material 3 mobile "what changed" screen for RetailOps Seller, a merchant
app for Amazon sellers.
Top app bar: back arrow, title "What changed", and a date range chip "Last 7 days" on the right.
Bottom navigation with 5 items — Home, Performance, My Products, Requests, More — Home selected.
Body: a segmented control "Today / 7 days / 30 days" with 7 days selected. Below, two summary cards
side by side: a green-tinted card reading "12 improved" with a small up arrow and a caption
"Average rank gain 34 places", and an amber-tinted card reading "4 got worse" with a small down
arrow and a caption "Average rank loss 22 places". Then a section header "Improved" above 4 rows,
each with a small product square, the product name in 14sp medium on one line, a secondary line
showing the rank change in tabular figures "104 → 68", and a small green chip "+36". Then a section
header "Got worse" above 3 similar rows with red chips and the change shown as "142 → 188".
Flat cards, 16dp margins, no gradients.
```

#### SEL-HM-03 · Needs your input
```
Role: seller client (paying merchant) — Seller. Scope: own. Permission: tasks_view.
Required states: empty-true, offline-cached.

Design a single Android Material 3 mobile "needs your input" screen for RetailOps Seller, a
merchant app for Amazon sellers.
Top app bar: back arrow, title "Needs your input", and a "2 waiting" chip on the right. Bottom
navigation with 5 items — Home, Performance, My Products, Requests, More — Home selected.
Body: a caption card at the top with an info icon reading "These items are waiting on you. Your
account team is blocked until you respond." Below, a list of 3 request cards. Each card has an
amber left accent stripe, a 14sp title such as "Approve price change for 3 products" or "Share your
Diwali stock plan", a secondary line naming who asked — "Asked by Priya Sharma · 4 hours ago" — and
a due chip such as "Due tomorrow" in amber. Each card has a footer with two buttons — a text button
"Not now" and a filled "Review". One card is expanded to show a short explanation of two lines.
Flat cards, 16dp margins, no gradients.
```

---

## 2. Performance (8 screens)

---

#### SEL-PF-01 · Performance overview ★ critical
```
Role: seller client (paying merchant) — Seller. Scope: own. Permission: dashboard_view.
Required states: empty-true, offline-cached, stale-partial.

Design a single Android Material 3 mobile performance overview screen for RetailOps Seller, a
merchant app for Amazon sellers.
Top app bar: title "Performance", with a rounded chip "Seller A" and a small amber chip
"Updated 12 min ago" beneath it. Bottom navigation with 5 items — Home, Performance, My Products,
Requests, More — show Performance selected.
Body, top to bottom:
1. A segmented control "7 days / 30 days / 90 days / Custom" with 30 days selected.
2. A hero card with a large tabular value "₹12,48,300" labelled "Sales (GMS)", a delta row
   "▲ +12.4% compared to the previous 30 days" in green, and a 40dp sparkline beneath.
3. A 2-column grid of 4 KPI cards: "Units 8,420 ▲ +3.1%", "Advertising 18.3% of sales
   ▲ +1.2% in amber", "Avg. selling price ₹4,999 ▼ −1.8%", "Returns 4.5% ▼ −0.4% in green".
4. A section header "Sales over time" with a full-width smooth area chart in teal, a light grid,
   and a "View as table" text button at the top right.
5. A section header "Top movers" with a "See all" text button, followed by 3 product rows, each
   with a small product square, a product name on one line, and a right-aligned sales value in
   tabular figures above a small coloured delta.
Use Indian currency grouping and tabular figures. Calm, airy, plain language. Flat white cards,
12dp radius, 16dp margins, teal accents. No gradients.
```

#### SEL-PF-02 · Sales / GMS
```
Role: seller client (paying merchant) — Seller. Scope: own. Permission: gms_tracker_view.
Required states: empty-true, offline-cached, stale-partial.

Design a single Android Material 3 mobile sales detail screen for RetailOps Seller, a merchant app
for Amazon sellers.
Top app bar: back arrow, title "Sales", and an export icon. Bottom navigation with 5 items — Home,
Performance, My Products, Requests, More — Performance selected.
Body: a segmented control "Month / Quarter / Year" with Month selected. Below, a summary card with
three inline stats separated by dividers — "GMS ₹12.5L", "Units 8,420", "Avg. price ₹4,999" — all
in tabular figures. Then a 12-month column chart with rounded bar tops in teal, the current month
highlighted darker, and a light grid with minimal axis labels. Under the chart, a "View as table"
text button aligned right. Then a section header "By marketplace" above 3 rows, each with the
marketplace name, a thin progress bar, and right-aligned tabular figures "₹9.84L · 79%". Then a
section header "By category" above 4 similar rows. Flat cards, 16dp margins, no gradients.
```

#### SEL-PF-03 · Advertising
```
Role: seller client (paying merchant) — Seller. Scope: own. Permission: adsreport_view.
Required states: empty-true, offline-cached, stale-partial.

Design a single Android Material 3 mobile advertising screen for RetailOps Seller, a merchant app
for Amazon sellers.
Top app bar: title "Advertising", with a small amber chip "Updated 1 day ago" beneath it. Bottom
navigation with 5 items — Home, Performance, My Products, Requests, More — Performance selected.
Body: a segmented control "7 days / 30 days / 90 days" with 30 days selected. Then a 2-column grid
of 4 KPI cards: "Ad spend ₹1,24,300 ▲ +4.0%", "Ad sales ₹6,82,900 ▲ +9.1%", "Return on ad spend
5.49x ▲ +0.3x", and "Cost of advertising 18.3% of sales ▲ +1.2%" shown in amber with a caption
"Lower is better". Each card has a label, a large tabular value and a delta row with an arrow.
Below, a section header "Spend and sales" with a combo chart — bars for spend in light teal and a
line for sales in deep teal — with a small legend above and a "View as table" text button. Then a
section header "Your campaigns" with 3 campaign rows, each with the campaign name on one line and a
right-aligned return value in tabular figures above a coloured delta. Flat cards, 16dp margins,
teal accents, no gradients.
```

#### SEL-PF-04 · Campaign detail
```
Role: seller client (paying merchant) — Seller. Scope: own. Permission: adsreport_view.
Required states: offline-cached, stale-partial.

Design a single Android Material 3 mobile campaign detail screen for RetailOps Seller, a merchant
app for Amazon sellers.
Top app bar: back arrow, a two-line title — "Advertising" in 12sp grey above "Yoga mats — Auto" in
16sp medium — with an overflow menu. Bottom navigation with 5 items — Home, Performance, My
Products, Requests, More — Performance selected.
Body: a header card with a small teal chip "Sponsored Products", a status chip "Active", and a
secondary line "Started 12 Aug 2026". Below, a 2-column grid of 4 metric tiles: "Spend ₹24,300",
"Sales ₹98,400", "Return 4.05x", and "Cost of advertising 24.7% of sales" in amber. Then a
segmented control "Spend / Sales / Return" with Spend selected, above a 30-day daily bar chart with
light gridlines and a "View as table" text button. Then a section header "Top keywords" above 4
rows, each with the keyword text on one line, and a right-aligned spend in tabular figures above a
small return value. Flat cards, 16dp margins, no gradients.
```

#### SEL-PF-05 · Target vs achievement
```
Role: seller client (paying merchant) — Seller. Scope: own. Permission: targets_view.
Required states: empty-true, offline-cached.

Design a single Android Material 3 mobile target screen for RetailOps Seller, a merchant app for
Amazon sellers.
Top app bar: back arrow, title "Target", and a month selector row "October 2026" with left and
right chevrons. Bottom navigation with 5 items — Home, Performance, My Products, Requests, More —
Performance selected.
Body: a hero card showing a large teal circular progress ring at 78% with "78%" in the centre in
28sp tabular, a caption "of your monthly target" beneath, and a secondary line "₹12.5L of ₹16L".
Below, a 30-day line chart with two series — actual sales as a solid teal line and the target as a
grey dashed line — with a small legend above and a "View as table" text button. Then a section
header "Where you stand" with three rows, each with a status dot and label–value text in tabular
figures: "You're 4% behind the pace for today", "9 days left in October", "You need ₹3.5L more to
hit target". The first row has an amber dot, the others grey. At the bottom, an info card with a
lightbulb icon reading "Your sales are 12% higher than the same month last year." Flat cards, 16dp
margins, teal accents, no gradients.
```

#### SEL-PF-06 · Reports library
```
Role: seller client (paying merchant) — Seller. Scope: own. Permission: skureport_view etc..
Required states: empty-true.

Design a single Android Material 3 mobile reports library screen for RetailOps Seller, a merchant
app for Amazon sellers.
Top app bar: title "Reports", with a rounded chip "Seller A" beneath it. Bottom navigation with
5 items — Home, Performance, My Products, Requests, More — Performance selected.
Body: a short caption "Download a report, or view one on your phone." Then a section header
"Sales" above 3 rows, each with a leading icon in a soft teal circle, a title in 14sp medium and a
secondary line — "Sales by product · Revenue and units for every product", "Sales by month ·
Month-over-month comparison", "Sales and advertising · How ad spend affects sales" — each with a
chevron. Then a section header "Products" above 2 similar rows: "Stock and inventory · What's
running low" and "Product ratings · Rating changes and reviews". Then a section header "Recent
downloads" above 2 rows with a file icon, a file name, a secondary line with size and date, and a
download icon button. Flat cards, 16dp margins, no gradients.
```

#### SEL-PF-07 · Report viewer
`states: offline, stale`
```
Role: seller client (paying merchant) — Seller. Scope: own. Permission: per report.
Required states: offline-cached, stale-partial.

Design a single Android Material 3 mobile report viewer screen for RetailOps Seller, a merchant app
for Amazon sellers, showing the "Sales by product" report.
Top app bar: back arrow, a two-line title — "Reports" in 12sp grey above "Sales by product" in 16sp
medium — with a download icon and a share icon. Bottom navigation with 5 items — Home,
Performance, My Products, Requests, More — Performance selected.
Body: a control row with a rounded chip "1 Sep – 30 Sep" with a calendar icon, a chip "vs last
month", and a small amber chip "Updated 12 min ago". Below, a summary card with three short
sentences in 14sp, each preceded by a small teal dot — "Sales were up 12.4% on last month",
"Your top 5 products made 41% of sales", "Yoga mats were your fastest-growing category". Then a
segmented control "Chart / Table" with Table selected, above a clean list of 6 rows. Each row has a
small product square, the product name on one line, and a right-aligned block with sales in tabular
figures above units and a small coloured delta. A search field labelled "Find a product" sits above
the list, and a "Load more" text button sits at the end. Flat cards, 16dp margins, no gradients.
```

#### SEL-PF-08 · Report export
`states: download progress`
```
Role: seller client (paying merchant) — Seller. Scope: own. Permission: *_export.
Required states: upload-download.

Design a single Android Material 3 mobile export screen for RetailOps Seller, a merchant app for
Amazon sellers.
Top app bar: back arrow, title "Download report". Bottom navigation with 5 items — Home,
Performance, My Products, Requests, More — Performance selected.
Body: a summary card showing the report name "Sales by product", a secondary line "1 Sep – 30 Sep
2026", and a "Change" text button. Below, a section header "Format" with a segmented control
"Excel (XLSX) / CSV" with Excel selected, and a caption "Excel opens in any spreadsheet app."
Then a section header "Send to" with two radio rows — "Download to this phone" selected, and
"Email to rahul@seller-a.in". At the bottom, a full-width filled button "Download report" and a
caption with a download icon reading "You'll get a notification when it's ready." If a download is
already running, show it above the button as a card with a file icon, a progress bar at 45% and a
"Cancel" text button. Flat cards, 16dp margins, no gradients.
```

---

## 3. My Products (5 screens)

---

#### SEL-PR-01 · My Products — list
`states: empty, filtered-empty, offline, stale`
```
Role: seller client (paying merchant) — Seller. Scope: own. Permission: asinmanager_view.
Required states: empty-true, empty-filtered, offline-cached, stale-partial.

Design a single Android Material 3 mobile product list screen for RetailOps Seller, a merchant app
for Amazon sellers.
Top app bar: title "My Products", with a rounded chip "Seller A" and a caption "1,248 products"
beneath it, plus a search icon. Bottom navigation with 5 items — Home, Performance, My Products,
Requests, More — show My Products selected.
Body: a search field labelled "Search your products". Below, a row of removable filter chips —
"Needs attention ×", "In stock ×" — plus a "Clear all" chip, and a sort row "Sort: Sales,
highest first". Then a list of 5 product cards. Each card: a small square product image on the
left, the product name in 14sp medium on up to two lines, a secondary line with the price and
stock such as "₹4,499 · 84 in stock", and a metric row showing rating "★ 4.3 (1.2K)" and rank
"Rank 142". One card carries a red chip "Buy Box lost" and one carries an amber chip "Low stock".
Each card has a chevron on the right. At the end, a centred text button "Load more (25 of 1,248)".
Teal accents, flat white cards with hairline borders, 12dp radius, 16dp margins. No gradients, no
floating action button.
```

#### SEL-PR-02 · Product detail
`states: offline, stale, error`
```
Role: seller client (paying merchant) — Seller. Scope: own. Permission: asinmanager_view.
Required states: offline-cached, stale-partial, error-recovery.

Design a single Android Material 3 mobile product detail screen for RetailOps Seller, a merchant
app for Amazon sellers.
Top app bar: back arrow, title "Product", and a share icon. Bottom navigation with 5 items — Home,
Performance, My Products, Requests, More — My Products selected.
Body, top to bottom:
1. A header card with a product image placeholder on the left, the product name "Nike Air Zoom
   Pegasus 40" in 16sp medium, a secondary line "Amazon India · SKU PEG-40-BLK-9", and a row of
   chips "In stock", "Buy Box owned".
2. A 2-column grid of 4 metric tiles: "Price ₹4,499", "Rank 142", "Rating ★ 4.3 (1.2K)" and
   "Stock 84 units". Each shows a label, a tabular value and a small coloured delta beneath.
3. A section header "Price and rank" with a small 60dp white card containing a compact line chart
   and a "View history" text button on the right.
4. A section header "What you could improve" above 3 rows with icons — "Your title is missing a
   key phrase" in amber, "Add 2 more images" in amber and "Bullets are in good shape" in green —
   each with a short secondary line in plain language.
5. A section header "Advertising" with a compact card showing spend, ad sales and return in
   tabular figures.
Flat cards, 16dp margins, teal accents, plain merchant language, no internal jargon. No gradients.
```

#### SEL-PR-03 · Listing quality
```
Role: seller client (paying merchant) — Seller. Scope: own. Permission: asinmanager_view.
Required states: empty-true, offline-cached.

Design a single Android Material 3 mobile listing quality screen for RetailOps Seller, a merchant
app for Amazon sellers.
Top app bar: back arrow, title "Listing quality", and a filter icon. Bottom navigation with 5 items
— Home, Performance, My Products, Requests, More — My Products selected.
Body: a summary card centred on a score ring showing "76" in 32sp tabular with the caption "Your
average listing score" and a secondary line "1,030 products look good · 218 need attention in
amber". Below, a segmented control "Needs attention / All / Looking good" with Needs attention
selected. Then a list of 4 rows, each with a circular score ring on the left showing a number such
as 42 or 58, the product name on one line in 14sp medium, a secondary line with the ASIN in
monospace, and a right-aligned amber chip naming the weakest area such as "Title" or "Images". At
the bottom, an info card reading "Fixing the titles on your 5 lowest-scoring products could improve
how often they appear in search." Flat cards, 16dp margins, no gradients.
```

#### SEL-PR-04 · Price & rank history
`states: offline, stale`
```
Role: seller client (paying merchant) — Seller. Scope: own. Permission: asintracker_view.
Required states: offline-cached, stale-partial.

Design a single Android Material 3 mobile history screen for RetailOps Seller, a merchant app for
Amazon sellers.
Top app bar: back arrow, a two-line title — "My Products" in 12sp grey above "Nike Air Zoom
Pegasus 40" — with a share icon. Bottom navigation with 5 items — Home, Performance, My Products,
Requests, More — My Products selected.
Body: a segmented control "30 days / 90 days / 1 year" with 90 days selected. Below, a dual-series
line chart with price in deep teal and rank in light teal, a small legend above it, a light grid and
a "View as table" text button at the top right. Under the chart, three stat rows in tabular figures:
"Lowest price ₹3,509 on 1 October", "Highest price ₹4,899 on 12 September" and "Best rank 104 on
28 September", each with a small coloured icon. Then a section header "Price changes" above 3
timeline rows, each with a dot, a description such as "Price changed from ₹4,499 to ₹3,509" and a
relative date. Flat cards, 16dp margins, no gradients.
```

#### SEL-PR-05 · Keyword visibility
`states: empty, filtered-empty, offline`
```
Role: seller client (paying merchant) — Seller. Scope: own. Permission: keywords_view.
Required states: empty-true, empty-filtered, offline-cached.

Design a single Android Material 3 mobile keyword screen for RetailOps Seller, a merchant app for
Amazon sellers.
Top app bar: back arrow, title "Search terms", with a caption "Where your products appear" beneath
it. Bottom navigation with 5 items — Home, Performance, My Products, Requests, More — My Products
selected.
Body: a segmented control "Your products / Search terms" with Search terms selected. Below, a
short caption card with an info icon reading "These are the searches your products appeared in over
the last 30 days." Then a list of 6 rows, each showing the search term in 14sp medium on one line, a
secondary line with tabular figures such as "Shown 24,180 times · Clicked 1,240 times", and a
right-aligned block with the click rate in tabular figures above a small coloured delta. Two rows
carry a small teal chip "High interest". A search field labelled "Find a search term" sits above the
list. Flat rows with dividers, 16dp margins, teal accents, no gradients.
```

---

## 4. Requests (5 screens)

---

#### SEL-RQ-01 · Requests — open
`states: empty, filtered-empty, offline`
```
Role: seller client (paying merchant) — Seller. Scope: own. Permission: tasks_view.
Required states: empty-true, empty-filtered, offline-cached.

Design a single Android Material 3 mobile requests list screen for RetailOps Seller, a merchant app
for Amazon sellers.
Top app bar: title "Requests", with a rounded chip "Seller A" beneath it, and a filter icon.
Bottom navigation with 5 items — Home, Performance, My Products, Requests, More — show Requests
selected, with a badge showing 2.
Body: a tab row with 4 tabs — "Open", "Waiting on you", "Completed", "All" — with Open selected
and a count badge on Waiting on you. Below, a row of removable filter chips — "This month ×" —
plus a "Clear all" chip. Then a list of 4 request cards. Each card has a status chip with an icon
and a word — an amber "Waiting on you" or a blue "In progress" — a 14sp title such as "Approve
price change for 3 products", a secondary line naming the person and time — "Priya Sharma ·
4 hours ago" — and a footer line with a due chip such as "Due tomorrow". One card shows a thin
progress bar labelled "1 of 3 steps". A filled floating action button with a plus icon sits at the
bottom right, 16dp above the navigation bar, for raising a new request. Flat cards, 16dp margins,
no gradients.
```

#### SEL-RQ-02 · Request detail
`states: offline, conflict, error`
```
Role: seller client (paying merchant) — Seller. Scope: own. Permission: tasks_view.
Required states: offline-cached, conflict, error-recovery.

Design a single Android Material 3 mobile request detail screen for RetailOps Seller, a merchant
app for Amazon sellers.
Top app bar: back arrow, a two-line title — "Requests" in 12sp grey above "REQ-2081" in 16sp
monospace — with an overflow menu. Bottom navigation with 5 items — Home, Performance, My
Products, Requests, More — Requests selected.
Body: a status banner at the top in light amber with an icon, the words "Waiting on you" and a
due chip "Due tomorrow". Below, a white card with the request title in 18sp medium "Approve price
change for 3 products" and a secondary line "Asked by Priya Sharma · 4 hours ago". Then a details
card with label–value rows: "For 3 products", "Seller A", "Reason", and a short description in
plain language across two lines. Then a section header "Products in this request" above 3 compact
rows, each with a small product square, a product name on one line, and a right-aligned before and
after price in tabular figures such as "₹4,499 → ₹4,199". Then a section header "Conversation" with
2 short comment rows, each with an avatar and a relative time. At the bottom, a sticky action bar
with two buttons — an outlined "Not now" and a filled "Approve". Flat cards, 16dp margins, no
gradients.
```

#### SEL-RQ-03 · Raise a request
`states: conflict, upload`
```
Role: seller client (paying merchant) — Seller. Scope: own. Permission: tasks_view.
Required states: conflict, upload-download.

Design a single Android Material 3 mobile form screen for RetailOps Seller, a merchant app for
Amazon sellers, for asking their account team for help.
Top app bar: a close icon, title "New request", and a text button "Send". Bottom navigation with
5 items — Home, Performance, My Products, Requests, More — Requests selected.
Body as a friendly guided form: a caption at the top reading "Tell us what you need and your
account team will pick it up." Then a grid of 6 selectable category tiles, each with an icon and a
short label — "Change a price", "Update a listing", "Stock and inventory", "Advertising",
"Report a problem" and "Something else" — with "Change a price" selected using a teal border and a
check. Below, a filled field "Which products?" with a helper line "Add up to 20 products", and a
row of 2 added product chips with small image squares and a remove ×. Then a filled multiline field
"Describe what you need" with a supporting character count, a field "By when?" showing
"8 October 2026" with a calendar icon, and an attachment row with a plus tile and one attached
photo thumbnail. At the bottom, a sticky filled button "Send request". Flat fields, 16dp margins,
teal accents, no gradients.
```

#### SEL-RQ-04 · Waiting on you (approvals)
`states: empty, filtered-empty`
```
Role: seller client (paying merchant) — Seller. Scope: own. Permission: tasks_view.
Required states: empty-true, empty-filtered.

Design a single Android Material 3 mobile approvals screen for RetailOps Seller, a merchant app for
Amazon sellers.
Top app bar: back arrow, title "Waiting on you", and a chip showing "2 items". Bottom navigation
with 5 items — Home, Performance, My Products, Requests, More — Requests selected.
Body: a short caption card reading "Your account team needs a decision from you." Below, 2 approval
cards. The first has a 14sp title "Approve price change", a secondary line "3 products · asked by
Priya Sharma", and a small before-and-after summary table with 3 rows showing product name, old
price and new price in tabular figures with the new price in teal. Below the table, two full-width
buttons side by side — an outlined "Not now" and a filled "Approve". The second card has the title
"Share your Diwali stock plan", a secondary line "Asked by Priya Sharma · due 8 October", two lines
of explanation, an attachment chip for a template file, and an outlined button "Upload your plan"
plus a text button "Ask a question". Flat cards, 16dp margins, no gradients.
```

#### SEL-RQ-05 · Completed requests
`states: empty, filtered-empty, offline`
```
Role: seller client (paying merchant) — Seller. Scope: own. Permission: tasks_view.
Required states: empty-true, empty-filtered, offline-cached.

Design a single Android Material 3 mobile completed-requests screen for RetailOps Seller, a
merchant app for Amazon sellers.
Top app bar: back arrow, title "Completed", and a filter icon. Bottom navigation with 5 items —
Home, Performance, My Products, Requests, More — Requests selected.
Body: a segmented control "This month / Last 3 months / All time" with This month selected. Below,
a list of 6 completed request rows. Each row has a green check icon in a soft circle, a 14sp title
such as "Update the title on 2 products", a secondary line naming who did it and when —
"Completed by Priya Sharma · 2 days ago" — and a right-aligned chevron. Two rows carry a small
neutral chip "Closed". At the end of the list, a centred text button "Load more". Below the list,
a small info card reading "42 requests completed for you in the last 90 days." Flat rows with
dividers, 16dp margins, no gradients.
```

---

## 5. More (5 screens)

---

#### SEL-MR-01 · Chat with account team ★ critical
`states: empty, offline, conflict, upload`
```
Role: seller client (paying merchant) — Seller. Scope: own. Permission: chat_view.
Required states: empty-true, offline-cached, conflict, upload-download.

Design a single Android Material 3 mobile chat screen for RetailOps Seller, a merchant app for
Amazon sellers, showing a conversation with the account team.
Top app bar: back arrow, a contact avatar, a two-line title — "Priya Sharma" in 16sp medium above
"Your account manager · Online" in 12sp with a small green dot — plus a call icon and an overflow
menu.
Bottom navigation bar with 5 items: Home, Performance, My Products, Requests, More — show More
selected.
Body: a scrollable message thread on a very light grey background, with incoming messages as white
bubbles on the left and outgoing messages as teal-tinted bubbles on the right, both with 12dp
radius. Show a "Today" day separator chip. Include: a friendly opening message from the account
manager, a reply, a message with an inline product image thumbnail and a caption, a file attachment
bubble with a file icon, name and size plus a small "Open" text button, and one outgoing message in
a "Sending" state at reduced opacity with a small clock icon. Read receipts appear as small
double-ticks with a timestamp below the last outgoing message.
At the bottom, a sticky composer: a rounded multiline text field with the placeholder "Message",
a plus icon for attachments on the left, and a circular filled send button in teal on the right.
Warm and approachable, plenty of whitespace. No gradients.
```

#### SEL-MR-02 · Account manager
`states: empty`
```
Role: seller client (paying merchant) — Seller. Scope: own.
Required states: empty-true.

Design a single Android Material 3 mobile account team screen for RetailOps Seller, a merchant app
for Amazon sellers.
Top app bar: back arrow, title "Your account team". Bottom navigation with 5 items — Home,
Performance, My Products, Requests, More — More selected.
Body: a hero card centred with a large circular avatar, the name "Priya Sharma" in 18sp medium,
a role line "Your account manager", a small green chip "Online", and a secondary line "Replies
within 2 hours during business hours". Below, two full-width buttons side by side — an outlined
"Call" with a phone icon and a filled teal "Chat". Then a section header "Also looking after your
account" above 2 rows, each with an avatar, a name, a role such as "Listing specialist" or
"Advertising specialist", and a small "Message" text button. Then a section header "Working hours"
above a card with the days and times "Monday to Friday, 9:30 AM – 6:30 PM IST" and a secondary line
"Closed on public holidays". Flat cards, 16dp margins, warm and human, no gradients.
```

#### SEL-MR-03 · Account & preferences
```
Role: seller client (paying merchant) — Seller. Scope: own.
Required states: empty-true.

Design a single Android Material 3 mobile account screen for RetailOps Seller, a merchant app for
Amazon sellers.
Top app bar: back arrow, title "Account". Bottom navigation with 5 items — Home, Performance, My
Products, Requests, More — More selected.
Body: a header card with a circular avatar, the name "Rahul Verma" in 16sp medium, the email as a
secondary line, and a teal chip "Seller A". Below, grouped setting rows with a label on the left
and the current value or a chevron on the right. Group "Your account": "Business name" with
"Seller A", "Marketplace" with "Amazon India", "Your account manager" with "Priya Sharma" and a
chevron. Group "Notifications": toggle rows for "Price and rank changes" on, "Advertising alerts"
on, "Requests and approvals" on, and "Weekly summary email" off. Group "App": "Appearance" with
"System" and a chevron, "Text size" with "Default" and a chevron, "Language" with "English
(India)" and a chevron. Group "Security": "Change password" with a chevron and "Biometric unlock"
with a switch on. At the bottom, a text button "Sign out" in red. Flat cards, 16dp margins, no
gradients.
```

#### SEL-MR-04 · Help & support
```
Role: seller client (paying merchant) — Seller. Scope: own.
Required states: empty-true.

Design a single Android Material 3 mobile help screen for RetailOps Seller, a merchant app for
Amazon sellers.
Top app bar: back arrow, title "Help". Bottom navigation with 5 items — Home, Performance, My
Products, Requests, More — More selected.
Body: a search field labelled "Search help", then a friendly card at the top with a chat icon
reading "Can't find an answer? Ask your account team" and a filled teal "Start a chat" button.
Below, a section header "Popular questions" above 5 expandable rows, each with a question in 14sp
medium and a chevron, with the first expanded to show two short paragraphs of 14sp answer text in
plain language — for example "Why did my sales change?" and "What does 'Buy Box lost' mean?".
Then a section header "Guides" above 3 rows with document icons and titles such as "Reading your
sales report", "Understanding advertising costs" and "Improving your product listings". Flat
cards, 16dp margins, no gradients.
```

#### SEL-MR-05 · Onboarding checklist
```
Role: seller client (paying merchant) — Seller. Scope: own.
Required states: empty-true.

Design a single Android Material 3 mobile onboarding checklist screen for RetailOps Seller, a
merchant app for Amazon sellers, shown to a new seller.
Top app bar: back arrow, title "Get started". Bottom navigation with 5 items — Home, Performance,
My Products, Requests, More — Home selected.
Body: a welcome card in a soft teal container with a sparkle icon, a headline "Welcome to
RetailOps" in 20sp and a secondary line "Here's how to get set up — it takes about 5 minutes."
Below, a vertical checklist of 5 steps, each a white card with a number circle on the left, a title
in 14sp medium and a short description: "Confirm your marketplace" with a green check and
"Completed"; "Set your monthly target" with a teal outlined button "Set target"; "Tell us your
business priorities" with a button "Choose priorities"; "Invite a colleague" as an optional step
with a grey chip "Optional" and a text button "Invite"; and "Download the app on another device"
with an outlined button "Get the link". A thin overall progress bar sits under the welcome card
showing "2 of 5 done" in tabular figures. Flat cards, 16dp margins, warm and encouraging, no
gradients.
```

---

## 6. Notes for the seller surface

**Words matter more here than anywhere else in the product.** The seller is your client, not
your colleague. After generating each screen, run this quick language check:

| Never show | Show instead |
|---|---|
| PEMS, task instance | Request, action item |
| SLA breach | Overdue |
| ASIN Manager | My Products |
| Ruleset | Automation |
| Scraper / sync job | Data refresh |
| Ads Intelligence | Advertising |
| ACoS (unexplained) | "Cost of advertising — lower is better" |
| GMS (unexplained) | Sales (GMS) |
| Parent ASIN | Product family |
| Internal user names without context | Name + role ("Priya Sharma · your account manager") |

**Also verify, on every seller screen:**
- [ ] No seller switcher and no "All sellers" chip anywhere
- [ ] Teal accent used for primary actions, not the internal blue
- [ ] No internal-only content: scraper status, ruleset logic, cost/margin fields, other sellers
- [ ] Every metric has a comparison — last month, target, or last year
- [ ] The account manager is reachable from at least Home, More and any blocking request
- [ ] Empty states are inviting, never scolding
