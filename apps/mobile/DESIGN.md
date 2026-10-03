# DESIGN.md — the design system this app implements

This file exists for Stitch and for any agent picking up the work cold. It is a
pointer, not a copy: the design system is versioned in
[`docs/design/mobile/`](../../docs/design/mobile/README.md) and this app is
generated from it. Nothing here may contradict that folder.

---

## What to read, in order

| # | Document | Why you need it |
|---|---|---|
| 1 | [`01-design-schema.md`](../../docs/design/mobile/01-design-schema.md) | The contract. Audiences, the three-axis access model, navigation shell, the nine states, delivery phases. |
| 2 | [`02-design-tokens.json`](../../docs/design/mobile/02-design-tokens.json) | Every colour, size, radius, duration. This is what `src/theme/tokens.generated.ts` compiles. |
| 3 | [`03-screen-inventory.md`](../../docs/design/mobile/03-screen-inventory.md) | The 140 screens with IDs, roles, permissions, scopes, required states. |
| 4 | [`04-component-library.md`](../../docs/design/mobile/04-component-library.md) | Component contract and governance. |
| 5 | [`05-role-ui-matrix.md`](../../docs/design/mobile/05-role-ui-matrix.md) | Module × role, and the blocker report on current permission sets. |
| 6 | [`07-stitch-setup-and-workflow.md`](../../docs/design/mobile/07-stitch-setup-and-workflow.md) | How to generate and hand off a screen. |
| 7 | [`agents/00-agent-system.md`](../../docs/design/mobile/agents/00-agent-system.md) | The agent roles, the 48-rule contract, the validator. |

## Screens and prompts

`08`–`11` hold **141 ready-to-paste Stitch prompts** (140 screens + one
navigation shell, `X-01`). Each prompt opens with a machine-generated role
block: surface, audience, scope, permission and required states. The block is
compiled from the inventory, so a prompt cannot describe a screen the inventory
does not have.

## The invariants, restated for this app

- **One app, two surfaces.** Same tokens, same components, same shell.
- **Visibility is a formula**, never an if-statement on a role name.
- **The registry is the product.** Navigation is a filtered list, not a menu.
- **Freshness is part of the data.** Batch-synced data shows its age.
- **Register is enforced.** Internal shorthand is allowed; seller screens use
  plain merchant language and never expose internal machinery.
- **Status is colour + icon + word.** Never colour alone.

## Verifying a change

```bash
node docs/design/mobile/tools/contrast-audit.mjs            # 52/52 must pass
node docs/design/mobile/agents/tools/build-registry.mjs --check
node docs/design/mobile/agents/tools/validate-screen.mjs --file <prompt.md>
cd apps/mobile && npm run check && npm run lint:contract
```
