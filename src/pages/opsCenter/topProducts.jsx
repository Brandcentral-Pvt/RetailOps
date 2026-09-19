import React, { useMemo, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
    Panel, MiniState, Delta, Segmented, SortHeader, ShareBar, Tip,
    fmtINR, fmtINRFull, fmtNum, fmtNumFull, fmtPct, OPS_COLOR,
} from './primitives';
import { Sparkline, Bars } from './charts';

/**
 * Top products — ranked by the ASIN's GMS (ordered revenue from the GMS
 * daily performance feed), NOT by advertising data. Ads figures appear only
 * as context columns (ad share of GMS, TACoS).
 *
 * Interactions: sortable columns, search, top-N switch, row drill-down
 * (bucketed GMS bars + full stat sheet), CSV export of the visible set.
 */

const COLUMNS = [
    { key: 'rank', label: '#', numeric: true, width: 36 },
    { key: 'title', label: 'Product', numeric: false },
    { key: 'gmsRevenue', label: 'GMS', numeric: true, tip: 'Ordered revenue of the ASIN in the selected period (GMS feed)' },
    { key: 'deltaPct', label: 'Δ prev', numeric: true, tip: 'GMS change vs the preceding period of the same length' },
    { key: 'gmsUnits', label: 'Units', numeric: true, tip: 'Ordered units (GMS feed)' },
    { key: 'asp', label: 'ASP', numeric: true, tip: 'Average selling price = GMS ÷ units' },
    { key: 'adShare', label: 'Ad share', numeric: true, tip: 'Ad-attributed sales as a share of GMS' },
    { key: 'tacos', label: 'TACoS', numeric: true, tip: 'Total ACoS = ad spend ÷ GMS (lower is better)' },
    { key: 'trend', label: 'Trend', numeric: false, sortable: false },
];

const LIMITS = [
    { value: 10, label: 'Top 10' },
    { value: 25, label: 'Top 25' },
    { value: 200, label: 'All' },
];

const cmp = (a, b, key, dir) => {
    const av = a[key];
    const bv = b[key];
    const an = av === null || av === undefined;
    const bn = bv === null || bv === undefined;
    if (an && bn) return 0;
    if (an) return 1;                // nulls always last
    if (bn) return -1;
    let r;
    if (typeof av === 'string' || typeof bv === 'string') r = String(av).localeCompare(String(bv));
    else r = (Number(av) || 0) - (Number(bv) || 0);
    return dir === 'asc' ? r : -r;
};

const csvEscape = (v) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const downloadCsv = (rows, filename) => {
    const header = ['rank', 'asin', 'sku', 'title', 'seller', 'category', 'marketplace', 'gms_revenue', 'gms_units', 'asp',
        'prev_gms_revenue', 'delta_pct', 'share_pct', 'ad_sales', 'ad_spend', 'ad_share_pct', 'tacos_pct', 'acos_pct', 'returns', 'return_rate_pct', 'active_days'];
    const lines = rows.map((r) => [
        r.rank, r.asin, r.sku, r.title, r.sellerName, r.category, r.marketplace, r.gmsRevenue, r.gmsUnits, r.asp,
        r.prevGmsRevenue, r.deltaPct, r.share, r.adSales, r.adSpend, r.adShare, r.tacos, r.acosPct, r.returns, r.returnRate, r.activeDays,
    ].map(csvEscape).join(','));
    const blob = new Blob([[header.join(','), ...lines].join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};

const Stat = ({ label, value, sub, tone }) => (
    <div className="ops-detail__stat">
        <span className="ops-detail__label">{label}</span>
        <span className={`ops-detail__value ops-num ${tone ? `ops-detail__value--${tone}` : ''}`}>{value}</span>
        {sub && <span className="ops-detail__sub ops-num">{sub}</span>}
    </div>
);

const ProductDetail = ({ row, labels, granularity, links, periodDays }) => {
    const hasTrend = Array.isArray(row.trend) && row.trend.length > 0;
    const isAmazon = String(row.marketplace || '').toLowerCase().includes('amazon');
    const [copied, setCopied] = useState(false);
    const copy = useCallback(() => {
        if (navigator.clipboard?.writeText) {
            navigator.clipboard.writeText(row.asin).then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 1200);
            }).catch(() => {});
        }
    }, [row.asin]);

    return (
        <div className="ops-detail">
            <div className="ops-detail__chart">
                <div className="ops-detail__charthead">
                    <span className="ops-panel__kicker">GMS by {granularity === 'week' ? 'week' : 'day'}</span>
                    <span className="ops-panel__meta">
                        {row.activeDays} selling day{row.activeDays === 1 ? '' : 's'} of {periodDays}
                    </span>
                </div>
                {hasTrend ? (
                    <Bars
                        labels={labels}
                        data={row.trend}
                        color={OPS_COLOR.accent}
                        height={128}
                        secondary={row.unitsTrend ? [{ name: 'Units', data: row.unitsTrend, unit: 'num', color: OPS_COLOR.slate }] : []}
                    />
                ) : (
                    <MiniState tone="empty" title="Trend not loaded" note="Per-ASIN trends are fetched for the top 25 products only." />
                )}
            </div>
            <div className="ops-detail__grid">
                <Stat label="GMS" value={fmtINRFull(row.gmsRevenue)} sub={`${fmtPct(row.share)} of period GMS`} />
                <Stat label="Previous period" value={row.prevGmsRevenue > 0 ? fmtINRFull(row.prevGmsRevenue) : '—'} sub={row.prevGmsRevenue > 0 ? <Delta value={row.deltaPct} /> : 'no prior data'} />
                <Stat label="Units · ASP" value={`${fmtNumFull(row.gmsUnits)} · ${fmtINRFull(row.asp)}`} sub={row.prevGmsUnits > 0 ? <Delta value={row.unitsDeltaPct} label="units" /> : null} />
                <Stat label="Shipped revenue" value={fmtINRFull(row.shippedRevenue)} sub={row.gmsRevenue > 0 ? `${fmtPct((row.shippedRevenue / row.gmsRevenue) * 100, 0)} of ordered` : null} />
                <Stat label="Returns" value={fmtNumFull(row.returns)} sub={`${fmtPct(row.returnRate)} of units`} tone={row.returnRate > 10 ? 'neg' : undefined} />
                <Stat label="Ad sales" value={fmtINRFull(row.adSales)} sub={`${fmtPct(row.adShare)} of GMS · ${fmtNumFull(row.adOrders)} ad orders`} />
                <Stat label="Ad spend" value={fmtINRFull(row.adSpend)} sub={`TACoS ${fmtPct(row.tacos)} · ACoS ${row.acos}`} tone={row.tacos > 20 ? 'neg' : undefined} />
                <Stat label="Listing" value={row.currentPrice > 0 ? fmtINRFull(row.currentPrice) : '—'} sub={[row.status, row.availability].filter(Boolean).join(' · ') || 'no listing status'} />
            </div>
            <div className="ops-detail__foot">
                <span className="ops-detail__meta ops-num">
                    {row.sellerName || '—'} · {row.category}{row.brand ? ` · ${row.brand}` : ''}{row.parentAsin ? ` · parent ${row.parentAsin}` : ''} · SKU {row.sku}
                </span>
                <span className="ops-detail__actions">
                    <button type="button" className="ops-retry" onClick={copy}>{copied ? 'Copied' : 'Copy ASIN'}</button>
                    {isAmazon && (
                        <a className="ops-retry" href={`https://www.amazon.in/dp/${encodeURIComponent(row.asin)}`} target="_blank" rel="noreferrer">Amazon ↗</a>
                    )}
                    {links?.gmsTracker && <Link className="ops-retry" to={links.gmsTracker}>GMS tracker</Link>}
                    {links?.skuReport && <Link className="ops-retry" to={links.skuReport}>SKU report</Link>}
                </span>
            </div>
        </div>
    );
};

export const TopProductsPanel = ({
    products = [], status, onRetry, labels = [], granularity = 'day', periodDays = 0, periodTotal = 0, links,
}) => {
    const [sortKey, setSortKey] = useState('gmsRevenue');
    const [sortDir, setSortDir] = useState('desc');
    const [query, setQuery] = useState('');
    const [limit, setLimit] = useState(10);
    const [expanded, setExpanded] = useState(null);

    const onSort = useCallback((key) => {
        if (key === sortKey) {
            setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
        } else {
            setSortKey(key);
            setSortDir(key === 'title' || key === 'rank' ? 'asc' : 'desc');
        }
    }, [sortKey]);

    // Normalise once: older payloads only carry revenue/units/acos; the
    // GMS-first backend adds the full block. Never invent a prior value.
    const normalized = useMemo(() => products.map((p, i) => ({
        ...p,
        rank: p.rank ?? i + 1,
        gmsRevenue: Number(p.gmsRevenue ?? p.revenue) || 0,
        gmsUnits: Number(p.gmsUnits ?? p.units) || 0,
        prevGmsRevenue: Number(p.prevGmsRevenue) || 0,
        deltaPct: p.deltaPct === null || p.deltaPct === undefined ? null : Number(p.deltaPct),
        asp: Number(p.asp) || ((Number(p.gmsUnits ?? p.units) || 0) > 0 ? (Number(p.gmsRevenue ?? p.revenue) || 0) / Number(p.gmsUnits ?? p.units) : 0),
        share: Number(p.share) || 0,
        adSales: Number(p.adSales) || 0,
        adSpend: Number(p.adSpend) || 0,
        adShare: Number(p.adShare) || 0,
        tacos: Number(p.tacos) || 0,
        returns: Number(p.returns) || 0,
        returnRate: Number(p.returnRate) || 0,
        shippedRevenue: Number(p.shippedRevenue) || 0,
        activeDays: Number(p.activeDays) || 0,
        acos: p.acos ?? '—',
    })), [products]);

    const rows = useMemo(() => {
        const q = query.trim().toLowerCase();
        let list = normalized;
        if (q) {
            list = list.filter((r) => [r.asin, r.sku, r.title, r.sellerName, r.category, r.brand]
                .some((f) => String(f || '').toLowerCase().includes(q)));
        }
        const sorted = [...list].sort((a, b) => cmp(a, b, sortKey, sortDir) || cmp(a, b, 'rank', 'asc'));
        return sorted.slice(0, limit);
    }, [normalized, query, sortKey, sortDir, limit]);

    const totals = useMemo(() => {
        const gms = rows.reduce((s, r) => s + (Number(r.gmsRevenue) || 0), 0);
        const units = rows.reduce((s, r) => s + (Number(r.gmsUnits) || 0), 0);
        const adSales = rows.reduce((s, r) => s + (Number(r.adSales) || 0), 0);
        const adSpend = rows.reduce((s, r) => s + (Number(r.adSpend) || 0), 0);
        const prev = rows.reduce((s, r) => s + (Number(r.prevGmsRevenue) || 0), 0);
        const base = periodTotal > 0 ? periodTotal : normalized.reduce((s, r) => s + r.gmsRevenue, 0);
        return {
            gms, units, adSales, adSpend, prev,
            share: base > 0 ? (gms / base) * 100 : 0,
            asp: units > 0 ? gms / units : 0,
            adShare: gms > 0 ? (adSales / gms) * 100 : 0,
            tacos: gms > 0 ? (adSpend / gms) * 100 : 0,
            deltaPct: prev > 0 ? ((gms - prev) / prev) * 100 : null,
        };
    }, [rows, normalized, periodTotal]);

    const maxShare = useMemo(() => Math.max(...rows.map((r) => Number(r.share) || 0), 1), [rows]);

    const exportCsv = useCallback(() => {
        downloadCsv(rows, `top-products-gms-${new Date().toISOString().slice(0, 10)}.csv`);
    }, [rows]);

    const meta = products.length > 0
        ? `${fmtNum(products.length)} ASINs with GMS · ranked by ordered revenue`
        : 'ranked by ordered revenue';

    return (
        <Panel
            id="ops-top-products"
            span={12}
            kicker="Top products · GMS"
            meta={meta}
            linkTo={links?.gmsTracker || links?.skuReport}
            linkLabel={links?.gmsTracker ? 'GMS tracker' : links?.skuReport ? 'SKU report' : undefined}
            actions={products.length > 0 ? (
                <span className="ops-panel__actions">
                    <input
                        type="search"
                        className="ops-search"
                        placeholder="Search ASIN, SKU, title, seller…"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        aria-label="Search top products"
                    />
                    <Segmented options={LIMITS} value={limit} onChange={setLimit} ariaLabel="Rows to show" />
                    <button type="button" className="ops-retry" onClick={exportCsv} title="Download the visible rows as CSV">CSV ↓</button>
                </span>
            ) : null}
        >
            {status === 'error' ? (
                <MiniState tone="error" title="Top products unavailable" note="Product GMS could not be loaded." onRetry={onRetry} />
            ) : products.length === 0 ? (
                <MiniState tone="empty" title="No product GMS" note="No ASIN recorded ordered revenue for this selection and period. Upload GMS data in the GMS tracker to populate this table." />
            ) : rows.length === 0 ? (
                <MiniState tone="empty" title="No matches" note={`No product matches “${query}”.`} />
            ) : (
                <div className="ops-table__wrap">
                    <table className="ops-table ops-table--dense">
                        <thead>
                            <tr>
                                {COLUMNS.map((c) => (
                                    c.sortable === false ? (
                                        <th key={c.key} className={c.numeric ? 'ops-table__num' : ''} style={c.width ? { width: c.width } : undefined}>{c.label}</th>
                                    ) : (
                                        <SortHeader
                                            key={c.key}
                                            label={c.label}
                                            sortKey={c.key}
                                            activeKey={sortKey}
                                            dir={sortDir}
                                            onSort={onSort}
                                            numeric={c.numeric}
                                            tip={c.tip}
                                            width={c.width}
                                        />
                                    )
                                ))}
                                <th style={{ width: 28 }} aria-label="expand" />
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((r) => {
                                const open = expanded === r.asin;
                                return (
                                    <React.Fragment key={r.id || r.asin}>
                                        <tr
                                            className={`ops-table__row ${open ? 'ops-table__row--open' : ''}`}
                                            onClick={() => setExpanded(open ? null : r.asin)}
                                            aria-expanded={open}
                                        >
                                            <td className="ops-table__num ops-num ops-table__rank">{r.rank}</td>
                                            <td className="ops-table__product">
                                                <div className="ops-table__code ops-num">{r.asin}{r.sku && r.sku !== r.asin ? <span className="ops-table__sku"> · {r.sku}</span> : null}</div>
                                                <div className="ops-table__title-cell" title={r.title}>{r.title}</div>
                                                <div className="ops-table__subline">{r.sellerName || '—'} · {r.category}</div>
                                            </td>
                                            <td className="ops-table__num ops-num ops-table__gms">
                                                <b>{fmtINR(r.gmsRevenue)}</b>
                                                <div className="ops-table__share">
                                                    <ShareBar pct={r.share} max={maxShare} />
                                                    <span>{fmtPct(r.share)}</span>
                                                </div>
                                            </td>
                                            <td className="ops-table__num"><Delta value={r.deltaPct} compact /></td>
                                            <td className="ops-table__num ops-num">{fmtNumFull(r.gmsUnits)}</td>
                                            <td className="ops-table__num ops-num">{r.asp > 0 ? fmtINRFull(r.asp) : '—'}</td>
                                            <td className="ops-table__num ops-num">
                                                {r.adSales > 0 ? fmtPct(r.adShare, 0) : <span className="ops-muted">no ads</span>}
                                            </td>
                                            <td className="ops-table__num ops-num">
                                                {r.adSpend > 0
                                                    ? <span style={{ color: r.tacos > 20 ? OPS_COLOR.neg : r.tacos > 10 ? OPS_COLOR.warn : OPS_COLOR.pos }}>{fmtPct(r.tacos)}</span>
                                                    : <span className="ops-muted">—</span>}
                                            </td>
                                            <td className="ops-table__spark">
                                                {Array.isArray(r.trend) && r.trend.length > 1
                                                    ? <Sparkline data={r.trend} width={120} height={22} color={OPS_COLOR.accent} />
                                                    : <span className="ops-muted">—</span>}
                                            </td>
                                            <td className="ops-table__chev" aria-hidden="true">{open ? '▾' : '▸'}</td>
                                        </tr>
                                        {open && (
                                            <tr className="ops-table__detailrow">
                                                <td colSpan={COLUMNS.length + 1}>
                                                    <ProductDetail row={r} labels={labels} granularity={granularity} links={links} periodDays={periodDays} />
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                );
                            })}
                        </tbody>
                        <tfoot>
                            <tr>
                                <td />
                                <td className="ops-table__foot-label">
                                    {rows.length} shown{query ? ' (filtered)' : ''} · <Tip text="Share of the period's total GMS held by the rows shown">{fmtPct(totals.share, 0)} of period GMS</Tip>
                                </td>
                                <td className="ops-table__num ops-num"><b>{fmtINR(totals.gms)}</b></td>
                                <td className="ops-table__num"><Delta value={totals.deltaPct} compact /></td>
                                <td className="ops-table__num ops-num">{fmtNumFull(totals.units)}</td>
                                <td className="ops-table__num ops-num">{totals.asp > 0 ? fmtINRFull(totals.asp) : '—'}</td>
                                <td className="ops-table__num ops-num">{totals.gms > 0 && totals.adSales > 0 ? fmtPct(totals.adShare, 0) : '—'}</td>
                                <td className="ops-table__num ops-num">{totals.gms > 0 && totals.adSpend > 0 ? fmtPct(totals.tacos) : '—'}</td>
                                <td colSpan={2} />
                            </tr>
                        </tfoot>
                    </table>
                </div>
            )}
        </Panel>
    );
};
