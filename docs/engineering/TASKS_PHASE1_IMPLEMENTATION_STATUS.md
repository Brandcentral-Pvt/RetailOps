# Tasks Phase 1 Correctness: Implemented Slice and Remaining Gates

Base: `26ffa0c5423501e5ddaf96f9b45c363b4cdcd472`  
Branch: `fix/tasks-phase1-correctness`  
Status: **Partial implementation, draft review only. Not production verified.**

## Implemented in this branch

- `backend/services/pems/taskExecutionGates.js`: reusable transaction-scoped guards for required activity evidence, mandatory phase activities, missing phase evidence, task submission completeness (required activities, phases, brands and linked evidence), auto-completion of a ready phase, and atomic count/weighted progress recalculation.
- `backend/services/pems/pemsService.js`: preserves the pre-existing workflow by default. With `PEMS_STRICT_ACTIVITY_GATES=true`, activity and phase completions are validated in a transaction, and submission/resubmission checks required work before the ASIN gate.
- `src/modules/tasks/utils/rbac.js`: removes implicit category-wide permission escalation. Explicit `task.*` remains supported; a named `task.create` permission no longer grants `task.submit`.
- `backend/__tests__/unit/taskExecutionGates.test.js`: unit tests covering representative evidence, phase, submission, and progress invariants.

## Rollout protection

The stricter activity and submission rules are **disabled by default**. Do not turn them on in production for existing DLY-004 routines or other templates until a staging restore and compatibility audit confirm that all mandatory evidence records, phase states, tasks and expected exceptions match the new policy. No schema migration, backfill or active template change is included.

An existing employee's evidence may be a link uploaded at task level rather than linked to a particular ActivityId. In strict mode, activity-specific evidence must be linked to the activity, so the original evidence UI or task data must be adapted and tested before activation. The new `assertSubmissionReady` gate intentionally requires all phases and assigned brands in strict mode; conditional/optional phase policies are future work. The phase auto-complete helper uses mandatory activity completion and does not distinguish conditionally skipped work yet. Both must be resolved in the versioned engine prior to broad rollout.

## NOT completed, do not claim as implemented

1. Immutable published view-definition snapshot written during `createInstance()` in the same SQL transaction.
2. Robust transactional locking on the parent task during all completion paths to prevent simultaneous submission/activity edits.
3. Full validator-key resolution for per-template output checks; current code checks persisted evidence and completion flags, not actual business outcomes.
4. Explicit backend executor/reviewer permission separation across generic PEMS routes, including consistency checks on approval and self-review.
5. Compatibility and actual route-contract fixes for old API-client paths; must be tested rather than assumed.
6. No production historical data audit, schema backfill, or OOS remediation work.
7. No local Jest, CI, staging, or live production test results available in this chat.
8. No shadcn UI migration in this backend phase; the legacy UI is unchanged.

## Review and test requirements before merge

Run in a clean checkout of this branch:

```bash
cd backend
npm ci
node --check services/pems/taskExecutionGates.js
node --check services/pems/pemsService.js
npm test -- --runInBand __tests__/unit/taskExecutionGates.test.js __tests__/unit/templateConfig.test.js __tests__/unit/pemsPolicy.test.js
npm test -- --runInBand __tests__/routes/pemsInstances.test.js __tests__/routes/pemsSellerScope.test.js
```

Run existing frontend lint/typecheck and confirm Task UI still compiles after narrowing RBAC. Stage the strict flag only after a compatibility report shows that no existing task is silently blocked or marked complete without evidence. Confirm allowed rollback simply disables the flag and restores the previous completion path, with no data migration required. Any new strict writes must remain correctly auditable after flag rollback.

## Next implementation slice

- Attach and validate required evidence via the currently supported `PemsEvidence` storage and task controls.
- Introduce task-instance view-definition pinning without modifying existing historical instances.
- Add route tests for activity completion, phase completion, submission and reviewer access, including concurrent/duplicate writes.
- Keep `DLY-004` and contained `OOS-RECON-001` unchanged until separately approved.

**No deployment or merge authorized.**
