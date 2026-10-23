/**
 * Seed OOS-RECON-001 as an INACTIVE DRAFT.
 *
 * Boundaries enforced here (see the OOS rebuild spec):
 *   - Only ever writes OOS-RECON-001. DLY-004 and its history are never touched.
 *   - isActive=false, autoAssign=false, reviewRequired=true, reviewerId=null.
 *   - Refuses to activate. Activation is a separate, later, approved cutover.
 *
 * Idempotent: re-running updates the same OOS-RECON-001 row by TaskCode.
 *
 * Usage: node scripts/seed-oos-recon-template.js
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { getPool, sql } = require('../database/db');
const service = require('../services/pems/pemsService');
const { TASK_CODE, OOS_RECON_TEMPLATE, ACTIVITY_COUNT } = require('../services/pems/oosReconTemplate');

if (process.argv.includes('--activate')) {
  console.error(
    'Refusing to activate OOS-RECON-001: source policies, a named reviewer, test coverage and\n' +
    'independent signoff are required first. Activation is a separate approved cutover.\n' +
    'This script only ever writes an inactive draft.',
  );
  process.exit(2);
}

(async () => {
  const pool = await getPool();
  const found = await pool.request()
    .input('code', sql.VarChar, TASK_CODE)
    .query('SELECT Id, TaskCode FROM PemsTaskTemplates WHERE TaskCode = @code');
  const existing = found.recordset[0];

  // Hard guard: never let this script touch the legacy DLY-004 identity.
  if (existing && existing.TaskCode === 'DLY-004') {
    throw new Error('Refusing: resolved row is DLY-004, not OOS-RECON-001.');
  }

  const result = await service.saveTemplateConfig(
    {
      id: existing ? existing.Id : null,
      template: { ...OOS_RECON_TEMPLATE, isActive: false, autoAssign: false },
      assignmentRules: {
        assignmentMode: 'manual',
        autoAssignStrategy: 'lowest_workload',
        escalationHours: 12,
        approvalLevel: 'single',
        qualityScoreRequired: false,
      },
      createdBy: 'oos-recon-seed',
    },
    null,
  );

  const v = result.validation || { ok: true, warnings: [] };
  console.log(`OOS-RECON-001 ${existing ? 'updated' : 'created'}: id=${result.id} code=${result.taskCode}`);
  console.log(`  status   : DRAFT (isActive=false)  autoAssign=false  reviewRequired=true  reviewerId=null`);
  console.log(`  playbook : 6 phases / ${ACTIVITY_COUNT} outcome activities`);
  if (v.warnings?.length) console.log(`  warnings : ${v.warnings.map((w) => w.message).join(' | ')}`);
  process.exit(0);
})().catch((e) => {
  console.error('Seed failed:', e.message);
  if (e.validation?.errors?.length) console.error('  ', e.validation.errors.map((x) => x.message).join(' | '));
  process.exit(1);
});
