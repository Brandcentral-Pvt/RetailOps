# OOS-RECON-001 Phase 0 change freeze notice

**Effective:** 2026-10-27<br>
**Owner:** Eng lead<br>
**Applies to:** `OOS-RECON-001`, OOS task-view code, OOS seed data and OOS provider integrations<br>
**Production state:** `OOS-RECON-001` was active with 7 instances, 188 runs, 188 orphan bindings and 44,223 decisions at the 2026-10-27 baseline. It was deactivated at `2026-10-27T01:02:06.840Z` under exception `EX-001`, before the next recurrence at `2026-10-27T08:51:23Z`. Existing data remains; `DLY-004` is unchanged. See the [production read-only snapshot](./OOS_RECON_001_PRODUCTION_READONLY_SNAPSHOT.md).<br>
**Lifts when:** G0 is signed off and the Eng lead records a written exception for the next phase.

## 1. Purpose

The audit found that the OOS view is not reachable, does not compile when
imported, and has unresolved authorization, persistence, export and resync
defects. Until the baseline and restore evidence exist, changes that alter
production data, activate the template or call live providers would create
unverifiable state.

This freeze protects the baseline. It does not block read-only diagnosis,
documentation, test-only work or code changes on the remediation branch after G0.

The production read-only check changes the starting condition: the template was
already active and contained 188 orphan bindings and 44,223 decisions. The freeze
is therefore a **containment** control. A separate written exception (`EX-001`)
authorized only the OOS template deactivation needed to stop recurrence; the
freeze still does not authorize in-place cleanup or repair. The freeze remains
in force until G0 is signed off.

## 2. Frozen actions

The following are prohibited without a written exception:

- Creating, assigning, publishing, expanding or further activating
  `OOS-RECON-001`.
- Running `backend/scripts/setup-fresh-oos-run.js` or any other OOS setup,
  backfill or bulk-run script in production.
- Reactivating the `OOS-RECON-001` recurrence or changing the retained
  `NextScheduledDate` without a new written exception. The template was
  deactivated under `EX-001` at `2026-10-27T01:02:06.840Z`; do not change the
  independent `DLY-004` schedule.
- Deleting or repairing the 188 orphan `OosTaskBindings` or the 44,223 decisions
  in place.
- Editing OOS template definitions, view definitions, bindings or seed scripts.
- Editing `DLY-004` or its template, instances, assignments or seed data.
- Running live provider or scraper calls for OOS resync or verification.
- Manually changing OOS runs, cases, exports, incidents or evidence in
  production.
- Applying migrations `035` through `039` to production.
- Deploying the remediation branch to a production environment.
- Turning on the OOS view for any user, seller, brand or task.

## 3. Allowed actions

- Read-only inspection of the repository and redacted logs.
- Read-only production `SELECT` queries for aggregate baseline evidence, with no
  writes and no seller personal data.
- Documentation, task tracking and test-only harnesses.
- Code changes on `feat/oos-recon-001-remediation` after the relevant task is
  approved.
- Restoring a backup into an isolated, non-production database.
- Running tests against mocks, fixtures or the isolated database.

## 4. Exception process

1. Request the exception from the Eng lead in writing.
2. State the action, target environment, data touched, rollback method and
   evidence that will be captured.
3. Obtain Product approval if the action affects activation, seller-visible
   behavior or `DLY-004`.
4. Record the approval in the task card and in the Phase 0 log.
5. Time-box the exception and close it with evidence.

An exception for one action does not cover another action.

### 4.1 Exception log

| ID | Date | Action and target | Approval | Result | Rollback |
|---|---|---|---|---|---|
| `EX-001` | 2026-10-27 | Set only `PemsTaskTemplates.IsActive = 0` for `OOS-RECON-001` in production `retailops` | User instruction in-session, recorded before execution; scope limited to recurrence containment | Committed `2026-10-27T01:02:06.840Z`; one row updated; OOS instances/runs/bindings/decisions and `DLY-004` unchanged; post-deadline instance-count check pending | Requires a new written exception. Reactivating would resume the existing schedule; do not use rollback as routine cleanup. |

`EX-001` is closed for execution, but the containment check remains open until
an OOS instance count is captured after `2026-10-27T08:51:23Z` and compared with
the 7-instance baseline.

## 5. Branch and rollback ownership

| Item | Value |
|---|---|
| Work branch | `feat/oos-recon-001-remediation` |
| Base code SHA | `316729a` |
| Production branch | `main`; CD deploys only from `main` |
| Rollback decision owner | Eng lead |
| Rollback execution owner | DevOps |
| Business sign-off | Product |
| Database rollback owner | Data/DB |

## 6. Proposed feature flag and rollback path

**Proposed flag:** `VITE_OOS_RECON_001_VIEW` for the frontend resolver, with a
server-side counterpart `OOS_RECON_001_API` if the API needs independent
shutdown. Default is **off**.

The final flag shape depends on decision D10 (cutover mode: per task, per
template or per pilot seller). Do not implement a flag under this name until
D10 is recorded; use this name only as the working proposal.

**Flag-off behavior:** every task, including `OOS-RECON-001`, resolves to the
generic `TaskWorkspace` drawer. The OOS API may remain deployed but must not be
reachable from the disabled UI.

**Rollback order:**

1. Turn the OOS view flag off and confirm the generic drawer opens for a normal
   task and for `OOS-RECON-001`.
2. Stop OOS worker or provider activity if any was enabled.
3. Redeploy the last known-good `main` build.
4. Do not drop OOS tables or delete uploaded originals or export bytes to
   recover the UI; preserve evidence.
5. Use the migration rollback scripts only for a failed, unreleased migration,
   and only on the affected environment.
6. Record the rollback time, operator, flag state and verification evidence.

Rollback is not complete until the flag-off path has been exercised in staging
and the result is attached to OOS-054.

## 7. DLY-004 protection

`DLY-004` is the active daily-ops template and must remain available throughout
remediation.

- Do not edit, reseed or deactivate `DLY-004`.
- Do not change its view binding as part of OOS work.
- Verify it in the restored copy and in staging after every schema or resolver
  change.
- Any change that could affect `DLY-004` requires a separate, explicit approval.

## 8. Communication

Freeze status and exceptions are recorded in:

- [`OOS_RECON_001_PHASE0_BASELINE.md`](./OOS_RECON_001_PHASE0_BASELINE.md)
- [`OOS_RECON_001_TASK_BACKLOG.md`](./OOS_RECON_001_TASK_BACKLOG.md)
- [`OOS_RECON_001_REMEDIATION_PLAN.md`](./OOS_RECON_001_REMEDIATION_PLAN.md)

The freeze remains in force until the Eng lead updates this notice.
