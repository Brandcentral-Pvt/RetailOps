/**
 * Keyword Research — unit tests.
 *
 * Covers the four pieces this upgrade added around the existing live-API call:
 *   1. keywordAnalytics  — pure maths, catalog linking, rule-based insights
 *   2. research service  — snapshot cache + parallel-safe 1.1s scheduler
 *   3. keyword controller — seller scope, enrichment, export gating
 *   4. XLSX export       — workbook actually parses back with the right sheets
 *
 * The database is mocked with the shared fakePool, so no SQL Server is needed.
 */

let mockPool = null;

jest.mock('../../database/db', () => {
    const { FAKE_SQL } = require('../../testUtils/fakePool');
    return {
        sql: FAKE_SQL,
        getPool: async () => mockPool,
        generateId: () => 'kw-gen-id',
    };
});

const { makeFakePool } = require('../../testUtils/fakePool');
const analytics = require('../../services/keywordAnalytics');
const research = require('../../services/keywordResearchService');
const keywordController = require('../../controllers/keywordController');
const keywordExport = require('../../services/keywordExportService');

/* ────────────────────────────── fixtures ────────────────────────────── */

const product = (over = {}) => ({
    asin: `B0${String(over.i ?? 1).padStart(8, '0')}`,
    title: 'Stainless Steel Insulated Water Bottle 1 Litre Leak Proof',
    parentAsin: null,
    price: 500,
    mrp: 999,
    discountPercent: 50,
    currency: 'INR',
    rating: 4.2,
    reviewCount: 100,
    mainBSR: 12000,
    subBSR: 40,
    mainImage: 'https://img/1.jpg',
    availability: 'IN_STOCK',
    detailPageURL: 'https://amazon.in/dp/B0TEST',
    brand: 'AquaPro',
    manufacturer: 'AquaPro Industries',
    seller: 'AquaPro Retail',
    sellerId: 'A1SELLER',
    isBuyBoxWinner: true,
    condition: 'New',
    category: 'Home & Kitchen',
    browseNodeId: '1234',
    color: 'Silver',
    size: '1 L',
    bulletPoints: ['Leak proof', 'BPA free'],
    score: 0.9,
    ...over,
});

/** 12 listings: an entrenched review leader, a mid pack and two weak listings. */
const MARKET_FIXTURE = [
    product({ i: 1, asin: 'B0LEADER001', title: 'Stainless Steel Insulated Water Bottle 1 Litre Leak Proof Steel', price: 899, mrp: 1499, discountPercent: 40, rating: 4.6, reviewCount: 9000, mainBSR: 900, brand: 'Milton', seller: 'Milton Store', sellerId: 'A1MILTON', isBuyBoxWinner: true }),
    product({ i: 2, asin: 'B0RIVAL0002', title: 'Insulated Water Bottle Steel 1000 ml Leak Proof Flask', price: 749, mrp: 1299, discountPercent: 42, rating: 4.5, reviewCount: 4200, mainBSR: 1800, brand: 'Cello', seller: 'Cello Official', sellerId: 'A1CELLO' }),
    product({ i: 3, asin: 'B0RIVAL0003', title: 'Steel Water Bottle Insulated 1 Litre Office Flask', price: 649, mrp: 999, discountPercent: 35, rating: 4.4, reviewCount: 2600, mainBSR: 2600, brand: 'Borosil', seller: 'Borosil Store', sellerId: 'A1BOROSIL' }),
    product({ i: 4, asin: 'B0MID000004', title: 'Water Bottle Stainless Steel 750 ml Gym Flask', price: 449, mrp: 799, discountPercent: 44, rating: 4.1, reviewCount: 900, mainBSR: 7800, brand: 'AquaPro', seller: 'AquaPro Retail', sellerId: 'A1AQUA' }),
    product({ i: 5, asin: 'B0MID000005', title: 'Insulated Bottle 1 Litre Travel Flask Steel', price: 399, mrp: 699, discountPercent: 43, rating: 4.0, reviewCount: 640, mainBSR: 9500, brand: 'AquaPro', seller: 'AquaPro Retail', sellerId: 'A1AQUA' }),
    product({ i: 6, asin: 'B0MID000006', title: 'Steel Flask Water Bottle 1 L School Kids', price: 349, mrp: 599, discountPercent: 42, rating: 3.9, reviewCount: 410, mainBSR: 15000, brand: 'Vaya', seller: 'Vaya Lifestyle', sellerId: 'A1VAYA' }),
    product({ i: 7, asin: 'B0MID000007', title: 'Water Bottle Steel Insulated 500 ml Kids Flask', price: 299, mrp: 499, discountPercent: 40, rating: 3.8, reviewCount: 260, mainBSR: 22000, brand: 'Vaya', seller: 'Vaya Lifestyle', sellerId: 'A1VAYA' }),
    product({ i: 8, asin: 'B0WEAK00008', title: 'Bottle Water Steel Flask 1 Litre Blue', price: 249, mrp: 399, discountPercent: 38, rating: 3.4, reviewCount: 40, mainBSR: 41000, brand: 'Generic Co', seller: 'Generic Store', sellerId: 'A1GENERIC' }),
    product({ i: 9, asin: 'B0WEAK00009', title: 'Steel Water Bottle Flask 900 ml Unbranded', price: 199, mrp: 299, discountPercent: 33, rating: 3.2, reviewCount: 18, mainBSR: 68000, brand: null, seller: 'Generic Store', sellerId: 'A1GENERIC' }),
    product({ i: 10, asin: 'B0MID000010', title: 'Insulated Steel Bottle 1 Litre Matte Finish', price: 1099, mrp: 1799, discountPercent: 39, rating: 4.3, reviewCount: 1500, mainBSR: 5200, brand: 'Milton', seller: 'Milton Store', sellerId: 'A1MILTON' }),
    product({ i: 11, asin: 'B0MID000011', title: 'Thermosteel Flask Water Bottle 1 Litre Steel', price: 1299, mrp: 1999, discountPercent: 35, rating: 4.4, reviewCount: 2100, mainBSR: 3100, brand: 'Milton', seller: 'Milton Store', sellerId: 'A1MILTON' }),
    product({ i: 12, asin: 'B0AQUA00012', title: 'AquaPro Insulated Water Bottle 1 Litre Steel Flask', price: 559, mrp: 899, discountPercent: 38, rating: 4.2, reviewCount: 730, mainBSR: 6200, brand: 'AquaPro', seller: 'AquaPro Retail', sellerId: 'A1AQUA' }),
];

const catalogRow = (asin, over = {}) => ({
    AsinCode: asin,
    Sku: `SKU-${asin.slice(-3)}`,
    Title: 'AquaPro Insulated Water Bottle 1 Litre Steel Flask',
    Brand: 'AquaPro',
    Category: 'Home & Kitchen',
    SellerId: 'A1AQUA',
    SellerName: 'AquaPro Retail',
    Status: 'Active',
    StockLevel: 120,
    CurrentPrice: 599,
    BSR: 5100,
    Rating: 4.2,
    ReviewCount: 730,
    LQS: 82,
    BuyBoxWin: true,
    ParentAsin: null,
    ImageUrl: null,
    BulletPointsText: 'Leak proof BPA free insulated',
    UpdatedAt: new Date('2026-09-01'),
    ...over,
});

const catalogMap = (rows) => {
    const map = new Map();
    rows.forEach((row) => {
        const key = String(row.AsinCode);
        if (!map.has(key)) map.set(key, []);
        map.get(key).push(row);
    });
    return map;
};

/* ─────────────────────────── fake req/res ─────────────────────────── */

function fakeRes() {
    const res = {
        statusCode: 200,
        headers: {},
        body: null,
        ended: null,
        status(code) { this.statusCode = code; return this; },
        json(payload) { this.body = payload; return this; },
        setHeader(k, v) { this.headers[k.toLowerCase()] = v; return this; },
        end(buf) { this.ended = buf; return this; },
    };
    return res;
}

const user = (over = {}) => ({
    Id: 'user-1',
    role: { Name: 'brand_manager' },
    permissions: ['keywords_view', 'keywords_export'],
    assignedSellers: ['A1AQUA'],
    ...over,
});

/* ────────────────────────────── analytics ────────────────────────────── */

describe('keywordAnalytics.computeMarketAnalytics', () => {
    const market = analytics.computeMarketAnalytics(MARKET_FIXTURE, { keyword: 'steel water bottle', totalResultCount: 5000 });

    test('reports its own sample so the UI never over-claims', () => {
        expect(market.sample).toMatchObject({ products: 12, priced: 12, rated: 12, ranked: 12, totalResultCount: 5000 });
    });

    test('computes price statistics and bands from real values', () => {
        expect(market.price.median).toBe(504);          // (449 + 559) / 2 — median of the mid pair
        expect(market.price.min).toBe(199);
        expect(market.price.max).toBe(1299);
        expect(market.price.p25).toBe(299);   // nearest-rank p25 of 12 prices
        expect(market.price.bands).toHaveLength(6);
        expect(market.price.bands.reduce((s, b) => s + b.count, 0)).toBe(12);
        const crowded = [...market.price.bands].sort((a, b) => b.count - a.count)[0];
        expect(crowded.count).toBeGreaterThan(0);
        expect(crowded.share).toBeGreaterThan(0);
    });

    test('measures the review moat instead of guessing at competition', () => {
        expect(market.ratings.reviewMoat.top3Reviews).toBe(9000 + 4200 + 2600);
        // 15,800 of 22,398 reviews sit with the top three listings
        expect(market.ratings.reviewMoat.top3Share).toBeCloseTo(70.5, 1);
        expect(market.ratings.totalReviews).toBe(22398);
        expect(market.ratings.reviewMoat.leader.asin).toBe('B0LEADER001');
        expect(market.ratings.weakListingShare).toBeGreaterThan(30);
    });

    test('aggregates brands with share, HHI and review share', () => {
        expect(market.brands.unique).toBe(7);                       // Milton, Cello, Borosil, AquaPro, Vaya, Generic Co, (unbranded)
        const milton = market.brands.rows.find((b) => b.brand === 'Milton');
        expect(milton.count).toBe(3);
        expect(market.brands.topBrand.brand).toBe('Milton');
        expect(market.brands.hhi).toBeGreaterThan(0);
    });

    test('extracts repeated title terms and ignores boilerplate', () => {
        expect(market.terms.words.some((t) => t.term === 'steel')).toBe(true);
        expect(market.terms.words.some((t) => t.term === 'water')).toBe(true);
        expect(market.terms.bigrams.some((t) => t.term.includes('water bottle'))).toBe(true);
        expect(market.terms.words.every((t) => t.count > 1)).toBe(true);
        expect(market.terms.words.some((t) => ['the', 'and', 'with'].includes(t.term))).toBe(false);
    });

    test('scores opportunity deterministically with named components', () => {
        expect(market.opportunity.score).toBeGreaterThanOrEqual(0);
        expect(market.opportunity.score).toBeLessThanOrEqual(100);
        expect(['strong', 'workable', 'crowded', 'avoid']).toContain(market.opportunity.band);
        expect(Object.keys(market.opportunity.components)).toEqual(['demand', 'moat', 'concentration', 'listingQuality']);
        expect(analytics.computeMarketAnalytics(MARKET_FIXTURE, {}).opportunity.score).toBe(market.opportunity.score);
    });

    test('returns nulls rather than NaN on an empty result page', () => {
        const empty = analytics.computeMarketAnalytics([], { keyword: 'nothing' });
        expect(empty.sample.products).toBe(0);
        expect(empty.price.median).toBeNull();
        expect(empty.ratings.avg).toBeNull();
        expect(empty.opportunity.score).toBeNull();
        expect(empty.opportunity.band).toBe('unknown');
    });
});

describe('keywordAnalytics.linkCatalog', () => {
    const market = analytics.computeMarketAnalytics(MARKET_FIXTURE, { keyword: 'steel water bottle' });
    const rows = [catalogRow('B0AQUA00012'), catalogRow('B0MID000004', { SellerId: 'A1AQUA', SellerName: 'AquaPro Retail', CurrentPrice: 289 })];
    const linked = analytics.linkCatalog(MARKET_FIXTURE, catalogMap(rows), market);

    test('flags the listings we already sell', () => {
        const mine = linked.rows.filter((r) => r.inCatalog);
        expect(mine.map((r) => r.asin).sort()).toEqual(['B0AQUA00012', 'B0MID000004']);
        expect(linked.rows.find((r) => r.asin === 'B0LEADER001').inCatalog).toBe(false);
    });

    test('summarises coverage, best position and our sellers', () => {
        expect(linked.summary.matchedCount).toBe(2);
        expect(linked.summary.coveragePct).toBeCloseTo(16.7, 0);
        expect(linked.summary.bestPosition).toBe(4);         // B0MID000004 is 4th in the result list
        expect(linked.summary.sellers[0]).toMatchObject({ sellerId: 'A1AQUA', count: 2 });
    });

    test('computes price deltas against the market median', () => {
        const mine = linked.rows.find((r) => r.asin === 'B0MID000004').ourListings[0];
        expect(mine.price).toBe(289);
        expect(mine.priceVsMarketMedianPct).toBeLessThan(0);   // cheaper than the market median
        expect(linked.summary.avgPriceVsMarketPct).not.toBeNull();
    });

    test('lists market terms missing from our own title', () => {
        const mine = linked.rows.find((r) => r.asin === 'B0AQUA00012').ourListings[0];
        // our title repeats the market phrasing, so at least one gap is expected
        expect(Array.isArray(mine.missingTerms)).toBe(true);
    });

    test('never invents a match when the catalog is empty', () => {
        const none = analytics.linkCatalog(MARKET_FIXTURE, new Map(), market);
        expect(none.summary.matchedCount).toBe(0);
        expect(none.summary.coveragePct).toBe(0);
        expect(none.rows.every((r) => r.inCatalog === false)).toBe(true);
    });
});

describe('keywordAnalytics.buildInsights', () => {
    test('warns when the sample is too thin to trust', () => {
        const market = analytics.computeMarketAnalytics(MARKET_FIXTURE.slice(0, 3), { keyword: 'thin' });
        const { insights } = analytics.buildInsights(market, { rows: [], summary: { matchedCount: 0 } }, { keyword: 'thin' });
        expect(insights[0].id).toBe('thin-sample');
        expect(insights[0].tone).toBe('warn');
    });

    test('reports the review moat, brand dominance and the catalog position', () => {
        const market = analytics.computeMarketAnalytics(MARKET_FIXTURE, { keyword: 'steel water bottle' });
        const catalog = analytics.linkCatalog(MARKET_FIXTURE, catalogMap([catalogRow('B0AQUA00012', { CurrentPrice: 899 })]), market);
        const result = analytics.buildInsights(market, catalog, { keyword: 'steel water bottle' });

        const ids = result.insights.map((i) => i.id);
        expect(ids).toContain('review-moat');
        expect(ids).toContain('catalog-present');
        expect(ids).toContain('price-above-market');
        expect(result.insights.every((i) => i.title && i.detail && i.tone)).toBe(true);
        expect(result.counts.pos + result.counts.neg + result.counts.warn + result.counts.info).toBe(result.insights.length);
        expect(result.headline).toBe(result.insights[0].title);
    });

    test('tells you when none of your sellers rank for the keyword', () => {
        const market = analytics.computeMarketAnalytics(MARKET_FIXTURE, { keyword: 'steel water bottle' });
        const catalog = analytics.linkCatalog(MARKET_FIXTURE, new Map(), market);
        const result = analytics.buildInsights(market, catalog, { keyword: 'steel water bottle' });
        expect(result.insights.map((i) => i.id)).toContain('catalog-absent');
    });

    test('is pure — same inputs, same output', () => {
        const market = analytics.computeMarketAnalytics(MARKET_FIXTURE, {});
        const catalog = analytics.linkCatalog(MARKET_FIXTURE, catalogMap([catalogRow('B0AQUA00012')]), market);
        const a = analytics.buildInsights(market, catalog, { keyword: 'k' });
        const b = analytics.buildInsights(market, catalog, { keyword: 'k' });
        expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    });
});

describe('keywordAnalytics.fetchCatalogMatches', () => {
    beforeEach(() => {
        mockPool = makeFakePool([
            { match: /FROM Asins/, rows: () => [catalogRow('B0AQUA00012')] },
        ]);
    });

    test('joins our catalog to Sellers and keys the result by ASIN', async () => {
        const map = await analytics.fetchCatalogMatches(mockPool, ['B0AQUA00012'], { isGlobal: true, sellerIds: [], unrestricted: true });
        const query = mockPool.callWhere(/FROM Asins/);
        expect(query.sql).toMatch(/LEFT JOIN Sellers s ON s\.Id = a\.SellerId/);
        expect(query.sql).not.toMatch(/a\.SellerId IN/);
        expect(map.get('B0AQUA00012')).toHaveLength(1);
    });

    test('restricts the read to the caller\'s sellers', async () => {
        await analytics.fetchCatalogMatches(mockPool, ['B0AQUA00012'], { isGlobal: false, sellerIds: ['A1AQUA', 'A1MILTON'], unrestricted: false });
        const query = mockPool.callWhere(/FROM Asins/);
        expect(query.sql).toMatch(/AND a\.SellerId IN \(@kwScope_0, @kwScope_1\)/);
        expect(query.inputs.kwScope_0).toBe('A1AQUA');
        expect(query.inputs.kwScope_1).toBe('A1MILTON');
    });

    test('fails closed for a user with no assigned sellers', async () => {
        await analytics.fetchCatalogMatches(mockPool, ['B0AQUA00012'], { isGlobal: false, sellerIds: [], unrestricted: false });
        expect(mockPool.callWhere(/FROM Asins/).sql).toMatch(/AND 1 = 0/);
    });

    test('chunks large ASIN sets and does nothing for an empty one', async () => {
        const asins = Array.from({ length: 450 }, (_, i) => `B0CHUNK${String(i).padStart(5, '0')}`);
        await analytics.fetchCatalogMatches(mockPool, asins, { isGlobal: true, sellerIds: [], unrestricted: true });
        expect(mockPool.callsWhere(/FROM Asins/)).toHaveLength(3);   // 200 + 200 + 50

        mockPool.calls.length = 0;
        const empty = await analytics.fetchCatalogMatches(mockPool, [], { isGlobal: true, sellerIds: [], unrestricted: true });
        expect(empty.size).toBe(0);
        expect(mockPool.calls).toHaveLength(0);
    });
});

/* ───────────────────────────── research service ───────────────────────────── */

describe('keywordResearchService cache', () => {
    let apiCalls;

    beforeEach(() => {
        jest.spyOn(require('../../services/creatorsApiCredentials'), 'get').mockReturnValue({
            clientId: 'test-client', clientSecret: 'test-secret', version: 'v1', partnerTag: 'test-tag',
        });
        research.clearCache();
        apiCalls = [];
        research._getSdkApi = () => ({
            searchItems: async (marketplace, payload) => {
                apiCalls.push(payload.searchItemsRequestContent.keywords);
                return {
                    searchResult: {
                        totalResultCount: 1,
                        items: [{
                            asin: 'B0CACHED001',
                            itemInfo: { title: { displayValue: 'Cached product' } },
                            offersV2: { listings: [{ price: { money: { amount: 100, currency: 'INR' } }, isBuyBoxWinner: true }] },
                            customerReviews: { count: 5, starRating: 4 },
                        }],
                    },
                };
            },
        });
    });

    test('serves a repeat search from the snapshot cache', async () => {
        const first = await research.searchItems({ keywords: 'bottle', itemCount: 10 });
        const second = await research.searchItems({ keywords: 'bottle', itemCount: 10 });
        expect(apiCalls).toHaveLength(1);
        expect(first.cached).toBe(false);
        expect(second.cached).toBe(true);
        expect(second.items).toHaveLength(1);
        expect(research.getCacheStats()).toMatchObject({ hits: 1, misses: 1, entries: 1 });
    });

    test('treats different filters as different cache entries', async () => {
        await research.searchItems({ keywords: 'bottle', itemCount: 10 });
        await research.searchItems({ keywords: 'bottle', itemCount: 20 });
        await research.searchItems({ keywords: 'bottle', itemCount: 10, sortBy: 'Price:LowToHigh' });
        expect(apiCalls).toHaveLength(3);
    });

    test('bypasses the cache when explicitly asked to refresh', async () => {
        await research.searchItems({ keywords: 'bottle', itemCount: 10 });
        const fresh = await research.searchItems({ keywords: 'bottle', itemCount: 10, cache: false });
        expect(apiCalls).toHaveLength(2);
        expect(fresh.cached).toBe(false);
    });

    test('clearCache reports how many snapshots it dropped', async () => {
        await research.searchItems({ keywords: 'one', itemCount: 10 });
        await research.searchItems({ keywords: 'two', itemCount: 10 });
        expect(research.clearCache()).toBe(2);
        expect(research.getCacheStats().entries).toBe(0);
    });

    test('does not cache failures', async () => {
        research._getSdkApi = () => ({
            searchItems: async () => { throw Object.assign(new Error('boom'), { status: 500 }); },
        });
        await expect(research.searchItems({ keywords: 'failing', itemCount: 10 })).rejects.toThrow('boom');
        research._config.maxRetries = 2;
        expect(research.getCacheStats().entries).toBe(0);
    });
});

describe('keywordResearchService batch scheduling', () => {
    test('paces upstream calls through the shared gate, not per-keyword timers', async () => {
        // Pacing is owned by creatorsApiRateGate (one request per intervalMs
        // ACCOUNT-wide, shared with live sync). The service no longer keeps its
        // own timer — two concurrent callers used to compute the same wait and
        // fire together. Shorten the gate interval so the test stays fast, and
        // hold each call open longer than the interval to prove the pacing does
        // NOT serialise the in-flight requests.
        const gate = require('../../services/creatorsApiRateGate');
        const originalInterval = gate.intervalMs;
        const originalApi = research._getSdkApi;
        const starts = [];
        let inFlight = 0;
        let maxInFlight = 0;

        gate.intervalMs = 60;
        research.clearCache();
        research._getSdkApi = () => ({
            searchItems: async () => {
                starts.push(Date.now());
                inFlight += 1;
                maxInFlight = Math.max(maxInFlight, inFlight);
                await new Promise((r) => setTimeout(r, 150));   // latency > spacing, as upstream behaves
                inFlight -= 1;
                return { searchResult: { totalResultCount: 0, items: [] } };
            },
        });

        try {
            const started = Date.now();
            const result = await research.batchSearchItems(['a', 'b', 'c'], { itemCount: 10 }, { concurrency: 3 });
            const elapsed = Date.now() - started;

            expect(result.totalKeywords).toBe(3);
            expect(result.meta).toMatchObject({ requested: 3, failed: 0, concurrency: 3 });
            expect(starts).toHaveLength(3);

            // Gate-enforced spacing: consecutive starts are at least one interval
            // apart (allow a few ms of timer slop).
            const gaps = starts.slice(1).map((t, i) => t - starts[i]);
            gaps.forEach((gap) => expect(gap).toBeGreaterThanOrEqual(gate.intervalMs - 10));

            // Pacing must not block the caller while a request is in flight.
            expect(maxInFlight).toBeGreaterThanOrEqual(2);
            expect(elapsed).toBeLessThan(3 * (60 + 150));
        } finally {
            gate.intervalMs = originalInterval;
            research._getSdkApi = originalApi;
        }
    });

    test('keeps per-keyword failures isolated and ordered', async () => {
        const originalApi = research._getSdkApi;
        research._config.requestDelay = 1;
        research.clearCache();
        research._getSdkApi = () => ({
            searchItems: async (marketplace, payload) => {
                if (payload.searchItemsRequestContent.keywords === 'bad') {
                    throw Object.assign(new Error('upstream 500'), { status: 500 });
                }
                return { searchResult: { totalResultCount: 1, items: [{ asin: 'B0OK' }] } };
            },
        });

        try {
            const { results, meta } = await research.batchSearchItems(['bad', 'good'], { itemCount: 10 });
            expect(results.map((r) => r.keyword)).toEqual(['bad', 'good']);
            expect(results[0].error).toMatch(/upstream 500/);
            expect(results[1].items).toHaveLength(1);
            expect(meta.failed).toBe(1);
        } finally {
            research._getSdkApi = originalApi;
            research._config.requestDelay = 1100;
        }
    });
});

/* ───────────────────────────── controller ───────────────────────────── */

describe('keywordController enrichment and scope', () => {
    let searchSpy;

    beforeEach(() => {
        searchSpy = jest.spyOn(research, 'searchItems').mockResolvedValue({
            items: MARKET_FIXTURE,
            totalResultCount: 5000,
            searchRefinements: null,
            itemPage: 1,
            itemCount: 12,
            cached: false,
        });
        mockPool = makeFakePool([
            {
                match: /FROM Asins/,
                rows: (entry) => {
                    // Only "our" seller's rows are ever visible to this caller.
                    const ids = Object.keys(entry.inputs).filter((k) => k.startsWith('kwAsin_'));
                    const asked = ids.map((k) => entry.inputs[k]);
                    return asked.includes('B0AQUA00012') ? [catalogRow('B0AQUA00012')] : [];
                },
            },
        ]);
    });

    afterEach(() => searchSpy.mockRestore());

    test('returns market analytics, catalog flags and insights for one keyword', async () => {
        const req = { user: user(), query: { keywords: 'steel water bottle', itemCount: '12' }, body: {} };
        const res = fakeRes();
        await keywordController.search(req, res);

        expect(res.statusCode).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.keyword).toBe('steel water bottle');
        expect(res.body.market.sample.products).toBe(12);
        expect(res.body.insights.insights.length).toBeGreaterThan(0);
        expect(res.body.catalog.summary.matchedCount).toBe(1);
        expect(res.body.items.find((i) => i.asin === 'B0AQUA00012').inCatalog).toBe(true);
        expect(res.body.capabilities).toEqual({ canExport: true, canManage: false });
        expect(res.body.scope).toEqual({ isGlobal: false, sellerIds: ['A1AQUA'] });
    });

    test('403s when a scoped user asks for somebody else\'s seller', async () => {
        const req = { user: user(), query: { keywords: 'bottle', sellerId: 'A1MILTON' }, body: {} };
        const res = fakeRes();
        await keywordController.search(req, res);

        expect(res.statusCode).toBe(403);
        expect(res.body.code).toBe('forbidden_seller');
        expect(res.body.assignedSellers).toEqual(['A1AQUA']);
        expect(searchSpy).not.toHaveBeenCalled();
    });

    test('requires a keyword and degrades gracefully if the catalog is unreachable', async () => {
        const res = fakeRes();
        await keywordController.search({ user: user(), query: {}, body: {} }, res);
        expect(res.statusCode).toBe(400);

        mockPool = { request() { throw new Error('db down'); } };
        const res2 = fakeRes();
        await keywordController.search({ user: user(), query: { keywords: 'bottle' }, body: {} }, res2);
        expect(res2.statusCode).toBe(200);
        expect(res2.body.frame ?? res2.body.catalog.note).toMatch(/db down/);
        expect(res2.body.raw.catalogAvailable).toBe(false);
        expect(res2.body.insights.insights.length).toBeGreaterThan(0);   // market analytics still work
    });

    test('batch rejects oversized input and enriches each keyword', async () => {
        const tooMany = Array.from({ length: 21 }, (_, i) => `kw ${i}`).join('\n');
        const res = fakeRes();
        await keywordController.batchSearch( { user: user(), query: {}, body: { keywords: tooMany } }, res);
        expect(res.statusCode).toBe(400);
        expect(res.body.error).toMatch(/Maximum 20 keywords/);

        const batchSpy = jest.spyOn(research, 'batchSearchItems').mockResolvedValue({
            results: [
                { keyword: 'a', items: MARKET_FIXTURE, totalResultCount: 100, cached: false },
                { keyword: 'b', items: [], totalResultCount: 0, error: 'upstream 429', cached: false },
            ],
            totalKeywords: 2,
            meta: { requested: 2, failed: 1, cached: 0, fresh: 1, concurrency: 2, elapsedMs: 900 },
        });
        const res2 = fakeRes();
        await keywordController.batchSearch({ user: user(), query: {}, body: { keywords: 'a\nb\n' } }, res2);
        batchSpy.mockRestore();

        expect(res2.statusCode).toBe(200);
        expect(res2.body.results).toHaveLength(2);
        expect(res2.body.results[0].market.sample.products).toBe(12);
        expect(res2.body.results[0].insights.insights.length).toBeGreaterThan(0);
        expect(res2.body.results[1].error).toMatch(/429/);
        expect(res2.body.meta.catalogAvailable).toBe(true);
        // one catalog read for the whole batch, not one per keyword
        expect(mockPool.callsWhere(/FROM Asins/)).toHaveLength(1);
    });

    test('exposes limits, cache stats and capabilities in /meta', async () => {
        const res = fakeRes();
        await keywordController.getMeta({ user: user({ permissions: ['keywords_view'] }), query: {}, body: {} }, res);
        expect(res.statusCode).toBe(200);
        expect(res.body.limits.batchMax).toBe(20);
        expect(res.body.sortOptions.length).toBeGreaterThan(3);
        expect(res.body.cache).toHaveProperty('hitRate');
        expect(res.body.capabilities).toEqual({ canExport: false, canManage: false });
    });

    test('only keywords_manage holders can bypass the cache', async () => {
        const res = fakeRes();
        await keywordController.search({ user: user({ permissions: ['keywords_view'] }), query: { keywords: 'x', refresh: 'true' }, body: {} }, res);
        expect(searchSpy.mock.calls[0][0].cache).toBe(true);

        const res2 = fakeRes();
        await keywordController.search({ user: user({ permissions: ['keywords_view', 'keywords_manage'] }), query: { keywords: 'x', refresh: 'true' }, body: {} }, res2);
        expect(searchSpy.mock.calls[1][0].cache).toBe(false);

        const res3 = fakeRes();
        await keywordController.clearCache({ user: user(), query: {}, body: {} }, res3);
        expect(res3.body.success).toBe(true);
        expect(res3.body).toHaveProperty('removed');
    });
});

/* ───────────────────────────── XLSX export ───────────────────────────── */

describe('keyword export', () => {
    const ExcelJS = require('exceljs');
    const scope = { isGlobal: false, sellerIds: ['A1AQUA'] };

    test('builds a single-keyword workbook whose numbers are the ones on screen', async () => {
        const market = analytics.computeMarketAnalytics(MARKET_FIXTURE, { keyword: 'steel water bottle', totalResultCount: 5000 });
        const catalog = analytics.linkCatalog(MARKET_FIXTURE, catalogMap([catalogRow('B0AQUA00012')]), market);
        const insights = analytics.buildInsights(market, catalog, { keyword: 'steel water bottle' });

        const buffer = await keywordExport.buildWorkbook({
            kind: 'single',
            label: 'steel water bottle',
            scope,
            dataset: {
                keyword: 'steel water bottle',
                items: catalog.rows,
                market,
                catalog,
                insights,
                raw: { cached: false, catalogAvailable: true },
            },
        });

        expect(Buffer.isBuffer(buffer)).toBe(true);
        expect(buffer.length).toBeGreaterThan(4000);

        const wb = new ExcelJS.Workbook();
        await wb.xlsx.load(buffer);
        const names = wb.worksheets.map((w) => w.name);
        expect(names).toEqual(expect.arrayContaining(['Summary', 'Products', 'Your Catalog', 'Price Bands', 'Brands', 'Insights']));

        const summary = wb.getWorksheet('Summary');
        const pairs = {};
        summary.eachRow((row) => { pairs[row.getCell(1).value] = row.getCell(2).value; });
        expect(pairs.Keyword).toBe('steel water bottle');
        expect(pairs['Median price']).toBe(504);
        expect(pairs['Your listings in this result']).toBe(1);

        const products = wb.getWorksheet('Products');
        expect(products.rowCount).toBe(MARKET_FIXTURE.length + 1);       // header + rows
        expect(products.getRow(1).getCell(2).value).toBe('Position');    // frozen, styled header
        expect(String(products.getRow(2).getCell(7).value)).toBe('');    // not our listing
    });

    test('builds a batch workbook with one row per keyword', async () => {
        const mk = (kw) => {
            const market = analytics.computeMarketAnalytics(MARKET_FIXTURE, { keyword: kw });
            const catalog = analytics.linkCatalog(MARKET_FIXTURE, new Map(), market);
            return { keyword: kw, items: catalog.rows, market, catalog, insights: analytics.buildInsights(market, catalog, { keyword: kw }) };
        };
        const buffer = await keywordExport.buildWorkbook({
            kind: 'batch',
            label: 'bottle comparison',
            scope,
            dataset: { results: [mk('one'), mk('two')], meta: { requested: 2, failed: 0, cached: 1, fresh: 1, elapsedMs: 2500 } },
        });

        const wb = new ExcelJS.Workbook();
        await wb.xlsx.load(buffer);
        const keywords = wb.getWorksheet('Keywords');
        expect(keywords.rowCount).toBe(3);
        expect(keywords.getRow(2).getCell(1).value).toBe('one');
        expect(keywords.getRow(3).getCell(1).value).toBe('two');
        expect(wb.getWorksheet('Products').rowCount).toBe(2 * MARKET_FIXTURE.length + 1);
    });

    test('names files predictably and safely', () => {
        expect(keywordExport.fileName({ kind: 'single', label: 'Steel Water Bottle / 1L' }))
            .toMatch(/^keyword-research-steel-water-bottle-1l-\d{4}-\d{2}-\d{2}-\d{2}-\d{2}\.xlsx$/);
    });

    test('export endpoint refuses an empty dataset and streams a workbook otherwise', async () => {
        const bad = fakeRes();
        await keywordController.exportResults({ user: user(), query: {}, body: {} }, bad);
        expect(bad.statusCode).toBe(400);

        const market = analytics.computeMarketAnalytics(MARKET_FIXTURE, { keyword: 'k' });
        const catalog = analytics.linkCatalog(MARKET_FIXTURE, new Map(), market);
        const ok = fakeRes();
        await keywordController.exportResults({
            user: user(),
            query: {},
            body: { kind: 'single', label: 'k', dataset: { keyword: 'k', items: catalog.rows, market, catalog, insights: analytics.buildInsights(market, catalog, { keyword: 'k' }) } },
        }, ok);

        expect(ok.headers['content-type']).toMatch(/spreadsheetml/);
        expect(ok.headers['content-disposition']).toMatch(/attachment; filename="keyword-research-k-/);
        expect(Buffer.isBuffer(ok.ended)).toBe(true);
    });
});

/* ───────────────────────────── AI analysis controller ───────────────────────────── */

describe('keywordAnalysisController', () => {
    const keywordAnalysisService = require('../../services/keywordAnalysisService');
    let analyzeSpy;

    beforeEach(() => {
        analyzeSpy = jest.spyOn(keywordAnalysisService, 'analyze').mockResolvedValue({
            keyword: 'bottle',
            products: [{ title: 'x' }],
            items: MARKET_FIXTURE,
            source: 'fallback',
            cached: true,
            analysis: {
                suggestedKeywords: [{ keyword: 'steel bottle', type: 'body', opportunityScore: 80, searchVolume: 'High', competition: 'Medium', rationale: 'r' }],
                keywordGaps: [],
                categoryOpportunities: [],
                trendingTerms: ['insulated'],
                summary: { bestOpportunity: 'steel bottle', strategy: 's' },
            },
        });
        mockPool = makeFakePool([{ match: /FROM Asins/, rows: [catalogRow('B0AQUA00012')] }]);
    });

    afterEach(() => analyzeSpy.mockRestore());

    test('keeps the LLM result but attaches measurable facts around it', async () => {
        const controller = require('../../controllers/keywordAnalysisController');
        const res = fakeRes();
        await controller.analyze({ user: user(), query: { keyword: 'bottle' }, body: {} }, res);

        expect(res.statusCode).toBe(200);
        expect(res.body.analysis.summary.bestOpportunity).toBe('steel bottle');
        expect(res.body.source).toBe('fallback');
        expect(res.body.market.sample.products).toBe(MARKET_FIXTURE.length);
        expect(res.body.catalog.summary.matchedCount).toBe(1);
        expect(res.body.insights.insights.length).toBeGreaterThan(0);
        expect(res.body.items.find((i) => i.asin === 'B0AQUA00012').inCatalog).toBe(true);
    });

    test('applies seller scope to the analysis too', async () => {
        const controller = require('../../controllers/keywordAnalysisController');
        const res = fakeRes();
        await controller.analyze({ user: user(), query: { keyword: 'bottle', sellerId: 'A1OTHER' }, body: {} }, res);
        expect(res.statusCode).toBe(403);
        expect(analyzeSpy).not.toHaveBeenCalled();
    });

    test('surfaces upstream failures as 502 rather than a fake empty result', async () => {
        analyzeSpy.mockRejectedValue(new Error('creators API down'));
        const controller = require('../../controllers/keywordAnalysisController');
        const res = fakeRes();
        await controller.analyze({ user: user(), query: { keyword: 'bottle' }, body: {} }, res);
        expect(res.statusCode).toBe(502);
        expect(res.body.error).toMatch(/creators API down/);
    });
});
