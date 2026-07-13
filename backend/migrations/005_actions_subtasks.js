/**
 * Migration 005: Add SubTasks column to Actions table
 * Supports grouped task creation (e.g., price dispute → 1 main task + N sub-tasks)
 */
const { sql, getPool } = require('../database/db');

async function up() {
    const pool = await getPool();
    const request = pool.request();

    // Add SubTasks column (JSON array of sub-task objects)
    try {
        await request.query(`
            IF NOT EXISTS (
                SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS 
                WHERE TABLE_NAME = 'Actions' AND COLUMN_NAME = 'SubTasks'
            )
            BEGIN
                ALTER TABLE Actions ADD SubTasks NVARCHAR(MAX) NULL;
            END
        `);
        console.log('[Migration 005] ✅ SubTasks column added to Actions table');
    } catch (err) {
        console.error('[Migration 005] ❌ Error:', err.message);
    }

    // Add SubTaskProgress column (completed/total)
    try {
        await pool.request().query(`
            IF NOT EXISTS (
                SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS 
                WHERE TABLE_NAME = 'Actions' AND COLUMN_NAME = 'SubTaskProgress'
            )
            BEGIN
                ALTER TABLE Actions ADD SubTaskProgress NVARCHAR(50) NULL;
            END
        `);
        console.log('[Migration 005] ✅ SubTaskProgress column added to Actions table');
    } catch (err) {
        console.error('[Migration 005] ❌ Error:', err.message);
    }
}

module.exports = { up };
