# RetailOps Android — Stitch Prompts: Auth, Home, Catalog

**Document ID:** `RO-MOB-DS-008` · Companion to `07-stitch-setup-and-workflow.md`
**Screens:** 38 (13 auth · 10 internal Home · 15 Catalog)

> **Before you start:** set up both Stitch projects and paste `DESIGN.md` from
> `07-stitch-setup-and-workflow.md` §3. Every prompt below assumes that design system is
> already active. Paste each prompt exactly as written, one screen at a time.

---

## 1. Authentication (13 screens)

These are shared by both surfaces. Generate them in the **Internal** project; for the seller
project only regenerate `AUTH-02` and `AUTH-10` (the two that visibly differ).

---

#### AUTH-01 · Splash / bootstrap
`states: loading, error` · no app bar, no nav

```
Design a single Android Material 3 mobile splash screen for RetailOps, an internal B2B
e-commerce operations app. Centred vertically on a plain white background: the BrandCentral
logo mark and the wordmark "RetailOps" beneath it in 22sp, a one-line caption "E-commerce
operations" in 12sp grey, and a slim indeterminate progress bar directly under the wordmark.
Nothing else on the screen — no buttons, no navigation bar, no images. Keep it calm and
uncluttered. Flat design, no gradients, no shadows.
```

#### AUTH-02 · Sign in ★ critical
`states: idle, submitting, invalid, locked, rate-limited, offline`

```
Design a single Android Material 3 mobile sign-in screen for RetailOps, an internal B2B
e-commerce operations app. Top area: the BrandCentral logo mark and the wordmark "RetailOps",
with a small rounded chip beneath reading "Internal workspace". Middle: a filled text field
labelled "Email" with an email keyboard hint, a filled text field labelled "Password" with a
visibility eye icon, and a right-aligned text button "Forgot password?". Below the fields, show
an inline error banner with a warning icon reading "Email or password is incorrect". At the
bottom: a full-width filled button "Sign in" and a centred caption with a lock icon reading
"Secured by device trust". 16dp margins, 12dp field radius, no navigation bar, no social sign-in.
Flat, calm, enterprise. No gradients, no illustrations.
```

#### AUTH-03 · Verify code (OTP)
`states: idle, submitting, wrong code, expired, resent`

```
Design a single Android Material 3 mobile one-time-code screen for RetailOps, an internal B2B
e-commerce operations app. Top: a back arrow in the app bar. A heading "Enter the 6-digit code"
in 22sp, with supporting text "We sent a code to r•••@brandcentral.in" in 14sp grey. Below:
six separate square code boxes in one row, each 48dp with 12dp radius and a visible border, the
first four filled with digits and the fifth focused with a highlighted border and cursor. Under
the boxes: a row reading "Didn't get the code? Resend in 0:24" with the resend part as a
disabled text button. At the bottom: a full-width filled button "Verify", and below it a
switch row labelled "Trust this device" with supporting text "Skip the code next time on this
phone". No navigation bar. Flat, no gradients.
```

#### AUTH-04 · Forgot password
```
Design a single Android Material 3 mobile screen for RetailOps, an internal B2B e-commerce
operations app, for requesting a password reset. App bar with a back arrow and the title
"Reset password". Heading in 22sp: "Forgot your password?" with supporting text "Enter your work
email and we'll send you a reset link." One filled text field labelled "Email". A full-width
filled button "Send reset link" at the bottom, and a centred text button "Back to sign in"
beneath it. Include a subtle inline note with an info icon reading "For security, we always show
the same message whether or not the email exists." 16dp margins, no navigation bar, flat design.
```

#### AUTH-05 · Reset password
```
Design a single Android Material 3 mobile screen for RetailOps, an internal B2B e-commerce
operations app, for setting a new password from an emailed link. App bar with a back arrow and
title "New password". Two filled text fields: "New password" and "Confirm password", both with
visibility toggles. Below them a password strength meter — a thin 4-segment progress bar showing
3 of 4 segments filled in green with the label "Strong". Under that, a checklist with green check
icons on "At least 12 characters", "One number", "One symbol" and a grey hollow circle on
"Not a previous password". Full-width filled button "Update password" at the bottom. No navigation
bar, flat design, 16dp margins.
```

#### AUTH-06 · Set password (first login)
```
Design a single Android Material 3 mobile screen for RetailOps, an internal B2B e-commerce
operations app, shown on a user's first login. A small step indicator at the top reading
"Step 1 of 1". Heading "Create your password" in 22sp and supporting text "This replaces the
temporary password you were given." Two filled text fields: "New password" and "Confirm
password" with visibility toggles. A live requirements checklist below with check and circle
icons. A full-width filled button "Set password and continue". No back arrow, no navigation
bar, no skip option. Flat, calm, secure-feeling. No gradients.
```

#### AUTH-07 · Security policy consent
```
Design a single Android Material 3 mobile screen for RetailOps, an internal B2B e-commerce
operations app, for accepting a security policy. App bar with the title "Security policy".
Body: a scrollable white card with 14sp body text containing three short policy sections with
small headings, using realistic placeholder wording about data access, device trust and
acceptable use. The card has a 12dp radius and a hairline border. At the bottom, outside the
card: a checkbox row labelled "I have read and accept the security policy", and a full-width
filled button "Continue" that is disabled until the checkbox is ticked. No back arrow, no
navigation bar. Flat design, no gradients.
```

#### AUTH-08 · Trusted devices
`states: empty, error`
```
Design a single Android Material 3 mobile screen for RetailOps, an internal B2B e-commerce
operations app, listing trusted devices. App bar with a back arrow, title "Trusted devices" and
an overflow menu. Below the app bar, a one-line description "Devices that can sign in without a
verification code." Then a list of 3 white cards with 12dp radius: each row has a phone icon, a
device name in 14sp medium such as "Pixel 8 — this device" or "iPhone 14", a secondary line with
the last active time such as "Last used 2 hours ago", a location line such as "Ahmedabad, IN",
and an overflow menu with "Remove". Show the current device with a small green chip reading
"This device". At the bottom, an outlined danger button "Remove all other devices". 16dp margins,
flat cards, no gradients.
```

#### AUTH-09 · Setup wizard
`perm: settings_manage`
```
Design a single Android Material 3 mobile setup wizard screen for RetailOps, an internal B2B
e-commerce operations app, for first-time system configuration. A horizontal stepper at the top
with 4 steps — "Organisation", "Marketplaces", "Team", "Data sync" — showing step 2 active in
primary colour and step 1 completed with a checkmark. Heading "Connect your marketplaces" in
22sp with one line of supporting text. Body: a vertical list of 3 selectable cards with
checkboxes — "Amazon India" (checked, with the Amazon mark), "Ajio" (unchecked) and "Flipkart"
(unchecked) — each with a secondary line of descriptive text. A section header "Sync schedule"
above a segmented control with options "Hourly", "Daily", "Manual", with "Daily" selected. At
the bottom: a text button "Back" and a filled button "Continue". Flat cards, 16dp margins.
```

#### AUTH-10 · Welcome / onboarding (seller)
`surface: seller · shown once`
```
Design a single Android Material 3 mobile onboarding screen for RetailOps Seller, a merchant
app where Amazon sellers track their own account performance. Centred content: a simple outlined
illustration area, a headline in 24sp reading "Your account, in your pocket", and two lines of
supporting text in 14sp reading "See how your products are performing, and respond to anything
your account team needs from you." Below: three horizontal page-indicator dots with the first
active. At the bottom, a full-width filled button "Get started" and a centred text button
"Skip for now". Teal accent colour, generous whitespace, calm and reassuring. No navigation bar,
no gradients, no stock photography.
```

#### AUTH-11 · Biometric unlock
```
Design a single Android Material 3 mobile screen for RetailOps, an internal B2B e-commerce
operations app, prompting biometric unlock. Body: a large fingerprint icon in a circular soft
blue container, a heading "Unlock RetailOps" in 22sp, and supporting text "Use your fingerprint
to sign in as Akash Mehta". Beneath, a smaller circular outlined button with a fingerprint icon
representing the scan target, with a caption "Touch the sensor". At the bottom, a text button
"Use password instead". No app bar, no navigation bar. Flat, minimal, no gradients.
```

#### AUTH-12 · Session expired
```
Design a single Android Material 3 mobile alert dialog over a dimmed dashboard background.
The dialog has a 28dp radius and contains: a lock icon, a title "Session expired", body text
"For your security you were signed out after 30 minutes of inactivity. Your place has been
saved.", and two buttons — a text button "Sign out" and a filled button "Sign in again".
The background screen behind the dialog should be visibly blurred and dimmed, not removed.
No gradients, flat surfaces.
```

#### AUTH-13 · Account locked
```
Design a single Android Material 3 mobile screen for RetailOps, an internal B2B e-commerce
operations app, shown when an account is locked. Centred content: a warning icon in a soft amber
circle, a headline "Account temporarily locked" in 22sp, supporting text "Too many failed sign-in
attempts. Try again in 14 minutes.", and a small card showing "Locked until 4:32 PM" in tabular
figures. At the bottom: a full-width outlined button "Contact your administrator" and a text
button "Try again". No app bar, no navigation bar. Flat, calm, no gradients.
```

---

## 2. Internal Home (10 screens)

---

#### INT-HM-01 · Dashboard ★ critical
`perm: dashboard_view or targets_view` · `scope: all | assigned`

```
Design a single Android Material 3 mobile dashboard screen for RetailOps, an internal B2B
e-commerce operations app used by Amazon marketplace teams.
Top app bar: a rounded chip reading "All sellers" with a dropdown caret on the left, a search
icon, a notification bell with a badge showing 3, and a circular avatar on the right.
Bottom navigation bar with 5 items: Home, Catalog, Growth, Ops, More — show Home selected.
Body, top to bottom:
1. A slim freshness strip: a small refresh icon and "Updated 12 min ago", right-aligned "Refresh".
2. A 2-column grid of 4 KPI cards. Each card: a 12sp label, a large 28sp tabular value, a delta
   row with an arrow and comparison basis, and a small sparkline. Cards: "Revenue ₹12.5L
   ▲ +12.4% vs prev 30d", "Units 8,420 ▲ +3.1%", "ACoS 18.30% ▲ +1.2% in amber", and
   "Open alerts 12 • 3 overdue" in red.
3. A section header "Needs attention" with a right-aligned "See all" text button, followed by
   2 alert cards: an error-tinted card "Price dropped 22% — B0XXXXXXXXXX, Amazon, Seller A,
   2 h ago" and a warning-tinted card "BSR fell out of top 100 — B0YYYYYYYYYY".
4. A section header "Revenue trend" with a segmented control "7d 30d 90d" (30d selected) above a
   smooth area chart with a light grid, no axis clutter, and a small "View as table" text button.
5. A final summary row "My tasks today · 4 open, 1 at risk" with a chevron.
Use Indian currency grouping (₹12,48,300 style). Flat white cards with hairline borders, no
gradients, no floating action button.
```

#### INT-HM-02 · Alerts inbox
`states: empty, filtered-empty, offline, stale`
```
Design a single Android Material 3 mobile alerts inbox screen for RetailOps, an internal B2B
e-commerce operations app.
Top app bar: a rounded "All sellers" chip with a caret, a search icon, and an overflow menu.
Bottom navigation with 5 items: Home, Catalog, Growth, Ops, More — Home selected.
Body: a horizontal row of 4 filter chips — "All", "Breached", "At risk", "Acknowledged" — with
"All" selected. Below, a scrollable list of 6 alert cards. Each card has a coloured left edge or
tinted icon circle, a status chip with icon and word (for example a red chip "Breached", an amber
chip "At risk"), a bold 14sp headline such as "Price dropped 22% on B0XXXXXXXXXX", a secondary
line "Seller A · Amazon · 2 h ago", and a right-aligned chevron. Include a grouping label
"Today" above the first three items and "Yesterday" above the next three. Flat white cards,
12dp radius, 16dp margins, no gradients.
```

#### INT-HM-03 · Alert detail
```
Design a single Android Material 3 mobile alert detail screen for RetailOps, an internal B2B
e-commerce operations app.
Top app bar: back arrow, title "Alert", overflow menu. Bottom navigation with 5 items —
Home, Catalog, Growth, Ops, More — Home selected.
Body: a large status banner at the top tinted light red containing an icon, the word "Breached"
in 14sp medium, and a timestamp "Detected 2 hours ago". Then a white card with the alert
headline in 16sp medium, and rows of label–value pairs: "ASIN B0XXXXXXXXXX" (monospace),
"Seller Seller A", "Marketplace Amazon", "Metric Buy Box price", "Before ₹4,499",
"Now ₹3,509", "Change −22.0%" shown in red with a down arrow. Below, a section header
"Triggered by" above a small card showing the rule name "Price drop > 15%" with a secondary line
"Ruleset: Pricing guardrails". At the bottom, a sticky action bar with an outlined button
"Acknowledge" and a filled button "Create task". Flat cards, 16dp margins, no gradients.
```

#### INT-HM-04 · Alert rules
```
Design a single Android Material 3 mobile screen for RetailOps, an internal B2B e-commerce
operations app, listing alert rules.
Top app bar: back arrow, title "Alert rules", a plus icon on the right. Bottom navigation with
5 items — Home, Catalog, Growth, Ops, More — Home selected.
Body: a list of 5 white cards. Each card has: a rule name in 14sp medium such as "Price drop
greater than 15%", a secondary line "Evaluated hourly · 3 sellers", a small neutral chip showing
the rule type such as "Pricing" or "Ranking", a right-aligned switch that is on for four cards
and off for one, and an overflow menu. Above the list, a search field with the label
"Search rules". Show one card with a small amber chip "Paused". Flat cards with hairline borders,
16dp margins, no gradients, no floating action button over the nav bar.
```

#### INT-HM-05 · Alert rule editor
```
Design a single Android Material 3 mobile form screen for RetailOps, an internal B2B e-commerce
operations app, for editing an alert rule.
Top app bar: a close icon on the left, title "Edit rule", and a text button "Save" on the right.
Bottom navigation with 5 items — Home, Catalog, Growth, Ops, More — Home selected.
Body, as a vertical form of filled fields and labelled groups:
1. "Rule name" filled text field containing "Price drop greater than 15%".
2. "Condition" group with a dropdown field "Buy Box price", a segmented control for
   "increases / decreases / changes by", with "decreases" selected, and a numeric field "15".
3. "Scope" group with a multi-select field showing chips "Seller A" and "Seller B" plus a
   "+ Add seller" chip.
4. "Schedule" group with a segmented control "Hourly / Daily / Weekly" with "Hourly" selected.
5. "Notification" group with 3 checkbox rows — "In app" checked, "Email" checked, "Slack"
   unchecked.
At the bottom, a full-width filled button "Save rule" and a text button "Delete rule" in red.
Flat fields, 16dp margins, no gradients.
```

#### INT-HM-06 · Notifications centre
`states: empty, filtered-empty, offline`
```
Design a single Android Material 3 mobile notifications screen for RetailOps, an internal B2B
e-commerce operations app.
Top app bar: back arrow, title "Notifications", and a text button "Mark all read" on the right.
Bottom navigation with 5 items — Home, Catalog, Growth, Ops, More — Home selected.
Body: three segmented tabs at the top — "All", "Unread", "Mentions" with "All" selected. Below,
a scrollable list of 7 notification rows. Each row has a small circular type icon, a bold 14sp
title such as "Task assigned to you" or "Alert triggered: price drop", a secondary line with the
entity and time such as "Price correction · B0XXXXXXXXXX · 12 min ago", and unread rows carry a
small blue dot on the right with a very subtle tinted background. One row shows a small avatar
for an @mention. At the bottom of the list, a caption "You're all caught up". Flat rows with
dividers, 16dp margins, no gradients.
```

#### INT-HM-07 · Global search
```
Design a single Android Material 3 mobile search screen for RetailOps, an internal B2B
e-commerce operations app.
Top: a search bar in the app bar containing the query "pegasus" with a back arrow and a clear
icon. Below it, a segmented control "All / Products / Sellers / Tasks / People" with "All"
selected.
Body: grouped results with small section headers. Under "Products": 2 rows with a tag icon, the
title "Nike Air Zoom Pegasus 40" in 14sp medium and a secondary line "B0XXXXXXXXXX · Seller A".
Under "Sellers": 1 row with a store icon, "Seller A" and the secondary line "Amazon India ·
1,248 ASINs". Under "Tasks": 2 rows with a checkbox icon, task titles in 14sp medium and a
secondary line with the SLA state. Under "People": 1 row with an avatar, a name and a role.
Each row is 72dp tall with a chevron. Recent searches appear as chips labelled "Recent" only if
the list is otherwise empty. Flat, 16dp margins, no gradients, no navigation bar.
```

#### INT-HM-08 · Seller switcher
```
Design a single Android Material 3 mobile bottom sheet over a dimmed dashboard for RetailOps,
an internal B2B e-commerce operations app, for switching the active seller scope.
The sheet has a 28dp top radius and a 32×4dp grab handle. Contents: a title "Switch seller"
in 16sp medium, a search field labelled "Search sellers", then a list of options. The first row
is "All sellers" with a small chart icon and supporting text "Aggregated across 6 sellers",
shown as selected with a filled radio and a tinted background. Below it, 5 seller rows, each
with a store icon, the seller name in 14sp medium, a secondary line with the marketplace and ASIN
count such as "Amazon India · 1,248 ASINs", and a small status dot. One seller is inactive and
dimmed with a grey "Inactive" chip. The sheet covers roughly 70% of the screen height with the
dimmed dashboard visible behind. Flat, no gradients.
```

#### INT-HM-09 · Customise dashboard
```
Design a single Android Material 3 mobile screen for RetailOps, an internal B2B e-commerce
operations app, for rearranging dashboard widgets.
Top app bar: a close icon, title "Customise dashboard", and a text button "Reset" on the right.
Bottom navigation with 5 items — Home, Catalog, Growth, Ops, More — Home selected.
Body: a list of 6 draggable rows on a very light background, each with a drag handle on the left,
a widget name in 14sp medium such as "Revenue", "Units", "ACoS", "Alerts", "Revenue trend" and
"My tasks", a secondary line describing the widget type, and a switch on the right that is on for
five rows and off for one. Show one row mid-drag, slightly raised with a soft shadow and a faint
outline. At the bottom, a caption "Drag to reorder. Hidden widgets stay off your dashboard."
Flat, 16dp margins, no gradients.
```

#### INT-HM-10 · KPI detail / metric drilldown
`states: stale, error`
```
Design a single Android Material 3 mobile metric detail screen for RetailOps, an internal B2B
e-commerce operations app, opened from the Revenue KPI card.
Top app bar: back arrow, a two-line title — "Revenue" in 16sp medium with a subtitle
"All sellers · Last 30 days" in 12sp grey — and an overflow menu. Bottom navigation with 5 items
— Home, Catalog, Growth, Ops, More — Home selected.
Body: a large headline block with "₹12,48,300" in 32sp tabular and a delta row
"▲ +12.4% vs previous 30 days" in green beneath it. Then a segmented control "7d / 30d / 90d /
Custom" with 30d selected. Below, a full-width area chart with a subtle grid and a small
"View as table" text button on the right. Then a section header "Breakdown" above a list of 4 rows
showing "Amazon ₹9,84,200 79%", "Ajio ₹1,72,400 14%", "Flipkart ₹84,100 7%" and
"Other ₹7,600 <1%", each with a thin horizontal proportion bar in the primary colour. Add a small
amber chip "Synced 2 days ago" near the title. Flat cards, 16dp margins, 5 items in the bottom
nav only. No gradients.
```

---

## 3. Catalog (15 screens)

---

#### INT-CT-01 · ASIN Manager list ★ critical
`perm: asinmanager_view` · `states: empty, filtered-empty, selection, offline, stale`

```
Design a single Android Material 3 mobile product list screen for RetailOps, an internal B2B
e-commerce operations app.
Top app bar: back arrow, title "ASIN Manager", and an overflow menu on the right.
Bottom navigation bar with 5 items: Home, Catalog, Growth, Ops, More — show Catalog selected.
Body, top to bottom:
1. A row under the app bar showing a rounded "Seller A" scope chip with a caret, a dot separator,
   and the count "1,24,802 ASINs" in tabular figures.
2. A search field labelled "Search ASIN, SKU or title".
3. A horizontally scrolling row of removable filter chips — "Amazon ×", "Active ×",
   "BSR < 500 ×" — followed by a chip "Clear all".
4. A sort row reading "Sort: BSR ascending" on the left, with a 2-button segmented control of a
   grid icon and a list icon on the right, grid selected.
5. A scrollable list of 5 product cards. Each card: the ASIN in monospace 13sp with middle
   ellipsis, a 14sp title on up to two lines, a secondary line "Amazon · Seller A · FBA", and a
   metric row with three values using tabular figures — "BSR 142 ▼", "₹4,499 ▼" and "★ 4.3
   (1.2K)". Two cards carry a small status chip on the right, one red "Price −22%" and one amber
   "BSR drop". One card is shown in a selected state with a primary-coloured 2dp border and a
   filled checkbox in the top-right corner, and a contextual bar at the bottom of the screen
   showing "1 selected" with icons for export, tag and edit.
6. At the end of the list, a centred text button "Load more (25 of 12,480)".
Use Indian digit grouping. Flat white cards, 12dp radius, hairline borders, 16dp margins, no
gradients, no floating action button.
```

#### INT-CT-02 · ASIN detail
`states: offline, stale, error`

```
Design a single Android Material 3 mobile product detail screen for RetailOps, an internal B2B
e-commerce operations app.
Top app bar: back arrow, a two-line title — "ASIN Manager" in 12sp grey above "B0XXXXXXXXXX" in
16sp medium monospace — and an overflow menu. Bottom navigation with 5 items — Home, Catalog,
Growth, Ops, More — Catalog selected.
Body, top to bottom:
1. A white card with the product title "Nike Air Zoom Pegasus 40" in 16sp medium, a secondary
   line "Amazon · Seller A · FBA · Brand: Nike", and a row of small chips — "Active", "Buy Box
   owned".
2. A 2-column grid of 4 metric tiles: "Price ₹4,499 ▼ −22.0%", "BSR 142 ▼ −38", "Rating ★ 4.3
   (1.2K)", "Stock 84 units". Each tile shows the label, the tabular value, and a coloured delta
   with an arrow.
3. A section header "Price history — 30 days" with a small line chart showing a sharp drop near
   the end, plus a "View as table" text button.
4. A section header "Listing quality" with a score ring showing "82 / 100" and below it three
   rows with icons — "Title — needs work" in amber, "Bullets — good" in green, "Images — good"
   in green.
5. A section header "Tags" with wrap-layout chips.
Use tabular figures and Indian grouping. Flat cards, 16dp margins, no gradients.
```

#### INT-CT-03 · ASIN edit
`perm: asinmanager_manage`
```
Design a single Android Material 3 mobile edit form screen for RetailOps, an internal B2B
e-commerce operations app, for one product.
Top app bar: a close icon, title "Edit product", and a text button "Save" on the right.
Bottom navigation with 5 items — Home, Catalog, Growth, Ops, More — Catalog selected.
Body as a vertical form: a read-only row showing the ASIN in monospace with a copy icon; a filled
field "Title"; a filled field "Brand"; a filled field "Category" with a dropdown caret; a filled
field "MRP (₹)" containing "4,499" with tabular figures; a field "Target price (₹)"; a section
header "Tags" above a wrap layout of removable chips plus an "+ Add tag" chip; and a section
header "Attributes" above three labelled toggle rows — "Active", "FBA", "Buy Box eligible".
At the bottom, a sticky bar with an outlined button "Cancel" and a filled button "Save changes".
Include a small amber inline notice with a warning icon reading "You're editing 1 of 240 selected
products." Flat fields, 16dp margins, no gradients.
```

#### INT-CT-04 · ASIN import
`perm: asinmanager_import` · `states: upload progress, conflict`
```
Design a single Android Material 3 mobile import screen for RetailOps, an internal B2B
e-commerce operations app, for uploading a product spreadsheet.
Top app bar: back arrow, title "Import ASINs". Bottom navigation with 5 items — Home, Catalog,
Growth, Ops, More — Catalog selected.
Body: a large dashed-border drop area with 16dp radius containing an upload icon, the text
"Tap to choose a CSV or XLSX file" and a caption "Up to 10 MB". Below it, a file row card showing
a spreadsheet icon, "asin_master_oct.xlsx" in 14sp medium, "2.4 MB" as a secondary line, a
progress bar at 68% with the label "Uploading…", and a small "Cancel" text button. Below that, a
section header "Mapping" with a card mapping columns — "ASIN → ASIN (matched)", "SKU → SKU
(matched)", "MRP → MRP (matched)" — each row with a green check, and one row "Size → Not mapped"
with an amber warning icon and a dropdown to choose a target field. At the bottom, a full-width
filled button "Continue". Flat cards, 16dp margins, no gradients.
```

#### INT-CT-05 · ASIN export
`perm: asinmanager_export` · `states: download progress`
```
Design a single Android Material 3 mobile export screen for RetailOps, an internal B2B
e-commerce operations app.
Top app bar: back arrow, title "Export ASINs". Bottom navigation with 5 items — Home, Catalog,
Growth, Ops, More — Catalog selected.
Body: a summary card reading "1,24,802 ASINs · Seller A · Amazon" with a small "Change filters"
text button. Below, a section header "Choose columns" above a wrap layout of chips, most selected
in a tinted primary style — "ASIN", "Title", "Brand", "Price", "BSR", "Rating", "Stock" — and two
unselected — "Cost", "Margin". Under that, a section header "Format" above a segmented control
"XLSX / CSV" with XLSX selected. At the bottom, a full-width filled button "Start export" and a
caption "You'll get a notification when it's ready." Show a small inline info row with an icon
reading "Large exports can take a few minutes." Flat cards, 16dp margins, no gradients.
```

#### INT-CT-06 · Bulk action sheet
`states: selection mode`
```
Design a single Android Material 3 mobile bottom sheet over a dimmed product list for RetailOps,
an internal B2B e-commerce operations app, for bulk actions on 240 selected products.
The sheet has a 28dp top radius and a grab handle. At the top, a title "240 products selected"
with a "Clear selection" text button on the right. Below, a vertical list of 6 action rows, each
with a leading icon, a 14sp label and a chevron: "Add tag", "Remove tag", "Update MRP",
"Assign to seller", "Export selected" and, separated by a divider at the bottom and shown in red,
"Archive products". Under the title, a small caption "Applies to all selected products."
The dimmed product list is visible behind the sheet, which covers about 60% of the screen.
Flat, no gradients.
```

#### INT-CT-07 · Filter & sort sheet
```
Design a single Android Material 3 mobile bottom sheet over a dimmed product list for RetailOps,
an internal B2B e-commerce operations app, containing filters and sorting.
The sheet has a 28dp top radius, a grab handle, and a header row with "Filters" in 16sp medium
and a "Reset" text button. The body scrolls and contains these groups, each with a small section
header: "Seller" with a multi-select field showing chips "Seller A" and "Seller B"; "Marketplace"
with checkboxes for Amazon (checked), Ajio and Flipkart; "Status" with a segmented control
"All / Active / Inactive" with Active selected; "BSR" with a two-handle range slider from 0 to
500 labelled "0 – 500"; "Price (₹)" with a two-handle range slider and tabular values
"₹500 – ₹8,000"; and "Rating" with star chips. Pinned at the bottom of the sheet, outside the
scroll area, a full-width filled button reading "Show 12,480 results". Flat, 16dp internal padding,
no gradients.
```

#### INT-CT-08 · ASIN Tracker list
`perm: asintracker_view` · `states: empty, filtered-empty, offline, stale`
```
Design a single Android Material 3 mobile tracker list screen for RetailOps, an internal B2B
e-commerce operations app, for monitoring price and rank changes.
Top app bar: back arrow, title "ASIN Tracker", overflow menu. Bottom navigation with 5 items —
Home, Catalog, Growth, Ops, More — Catalog selected.
Body: a freshness strip reading "Updated 1 hour ago" with a refresh icon. Below, a segmented
control "All / Dropped / Improved / Unchanged" with "Dropped" selected. Then a list of 5 rows,
each showing the ASIN in monospace, the product title on one line, and a right-aligned block with
the current price in tabular figures above a coloured delta, for example "₹4,499" with
"▼ −22.0%" in red, or "₹5,299" with "▲ +4.1%" in green. Each row also has a thin 32dp sparkline
under the title showing the 30-day trend, and a rank line "BSR 142 (was 104)". Long-press hint
not needed. Flat rows with dividers, 16dp margins, no gradients.
```

#### INT-CT-09 · ASIN Tracker history
`states: offline, stale, error`
```
Design a single Android Material 3 mobile history screen for RetailOps, an internal B2B
e-commerce operations app, for one product's price and rank over time.
Top app bar: back arrow, a two-line title — "ASIN Tracker" in 12sp grey above "B0XXXXXXXXXX" in
16sp monospace — with a "Compare" text button on the right. Bottom navigation with 5 items —
Home, Catalog, Growth, Ops, More — Catalog selected.
Body: a segmented control "7d / 30d / 90d / 1y" with 30d selected. Below, a dual-axis line chart
with two series, price in primary blue and rank in teal, each with a small legend chip above the
chart, and a light grid with no axis clutter. A small "View as table" text button sits at the
chart's top right. Under the chart, three stat rows: "Lowest price ₹3,509 on 1 Oct", "Highest
price ₹4,899 on 12 Sep", "Rank range 104 – 388". Then a section header "Change log" above 3
timeline rows, each with a small dot, a 14sp description such as "Price dropped 22%" and a
relative timestamp. Flat cards, 16dp margins, no gradients.
```

#### INT-CT-10 · Listing Quality list
`states: empty, filtered-empty, offline`
```
Design a single Android Material 3 mobile listing-quality list screen for RetailOps, an internal
B2B e-commerce operations app.
Top app bar: back arrow, title "Listing Quality", overflow menu. Bottom navigation with 5 items —
Home, Catalog, Growth, Ops, More — Catalog selected.
Body: a summary card at the top with three inline stats — "Average score 76", "Needs work 218",
"Good 1,030" — separated by dividers. Below, a segmented control "All / Needs work / Good" with
"Needs work" selected. Then a list of 5 rows, each with a circular score ring on the left showing
a number such as 42, 58 or 64, a product title in 14sp medium on one line, a secondary line with
the ASIN in monospace, and a right-aligned amber chip showing the weakest area such as "Title" or
"Images". One row is shown with a red ring and a red chip "Description". Flat rows with dividers,
16dp margins, no gradients.
```

#### INT-CT-11 · Listing Quality audit
`states: offline, error`
```
Design a single Android Material 3 mobile listing audit screen for RetailOps, an internal B2B
e-commerce operations app, for one product.
Top app bar: back arrow, a two-line title — "Listing Quality" above "B0XXXXXXXXXX" in monospace —
and an overflow menu. Bottom navigation with 5 items — Home, Catalog, Growth, Ops, More —
Catalog selected.
Body: a large score header with an 88dp circular ring showing "82" in the centre and "out of 100"
beneath, plus a rounded chip "Good". Below, four expandable audit sections, each with a score
chip and a status icon: "Title" with a "58" amber chip expanded to show two bullet rows with
warning icons and 14sp text such as "Missing primary keyword in the first 80 characters" and
"Title is 214 characters — recommended maximum is 200", each with a "Fix" text button; then
collapsed sections "Bullets" with a green "92" chip, "Images" with an amber "64" chip and
"Description" with a red "38" chip. At the bottom, a sticky filled button "Fix all issues" and an
outlined button "Re-run analysis". Flat cards, 16dp margins, no gradients.
```

#### INT-CT-12 · Keyword Research search
```
Design a single Android Material 3 mobile keyword research screen for RetailOps, an internal B2B
e-commerce operations app.
Top app bar: back arrow, title "Keyword Research", overflow menu. Bottom navigation with 5 items
— Home, Catalog, Growth, Ops, More — Catalog selected.
Body: a large search field at the top containing the query "yoga mat" with a clear icon, and below
it a small caption "Amazon India · updated 3 days ago". Then a section header "Recent searches"
above three rows, each with a history icon and the term in 14sp medium plus a secondary line with
the result count and relative time. Below that, a section header "Suggested" above a wrap layout
of 6 outlined chips such as "yoga mat thick", "yoga mat 6mm", "anti slip yoga mat". At the bottom,
a full-width filled button "Search keywords". Keep the layout airy with plenty of whitespace.
Flat, 16dp margins, no gradients, no floating action button.
```

#### INT-CT-13 · Keyword results
`states: empty, filtered-empty, offline, stale`
```
Design a single Android Material 3 mobile keyword results screen for RetailOps, an internal B2B
e-commerce operations app, for the query "yoga mat".
Top app bar: back arrow, title "yoga mat", and a filter icon on the right. Bottom navigation with
5 items — Home, Catalog, Growth, Ops, More — Catalog selected.
Body: a summary strip with three inline stats — "Avg. search volume 42,300", "Avg. competition
High", "Opportunity 34" — separated by dividers. Below, a segmented control "Volume / Relevance /
Opportunity" with Volume selected. Then a list of 6 keyword rows, each with the keyword in 14sp
medium on one line, a secondary line with "Amazon India · 1,240 products ranking", a right-aligned
column showing search volume in tabular figures, and a small coloured competition chip — red
"High", amber "Medium" or green "Low". Include a small sparkline on two rows. Flat rows with
dividers, 16dp margins, no gradients.
```

#### INT-CT-14 · Keyword set detail
```
Design a single Android Material 3 mobile saved-keyword-set screen for RetailOps, an internal B2B
e-commerce operations app.
Top app bar: back arrow, title "Yoga mats — Q4 set", overflow menu. Bottom navigation with 5
items — Home, Catalog, Growth, Ops, More — Catalog selected.
Body: a header card showing the set name, a secondary line "38 keywords · Amazon India", and a
row of three inline stats "Avg. volume 42,300", "Last refreshed 3 days ago", "Tracked ASINs 12".
Below, a section header "Keywords" with a right-aligned "Export" text button, above a list of 5
rows each with the keyword, its volume in tabular figures, a competition chip and a star icon for
pinned terms. Then a section header "Ranking products" above 3 compact product rows with the ASIN
in monospace and a rank chip. Flat cards, 16dp margins, no gradients.
```

#### INT-CT-15 · Keyword export
`perm: keywords_export` · `states: download progress`
```
Design a single Android Material 3 mobile export confirmation screen for RetailOps, an internal
B2B e-commerce operations app, for keyword data.
Top app bar: back arrow, title "Export keywords". Bottom navigation with 5 items — Home, Catalog,
Growth, Ops, More — Catalog selected.
Body: a summary card reading "38 keywords · Yoga mats — Q4 set", with a secondary line
"Amazon India". Below, a section header "Include" above three toggle rows with checkmarks —
"Search volume" on, "Competition" on, "Ranking products" off. Then a section header "Format"
above a segmented control "XLSX / CSV" with XLSX selected, followed by a small radio group for
"All keywords" versus "Selected only". At the bottom, a full-width filled button "Start export"
and a caption with a download icon reading "You'll get a notification when the file is ready."
Flat cards, 16dp margins, no gradients.
```
