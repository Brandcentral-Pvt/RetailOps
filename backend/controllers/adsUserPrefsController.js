/**
 * Ads Intelligence — user preferences.
 *
 * GET    /api/ads/user-prefs   — get the caller's Ads UI preferences
 * PUT    /api/ads/user-prefs   — upsert the caller's Ads UI preferences
 *
 * Stored as a single JSON blob in UserAdsPreferences.UserId (PK).
 * Default preferences are returned when none are stored yet.
 */

const { sql, getPool, generateId } = require('../database/db');

const ok = (res, data, extra = {}) => res.json({ success: true, data, ...extra });
const fail = (res, status, code, message, details = {}) =>
  res.status(status).json({ success: false, code, message, ...details });

const DEFAULT_PREFS = {
  columns: ['asin', 'spend', 'sales', 'totalSales', 'acos', 'tacos', 'roas', 'orders', 'ctr', 'cvr', 'delta', 'trend'],
  pageSize: 50,
  sortBy: 'totalSales',
  sortOrder: 'desc',
  theme: 'light',
  density: 'compact',
  showSparkline: true,
  showDelta: true,
};

/** GET /api/ads/user-prefs */
exports.getUserPrefs = async (req, res) => {
  try {
    const userId = req.user?.Id || req.user?._id || req.userId;
    if (!userId) {
      return fail(res, 401, 'auth_required', 'Authentication required');
    }

    const pool = await getPool();
    const result = await pool.request()
      .input('userId', sql.VarChar, userId)
      .query(`
        SELECT Preferences
        FROM UserAdsPreferences
        WHERE UserId = @userId
      `);

    if (result.recordset.length === 0) {
      return ok(res, DEFAULT_PREFS);
    }

    const prefs = result.recordset[0].Preferences ? JSON.parse(result.recordset[0].Preferences) : {};
    return ok(res, { ...DEFAULT_PREFS, ...prefs });
  } catch (error) {
    console.error('[adsUserPrefsController.getUserPrefs]', error);
    return fail(res, 500, 'prefs_get_failed', error.message);
  }
};

/** PUT /api/ads/user-prefs */
exports.upsertUserPrefs = async (req, res) => {
  try {
    const userId = req.user?.Id || req.user?._id || req.userId;
    if (!userId) {
      return fail(res, 401, 'auth_required', 'Authentication required');
    }

    const { preferences } = req.body;
    if (!preferences || typeof preferences !== 'object') {
      return fail(res, 400, 'preferences_required', 'Preferences object is required.');
    }

    const merged = { ...DEFAULT_PREFS, ...preferences };
    const prefsJson = JSON.stringify(merged);

    const pool = await getPool();

    // Upsert: UserId is the PK.
    await pool.request()
      .input('userId', sql.VarChar, userId)
      .input('preferences', sql.NVarChar, prefsJson)
      .query(`
        MERGE UserAdsPreferences AS target
        USING (SELECT @userId AS UserId) AS source
          ON target.UserId = source.UserId
        WHEN MATCHED THEN
          UPDATE SET Preferences = @preferences, UpdatedAt = dbo.GetEnvDate()
        WHEN NOT MATCHED THEN
          INSERT (UserId, Preferences, UpdatedAt)
          VALUES (@userId, @preferences, dbo.GetEnvDate());
      `);

    return ok(res, merged);
  } catch (error) {
    console.error('[adsUserPrefsController.upsertUserPrefs]', error);
    return fail(res, 500, 'prefs_upsert_failed', error.message);
  }
};
