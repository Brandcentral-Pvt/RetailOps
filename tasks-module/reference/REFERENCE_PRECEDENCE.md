# Reference precedence and corrections

1. **Highest authority:** `docs/engineering/OOS_TASK_VIEW_BUILD_SPEC.md` and `docs/engineering/OOS_ACCEPTANCE_TESTS.md`.
2. **Next:** `prompts/OPENCODE_MASTER_IMPLEMENTATION_PROMPT.md` and `AGENTS.md`.
3. **Design references:** the documents, HTML prototype and illustrative workbook in this directory. Older analyses describe historical implementation gaps and might use outdated terms. Do not import outdated terminology into the new app.

The copied `Task_View_Rebuild_Blueprint.md` has a corrected generic view key `STANDARD_V1` (the old source accidentally read `20%_V1` after a label-replacement pass). The source prototype and architecture diagram already use `STANDARD_V1`.

In older audit prose, `Tier 1`, `Tier 2`, `TIER_1`, `STANDARD` are observations or obsolete design shorthand. **Current approved customer-facing priority labels are only `80%` and `20%`**, with verified New ASINs in `20%`, and existing GMS unknown classified as `PRIORITY_PENDING/GMS_UNVERIFIED`.

All example ASINs and inventory values in prototype or workbook are fictional; they are not valid fixtures for checking production inventory values.
