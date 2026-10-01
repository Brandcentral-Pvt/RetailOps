/*
 * One-off repair: the 18 brand-less tasks orphaned when the Punit Gajera user
 * row was deleted. Reassigns them to Chintan Patel and marks the Department as
 * Operations so the assignee and the department agree.
 *
 * Safe to re-run: it only touches rows whose AssignedTo still points at the
 * deleted user, so a second run matches nothing.
 *
 * Usage: node scripts/reassignOrphanedTasks.js [--dry-run]
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const sql = require('mssql');
const env = require('../config/env');

const ORPHANED_USER_ID = 'ad1e7d52447b4c64af5e04f8';
const TARGET_EMAIL = 'chintan.patel@brandcentral.in';

const dryRun = process.argv.includes('--dry-run');

(async () => {
  const pool = await sql.connect({
    user: env.db.user,
    password: env.db.password,
    server: env.db.server,
    database: env.db.database,
    port: env.db.port,
    options: { ...env.db.options, requestTimeout: 60000 },
  });

  const target = await pool.request()
    .input('email', sql.VarChar, TARGET_EMAIL)
    .query('SELECT Id, FirstName, LastName FROM Users WHERE Email = @email AND IsActive = 1');
  const assignee = target.recordset[0];
  if (!assignee) throw new Error(`No active user with email ${TARGET_EMAIL}`);

  const orphans = await pool.request()
    .input('oid', sql.VarChar, ORPHANED_USER_ID)
    .query(`
      SELECT t.Id, t.InstanceCode, t.Status, t.Department, t.AssigneeName
      FROM PemsTaskInstances t
      LEFT JOIN Users u ON u.Id = t.AssignedTo
      WHERE t.AssignedTo = @oid AND u.Id IS NULL
      ORDER BY t.InstanceCode`);
  console.log(`Assignee: ${assignee.FirstName} ${assignee.LastName} (${assignee.Id})`);
  console.log(`Orphaned tasks found: ${orphans.recordset.length}`);
  orphans.recordset.forEach(t =>
    console.log(`  ${t.InstanceCode}  ${String(t.Status).padEnd(12)} ${String(t.Department || '').padEnd(16)} "${t.AssigneeName || ''}"`));

  if (dryRun) {
    console.log('\n--dry-run: no changes written.');
    await pool.close();
    return;
  }

  const result = await pool.request()
    .input('oid', sql.VarChar, ORPHANED_USER_ID)
    .input('newAssignee', sql.VarChar, assignee.Id)
    .input('newName', sql.NVarChar, `${assignee.FirstName} ${assignee.LastName}`)
    .query(`
      UPDATE PemsTaskInstances
      SET AssignedTo = @newAssignee,
          AssigneeName = @newName,
          Department = 'Operations',
          UpdatedAt = GETUTCDATE()
      WHERE AssignedTo = @oid
        AND NOT EXISTS (SELECT 1 FROM Users u WHERE u.Id = AssignedTo)`);
  console.log(`\nUpdated ${result.rowsAffected[0]} task(s).`);

  const verify = await pool.request()
    .input('assignee', sql.VarChar, assignee.Id)
    .query('SELECT COUNT(*) AS n FROM PemsTaskInstances WHERE AssignedTo = @assignee');
  console.log(`${assignee.FirstName} ${assignee.LastName} now holds ${verify.recordset[0].n} task(s).`);

  const remaining = await pool.request()
    .input('oid', sql.VarChar, ORPHANED_USER_ID)
    .query('SELECT COUNT(*) AS n FROM PemsTaskInstances WHERE AssignedTo = @oid');
  console.log(`Rows still pointing at the deleted user: ${remaining.recordset[0].n}`);

  await pool.close();
})().catch((err) => {
  console.error('FAILED:', err.message);
  process.exit(1);
});
