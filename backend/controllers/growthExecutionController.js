const { isGlobalUserRole } = require('../utils/roleUtils');
const { sql, getPool } = require('../database/db');
const { buildInClause } = require('../utils/sqlHelpers');

/**
 * Growth Execution Engine controller
 *
 * ✅ Overhauled: previously these endpoints queried the legacy `Actions` table
 * with raw PascalCase rows and NO seller scoping — every brand manager could
 * read other managers' data (authorization gap), and the dashboard received a
 * different row shape than the Tasks API. Now everything:
 *   - reads the real `Tasks` / `GmsTargets` tables,
 *   - is seller-scoped via isGlobalUserRole + buildInClause,
 *   - returns normalized camelCase payloads.
 */

// Resolve the caller's seller scope from the authenticated user.
const getSellerScope = (req) => {
    const roleName = req.user?.role?.name || req.user?.role || '';
    const isGlobalUser = isGlobalUserRole(roleName);
    const assignedSellers = (req.user?.assignedSellers || [])
        .map(s => (typeof s === 'string' ? s : s._id || s.Id || s)?.toString())
        .filter(Boolean);
    return { isGlobalUser, assignedSellers };
};

// Restrict the query to the caller's assigned sellers unless global.
// Returns a SQL fragment ('' for global users) and binds params on `request`.
const applySellerScope = (request, scope, { required = false } = {}) => {
    const { isGlobalUser, assignedSellers } = scope;
    if (isGlobalUser) return '';

    if (assignedSellers.length === 0) {
        // Non-global user with no sellers: must see nothing at all.
        request.input('scopeNoSeller', sql.VarChar, '00000000-0000-0000-0000-000000000000');
        return ' AND t.SellerId = @scopeNoSeller';
    }
    const inClause = buildInClause(request, 'scopeSeller', assignedSellers);
    return ` AND t.SellerId IN (${inClause})`;
};

// Optional explicit sellerId filter (may be a comma-separated list).
const applySellerIdFilter = (request, sellerId) => {
    if (!sellerId || sellerId === 'all') return '';
    const ids = String(sellerId).split(',').map(s => s.trim()).filter(Boolean);
    if (ids.length === 0) return '';
    if (ids.length === 1) {
        request.input('filterSellerId', sql.VarChar, ids[0]);
        return ' AND t.SellerId = @filterSellerId';
    }
    const inClause = buildInClause(request, 'filterSeller', ids);
    return ` AND t.SellerId IN (${inClause})`;
};

/**
 * Get current goal
 * GET /api/goals/current
 */
exports.getCurrentGoal = async (req, res) => {
    try {
        const pool = await getPool();
        const scope = getSellerScope(req);
        const request = pool.request();

        let whereClause = 'WHERE 1=1';
        whereClause += applySellerScope(request, scope);
        whereClause += applySellerIdFilter(request, req.query.sellerId);

        const { goalType } = req.query;
        if (goalType && goalType !== 'all') {
            request.input('goalType', sql.NVarChar, goalType);
            whereClause += ' AND UPPER(t.GoalType) = UPPER(@goalType)';
        }

        const result = await request.query(`
            SELECT TOP 1
                t.Id, t.SellerId, t.BrandManager, t.UserId, t.TargetType,
                t.Year, t.Month, t.TotalTargetValue, t.GoalType, t.CreatedAt, t.UpdatedAt,
                s.Name AS SellerName
            FROM GmsTargets t
            LEFT JOIN Sellers s ON t.SellerId = s.Id
            ${whereClause}
            ORDER BY t.Year DESC, t.Month DESC, t.CreatedAt DESC
        `);

        const row = result.recordset[0];
        res.json({
            success: true,
            data: row ? {
                id: row.Id,
                sellerId: row.SellerId,
                sellerName: row.SellerName,
                brandManager: row.BrandManager,
                userId: row.UserId,
                targetType: row.TargetType,
                year: row.Year,
                month: row.Month,
                totalTargetValue: row.TotalTargetValue,
                goalType: row.GoalType || 'GMS',
                createdAt: row.CreatedAt,
                updatedAt: row.UpdatedAt,
            } : null
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Get performance analytics
 * GET /api/analytics/performance
 */
exports.getPerformanceAnalytics = async (req, res) => {
    try {
        const { timeframe = '30d' } = req.query;
        const days = parseInt(timeframe) || 30;
        const pool = await getPool();
        const scope = getSellerScope(req);
        const request = pool.request();

        let whereClause = 'WHERE a.CreatedAt >= DATEADD(DAY, -@tf, dbo.GetEnvDate())';
        request.input('tf', sql.Int, days);

        // Seller scope + optional filter (Asins aliased as `a`)
        const { isGlobalUser, assignedSellers } = scope;
        if (!isGlobalUser) {
            if (assignedSellers.length === 0) {
                return res.json({
                    success: true,
                    data: { totalAsins: 0, totalSellers: 0, totalAdSales: 0, totalAdSpend: 0, timeframeDays: days }
                });
            }
            const inClause = buildInClause(request, 'scopeSeller', assignedSellers);
            whereClause += ` AND a.SellerId IN (${inClause})`;
        }
        if (req.query.sellerId && req.query.sellerId !== 'all') {
            request.input('filterSellerId', sql.VarChar, req.query.sellerId);
            whereClause += ' AND a.SellerId = @filterSellerId';
        }

        const result = await request.query(`
            SELECT
                COUNT(*) as totalAsins,
                COUNT(DISTINCT a.SellerId) as totalSellers
            FROM Asins a
            ${whereClause}
        `);

        const stats = result.recordset[0] || { totalAsins: 0, totalSellers: 0 };
        res.json({
            success: true,
            data: {
                totalAsins: stats.totalAsins || 0,
                totalSellers: stats.totalSellers || 0,
                timeframeDays: days,
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Get intelligence insights
 * GET /api/insights
 */
exports.getIntelligenceInsights = async (req, res) => {
    try {
        const pool = await getPool();
        const scope = getSellerScope(req);
        const { isGlobalUser, assignedSellers } = scope;

        const buildScopedQuery = (table, extraWhere = '') => {
            const request = pool.request();
            let where = 'WHERE 1=1';
            if (!isGlobalUser) {
                if (assignedSellers.length === 0) {
                    request.input('scopeNoSeller', sql.VarChar, '00000000-0000-0000-0000-000000000000');
                    where += ' AND SellerId = @scopeNoSeller';
                } else {
                    const inClause = buildInClause(request, 'scopeSeller', assignedSellers);
                    where += ` AND SellerId IN (${inClause})`;
                }
            }
            if (req.query.sellerId && req.query.sellerId !== 'all') {
                request.input('filterSellerId', sql.VarChar, req.query.sellerId);
                where += ' AND SellerId = @filterSellerId';
            }
            where += extraWhere;
            return request.query(`SELECT COUNT(*) as count FROM ${table} ${where}`);
        };

        const [sellersResult, asinsResult, tasksResult] = await Promise.all([
            buildScopedQuery('Sellers', ' AND IsActive = 1'),
            buildScopedQuery('Asins'),
            buildScopedQuery('Tasks', " AND Status NOT IN ('Completed')"),
        ]);

        res.json({
            success: true,
            data: {
                totalActiveSellers: sellersResult.recordset[0]?.count || 0,
                totalAsins: asinsResult.recordset[0]?.count || 0,
                pendingActions: tasksResult.recordset[0]?.count || 0,
                lastUpdated: new Date()
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
