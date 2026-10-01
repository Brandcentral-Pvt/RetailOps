# Automation Rules — index page component inventory

Scope: the Automation Rules list page (`/rule-sets`) as delivered on
`feat/rule-sets-index-redesign`. This is the code-level substitute for the
requested Figma component library: every region below is a real, rendered
element with a stable class or accessible name, so it can be handed to a
designer as a spec and diffed against the implementation.

Related documents:

- `docs/design/rulesets-tokens.json` — every token the page consumes.
- `docs/design/rulesets-a11y.md` — keyboard map and accessibility contracts.

## Page frame

| Region | Selector / accessible name | Notes |
| --- | --- | --- |
| Page root | `.rulesets-page` | Owns the token bridge, density, and page padding. |
| Skip link | `a` → "Skip to rules table" | Off-screen until focused, then visible; jumps to the table/card region. |
| Page header | `.rulesets-head` | H1 "Automation Rules", subtitle, environment tag, primary CTA. |
| Environment tag | `.rulesets-envtag` | Always rendered. Reads `Development` when `import.meta.env.MODE !== 'production'`, otherwise `Production`. |
| Primary CTA | button → "Create Rule" | Navigates to `/rule-sets/new`. Shortcut `c`. |

## KPI strip

Four `StatCard`s rendered as toggle buttons. They are filters, not links.

| Card | Label | Filters to |
| --- | --- | --- |
| Total | "Total rules" | no filter (clears status) |
| Active | "Active" | `isActive === true` |
| Auto-run | "Auto-run" | `isAutomated === true` |
| Paused | "Paused" | `isActive === false` |

- Selector: `.rulesets-kpi`, inner `.rulesets-kpi__card`.
- Each card exposes `aria-pressed` reflecting whether it is the active filter.
- Values are counts of the **whole** set, not the current page.
- Count-up animation is deliberately **not** implemented; the count is rendered
  immediately so screen readers and tests read a stable value.

## Filter toolbar (sticky)

`.rulesets-filters`, sticks below the top bar (`--bc-topbar-height`).

- Search input, labelled "Search rules", debounced 300 ms via `useDebounce`.
  Matches name, description, and owner. Shortcut `/` focuses it.
- Selects: status, auto-run, schedule, type, owner, updated.
- "Reset" clears every filter and returns to page 1.
- Toolbar also hosts the "Updated Nm ago • Refresh" strip and the bulk bar.

## Active filter chips

`.rulesets-chips` — one removable `FilterChip` per active filter, each with a
remove button labelled "Remove <filter>". A trailing "Reset all" clears them.

## Saved views and column management

| Control | Persistence key | Behaviour |
| --- | --- | --- |
| Saved views | `rulesets-saved-views` | Create / apply / delete named views capturing filters, column set, and density. Stored in `localStorage`. |
| Column picker | (in-memory) | Toggle non-structural columns. `Name` and `Actions` are pinned and cannot be hidden. |
| Density cycle | `rulesets-table-density` | compact → comfortable → roomy → compact. |
| Column persistence | `rulesets-visible-columns` | Survives reload; stale keys are dropped. |
| Page size | (in-memory) | 10 / 20 / 50 / 100, wired to antd `onShowSizeChange(current, size)`. |

## Table

`.rulesets-tablewrap` inside an antd `Table` with server-pagination disabled —
sorting, filtering, and paging all run client-side against the full set.

- Sticky header, sticky first column (`.rulesets-cell-name`) and sticky last
  column (`.rulesets-cell-actions`), both opaque so rows do not scroll through.
- Sortable columns: name, schedule, owner, status, last run, updated.
- Cell helpers: `TypeBadge`, `FrequencyBadge`, `StatusChip`, `MatchedCount`.
- Row selection checkbox per row, labelled "Select <rule name>".
- Per-row actions: Run now, Duplicate, Delete, Activity & Logs.
- The rule name is a keyboard-operable link to `/rule-sets/:id`.

## Cards (below 768 px)

The table is replaced by `.rulesets-cards`, a two-line card per rule:

1. name + status chip,
2. schedule / owner / last-run meta line.

Bulk selection, actions, and keyboard operation are preserved.

## Empty, error, and loading states

| State | Trigger | Content |
| --- | --- | --- |
| Skeleton | first load / refresh | `StatCardSkeleton` × 4 and `TableSkeleton`. |
| First run, no rules | `data.length === 0` | "No rules yet" + **Create Rule** + five starter-template cards + a link to Activity & Logs. |
| No search match | search non-empty | "No rules match '<query>'" + "Clear search". |
| No filter match | filters active | "No <status> rules" + "Reset filters". |
| Load error | request failed | Inline error alert + "Retry". |

Starter templates open `/rule-sets/new?template=<key>` and prefill the builder.

## Activity & Logs drawer

`.rulesets-drawer`, antd `Drawer`, opened from a row or the empty state.

- Heading names the rule ("Activity & Logs — <name>").
- Entries distinguish success from failure; failures show the error detail from
  the execution log. `Success` is never rendered for a failed run.
- "Export CSV" downloads the entries shown in the drawer.

## Keyboard shortcuts

`/` search · `r` refresh · `c` create. Full map in
`docs/design/rulesets-a11y.md`.

## Not in this increment

Deliberately omitted because the backend does not return the data; no empty or
fabricated column ships:

- Tags (no `tags` field on the ruleset model).
- Next run / next execution time (no `nextRunAt`).
- Error status and last-run **result** (`lastRunSummary` carries counts and
  duration only, no error or outcome field).
- Server-side sorting, filtering, and paging (the list endpoint ignores
  `page` / `limit`; scheduled for the backend PR).
- Role-specific action visibility beyond the existing `rules_view` /
  `rules_manage` route permissions.
- Rule builder wizard, versioning, and test-run (scheduled for the builder PR).
