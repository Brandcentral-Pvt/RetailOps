# Start here: OpenCode implementation pack

Goal: implement a template-driven Task View architecture, with OOS-RECON-001 as the FIRST specialized execution view. Includes the current approved rule: priority groups **80% / 20%**, verified **New ASINs always 20%**, existing ASINs with missing GMS remain **priority pending**, never assumed 20%.

## Source baseline

Source audit: private repo `Brandcentral-Pvt/RetailOps`, `main` was `9cbee6385c72c27bb83884352de2e8574b7b9754` when this pack was prepared. The agent MUST inspect its CURRENT local checkout/HEAD and adapt; no fixed-SHA code patches are asserted. `DLY-004` must remain untouched; `OOS-RECON-001` remains an inactive draft.

## Package layout and installation

Copy into your own local RetailOps repository root (for example, `~/Projects/RetailOps`), **merging rather than overwriting any existing instruction file**:

- `AGENTS.md` - project-wide strict constraints for this implementation.
- `.opencode/agents/*.md` - optional specialist agent profiles; choose the matching OpenCode version's permission settings if your app reports deprecations.
- `prompts/OPENCODE_MASTER_IMPLEMENTATION_PROMPT.md` - the full, self-contained implementation instruction to paste in a new OpenCode Build session.
- `docs/engineering/OOS_TASK_VIEW_BUILD_SPEC.md` - engineering source of truth.
- `docs/engineering/OOS_ACCEPTANCE_TESTS.md` - unambiguous functional and security test matrix.
- `reference/*` - approved design documents, workflow, simulated HTML UI and **fictional** sample Excel file.

Open a terminal in the RetailOps repository, inspect `git status`, then start OpenCode **Build**, paste the full master prompt, and ensure the files above exist within the checked-out project. Do not start from Plan if you expect code edits. If your workspace has a local `AGENTS.md` or OpenCode configuration, merge intentionally.

OpenCode's documented auto-loading behavior includes project-root `AGENTS.md`; project-specific Markdown subagents can live under `.opencode/agents/`. See https://docs.opencode.ai/docs/rules/ and https://opencode.ai/docs/agents/ . The `permission` frontmatter reflects the documented standard Markdown agent style; OpenCode versions can differ. Verify effective tool permissions in your installed release, especially for read-only reviewer agents.

## Scope of authorization

These instructions authorize safe implementation in a development feature branch, local tests and preparing migrations. They do NOT authorize: push/merge/deploy, production migrations, real Amazon sync, seller communication, setting `OOS-RECON-001` active or auto-assigning it. A completed code change is still not a production release.

## Local verification commands present in the inspected package.json

Root: `npm run lint`, `npm run typecheck`, `npm run build`.
Backend: `npm --prefix backend test -- --runInBand` (or inspect actual Jest runner options before use).
Targeted browser: `npx playwright test tests/task-oos-workspace.spec.js tests/task-workspace-drawer.spec.js tests/task-templates-library.spec.js` (configure the test environment and browser in accordance with the repo).
These commands can fail if dependencies, local services or browser binaries are unavailable. Report exactly what ran and why any test was blocked.

## Success

The test is not whether an OOS page is visually attractive. Success means assigned users can complete the correct seller-scoped workflow in their OWN PEMS task view, with source-verified ASIN evidence, correct 80%/20%/New labels and real XLSX export; server-authorized resync cannot falsely close incidents; and only an authenticated independent PEMS reviewer can approve the daily task. All generic task types continue to operate.
