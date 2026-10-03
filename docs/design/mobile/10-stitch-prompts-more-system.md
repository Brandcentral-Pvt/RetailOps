# RetailOps Android — Stitch Prompts: More, Admin, System States

**Document ID:** `RO-MOB-DS-010` · Companion to `07-stitch-setup-and-workflow.md`
**Screens:** 35 (More menu · 27 People/Admin/Account · 7 system states)

> All internal surface. System-state screens (`SYS-*`) are generated once and reused by
> both surfaces — they are surface-agnostic by design.

---

## 1. More menu

---

#### X-01 · More / drawer
`perm: always visible`
```
Design a single Android Material 3 mobile navigation drawer overlay for RetailOps, an internal
B2B e-commerce operations app, shown over a dimmed dashboard.
The drawer slides from the left and is 320dp wide with a white surface. At the top, a header block
in a soft blue container: a circular avatar, the user's name "Akash Mehta" in 16sp medium, a
secondary line "Operational Manager", and a small role chip in the role colour. Below, a search
field labelled "Search menus".
Then grouped navigation items, each with a leading icon and, where relevant, a trailing count
badge: group "People" — "Sellers", "Teams", "Chat (3)", "Calls". Group "Reports" — "Reports hub",
"Saved views". Group "Admin" — "Users", "Roles and permissions", "API keys", "System settings",
"Activity log", "File manager". Group "Account" — "Profile", "Security", "Notifications",
"Appearance", "Help and support", "About".
At the bottom, pinned above the edge, a divider and a row with a logout icon and "Sign out" in red.
The selected item uses a filled tinted pill behind it. Flat, 16dp internal padding, no gradients.
```

---

## 2. People (12 screens)

---

#### INT-MR-01 · Sellers — list
`perm: seller_view` · `states: empty, filtered-empty`
```
Design a single Android Material 3 mobile seller list screen for RetailOps, an internal B2B
e-commerce operations app.
Top app bar: back arrow, title "Sellers", a search icon and a plus icon. Bottom navigation with
5 items — Home, Catalog, Growth, Ops, More — More selected.
Body: a search field labelled "Search sellers", then a row of filter chips — "Amazon", "Active ×"
— plus a "Clear all" chip. Below, a list of 6 seller cards. Each card has a circular store avatar
with the seller's initial, the seller name in 14sp medium, a secondary line with the marketplace
and plan such as "Amazon India · Professional", and a stats row with three inline tabular values —
"1,248 ASINs", "₹42.1L GMS", "12 open tasks". A footer row shows the assigned brand manager with a
small avatar and name. One card is inactive and dimmed with a grey "Inactive" chip. Flat cards,
16dp margins, no gradients, no floating action button over the nav bar.
```

#### INT-MR-02 · Seller detail
`states: offline, stale`
```
Design a single Android Material 3 mobile seller detail screen for RetailOps, an internal B2B
e-commerce operations app.
Top app bar: back arrow, a two-line title — "Sellers" above "Seller A" — with an overflow menu.
Bottom navigation with 5 items — Home, Catalog, Growth, Ops, More — More selected.
Body: a header card with a large circular avatar, the seller name in 18sp medium, a row of chips —
"Active", "Amazon India", "Professional" — and a secondary line "Seller ID SLR-0042 · Joined
Mar 2024". Below, a 2-column grid of 4 KPI tiles: "GMS ₹42.1L", "ASINs 1,248", "Avg. rating 4.3",
"Open tasks 12". Then a section header "Assigned team" above 3 rows, each with an avatar, a name,
a role label and a small "Message" text button. Then a section header "Marketplace credentials"
with label–value rows — "Partner tag", "Token status Connected" with a green dot, and
"Last synced 2 h ago". At the bottom, an outlined button "Open ASIN Manager" and a text button
"Deactivate seller" in red. Flat cards, 16dp margins, no gradients.
```

#### INT-MR-03 · Seller create / edit
`perm: seller_manage` · `states: conflict`
```
Design a single Android Material 3 mobile seller form screen for RetailOps, an internal B2B
e-commerce operations app.
Top app bar: a close icon, title "New seller", and a text button "Save". Bottom navigation with
5 items — Home, Catalog, Growth, Ops, More — More selected.
Body as a vertical form: a filled field "Seller name"; a filled field "Seller ID" with helper text
"Provided by the marketplace"; a filled field "Marketplace" with a dropdown caret showing
"Amazon India"; a segmented control "Plan" with "Individual / Professional" and Professional
selected; a filled field "Partner tag"; a filled field "Primary contact email"; a filled field
"Phone (optional)"; a section header "Assigned team" with two multi-select fields, "Brand managers"
showing chips, and "Listing team" with an "+ Add member" chip; and a section header "Preferences"
with three toggle rows — "Active", "Include in daily routine", "Alerts enabled". At the bottom, a
sticky bar with an outlined "Cancel" and a filled "Save seller". Flat fields, 16dp margins.
```

#### INT-MR-04 · Teams — list
`perm: teams_manage` · `states: empty`
```
Design a single Android Material 3 mobile team list screen for RetailOps, an internal B2B
e-commerce operations app.
Top app bar: back arrow, title "Teams", a plus icon. Bottom navigation with 5 items — Home,
Catalog, Growth, Ops, More — More selected.
Body: a search field labelled "Search teams", then a list of 5 team cards. Each card has a
circular team avatar with an icon, the team name in 14sp medium such as "Brand — Nike", a
secondary line naming the team lead, and a stacked row of 4 overlapping member avatars with a
"+6" chip showing the remainder. A footer row shows the member count and the number of open tasks
in tabular figures. One card carries a small neutral chip "No lead assigned". Flat cards, 16dp
margins, no gradients.
```

#### INT-MR-05 · Team detail
`perm: teams_manage` · `states: conflict`
```
Design a single Android Material 3 mobile team detail screen for RetailOps, an internal B2B
e-commerce operations app.
Top app bar: back arrow, a two-line title — "Teams" above "Brand — Nike" — with an overflow menu.
Bottom navigation with 5 items — Home, Catalog, Growth, Ops, More — More selected.
Body: a header card with the team avatar, the team name in 16sp medium, a secondary line
"10 members · Lead: Priya Sharma", and a row of chips listing the assigned sellers. Below, a
section header "Members" with an "Add" text button, above 5 rows each with an avatar, a name, a
role label and an overflow menu. Then a section header "Workload" above a compact card with three
inline stats in tabular figures — "Open tasks 24", "Overdue 3" in red, "Avg. completion 2.4 days" —
followed by a thin horizontal stacked bar showing the distribution across members with a small
legend. Flat cards, 16dp margins, no gradients.
```

#### INT-MR-06 · Conversations
`states: empty, filtered-empty, offline`
```
Design a single Android Material 3 mobile conversation list screen for RetailOps, an internal B2B
e-commerce operations app.
Top app bar: title "Chat", a search icon, and a "New" icon button. Bottom navigation with 5 items
— Home, Catalog, Growth, Ops, More — More selected, with a badge showing 3.
Body: a search field labelled "Search messages and people", then a segmented control
"All / Unread / Groups" with All selected. Below, a list of 7 conversation rows. Each row has a
circular avatar or a group avatar stack, the name in 14sp medium, a one-line message preview
truncated in 14sp grey, a right-aligned relative time in tabular figures, and a small unread count
badge in primary blue on rows with unread messages. One row shows a small muted bell icon for a
muted conversation, and one row shows a small paperclip icon indicating an attachment in the
preview. Flat rows with dividers, 16dp margins, no gradients.
```

#### INT-MR-07 · Conversation ★ critical
`states: empty, offline, conflict, upload`
```
Design a single Android Material 3 mobile chat conversation screen for RetailOps, an internal B2B
e-commerce operations app.
Top app bar: back arrow, and a two-line title with the contact's circular avatar on the left — the
name "Priya Sharma" in 16sp medium above a subtitle "Online" in 12sp green — plus a call icon and
an overflow menu.
Body: a scrollable message thread on a very light grey background. Incoming messages appear as
white bubbles aligned left with a 12dp radius, outgoing messages as primary-tinted bubbles aligned
right. Include a pinned message bar directly under the app bar showing a pin icon and a single
truncated line "Delivery schedule for Diwali stock". Show a day separator chip "Today" centred.
Include: a text message, a message with an inline image thumbnail, a file attachment bubble with a
file icon, name and size, a message with two emoji reactions and small counts beneath the bubble,
read receipts as a small double-tick with a timestamp under the last outgoing message, and one
outgoing message in a "Pending" state shown at reduced opacity with a small clock icon.
At the bottom, a sticky composer: a rounded multiline text field with the placeholder "Message",
a plus icon for attachments on the left, and a circular filled send button on the right.
Flat surfaces, no gradients.
```

#### INT-MR-08 · Shared media
`states: empty, upload`
```
Design a single Android Material 3 mobile shared-media screen for RetailOps, an internal B2B
e-commerce operations app, for one conversation.
Top app bar: back arrow, title "Shared media", and an overflow menu. Bottom navigation with 5
items — Home, Catalog, Growth, Ops, More — More selected.
Body: a segmented control "Media / Files / Links" with Media selected. Under Media, a 3-column grid
of square image thumbnails with a small caption under the grid reading "42 photos". Under the Files
tab preview, show a list of file rows, each with a file icon, the file name in 14sp medium, a
secondary line with size and date, and a download icon button. Show the Files tab contents below
the grid as a section, with 3 rows. Flat, 16dp margins, no gradients.
```

#### INT-MR-09 · New conversation / group
`states: filtered-empty`
```
Design a single Android Material 3 mobile new-conversation screen for RetailOps, an internal B2B
e-commerce operations app.
Top app bar: a close icon, title "New message", and a segmented control below it reading
"Direct / Group" with Direct selected. Bottom navigation with 5 items — Home, Catalog, Growth, Ops,
More — More selected.
Body: a search field labelled "Search people and sellers", then a section header "Selected" showing
a horizontal row of 2 removable chips with avatars. Below, a section header "Suggested" above 5
people rows, each with an avatar, a name in 14sp medium, a secondary line with the role or seller,
and a checkbox on the right — two checked. Then a section header "Sellers" above 2 rows with store
icons showing seller names and their assigned brand manager on the secondary line. At the bottom,
a full-width filled button "Start chat". Flat rows with dividers, 16dp margins, no gradients.
```

#### INT-MR-10 · Active call
`states: error`
```
Design a single Android Material 3 mobile active call screen for RetailOps, an internal B2B
e-commerce operations app, on a dark surface.
Centred: a large circular avatar, the contact name "Priya Sharma" in 22sp, a call status line
"Connected · 04:12" in tabular figures, and a small caption "RetailOps voice". Below, a grid of
circular call controls in two rows: mute, speaker, keypad and hold on the first row; add call and
transfer on the second. At the bottom centre, a large circular red end-call button with a
phone-down icon. One control, speaker, is shown active with a filled light background. Keep the
layout airy with generous spacing. Dark background #0E1626 with light text. No gradients, no
imagery.
```

#### INT-MR-11 · Call history
`states: empty, offline`
```
Design a single Android Material 3 mobile call history screen for RetailOps, an internal B2B
e-commerce operations app.
Top app bar: back arrow, title "Calls", a search icon and a filter icon. Bottom navigation with
5 items — Home, Catalog, Growth, Ops, More — More selected.
Body: a segmented control "All / Missed" with All selected. Then a list of 7 call rows. Each row
has a circular avatar with a small directional badge in the corner — a green down-left arrow for
incoming, a blue up-right arrow for outgoing, and a red missed-call icon — the contact name in 14sp
medium, a secondary line with the call type and duration such as "Outgoing · 4 m 12 s" or
"Missed", and a right-aligned relative time in tabular figures, plus a call icon button on the
right edge for quick redial. Flat rows with dividers, 16dp margins, no gradients.
```

#### INT-MR-12 · Call detail
`states: offline`
```
Design a single Android Material 3 mobile call detail screen for RetailOps, an internal B2B
e-commerce operations app.
Top app bar: back arrow, title "Call details", and an overflow menu. Bottom navigation with 5
items — Home, Catalog, Growth, Ops, More — More selected.
Body: a header card with a circular avatar, the contact name in 16sp medium, a secondary line with
the role, and a row of two buttons — an outlined "Call back" and a text "Message". Below, a details
card with label–value rows: "Type Outgoing", "Started 3 Oct, 4:12 PM", "Duration 4 m 12 s",
"Ended by You", "Network Wi-Fi", "Quality Good" with a green dot. Then a section header "Related"
above 2 rows linking to a seller and a task, each with an icon, a title and a chevron. At the
bottom, a text button "Report a problem". Flat cards, 16dp margins, no gradients.
```

---

## 3. Admin (12 screens)

---

#### INT-MR-13 · Users — list
`perm: users_view` · `states: empty, filtered-empty`
```
Design a single Android Material 3 mobile user list screen for RetailOps, an internal B2B
e-commerce operations app.
Top app bar: back arrow, title "Users", a search icon and a plus icon. Bottom navigation with 5
items — Home, Catalog, Growth, Ops, More — More selected.
Body: a search field labelled "Search users", then a row of filter chips — "Active ×", "Brand
Manager ×" — plus "Clear all". Below, a list of 7 user rows. Each row has an avatar with a small
coloured ring indicating the role colour, the user name in 14sp medium, a secondary line with the
email, and a right-aligned role chip in the role's colour such as "Operational Manager" or "Brand
Manager". One row shows a small grey chip "Inactive" and one shows a small amber chip "Invited".
A stats strip at the top reads "42 users · 38 active · 4 invited" in tabular figures. Flat rows
with dividers, 16dp margins, no gradients.
```

#### INT-MR-14 · User detail / edit
`perm: users_manage` · `states: conflict`
```
Design a single Android Material 3 mobile user detail and edit screen for RetailOps, an internal
B2B e-commerce operations app.
Top app bar: back arrow, a two-line title — "Users" above "Akash Mehta" — with an overflow menu
containing "Reset password", "Deactivate" in red, and "Sign out everywhere". Bottom navigation
with 5 items — Home, Catalog, Growth, Ops, More — More selected.
Body: a header card with a large avatar with a role-coloured ring, the name in 18sp medium, the
email as a secondary line, and a row of chips — a role chip "Operational Manager" and "Active".
Below, a section header "Details" with a filled field "First name", a filled field "Last name", a
filled field "Phone", and a read-only row showing "Role Operational Manager" with a chevron.
Then a section header "Seller access" with a list of 6 checkbox rows for sellers, four checked,
plus a caption "Scoped access applies to all data in the app." Then a section header "Security"
with label–value rows — "Last login 2 h ago", "Trusted devices 2", "Password changed 14 days ago".
At the bottom, a filled button "Save changes". Flat cards, 16dp margins, no gradients.
```

#### INT-MR-15 · Roles & permissions
`perm: roles_view` · `states: empty`
```
Design a single Android Material 3 mobile roles list screen for RetailOps, an internal B2B
e-commerce operations app.
Top app bar: back arrow, title "Roles and permissions", a plus icon. Bottom navigation with 5 items
— Home, Catalog, Growth, Ops, More — More selected.
Body: a short caption "Roles decide what each person can see and do." Below, a list of 6 role cards.
Each card has a circular icon in the role's colour, the role display name in 14sp medium such as
"Operational Manager", a secondary line with the description, and a footer row with two inline
stats in tabular figures — "24 permissions" and "6 users" — plus a right-aligned chevron. One card
carries a small neutral chip "System role" indicating it cannot be deleted. Flat cards, 16dp
margins, no gradients.
```

#### INT-MR-16 · Role detail / permission editor
`perm: roles_manage` · `states: conflict`
```
Design a single Android Material 3 mobile permission editor screen for RetailOps, an internal B2B
e-commerce operations app.
Top app bar: back arrow, a two-line title — "Roles" above "Brand Manager" — and a text button
"Save". Bottom navigation with 5 items — Home, Catalog, Growth, Ops, More — More selected.
Body: a header card with a role-coloured icon, the role name, a description, and a row of chips
"Level 50", "6 users". Below, a section header "Permissions" with a right-aligned "Select all" text
button, followed by grouped sections, each with a small header and a list of toggle rows: group
"Marketplace" with rows "Seller Manager: View" on, "ASIN Manager: View" on, "ASIN Manager: Export"
on, "ASIN Manager: Manage" off; group "Analytics" with "Dashboard: View" off and "Activity Logs:
View" off; group "Reports" with "SKU Report: View" off. Each row shows the permission display name
in 14sp medium with the permission key in monospace 12sp as a secondary line, and a switch on the
right. A sticky counter sits above the save button reading "12 of 48 enabled". Flat cards, 16dp
margins, no gradients.
```

#### INT-MR-17 · API keys
`perm: apikeys_manage` · `states: empty, error`
```
Design a single Android Material 3 mobile API keys screen for RetailOps, an internal B2B
e-commerce operations app.
Top app bar: back arrow, title "API keys", and a plus icon. Bottom navigation with 5 items — Home,
Catalog, Growth, Ops, More — More selected.
Body: a warning notice card in amber with a shield icon reading "Keys grant full API access. Store
them securely and rotate them regularly." Below, a list of 4 key cards. Each card has a 14sp name
such as "Octoparse integration", a secondary line with masked key text in monospace such as
"gms_live_••••••••4f2a", and a row of captions — "Created 12 Aug 2026", "Last used 2 h ago",
"Scopes: read, write". Each card has a footer row with two text buttons, "Reveal" and "Revoke" in
red. One key is dimmed with a grey chip "Revoked". At the bottom, a note with an info icon reading
"Revealing a key is logged in the activity log." Flat cards, 16dp margins, no gradients.
```

#### INT-MR-18 · System settings
`perm: settings_manage` · `states: conflict`
```
Design a single Android Material 3 mobile settings screen for RetailOps, an internal B2B
e-commerce operations app.
Top app bar: back arrow, title "System settings". Bottom navigation with 5 items — Home, Catalog,
Growth, Ops, More — More selected.
Body: grouped sections of setting rows. Group "General": "Organisation name" with a value "Brand
Central", "Timezone" with "Asia/Kolkata", "Currency" with "INR (₹)", "Date format" with
"DD MMM YYYY". Group "Data": "Sync schedule" with "Every 6 hours", "Data retention" with
"24 months", "Export row limit" with "100,000". Group "Alerts": toggle rows for "Email
notifications" on, "In-app notifications" on, and "Slack webhook" off. Group "Maintenance": a row
"Maintenance mode" with a switch currently off and a caption "Blocks all non-admin access when
on". Each row shows a label in 14sp with the current value right-aligned in 14sp grey, or a switch.
One row carries a small amber chip "Requires restart". Flat cards, 16dp margins, no gradients.
```

#### INT-MR-19 · Activity log
`perm: activitylogs_view` · `states: empty, filtered-empty, offline`
```
Design a single Android Material 3 mobile activity log screen for RetailOps, an internal B2B
e-commerce operations app.
Top app bar: back arrow, title "Activity log", a search icon and a filter icon. Bottom navigation
with 5 items — Home, Catalog, Growth, Ops, More — More selected.
Body: a row of filter chips — "Today ×", "All users ×" — plus "Clear all". Below, a timeline list
of 8 entries grouped by relative day labels ("Today", "Yesterday"). Each entry has a small circular
icon tinted by action type, a sentence in 14sp such as "Akash Mehta updated tag on B0XXXXXXXXXX" or
"System ran ruleset Pricing guardrails", a secondary line with the entity and the IP address, and a
right-aligned time in tabular figures. One entry is a warning, shown with an amber icon and a
"Permission denied" outcome chip. Load more appears at the end. Flat rows with dividers, 16dp
margins, no gradients.
```

#### INT-MR-20 · File manager
`perm: files_manage` · `states: empty, upload`
```
Design a single Android Material 3 mobile file manager screen for RetailOps, an internal B2B
e-commerce operations app.
Top app bar: back arrow, title "Files", a search icon and an upload icon. Bottom navigation with
5 items — Home, Catalog, Growth, Ops, More — More selected.
Body: a breadcrumb row reading "Root / Uploads / 2026-10" with a small home icon. Below, a
segmented control "Grid / List" with List selected. Then a list of 6 file rows, each with a file
type icon, the file name in 14sp medium, a secondary line with size, uploader and date such as
"2.4 MB · Akash Mehta · 2 Oct", and an overflow menu on the right. Include one row showing an
in-progress upload with a thin progress bar and a percentage in tabular figures. At the bottom,
a caption with the total "42 files · 180 MB of 5 GB used". Flat rows with dividers, 16dp margins,
no gradients.
```

#### INT-MR-21 · Upload / export queue
`states: upload, error`
```
Design a single Android Material 3 mobile jobs queue screen for RetailOps, an internal B2B
e-commerce operations app, showing uploads and exports.
Top app bar: back arrow, title "Downloads and exports", and an overflow menu. Bottom navigation
with 5 items — Home, Catalog, Growth, Ops, More — More selected.
Body: a segmented control "Active / Completed / Failed" with Active selected. Under Active, two
cards: one export with a chart icon, the title "SKU report export", a secondary line "XLSX ·
1,24,802 rows", a progress bar at 64% with "Preparing…" and a "Cancel" text button; and one upload
with a spreadsheet icon, "Sponsored_Products_Oct.xlsx", a secondary line "Uploading · 1.8 MB of
3.1 MB", and a progress bar at 58%. Under Completed, two rows each with a green check, the file
name, a secondary line with size and time, and a "Share" text button plus a download icon button.
One failed row shows a red icon, a cause line "Server rejected the file (422)" and a "Retry" text
button. Flat cards, 16dp margins, no gradients.
```

---

## 4. Account (6 screens, shared by both surfaces)

---

#### INT-MR-22 · Profile
```
Design a single Android Material 3 mobile profile screen for RetailOps, an internal B2B
e-commerce operations app.
Top app bar: back arrow, title "Profile". Bottom navigation with 5 items — Home, Catalog, Growth,
Ops, More — More selected.
Body: a header card centred with a large avatar with an edit badge on the corner, the name "Akash
Mehta" in 18sp medium, the email as a secondary line, and a role chip "Operational Manager" in the
role colour. Below, a section header "Details" with a filled field "First name", a filled field
"Last name", a filled field "Phone", and a read-only row "Email" with a caption "Contact an admin
to change your email". Then a section header "Seller access" listing 4 sellers as chips. At the
bottom, a filled button "Save changes" and a text button "Sign out" in red. Flat cards, 16dp
margins, no gradients.
```

#### INT-MR-23 · Security
`states: empty, error`
```
Design a single Android Material 3 mobile security screen for RetailOps, an internal B2B
e-commerce operations app.
Top app bar: back arrow, title "Security". Bottom navigation with 5 items — Home, Catalog, Growth,
Ops, More — More selected.
Body: a section header "Sign-in" with toggle rows — "Biometric unlock" with a caption "Use your
fingerprint instead of your password" and a switch on, and "Trust this device" with a switch on.
Then a section header "Password" with a row "Change password" and a chevron, and a caption "Last
changed 14 days ago". Then a section header "Trusted devices" with 2 rows showing device name,
last-used time and a "Remove" text button, plus a "Manage all devices" row with a chevron. Then a
section header "Sessions" with a row "Sign out of all other devices" in red with an icon. Flat
cards, 16dp margins, no gradients.
```

#### INT-MR-24 · Notification preferences
`states: empty`
```
Design a single Android Material 3 mobile notification preferences screen for RetailOps, an
internal B2B e-commerce operations app.
Top app bar: back arrow, title "Notifications". Bottom navigation with 5 items — Home, Catalog,
Growth, Ops, More — More selected.
Body: a caption "Choose what reaches you and where." Then grouped sections where each event type
has three small toggle chips for "Push", "Email" and "In app". Group "Alerts": rows for "Price
drops", "Rank changes", "Buy Box lost", "Stock alerts" — with the first two having push on, email
off, in-app on. Group "Tasks": rows for "Assigned to me" (all three on), "SLA warnings" (push and
in-app on), "Comments and mentions" (push on). Group "Reports": rows for "Export ready" (push on)
and "Weekly digest" (email on). Each row shows the event name in 14sp medium above the three toggle
chips. Flat cards, 16dp margins, no gradients.
```

#### INT-MR-25 · Appearance & accessibility
```
Design a single Android Material 3 mobile appearance settings screen for RetailOps, an internal
B2B e-commerce operations app.
Top app bar: back arrow, title "Appearance". Bottom navigation with 5 items — Home, Catalog, Growth,
Ops, More — More selected.
Body: a section header "Theme" with three large selectable preview tiles side by side — "Light",
"Dark" and "System" — each showing a miniature card mock in the corresponding colours, with System
selected and marked by a primary border and a check. Below, a caption "Preview" card showing a small
sample surface. Then a section header "Text size" with a slider from "Small" to "Large" and the
current value "Default" shown above it, followed by a live preview line of text. Then a section
header "Motion" with toggle rows — "Reduce motion" with a caption "Replaces animations with simple
fades" and a switch off, and "Haptics" with a switch on. Then a section header "Language" with a row
"English (India)" and a chevron. Flat cards, 16dp margins, no gradients.
```

#### INT-MR-26 · About & diagnostics
`states: empty`
```
Design a single Android Material 3 mobile about screen for RetailOps, an internal B2B e-commerce
operations app.
Top app bar: back arrow, title "About". Bottom navigation with 5 items — Home, Catalog, Growth,
Ops, More — More selected.
Body: a header card centred with the app icon, "RetailOps" in 18sp medium, "Version 1.0.0
(build 248)" in 12sp grey, and a small chip matching the surface — "Internal workspace" or "Seller
workspace". Below, a section header "Diagnostics" with label–value rows in tabular figures — "API
endpoint data.brandcentral.in", "API version 2.5.0", "Last sync 12 min ago", "Device ID
8f2c-41ab", "User ID usr_1042" — each with a small copy icon on the right. Then a section header
"Connectivity" with rows "Status Connected" with a green dot, "Latency 84 ms", "Cache 42 MB". At
the bottom, an outlined button "Copy diagnostics" and a text button "View open-source licences".
Flat cards, 16dp margins, no gradients.
```

#### INT-MR-27 · Help & support
```
Design a single Android Material 3 mobile help screen for RetailOps, an internal B2B e-commerce
operations app.
Top app bar: back arrow, title "Help and support". Bottom navigation with 5 items — Home, Catalog,
Growth, Ops, More — More selected.
Body: a search field labelled "Search help" at the top. Below, a section header "Common questions"
above 5 expandable rows, each with a question in 14sp medium and a chevron, with the first one
expanded to show two short paragraphs of 14sp answer text. Then a section header "Contact" above
2 rows — "Chat with support" with a chat icon and a "Replies in about 1 hour" caption, and "Email
support" with a mail icon and the address caption. Then a section header "Legal" with rows for
"Privacy policy", "Terms of use" and "Open-source licences", each with a chevron. Flat cards, 16dp
margins, no gradients.
```

---

## 5. System states (7 screens, both surfaces)

---

#### SYS-01 · No access (403) ★ critical
```
Design a single Android Material 3 mobile permission-denied screen for RetailOps, a B2B
e-commerce operations app.
Centred content on a plain background: a shield icon in a soft grey circle, a headline "You don't
have access" in 22sp, and two lines of supporting text in 14sp — "The Users page needs the
users_view permission. Ask an administrator if you need it." Below, a small card showing
"Request ID 8f2c-41ab" in monospace with a copy icon on the right. At the bottom, a row of two
buttons — an outlined "Go back" and a filled "Go home". No navigation bar is shown, because the
user is being routed away. Flat, calm, no gradients, no illustrations.
```

#### SYS-02 · You're offline
```
Design a single Android Material 3 mobile offline screen for RetailOps, a B2B e-commerce operations
app, shown when there is no connection and no cached data.
Centred content: a cloud-off icon in a soft grey circle, a headline "You're offline" in 22sp, and
supporting text in 14sp reading "Check your connection. Your last data update was 2 hours ago."
Below, a small neutral chip reading "Showing cached data · updated 2 h ago". At the bottom, a
full-width filled button "Try again" and a text button "View cached data". Above the content, add a
slim amber banner spanning the width reading "Offline — some data may be out of date". Flat, calm,
no gradients.
```

#### SYS-03 · Maintenance
```
Design a single Android Material 3 mobile maintenance screen for RetailOps, a B2B e-commerce
operations app.
Centred content: a wrench or settings icon in a soft amber circle, a headline "RetailOps is under
maintenance" in 22sp, supporting text in 14sp reading "We're updating the platform. Access returns
shortly — your data is safe.", and a small card showing "Started 3 Oct, 2:00 AM IST" in tabular
figures. At the bottom, a full-width outlined button "Check again" and a caption "Last checked
12 seconds ago". Flat, calm, no gradients, no navigation bar.
```

#### SYS-04 · Update required
```
Design a single Android Material 3 mobile forced-update screen for RetailOps, a B2B e-commerce
operations app.
Centred content: an upward arrow icon in a soft blue circle, a headline "Update required" in 22sp,
supporting text in 14sp reading "This version of RetailOps is no longer supported. Update to keep
using the app.", and a small card listing "Installed 1.0.0" above "Required 1.2.0 or later" in
monospace. At the bottom, a full-width filled button "Update now" that opens the Play Store, and a
text button "What's new". No navigation bar, no way to dismiss. Flat, no gradients.
```

#### SYS-05 · Rate limited (429)
```
Design a single Android Material 3 mobile inline error card for RetailOps, a B2B e-commerce
operations app, shown when a request is rate limited.
The card sits inside a list screen, above the existing content which remains visible and dimmed.
The card has a 12dp radius, an amber tinted background and a timer icon, with a headline "Too many
requests", supporting text "Please wait a moment before trying again.", and a right-aligned
countdown in tabular figures reading "Retry in 0:24" next to a disabled text button "Retry". The
screen behind keeps its app bar and bottom navigation with 5 items intact. Flat, no gradients.
```

#### SYS-06 · Something went wrong
```
Design a single Android Material 3 mobile error screen for RetailOps, a B2B e-commerce operations
app.
Centred content: a warning icon in a soft red circle, a headline "Something went wrong" in 22sp,
supporting text in 14sp reading "We couldn't load this page. The problem has been reported." Below,
a card with two rows in monospace — "Request ID 8f2c-41ab" and "Code 500" — each with a copy icon.
At the bottom, a full-width filled button "Try again" and a text button "Go home". Flat, calm, no
gradients, no navigation bar.
```

#### SYS-07 · Sync failed
```
Design a single Android Material 3 mobile inline banner for RetailOps, a B2B e-commerce operations
app, shown when a data sync fails.
The banner spans the full width directly under the app bar, with a light red background, a
cloud-off icon, a headline in 14sp medium reading "Last refresh failed", a secondary line
"The last successful sync was 2 days ago", and a right-aligned text button "Retry". Below the
banner, the screen content continues with real cards at 60% opacity to indicate stale data, and a
small amber chip "Stale" is visible next to a section header. Keep the app bar and bottom
navigation with 5 items intact. Flat, no gradients.
```

---

## 6. Generation order for this file

1. `X-01 More` — it establishes the drawer pattern reused by both surfaces
2. `SYS-01`, `SYS-06`, `SYS-02` — the error language appears in many screenshots
3. `INT-MR-22` to `INT-MR-27` — account screens are shared by both surfaces; do them before
   the seller file so you can reuse them
4. `INT-MR-01` to `INT-MR-12` — People & communication
5. `INT-MR-13` to `INT-MR-21` — Admin; lowest risk, do these last when the budget is tighter
