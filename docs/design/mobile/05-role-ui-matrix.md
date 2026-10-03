# RetailOps Android — Role → UI Matrix

**Document ID:** `RO-MOB-DS-005` · **Version:** 1.0.0 · **Depends on:** `01-design-schema.md` §4

The bridge between backend RBAC and what a user actually sees. Every row is derived from
the seeded permission sets in `backend/controllers/roleController.js`
(`defaultPermissions` + `permissionSets`) and the seeded roles in `init-database.sql`.

> **Read §4 first.** This document is not aspirational — it reflects what the backend
> grants *today*, which is why it also contains a blocker report (§4) that must be
> resolved before the app is useful to anyone except admins.

---

## 1. Legend

| Symbol | Meaning |
|---|---|
| **M** | Visible, full management (create / edit / delete where the module supports it) |
| **V** | Visible, read-only |
| **E** | Additionally has export |
| **I** | Additionally has import |
| **◐** | Visible but scoped to assigned sellers only (§4 Axis C) |
| **·** | Not visible; no nav entry; deep links land on `SYS-01` |
| — | Module does not apply to this surface |

Roles: `SA` = super_admin, `AD` = admin, `OM` = operational_manager,
`BM` = Brand Manager, `CM` = catalog_manager, `LT` = listing_team,
`R/V` = reviewer / viewer (legacy seeds), `SC` = seller_client (proposed).

`BM`, `CM`, `LT` are always `◐` (assigned-seller scope) because their data access is
seller-scoped by role definition.

---

## 2. The matrix

| Module | Required permission(s) | SA | AD | OM | BM | CM | LT | R/V | SC |
|---|---|---|---|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| **Home** | | | | | | | | | |
| Dashboard | `dashboard_view` | M | M | M | **·** | **·** | **·** | **·** | V◐ |
| Alerts inbox | `dashboard_view` \| `targets_view` | M | M | M | V◐ | V◐ | V◐ | · | V◐ |
| Alert rules | `rules_view` / `rules_manage` | M | M | M | · | · | · | · | — |
| Notifications | — | V | V | V | V | V | V | V | V |
| Global search | — | V | V | V | V◐ | V◐ | V◐ | V | V◐ |
| **Catalog** | | | | | | | | | |
| ASIN Manager | `asinmanager_view` (+`_manage`,`_import`,`_export`) | M I E | M I E | M I E | V E ◐ | V E ◐ | V◐ | · | V E ◐ |
| ASIN Tracker | `asintracker_view` | M | M | M | V◐ | V◐ | V◐ | · | V◐ |
| Listing Quality | `asinmanager_view` | V | V | V | V◐ | V◐ | V◐ | · | V◐ |
| Keyword Research | `keywords_view` / `_export` / `_manage` | M E | M E | M E | V E ◐ | V E ◐ | V E ◐ | · | V◐ |
| **Growth** | | | | | | | | | |
| Ads | `adsreport_view` / `_export` / `_import` | M I E | M I E | M I E | **·** | **·** | **·** | · | V E ◐ |
| Targets | `targets_view` / `_create` `_edit` `_delete` `_export` | M E | M E | M E | V◐ | V◐ | V◐ | · | V◐ |
| GMS Tracker | `gms_tracker_view` / `_import` / `_export` | M I E | M I E | M I E | V I E ◐ | V◐ | V◐ | · | V E ◐ |
| Reports (SKU, Parent, Monthly, P&L, Inventory, Goals) | `*report_view` / `_export` | M E | M E | M E | **·** | **·** | **·** | · | V E ◐ |
| Revenue Calculator | `calculator_view` / `_manage` | M | M | M | · | · | · | · | — |
| **Ops** | | | | | | | | | |
| Tasks / PEMS | `tasks_view` / `tasks_manage` | M | M | M | M◐ | M◐ | M◐ | V | V +submit ◐ |
| Action Center | `actions_view` / `actions_manage` | M | M | M | **·** | **·** | **·** | · | V◐ |
| Rulesets | `rules_view` / `rules_manage` | M | M | M | · | · | · | · | — |
| Scheduled runs & scrapers | `scraping_view` / `_manage` | M | M | M | · | · | · | · | — |
| Templates | `templates_manage` | M | M | M | · | · | · | · | — |
| **People** | | | | | | | | | |
| Sellers | `seller_view` / `seller_manage` | M | M | M | V◐ | V◐ | V◐ | · | — |
| Teams | `teams_manage` | M | M | M | · | · | · | · | — |
| Chat | `chat_view` | V | V | V | **·** | **·** | **·** | · | V◐ |
| Calls | `chat_view` | V | V | V | **·** | **·** | **·** | · | V◐ |
| **Admin** | | | | | | | | | |
| Users | `users_view` / `users_manage` | M | M | **·** | · | · | · | · | — |
| Roles & permissions | `roles_view` / `roles_manage` | M | M | **·** | · | · | · | · | — |
| API keys | `apikeys_manage` | M | M | **·** | · | · | · | · | — |
| System settings | `settings_manage` | M | M | **·** | · | · | · | · | — |
| Activity log | `activitylogs_view` | V | V | V | · | · | · | · | — |
| File Manager | `files_manage` | M | M | M | · | · | · | · | — |
| **Account** | | | | | | | | | |
| Profile, Security, Preferences | — | V | V | V | V | V | V | V | V |

`·` in **bold** marks a gap that is a defect rather than a decision — see §4.

---

## 3. Resulting navigation per role

The five nav slots are filled by the registry (§7.3 of the schema). Empty slots collapse.
This is what each persona actually gets on a phone:

**Admin / Super Admin**
`Home · Catalog · Growth · Ops · More` — all five populated; More adds People + Admin.

**Operational Manager**
`Home · Catalog · Growth · Ops · More` — same, minus Users / Roles / API keys / Settings.
*This is the reference experience: it is the one role the current permission set fully supports.*

**Brand Manager**
```
Home (empty)  ·  Catalog (ASIN, Tracker, Quality, Keywords)  ·  Growth (Targets, GMS)
·  Ops (Tasks)  ·  More (Sellers, Account)
```
Three of five slots work. **Home renders an empty state**, Ads and Reports are absent,
and Chat is missing — the exact features a brand manager needs in the field.

**catalog_manager / listing_team**
Same shape as Brand Manager, with progressively less in Catalog (no export) and Growth
(Targets and GMS read-only).

**reviewer / viewer**
No permissions are seeded for these roles at all, so they see `Home` empty, `More` with
only Account, and nothing else. Either seed them or remove them from the role list.

**seller_client** (proposed)
`Home · Performance · My Products · Requests · More`, pinned to one seller, with no
switcher.

---

## 4. Blocker report — the permission sets starve the app

`permissionSets` in `roleController.js` grants a **narrow** set to every non-admin role.
The consequences land squarely on the mobile UI:

| # | Gap | Effect on the app | Severity |
|---|---|---|---|
| **G-1** | `dashboard_view` is granted **only to admin and operational_manager** | Home shows an empty state for Brand Manager, catalog_manager, and listing_team — the primary screen is dead for 3 of 5 internal roles | **Critical** |
| **G-2** | `adsreport_view` is granted only to admin/OM | The entire Advertising module is absent for the roles closest to the work | High |
| **G-3** | `chat_view` is granted only to admin/OM | Chat and Calls are dead. Chat is the feature that most justifies a mobile app | **Critical** |
| **G-4** | `actions_view` only for admin/OM | Action Center missing for the roles who execute actions | High |
| **G-5** | All six report views (`sku`, `parent`, `monthly`, `pnl`, `inventory`, `goals`) only for admin/OM | The whole Reports hub is empty for other roles | High |
| **G-6** | `reviewer` and `viewer` have **no permissions seeded** | Two roles exist that can do nothing | Medium |
| **G-7** | No permission expresses "see **my own** alerts" | The seller surface has no safe way to grant alerts without granting a dashboard | High |
| **G-8** | No permission expresses "raise a request" or "approve as the client" | The seller's core interaction (Needs your input → respond) has no capability model | High |
| **G-9** | Two role taxonomies coexist (`init-database.sql` vs `roleController`) | Role chips, colours, and level-based logic disagree; screenshot review becomes non-reproducible | High |
| **G-10** | **Permission-name mismatch:** `sellerAsinTrackerRoutes.js` guards with `sellers_view` / `sellers_manage`, but the seeded permission names are `seller_view` / `seller_manage` (singular) | `POST /api/seller-tracker/*` and `GET /api/seller-tracker/*` return **403 for every role except admin**, which bypasses via the hard-coded role check in `requireAnyPermission`. Seller Tracker screens would be unreachable in production | **Critical** |
| **G-11** | `requirePermission` / `requireAnyPermission` short-circuit on the role *name* (`admin`, `super_admin`) before consulting permissions | A custom role granted "everything" is still blocked, and `admin` cannot be restricted. The app's permission-driven navigation then disagrees with the server's effective policy | Medium |

### 4.1 Recommended remediation (backend, before mobile build)

| Action | Detail |
|---|---|
| Seed `dashboard_view` for BM / CM / LT | Scoped to assigned sellers; the dashboard endpoint already honours scope via `authenticate` |
| Seed `adsreport_view` + `adsreport_export` for BM | Ads is the primary value driver for a brand manager |
| Seed `chat_view` for **every** internal role and for `seller_client` | Chat is the reason to open the app |
| Seed `actions_view` for BM and LT, `actions_manage` for BM | They execute actions; hiding the queue is counterproductive |
| Seed report views for BM (SKU, Parent, Monthly) and CM (Inventory) | Reading reports on a phone is a genuine use case |
| Seed a baseline for `reviewer` (approval queue + read) and `viewer` (read-only set), or delete the roles | Dead roles are a UI liability |
| Add `alerts_view` | Decouples "see alerts" from "see dashboard" |
| Add `tasks_submit` and `tasks_approve` | Gives the seller surface its own capability model without granting `tasks_manage` |
| **Fix the `sellers_view` / `seller_view` mismatch** in `sellerAsinTrackerRoutes.js` (G-10) | Single-line fix; without it the Seller Tracker module is admin-only |
| Replace the role-name bypass in `requirePermission` with an explicit `*` permission held by `admin` / `super_admin` (G-11) | Makes "admin sees everything" a data fact rather than a code path, so the app's navigation always matches the server |
| Unify the role taxonomy | Single source of truth; migration 016 already treats `roleController` as canonical — retire the `init-database.sql` duplicates |

Until G-1 and G-3 are resolved, the only persona for whom the mobile app is fully
functional is admin/operational_manager. That is a product decision, not a design one —
and it must be made before wireframes are locked.

---

## 5. Proposed `seller_client` role

The seller surface needs a capability model of its own: broad enough to be useful,
narrow enough that a seller can never see another seller's data or internal machinery.

```json
{
  "name": "seller_client",
  "displayName": "Seller",
  "description": "External seller account holder. Scoped to their own seller account: performance, products, requests, chat. No internal operations.",
  "level": 20,
  "color": "#0E7490",
  "isSystem": true,
  "scope": "self"
}
```

**Granted permissions (proposed):**

| Permission | Why |
|---|---|
| `dashboard_view` | Home and Performance are dashboard-derived; scoped to `self` |
| `alerts_view` *(new)* | Their own alerts, without dashboard-adjacent internals |
| `asinmanager_view`, `asinmanager_export` | My Products + export of their own catalog |
| `asintracker_view` | Price and rank history |
| `keywords_view` | Keyword visibility for their own ASINs |
| `adsreport_view`, `adsreport_export` | Advertising performance, read-only |
| `gms_tracker_view`, `gms_tracker_export` | Sales/GMS read-only |
| `skureport_view`, `parentreport_view`, `monthlyreport_view`, `inventoryreport_view` | The report subset that is meaningful to a seller |
| `targets_view` | Target vs achievement |
| `tasks_view`, `tasks_submit` *(new)*, `tasks_approve` *(new)* | See requests, raise requests, respond to approvals |
| `chat_view` | Talk to their account manager |

**Explicitly denied** (must return 403, not an empty list): `asinmanager_manage`,
`asinmanager_import`, `adsreport_import`, `seller_view`, `seller_manage`, `users_*`,
`roles_*`, `apikeys_manage`, `settings_manage`, `scraping_view`, `rules_view`,
`templates_manage`, `teams_manage`, `files_manage`, `activitylogs_view`,
`calculator_*`, `actions_view`, `targets_create|edit|delete`.

**Hard requirements**
1. Every seller-facing endpoint must resolve scope from `UserSellers` server-side. The
   client must not be trusted to send a `sellerId` it is allowed to see.
2. A seller user must belong to **exactly one** seller in v1. Multi-seller sellers are a
   v2 question (`01-design-schema.md` §18.2).
3. Denied modules must not merely hide in the UI — the API must refuse, and the UI must
   render `SYS-01` on a deep link rather than a blank screen.

---

## 6. Enforcement rules

### 6.1 Three enforcement layers

| Layer | Where | Rule |
|---|---|---|
| **Registry** | Navigation composition | A destination with unmet permissions is never registered (§7.3) |
| **Screen** | Route guard | Every screen declares its permissions; deep links are validated before render → `SYS-01` on failure |
| **Affordance** | `PermissionGate` | Controls inside a screen are gated individually; a read-only user sees the data and no write controls |

### 6.2 Affordance mapping

| Suffix | Affordance |
|---|---|
| `_view` | Screen reachable; data visible |
| `_manage` / `_create` / `_edit` | Create, edit, delete controls visible |
| `_delete` | Delete controls visible **and** a typed/hold confirmation |
| `_export` | Export action visible; export is an async job (§16 P-8) |
| `_import` | Import action visible; upload flow available |
| `_approve` | Approve/reject controls visible; approval queue tab visible |

### 6.3 Prohibited patterns

1. ❌ Role-name checks in screen code (`user.role === 'admin'`). Roles change; permissions are the contract.
2. ❌ Rendering a control and letting it fail with a 403. Gate it, or hide it.
3. ❌ Showing a tab that resolves to an empty state because of permissions — that is the same as lying about what exists. Remove the destination instead.
4. ❌ Deriving permissions from a cached token without refresh. Permissions are re-read on `GET /auth/me` and on refresh; a revoked permission must remove the destination on the next refresh without requiring re-login.
5. ❌ Client-side scope filtering as a security control. It is a UX convenience only.
6. ❌ A permission gate that silently hides a control the user is *supposed* to request. Where a capability exists but is unheld, prefer `ReadOnlyNotice` naming what is required and who to ask.

---

## 7. Verification checklist

Before a role is signed off for release:

- [ ] Sign in as the role; the nav shows exactly the expected slots and no empty destinations
- [ ] Walk every nav destination; no screen renders a 403
- [ ] Deep link to a denied route → `SYS-01` with a sensible message, not a blank screen
- [ ] Toggle a permission off server-side mid-session; the destination disappears on the next app foreground without a re-login
- [ ] Seller scope: a `seller_client` account cannot retrieve another seller's data by manipulating an ID in a request
- [ ] Export/import affordances appear only with the corresponding permission
- [ ] Screenshot set is captured per role for review — the reference set for regression
