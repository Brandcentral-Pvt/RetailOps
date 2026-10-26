# RetailOps project instructions: template-specific task views

You are working in Brandcentral-Pvt/RetailOps, a real operations platform. Preserve current permissions, production data integrity, task history and existing task behavior.

## Required specification for this feature
Before implementing the template-specific Task View or OOS-RECON-001, read both:
- `docs/engineering/OOS_TASK_VIEW_BUILD_SPEC.md`
- `docs/engineering/OOS_ACCEPTANCE_TESTS.md`

The full work order is `prompts/OPENCODE_MASTER_IMPLEMENTATION_PROMPT.md`. The source in `reference/` is approved design guidance, NOT production implementation code or live test data. Follow the checked-out source if files or APIs have changed and document any conflicts.

## Invariants
1. Never modify, deactivate or replace `DLY-004`, or generate DLY-004 migration changes to implement OOS-RECON-001.
2. Leave `OOS-RECON-001` inactive and not automatically assigned until a separate, authorized production cutover.
3. Template-specific task views render in a shared shell through a secure, versioned registry. No executable view configuration; no full copy of `TaskWorkspace.jsx` per template.
4. All domain records, uploads, exports, ASIN grids, resyncs and task evidence are bound to authenticated PEMS task instances and their authorized seller/channel scopes.
5. Preserve null/missing stock as unknown. Seller GMS priority labels are `80%` / `20%`; verified New ASINs always show `20%`; missing GMS is unverified, never silently assigned 20%.
6. A queued resync is not recovered. Only a newer, server-authenticated, same-scope marketplace observation can resolve an OOS discrepancy. Never accept client-entered state/time as authoritative.
7. Daily monitoring can pass with properly owned open incidents. Only an independently authenticated PEMS reviewer can approve task closure.
8. Backend permissions and transactional gates, never UI controls, protect operations.
9. No silent mutation or deletion of original evidence, no secret exposure, no destructive migrations or tests against production.
10. Do not commit, push, merge, run live migrations, deploy, send seller communications, activate a template or trigger live resync without explicit authorization.

## Workflow
- At the start: `pwd`, `git status --short`, `git branch --show-current`, `git rev-parse HEAD`, `git log -5 --oneline`, verify package scripts and `AGENTS.md` instructions.
- If the workspace has uncommitted changes, identify and protect them; do not revert or overwrite unrelated work.
- Prefer existing React/Ant Design, REST/Express, SQL Server, Jest and Playwright patterns. Reuse current auth, PEMS review, seller scope and provider sync logic.
- Create dedicated feature tests, a migration design and an auditable report of changed files and tests. Resolve security/functional P0 defects before polishing UI.
- Execute `npm run lint`, `npm run typecheck`, `npm run build` at repo root and relevant Jest/Playwright suites if available. Report genuinely failed or blocked commands.
- No assertion of completion without backend tests, browser tests, and verifiable review/evidence controls. Never substitute mocked tests for production integration proof.
