# Consistency Contract

**Document ID:** `RO-MOB-AG-002` · **Version:** 1.0.0
**Applies to:** every prompt in files `08`–`11`, and every screen generated from them.

Each rule has an ID, a severity, and — where a machine can check it — the validator that
enforces it. **Blockers fail the screen.** Majors require human review. Minors are batched
into a polish pass.

Enforced by `tools/validate-screen.mjs`. Run it after every generation.

---

## 1. Identity and structure (C-01 … C-09)

| ID | Rule | Severity | Checked by |
|---|---|---|---|
| **C-01** | Every prompt begins with a `Role:` line naming the surface, the audience and the data scope. | Blocker | `validatePrompt` |
| **C-02** | Every prompt declares either `Required states:` or an explicit `Kind:` — a screen with neither is unspecified. | Major | `validatePrompt` |
| **C-03** | Every prompt states the platform: "Android Material 3". | Major | `validatePrompt` |
| **C-04** | Every prompt designs exactly one screen ("Design a single … screen"). | Major | `validatePrompt` |
| **C-05** | The prompt names all five navigation items for its surface. | Major | `validatePrompt` |
| **C-06** | The prompt must not describe the *other* surface's exclusive navigation items. `Home` and `More` exist on both surfaces and are therefore never evidence of leakage. | Blocker | `validatePrompt` |
| **C-07** | The seller surface never mentions an "All sellers" control except to forbid it. | Blocker | `validatePrompt` |
| **C-08** | Every prompt closes with the standard negative constraints (`no gradients`, no heavy shadows, no FAB over the nav bar). | Minor | `validatePrompt` |
| **C-09** | Screens that *are* a state (`SYS-*`) carry `kind: state screen` and are not asked for state variants. | Blocker | `build-registry` |

## 2. Colour and surface (C-10 … C-14)

| ID | Rule | Severity | Checked by |
|---|---|---|---|
| **C-10** | No gradients anywhere — no `linear-gradient`, `radial-gradient`, `conic-gradient`. | Blocker | `validateArtifact` |
| **C-11** | No glassmorphism — no `backdrop-filter`, no `blur()`. | Blocker | `validateArtifact` |
| **C-12** | Every colour is a value present in `02-design-tokens.json`. Off-palette colours are a blocker in `--strict` mode, otherwise a major with the offending values listed. | Major / Blocker | `validateArtifact` |
| **C-13** | Money uses Indian digit grouping: `₹1,24,802`, never `₹124,802`. | Blocker | `validateArtifact` |
| **C-14** | No foreign currency in an INR product — no `$`, no `USD`. | Major | `validateArtifact` |

## 3. Shape, type and elevation (C-15 … C-18)

| ID | Rule | Severity | Checked by |
|---|---|---|---|
| **C-15** | Radii come from the scale: 0 / 4 / 8 / 12 / 16 / 28 / full. Cards 12dp, chips 8dp, sheets 28dp. | Minor | `validateArtifact` |
| **C-16** | Cards are flat with a hairline border. Shadows are reserved for the nav bar, bottom sheets, dialogs and the FAB. | Minor | `validateArtifact` |
| **C-17** | No type below 12sp. Body 14sp, screen title 22sp, KPI value 28sp. | Major | `validateArtifact` |
| **C-18** | Roboto (or the system sans stack) only. | Minor | `validateArtifact` |

## 4. Navigation (C-19 … C-22)

| ID | Rule | Severity | Checked by |
|---|---|---|---|
| **C-19** | The navigation bar has exactly five items, drawn from the surface list. | Major | `validateArtifact` |
| **C-20** | The seller surface contains no internal vocabulary (PEMS, task instance, SLA, ruleset, scraper, sync job, ASIN Manager, Ads Intelligence). | Blocker | `validateArtifact` |
| **C-21** | The seller surface has no seller switcher and no "All sellers" control. | Blocker | `validateArtifact` |
| **C-22** | The seller surface uses the teal accent; internal blue must not appear as the primary. | Major | `validateArtifact` |

## 5. Content and data (C-23 … C-30)

| ID | Rule | Severity | Checked by |
|---|---|---|---|
| **C-23** | A danger colour never appears without a status word nearby. Colour is not the only carrier of meaning. | Minor | `validateArtifact` |
| **C-24** | Every metric carries a reference — a delta, a target, or a trend. No bare numbers. | Major | Human |
| **C-25** | Placeholder data is realistic: ASINs formatted `B0XXXXXXXXXX` in monospace, real-looking Indian seller and person names, plausible rupee amounts. | Minor | Human |
| **C-26** | Timestamps are relative under 24 h ("4 min ago") and absolute beyond ("12 Sep, 16:40"), in Asia/Kolkata. | Minor | Human |
| **C-27** | Empty states explain what will appear and offer exactly one action. Filtered-empty is never the same screen as true-empty. | Major | Human |
| **C-28** | Error states say what happened, what to do, and — for 5xx — show the request ID. | Major | Human |
| **C-29** | Exactly one filled primary button per screen. | Minor | Human |
| **C-30** | Scope is visible wherever seller data is shown: a seller name for scoped views, an "All sellers" chip for aggregated views. | Major | Human |

## 6. Seller-surface language (C-31)

| ID | Rule | Severity | Checked by |
|---|---|---|---|
| **C-31** | The seller surface uses the merchant glossary. Internal term → seller term: PEMS→Requests · task instance→request · SLA→due date · SLA breach→overdue · ASIN Manager→My Products · ruleset→automation · scraper/sync job→data refresh · Ads Intelligence→Advertising · ACoS→cost of advertising · ROAS→return on ad spend · BSR→sales rank · Parent ASIN→product family. | Blocker | `validateArtifact` (C-20) + human |

The glossary is defined once in `registry/roles.json` → `glossary.forbidden`. Change it
there, never in a prompt.

## 7. Accessibility (C-32 … C-38)

| ID | Rule | Severity | Checked by |
|---|---|---|---|
| **C-32** | Contrast meets WCAG 2.2 AA: body ≥ 4.5:1, large text ≥ 3:1, UI components ≥ 3:1. | Blocker | `tools/contrast-audit.mjs` (52/52 passing) |
| **C-33** | Touch targets ≥ 48 × 48 dp with ≥ 8 dp spacing. | Major | Human |
| **C-34** | Icon-only controls are labelled for TalkBack. | Major | Human |
| **C-35** | Charts expose a table alternative ("View as table"). | Major | Human |
| **C-36** | Layout survives 200 % font scale: KPI grids reflow to one column rather than truncating. | Major | Human |
| **C-37** | Focus order is logical, and a visible focus indicator is present. | Minor | Human |
| **C-38** | Reduced motion is honoured: no shimmer, no shared-axis, no stagger. | Minor | Human |

## 8. Permission and scope (C-39 … C-44)

| ID | Rule | Severity | Checked by |
|---|---|---|---|
| **C-39** | No screen checks a role *name*. Visibility derives from permissions. | Blocker | Human (code review) |
| **C-40** | A control the user cannot use is not drawn, rather than drawn disabled — unless the control's existence is itself informative. | Major | Human |
| **C-41** | A destination the user lacks permission for is absent from navigation; a deep link to it renders `SYS-01`, never a blank screen. | Blocker | Human |
| **C-42** | Admin-only affordances never appear on a role screen that lacks the permission — notably Brand Manager screens, which today hold neither `dashboard_view` nor `chat_view`. | Blocker | Human |
| **C-43** | Seller-surface screens are designed for `scope: self` only. No cross-seller affordance of any kind. | Blocker | Human |
| **C-44** | A screen's role block must match `registry/screens.json` byte-for-byte. | Blocker | `build-registry --check` |

## 9. Process (C-45 … C-48)

| ID | Rule | Severity | Checked by |
|---|---|---|---|
| **C-45** | Every screen is named `<ID> <Name>` in Stitch and Figma. | Major | Human |
| **C-46** | Every accepted screen has a `progress.json` record with its audit result. | Minor | Human |
| **C-47** | A new colour, radius, size or term is added to the token file or `roles.json` **before** it is used in a screen. | Blocker | `build-registry --check` |
| **C-48** | Prompt files are regenerated with `--write-prompts` after any registry change; CI runs `--check`. | Blocker | `build-registry --check` |

---

## Severity definitions

| Severity | Meaning | Effect |
|---|---|---|
| **Blocker** | Breaks a product invariant — surface identity, scope safety, accessibility floor, or a data-correctness rule a user would act on | Fails the screen; must be repaired before acceptance |
| **Major** | Visible inconsistency a user or reviewer would notice — missing nav items, off-palette colour, missing states | Human review before acceptance |
| **Minor** | Polish that does not change meaning — an off-scale radius, a stray shadow | Batched into a polish pass |

## Current status

```
141 prompts · 0 blockers · 0 majors · 0 minors
registry: 140 screens · 0 errors · 0 warnings · no drift
contrast: 52/52 pairs pass
```

Re-verify at any time:

```bash
cd docs/design/mobile
for f in 0[89]-*.md 1[01]-*.md; do
  node agents/tools/validate-screen.mjs --file "$f"
done
node agents/tools/build-registry.mjs --check
node tools/contrast-audit.mjs
```
