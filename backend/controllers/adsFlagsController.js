/**
 * Ads Intelligence — ASIN flags (user annotations).
 *
 * POST   /api/ads/table/:key/flag   — flag / re-flag an ASIN (owner + scope)
 * GET    /api/ads/table/flags        — list the caller's flags
 * DELETE /api/ads/table/flags/:id    — remove a flag (owner only)
 *
 * Flags are personal annotations: waste, high_acos, watchlist, ignore, …
 * They are stored per (UserId, Asin) with a unique constraint so a user
 * can only have one flag per ASIN. Re-flagging updates the existing row.
 *
 * Seller scope is NOT enforced here — flags are private user notes, not
 * data filters. Any authenticated user can flag any ASIN they can see.
 */

const { sql, getPool, generateId } = require('../database/db');

const ok = (res, data, extra = {}) => res.json({ success: true, data, ...extra });
const fail = (res, status, code, message, details = {}) =>
  res.status(status).json({ success: false, code, message, ...details });

const VALID_FLAGS = new Set(['waste', 'high_acos', 'watchlist', 'ignore', 'rising', 'falling']);

/** POST /api/ads/table/:key/flag */
exports.setFlag = async (req, res) => {
  try {
    const userId = req.user?.Id || req.user?._id || req.userId;
    if (!userId) {
      return fail(res, 401, 'auth_required', 'Authentication required');
    }

    const { key } = req.params;
    const { flag, note } = req.body;

    if (!key) {
      return fail(res, 400, 'key_required', 'ASIN key is required.');
    }
    if (!flag || !VALID_FLAGS.has(flag)) {
      return fail(res, 400, 'invalid_flag', `Flag must be one of: ${[...VALID_FLAGS].join(', ')}.`);
    }
    if (note !== undefined && typeof note !== 'string') {
      return fail(res, 400, 'invalid_note', 'Note must be a string.');
    }

    const pool = await getPool();
    const id = generateId();

    // Upsert: unique constraint on (UserId, Asin) means re-flagging updates.
    await pool.request()
      .input('id', sql.VarChar, id)
      .input('userId', sql.VarChar, userId)
      .input('asin', sql.VarChar, String(key).slice(0, 64))
      .input('flag', sql.VarChar, flag)
      .input('note', sql.NVarChar, note ? note.slice(0, 500) : null)
      .query(`
        MERGE AdsFlags AS target
        USING (SELECT @userId AS UserId, @asin AS Asin) AS source
          ON target.UserId = source.UserId AND target.Asin = source.Asin
        WHEN MATCHED THEN
          UPDATE SET Flag = @flag, Note = @note, CreatedAt = dbo.GetEnvDate()
        WHEN NOT MATCHED THEN
          INSERT (Id, UserId, Asin, Flag, Note, CreatedAt)
          VALUES (@id, @userId, @asin, @flag, @note, dbo.GetEnvDate());
      `);

    return ok(res, {
      id,
      asin: String(key).slice(0, 64),
      flag,
      note: note || null,
    });
  } catch (error) {
    console.error('[adsFlagsController.setFlag]', error);
    return fail(res, 500, 'flag_set_failed', error.message);
  }
};

/** GET /api/ads/table/flags */
exports.listFlags = async (req, res) => {
  try {
    const userId = req.user?.Id || req.user?._id || req.userId;
    if (!userId) {
      return fail(res, 401, 'auth_required', 'Authentication required');
    }

    const pool = await getPool();
    const result = await pool.request()
      .input('userId', sql.VarChar, userId)
      .query(`
        SELECT Id, Asin, Flag, Note, CreatedAt
        FROM AdsFlags
        WHERE UserId = @userId
        ORDER BY CreatedAt DESC
      `);

    return ok(res, result.recordset.map((row) => ({
      id: row.Id,
      asin: row.Asin,
      flag: row.Flag,
      note: row.Note || null,
      createdAt: row.CreatedAt,
    })));
  } catch (error) {
    console.error('[adsFlagsController.listFlags]', error);
    return fail(res, 500, 'flags_list_failed', error.message);
  }
};

/** DELETE /api/ads/table/flags/:id */
exports.deleteFlag = async (req, res) => {
  try {
    const userId = req.user?.Id || req.user?._id || req.userId;
    if (!userId) {
      return fail(res, 401, 'auth_required', 'Authentication required');
    }

    const { id } = req.params;
    if (!id) {
      return fail(res, 400, 'id_required', 'Flag id is required.');
    }

    const pool = await getPool();
    const result = await pool.request()
      .input('id', sql.VarChar, id)
      .input('userId', sql.VarChar, userId)
      .query(`
        DELETE FROM AdsFlags
        WHERE Id = @id AND UserId = @userId
        SELECT @@ROWCOUNT AS deleted
      `);

    const deleted = result.recordset[0]?.deleted || 0;
    if (deleted === 0) {
      return fail(res, 404, 'not_found', 'Flag not found or not owned by you.');
    }

    return ok(res, { id, deleted: true });
  } catch (error) {
    console.error('[adsFlagsController.deleteFlag]', error);
    return fail(res, 500, 'flag_delete_failed', error.message);
  }
};
