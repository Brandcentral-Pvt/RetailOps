# RetailOps Android — Component Library

**Document ID:** `RO-MOB-DS-004` · **Version:** 1.0.0 · **Depends on:** `01-design-schema.md`, `02-design-tokens.json`

The component contract. Every screen is built from these; nothing is built ad hoc.
Components are Material 3 **base** components with RetailOps-locked defaults, plus a set
of **domain** components that encode business rules (SLA, scope, freshness, permissions)
so those rules live in one place instead of in every screen.

---

## 1. Layering

```
┌───────────────────────────────────────────────────────────┐
│  Domain components      KpiCard · TaskCard · SlaPill ·    │
│  (RetailOps rules)      AsinCard · ScopeIndicator ·       │
│                         FreshnessChip · MetricDelta ·     │
│                         SellerSwitcher · PermissionGate   │
├───────────────────────────────────────────────────────────┤
│  Composed patterns      ListScaffold · DetailScaffold ·   │
│                         FilterSheet · EmptyState ·        │
│                         ErrorState · SelectionBar ·        │
│                         ReportViewer · ChatThread          │
├───────────────────────────────────────────────────────────┤
│  M3 base components     Button · TextField · Chip · Card ·│
│  (locked defaults)      NavigationBar · TopAppBar ·       │
│                         Dialog · Snackbar · Tabs · Menu   │
├───────────────────────────────────────────────────────────┤
│  Primitives             Icon · Text · Surface · Divider · │
│                         Skeleton · Progress                │
└───────────────────────────────────────────────────────────┘
```

Rule: a screen may **not** import a base component directly when a composed pattern or
domain component exists for the job. This is how "all nine states" stays cheap.

---

## 2. Mandatory components (build these first)

These nine are used by nearly every screen. They must exist before screen work begins.

| # | Component | Why it is mandatory |
|---|---|---|
| 1 | `ListScaffold` | Owns search + filters + sort + pagination + all five list states |
| 2 | `DetailScaffold` | Owns app bar, subtitle context, scroll behaviour, sticky action bar |
| 3 | `PermissionGate` | Single enforcement point for capability (Axis B) |
| 4 | `ScopeIndicator` | Single enforcement point for scope visibility (Axis C) |
| 5 | `SlaPill` | Encodes SLA thresholds and the colour+icon+word rule |
| 6 | `MetricDelta` | Encodes metric polarity (up-is-good vs down-is-good) |
| 7 | `FreshnessChip` | Encodes per-module staleness thresholds |
| 8 | `EmptyState` / `ErrorState` | Encodes the nine-state contract |
| 9 | `FilterSheet` | The one filter interaction pattern across every list |

---

## 3. M3 base components — locked defaults

### 3.1 Buttons

| Variant | Use | Height | Radius | Notes |
|---|---|---|---|---|
| Filled | The single primary action on a screen | 40 (48 large) | full | One per screen maximum |
| Tonal | Secondary action, confirmations | 40 | full | |
| Outlined | Neutral alternative, e.g. `Cancel` in dialogs | 40 | full | |
| Text | Tertiary inline, row-level actions | 40 | full | |
| Elevated | On imagery only | 40 | full | |
| FAB | Create / primary task for the screen | 56 | lg (16) | Bottom-right, 16 dp inset, above nav bar |
| Icon button | Toolbar and inline | touch 48 | full | Always has an accessible label |

Rules: label is `sentence case`, never truncated (wrap or shorten copy); destructive
actions use the danger-coloured filled variant **and** a confirm step; loading state keeps
the button width stable and shows a 18 dp spinner in place of the label.

### 3.2 Text fields

Filled style (matches Android and the existing app). Always a persistent label — never
placeholder-as-label. Assistive text reserved for errors and hints. Numeric fields use
`keyboardType` + tabular figures. `₹` and `%` are affixes, not part of the value.

### 3.3 Chips

| Variant | Use |
|---|---|
| Assist (outlined) | Suggestion, e.g. "Try 90 days" |
| Filter (outlined + check) | Active filter; always removable with an `×` |
| Input | Selected value inside a field |
| Status (custom `StatusChip`) | Read-only state, 24 dp, colour + icon + word |

### 3.4 Navigation components

| Component | Compact | Medium | Expanded |
|---|---|---|---|
| `NavigationBar` | ✅ 64 dp, ≤5 slots | — | — |
| `NavigationRail` | — | ✅ 80 dp | optional |
| `NavigationDrawer` | modal (from Home overflow) | modal | **permanent** 320 dp |
| `TopAppBar` | small (56) → medium (112) on scroll | small | small + inline search |

Badge rule: badge on a navigation slot reflects the count from that destination's
`badgeKey` (alerts · chat · tasks · notifications), recomputed from stores, never from a
per-screen fetch. Badges over 99 render `99+`.

### 3.5 Sheets, dialogs, snackbars

| Component | Use | Constraint |
|---|---|---|
| Bottom sheet | Filters, sort, pickers, quick detail, bulk actions | Never for confirmations; drag handle mandatory; max 90 % height; scrollable content inside |
| Full-screen dialog | Create/edit forms with many fields | Only when the form exceeds a sheet's useful height |
| Alert dialog | Confirmations, destructive actions, conflicts | Max 2 actions + `Cancel`; destructive action is rightmost and danger-coloured |
| Snackbar | Transient outcome | One at a time, 4 s, inline action, never for errors that need a decision |

---

## 4. Domain components

### 4.1 `KpiCard`

The most-seen component in the app.

```
┌────────────────────────────────┐
│ Revenue                    ⓘ   │  label · labelMedium · onSurfaceVariant
│ ₹12.5L                         │  value · metricLarge · tabular
│ ▲ +12.4%  vs prev 30d          │  MetricDelta + comparison basis
│ ~~~~~~~~~~~~~~                 │  sparkline (optional, 32 dp)
│ ● Stale · synced 2 d ago       │  FreshnessChip (conditional)
└────────────────────────────────┘
```

| Prop | Rule |
|---|---|
| `label` | ≤ 22 chars; the plain-language name for the seller surface |
| `value` | Pre-formatted per §9.2 of the schema; `—` when null, never `0` |
| `delta` | Requires `previous` or `target`; a bare value without a comparison is a defect |
| `polarity` | From `domain.delta.polarity`; determines good/bad colouring |
| `sparkline` | Only when a series exists; omitted for single-point data |
| `freshness` | Conditional; per-module threshold |
| States | loading (skeleton: label bar + value block + delta bar) · error (retry affordance inside the card) · no-data (`—` + "No data for this period") |
| Tap | Opens INT-HM-10 metric drilldown / the corresponding report |
| A11y | One announcement: `"{label}, {value}, {delta} versus {basis}"`; sparkline is decorative and excluded from the tree |
| Sizing | min-height 104 dp; 2-up compact, 3-up medium, 4-up expanded; collapses to 1-up at font scale ≥ 1.6 |

### 4.2 `MetricDelta`

Renders direction and goodness independently — the rule that prevents a rising ACoS from
being painted green.

| Input | Direction icon | Colour |
|---|---|---|
| `polarity: up-is-good`, change `+12.4 %` | ▲ | good |
| `polarity: down-is-good`, change `+12.4 %` | ▲ | **bad** |
| `polarity: neutral`, any change | ▲/▼ | neutral |
| `abs(change) < flatThresholdPct` | → | flat |

Always includes the comparison basis (`vs prev 30d`, `vs target`, `vs LY`).

### 4.3 `SlaPill`

| State | Colour | Icon | Text |
|---|---|---|---|
| On track | success | clock | `4 d 2 h left` |
| Due soon (≤ 24 h) | warning | clock-alert | `18 h left` |
| At risk (≤ 12 h) | warning | clock-alert | `6 h left` |
| Breached | danger | alert | `Overdue by 2 h` |
| Paused | neutral | pause | `Paused` |
| Done | success | checkmark | `Done` |

Rules: computes from `TaskSlaPolicies` (SLA hours, warning hours, business-hours-only,
exclude weekends) so the client never invents its own SLA maths; re-evaluates on resume
and on socket updates; the seller surface overrides the label ("Overdue", "Due soon") but
never the underlying threshold.

### 4.4 `AsinCard`

Two densities.

```
Card:                                    Compact row:
┌──────────────────────────────────┐    ┌────────────────────────────────┐
│ B0XXXXXXXXXX          🔴 −22%    │    │ B0XXXXXXXX  142↓  ₹4,499↓ ★4.3 │
│ Nike Air Zoom Pegasus 40         │    └────────────────────────────────┘
│ Amazon · Seller A · FBA          │     44 dp, 3 columns, tabular
│ BSR 142 ▼   ₹4,499 ▼   ★4.3 (1.2K)│     figures, delta as ▲▼ glyph only
└──────────────────────────────────┘
```

| Rule | Detail |
|---|---|
| Identifier | ASIN in monospace, middle-ellipsis (`B0XXXX…XXX`) |
| Title | 2 lines max, end-ellipsis |
| Metrics | BSR, price, rating — each with an inline delta glyph; fixed column order so rows scan vertically |
| Status chip | Only when an unresolved alert exists; tapping the card opens detail, tapping the chip opens the alert |
| Selection | Long-press → selected state with 2 dp primary border + check overlay on the leading edge |
| A11y | `"{title}, {asin}, BSR {x}, price {y}, rating {z}"`; delta glyphs get a word (`down`) |

### 4.5 `ScopeIndicator` & `SellerSwitcher`

`ScopeIndicator` is **mandatory on every screen showing seller data**:

| Scope | Rendering |
|---|---|
| `self` | Seller name as a non-interactive label in the app bar subtitle |
| `assigned` (1 seller) | Seller name + tap-to-switch affordance (only if > 1 assigned) |
| `assigned` (n sellers) | `Seller A` + tap opens the switcher (assigned sellers only) |
| `global` | `All sellers` chip, tinted, tap opens the switcher with an `All sellers` option pinned at the top |

`SellerSwitcher` is a bottom sheet: search, recent sellers, marketplace and status chips,
and (for `global` scope) an `All sellers` row. Changing scope **resets the navigation
stack** for the current tab and updates every cached query key — a scope change while a
detail screen is open must never leave stale cross-seller data on screen.

### 4.6 `FreshnessChip`

Driven entirely by `domain.freshness.thresholds`. Renders nothing when fresh.
Tap always opens the sync-detail sheet: last success, last attempt, next scheduled run,
and a `Refresh now` action when permitted.

### 4.7 `PermissionGate`

```tsx
<PermissionGate anyOf={['asinmanager_manage']} fallback={<ReadOnlyNotice/>}>
  <BulkEditAction />
</PermissionGate>
```

- Consumes `permissions[]` from the session store only.
- Never fetches its own permissions (a second source of truth is a bug factory).
- `fallback` defaults to **rendering nothing** — silently absent beats a disabled control
  the user cannot explain. Disabled-with-explanation is reserved for controls whose
  existence is itself informative (e.g. an approve button someone else must use).
- A permission refresh re-renders every gate reactively; no manual navigation reset.

### 4.8 `EmptyState` / `ErrorState`

`EmptyState` requires: illustration, one-line headline, one-line explanation, and up to
one action. Two distinct copies exist per list — **true empty** and **filtered empty** —
and they are never interchangeable.

`ErrorState` requires: what happened, what the user can do, and (for 5xx) the request ID
with a copy-to-clipboard action.

### 4.9 `FilterSheet`

Standard contents for every list: search field, saved views, facet groups (seller,
marketplace, status, date range, numeric ranges), `Reset`, and a sticky `Show N results`
button that reflects the live count. Active filters render as chips above the list; chips
are removable; "Clear all" appears at 3+ chips.

### 4.10 `ReportViewer`

Owns the range picker, `chart / table / sheet` mode switch, summary sentences, legend, and
the export action. Charts must ship with a table alternative (§15 of the schema) — the
component enforces this: `mode` is always available, and `chart` mode renders a
`View as table` control.

### 4.11 `ChatThread`

Owns message rendering (text/image/file/poll/system), day separators, receipts, pinned bar,
scroll-to-latest, optimistic send with `Pending`/`Failed` states, and offline queueing.
Composer, reactions, and message actions are permission- and direction-aware (edit/delete
only on own messages unless the user is an admin).

### 4.12 `SelectionBar`

Contextual app bar shown in selection mode: leading close `×`, `n selected`, contextual
count, and up to three actions plus overflow. System back exits selection mode before it
pops the screen.

### 4.13 Supporting components

| Component | Purpose |
|---|---|
| `SyncStatusPill` | Per-module sync state on dashboards and lists |
| `AiInsightCard` | Ads AI review, report summaries; always labelled "AI-generated · verify" |
| `Sparkline` | 32 dp trend, no axes, decorative for a11y |
| `MetricChart` | Area/line/bar with legend, table alternative, and empty/loading states |
| `TimelineRow` | Task/report activity history; actor avatar, action, relative time |
| `AttachmentTile` | File icon, name (middle-ellipsis), size, upload progress, retry |
| `CodeChip` | Copyable identifiers (ASIN, SKU, task ID, request ID) with a copy affordance |
| `AvatarStack` | Assignees/watchers; `+3` overflow; tap opens the people sheet |
| `RefreshStrip` | "Updated Nm ago · Refresh" used by the web rulesets page, retained for continuity |
| `ReadOnlyNotice` | Inline explanation where an action is unavailable due to permissions or scope |

---

## 5. Iconography

**Decision required (schema §16, P-10).** The repo currently carries a Fluent icon layer
(`mobile/src/icons/fluent-icons.ts`, `FluentIcon.tsx`) alongside `@expo/vector-icons`.
Material 3 apps expect **Material Symbols**.

| Option | Pros | Cons |
|---|---|---|
| **Material Symbols (recommended)** | Native M3 language; variable weight/fill matches selection and active states; huge coverage for domain entities | Replaces existing icon work |
| Keep Fluent | No rework | Two icon languages once M3 components land; no filled/outlined active-state pair |
| Hybrid | Quick | Worst outcome: inconsistent stroke weights and metaphor drift |

Regardless of choice: 24 dp default grid, 20 dp inline, 18 dp in buttons, 14–16 dp in
`StatusChip`; optical alignment over mathematical; every icon-only control carries a label.

---

## 6. Component states checklist

Every interactive component must define these before it is considered done:

| State | Required rendering |
|---|---|
| Enabled | Default |
| Hovered / focused | Android: focus + pressed ripple; visible focus ring at 3:1 |
| Pressed | Ripple or tonal overlay |
| Selected | Checked/active with `aria-selected` equivalent + 2 dp indicator + filled icon |
| Disabled | 38 % opacity, no ripple, **excluded** from the accessibility tree |
| Loading | Geometry preserved; inline indicator; content dimmed, never removed |
| Error | Danger outline + icon + text, announced |
| Skeleton | Layout-accurate placeholder |
| Empty | Per `EmptyState` |
| Read-only | Rendered but non-interactive, with a reason when the reason is not obvious |
| High font scale | Reflows; no truncation of critical values |
| Dark theme | Uses the `dark` token values; no hard-coded surfaces |

---

## 7. Component governance

1. **No screen-local components.** If a screen needs something new, it is added here first.
   A component used once is still a component — that is how the second use becomes free.
2. **Tokens only.** A PR containing a hex value, a raw dp for spacing, or a duration literal
   in screen code is rejected.
3. **Every component ships with its states.** A component submitted without loading, empty,
   error, and dark renderings is incomplete.
4. **Every component ships with a11y annotations** — role, label pattern, focus behaviour.
5. **Every component ships with a contrast check.** New colour pairs are added to
   `tools/contrast-audit.mjs`; the audit must stay green (currently 52/52).
6. **Versioning.** Breaking visual changes to `KpiCard`, `AsinCard`, `TaskCard`, `SlaPill`,
   `StatusChip`, and the navigation shell require a design review, because they change
   every screen at once.
7. **Figma ↔ code parity.** Figma component names must match the code names in this
   document exactly. A mismatch is a bug in the handoff, not a naming preference.
