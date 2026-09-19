/**
 * Keyword Research controller.
 *
 * Read-only surface over the Amazon Creators API plus our own catalog:
 *
 *   GET  /api/keywords/search        one keyword → products + market analytics + insights
 *   POST /api/keywords/batch-search  many keywords, parallel-safe, per-keyword analytics
 *   GET  /api/keywords/categories    search-index options
 *   GET  /api/keywords/meta          cache/threshold/permission metadata for the UI
 *   POST /api/keywords/export        server-rendered XLSX of whatever the UI is showing
 *
 * Every route is gated by `keywords_view`; export additionally needs
 * `keywords_export`. Seller scope is resolved once per request and applied to
 * every catalog read, so the "you sell this" flags can never leak another
 * seller's listings.
 */

const keywordResearchService = require('../services/keywordResearchService');
const analytics = require('../services/keywordAnalytics');
const keywordExportService = require('../services/keywordExportService');
const { getPool } = require('../database/db');
const { resolveSellerScope } = require('../utils/sellerScope');

const SORT_OPTIONS = [
    { value: 'Featured', label: 'Featured' },
    { value: 'Price:LowToHigh', label: 'Price: low to high' },
    { value: 'Price:HighToLow', label: 'Price: high to low' },
    { value: 'AvgCustomerReviews', label: 'Customer reviews' },
    { value: 'NewestArrivals', label: 'Newest arrivals' },
];

/** Does the caller hold a permission? (`requirePermission` already bypasses admin/super_admin.) */
function hasPermission(req, name) {
    const role = req.user?.role?.Name || req.user?.role?.name;
    if (role === 'admin' || role === 'super_admin') return true;
    return (req.user?.permissions || []).includes(name);
}

/** Build the upstream search parameters from a query/body bag. */
function buildParams(source = {}, { canRefresh = false } = {}) {
    const num = (v) => (v === undefined || v === null || v === '' ? undefined : Number(v));
    const wantsRefresh = source.refresh === 'true' || source.refresh === true;
    return {
        searchIndex: source.searchIndex && source.searchIndex !== 'All' ? source.searchIndex : undefined,
        brand: source.brand || undefined,
        minPrice: num(source.minPrice),
        maxPrice: num(source.maxPrice),
        minReviewsRating: num(source.minReviewsRating),
        minSavingPercent: num(source.minSavingPercent),
        availability: source.availability || undefined,
        condition: source.condition || undefined,
        sortBy: source.sortBy || undefined,
        itemCount: Math.min(Math.max(Number(source.itemCount) || 10, 1), 50),
        itemPage: Math.max(Number(source.itemPage) || 1, 1),
        marketplace: source.marketplace || 'www.amazon.in',
        // Bypassing the shared snapshot cache is a `keywords_manage` capability:
        // a forced refresh costs a paid upstream call for everyone.
        cache: wantsRefresh && canRefresh ? false : true,
    };
}

/** What this caller may do here — the UI hides buttons it cannot use. */
function capabilities(req) {
    return {
        canExport: hasPermission(req, 'keywords_export'),
        canManage: hasPermission(req, 'keywords_manage'),
    };
}

/**
 * Catalog lookup is best-effort: if the database is unreachable the research
 * surface still works, it just reports `catalog: null` instead of inventing a
 * "you sell this" flag.
 */
async function lookupCatalog(items, scope) {
    try {
        const pool = await getPool();
        const map = await analytics.fetchCatalogMatches(pool, (items || []).map((i) => i.asin), scope);
        return { map, error: null };
    } catch (error) {
        console.error('[KeywordController] Catalog lookup failed:', error.message);
        return { map: new Map(), error: error.message };
    }
}

/** Attach derived analytics, the catalog link and the insight list to a raw search result. */
async function enrich(raw, { keyword, scope }) {
    const market = analytics.computeMarketAnalytics(raw.items || [], {
        keyword,
        totalResultCount: raw.totalResultCount,
    });

    const { map, error } = await lookupCatalog(raw.items || [], scope);
    const catalog = analytics.linkCatalog(raw.items || [], map, market);
    const insights = analytics.buildInsights(market, catalog, { keyword });

    return {
        items: catalog.rows,
        market,
        catalog: { rows: catalog.rows, summary: catalog.summary, note: error },
        insights,
        raw: {
            totalResultCount: raw.totalResultCount ?? (raw.items || []).length,
            searchRefinements: raw.searchRefinements || null,
            itemPage: raw.itemPage,
            itemCount: raw.itemCount,
            cached: !!raw.cached,
            catalogAvailable: !error,
        },
    };
}

function sellerScopeOr403(req, res) {
    const scope = resolveSellerScope(req.user, req.query.sellerId || req.body?.sellerId);
    if (scope.denied) {
        res.status(403).json({
            success: false,
            code: 'forbidden_seller',
            error: 'You do not have access to the requested seller(s).',
            requestedSellers: scope.requested,
            assignedSellers: scope.allowed,
        });
        return null;
    }
    return scope;
}

exports.search = async (req, res) => {
    try {
        const scope = sellerScopeOr403(req, res);
        if (!scope) return undefined;

        const keywords = (req.query.keywords || '').trim();
        if (!keywords) {
            return res.status(400).json({ success: false, error: 'Keywords are required' });
        }

        const params = buildParams(req.query, { canRefresh: hasPermission(req, 'keywords_manage') });
        const raw = await keywordResearchService.searchItems({ ...params, keywords });
        const enriched = await enrich(raw, { keyword: keywords, scope });

        return res.json({
            success: true,
            keyword: keywords,
            ...enriched,
            scope: { isGlobal: scope.isGlobal, sellerIds: scope.sellerIds },
            capabilities: capabilities(req),
        });
    } catch (error) {
        console.error('[KeywordController] Search error:', error.message);
        return res.status(502).json({ success: false, error: error.message });
    }
};

exports.batchSearch = async (req, res) => {
    try {
        const scope = sellerScopeOr403(req, res);
        if (!scope) return undefined;

        const { keywords: keywordsStr } = req.body || {};
        if (!keywordsStr || !String(keywordsStr).trim()) {
            return res.status(400).json({ success: false, error: 'Keywords are required' });
        }

        const keywordsArray = [...new Set(String(keywordsStr).split('\n').map((k) => k.trim()).filter(Boolean))];
        if (keywordsArray.length === 0) {
            return res.status(400).json({ success: false, error: 'At least one keyword is required' });
        }
        if (keywordsArray.length > 20) {
            return res.status(400).json({ success: false, error: 'Maximum 20 keywords per batch — the API allows one call per 1.1s, so send longer lists in chunks.' });
        }

        const params = buildParams(req.body, { canRefresh: hasPermission(req, 'keywords_manage') });
        const batch = await keywordResearchService.batchSearchItems(keywordsArray, params);

        // One catalog read for every ASIN across the whole batch.
        const allItems = batch.results.flatMap((r) => r.items || []);
        const { map, error } = await lookupCatalog(allItems, scope);

        const results = batch.results.map((r) => {
            const market = analytics.computeMarketAnalytics(r.items || [], {
                keyword: r.keyword,
                totalResultCount: r.totalResultCount,
            });
            const catalog = analytics.linkCatalog(r.items || [], map, market);
            return {
                keyword: r.keyword,
                error: r.error || null,
                items: catalog.rows,
                market,
                catalog: { rows: catalog.rows, summary: catalog.summary, note: error },
                insights: analytics.buildInsights(market, catalog, { keyword: r.keyword }),
                raw: {
                    totalResultCount: r.totalResultCount ?? (r.items || []).length,
                    cached: !!r.cached,
                    catalogAvailable: !error,
                },
            };
        });

        return res.json({
            success: true,
            results,
            totalKeywords: results.length,
            meta: { ...batch.meta, catalogAvailable: !error },
            scope: { isGlobal: scope.isGlobal, sellerIds: scope.sellerIds },
            capabilities: capabilities(req),
        });
    } catch (error) {
        console.error('[KeywordController] Batch search error:', error.message);
        return res.status(502).json({ success: false, error: error.message });
    }
};

exports.getCategories = async (req, res) => {
    const categories = [
        { value: 'All', label: 'All Categories' },
        { value: 'Automotive', label: 'Automotive' },
        { value: 'Baby', label: 'Baby' },
        { value: 'Beauty', label: 'Beauty' },
        { value: 'Books', label: 'Books' },
        { value: 'Clothing', label: 'Clothing & Accessories' },
        { value: 'Electronics', label: 'Electronics' },
        { value: 'Grocery', label: 'Grocery & Gourmet Foods' },
        { value: 'HealthPersonalCare', label: 'Health & Personal Care' },
        { value: 'HomeAndKitchen', label: 'Home & Kitchen' },
        { value: 'Industrial', label: 'Industrial & Scientific' },
        { value: 'Jewelry', label: 'Jewelry' },
        { value: 'Kitchen', label: 'Kitchen' },
        { value: 'LawnAndGarden', label: 'Lawn & Garden' },
        { value: 'Luggage', label: 'Luggage & Travel Gear' },
        { value: 'Music', label: 'Music' },
        { value: 'MusicalInstruments', label: 'Musical Instruments' },
        { value: 'OfficeProducts', label: 'Office Products' },
        { value: 'PetSupplies', label: 'Pet Supplies' },
        { value: 'Shoes', label: 'Shoes' },
        { value: 'Software', label: 'Software' },
        { value: 'Sports', label: 'Sports & Outdoors' },
        { value: 'Tools', label: 'Tools & Home Improvement' },
        { value: 'Toys', label: 'Toys & Games' },
        { value: 'VideoGames', label: 'Video Games' },
        { value: 'Watches', label: 'Watches' },
    ];
    res.json({ success: true, categories });
};

/** Metadata the UI needs to render filters, thresholds and cache state honestly. */
exports.getMeta = async (req, res) => {
    const scope = sellerScopeOr403(req, res);
    if (!scope) return undefined;

    return res.json({
        success: true,
        sortOptions: SORT_OPTIONS,
        conditions: [
            { value: 'New', label: 'New' },
            { value: 'Used', label: 'Used' },
            { value: 'Renewed', label: 'Renewed' },
        ],
        availability: [
            { value: 'Available', label: 'Available' },
            { value: 'IncludeOutOfStock', label: 'Include out of stock' },
        ],
        limits: {
            batchMax: 20,
            itemCountMax: 50,
            rateLimitMs: keywordResearchService._config?.requestDelay ?? 1100,
        },
        cache: keywordResearchService.getCacheStats(),
        scope: { isGlobal: scope.isGlobal, sellerIds: scope.sellerIds },
        capabilities: capabilities(req),
    });
};

/** Server-rendered XLSX of exactly what the caller is looking at. */
exports.exportResults = async (req, res) => {
    try {
        const scope = sellerScopeOr403(req, res);
        if (!scope) return undefined;

        const { kind = 'single', dataset, label } = req.body || {};
        if (!dataset || typeof dataset !== 'object') {
            return res.status(400).json({ success: false, error: 'Nothing to export — run a search first.' });
        }

        const workbook = await keywordExportService.buildWorkbook({ kind, dataset, label, scope });
        const fileName = keywordExportService.fileName({ kind, label });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        res.setHeader('Content-Length', workbook.length);
        return res.end(workbook);
    } catch (error) {
        console.error('[KeywordController] Export error:', error.message);
        return res.status(500).json({ success: false, error: error.message });
    }
};

/** `keywords_manage`: drop every cached snapshot (e.g. after a data-quality fix). */
exports.clearCache = async (req, res) => {
    const removed = keywordResearchService.clearCache();
    return res.json({ success: true, removed, cache: keywordResearchService.getCacheStats() });
};
