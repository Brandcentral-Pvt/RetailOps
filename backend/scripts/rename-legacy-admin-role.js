/* eslint-disable no-console */
/**
 * CONTRACT R — one-off migration: canonicalize the legacy super-admin role.
 *
 *   node scripts/rename-legacy-admin-role.js
 *
 * WHAT IT DOES
 *   Legacy role names ('supert admin', 'super admin', 'Super Admin') are
 *   renamed to the canonical 'super_admin'. If a canonical 'super_admin' role
 *   ALREADY exists alongside a legacy variant, nothing is merged: users are
 *   REASSIGNED from the legacy roles to the canonical role's Id, then the
 *   legacy rows are deactivated (IsActive=0) — or deleted when the Roles
 *   table has no IsActive column (after their RolePermissions are removed to
 *   satisfy FK constraints).
 *
 * SAFETY PROPERTIES
 *   - Idempotent: run it any number of times; second run is a clean no-op.
 *   - Dry-run style output BEFORE any write: prints every role that will
 *     change plus affected user counts (Users ⋈ Roles by RoleId).
 *   - All writes happen inside ONE transaction.
 *   - Schema-adaptive: reads INFORMATION_SCHEMA.COLUMNS for Roles/Users first
 *     and adapts to whichever columns actually exist.
 *
 * ⚠️ DEPLOY ORDERING — READ BEFORE RUNNING ⚠️───────────────────────────────
 *   This script MUST be executed AT DEPLOY TIME of the release in which the
 *   frontend removes 'supert admin' / includes('supert') leniency from its
 *   ADMIN_ROLES whitelist (parallel frontend change, same release).
 *   Recommended order:
 *     1. Deploy backend + RUN THIS SCRIPT.
 *     2. Immediately deploy the frontend bundle without the legacy names.
 *   Between step 1 and 2, admins whose role was renamed may need a re-login /
 *   page refresh to regain admin UI affordances. Do NOT leave the window open
 *   across releases.
 *
 * Never prints secrets. Prints only role ids/names and user counts.
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { getPool, sql } = require('../database/db');

const CANONICAL_NAME = 'super_admin';
const CANONICAL_DISPLAY_NAME = 'Super Admin';
const LEGACY_NAMES = ['supert admin', 'super admin', 'Super Admin'];

async function getTableColumns(pool, tableName) {
    const result = await pool.request()
        .input('table', sql.NVarChar, tableName)
        .query(`
            SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = @table
        `);
    return new Set(result.recordset.map(r => r.COLUMN_NAME));
}

async function main() {
    console.log('════════════════════════════════════════════════════════════');
    console.log(' CONTRACT R: rename legacy super-admin role → "super_admin"');
    console.log('════════════════════════════════════════════════════════════');
    console.log('⚠️  Run this at deploy time together with the frontend release');
    console.log('   that removes "supert admin" from the ADMIN_ROLES whitelist.');
    console.log('   Order: 1) this script, 2) frontend deploy. Keep the window short.\n');

    const pool = await getPool();

    // ── 0. Schema introspection ──
    const rolesCols = await getTableColumns(pool, 'Roles');
    const usersCols = await getTableColumns(pool, 'Users');
    if (!rolesCols.has('Id') || !rolesCols.has('Name')) {
        throw new Error('Roles table missing expected Id/Name columns — aborting.');
    }
    if (!usersCols.has('Id') || !usersCols.has('RoleId')) {
        throw new Error('Users table missing expected Id/RoleId columns — aborting.');
    }
    const hasRolesActive = rolesCols.has('IsActive');
    const hasRolesDisplayName = rolesCols.has('DisplayName');
    console.log(`Schema: Roles.IsActive=${hasRolesActive ? 'yes' : 'NO'} | Roles.DisplayName=${hasRolesDisplayName ? 'yes' : 'NO'}`);

    // ── 1. Dry-run discovery ──
    const legacyInList = LEGACY_NAMES.map((_, i) => `@legacy${i}`).join(', ');
    const legacyReq = pool.request();
    LEGACY_NAMES.forEach((n, i) => legacyReq.input(`legacy${i}`, sql.NVarChar, n));
    const legacyResult = await legacyReq.query(
        `SELECT * FROM Roles WHERE LTRIM(RTRIM(Name)) IN (${legacyInList})`
    );
    const legacyRoles = legacyResult.recordset;

    const canonResult = await pool.request()
        .input('name', sql.NVarChar, CANONICAL_NAME)
        .query('SELECT TOP 1 * FROM Roles WHERE Name = @name ORDER BY (SELECT NULL)');
    const canonicalRole = canonResult.recordset[0] || null;

    // User counts per role (by RoleId join)
    async function countUsers(roleId) {
        const r = await pool.request()
            .input('roleId', sql.VarChar, roleId)
            .query('SELECT COUNT(*) AS n FROM Users WHERE RoleId = @roleId');
        return r.recordset[0].n;
    }

    if (legacyRoles.length === 0 && !canonicalRole) {
        console.log('\n❌ No legacy roles AND no canonical role found — nothing to do.');
        process.exit(1);
    }
    if (legacyRoles.length === 0) {
        console.log(`\n✅ Canonical "${CANONICAL_NAME}" already present and no legacy variants remain — nothing to do (idempotent no-op).`);
        await printFinalVerification(pool);
        process.exit(0);
    }

    console.log('\n── DRY-RUN: roles that will change ──');
    for (const role of legacyRoles) {
        const users = await countUsers(role.Id);
        console.log(`  legacy role: Id=${role.Id} Name="${role.Name}"` +
            (hasRolesDisplayName ? ` DisplayName="${role.DisplayName ?? ''}"` : '') +
            (hasRolesActive ? ` IsActive=${role.IsActive}` : '') +
            ` → ${users} user(s)`);
    }
    if (canonicalRole) {
        const users = await countUsers(canonicalRole.Id);
        console.log(`  existing canonical: Id=${canonicalRole.Id} Name="${canonicalRole.Name}" → ${users} user(s)`);
    } else {
        console.log('  (no pre-existing canonical role — a legacy row will be renamed in place)');
    }
    console.log('');

    // Pick which legacy row becomes the canonical one when renaming in place:
    // the variant holding the MOST users wins (fewest rows to move).
    const withCounts = [];
    for (const role of legacyRoles) {
        withCounts.push({ role, users: await countUsers(role.Id) });
    }
    withCounts.sort((a, b) => b.users - a.users);

    const transaction = new sql.Transaction(pool);
    try {
        await transaction.begin();

        if (!canonicalRole) {
            // ── CASE A: rename in place ──
            const primary = withCounts[0];
            const renameReq = transaction.request()
                .input('newName', sql.NVarChar, CANONICAL_NAME)
                .input('roleId', sql.VarChar, primary.role.Id);
            let renameSql = 'UPDATE Roles SET Name = @newName';
            if (hasRolesDisplayName) {
                // Careful: only overwrite DisplayName when it still reflects a
                // legacy label or is empty — never clobber a custom label.
                renameSql += `,
                    DisplayName = CASE
                        WHEN DisplayName IS NULL OR LTRIM(RTRIM(DisplayName)) = ''
                             OR DisplayName IN (@l0, @l1, @l2)
                        THEN @displayName ELSE DisplayName END`;
                renameReq.input('displayName', sql.NVarChar, CANONICAL_DISPLAY_NAME);
                LEGACY_NAMES.forEach((n, i) => renameReq.input(`l${i}`, sql.NVarChar, n));
            }
            renameSql += ' WHERE Id = @roleId';
            await renameReq.query(renameSql);
            console.log(`✔ Renamed legacy role Id=${primary.role.Id} ("${primary.role.Name}") → "${CANONICAL_NAME}" (${primary.users} user(s) unaffected).`);

            // Merge any OTHER legacy variants into the renamed primary.
            for (const { role } of withCounts.slice(1)) {
                await mergeIntoCanonical(transaction, {
                    targetId: primary.role.Id,
                    legacyId: role.Id,
                    legacyName: role.Name,
                    hardDelete: !hasRolesActive,
                });
            }
        } else {
            // ── CASE B: canonical exists — NO MERGE of permissions/rows;
            //    reassign users, then retire the legacy rows.
            for (const { role } of withCounts) {
                await mergeIntoCanonical(transaction, {
                    targetId: canonicalRole.Id,
                    legacyId: role.Id,
                    legacyName: role.Name,
                    hardDelete: !hasRolesActive,
                });
            }
        }

        await transaction.commit();
        console.log('\n✔ Transaction committed.');
    } catch (err) {
        console.error('\n❌ Migration failed — transaction rolled back:', err.message);
        try { await transaction.rollback(); } catch (_) { /* already rolled back */ }
        process.exit(1);
    }

    await printFinalVerification(pool);
    await closePool();
}

/** Reassign users from a legacy role to the canonical role, then retire it. */
async function mergeIntoCanonical(tx, { targetId, legacyId, legacyName, hardDelete }) {
    // Guard against a degenerate self-merge.
    if (String(legacyId) === String(targetId)) return;

    const moved = await tx.request()
        .input('fromId', sql.VarChar, legacyId)
        .input('toId', sql.VarChar, targetId)
        .query('UPDATE Users SET RoleId = @toId WHERE RoleId = @fromId; SELECT @@ROWCOUNT AS moved;');
    console.log(`✔ Reassigned ${moved.recordset[0].moved} user(s) from legacy role Id=${legacyId} ("${legacyName}") → canonical Id=${targetId}.`);

    if (hardDelete) {
        // No IsActive column: remove permission links first (FK safety), then delete.
        await tx.request()
            .input('roleId', sql.VarChar, legacyId)
            .query('DELETE FROM RolePermissions WHERE RoleId = @roleId');
        await tx.request()
            .input('roleId', sql.VarChar, legacyId)
            .query('DELETE FROM Roles WHERE Id = @roleId');
        console.log(`✔ Deleted legacy role Id=${legacyId} (Roles has no IsActive column).`);
    } else {
        // Prefer soft-delete so history/FKs stay intact.
        await tx.request()
            .input('roleId', sql.VarChar, legacyId)
            .query('UPDATE Roles SET IsActive = 0 WHERE Id = @roleId');
        console.log(`✔ Deactivated (IsActive=0) legacy role Id=${legacyId}.`);
    }
}

async function printFinalVerification(pool) {
    console.log('\n── FINAL VERIFICATION ──');
    const colResult = await pool.request()
        .input('table', sql.NVarChar, 'Roles')
        .query(`
            SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = @table
        `);
    const cols = new Set(colResult.recordset.map(r => r.COLUMN_NAME));
    const displayCol = cols.has('DisplayName') ? ', R.DisplayName' : '';
    const activeCol = cols.has('IsActive') ? ', R.IsActive' : '';

    const roles = await pool.request().query(`
        SELECT R.Id, R.Name${displayCol}${activeCol}
        FROM Roles R
        WHERE R.Name IN ('super_admin', 'supert admin', 'super admin', 'Super Admin')
        ORDER BY R.Name
    `);
    for (const row of roles.recordset) {
        const u = await pool.request()
            .input('roleId', sql.VarChar, row.Id)
            .query('SELECT COUNT(*) AS n FROM Users WHERE RoleId = @roleId');
        console.log(`  Id=${row.Id}  Name="${row.Name}"` +
            (cols.has('DisplayName') ? `  DisplayName="${row.DisplayName ?? ''}"` : '') +
            (cols.has('IsActive') ? `  IsActive=${row.IsActive}` : '') +
            `  users=${u.recordset[0].n}`);
    }
}

async function closePool() {
    try {
        const pool = await getPool();
        if (pool && typeof pool.close === 'function') await pool.close();
    } catch (_) { /* best effort */ }
    process.exit(0);
}

main().catch((err) => {
    console.error('❌ Fatal:', err.message);
    process.exit(1);
});
