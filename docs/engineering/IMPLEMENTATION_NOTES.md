# OOS-RECON-001 Task View Implementation Notes

**Date:** 2026-10-23  
**Baseline Commit:** `9cbee6385c72c27bb83884352de2e8574b7b9754`  
**Branch:** `feat/rule-sets-index-redesign`  
**HEAD:** `9cbee6385c72c27bb83884352de2e8574b7b9754`

## Phase 0: Audit Summary

### Current State Assessment

| Component | Status | Notes |
|-----------|--------|-------|
| **Shared Task Shell** | Not extracted | `TaskWorkspace.jsx` is a 1269-line monolith with hardcoded OOS navigation |
| **View Registry** | Not implemented | No versioned Task View Definitions; TemplateCode string comparisons in TaskWorkspace |
| **Task View Definitions** | Not implemented | No `PemsTemplateViewDefinitions` table or versioned definitions |
| **OOS-RECON-001 Template** | Seeded as draft | 4 phases / 13 activities; `isActive=false`, `autoAssign=false` |
| **OOS Domain Services** | Partially implemented | Backend services exist but with P0 defects (resync, verification, export) |
| **OOS Migrations** | 032 applied | Missing task-run binding (`OosRuns` lacks `TaskInstanceId` FK) |
| **OOS Workspace** | Deleted | Previously standalone `/tasks/oos` page; now removed per spec |
| **DLY-004** | Preserved | Untouched, active, auto-assigning |

### P0 Defects Identified (from spec)

| ID | Component | Defect |
|----|-----------|--------|
| SY-01 | `oosSyncService.js` | `requestResync()` only saves QUEUED; no worker dispatch |
| SY-02 | `oosSyncService.js` | `verifyResync()` accepts client-supplied state/time; unconditionally resolves incidents |
| GR-09 | `oosSubmissionService.js` | `submitRun()` uses supplied `reviewerId`; no genuine PEMS reviewer flow |
| SY-03 | Migration 032 | `OosRuns` lacks `TaskInstanceId` FK; daily uniqueness `(RunDate, SellerId)` only |
| TV-03 | `TaskWorkspace.jsx` | Hardcoded `TemplateCode === 'OOS-RECON-001'` navigation loses task context |
| GM-01 | `oosParetoService.js` | Uses `TIER_1`/`STANDARD` instead of `80%`/`20%` labels |
| UP-01 | `oosUploadService.js` | Accepts JSON rows + caller-supplied fileHash; no original file storage |
| EX-01 | `oosExportService.js` | Wrong sheet names; not flat ASIN rows; no formula injection protection |
| RL-01 | `pemsService.js` | `createInstance()` ignores `evidenceRequired`; OOS evidence not enforced |

### Database State (verified)

- Migration `032_oos_reconciliation.js` applied (10 OOS tables + policy v1)
- `OOS-RECON-001` template seeded: `isActive=false`, `autoAssign=false`, `reviewRequired=true`, `reviewerId=null`
- `DLY-004` preserved: `IsActive=true`, `AutoAssign=true`
- All generated task instances cleaned (3,299 deleted)
- Only `DLY-004` and `OOS-RECON-001` templates remain active/inactive respectively

### Remaining Work Categories

| Phase | Description | Status |
|-------|-------------|--------|
| Phase 1 | Registry + Task Shell | NOT STARTED |
| Phase 2 | OOS Task/Run Binding + Permissions | NOT STARTED |
| Phase 3 | Data & Policy (RetailOps snapshot, uploads, reconciliation, GMS) | PARTIAL (backend services exist with P0 defects) |
| Phase 4 | Specialized OOS View (Affected ASINs tab) | NOT STARTED |
| Phase 5 | Resync, Incidents, Exports | PARTIAL (services exist with P0 defects) |
| Phase 6 | Task Review & Publish Governance | NOT STARTED |
| Phase 7 | Validation & Handoff | NOT STARTED |

### Key Risks

1. **Migration complexity**: Adding `TaskInstanceId` to `OosRuns` requires handling existing unique index `UX_OosRuns_Date_Seller`
2. **Resync dispatch**: Must integrate with existing `liveDataSyncService`/Creators API rate gate
3. **File storage**: Original file bytes must be stored server-side with checksums (not just JSON rows)
4. **Independent review**: Must integrate with existing PEMS review queue, not custom `reviewerId` param
5. **Formula injection**: CSV/XLSX export must neutralize `=`, `+`, `-`, `@` prefixes
6. **First-seen policy**: New ASIN definition requires approved policy; no hardcoded threshold
7. **DLY-004 preservation**: Must not touch DLY-004 code, instances, or history
8. **OOS-RECON-001**: Must remain `isActive=false`, `autoAssign=false` until explicit cutover

### Test Commands (baseline)

```bash
# Backend tests
cd backend && npm test -- --testPathPattern="oos" --forceExit

# Frontend lint/build
npm run lint && npm run typecheck && npm run build

# Playwright tests
npx playwright test tests/task-templates-library.spec.js tests/task-templates-css.spec.js

# Full backend suite
cd backend && npm test -- --forceExit
```
