# Role Definitions

**Document ID:** `RO-MOB-AG-004` · **Version:** 1.0.0
**Source of truth:** `registry/roles.json` — this document explains it; the JSON is what
agents read.

Two kinds of "role" exist in this system, and confusing them is the most common source of
bad output:

| | App role | Agent role |
|---|---|---|
| What | A RetailOps user's permission set | The job an AI agent performs |
| Defined in | `registry/roles.json` → `roles` | `00-agent-system.md` §2 |
| Purpose | Decides what a screen may show and which words it may use | Decides what the agent may change and when it must stop |
| Appears in | The `Role:` line of every prompt | The system prompt (`01-master-system-prompt.md`) |

---

## 1. App roles

Every screen prompt opens with a role block derived from this table. Agents must not
invent a role, rename one, or change its scope.

### 1.1 Internal surface

| Role key | Display | Level | Scope | Landing screen | UI note |
|---|---|---:|---|---|---|
| `admin` / `super_admin` | Admin / Super Admin | 100 | global | `INT-HM-01` | Sees everything. The reference experience. |
| `operational_manager` | Operational Manager | 90 | global | `INT-HM-01` | Everything except Users, Roles, API keys, Settings. |
| `Brand Manager` | Brand Manager | 50 | assigned | `INT-CT-01` | Assigned sellers only. Holds no dashboard, ads or chat permission today. |
| `catalog_manager` | Catalog Manager | 30 | assigned | `INT-CT-01` | Catalog and tasks; export-heavy. |
| `listing_team` | Listing Team | 25 | assigned | `INT-OP-01` | Field users; tasks are the primary job. |
| `reviewer` | Reviewer | 40 | global | `INT-OP-07` | Approval-only. No permissions seeded today. |
| `viewer` | Viewer | 10 | global | `INT-HM-01` | Read-only. No permissions seeded today. |

### 1.2 Seller surface

| Role key | Display | Level | Scope | Landing screen | Status |
|---|---|---:|---|---|---|
| `seller_client` | Seller | 20 | self | `SEL-HM-01` | **Proposed** — see `05-role-ui-matrix.md` §5 |

`seller_client` does not exist in the database yet. The seller surface cannot ship until it
does. Agents must surface this as a blocker rather than designing around it — see
`00-agent-system.md` §8.

### 1.3 Pseudo-roles

Shorthand used in `03-screen-inventory.md`, expanded by `build-registry.mjs`:

| Shorthand | Expands to | Prompt label |
|---|---|---|
| `Σ-int` | all seven internal roles | `internal RetailOps staff (role-gated at runtime)` |
| `Σ` | any signed-in user, either surface | `any signed-in user, internal or seller` |
| `both` | both surfaces | same as `Σ` |
| `—` | no role gate | `not role-restricted` |

---

## 2. Surface registers

The register decides vocabulary. It is the single most consequential difference between the
two surfaces, and rule **C-20/C-31** enforces it.

| | Internal | Seller |
|---|---|---|
| Accent | `#1565C0` | `#0E7490` |
| Nav | Home · Catalog · Growth · Ops · More | Home · Performance · My Products · Requests · More |
| Reader | A colleague who knows the system | A paying client |
| Density | Higher; tables and compact rows are fine | Lower; cards and plain sentences |
| Tone | Neutral, tool-like | Calm, reassuring |

**Allowed on internal, forbidden on seller:** PESM/PEMS, task instance, SLA, SLA breach,
ruleset, scraper, sync job, ASIN Manager, Ads Intelligence, ACoS, ROAS, TACoS, BSR,
Parent ASIN.

**The translation is not cosmetic.** "SLA breach" is a mechanism; "overdue" is what actually
happened to the client's product listing. Seller screens must always use the second.

---

## 3. Scope

| Mode | Meaning | UI consequence |
|---|---|---|
| `global` | Sees every seller | Switcher offers **All sellers** plus each seller |
| `assigned` | Sees only assigned sellers | Switcher offers assigned sellers only; no "All sellers" |
| `self` | Pinned to one seller | **No switcher anywhere.** The app bar shows the seller's name |

Rule **C-30**: scope is always visible where seller data is shown. A user must never have to
ask whose data they are looking at.

---

## 4. Permission gates

Screens declare permissions, never roles. Suffix meanings:

| Suffix | Grants |
|---|---|
| `_view` | Screen reachable, data visible |
| `_manage` / `_create` / `_edit` | Create, edit, delete controls |
| `_delete` | Delete controls, plus a typed or hold confirmation |
| `_export` | Export action; exports run as async jobs |
| `_import` | Import action and upload flow |
| `_approve` | Approve/reject controls and the approval queue |

Three permissions do not exist yet and are required by the seller surface:
`alerts_view`, `tasks_submit`, `tasks_approve` (`05-role-ui-matrix.md` §4/§5).

---

## 5. Known gaps a designer must not paper over

These are backend facts, documented in `05-role-ui-matrix.md` §4. Agents must **not** design
around them by inventing permissions.

| Gap | Effect on design |
|---|---|
| `dashboard_view` only for admin / operational_manager (G-1) | Home is empty for three internal roles. Fix the backend, not the design. |
| `chat_view` only for admin / operational_manager (G-3) | Chat is unreachable for most staff and for the seller surface. |
| `sellers_view` vs `seller_view` mismatch (G-10) | Seller Tracker routes 403 for everyone but admin. |
| `reviewer` / `viewer` hold no permissions (G-6) | Two roles can do nothing. Either seed them or delete them. |
| `seller_client` does not exist (G-2) | The entire seller surface is blocked. |

When a prompt's role block implies access the role does not hold, the agent stops and
escalates (`00-agent-system.md` §8.3). Silently granting it in a mockup is worse than
producing no mockup, because it ships a promise the product cannot keep.

---

## 6. Agent roles (summary)

Full definitions in `00-agent-system.md` §2.

| ID | Agent | One-line role |
|---|---|---|
| A0 | Orchestrator | Sequences waves, owns progress state |
| A1 | ContextAgent | Assembles one screen's context; refuses on missing data |
| A2 | PromptCompiler | Assembles the final prompt deterministically |
| A3 | ScreenDesigner | Generates one screen within the contract |
| A4 | ConsistencyAuditor | Verifies against the contract; the only agent that accepts |
| A5 | RepairAgent | Minimal fixes; never regenerates |
| A6 | HandoffAgent | Export, naming, Figma reconciliation |
| A7 | SchemaSteward | Changes tokens, contract and roles — nobody else may |
