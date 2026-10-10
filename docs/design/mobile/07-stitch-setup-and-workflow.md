# RetailOps Android — Google Stitch Prompt Pack (Setup & Workflow)

**Document ID:** `RO-MOB-DS-007` · **Version:** 1.0.0 · **Target tool:** Google Stitch (`stitch.withgoogle.com`)

Operating manual for generating all **140 screens** from `03-screen-inventory.md` in
Google Stitch, so the output looks like **one app** instead of 140 unrelated mockups.

Per-screen prompts live in the companion files. Together they hold **141 prompts** — one for
each of the 140 screens in `03-screen-inventory.md`, plus `X-01` for the "More" shell:

| File | Covers | Prompts |
|---|---|---|
| `08-stitch-prompts-auth-home-catalog.md` | Auth + internal Home + Catalog | 38 |
| `09-stitch-prompts-growth-ops.md` | Internal Growth + Ops | 42 |
| `10-stitch-prompts-more-system.md` | More menu + People/Admin/Account + system states | 35 |
| `11-stitch-prompts-seller.md` | Seller surface | 26 |

---

## 1. What Stitch is good at, and what it will not do

Set expectations before spending your generation budget (~350 Standard generations/month
on the free tier).

| Stitch **is** good at | Stitch **is not** | Consequence for this project |
|---|---|---|
| Single-screen, text-to-UI, Material-aligned layouts | Producing a coherent 140-screen app in one prompt | One screen per prompt. Always. |
| Holding a design system across screens via `DESIGN.md` | Importing a full component library or design tokens file | `DESIGN.md` (§3) is how we carry `02-design-tokens.json` into Stitch |
| Rapid layout variation and iteration | Design systems with full depth (Figma wins) | Export to Figma for component-library work (`04-component-library.md`) |
| Static high-fidelity visuals | Real states, real behaviour, real data | States are separate prompts (§6); behaviour is specified in the design schema |
| HTML/CSS + Tailwind + Figma export (Standard mode only) | Code that matches React Native / Jetpack Compose | Do not ship Stitch code. Use it as a **visual spec**, not as implementation. |
| English prompts | Gujarati/Hindi prompts | Keep prompts in English. Localisation is a v2 concern. |

**The rule that saves the most budget:** never regenerate a screen to fix one thing.
Stitch is conversational — refine in place (`§7`).

---

## 2. Setup (10 minutes, once)

1. **Create two projects** at `stitch.withgoogle.com` — the two surfaces have different
   accents and different vocabulary, and Stitch applies the project design system to every
   screen you generate in it:
   - `RetailOps Internal` — staff console
   - `RetailOps Seller` — merchant app
2. In each project select **Mobile** layout and **Standard** mode.
   *Standard mode is required — Experimental mode has no Figma export.*
3. Choose the model **Gemini 3 Pro** (best layout reasoning) and drop to Flash if you are
   burning budget on throwaway exploration.
4. **Replace `DESIGN.md`** in both projects with §3 below. For the seller project, change
   exactly two lines: `Surface accent` → teal `#0E7490`, and the brand line → `RetailOps Seller`.
5. Lock the Design System panel: primary `#1976D2`, secondary `#6D28D9`, tertiary `#0E7490`,
   font **Roboto**, card radius **12**, corner roundness **medium**. Do **not** enable
   dynamic colour — it repaints the brand and destroys status-colour semantics.

> If your Stitch version has no editable `DESIGN.md`, paste the condensed style line at the
> end of every prompt instead:
> `Style: Material 3, light theme, Roboto, primary #1976D2, cards 12dp radius, 16dp screen margins, no gradients.`

---

## 3. `DESIGN.md` — paste this into both projects

```markdown
# RetailOps — Design System

## Product
RetailOps is a B2B e-commerce operations platform for managing Amazon marketplace
accounts. This Android app has two surfaces sharing one design system:

- **Internal** (staff console): dense, tool-like, blue accent. Users act on many
  seller accounts at once.
- **Seller** (merchant app): calm, plain-language, teal accent. A seller sees only
  their own account.

Never mix the two accents within one screen.

## Colour (light theme — dark theme mirrors these roles)
- Primary: #1565C0 (buttons, selected states, links)
- On primary: #FFFFFF
- Primary container: #BBDEFB (selected chips, brand surfaces), on-container #0A3A8A
- Secondary: #6D28D9, secondary container #EDE9FE, on-container #4C1D95
- Tertiary: #0E7490, tertiary container #CFFAFE, on-container #155E75
- Surface: #FFFFFF; page background: #F5F7FB
- Surface containers: #F8FAFC (low), #F1F5F9 (base), #E9EEF4 (high)
- Text: #0F172A primary, #475569 secondary, #64748B subtle
- Outline: #64748B for interactive borders, #E2E8F0 for dividers
- Error: #B91C1C, error container #FEE2E2, on-container #7F1D1D
- Status: success #15803D on #F0FDF4 · warning #B45309 on #FFFBEB ·
  danger #B91C1C on #FEF2F2 · info #0E7490 on #ECFEFF · neutral #475569 on #F1F5F9
- Charts: #1976D2, #0E7490, #7C3AED, #16A34A, #F59E0B, #DB2777, #4F46E5, #64748B
- Never use a colour as the only carrier of meaning. Every status shows colour + icon + word.

## Typography — Roboto
- Screen title 22/28 regular · Section header 16/24 medium · Card title 14/20 medium
- Body 14/20 · Row secondary 12/16 · Chip label 12/16 medium · Badge 11/16 medium
- KPI value 28/34 medium · Inline metric 14/20 · Table metric 13/18
- Money uses tabular figures and Indian grouping: ₹12,48,300 — never ₹1,248,300
- Large values compress: ₹12.5L, ₹1.2Cr. Deltas are always signed: ▲ +12.4%
- Minimum text size 12sp. Never truncate a metric value; wrap or reflow instead.

## Spacing & shape
- 4dp grid: 4 / 8 / 12 / 16 / 20 / 24 / 32 / 40 / 48
- Screen margins 16dp · gutter between cards 12dp · gap between sections 24dp
- Card padding 16dp · list row heights 56 / 72 / 88dp
- Radius: cards 12dp · chips 8dp · bottom sheets 28dp · buttons and search bars fully rounded
- Elevation is minimal: cards are flat with a hairline border; only the nav bar,
  bottom sheets, dialogs and the FAB cast shadow

## Components
- Top app bar 64dp: optional leading scope chip, optional search icon, notification
  bell with a count badge, circular avatar on the right
- Bottom navigation 64dp, maximum 5 items, icon above label, badge on the relevant item
- Cards: white, 12dp radius, 16dp padding, 1dp #E2E8F0 border, no gradient
- KPI card: label (12sp) · large value (28sp tabular) · delta row with arrow + percentage
  + comparison basis · optional 32dp sparkline
- Chips: 32dp tall, 8dp radius; status chips are 24dp with a 14dp icon
- Buttons: 40dp tall, fully rounded; one filled primary action per screen
- Text fields: filled style, 56dp tall, persistent label above the value
- Bottom sheets for filters, sort and pickers, with a 32×4dp grab handle at the top

## Content rules
- Sentence case everywhere. No ALL CAPS labels.
- Numbers always carry a reference — a delta, a target, or a trend. Never a bare metric.
- Empty states explain what to do, in one sentence, with one action.
- Seller surface: plain merchant language only. "Sales (GMS)", "Advertising",
  "Requests", "Data refresh". Never "PESM", "scraper", "ruleset", "ASIN Manager".

## Do not
- Do not use gradients, glassmorphism, neon, or 3D/illustrative hero art
- Do not use drop shadows on cards or heavy elevation
- Do not use a floating action button overlapping the bottom navigation bar
- Do not use dark mode in the primary screen set (a dark variant is a separate pass)
- Do not invent colours, fonts, or radii outside this system
- Do not put more than 5 items in the bottom navigation bar
```

---

## 4. Shared prompt blocks

Every prompt in files `08`–`11` is written to be **pasted as-is**, and each already contains
the right shell line. These are the exact blocks they use — keep them verbatim when you
improvise extra screens, because identical phrasing is what makes the nav bar and app bar
render identically across 140 generations.

**Shell line — internal top-level screens:**
```
Top app bar: a rounded chip reading "All sellers" with a dropdown caret on the left,
a search icon, a notification bell with a badge showing 3, and a circular avatar on the right.
Bottom navigation bar with 5 items: Home, Catalog, Growth, Ops, More — show Home selected.
```

**Shell line — internal detail screens:**
```
Top app bar: a back arrow, the screen title, and an overflow menu on the right.
Keep the same bottom navigation bar as the rest of the app with the current section selected.
```

**Shell line — seller top-level screens:**
```
Top app bar: the seller name "Seller A" with a small "Seller" chip beneath it, and a
notification bell on the right. There is no seller switcher.
Bottom navigation bar with 5 items: Home, Performance, My Products, Requests, More —
show Home selected.
```

**Universal closer — append when a generation looks generic or over-decorated:**
```
Keep 16dp screen margins. Flat cards with hairline borders, no gradients, no heavy shadows,
no floating action button over the navigation bar. Use only the project design system colours.
```

---

## 5. Generation plan and budget

There are 140 screens and roughly 350 Standard generations per month. Budget ~2.3 attempts
per screen. That is enough **only** if you follow this order — generating foundations first
means later screens inherit a proven look, so they need fewer retries.

| Wave | What | Screens | Generations | Why this order |
|---|---|---|---|---|
| **0** | Ignition: `AUTH-02` Sign in, `INT-HM-01` Dashboard, `SEL-HM-01` Seller Home | 3 | ~10 | Locks light/dark, card, KPI and nav treatment. Iterate these until you are happy before spending more. |
| **1** | The rest of the 10 critical screens (`03-screen-inventory.md`) | 10 | ~25 | Establishes list, detail, chat, report and 403 patterns |
| **2** | All list and dashboard screens | ~35 | ~60 | Lists repeat one pattern; failures here inform every other list |
| **3** | All detail and form screens | ~50 | ~70 | Follows the patterns from wave 2 |
| **4** | Admin/util screens with the least design risk | ~30 | ~40 | Cheap, patterned, low stakes |
| **5** | State variants for the top 30 screens (§6) | — | ~40 | Empty, error, offline, loading |
| **6** | Polish pass and re-exports | — | ~30 | Refinement only, never regeneration |

If you must cut: **never skip wave 0 or 1.** A mediocre admin settings screen costs nothing;
an inconsistent nav bar costs the whole design's credibility.

---

## 6. State variants (do not design 140 × 9 screens)

The design schema requires nine states per screen, but you should only *draw* the states that
carry real design decisions. Use these three reusable prompts, applied to any list screen:

**Empty (true):**
```
Using the currently selected design, replace the list content with an empty state:
a simple outlined illustration area, a headline "No ASINs are tracked for this seller yet",
one line of supporting text explaining what will appear here, and a single outlined button
labelled "Import ASINs". Keep the app bar, filters and bottom navigation unchanged.
```

**Empty (filtered) — the one people get wrong:**
```
Using the currently selected design, show the filtered-empty state: the search field and
active filter chips remain, and the list area shows "No ASINs match these filters" with a
text button "Clear filters". Do not reuse the illustration from the true empty state.
```

**Error + offline:**
```
Using the currently selected design, replace the list with an error card: warning icon,
headline "Couldn't load ASINs", one line "Check your connection and try again",
a text button "Retry", and a small caption "Request ID 8f2c-41ab". Above the list, add a
slim amber banner reading "Offline — showing cached data from 2 hours ago".
```

**Loading:**
```
Using the currently selected design, replace the list with 4 skeleton cards matching the
real card layout: grey placeholder bars for the ASIN, title, and three metric values.
Keep the app bar and filters in their loaded state.
```

---

## 7. Iteration playbook (refine, don't regenerate)

Say these to the chat attached to a selected screen. One change per prompt.

| Problem | Say exactly this |
|---|---|
| Too cramped | `Increase all padding and vertical spacing by one step. Use 16dp card padding and 24dp between sections.` |
| Wrong hierarchy | `Make the KPI value the most prominent element on the card. The label should be smaller and the delta row secondary.` |
| Generic AI look | `Remove all gradients and drop shadows. Make cards flat white with a 1dp light grey border and 12dp radius.` |
| Colour drift | `Use only #1976D2 as the primary colour. Remove every other blue and any purple on this screen.` |
| Nav bar mismatch | `Bottom navigation must have exactly 5 items — Home, Catalog, Growth, Ops, More — with icons above labels and Home selected.` |
| Over-filled screen | `Remove the least important section and increase the size of the remaining content. The user should be able to read the top three elements without scrolling.` |
| Typography inconsistent | `Set the screen title to 22sp regular, section headers to 16sp medium, body to 14sp, and captions to 12sp. Use Roboto throughout.` |
| Numbers look wrong | `Format money with Indian digit grouping like ₹12,48,300 and use tabular figures so values align.` |
| Dark mode needed | `Show this same screen in dark mode: background #07111F, cards #111C30, text #F8FAFC, keep primary #90CAF9.` |

**Consistency check after every 5 generations:** put the new screen next to `INT-HM-01` and
compare the app bar, card radius, chip height, nav bar and type sizes. If any differ, fix the
new screen immediately — drift compounds and is expensive to unwind at screen 100.

---

## 8. Per-screen QA checklist

Run this on every generated screen before moving on. It is the difference between 140
mockups and a design system.

- [ ] App bar matches the shell block (scope chip / search / bell with badge / avatar)
- [ ] Bottom nav has exactly 5 items with correct labels **for that surface**, correct item selected
- [ ] Card radius 12dp, chip radius 8dp, buttons fully rounded, 16dp screen margins
- [ ] Only system colours; no gradient, no heavy shadow, no purple outside secondary
- [ ] Money uses Indian grouping; deltas are signed with an arrow
- [ ] Every status has an icon **and** a word, not just colour
- [ ] Numbers have a reference (delta, target or trend) — no bare metrics
- [ ] Labels use the correct surface language (internal jargon vs merchant words)
- [ ] No more than one filled primary button on the screen
- [ ] Nothing important sits below the fold without a reason to scroll
- [ ] Screen name in Stitch matches the screen ID (e.g. `INT-HM-01 Dashboard`) for traceability
- [ ] Exported to Figma and named with the same ID

---

## 9. Handoff

1. **Name every Stitch screen** `<ID> <Name>` — e.g. `INT-CT-01 ASIN Manager list`. Untraceable
   mockups become orphans within a week.
2. **Export to Figma** per screen (Standard mode → *Copy to Figma*). Paste into one master
   Figma file, grouped by surface and slot.
3. **Reconcile with the component library.** `04-component-library.md` defines the component
   names (`KpiCard`, `AsinCard`, `SlaPill`, `MetricDelta`, `StatusChip`, `ScopeIndicator`).
   Rename Stitch layers to match during the Figma pass. Mismatched names are a handoff bug.
4. **Do not implement from Stitch code.** It emits HTML/CSS + Tailwind; the app is Expo
   React Native with React Native Paper (`mobile/`). Use Stitch for layout and visual
   decisions, then build against `02-design-tokens.json`.
5. **Write back what changed.** If Stitch reveals a better card, spacing value or label,
   update `02-design-tokens.json` / `01-design-schema.md` in the same PR that adds the screen
   to Figma. Otherwise the schema and the mockups diverge and neither stays true.

---

## 10. Known Stitch limitations and how to work around them

| Limitation | Workaround |
|---|---|
| Cannot import a design tokens JSON | `DESIGN.md` (§3) carries the tokens in prose |
| Inconsistent results between sessions | Keep both projects' `DESIGN.md` identical except the accent line |
| Ignores detail on very long prompts | Keep prompts to one screen and ~120 words; put the extra detail in the iteration step |
| Invents plausible-but-wrong data (e.g. `$` currency, 1,248,300 grouping) | Always state currency and grouping explicitly in the prompt |
| Adds decoration (gradients, glassmorphism) by default | The universal closer in §4, plus explicit negative constraints per prompt |
| No state management | Draw states via §6 templates; document the rest in the design schema |
| Weaker at complex data tables | Rely on the card + compact-row pattern from `01-design-schema.md` §9, not on Stitch improvising a table |
| Cannot represent permissions | Show the *rendered result* of a role (e.g. a screen with no export button). Permission logic lives in the schema, not in the mockup |
