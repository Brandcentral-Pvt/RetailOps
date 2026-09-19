/**
 * Keyword Research — module shell.
 *
 * Four surfaces over one scoped data path:
 *
 *   Search            one keyword: live product page + derived market analytics,
 *                     catalog flags, rule-based signals and a sortable table
 *   Compare           up to 20 keywords run in parallel-safe chunks, ranked
 *   Saved & watchlist browser-local lists and watched ASINs with change alerts
 *   AI Analysis       the LLM plan, framed by the deterministic numbers
 *
 * Everything the API returns is described by its own sample size, every ratio
 * renders "—" when its denominator is unknown, and no panel ever invents data.
 * The module stores nothing server-side: saved lists and the watchlist live in
 * localStorage (see localStore.js) by design.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, Input, Modal, message } from 'antd';
import { HistoryOutlined, SaveOutlined, StarFilled, ThunderboltOutlined } from '@ant-design/icons';
import { usePageTitle } from '../../contexts/PageTitleContext';
import { useAuth } from '../../contexts/AuthContext';
import { keywordApi } from '../../services/api';
import { useKeywordMeta, useKeywordCategories, useKeywordSearch, useKeywordBatchSearch, useKeywordAnalysis } from '../../hooks/useKeywordResearch';
import { Panel, MiniState, Segmented, SkeletonPage, fmtNumFull } from '../opsCenter/primitives';
import {
    FilterBar, MarketOverview, InsightList, PricePanel, CompetitionPanel, BrandPanel, TermsPanel,
    CatalogPanel, ProductTable, ResultSummaryBar,
} from './panels';
import {
    ComparePanel, SavedListsPanel, WatchlistPanel, WatchAlertBanner, AnalysisRunner, AnalysisPanel,
    ExportButton, ProductDrawer,
} from './workspace';
import {
    useKeywordStore, captureSnapshot, captureBatchSnapshot,
} from './localStore';
import '../opsCenter/ops.css';
import './keywords.css';

const TABS = [
    { value: 'search', label: 'Search' },
    { value: 'compare', label: 'Compare' },
    { value: 'saved', label: 'Saved & watchlist' },
    { value: 'analysis', label: 'AI analysis' },
];

const EMPTY_FILTERS = {
    keywords: '',
    searchIndex: 'All',
    brand: '',
    minPrice: '',
    maxPrice: '',
    minReviewsRating: '',
    minSavingPercent: '',
    availability: '',
    condition: '',
    sortBy: 'Featured',
    itemCount: 20,
};

const CHUNK_SIZE = 5;          // keywords per upstream request
const CHUNK_CONCURRENCY = 2;   // chunks in flight (server keeps starts 1.1s apart)

const num = (v) => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));
const int = (v) => (num(v) === null ? '—' : fmtNumFull(v));

/** Run an array of async jobs with a fixed concurrency, preserving order. */
async function runPool(items, limit, worker) {
    const results = new Array(items.length);
    let cursor = 0;
    const runners = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
        while (cursor < items.length) {
            const index = cursor;
            cursor += 1;
            results[index] = await worker(items[index], index);
        }
    });
    await Promise.all(runners);
    return results;
}

const KeywordResearchPage = () => {
    const { setPageTitle } = usePageTitle();
    const { hasPermission } = useAuth();
    const store = useKeywordStore();

    const [tab, setTab] = useState('search');
    const [filters, setFilters] = useState(EMPTY_FILTERS);
    const [committed, setCommitted] = useState(null);        // only set on explicit Search
    const [sort, setSort] = useState({ key: 'position', dir: 'asc' });
    const [band, setBand] = useState(null);
    const [watchAlerts, setWatchAlerts] = useState([]);
    const processedResult = useRef(null);
    const processedAnalysis = useRef(null);
    const [selectedItem, setSelectedItem] = useState(null);
    const [saveOpen, setSaveOpen] = useState(false);
    const [saveName, setSaveName] = useState('');
    const [checkingListId, setCheckingListId] = useState(null);
    const [liveResults, setLiveResults] = useState({});      // saved-list id → fresh payload
    const [checkingWatch, setCheckingWatch] = useState(false);

    const [stock, setStock] = useState({ page: 1, items: [], loading: false, error: null, done: false });

    const [compareInput, setCompareInput] = useState('');
    const [compareResults, setCompareResults] = useState([]);
    const [compareProgress, setCompareProgress] = useState(null);
    const [selectedCompare, setSelectedCompare] = useState(null);

    const [anaKeyword, setAnaKeyword] = useState('');
    const [anaItemCount, setAnaItemCount] = useState(10);
    const [anaForceRefresh, setAnaForceRefresh] = useState(false);

    useEffect(() => { setPageTitle('Keyword Research'); }, [setPageTitle]);

    const meta = useKeywordMeta();
    const categories = useKeywordCategories();
    const search = useKeywordSearch(committed || {});
    const batch = useKeywordBatchSearch();
    const analysis = useKeywordAnalysis();

    const canExport = hasPermission('keywords_export');
    const canManage = hasPermission('keywords_manage');

    const data = committed ? search.data : null;
    const result = data?.success ? data : null;
    const error = search.error;
    const scopeLabel = meta.data?.scope?.isGlobal
        ? 'all sellers'
        : `${(meta.data?.scope?.sellerIds || []).length} assigned seller(s)`;

    /* ── progressive "load more" over upstream pages ────────────────────── */
    const totalHits = num(result?.raw?.totalResultCount);
    const payloadStamp = result ? `${result.raw?.itemPage ?? 1}|${result.items?.length}|${result.items?.[0]?.asin}` : null;
    const [stockStamp, setStockStamp] = useState(null);
    if (payloadStamp && payloadStamp !== stockStamp) {
        setStockStamp(payloadStamp);
        setStock({ page: 1, items: result.items || [], loading: false, error: null, done: false });
    }
    const moreAvailable = !!result && !search.isFetching && !stock.done && !stock.loading
        && (totalHits === null || stock.items.length < totalHits);

    /* ── watchlist sync on every fresh result ─────────────────────────── */

    const syncWatch = useCallback((items, keyword) => {
        if (!items?.length) return;
        const { alerts } = store.syncWatchlist(items, keyword);
        if (alerts.length) setWatchAlerts((prev) => [...alerts, ...prev].slice(0, 20));
    }, [store]);

    useEffect(() => {
        if (!result?.items?.length) return;
        const stamp = `${result.keyword}|${result.raw?.cached ? 'cached' : 'fresh'}|${result.items.length}|${result.raw?.totalResultCount}`;
        if (processedResult.current === stamp) return;      // same payload → do not re-record history
        processedResult.current = stamp;
        store.pushRecent(result.keyword, 'search');
        syncWatch(result.items, result.keyword);
    }, [result, store, syncWatch]);

    useEffect(() => {
        const payload = analysis.data;
        if (!payload?.items?.length) return;
        const stamp = `${payload.keyword}|${payload.source}|${payload.items.length}`;
        if (processedAnalysis.current === stamp) return;
        processedAnalysis.current = stamp;
        syncWatch(payload.items, payload.keyword);
    }, [analysis.data, syncWatch]);

    /* ── actions ─────────────────────────────────────────────────────── */

    const doSearch = useCallback((overrideKeyword, { refresh = false } = {}) => {
        const keywords = (overrideKeyword ?? filters.keywords ?? '').trim();
        if (!keywords) {
            message.warning('Enter a seed keyword first.');
            return;
        }
        setTab('search');
        setBand(null);
        setCommitted({ ...filters, keywords, refresh: canManage && refresh ? 'true' : '' });
    }, [filters, canManage]);

    const runCompare = useCallback(async () => {
        const keywords = [...new Set(compareInput.split('\n').map((k) => k.trim()).filter(Boolean))];
        if (!keywords.length) {
            message.warning('Add one keyword per line to compare.');
            return;
        }
        if (keywords.length > 20) {
            message.warning('Maximum 20 keywords per comparison — the upstream API allows one call per 1.1s.');
            return;
        }

        const chunks = [];
        for (let i = 0; i < keywords.length; i += CHUNK_SIZE) chunks.push(keywords.slice(i, i + CHUNK_SIZE));

        setCompareResults([]);
        setSelectedCompare(null);
        setCompareProgress({ running: true, done: 0, total: keywords.length, concurrency: CHUNK_CONCURRENCY });
        const startedAt = Date.now();
        let done = 0;

        try {
            const chunkResults = await runPool(chunks, CHUNK_CONCURRENCY, async (chunk) => {
                const payload = {
                    keywords: chunk.join('\n'),
                    searchIndex: filters.searchIndex === 'All' ? '' : filters.searchIndex,
                    brand: filters.brand,
                    minPrice: filters.minPrice,
                    maxPrice: filters.maxPrice,
                    minReviewsRating: filters.minReviewsRating,
                    minSavingPercent: filters.minSavingPercent,
                    availability: filters.availability,
                    condition: filters.condition,
                    sortBy: filters.sortBy,
                    itemCount: filters.itemCount,
                };
                const response = await batch.mutateAsync(payload);
                done += chunk.length;
                setCompareProgress({ running: true, done, total: keywords.length, concurrency: CHUNK_CONCURRENCY, elapsed: Date.now() - startedAt });
                return (response.results || []).map((r) => ({ ...r, keyword: r.keyword }));
            });

            const merged = chunkResults.flat().sort((a, b) => keywords.indexOf(a.keyword) - keywords.indexOf(b.keyword));
            setCompareResults(merged);
            setCompareProgress({ running: false, done: keywords.length, total: keywords.length, elapsed: Date.now() - startedAt, concurrency: CHUNK_CONCURRENCY });
            setSelectedCompare(merged[0] || null);

            const allItems = merged.flatMap((r) => r.items || []);
            syncWatch(allItems, keywords[0]);
            store.pushRecent(keywords[0], 'compare');
        } catch (err) {
            setCompareProgress(null);
            message.error(err?.message || 'Comparison failed');
        }
    }, [compareInput, filters, batch, store, syncWatch]);

    /** Fetch the next upstream page and append it to the product table. */
    const loadMore = useCallback(async () => {
        if (stock.loading || !result) return;
        const nextPage = stock.page + 1;
        setStock((s) => ({ ...s, loading: true, error: null }));
        try {
            const res = await keywordApi.search({ ...committed, itemPage: nextPage });
            if (!res?.success) throw new Error(res?.error || 'Failed to load more products');
            const incoming = res.items || [];
            setStock((s) => {
                if (s.page !== stock.page) return s;
                const seen = new Set(s.items.map((i) => i.asin));
                const appended = incoming.filter((i) => !seen.has(i.asin));
                return {
                    page: nextPage,
                    items: [...s.items, ...appended],
                    loading: false,
                    error: null,
                    done: appended.length === 0,
                };
            });
        } catch (err) {
            setStock((s) => ({ ...s, loading: false, error: err?.message || 'Failed to load more products' }));
        }
    }, [committed, result, stock.loading, stock.page]);

    const runAnalysis = useCallback(async () => {
        const keyword = anaKeyword.trim();
        if (!keyword) {
            message.warning('Enter a seed keyword for the analysis.');
            return;
        }
        setTab('analysis');
        try {
            await analysis.mutateAsync({
                keyword,
                itemCount: anaItemCount,
                refresh: anaForceRefresh && canManage ? 'true' : '',
            });
            store.pushRecent(keyword, 'analysis');
        } catch (err) {
            message.error(err?.message || 'Analysis failed');
        }
    }, [anaKeyword, anaItemCount, anaForceRefresh, canManage, analysis, store]);

    const openList = useCallback((list) => {
        if (list.kind === 'batch') {
            setTab('compare');
            setCompareInput((list.keywords || []).join('\n'));
            if (liveResults[list.id]) {
                setCompareResults(liveResults[list.id]);
                setSelectedCompare(liveResults[list.id][0] || null);
            }
            return;
        }
        setTab('search');
        setFilters((f) => ({ ...f, ...(list.filters || {}), keywords: list.keyword }));
        setCommitted({ ...EMPTY_FILTERS, ...(list.filters || {}), keywords: list.keyword });
        setBand(null);
    }, [liveResults]);

    const recheckList = useCallback(async (list) => {
        setCheckingListId(list.id);
        try {
            if (list.kind === 'batch' && (list.keywords || []).length) {
                const keywords = list.keywords;
                const chunks = [];
                for (let i = 0; i < keywords.length; i += CHUNK_SIZE) chunks.push(keywords.slice(i, i + CHUNK_SIZE));
                const chunkResults = await runPool(chunks, CHUNK_CONCURRENCY, (chunk) => batch.mutateAsync({
                    keywords: chunk.join('\n'),
                    itemCount: list.filters?.itemCount || 20,
                }));
                const merged = chunkResults.flat().sort((a, b) => keywords.indexOf(a.keyword) - keywords.indexOf(b.keyword));
                setLiveResults((prev) => ({ ...prev, [list.id]: merged }));
                const { diff } = store.recordListCheck(list.id, { results: merged, keywords });
                if (diff) {
                    const total = (diff.market?.length || 0) + (diff.keywords?.length || 0);
                    if (total) message.info(`${total} change${total === 1 ? '' : 's'} since the last check`);
                }
                // Opening the comparison with the fresh data
                setCompareResults(merged);
                setSelectedCompare(merged[0] || null);
                return;
            }

            const response = await keywordApi.search({ ...(list.filters || {}), keywords: list.keyword, itemCount: list.filters?.itemCount || 20 });
            if (!response?.success) throw new Error(response?.error || 'Search failed');
            setLiveResults((prev) => ({ ...prev, [list.id]: response }));
            const { diff } = store.recordListCheck(list.id, response);
            const total = diff ? (diff.market?.length || 0) + (diff.items?.entered?.length || 0) + (diff.items?.left?.length || 0) + (diff.items?.tracked?.length || 0) : 0;
            if (diff) message.info(total ? `${total} change${total === 1 ? '' : 's'} since the last check` : 'No material change since the last check');
            else message.success('Snapshot stored — the next check will show what moved');
        } catch (err) {
            message.error(err?.message || 'Re-check failed');
        } finally {
            setCheckingListId(null);
        }
    }, [batch, store]);

    const checkWatchlist = useCallback(async () => {
        const keywords = [...new Set(store.watchlist.map((w) => w.keyword).filter(Boolean))];
        if (!keywords.length) {
            message.warning('No watched listing carries a keyword yet — search for one and watch a result.');
            return;
        }
        setCheckingWatch(true);
        try {
            const chunks = [];
            for (let i = 0; i < keywords.length; i += CHUNK_SIZE) chunks.push(keywords.slice(i, i + CHUNK_SIZE));
            const chunkResults = await runPool(chunks, CHUNK_CONCURRENCY, (chunk) => batch.mutateAsync({ keywords: chunk.join('\n'), itemCount: 50 }));
            const items = chunkResults.flatMap((r) => r.results || []).flatMap((r) => r.items || []);
            const { alerts } = store.syncWatchlist(items, keywords[0]);
            setWatchAlerts(alerts);
            message.success(alerts.length ? `${alerts.length} watched listing(s) moved` : 'No movement since the last check');
        } catch (err) {
            message.error(err?.message || 'Watchlist check failed');
        } finally {
            setCheckingWatch(false);
        }
    }, [store, batch]);

    const saveCurrent = useCallback(() => {
        const name = saveName.trim();
        if (!name) {
            message.warning('Give the list a name.');
            return;
        }
        if (tab === 'compare') {
            store.saveList({
                name,
                kind: 'batch',
                keywords: [...new Set(compareInput.split('\n').map((k) => k.trim()).filter(Boolean))],
                keyword: compareInput.split('\n')[0]?.trim() || '',
                filters: { itemCount: filters.itemCount, sortBy: filters.sortBy },
                snapshot: captureBatchSnapshot(compareResults, compareProgress?.elapsed),
            });
        } else if (result) {
            store.saveList({
                name,
                kind: 'single',
                keyword: result.keyword,
                filters: { ...committed, keywords: undefined, refresh: undefined },
                snapshot: captureSnapshot(result),
            });
        } else {
            message.warning('Run a search first.');
            return;
        }
        setSaveOpen(false);
        setSaveName('');
        message.success('Saved locally — re-check it any time from Saved & watchlist');
    }, [saveName, tab, result, committed, compareInput, compareResults, compareProgress, filters, store]);

    /* ── derived table data ─────────────────────────────────────────── */

    const tableItems = useMemo(() => {
        if (!stock.items.length) return [];
        let items = stock.items;
        if (band) {
            const bands = result.market?.price?.bands || [];
            const index = bands.findIndex((b) => b.key === band);
            const lower = index <= 0 ? -1 : bands[index - 1].max;
            const upper = index === -1 ? Infinity : bands[index].max;
            items = items.filter((i) => num(i.price) !== null && Number(i.price) > lower && Number(i.price) <= upper);
        }
        const dir = sort.dir === 'asc' ? 1 : -1;
        return [...items].sort((a, b) => {
            const av = num(a[sort.key]);
            const bv = num(b[sort.key]);
            if (av !== null && bv !== null) return (av - bv) * dir;
            if (av === null && bv === null) return 0;
            if (av === null) return 1;
            return -1;
        });
    }, [stock.items, band, sort, result]);

    const compareItems = useMemo(() => (compareResults || []).flatMap((r) => (r.items || []).map((i) => ({ ...i, keyword: r.keyword }))), [compareResults]);

    const keywordHits = useMemo(() => {
        const map = {};
        (result?.items || []).forEach((i) => { map[i.asin] = (map[i.asin] || 0) + 1; });
        compareItems.forEach((i) => { map[i.asin] = (map[i.asin] || 0) + 1; });
        return map;
    }, [result, compareItems]);

    const toggleWatch = useCallback((item) => {
        if (store.isWatched(item.asin)) {
            store.removeFromWatchlist(item.asin);
            message.success('Removed from the watchlist');
        } else {
            store.addToWatchlist(item, { keyword: item.keyword || result?.keyword || '' });
            message.success('Watching this listing — alerts appear on the next search that covers it');
        }
    }, [store, result]);

    const exportDatasetFor = useCallback((list) => {
        const live = liveResults[list.id];
        if (!live) return null;
        return list.kind === 'batch' ? { results: live, meta: { requested: live.length } } : live;
    }, [liveResults]);

    const initialLoading = (search.isLoading && committed) || meta.isLoading;

    if (initialLoading && !result && !meta.data) return <SkeletonPage />;

    return (
        <div className="ops kw-page">
            <div className="ops-head">
                <div>
                    <div className="ops-head__title">Keyword Research</div>
                    <div className="ops-head__sub">
                        <span className="ops-pill ops-pill--live"><span className="ops-pill__dot" />Live Amazon Creators API</span>
                        <span>{scopeLabel}</span>
                        <span>·</span>
                        <span>
                            {meta.data?.cache
                                ? `${int(meta.data.cache.entries)} cached snapshots · ${meta.data.cache.hitRate ?? 0}% hit rate`
                                : 'cache warm-up'}
                        </span>
                        <span>·</span>
                        <span className="ops-num">{store.lists.length} saved · {store.watchlist.length} watched (this browser)</span>
                    </div>
                </div>
                <div className="ops-head__controls">
                    <Segmented options={TABS} value={tab} onChange={setTab} ariaLabel="Keyword research view" />
                    <Button size="small" icon={<SaveOutlined />} onClick={() => { setSaveName(result?.keyword || ''); setSaveOpen(true); }}>Save list</Button>
                    {canExport ? (
                        <ExportButton
                            size="small"
                            kind={tab === 'compare' ? 'batch' : tab === 'analysis' ? 'analysis' : 'single'}
                            dataset={tab === 'compare'
                                ? { results: compareResults, meta: compareProgress }
                                : tab === 'analysis'
                                    ? { keyword: analysis.data?.keyword, analysis: analysis.data?.analysis, market: analysis.data?.market, catalog: analysis.data?.catalog, insights: analysis.data?.insights, items: analysis.data?.items, source: analysis.data?.source }
                                    : result}
                            label={tab === 'compare' ? 'keyword-comparison' : (result?.keyword || analysis.data?.keyword || 'keyword-research')}
                        />
                    ) : null}
                </div>
            </div>

            {watchAlerts.length ? (
                <WatchAlertBanner alerts={watchAlerts} onDismiss={() => setWatchAlerts([])} />
            ) : null}

            {/* ── recent searches ── */}
            {store.recent.length ? (
                <div className="kw-recents">
                    <HistoryOutlined />
                    {store.recent.map((r) => (
                        <button
                            type="button"
                            key={r.keyword}
                            className="ops-filterchip"
                            onClick={() => {
                                setFilters((f) => ({ ...f, keywords: r.keyword }));
                                doSearch(r.keyword);
                            }}
                        >
                            {r.keyword}
                        </button>
                    ))}
                    <button type="button" className="ops-linkbtn kw-recentclear" onClick={store.clearRecent}>clear</button>
                </div>
            ) : null}

            <div className="ops-grid">
                {tab === 'search' || tab === 'compare' ? (
                    <FilterBar
                        filters={filters}
                        onFilters={(next) => setFilters(next)}
                        categories={categories.data?.categories || []}
                        onSearch={() => doSearch()}
                        loading={search.isFetching}
                        canRefresh={canManage}
                        onRefresh={() => doSearch(undefined, { refresh: true })}
                        scope={meta.data?.scope}
                        meta={meta.data}
                    />
                ) : null}

                {/* ───────────────────── SEARCH ───────────────────── */}
                {tab === 'search' ? (
                    <>
                        {error ? (
                            <Panel span={12} kicker="Search">
                                <MiniState tone="error" title="Search failed" note={error.message} onRetry={() => search.refetch()} />
                            </Panel>
                        ) : null}

                        {!committed && !error ? (
                            <Panel span={12} kicker="Get started">
                                <MiniState
                                    tone="empty"
                                    title="Search a keyword to build the market picture"
                                    note="Products, price bands, review moat, brand concentration, title language, catalog overlap and rule-based signals — all from one live API call."
                                />
                            </Panel>
                        ) : null}

                        {result ? (
                            <>
                                <ResultSummaryBar result={result}>
                                    <Button size="small" icon={<StarFilled />} onClick={() => setTab('saved')}>
                                        Saved & watchlist ({store.watchlist.length})
                                    </Button>
                                </ResultSummaryBar>

                                <MarketOverview result={result} onFocus={(target) => document.getElementById(`panel-${target}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })} />
                                <InsightList insights={result.insights} span={4} onJump={(target) => document.getElementById(target)?.scrollIntoView({ behavior: 'smooth', block: 'start' })} />
                                <PricePanel market={result.market} onBand={setBand} activeBand={band} />
                                <CompetitionPanel market={result.market} />
                                <BrandPanel market={result.market} />
                                <TermsPanel market={result.market} currentKeyword={result.keyword} onTerm={(term) => { setFilters((f) => ({ ...f, keywords: term })); doSearch(term); }} />
                                <CatalogPanel result={result} onSelectAsin={(asin) => setSelectedItem(result.items.find((i) => i.asin === asin) || null)} />
                                <ProductTable
                                    items={tableItems}
                                    sort={{ key: sort.key, dir: sort.dir, onSort: (key) => setSort((s) => ({ key, dir: s.key === key && s.dir === 'desc' ? 'asc' : 'desc' })) }}
                                    watched={store.watchlist.map((w) => w.asin)}
                                    onWatch={toggleWatch}
                                    onOpen={setSelectedItem}
                                    onLoadMore={moreAvailable ? loadMore : undefined}
                                    moreLoading={stock.loading}
                                    moreError={stock.error}
                                    totalHits={totalHits}
                                />
                            </>
                        ) : null}
                    </>
                ) : null}

                {/* ───────────────────── COMPARE ───────────────────── */}
                {tab === 'compare' ? (
                    <>
                        <Panel
                            span={12}
                            kicker="Compare keywords"
                            meta={`one keyword per line · up to 20 · runs ${CHUNK_SIZE} per request, ${CHUNK_CONCURRENCY} requests in flight`}
                        >
                            <div className="kw-compareinput">
                                <Input.TextArea
                                    rows={4}
                                    value={compareInput}
                                    onChange={(e) => setCompareInput(e.target.value)}
                                    placeholder={'insulated water bottle\nsteel water bottle 1 litre\nwater bottle for gym'}
                                />
                                <div className="kw-compareinput__actions">
                                    <Button type="primary" icon={<ThunderboltOutlined />} loading={batch.isPending} onClick={runCompare}>Run comparison</Button>
                                    {compareResults.length ? (
                                        <Button
                                            icon={<SaveOutlined />}
                                            onClick={() => { setSaveName(`Compare: ${compareResults.length} keywords`); setSaveOpen(true); }}
                                        >
                                            Save comparison
                                        </Button>
                                    ) : null}
                                </div>
                            </div>
                        </Panel>

                        <ComparePanel
                            results={compareResults}
                            progress={compareProgress}
                            onSelect={setSelectedCompare}
                            selectedKeyword={selectedCompare?.keyword}
                            canExport={canExport}
                        />

                        {selectedCompare ? (
                            <>
                                <MarketOverview result={selectedCompare} />
                                <InsightList insights={selectedCompare.insights} span={4} />
                                <CatalogPanel result={selectedCompare} span={12} />
                            </>
                        ) : null}

                        {compareItems.length ? (
                            <ProductTable
                                items={compareItems}
                                showKeyword
                                watched={store.watchlist.map((w) => w.asin)}
                                onWatch={toggleWatch}
                                onOpen={setSelectedItem}
                            />
                        ) : null}
                    </>
                ) : null}

                {/* ───────────────────── SAVED / WATCHLIST ───────────────────── */}
                {tab === 'saved' ? (
                    <>
                        <SavedListsPanel
                            lists={store.lists}
                            stats={store.stats}
                            canExport={canExport}
                            checkingId={checkingListId}
                            exportDatasetFor={exportDatasetFor}
                            onOpen={openList}
                            onRecheck={recheckList}
                            onRename={store.renameList}
                            onDelete={store.deleteList}
                            onClearAll={() => { store.clearAllLocal(); message.success('Local keyword data cleared'); }}
                        />
                        <WatchlistPanel
                            watchlist={store.watchlist}
                            alerts={watchAlerts}
                            keywordHits={keywordHits}
                            onRemove={store.removeFromWatchlist}
                            onNote={store.updateWatchNote}
                            onCheck={checkWatchlist}
                            checking={checkingWatch}
                        />
                        <Panel span={12} kicker="How saved lists work">
                            <div className="kw-notes">
                                <p>
                                    Saved lists, the watchlist and recent searches live in <strong>this browser only</strong> — the Keyword Research module
                                    keeps nothing server-side, so there is no cross-device sync and no history table. That is deliberate.
                                </p>
                                <p>
                                    Each list keeps a trimmed snapshot (market metrics plus the top {`${store.stats?.limits?.snapshotItems || 40}`} listings) captured when you
                                    saved or last re-checked it. <strong>Re-check</strong> re-runs the search — normally from the server's 10-minute snapshot cache, so it is usually free —
                                    and diffs the result against that snapshot: price, review, rank and position moves, new entrants and drop-outs.
                                </p>
                                <p>
                                    Watched ASINs are tracked the same way, with alerts surfaced here and on every search that covers them. Local storage is
                                    currently using {store.stats?.kb ?? 0} kB{store.stats?.error ? ` (last write failed: ${store.stats.error})` : ''}.
                                </p>
                            </div>
                        </Panel>
                    </>
                ) : null}

                {/* ───────────────────── AI ANALYSIS ───────────────────── */}
                {tab === 'analysis' ? (
                    <>
                        <AnalysisRunner
                            value={anaKeyword}
                            onChange={setAnaKeyword}
                            onRun={runAnalysis}
                            loading={analysis.isPending}
                            itemCount={anaItemCount}
                            onItemCount={setAnaItemCount}
                            scopeLabel={scopeLabel}
                            canRefresh={canManage}
                            forceRefresh={anaForceRefresh}
                            onForceRefresh={setAnaForceRefresh}
                        />

                        {analysis.error ? (
                            <Panel span={12} kicker="AI analysis">
                                <MiniState tone="error" title="Analysis failed" note={analysis.error.message} onRetry={runAnalysis} />
                            </Panel>
                        ) : null}

                        {!analysis.data && !analysis.isPending ? (
                            <Panel span={12} kicker="AI analysis">
                                <MiniState
                                    tone="empty"
                                    title="No analysis yet"
                                    note="Pick a seed keyword and run the analysis. The model returns suggested keywords, gaps and angles; the deterministic market numbers and your catalog overlap are computed from the same product set."
                                />
                            </Panel>
                        ) : null}

                        {analysis.data?.analysis ? (
                            <AnalysisPanel
                                keyword={analysis.data.keyword}
                                analysis={analysis.data.analysis}
                                source={analysis.data.source}
                                market={analysis.data.market}
                                catalog={analysis.data.catalog}
                                insights={analysis.data.insights}
                                items={analysis.data.items}
                                canExport={canExport}
                                watched={store.watchlist.map((w) => w.asin)}
                                onWatch={toggleWatch}
                                onOpen={setSelectedItem}
                                onTerm={(term) => { setAnaKeyword(term); }}
                            />
                        ) : null}
                    </>
                ) : null}
            </div>

            <ProductDrawer
                item={selectedItem}
                open={!!selectedItem}
                onClose={() => setSelectedItem(null)}
                watched={selectedItem ? store.isWatched(selectedItem.asin) : false}
                onWatch={toggleWatch}
            />

            <Modal
                title="Save list locally"
                open={saveOpen}
                onCancel={() => setSaveOpen(false)}
                onOk={saveCurrent}
                okText="Save"
                destroyOnHidden
            >
                <p className="kw-muted">
                    Stored in this browser only. Saved lists keep a snapshot so a later re-check can tell you exactly what moved.
                </p>
                <Input
                    placeholder="List name"
                    value={saveName}
                    onChange={(e) => setSaveName(e.target.value)}
                    onPressEnter={saveCurrent}
                    autoFocus
                />
                <div className="kw-savehint">
                    {tab === 'compare'
                        ? `Will save ${[...new Set(compareInput.split('\n').map((k) => k.trim()).filter(Boolean))].length} keywords from the comparison.`
                        : result ? `Will save “${result.keyword}” with the current filters.` : 'Run a search first.'}
                </div>
            </Modal>
        </div>
    );
};

export default KeywordResearchPage;
