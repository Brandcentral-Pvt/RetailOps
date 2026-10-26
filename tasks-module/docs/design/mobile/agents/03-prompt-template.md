# Prompt Template

**Document ID:** `RO-MOB-AG-003` · **Version:** 1.0.0
**Purpose:** the exact shape every screen prompt follows. `tools/build-registry.mjs` writes
the role block; the rest is authored once and never re-styled per prompt.

---

## 1. Anatomy

```
#### <SCREEN-ID> · <Screen name> [★ critical]
`<metadata>` · <notes>

```
Role: <surface audience> — <roles>. Scope: <data scope>. Permission: <permission>.
Required states: <canonical state ids>.          ← or: Kind: state screen — …

<One sentence: what this screen is and for which surface.>

Top app bar: <exact contents>.
Bottom navigation bar with 5 items: <surface nav list> — show <X> selected.

Body, top to bottom:
1. <region>
2. <region>
3. <region>

<Formatting and language constraints.>
<Negative constraints.>
```
```

The **role block is machine-generated** from `registry/screens.json`. Everything below it is
hand-authored and screen-specific.

---

## 2. Field rules

| Part | Rule | Enforced by |
|---|---|---|
| **Heading** | `#### <ID> · <Name>` — the ID must exist in `03-screen-inventory.md` | `build-registry` |
| **Metadata line** | Backticked keys only: `` `perm: x` ``, `` `states: a, b` ``, `` `surface: seller` ``, `` `kind: state screen` `` | `build-registry` |
| **Role block** | Generated. Never edited by hand. Regenerate with `--write-prompts` | C-01, C-44 |
| **Opening sentence** | Must contain "Design a single Android Material 3 mobile … screen" | C-03, C-04 |
| **App bar** | Always specified, even when it is "a back arrow and a title" | — |
| **Nav bar** | Always the five surface items, plus which one is selected | C-05, C-06 |
| **Body regions** | Numbered, in visual order. Six to eight regions maximum | — |
| **Constraints** | End with the standard negative constraints | C-08 |

---

## 3. Standard blocks (copy verbatim)

**Shell — internal, top-level**

```
Top app bar: a rounded chip reading "All sellers" with a dropdown caret on the left, a search
icon, a notification bell with a badge showing 3, and a circular avatar on the right.
Bottom navigation bar with 5 items: Home, Catalog, Growth, Ops, More — show <X> selected.
```

**Shell — internal, detail**

```
Top app bar: a back arrow, a two-line title — "<Parent>" in 12sp grey above "<Subject>" in 16sp
medium — and an overflow menu.
Bottom navigation bar with 5 items: Home, Catalog, Growth, Ops, More — show <X> selected.
```

**Shell — seller, top-level**

```
Top app bar: the seller name "Seller A" in 16sp medium with a small teal chip beneath reading
"Seller", and a notification bell on the right. There is no seller switcher.
Bottom navigation bar with 5 items: Home, Performance, My Products, Requests, More — show <X> selected.
```

**Closer — always last**

```
Use Indian currency grouping. Flat white cards with hairline borders, 12dp radius, 16dp
margins. No gradients, no heavy shadows, no floating action button over the navigation bar.
```

**Data realism block** (include whenever the screen shows products or money)

```
Use realistic placeholder data: ASINs in monospace like B0XXXXXXXXXX, product names such as
"Nike Air Zoom Pegasus 40", seller "Seller A", rupees in Indian grouping such as ₹12,48,300.
```

---

## 4. Worked example

**Input** — one registry record:

```json
{
  "id": "INT-CT-08",
  "name": "ASIN Tracker list",
  "surface": "internal",
  "permission": "asintracker_view",
  "scope": "all/assigned",
  "states": ["empty-true", "empty-filtered", "offline-cached", "stale-partial"],
  "roleKeys": ["admin", "operational_manager", "Brand Manager", "catalog_manager", "listing_team"]
}
```

**Compiled prompt** (role block generated, body authored):

```
Role: internal RetailOps staff — Admin / Super Admin, Operational Manager, Brand Manager,
Catalog Manager, Listing Team, Reviewer, Viewer. Scope: all/assigned. Permission: asintracker_view.
Required states: empty-true, empty-filtered, offline-cached, stale-partial.

Design a single Android Material 3 mobile tracker list screen for RetailOps, an internal B2B
e-commerce operations app, for monitoring price and rank changes.

Top app bar: a back arrow, title "ASIN Tracker", and an overflow menu.
Bottom navigation bar with 5 items: Home, Catalog, Growth, Ops, More — show Catalog selected.

Body: a freshness strip reading "Updated 1 hour ago" with a refresh icon. Below, a segmented
control "All / Dropped / Improved / Unchanged" with "Dropped" selected. Then a list of 5 rows,
each showing the ASIN in monospace, the product title on one line, and a right-aligned block
with the current price in tabular figures above a coloured delta — for example "₹4,499" with
"▼ −22.0%" in red. Each row also has a thin 32dp sparkline under the title, and a rank line
"BSR 142 (was 104)".

Use Indian currency grouping. Flat white cards with hairline borders, 12dp radius, 16dp
margins. No gradients, no heavy shadows, no floating action button over the navigation bar.
```

**Audit** — `node agents/tools/validate-screen.mjs --file <this prompt>` → described in
`02-consistency-contract.md`. Score: 0 blockers.

---

## 5. Authoring a new screen

1. Add the screen to `03-screen-inventory.md` — ID, name, surface, roles, permission, scope, states.
2. Write the prompt body in the matching file (`08`–`11`) as a fenced block, following §1.
3. Run `node agents/tools/build-registry.mjs --write-prompts` — this stamps the role block.
4. Run `node agents/tools/validate-screen.mjs --file <file>` — fix until 0 blockers.
5. Run `node agents/tools/build-registry.mjs --check` in CI to prevent drift.

Never write a role block by hand. It is derived from data that already exists in two other
places, and hand-written copies are how the three drift apart.

---

## 6. Role block reference

| Field | Source | Example |
|---|---|---|
| Audience | `surface` | `internal RetailOps staff` · `seller client (paying merchant)` · `both surfaces` |
| Roles | inventory Roles column → `roles.json` | `Admin / Super Admin, Operational Manager, Brand Manager, …` |
| Scope | inventory Scope column | `all/assigned` · `own` |
| Permission | prompt metadata, else inventory | `asinmanager_view` |
| States | prompt metadata, else inventory letters | `empty-true, empty-filtered, selection-bulk, offline-cached, stale-partial` |
| Kind | prompt metadata, for `SYS-*` and shells | `state screen — this screen is itself a state.` |
