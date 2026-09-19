/**
 * AI keyword analysis.
 *
 * Behaviour is deliberately unchanged: pressing Analyze sends the seed
 * keyword's top products to the LLM and falls back to word frequency if the
 * model is unavailable (see docs/ads-module-deep-dive.md for the same pattern
 * on the ads side). What is new is that the *same* product set also gets the
 * deterministic treatment — market statistics, catalog flags and the rule-based
 * insight list — so the tab shows measurable facts next to model output instead
 * of asking the reader to trust the model alone.
 */

const keywordAnalysisService = require('../services/keywordAnalysisService');
const analytics = require('../services/keywordAnalytics');
const { getPool } = require('../database/db');
const { resolveSellerScope } = require('../utils/sellerScope');

exports.analyze = async (req, res) => {
    try {
        const scope = resolveSellerScope(req.user, req.query.sellerId || req.body?.sellerId);
        if (scope.denied) {
            return res.status(403).json({
                success: false,
                code: 'forbidden_seller',
                error: 'You do not have access to the requested seller(s).',
                requestedSellers: scope.requested,
                assignedSellers: scope.allowed,
            });
        }

        const { keyword, itemCount } = req.query;
        if (!keyword || !keyword.trim()) {
            return res.status(400).json({ success: false, error: 'Keyword is required' });
        }

        const seed = keyword.trim();
        const canRefresh = (req.user?.permissions || []).includes('keywords_manage')
            || ['admin', 'super_admin'].includes(req.user?.role?.Name || req.user?.role?.name);

        const result = await keywordAnalysisService.analyze({
            keyword: seed,
            itemCount: Math.min(Math.max(Number(itemCount) || 10, 5), 20),
            searchIndex: req.query.searchIndex && req.query.searchIndex !== 'All' ? req.query.searchIndex : undefined,
            brand: req.query.brand || undefined,
            minPrice: req.query.minPrice ? Number(req.query.minPrice) : undefined,
            maxPrice: req.query.maxPrice ? Number(req.query.maxPrice) : undefined,
            minReviewsRating: req.query.minReviewsRating ? Number(req.query.minReviewsRating) : undefined,
            sortBy: req.query.sortBy || 'Featured',
            marketplace: req.query.marketplace || 'www.amazon.in',
            cache: !(req.query.refresh === 'true' && canRefresh),
        });

        const items = result.items || [];
        const market = analytics.computeMarketAnalytics(items, { keyword: seed, totalResultCount: items.length });

        let catalog = { rows: items, summary: null, note: null };
        try {
            const pool = await getPool();
            const map = await analytics.fetchCatalogMatches(pool, items.map((i) => i.asin), scope);
            const linked = analytics.linkCatalog(items, map, market);
            catalog = { rows: linked.rows, summary: linked.summary, note: null };
        } catch (error) {
            console.error('[KW Analysis Controller] Catalog lookup failed:', error.message);
            catalog = { rows: items, summary: null, note: error.message };
        }

        return res.json({
            success: true,
            keyword: seed,
            analysis: result.analysis,
            products: result.products || [],
            items: catalog.rows,
            market,
            catalog,
            insights: analytics.buildInsights(market, catalog, { keyword: seed }),
            source: result.source || 'llm',
            cached: !!result.cached,
            message: result.message || null,
            scope: { isGlobal: scope.isGlobal, sellerIds: scope.sellerIds },
        });
    } catch (error) {
        console.error('[KW Analysis Controller] Error:', error.message);
        return res.status(502).json({ success: false, error: error.message });
    }
};
