# AGENTS.md — RetailOps mobile

**Read this before writing any code in `apps/mobile/`.**

This app has one source of truth per concern, and your job is to consume it, not
to restate it. Every rule below is enforced by a script in `npm run check`. If
you find yourself working around one of them, the design system is probably
wrong — change the design system, not the rule.

---

## 1. The four sources of truth

| Concern | Source of truth | Never hand-edit |
|---|---|---|
| Colours, type, spacing, shape, motion, domain tokens | `docs/design/mobile/02-design-tokens.json` | `src/theme/tokens.generated.ts` |
| Which screens exist, their gate, their required states | `docs/design/mobile/agents/registry/screens.json` | `src/screens/**`, `src/nav/screenRegistry.generated.ts` |
| Roles, surfaces, register, scope modes | `docs/design/mobile/agents/registry/roles.json` | — |
| The rules themselves | `docs/design/mobile/agents/02-consistency-contract.md` | — |

Generated files carry a `DO NOT EDIT` banner. Editing one is reverted by the
next `npm run scaffold` / `npm run tokens`, and CI fails on the drift.

```bash
npm run tokens    # rebuild src/theme/tokens.generated.ts from the token file
npm run scaffold  # rebuild all 140 screens from the registry
```

---

## 2. The eight rules that actually bite

### R1 · No raw values. Ever.
No hex, no `padding: 16`, no `duration: 300`. Read from `useTheme()`:

```tsx
const t = useTheme();
<View style={{ backgroundColor: t.c.surfaceContainer as string, padding: t.spacing.scale.lg }} />
```

`npm run lint:contract` fails on any hex outside the generated token file.

### R2 · Visibility is a formula, not an if-statement.

```
visibility = surface × RBAC permission × data scope
```

Use `PermissionGate`, `useCan` or `usePermission`. **Never** branch on a role
name. There are exactly two legal exceptions, both annotated
`contract-allow: C-02` with their reasoning: `surfaceOf()` and `scopeFor()`.

```tsx
<PermissionGate surface="internal" permission="adsreport_manage" module="Ads">
  <EditCampaign />
</PermissionGate>
```

A role with no permission must never see a disabled tab. The tab is *absent*.

### R3 · Every screen handles all nine states.
A screen is not done until each has a rendering. `ScreenShell` already
provides states 1, 2, 5, 6, 7, 8 and the true-empty; your content must handle
the rest. The list is in each screen's generated header — that header is the
contract for that screen.

Never a bare `<ActivityIndicator/>` for content. Loading mirrors the final
layout.

### R4 · Status is colour + icon + word.
Never colour alone (WCAG 1.4.1). Use `<Chip tone="danger" />`, which reads the
icon from the token file.

### R5 · Freshness is data.
RetailOps is batch-synced. Never imply real-time. Show the age. `StaleSection`,
`OfflineBanner`, and `domain.freshness.*` exist for this.

### R6 · Register is not cosmetic.
Internal screens may say "PESM task", "SLA breach", "ruleset". Seller screens
may not — a merchant gets plain language and never internal machinery. See
`roles.json → glossary.forbidden`. A seller screen that says "ruleset" is a
blocker.

### R7 · Scope is shown, not implied.
The scope control (`ScopeIndicator`) is not a filter. `global` may offer "All
sellers"; `assigned` may not; `self` shows no switcher at all. A screen that
shows "All sellers" to an assigned-scope user is a data-scope violation.

### R8 · Money is Indian-formatted.
`₹1,23,456` — never `₹123,456`. Use `toINR()` in `src/utils/formatters.ts`.
Numbers use tabular figures so columns align.

---

## 3. Adding a screen

Never create a file under `src/screens/` by hand. The generator owns that tree.

1. Add the row to `docs/design/mobile/03-screen-inventory.md`.
2. Rebuild the registry: `node docs/design/mobile/agents/tools/build-registry.mjs --write-prompts`
3. `npm run scaffold` — the new screen, its gate and its state list appear.
4. Replace the generated `*Content` body. Keep the exported `meta` and `endpoint`.
5. Register the route in the relevant navigator.
6. `npm run check`.

If step 3 does not create the file, the row is malformed — fix the inventory.

## 4. Changing a visual value

Never widen the token file to fit one screen. Either the value already exists
(89% of the time), or the design system needs a real change: edit
`02-design-tokens.json`, re-run the contrast audit, then `npm run tokens`.

```bash
node docs/design/mobile/tools/contrast-audit.mjs   # must stay 52/52
```

## 5. Before you open a PR

```bash
npm run check          # typecheck + token sync + scaffold sync
npm run lint:contract  # consistency contract over app source
npm run doctor         # cross-file wiring + secrets + platform ids
```

All four must pass. If `doctor` complains about a screen ID, the inventory
moved — update the navigator, don't hardcode a fallback.
