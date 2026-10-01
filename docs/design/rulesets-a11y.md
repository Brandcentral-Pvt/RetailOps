# Automation Rules — accessibility and keyboard map

Covers the index page (`/rule-sets`) on `feat/rule-sets-index-redesign`.
Companion documents: `docs/design/rulesets-components.md`,
`docs/design/rulesets-tokens.json`.

## Keyboard shortcuts

Listener: `window` `keydown` in `src/pages/RuleSetsPage.jsx`.

| Key | Action | Guard |
| --- | --- | --- |
| `/` | Focus the "Search rules" input | Ignored while typing in a field |
| `r` / `R` | Refresh the rule list | Ignored while typing, and while a modal or drawer is open |
| `c` / `C` | Go to `/rule-sets/new` | Ignored while typing, and while a modal or drawer is open |

Guards, in order:

1. Any of `Meta` / `Ctrl` / `Alt` held → ignored entirely, so browser and OS
   shortcuts are never stolen.
2. Target is an `INPUT`, `TEXTAREA`, or `contenteditable` → `/` is ignored;
   `r` and `c` are ignored because the handler returns before reaching them.
3. Delete confirmation, bulk-delete confirmation, the Activity & Logs drawer,
   or the save-view modal open → `r` and `c` are ignored, so keys are not
   captured while a dialog owns the screen.

Note that `/` is deliberately checked *before* the typing guard so it still
works from a non-input context, while `r` and `c` are checked after it.

## Focus management

- **Skip link** — `a.rulesets-skip`, first tabbable element inside
  `.rulesets-page`, text "Skip to rules table", `href="#rulesets-content"`.
  It is positioned off-screen and becomes visible on focus; it is not
  `display: none`, so it remains in the tab order.
- **Skip target** — `.rulesets-content` carries `id="rulesets-content"` and
  `tabIndex={-1}`, so the jump moves focus to the content region rather than
  only scrolling to it.
- The application shell owns the tab stops that come before the skip link
  (sidebar, top bar). The skip link is the first stop *within the page*, which
  is the contract the regression test asserts.
- Visible focus rings come from the global `*:focus-visible` outline in
  `src/styles/tokens.css` (`2px solid var(--bc-primary-500)`, 2px offset) plus
  `--bc-shadow-md` on rows.

## Semantics and names

| Element | Contract |
| --- | --- |
| KPI cards | Real `<button>` with `aria-pressed` reflecting the active filter. Not links. |
| Row checkboxes | `aria-label="Select <rule name>"` via `getCheckboxProps`. |
| Rule name | A real `<button>` that navigates, so it is focusable and activates with Enter/Space. |
| Name column | "Rule Name"; filters labelled "Filter by status / auto-run / schedule / type / owner / updated". |
| Search | `aria-label="Search rules"`. |
| Toolbar groups | `aria-label` on each group: "Saved views", "Column visibility", "Bulk actions", "Active filters", "Filter rules by summary". |
| Refresh | Two distinct names: "Refresh rule list" (toolbar) and "Refresh now" (timestamp strip). |
| Icons | Decorative glyphs are `aria-hidden="true"`; every icon-only control also carries a text `aria-label`. |
| Loading | `role="status"` + `aria-live="polite"` announces the loading state. |
| Rule name cell | `aria-label="Active view"` marks the row activator. |

Structural columns `Name` and `Actions` are always present and cannot be
removed from the column picker, so keyboard order through the row is stable
regardless of personalisation.

## Announcements

- Loading state: `role="status"`, `aria-live="polite"`.
- Optimistic toggles and bulk actions roll back on failure and surface an
  `Alert`; antd `Alert` renders with `role="alert"` for the error case.
- Success feedback uses antd `message`, which is announced via its own live
  region.

## Motion

`@media (prefers-reduced-motion: reduce)` in `src/styles/tokens.css` clamps
animation and transition duration to `0.01ms` and disables smooth scrolling
globally. The page adds no animation that ignores this; the count-up animation
requested in the brief was dropped, so nothing depends on motion to be legible.

## Responsive behaviour

Breakpoints: 1440 / 1280 / 1024 / 768 / 480 px. Columns are progressively
dropped; below 768 px the table is replaced by `.rulesets-cards`, a two-line
card per rule. Selection, per-row actions, and the bulk bar are preserved in
card mode, so no functionality is lost at narrow widths.

## Regression coverage

`tests/rule-sets.spec.js` (36 tests) asserts:

- the skip link is the first tabbable element inside the page and becomes
  visible on focus;
- `/` focuses search from anywhere, and `c` creates only when focus is not in
  a text field;
- KPI cards expose `aria-pressed`;
- row checkboxes and icon-only controls have accessible names;
- every `--bc-*` token in `rulesets.css` resolves against the document root;
- cards render on a small viewport without losing actions.

## Known gaps

- The 300 ms search debounce means filtering is not instantaneous; there is no
  `aria-busy` on the table during the debounce window.
- The application shell renders the primary `<h1>`; the page contributes
  `Automation Rules` to the breadcrumb through `usePageTitle()` rather than
  rendering a second `h1`.
- `/`, `r`, and `c` are not discoverable in-product — there is no shortcuts
  help dialog or visible hint. Worth adding with the builder PR.
- Modal focus trapping and restore for the delete and save-view dialogs is
  antd's built-in behaviour and is not asserted by this suite.
