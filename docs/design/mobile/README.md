# RetailOps Android — UI/UX Design Schema

The design foundation for the RetailOps Android app: **one APK serving the internal
RetailOps team and seller clients**, with role-based navigation over a shared design system.

Start with `01-design-schema.md`. Everything else is a companion to it.

---

## Document set

| # | Document | What it settles | Read it when |
|---|---|---|---|
| **01** | [`01-design-schema.md`](./01-design-schema.md) | Audiences, the three-axis access model, information architecture, navigation shell, adaptive layout, table→phone strategy, freshness/offline model, the nine states, tokens summary, motion, theming, accessibility, prerequisites, phases | **First.** It is the contract everything else obeys |
| **02** | [`02-design-tokens.json`](./02-design-tokens.json) | Every token: M3 colour roles (light + dark), type scale, shape, elevation, spacing, component dimensions, motion, and RetailOps domain tokens (status, SLA, metric deltas, freshness, marketplace, roles, charts) | Before drawing or coding anything visual |
| **02a** | [`02a-contrast-audit.md`](./02a-contrast-audit.md) | Machine-generated WCAG check of every colour pair — **52/52 pass** | After any token change |
| **03** | [`03-screen-inventory.md`](./03-screen-inventory.md) | All **140 screens** with IDs, roles, permissions, scopes and required states, plus ten critical screens specified in detail | When scoping wireframes or writing tickets |
| **04** | [`04-component-library.md`](./04-component-library.md) | Component contract: mandatory components, M3 base defaults, domain components (KpiCard, SlaPill, MetricDelta, AsinCard, ScopeIndicator…), states, governance | When designing or building UI |
| **05** | [`05-role-ui-matrix.md`](./05-role-ui-matrix.md) | Module × role matrix, resulting navigation per persona, the **blocker report** on current permission sets, the proposed `seller_client` role, and enforcement rules | When wiring permissions or planning a role rollout |
| **06** | [`06-api-screen-mapping.md`](./06-api-screen-mapping.md) | Screen → endpoint map, request/response contracts, the realtime event contract, and 15 backend gaps with sizing | When planning backend work or starting a screen |
| **07** | [`07-stitch-setup-and-workflow.md`](./07-stitch-setup-and-workflow.md) | **Stitch operating manual:** `DESIGN.md` design system, shared shell blocks, generation order, state-variant templates, iteration playbook, per-screen QA, handoff | **Before generating any screen in Stitch** |
| **08** | [`08-stitch-prompts-auth-home-catalog.md`](./08-stitch-prompts-auth-home-catalog.md) | 38 ready-to-paste prompts: auth, internal Home, Catalog | Wave 0–2 generation |
| **09** | [`09-stitch-prompts-growth-ops.md`](./09-stitch-prompts-growth-ops.md) | 42 prompts: internal Growth, Ops | Wave 2–3 generation |
| **10** | [`10-stitch-prompts-more-system.md`](./10-stitch-prompts-more-system.md) | 35 prompts: More menu, People/Admin/Account, system states | Wave 3–4 generation |
| **11** | [`11-stitch-prompts-seller.md`](./11-stitch-prompts-seller.md) | 26 prompts: the seller surface, plus the plain-language glossary | Wave 2 onwards, separate project |
| — | [`tools/contrast-audit.mjs`](./tools/contrast-audit.mjs) | Re-runs the contrast audit. `node docs/design/mobile/tools/contrast-audit.mjs` | In CI, after token edits |

### Two entry points, depending on what you need

- **Designing in Stitch?** Start at [`07-stitch-setup-and-workflow.md`](./07-stitch-setup-and-workflow.md),
  then open the prompt file for the batch you are generating. Every prompt is written to be
  pasted as-is.
- **Implementing in the app?** Start at [`01-design-schema.md`](./01-design-schema.md), then
  [`04-component-library.md`](./04-component-library.md) and
  [`02-design-tokens.json`](./02-design-tokens.json).

**141 prompts ↔ 140 screens, one-to-one.** Every prompt is headed with its screen ID from
`03-screen-inventory.md`, and the ID is verified against the inventory, so a Stitch screen and
a spec screen can never drift apart.

---

## The five decisions that shape everything

1. **One app, two surfaces.** One shell, one component library, two destination registries.
   Two apps would double every token, component and bug fix.
2. **Visibility is a formula, not an if-statement.**
   `visibility = surface × RBAC permission × data scope`. No screen ever checks a role name.
3. **The registry is the product.** Nav bar, rail, drawer, "More", and search all read from
   one permission-filtered `Destination[]`. That is what makes role-based UI maintainable.
4. **Mobile is a decision surface, not a report archive.** Home leads with what changed and
   what needs a human; tables become cards with a compact-row escape hatch.
5. **Freshness is part of the data.** RetailOps data is batch-synced. The UI states its own
   age rather than implying real-time.

---

## Grounded in the real system

Every role, permission, module and endpoint in these documents was read from the repository,
not invented:

| Source | Used for |
|---|---|
| `backend/controllers/roleController.js` (`defaultPermissions`, `defaultRoles`, `permissionSets`) | The role × permission matrix, and the blocker report |
| `backend/middleware/auth.js` (`requirePermission`, `requireAnyPermission`, `checkSellerAccess`) | Guard semantics and scope model |
| `init-database.sql` (60 tables) + `backend/migrations/*` | Domain model, SLA policy defaults, role seeds |
| `backend/routes/**` (47 route files) + `docs/api-endpoints.md` | Screen → endpoint mapping |
| `src/styles/tokens.css` | Brand seed `#1976D2` and the primitive ramps |
| `mobile/src/theme/theme.ts`, `mobile/src/navigation/*` | The existing token and navigation starting point |

---

## Status and next steps

**Current status:** schema drafted for review. No wireframes or visual comps yet — deliberately,
because several schema decisions change the visuals (icon set, dynamic colour, seller accent).

**Before wireframes begin:**

1. Resolve the **blocker report** in `05-role-ui-matrix.md` §4 — notably G-1 (`dashboard_view`)
   and G-3 (`chat_view`), without which only admin-type roles get a working app.
2. Answer the open questions in `01-design-schema.md` §18 — especially the store/listing
   strategy for the seller audience and the icon-set decision (P-10).
3. Confirm the dependencies in `01-design-schema.md` §16 and the 15 gaps in
   `06-api-screen-mapping.md` §4 — each needs an owner.

**Suggested next deliverables**, in order: generate the 10 critical screens in Stitch using
the Wave 0 prompts in `07-stitch-setup-and-workflow.md` §5 → export to Figma and build the
component library matching `04-component-library.md` → clickable prototype for the seller
onboarding path.

---

## Generating screens in Stitch — the short version

1. Create two projects: `RetailOps Internal` and `RetailOps Seller` (Mobile + Standard mode).
2. Paste the `DESIGN.md` from doc 07 §3 into both; the seller project uses the **teal** accent.
3. Generate in waves: 3 ignition screens → 10 critical → lists → details → admin → states.
4. One screen per prompt, pasted verbatim from docs 08–11. Refine in chat; never regenerate.
5. Every 5 screens, diff the new one against `INT-HM-01` for app bar, card, chip and type drift.
6. Export each screen to Figma, named `<ID> <Name>`.
