/**
 * Browser-local store for the Keyword Research module.
 *
 * The module has no persistence by design (see the task brief: no schema
 * change / no migration), so saved lists, the watchlist and recent searches
 * live here — in localStorage, versioned, quota-safe and migrated from the
 * ad-hoc keys the old page used (`kw_saved_lists`, `kw_recent_searches`).
 *
 * "Change alerts" are therefore local too: every saved list and watchlist entry
 * keeps a trimmed snapshot, and the *diff against a fresh search* is what the
 * UI surfaces. Nothing here talks to the server, and everything degrades to an
 * empty state if storage is unavailable (private mode, quota, corrupt JSON).
 */
import { useCallback, useEffect, useMemo, useState } from 'react';

export const STORAGE_KEYS = {
    lists: 'kw_saved_lists_v2',
    watchlist: 'kw_watchlist_v2',
    recent: 'kw_recent_searches_v2',
    legacyLists: 'kw_saved_lists',
    legacyRecent: 'kw_recent_searches',
};

const LIMITS = { lists: 50, watchlist: 200, recent: 10, historyPoints: 12, snapshotItems: 40 };

/* ─────────────────────────── storage primitives ─────────────────────────── */

const listeners = new Set();

function readJSON(key, fallback) {
    try {
        const raw = window.localStorage.getItem(key);
        if (!raw) return fallback;
        const parsed = JSON.parse(raw);
        return parsed ?? fallback;
    } catch {
        return fallback;
    }
}

function writeJSON(key, value) {
    try {
        window.localStorage.setItem(key, JSON.stringify(value));
        return true;
    } catch (error) {
        // Quota exhausted or storage disabled — the caller keeps working, the
        // change just is not persisted. Reported through `storageStats().error`.
        console.warn('[KeywordStore] Could not persist', key, error?.message);
        try { window.localStorage.setItem(`${key}__error`, String(error?.message || 'storage error')); } catch { /* ignore */ }
        return false;
    }
}

function emit() {
    listeners.forEach((fn) => {
        try { fn(); } catch { /* a broken listener must not break the store */ }
    });
}

const uid = () => `kw_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
const nowISO = () => new Date().toISOString();
const n = (v) => (v === null || v === undefined || v === '' ? null : Number(v));
const isNum = (v) => n(v) !== null && Number.isFinite(n(v));

/* ─────────────────────────── snapshots & diffs ─────────────────────────── */

const trimItem = (item) => ({
    asin: item.asin,
    title: item.title || '',
    position: n(item.position),
    price: n(item.price),
    rating: n(item.rating),
    reviewCount: n(item.reviewCount),
    mainBSR: n(item.mainBSR),
    brand: item.brand || '',
    inCatalog: !!item.inCatalog,
});

/** Everything a saved list needs to detect change later, at a fraction of the payload. */
export function captureSnapshot(result = {}) {
    const market = result.market || {};
    const items = (result.items || []).slice(0, LIMITS.snapshotItems);
    return {
        capturedAt: nowISO(),
        keyword: result.keyword || market.sample?.keyword || '',
        market: {
            products: market.sample?.products ?? items.length,
            totalResultCount: market.sample?.totalResultCount ?? null,
            medianPrice: market.price?.median ?? null,
            avgDiscountPct: market.price?.avgDiscountPct ?? null,
            avgRating: market.ratings?.avg ?? null,
            totalReviews: market.ratings?.totalReviews ?? null,
            top3ReviewShare: market.ratings?.reviewMoat?.top3Share ?? null,
            medianBSR: market.bsr?.median ?? null,
            topBrand: market.brands?.topBrand?.brand ?? null,
            topBrandShare: market.brands?.topShare ?? null,
            opportunityScore: market.opportunity?.score ?? null,
            ourListings: result.catalog?.summary?.matchedCount ?? null,
        },
        items: items.map(trimItem),
    };
}

/**
 * Batch (multi-keyword) snapshot: one summary row per keyword plus aggregates.
 * Comparing these is how a saved comparison reports "bottle got harder, flask
 * got easier" without storing whole result pages.
 */
export function captureBatchSnapshot(results = [], elapsedMs = null) {
    const rows = (results || []).filter((r) => r && !r.error).map((r) => ({
        keyword: r.keyword,
        products: r.market?.sample?.products ?? (r.items || []).length,
        medianPrice: r.market?.price?.median ?? null,
        opportunityScore: r.market?.opportunity?.score ?? null,
        band: r.market?.opportunity?.band || 'unknown',
        top3ReviewShare: r.market?.ratings?.reviewMoat?.top3Share ?? null,
        ourListings: r.catalog?.summary?.matchedCount ?? null,
    }));
    const scores = rows.map((r) => r.opportunityScore).filter(isNum);
    const prices = rows.map((r) => r.medianPrice).filter(isNum);
    return {
        capturedAt: nowISO(),
        kind: 'batch',
        elapsedMs,
        keywords: rows,
        market: {
            products: rows.reduce((s, r) => s + (r.products || 0), 0),
            ourListings: rows.reduce((s, r) => s + (r.ourListings || 0), 0),
            medianPrice: prices.length ? Math.round(prices.reduce((s, p) => s + p, 0) / prices.length) : null,
            opportunityScore: scores.length ? Math.round(scores.reduce((s, v) => s + v, 0) / scores.length) : null,
            totalReviews: null,
            topBrand: null,
            top3ReviewShare: null,
            avgRating: null,
            avgDiscountPct: null,
            medianBSR: null,
            topBrandShare: null,
            totalResultCount: rows.length,
        },
    };
}

/** Per-keyword moves between two batch snapshots. */
export function diffBatchSnapshot(previous, next) {
    if (!previous?.keywords || !next?.keywords) return null;
    const before = new Map(previous.keywords.map((k) => [k.keyword, k]));
    const keywords = [];
    next.keywords.forEach((row) => {
        const prev = before.get(row.keyword);
        if (!prev) {
            keywords.push({ keyword: row.keyword, change: 'new', detail: `score ${row.opportunityScore ?? '—'}` });
            return;
        }
        const moves = [];
        if (isNum(prev.opportunityScore) && isNum(row.opportunityScore) && Math.abs(row.opportunityScore - prev.opportunityScore) >= 5) {
            moves.push(`opportunity ${prev.opportunityScore} → ${row.opportunityScore}`);
        }
        if (isNum(prev.medianPrice) && isNum(row.medianPrice) && Math.abs(row.medianPrice - prev.medianPrice) / Math.max(prev.medianPrice, 1) >= 0.05) {
            moves.push(`median ₹${Math.round(prev.medianPrice).toLocaleString('en-IN')} → ₹${Math.round(row.medianPrice).toLocaleString('en-IN')}`);
        }
        if (prev.ourListings !== row.ourListings) {
            moves.push(`your listings ${prev.ourListings ?? 0} → ${row.ourListings ?? 0}`);
        }
        if (prev.band !== row.band) moves.push(`${prev.band} → ${row.band}`);
        if (moves.length) keywords.push({ keyword: row.keyword, change: 'moved', detail: moves.join(' · ') });
    });
    const dropped = previous.keywords.filter((k) => !next.keywords.some((n) => n.keyword === k.keyword));
    dropped.forEach((k) => keywords.push({ keyword: k.keyword, change: 'dropped', detail: 'no longer in the comparison' }));

    const market = [];
    ['products', 'ourListings', 'medianPrice', 'opportunityScore'].forEach((key) => {
        const a = previous.market?.[key];
        const b = next.market?.[key];
        if (!isNum(a) || !isNum(b)) return;
        const tolerance = key === 'medianPrice' ? 0.03 : key === 'opportunityScore' ? 5 : 0.1;
        if (Math.abs(b - a) / Math.max(Math.abs(a), 1) >= tolerance) {
            market.push({
                key,
                label: `${FIELD_LABELS[key] || key} (all keywords)`,
                from: a,
                to: b,
                display: key === 'medianPrice'
                    ? `₹${Math.round(a).toLocaleString('en-IN')} → ₹${Math.round(b).toLocaleString('en-IN')}`
                    : `${Math.round(a)} → ${Math.round(b)}`,
            });
        }
    });

    return { market, keywords, capturedAt: previous.capturedAt || null };
}

const FIELD_LABELS = {
    medianPrice: 'Median price',
    avgDiscountPct: 'Avg discount',
    avgRating: 'Avg rating',
    totalReviews: 'Reviews in page',
    top3ReviewShare: 'Top-3 review share',
    medianBSR: 'Median BSR',
    topBrand: 'Leading brand',
    topBrandShare: 'Leading brand share',
    opportunityScore: 'Opportunity score',
    ourListings: 'Your listings',
    products: 'Products in page',
};

const TOLERANCE = {
    medianPrice: (a, b) => Math.abs(b - a) / Math.max(a, 1) >= 0.02,      // 2%
    avgDiscountPct: (a, b) => Math.abs(b - a) >= 3,                        // 3 points
    avgRating: (a, b) => Math.abs(b - a) >= 0.1,
    totalReviews: (a, b) => Math.abs(b - a) >= Math.max(25, a * 0.05),     // +5% or 25 reviews
    top3ReviewShare: (a, b) => Math.abs(b - a) >= 5,                       // 5 points
    medianBSR: (a, b) => Math.abs(b - a) / Math.max(a, 1) >= 0.15,         // 15%
    topBrandShare: (a, b) => Math.abs(b - a) >= 5,
    opportunityScore: (a, b) => Math.abs(b - a) >= 5,
    ourListings: (a, b) => a !== b,
    products: (a, b) => Math.abs(b - a) >= 3,
};

const fmtVal = (key, value) => {
    if (value === null || value === undefined) return '—';
    if (typeof value === 'string') return value;
    if (key === 'medianPrice') return `₹${Math.round(value).toLocaleString('en-IN')}`;
    if (key === 'medianBSR' || key === 'totalReviews') return Math.round(value).toLocaleString('en-IN');
    if (key === 'avgRating') return Number(value).toFixed(2);
    if (key === 'topBrand') return String(value);
    return Number.isInteger(value) ? String(value) : Number(value).toFixed(1);
};

/** Market-level changes between a stored snapshot and a fresh result. */
export function diffSnapshot(previous, next) {
    if (!previous?.market || !next?.market) return { market: [], items: [], capturedAt: previous?.capturedAt || null };
    const market = [];
    Object.entries(TOLERANCE).forEach(([key, changed]) => {
        const a = previous.market[key];
        const b = next.market[key];
        if (!isNum(a) && typeof a !== 'string') return;
        if (!isNum(b) && typeof b !== 'string') return;
        if (typeof a === 'string' || typeof b === 'string') {
            if (String(a) !== String(b)) market.push({ key, label: FIELD_LABELS[key], from: a, to: b, display: `${a} → ${b}` });
            return;
        }
        if (changed(Number(a), Number(b))) {
            const pct = Number(a) !== 0 ? ((Number(b) - Number(a)) / Math.abs(Number(a))) * 100 : null;
            market.push({
                key,
                label: FIELD_LABELS[key],
                from: Number(a),
                to: Number(b),
                pct,
                display: `${fmtVal(key, a)} → ${fmtVal(key, b)}`,
            });
        }
    });

    const before = new Map((previous.items || []).map((i) => [i.asin, i]));
    const after = new Map((next.items || []).map((i) => [i.asin, i]));
    const items = { entered: [], left: [], tracked: [] };

    after.forEach((item, asin) => {
        if (!before.has(asin)) items.entered.push(item);
    });
    before.forEach((item, asin) => {
        if (!after.has(asin)) items.left.push(item);
    });
    after.forEach((item, asin) => {
        const prev = before.get(asin);
        if (!prev) return;
        const changes = [];
        if (isNum(prev.price) && isNum(item.price) && Math.abs(item.price - prev.price) / Math.max(prev.price, 1) >= 0.02) {
            changes.push({ field: 'price', label: 'Price', from: prev.price, to: item.price, display: `₹${Math.round(prev.price).toLocaleString('en-IN')} → ₹${Math.round(item.price).toLocaleString('en-IN')}` });
        }
        if (isNum(prev.reviewCount) && isNum(item.reviewCount) && item.reviewCount - prev.reviewCount >= 25) {
            changes.push({ field: 'reviewCount', label: 'Reviews', from: prev.reviewCount, to: item.reviewCount, display: `+${item.reviewCount - prev.reviewCount} reviews` });
        }
        if (isNum(prev.position) && isNum(item.position) && prev.position !== item.position) {
            changes.push({ field: 'position', label: 'Position', from: prev.position, to: item.position, display: `#${prev.position} → #${item.position}` });
        }
        if (isNum(prev.mainBSR) && isNum(item.mainBSR) && Math.abs(item.mainBSR - prev.mainBSR) / Math.max(prev.mainBSR, 1) >= 0.15) {
            changes.push({ field: 'mainBSR', label: 'BSR', from: prev.mainBSR, to: item.mainBSR, display: `${Math.round(prev.mainBSR).toLocaleString('en-IN')} → ${Math.round(item.mainBSR).toLocaleString('en-IN')}` });
        }
        if (changes.length) items.tracked.push({ ...item, changes });
    });

    return { market, items, capturedAt: previous.capturedAt || null };
}

export const diffTotal = (diff) => (diff ? diff.market.length + diff.items.entered.length + diff.items.left.length + diff.items.tracked.length : 0);

/* ─────────────────────────── watchlist ─────────────────────────── */

const WATCH_RULES = {
    price: { label: 'Price', compare: (a, b) => Math.abs(b - a) / Math.max(a, 1) >= 0.02, format: (v) => `₹${Math.round(v).toLocaleString('en-IN')}` },
    rating: { label: 'Rating', compare: (a, b) => Math.abs(b - a) >= 0.1, format: (v) => Number(v).toFixed(2) },
    reviewCount: { label: 'Reviews', compare: (a, b) => Math.abs(b - a) >= 25, format: (v) => Math.round(v).toLocaleString('en-IN') },
    mainBSR: { label: 'BSR', compare: (a, b) => Math.abs(b - a) / Math.max(a, 1) >= 0.15, format: (v) => Math.round(v).toLocaleString('en-IN') },
    position: { label: 'Position', compare: (a, b) => Math.abs(b - a) >= 3, format: (v) => `#${v}` },
};

/** Compare a watchlist entry's last snapshot with the item seen in the current search. */
export function watchAlerts(entry, item) {
    if (!entry || !item) return [];
    const last = entry.snapshot || {};
    const alerts = [];
    Object.entries(WATCH_RULES).forEach(([field, rule]) => {
        const a = n(last[field]);
        const b = n(item[field]);
        if (a === null || b === null || a === 0) return;
        if (!rule.compare(a, b)) return;
        const direction = b > a ? 'up' : 'down';
        alerts.push({
            field,
            label: rule.label,
            direction,
            from: a,
            to: b,
            display: `${rule.format(a)} → ${rule.format(b)}`,
        });
    });
    return alerts;
}

/* ─────────────────────────── lists / watch / recents ─────────────────────────── */

function migrateLegacy() {
    if (window.localStorage.getItem(STORAGE_KEYS.lists)) return;
    const legacyLists = readJSON(STORAGE_KEYS.legacyLists, null);
    if (Array.isArray(legacyLists) && legacyLists.length) {
        const lists = legacyLists.map((l) => ({
            id: l.id || uid(),
            name: l.name || 'Saved search',
            kind: Array.isArray(l.keywords) ? 'batch' : 'single',
            keyword: l.keyword || (Array.isArray(l.keywords) ? l.keywords[0] : '') || '',
            keywords: Array.isArray(l.keywords) ? l.keywords : [],
            filters: l.filters || {},
            createdAt: l.savedAt || nowISO(),
            updatedAt: l.savedAt || nowISO(),
            snapshot: l.snapshot || null,
            size: Array.isArray(l.items) ? l.items.length : 0,
        }));
        writeJSON(STORAGE_KEYS.lists, lists);
    }

    const legacyRecent = readJSON(STORAGE_KEYS.legacyRecent, null);
    if (Array.isArray(legacyRecent) && legacyRecent.length) {
        const recent = legacyRecent.slice(0, LIMITS.recent).map((r) => (typeof r === 'string'
            ? { keyword: r, at: nowISO(), source: 'search' }
            : { keyword: r.keyword || r.value || '', at: r.at || nowISO(), source: r.source || 'search' }));
        writeJSON(STORAGE_KEYS.recent, recent);
    }
}

export const readLists = () => {
    migrateLegacy();
    const lists = readJSON(STORAGE_KEYS.lists, []);
    return Array.isArray(lists) ? lists : [];
};

export const findListForKeyword = (keyword) => readLists().find((l) => String(l.keyword || '').toLowerCase() === String(keyword || '').toLowerCase()) || null;

export function saveList({ name, kind = 'single', keyword = '', keywords = [], filters = {}, snapshot = null, note = '' }) {
    const lists = readLists();
    const existing = lists.find((l) => l.kind === kind && String(l.keyword || '').toLowerCase() === String(keyword).toLowerCase() && kind === 'single');
    const record = {
        id: existing?.id || uid(),
        name: (name || keyword || 'Saved search').slice(0, 120),
        note,
        kind,
        keyword,
        keywords,
        filters,
        createdAt: existing?.createdAt || nowISO(),
        updatedAt: nowISO(),
        snapshot,
        checks: existing?.checks || 0,
    };
    const next = existing ? lists.map((l) => (l.id === existing.id ? record : l)) : [record, ...lists];
    writeJSON(STORAGE_KEYS.lists, next.slice(0, LIMITS.lists));
    emit();
    return record;
}

/** Attach a fresh snapshot to a saved list and return what changed. */
export function recordListCheck(id, result) {
    const lists = readLists();
    const entry = lists.find((l) => l.id === id);
    if (!entry) return { diff: null, entry: null };
    const isBatch = Array.isArray(result?.results);
    const fresh = isBatch ? captureBatchSnapshot(result.results, result.elapsedMs) : captureSnapshot({ ...result, keyword: entry.keyword });
    const diff = entry.snapshot
        ? (isBatch ? diffBatchSnapshot(entry.snapshot, fresh) : diffSnapshot(entry.snapshot, fresh))
        : null;
    const next = lists.map((l) => (l.id === id
        ? {
            ...l,
            snapshot: fresh,
            updatedAt: nowISO(),
            checks: (l.checks || 0) + 1,
            lastDiff: diff
                ? {
                    at: fresh.capturedAt,
                    total: isBatch ? (diff.market.length + diff.keywords.length) : diffTotal(diff),
                    market: diff.market.slice(0, 6),
                    entered: (diff.items?.entered || []).slice(0, 6),
                    left: (diff.items?.left || []).slice(0, 6),
                    tracked: (diff.items?.tracked || []).slice(0, 8),
                    keywords: (diff.keywords || []).slice(0, 10),
                }
                : (l.lastDiff || null),
        }
        : l));
    writeJSON(STORAGE_KEYS.lists, next);
    emit();
    return { diff, entry: next.find((l) => l.id === id) };
}

export function renameList(id, name) {
    const next = readLists().map((l) => (l.id === id ? { ...l, name: String(name || l.name).slice(0, 120), updatedAt: nowISO() } : l));
    writeJSON(STORAGE_KEYS.lists, next);
    emit();
}

export function deleteList(id) {
    writeJSON(STORAGE_KEYS.lists, readLists().filter((l) => l.id !== id));
    emit();
}

/* ── watchlist ── */

export const readWatchlist = () => {
    const list = readJSON(STORAGE_KEYS.watchlist, []);
    return Array.isArray(list) ? list : [];
};

export const isWatched = (asin) => readWatchlist().some((w) => w.asin === asin);

export function addToWatchlist(item, { keyword = '', note = '' } = {}) {
    if (!item?.asin) return null;
    const list = readWatchlist();
    if (list.some((w) => w.asin === item.asin)) return list.find((w) => w.asin === item.asin);
    const entry = {
        id: uid(),
        asin: item.asin,
        title: item.title || '',
        brand: item.brand || '',
        keyword,
        note,
        addedAt: nowISO(),
        inCatalog: !!item.inCatalog,
        snapshot: {
            price: n(item.price),
            rating: n(item.rating),
            reviewCount: n(item.reviewCount),
            mainBSR: n(item.mainBSR),
            position: n(item.position),
            at: nowISO(),
        },
        history: [{
            at: nowISO(),
            price: n(item.price),
            rating: n(item.rating),
            reviewCount: n(item.reviewCount),
            mainBSR: n(item.mainBSR),
            position: n(item.position),
        }],
        lastAlerts: [],
    };
    writeJSON(STORAGE_KEYS.watchlist, [entry, ...list].slice(0, LIMITS.watchlist));
    emit();
    return entry;
}

export function removeFromWatchlist(asin) {
    writeJSON(STORAGE_KEYS.watchlist, readWatchlist().filter((w) => w.asin !== asin));
    emit();
}

export function updateWatchNote(asin, note) {
    writeJSON(STORAGE_KEYS.watchlist, readWatchlist().map((w) => (w.asin === asin ? { ...w, note: String(note || '').slice(0, 200) } : w)));
    emit();
}

/**
 * Fold fresh search results into the watchlist: records what changed against the
 * last snapshot and returns the alerts for the UI to surface.
 */
export function syncWatchlist(items = [], keyword = '') {
    const list = readWatchlist();
    if (!list.length || !items.length) return { updated: 0, alerts: [] };

    const byAsin = new Map(items.map((i) => [i.asin, i]));
    const alerts = [];
    let updated = 0;

    const next = list.map((entry) => {
        const item = byAsin.get(entry.asin);
        if (!item) return entry;
        const found = watchAlerts(entry, item);
        const point = {
            at: nowISO(),
            price: n(item.price),
            rating: n(item.rating),
            reviewCount: n(item.reviewCount),
            mainBSR: n(item.mainBSR),
            position: n(item.position),
        };
        const last = entry.history?.[entry.history.length - 1];
        const changed = !last || ['price', 'rating', 'reviewCount', 'mainBSR', 'position'].some((k) => last[k] !== point[k]);
        if (!changed && !found.length) return entry;

        updated += 1;
        if (found.length) {
            alerts.push({
                asin: entry.asin,
                title: entry.title || item.title,
                keyword: entry.keyword || keyword,
                alerts: found,
                at: point.at,
            });
        }
        return {
            ...entry,
            title: item.title || entry.title,
            snapshot: { ...point, at: point.at },
            history: [...(entry.history || []), point].slice(-LIMITS.historyPoints),
            lastAlerts: found,
        };
    });

    const changedAny = next.some((entry, i) => entry !== list[i]);
    if (changedAny) {
        writeJSON(STORAGE_KEYS.watchlist, next);
        emit();
    }
    return { updated, alerts };
}

/* ── recent searches ── */

export const readRecent = () => {
    migrateLegacy();
    const list = readJSON(STORAGE_KEYS.recent, []);
    return Array.isArray(list) ? list : [];
};

export function pushRecent(keyword, source = 'search') {
    const kw = String(keyword || '').trim();
    if (!kw) return;
    const next = [{ keyword: kw, at: nowISO(), source }, ...readRecent().filter((r) => r.keyword.toLowerCase() !== kw.toLowerCase())].slice(0, LIMITS.recent);
    writeJSON(STORAGE_KEYS.recent, next);
    emit();
}

export function clearRecent() {
    writeJSON(STORAGE_KEYS.recent, []);
    emit();
}

export function storageStats() {
    let bytes = 0;
    let error;
    try {
        Object.values(STORAGE_KEYS).forEach((key) => {
            const raw = window.localStorage.getItem(key);
            if (raw) bytes += raw.length;
        });
        error = window.localStorage.getItem(`${STORAGE_KEYS.lists}__error`) || null;
    } catch (e) {
        error = e?.message || 'storage unavailable';
    }
    return {
        bytes,
        kb: Number((bytes / 1024).toFixed(1)),
        lists: readLists().length,
        watchlist: readWatchlist().length,
        recent: readRecent().length,
        error,
        limits: LIMITS,
    };
}

export function clearAllLocal() {
    [STORAGE_KEYS.lists, STORAGE_KEYS.watchlist, STORAGE_KEYS.recent].forEach((key) => {
        try { window.localStorage.removeItem(key); } catch { /* ignore */ }
    });
    emit();
}

/* ─────────────────────────── react binding ─────────────────────────── */

/**
 * Subscribe a component to the local store. Data is read synchronously (it is a
 * few kB of JSON) and a version counter forces re-render on every write.
 */
export function useKeywordStore() {
    const [version, setVersion] = useState(0);
    const refresh = useCallback(() => setVersion((v) => v + 1), []);

    useEffect(() => {
        listeners.add(refresh);
        const onStorage = () => refresh();
        window.addEventListener('storage', onStorage);
        return () => {
            listeners.delete(refresh);
            window.removeEventListener('storage', onStorage);
        };
    }, [refresh]);

    // Memoised on the version counter: the object identity is stable between
    // writes, so effects that depend on it cannot re-fire in a loop.
    return useMemo(() => ({
        version,
        lists: readLists(),
        watchlist: readWatchlist(),
        recent: readRecent(),
        stats: storageStats(),
        saveList,
        recordListCheck,
        renameList,
        deleteList,
        addToWatchlist,
        removeFromWatchlist,
        updateWatchNote,
        syncWatchlist,
        pushRecent,
        clearRecent,
        clearAllLocal,
        isWatched,
    }), [version]);
}

export const WATCH_LIMITS = LIMITS;
