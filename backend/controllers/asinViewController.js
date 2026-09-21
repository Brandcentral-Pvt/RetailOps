/**
 * Saved views + per-user column preferences for the ASIN Manager workspace
 * (Step 3 — "a filtered view can be saved, shared and restored exactly").
 *
 * A **view** is the whole workspace state, not just the filters: filter set,
 * search term, sort column/direction, visible columns and which surface the user
 * was on (`asins` or `tracker`). Storing it as one JSON payload means the shape
 * can grow without migrations, and the client stays in charge of what a view
 * means — the server's job is to validate it, scope it and keep it.
 *
 * Ownership rules:
 *   - a user sees their own views plus every shared view;
 *   - only the owner (or a global role) may edit or delete a view;
 *   - sharing is a per-view flag, not a separate collection.
 */
const { sql, getPool, generateId } = require('../database/db');
const { isGlobalUserRole } = require('../utils/roleUtils');

const MAX_VIEWS_PER_USER = 50;
const MAX_NAME_LENGTH = 120;
const MAX_COLUMNS = 200;
const MAX_FILTERS = 80;
const MAX_SEARCH_LENGTH = 200;
const ALLOWED_MODES = new Set(['asins', 'tracker']);

const userIdOf = (req) => String((req.user && (req.user._id || req.user.Id || req.user.id)) || req.userId || '');

const isGlobal = (req) => isGlobalUserRole(req.user?.role?.Name || req.user?.role?.name || req.user?.role);

const fail = (res, status, message, code) =>
  res.status(status).json({ success: false, error: code || 'invalid_view', message });

/**
 * Validate and normalise a view payload. Anything unknown is dropped rather
 * than stored, so a stale client cannot grow the row without bound — and a
 * filter the server later learns to interpret still round-trips untouched
 * because filter *values* are opaque here (only the count and key length are
 * checked).
 */
const sanitizeView = (payload = {}) => {
  const name = String(payload.name || '').trim();
  if (!name) return { ok: false, message: 'A view name is required' };
  if (name.length > MAX_NAME_LENGTH) return { ok: false, message: `View name must be ${MAX_NAME_LENGTH} characters or fewer` };

  const rawFilters = payload.filters;
  let filters = {};
  if (rawFilters && typeof rawFilters === 'object' && !Array.isArray(rawFilters)) {
    const entries = Object.entries(rawFilters).filter(([key]) => typeof key === 'string' && key.length <= 64);
    if (entries.length > MAX_FILTERS) return { ok: false, message: `A view can hold at most ${MAX_FILTERS} filters` };
    filters = Object.fromEntries(entries.filter(([, value]) => value !== undefined));
  }

  const search = payload.search === undefined || payload.search === null ? '' : String(payload.search);
  if (search.length > MAX_SEARCH_LENGTH) return { ok: false, message: `Search text must be ${MAX_SEARCH_LENGTH} characters or fewer` };

  const columns = Array.isArray(payload.columns)
    ? payload.columns.filter((c) => typeof c === 'string' && c.length > 0 && c.length <= 64).slice(0, MAX_COLUMNS)
    : [];

  const sortBy = typeof payload.sortBy === 'string' && payload.sortBy.length <= 50 ? payload.sortBy : 'CreatedAt';
  const sortOrder = String(payload.sortOrder || '').toLowerCase() === 'asc' ? 'asc' : 'desc';
  const view = ALLOWED_MODES.has(payload.view) ? payload.view : 'asins';

  return {
    ok: true,
    value: { name, isShared: payload.isShared === true, view: { view, filters, search, sortBy, sortOrder, columns } },
  };
};

const parseViewJson = (raw) => {
  if (!raw) return { view: 'asins', filters: {}, search: '', sortBy: 'CreatedAt', sortOrder: 'desc', columns: [] };
  try {
    return typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch (err) {
    return { view: 'asins', filters: {}, search: '', sortBy: 'CreatedAt', sortOrder: 'desc', columns: [] };
  }
};

const mapView = (row) => ({
  id: row.Id,
  name: row.Name,
  isShared: row.IsShared === true || row.IsShared === 1,
  updatedAt: row.UpdatedAt || null,
  view: parseViewJson(row.ViewJson),
});

/** GET /api/asins/views — own + shared, newest first. */
exports.listViews = async (req, res) => {
  try {
    const pool = await getPool();
    const userId = userIdOf(req);
    const result = await pool.request()
      .input('userId', sql.VarChar, userId)
      .query(`
        SELECT Id, Name, OwnerId, IsShared, ViewJson, UpdatedAt
        FROM AsinSavedViews WITH (NOLOCK)
        WHERE OwnerId = @userId OR IsShared = 1
        ORDER BY UpdatedAt DESC
      `);

    const views = result.recordset.map((row) => ({
      ...mapView(row),
      isOwner: isGlobal(req) || String(row.OwnerId || '') === userId,
      ownerId: row.OwnerId || null,
    }));
    res.json({ success: true, views });
  } catch (error) {
    console.error('listViews Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

/** POST /api/asins/views */
exports.createView = async (req, res) => {
  try {
    const payload = sanitizeView(req.body || {});
    if (!payload.ok) return fail(res, 400, payload.message);

    const pool = await getPool();
    const userId = userIdOf(req);

    const countResult = await pool.request()
      .input('userId', sql.VarChar, userId)
      .query('SELECT COUNT(*) as total FROM AsinSavedViews WHERE OwnerId = @userId');
    const total = (countResult.recordset[0] && countResult.recordset[0].total) || 0;
    if (total >= MAX_VIEWS_PER_USER) {
      return fail(res, 400, `You already have ${MAX_VIEWS_PER_USER} views — delete one first`, 'too_many_views');
    }

    const id = generateId();
    await pool.request()
      .input('id', sql.VarChar, id)
      .input('name', sql.NVarChar, payload.value.name)
      .input('ownerId', sql.VarChar, userId)
      .input('isShared', sql.Bit, payload.value.isShared ? 1 : 0)
      .input('viewJson', sql.NVarChar(sql.MAX), JSON.stringify(payload.value.view))
      .query(`
        INSERT INTO AsinSavedViews (Id, Name, OwnerId, IsShared, ViewJson, CreatedAt, UpdatedAt)
        VALUES (@id, @name, @ownerId, @isShared, @viewJson, dbo.GetEnvDate(), dbo.GetEnvDate())
      `);

    res.status(201).json({ success: true, view: { id, name: payload.value.name, isShared: payload.value.isShared, isOwner: true, view: payload.value.view } });
  } catch (error) {
    console.error('createView Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

/** PUT /api/asins/views/:id — owner (or a global role) only. */
exports.updateView = async (req, res) => {
  try {
    const pool = await getPool();
    const userId = userIdOf(req);
    const existing = await pool.request()
      .input('id', sql.VarChar, req.params.id)
      .query('SELECT Id, Name, OwnerId, IsShared, ViewJson FROM AsinSavedViews WHERE Id = @id');
    const row = existing.recordset[0];
    if (!row) return fail(res, 404, 'View not found', 'view_not_found');
    if (!isGlobal(req) && String(row.OwnerId || '') !== userId) {
      return fail(res, 403, 'Only the owner can change this view', 'not_view_owner');
    }

    // A rename-only request is allowed: fall back to the stored values.
    const merged = {
      name: req.body?.name !== undefined ? req.body.name : row.Name,
      isShared: req.body?.isShared !== undefined ? req.body.isShared === true : (row.IsShared === true || row.IsShared === 1),
      ...parseViewJson(row.ViewJson),
      ...(req.body?.view || {}),
    };
    const payload = sanitizeView(merged);
    if (!payload.ok) return fail(res, 400, payload.message);

    await pool.request()
      .input('id', sql.VarChar, req.params.id)
      .input('name', sql.NVarChar, payload.value.name)
      .input('isShared', sql.Bit, payload.value.isShared ? 1 : 0)
      .input('viewJson', sql.NVarChar(sql.MAX), JSON.stringify(payload.value.view))
      .query(`
        UPDATE AsinSavedViews
        SET Name = @name, IsShared = @isShared, ViewJson = @viewJson, UpdatedAt = dbo.GetEnvDate()
        WHERE Id = @id
      `);

    res.json({ success: true, view: { id: req.params.id, name: payload.value.name, isShared: payload.value.isShared, isOwner: true, view: payload.value.view } });
  } catch (error) {
    console.error('updateView Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

/** DELETE /api/asins/views/:id — owner (or a global role) only. */
exports.deleteView = async (req, res) => {
  try {
    const pool = await getPool();
    const userId = userIdOf(req);
    const existing = await pool.request()
      .input('id', sql.VarChar, req.params.id)
      .query('SELECT Id, OwnerId FROM AsinSavedViews WHERE Id = @id');
    const row = existing.recordset[0];
    if (!row) return fail(res, 404, 'View not found', 'view_not_found');
    if (!isGlobal(req) && String(row.OwnerId || '') !== userId) {
      return fail(res, 403, 'Only the owner can delete this view', 'not_view_owner');
    }

    await pool.request()
      .input('id', sql.VarChar, req.params.id)
      .query('DELETE FROM AsinSavedViews WHERE Id = @id');

    res.json({ success: true, deletedId: req.params.id });
  } catch (error) {
    console.error('deleteView Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

/** GET /api/asins/column-preferences */
exports.getColumnPreferences = async (req, res) => {
  try {
    const pool = await getPool();
    const userId = userIdOf(req);
    const result = await pool.request()
      .input('userId', sql.VarChar, userId)
      .query('SELECT ColumnsJson FROM AsinColumnPreferences WHERE UserId = @userId');

    const row = result.recordset[0];
    let columns = null;
    if (row && row.ColumnsJson) {
      try {
        const parsed = JSON.parse(row.ColumnsJson);
        if (Array.isArray(parsed) && parsed.length > 0) columns = parsed.filter((c) => typeof c === 'string');
      } catch (err) {
        columns = null;
      }
    }
    res.json({ success: true, columns });
  } catch (error) {
    console.error('getColumnPreferences Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

/** PUT /api/asins/column-preferences */
exports.saveColumnPreferences = async (req, res) => {
  try {
    const columns = Array.isArray(req.body?.columns)
      ? req.body.columns.filter((c) => typeof c === 'string' && c.length > 0 && c.length <= 64).slice(0, MAX_COLUMNS)
      : null;
    if (!columns || columns.length === 0) {
      return fail(res, 400, 'A non-empty columns array is required');
    }

    const pool = await getPool();
    const userId = userIdOf(req);
    const columnsJson = JSON.stringify(columns);

    await pool.request()
      .input('id', sql.VarChar, generateId())
      .input('userId', sql.VarChar, userId)
      .input('columnsJson', sql.NVarChar(sql.MAX), columnsJson)
      .query(`
        MERGE AsinColumnPreferences AS target
        USING (SELECT @userId AS UserId) AS source
        ON target.UserId = source.UserId
        WHEN MATCHED THEN
          UPDATE SET ColumnsJson = @columnsJson, UpdatedAt = dbo.GetEnvDate()
        WHEN NOT MATCHED THEN
          INSERT (Id, UserId, ColumnsJson, CreatedAt, UpdatedAt)
          VALUES (@id, @userId, @columnsJson, dbo.GetEnvDate(), dbo.GetEnvDate());
      `);

    res.json({ success: true, columns });
  } catch (error) {
    console.error('saveColumnPreferences Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

exports._internal = { sanitizeView, parseViewJson, MAX_VIEWS_PER_USER };
