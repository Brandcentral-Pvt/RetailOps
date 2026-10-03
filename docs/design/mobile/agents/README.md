# Agents — RetailOps Android design generation

How AI agents produce the 140 screens of the RetailOps Android app consistently, and how
their output is verified before it is accepted.

**Start here:** [`00-agent-system.md`](./00-agent-system.md).

---

## Read in this order

| # | File | What it is | Read when |
|---|---|---|---|
| **00** | [`00-agent-system.md`](./00-agent-system.md) | The system: agent roles, pipeline, gates, state machine, failure modes, escalation | **First — before generating anything** |
| **01** | [`01-master-system-prompt.md`](./01-master-system-prompt.md) | The paste-ready system prompt for the design agent | When starting a generation session |
| **02** | [`02-consistency-contract.md`](./02-consistency-contract.md) | 48 numbered invariants with severities, mapped to the validator | When a screen fails, or when adding a rule |
| **03** | [`03-prompt-template.md`](./03-prompt-template.md) | The exact prompt anatomy, standard blocks, and a worked example | When authoring a new prompt |
| **04** | [`04-role-definitions.md`](./04-role-definitions.md) | App roles, surface registers, scope modes, permission gates, known gaps | When a screen's roles or permissions are unclear |

### Generated artifacts — do not edit by hand

| Path | Contents |
|---|---|
| `registry/roles.json` | Authoritative role context — **input**, hand-maintained |
| `registry/screens.json` | 140 screens joined from the inventory + prompts |
| `reports/registry-report.md` | Coverage and consistency findings |
| `state/progress.json` | Per-screen generation state, seeded from the registry |

### Tools

| Command | Purpose |
|---|---|
| `node agents/tools/build-registry.mjs` | Compile the registry from inventory + prompts |
| `node agents/tools/build-registry.mjs --write-prompts` | Also stamp the role block into all 141 prompts |
| `node agents/tools/build-registry.mjs --check` | CI gate: fail on drift |
| `node agents/tools/validate-screen.mjs --file <path>` | Audit a prompt or a generated screen |
| `node tools/contrast-audit.mjs` | Re-run the WCAG AA colour audit |

---

## The one-minute version

1. **Every prompt carries its role.** The `Role:` line is generated from
   `registry/screens.json` — never hand-written — and states the surface, the audience, the
   data scope, the permission gate, and the required states.
2. **One contract governs everything.** 48 rules (`C-01`…`C-48`) covering surface identity,
   colour, navigation, language, accessibility and permission safety.
3. **A machine checks it.** `validate-screen.mjs` audits both prompts and generated screens
   and exits non-zero on any blocker.
4. **One agent accepts.** The `ConsistencyAuditor` — not the designer, and not the generator.
5. **Nothing drifts.** `build-registry.mjs --check` fails CI when the registry, the prompts
   and the inventory disagree.

---

## Current status

```
141 prompts          · 0 blockers · 0 majors · 0 minors
140 screens          · 94 internal · 26 seller · 18 both · 12 critical
registry             · 0 errors · 0 warnings · no drift
contrast audit       · 52/52 pairs pass
```

Verify all of it:

```bash
cd docs/design/mobile
node agents/tools/build-registry.mjs --check
for f in 0[89]-*.md 1[01]-*.md; do node agents/tools/validate-screen.mjs --file "$f"; done
node tools/contrast-audit.mjs
```

---

## What this system deliberately does not do

- **It does not design user flows.** It designs one screen at a time; the flow lives in
  `01-design-schema.md` §6.
- **It does not invent permissions.** Where the backend lacks them (the seller surface
  entirely), the system escalates rather than designing around the gap.
- **It does not produce implementation code.** Stitch output is a visual spec; the app is
  Expo React Native with React Native Paper.
- **It does not replace review.** Majors still need a human; the contract only guarantees
  that nothing *broken* reaches the reviewer.
