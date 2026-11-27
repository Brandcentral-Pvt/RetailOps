/**
 * Ads Intelligence — saved views (filter presets).
 *
 * GET    /api/ads/saved-views      — list the caller's saved views
 * POST   /api/ads/saved-views      — create a saved view
 * DELETE /api/ads/saved-views/:id  — delete a saved view (owner only)
 *
 * Every row is scoped to UserId → Users.Id so a user can only read/write
 * their own presets. No seller-scope bypass: saved views store the raw
 * filter params and the caller's current seller scope is re-applied at
 * read time by the frontend.
 */

const { sql, getPool, generateId } = require('../database/db');

const ok = (res, data, extra = {}) => res.json({ success: true, data, ...extra });
const fail = (res, status, code, message, details = {}) =>
  res.status(status).json({ success: false, code, message, ...details });

/** GET /api/ads/saved-views */
exports.listSavedViews = async (req, res) => {
  try {
    const userId = req.user?.Id || req.user?._id || req.userId;
    if (!userId) {
      return fail(res, 401, 'auth_required', 'Authentication required');
    }

    const pool = await getPool();
    const result = await pool.request()
      .input('userId', sql.VarChar, userId)
      .query(`
        SELECT Id, Name, Filters, CreatedAt, UpdatedAt
        FROM UserAdsSavedViews
        WHERE UserId = @userId
        ORDER BY UpdatedAt DESC
      `);

    return ok(res, result.recordset.map((row) => ({
      id: row.Id,
      name: row.Name,
      filters: row.Filters ? JSON.parse(row.Filters) : {},
      createdAt: row.CreatedAt,
      updatedAt: row.UpdatedAt,
    })));
  } catch (error) {
    console.error('[adsSavedViewsController.listSavedViews]', error);
    return fail(res, 500, 'saved_views_failed', error.message);
  }
};

/** POST /api/ads/saved-views */
exports.createSavedView = async (req, res) => {
  try {
    const userId = req.user?.Id || req.user?._id || req.userId;
    if (!userId) {
      return fail(res, 401, 'auth_required', 'Authentication required');
    }

    const { name, filters } = req.body;
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return fail(res, 400, 'name_required', 'A view name is required.');
    }
    if (!filters || typeof filters !== 'object') {
      return fail(res, 400, 'filters_required', 'Filter parameters are required.');
    }

    const pool = await getPool();
    const id = generateId();
    const filtersJson = JSON.stringify(filters);

    await pool.request()
      .input('id', sql.VarChar, id)
      .input('userId', sql.VarChar, userId)
      .input('name', sql.NVarChar, name.trim())
      .input('filters', sql.NVarChar, filtersJson)
      .query(`
        INSERT INTO UserAdsSavedViews (Id, UserId, Name, Filters, CreatedAt, UpdatedAt)
        VALUES (@id, @userId, @name, @filters, dbo.GetEnvDate(), dbo.GetEnvDate())
      `);

    return ok(res, {
      id,
      name: name.trim(),
      filters,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[adsSavedViewsController.createSavedView]', error);
    return fail(res, 500, 'saved_view_create_failed', error.message);
  }
};

/** DELETE /api/ads/saved-views/:id */
exports.deleteSavedView = async (req, res) => {
  try {
    const userId = req.user?.Id || req.user?._id || req.userId;
    if (!userId) {
      return fail(res, 401, 'auth_required', 'Authentication required');
    }

    const { id } = req.params;
    if (!id) {
      return fail(res, 400, 'id_required', 'Saved view id is required.');
    }

    const pool = await getPool();
    const result = await pool.request()
      .input('id', sql.VarChar, id)
      .input('userId', sql.VarChar, userId)
      .query(`
        DELETE FROM UserAdsSavedViews
        WHERE Id = @id AND UserId = @userId
        SELECT @@ROWCOUNT AS deleted
      `);

    const deleted = result.recordset[0]?.deleted || 0;
    if (deleted === 0) {
      return fail(res, 404, 'not_found', 'Saved view not found or not owned by you.');
    }

    return ok(res, { id, deleted: true });
  } catch (error) {
    console.error('[adsSavedViewsController.deleteSavedView]', error);
    return fail(res, 500, 'saved_view_delete_failed', error.message);
  }
};
