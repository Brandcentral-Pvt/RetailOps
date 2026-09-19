/**
 * Keyword Research — working surfaces.
 *
 * Saved lists, the watchlist and the multi-keyword comparison all run on data
 * the browser already holds (the module has no persistence by design), so these
 * panels are the place where "changed since last check" is answered: each saved
 * list and watched ASIN keeps a trimmed snapshot, and the diff against a fresh
 * search is what gets surfaced.
 */
import React, { useMemo, useState } from 'react';
import {
    Alert, Button, Drawer, Empty, Input, Popconfirm, Select, Tag, Tooltip as AntTooltip, message,
} from 'antd';
import {
    BellOutlined, CheckCircleFilled, DeleteOutlined, DownloadOutlined, EditOutlined,
    ExportOutlined, FolderOpenOutlined, ReloadOutlined, StarFilled, ThunderboltOutlined,
} from '@ant-design/icons';
import {
    Panel, MiniState, Chip, Segmented, SortHeader, fmtINR, fmtINRFull, fmtNumFull,
} from '../opsCenter/primitives';
import { Sparkline } from '../opsCenter/charts';
import { useKeywordExport, downloadBlob } from '../../hooks/useKeywordResearch';
import { ProductCell, MarketOverview, InsightList } from './panels';

const isNum = (v) => v !== null && v !== undefined && v !== '' && Number.isFinite(Number(v));
const int = (v) => (isNum(v) ? fmtNumFull(v) : '—');
const money = (v, full = false) => (isNum(v) ? (full ? fmtINRFull(v) : fmtINR(v)) : '—');
const pctText = (v, d = 1) => (isNum(v) ? `${Number(v).toFixed(d)}%` : '—');
const when = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
};

/* ───────────────────────────── export helper ───────────────────────────── */

export function useXlsxExport() {
    const exportMutation = useKeywordExport();
    const run = async ({ kind, dataset, label }) => {
        try {
            const { blob, fileName } = await exportMutation.mutateAsync({ kind, dataset, label });
            downloadBlob(blob, fileName);
            message.success(`Exported ${fileName}`);
        } catch (error) {
            message.error(error?.message || 'Export failed');
        }
    };
    return { run, loading: exportMutation.isPending };
}

export const ExportButton = ({ kind, dataset, label, disabled, size = 'small' }) => {
    const { run, loading } = useXlsxExport();
    return (
        <AntTooltip title={disabled ? 'Requires the keywords_export permission' : 'Download an XLSX of exactly what is on screen'}>
            <Button size={size} icon={<DownloadOutlined />} disabled={disabled} loading={loading} onClick={() => run({ kind, dataset, label })}>
                Export XLSX
            </Button>
        </AntTooltip>
    );
};

/* ───────────────────────────── comparison ───────────────────────────── */

const COMPARE_COLUMNS = [
    { key: 'keyword', label: 'Keyword' },
    { key: 'products', label: 'Products', numeric: true },
    { key: 'opportunity', label: 'Opportunity', numeric: true },
    { key: 'band', label: 'Band' },
    { key: 'medianPrice', label: 'Median price', numeric: true },
    { key: 'avgDiscount', label: 'Avg disc.', numeric: true },
    { key: 'avgRating', label: 'Avg ★', numeric: true },
    { key: 'medianBsr', label: 'Median BSR', numeric: true },
    { key: 'top3Share', label: 'Top-3 reviews', numeric: true },
    { key: 'topBrand', label: 'Leading brand' },
    { key: 'ourListings', label: 'Yours', numeric: true },
    { key: 'bestPosition', label: 'Best pos.', numeric: true },
];

const compareRow = (r) => ({
    keyword: r.keyword,
    products: r.market?.sample?.products ?? null,
    opportunity: r.market?.opportunity?.score ?? null,
    band: r.market?.opportunity?.band || 'unknown',
    medianPrice: r.market?.price?.median ?? null,
    avgDiscount: r.market?.price?.avgDiscountPct ?? null,
    avgRating: r.market?.ratings?.avg ?? null,
    medianBsr: r.market?.bsr?.median ?? null,
    top3Share: r.market?.ratings?.reviewMoat?.top3Share ?? null,
    topBrand: r.market?.brands?.topBrand?.brand || '—',
    ourListings: r.catalog?.summary?.matchedCount ?? null,
    bestPosition: r.catalog?.summary?.bestPosition ?? null,
    error: r.error || null,
    raw: r,
});

const BAND_CHIP = {
    strong: { bg: '#dcfce7', fg: '#166534' },
    workable: { bg: '#e0f2fe', fg: '#075985' },
    crowded: { bg: '#fef3c7', fg: '#92400e' },
    avoid: { bg: '#fee2e2', fg: '#991b1b' },
    unknown: { bg: '#eef1f5', fg: '#51607a' },
};

export const ComparePanel = ({ results = [], progress, onSelect, selectedKeyword, canExport }) => {
    const [sort, setSort] = useState({ key: 'opportunity', dir: 'desc' });
    const [bandFilter, setBandFilter] = useState('all');

    const rows = useMemo(() => {
        const mapped = results.map(compareRow).filter((r) => (bandFilter === 'all' ? true : r.band === bandFilter));
        const dir = sort.dir === 'asc' ? 1 : -1;
        return mapped.sort((a, b) => {
            const av = a[sort.key];
            const bv = b[sort.key];
            if (isNum(av) && isNum(bv)) return (Number(av) - Number(bv)) * dir;
            if (typeof av === 'string' && typeof bv === 'string') return av.localeCompare(bv) * dir;
            if (av === null || av === undefined) return 1;
            if (bv === null || bv === undefined) return -1;
            return 0;
        });
    }, [results, sort, bandFilter]);

    const onSort = (key) => setSort((s) => ({ key, dir: s.key === key && s.dir === 'desc' ? 'asc' : 'desc' }));

    if (!results.length && !progress?.running) return null;

    return (
        <Panel
            span={12}
            id="panel-compare"
            kicker="Keyword comparison"
            meta={progress?.running
                ? `${progress.done} / ${progress.total} keywords · ${progress.elapsed ? `${(progress.elapsed / 1000).toFixed(0)}s elapsed` : ''}`
                : `${rows.length} keywords · ${results.filter((r) => r.market?.opportunity?.score >= 55).length} workable or better`}
            actions={(
                <span className="kw-filteractions">
                    <Segmented
                        ariaLabel="Opportunity band"
                        value={bandFilter}
                        onChange={setBandFilter}
                        options={[
                            { value: 'all', label: 'All' },
                            { value: 'strong', label: 'Strong' },
                            { value: 'workable', label: 'Workable' },
                            { value: 'crowded', label: 'Crowded' },
                            { value: 'avoid', label: 'Hard' },
                        ]}
                    />
                    <ExportButton kind="batch" dataset={{ results, meta: progress }} label="keyword-comparison" disabled={!canExport} />
                </span>
            )}
        >
            {progress?.running ? (
                <div className="kw-progress">
                    <div className="kw-progress__bar"><span style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }} /></div>
                    <span className="kw-muted">
                        Batch runs {progress.concurrency || 2} keywords at a time — the upstream API allows one call per 1.1s.
                    </span>
                </div>
            ) : null}

            <div className="ops-table__wrap kw-scroll kw-table-scroll">
                <table className="ops-table ops-table--dense">
                    <thead>
                        <tr>
                            {COMPARE_COLUMNS.map((c) => (
                                <th key={c.key} className={c.numeric ? 'ops-num' : undefined}>
                                    <SortHeader
                                        label={c.label}
                                        sortKey={c.key}
                                        activeKey={sort.key}
                                        dir={sort.dir}
                                        onSort={onSort}
                                        numeric={c.numeric}
                                    />
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row) => (
                            <tr
                                key={row.keyword}
                                className={`ops-table__row kw-clickrow ${selectedKeyword === row.keyword ? 'ops-table__row--open' : ''}`}
                                onClick={() => onSelect?.(row.raw)}
                            >
                                <td>
                                    <strong>{row.keyword}</strong>
                                    {row.error ? <div className="kw-errline">{row.error}</div> : null}
                                </td>
                                <td className="ops-num">{int(row.products)}</td>
                                <td className="ops-num">{row.opportunity === null ? '—' : row.opportunity}</td>
                                <td><Chip label={row.band} palette={{ [row.band.toUpperCase()]: BAND_CHIP[row.band] || BAND_CHIP.unknown }} /></td>
                                <td className="ops-num">{money(row.medianPrice)}</td>
                                <td className="ops-num">{pctText(row.avgDiscount)}</td>
                                <td className="ops-num">{isNum(row.avgRating) ? Number(row.avgRating).toFixed(2) : '—'}</td>
                                <td className="ops-num">{int(row.medianBsr)}</td>
                                <td className="ops-num">{pctText(row.top3Share, 0)}</td>
                                <td>{row.topBrand}</td>
                                <td className="ops-num">{int(row.ourListings)}</td>
                                <td className="ops-num">{row.bestPosition === null ? '—' : `#${row.bestPosition}`}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {rows.length === 0 ? <MiniState tone="empty" title="No keywords match this band" /> : null}
        </Panel>
    );
};

/* ───────────────────────────── saved lists ───────────────────────────── */

export const SavedListsPanel = ({
    lists = [], stats, onOpen, onRecheck, onRename, onDelete, onClearAll, canExport, checkingId, exportDatasetFor,
}) => {
    const diffTotalTotal = lists.reduce((s, l) => s + (l.lastDiff?.total || 0), 0);
    return (
        <Panel
            span={8}
            id="panel-saved"
        kicker="Saved lists"
        meta={`${lists.length} saved · ${stats?.kb ?? 0} kB local${diffTotalTotal ? ` · ${diffTotalTotal} pending change${diffTotalTotal === 1 ? '' : 's'}` : ''}`}
        actions={(
            <AntTooltip title="Saved lists, the watchlist and recent searches live in this browser only — the module stores nothing server-side.">
                <Button size="small" icon={<DeleteOutlined />} onClick={onClearAll} disabled={!lists.length && !stats?.watchlist && !stats?.recent}>Clear local data</Button>
            </AntTooltip>
        )}
    >
        {lists.length === 0 ? (
            <MiniState
                tone="empty"
                title="No saved lists yet"
                note="Save a search (or a whole comparison) and it will be re-checked against fresh results on demand — the diff tells you what moved."
            />
        ) : (
            <div className="kw-savedlist">
                {lists.map((l) => {
                    const diff = l.lastDiff;
                    const name = l.name || l.keyword;
                    return (
                        <div className="kw-savedrow" key={l.id}>
                            <div className="kw-savedrow__head">
                                <button type="button" className="ops-linkbtn" onClick={() => onOpen(l)} title="Open this search">
                                    <FolderOpenOutlined /> {name}
                                </button>
                                <span className="kw-muted">
                                    {l.kind === 'batch' ? `${(l.keywords || []).length} keywords` : l.keyword} · saved {when(l.createdAt)}
                                    {l.checks ? ` · checked ${l.checks}×` : ''}
                                </span>
                            </div>

                            {l.snapshot ? (
                                <div className="kw-savedrow__snapshot">
                                    <span className="ops-num">{int(l.snapshot.market?.products)} products</span>
                                    <span className="ops-num">median {money(l.snapshot.market?.medianPrice)}</span>
                                    <span className="ops-num">opportunity {int(l.snapshot.market?.opportunityScore)}</span>
                                    <span className="ops-num">yours {int(l.snapshot.market?.ourListings)}</span>
                                    <span className="kw-muted">snapshot {when(l.snapshot.capturedAt)}</span>
                                </div>
                            ) : <span className="kw-muted">No snapshot yet — re-check to start tracking changes.</span>}

                            {diff ? (
                                <div className="kw-savedrow__diff">
                                    <strong>{diff.total} change{diff.total === 1 ? '' : 's'} since {when(diff.at)}</strong>
                                    {diff.market?.map((m) => <span key={m.key} className="kw-diffchip">{m.label}: {m.display}</span>)}
                                    {diff.entered?.map((i) => <span key={`in-${i.asin}`} className="kw-diffchip kw-diffchip--in">new #{i.position} {i.asin}</span>)}
                                    {diff.left?.map((i) => <span key={`out-${i.asin}`} className="kw-diffchip kw-diffchip--out">out {i.asin}</span>)}
                                    {diff.tracked?.map((i) => <span key={`tr-${i.asin}`} className="kw-diffchip">{i.asin}: {i.changes.map((c) => c.display).join(', ')}</span>)}
                                </div>
                            ) : null}

                            <div className="kw-savedrow__actions">
                                <Button size="small" icon={<ReloadOutlined />} loading={checkingId === l.id} onClick={() => onRecheck(l)}>Re-check</Button>
                                <RenameInline name={name} onRename={(v) => onRename(l.id, v)} />
                                <ExportButton
                                    kind={l.kind === 'batch' ? 'batch' : 'single'}
                                    dataset={exportDatasetFor ? exportDatasetFor(l) : null}
                                    label={name}
                                    disabled={!canExport || !exportDatasetFor || !exportDatasetFor(l)}
                                />
                                <Popconfirm title="Delete this saved list?" onConfirm={() => onDelete(l.id)} okText="Delete" cancelText="Keep">
                                    <Button size="small" danger icon={<DeleteOutlined />}>Delete</Button>
                                </Popconfirm>
                            </div>
                        </div>
                    );
                })}
            </div>
        )}
        <span className="kw-muted kw-footnote">
            Re-check re-runs the saved search (usually from the server's 10-minute snapshot cache) and diffs it against the stored snapshot.
        </span>
    </Panel>
);};

const RenameInline = ({ name, onRename }) => {
    const [editing, setEditing] = useState(false);
    const [value, setValue] = useState(name);
    if (!editing) {
        return <Button size="small" icon={<EditOutlined />} onClick={() => { setValue(name); setEditing(true); }}>Rename</Button>;
    }
    return (
        <span className="kw-inline-edit">
            <Input
                size="small"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onPressEnter={() => { onRename(value); setEditing(false); }}
                autoFocus
            />
            <Button size="small" type="primary" onClick={() => { onRename(value); setEditing(false); }}>OK</Button>
            <Button size="small" onClick={() => setEditing(false)}>Cancel</Button>
        </span>
    );
};

/* ───────────────────────────── watchlist ───────────────────────────── */

export const WatchlistPanel = ({ watchlist = [], alerts = [], onRemove, onNote, onCheck, checking, keywordHits = {} }) => {
    const alertMap = useMemo(() => {
        const m = new Map();
        alerts.forEach((a) => m.set(a.asin, a));
        return m;
    }, [alerts]);

    return (
        <Panel
            span={8}
            id="panel-watchlist"
            kicker="Watchlist"
            meta={`${watchlist.length} watched${alerts.length ? ` · ${alerts.length} moved` : ''}`}
            actions={<Button size="small" icon={<BellOutlined />} loading={checking} onClick={onCheck} disabled={!watchlist.length}>Check for changes</Button>}
        >
            {watchlist.length === 0 ? (
                <MiniState
                    tone="empty"
                    title="Nothing watched yet"
                    note="Star a listing in the results table to track its price, reviews, rank and position over time. Alerts appear the next time you run a search that covers it."
                />
            ) : (
                <div className="kw-watchlist">
                    {watchlist.map((w) => {
                        const current = alertMap.get(w.asin);
                        const hits = keywordHits[w.asin] || 0;
                        const prices = (w.history || []).map((h) => h.price).filter(isNum);
                        return (
                            <div className="kw-watchrow" key={w.asin}>
                                <div className="kw-watchrow__head">
                                    <div>
                                        <a className="kw-watchtitle" href={`https://www.amazon.in/dp/${w.asin}`} target="_blank" rel="noreferrer">{w.title || w.asin}</a>
                                        <div className="kw-muted">
                                            <span className="ops-table__code">{w.asin}</span> · {w.keyword || 'unlinked'} · added {when(w.addedAt)}
                                            {hits ? ` · seen in ${hits} search${hits === 1 ? '' : 'es'}` : ''}
                                        </div>
                                    </div>
                                    <div className="kw-watchrow__actions">
                                        <Popconfirm title="Stop watching this listing?" onConfirm={() => onRemove(w.asin)} okText="Remove" cancelText="Keep">
                                            <Button size="small" type="text" danger icon={<DeleteOutlined />} />
                                        </Popconfirm>
                                    </div>
                                </div>

                                <div className="kw-watchrow__stats">
                                    <span><em>Price</em><b className="ops-num">{money(w.snapshot?.price, true)}</b></span>
                                    <span><em>Rating</em><b className="ops-num">{isNum(w.snapshot?.rating) ? Number(w.snapshot.rating).toFixed(1) : '—'}</b></span>
                                    <span><em>Reviews</em><b className="ops-num">{int(w.snapshot?.reviewCount)}</b></span>
                                    <span><em>BSR</em><b className="ops-num">{int(w.snapshot?.mainBSR)}</b></span>
                                    <span><em>Position</em><b className="ops-num">{w.snapshot?.position ? `#${w.snapshot.position}` : '—'}</b></span>
                                    {prices.length > 1 ? <Sparkline data={prices} width={110} height={24} /> : null}
                                </div>

                                {current?.alerts?.length ? (
                                    <div className="kw-watchrow__alerts">
                                        {current.alerts.map((a) => (
                                            <span key={a.field} className={`kw-alertchip kw-alertchip--${a.direction}`}>
                                                {a.label} {a.display}
                                            </span>
                                        ))}
                                    </div>
                                ) : w.lastAlerts?.length ? (
                                    <div className="kw-watchrow__alerts">
                                        {w.lastAlerts.map((a) => (
                                            <span key={a.field} className="kw-alertchip kw-alertchip--flat">{a.label} {a.display}</span>
                                        ))}
                                    </div>
                                ) : (
                                    <span className="kw-muted">No movement since the last check.</span>
                                )}

                                <Input
                                    size="small"
                                    className="kw-watchnote"
                                    placeholder="Note (e.g. price-match candidate)"
                                    value={w.note}
                                    onChange={(e) => onNote(w.asin, e.target.value)}
                                />
                            </div>
                        );
                    })}
                </div>
            )}
        </Panel>
    );
};

export const WatchAlertBanner = ({ alerts = [], onDismiss }) => {
    if (!alerts.length) return null;
    return (
        <div className="kw-alertbanner">
            <BellOutlined />
            <div>
                <strong>{alerts.length} watched listing{alerts.length === 1 ? '' : 's'} moved</strong>
                <div className="kw-alertbanner__lines">
                    {alerts.slice(0, 5).map((a) => (
                        <span key={a.asin}>
                            {a.asin}: {a.alerts.map((x) => `${x.label} ${x.display}`).join(' · ')}
                        </span>
                    ))}
                </div>
            </div>
            <Button size="small" onClick={onDismiss}>Dismiss</Button>
        </div>
    );
};

/* ───────────────────────────── product drawer ───────────────────────────── */

export const ProductDrawer = ({ item, open, onClose, watched, onWatch }) => {
    if (!item) return null;
    const rows = [
        ['ASIN', item.asin],
        ['Parent ASIN', item.parentAsin],
        ['Brand', item.brand],
        ['Manufacturer', item.manufacturer],
        ['Category', item.category],
        ['Seller', item.seller],
        ['Amazon seller id', item.sellerId],
        ['Condition', item.condition],
        ['Availability', item.availability],
        ['Colour', item.color],
        ['Size', item.size],
        ['Main BSR', isNum(item.mainBSR) ? int(item.mainBSR) : null],
        ['Sub BSR', isNum(item.subBSR) ? int(item.subBSR) : null],
        ['Buy box winner', item.isBuyBoxWinner ? 'yes' : 'no'],
        ['Currency', item.currency],
    ].filter(([, v]) => v !== null && v !== undefined && v !== '');

    return (
        <Drawer
            width={560}
            open={open}
            onClose={onClose}
            title={item.title || item.asin}
            extra={(
                <span className="kw-drawer-actions">
                    <Button
                        size="small"
                        icon={watched ? <StarFilled /> : undefined}
                        onClick={() => onWatch?.(item)}
                    >
                        {watched ? 'Watching' : 'Watch'}
                    </Button>
                    <Button size="small" type="link" href={item.detailPageURL || `https://www.amazon.in/dp/${item.asin}`} target="_blank" rel="noreferrer" icon={<ExportOutlined />}>Amazon</Button>
                </span>
            )}
        >
            <div className="kw-drawer">
                <div className="kw-drawer__price">
                    <div>
                        <span className="kw-muted">Price</span>
                        <div className="kw-drawer__pricevalue ops-num">{money(item.price, true)}</div>
                        {isNum(item.mrp) ? <span className="kw-muted">MRP {money(item.mrp, true)} · {pctText(item.discountPercent, 0)} off</span> : null}
                    </div>
                    <div>
                        <span className="kw-muted">Rating</span>
                        <div className="kw-drawer__pricevalue ops-num">{isNum(item.rating) ? `${Number(item.rating).toFixed(1)}★` : '—'}</div>
                        <span className="kw-muted">{int(item.reviewCount)} reviews</span>
                    </div>
                    <div>
                        <span className="kw-muted">Position here</span>
                        <div className="kw-drawer__pricevalue ops-num">{item.position ? `#${item.position}` : '—'}</div>
                        <span className="kw-muted">{item.keyword || ''}</span>
                    </div>
                </div>

                {item.inCatalog ? (
                    <Alert
                        type="success"
                        showIcon
                        icon={<CheckCircleFilled />}
                        message={`You sell this (${item.ourListings.map((l) => l.sellerName || l.sellerId).join(', ')})`}
                        description={(
                            <div className="kw-drawer__ours">
                                {item.ourListings.map((l) => (
                                    <div key={`${l.sellerId}-${l.sku}`} className="kw-drawer__ourrow">
                                        <span>{l.sellerName || l.sellerId} · {l.sku || 'no SKU'} · {l.status || '—'}</span>
                                        <span className="ops-num">
                                            {money(l.price)} · {int(l.reviewCount)} reviews · BSR {int(l.bsr)}
                                            {l.priceVsMarketMedianPct !== null ? ` · ${Number(l.priceVsMarketMedianPct) > 0 ? '+' : ''}${Number(l.priceVsMarketMedianPct).toFixed(1)}% vs median` : ''}
                                        </span>
                                        {l.missingTerms?.length ? (
                                            <span className="kw-drawer__missing">missing terms: {l.missingTerms.map((t) => t.term).join(', ')}</span>
                                        ) : null}
                                    </div>
                                ))}
                            </div>
                        )}
                    />
                ) : (
                    <Alert type="info" showIcon message="Not in your catalog" description="None of your assigned sellers list this ASIN." />
                )}

                {Array.isArray(item.bulletPoints) && item.bulletPoints.length ? (
                    <div className="kw-drawer__bullets">
                        <span className="ops-panel__kicker">Bullets</span>
                        <ul>{item.bulletPoints.map((b, i) => <li key={i}>{b}</li>)}</ul>
                    </div>
                ) : null}

                <div className="ops-table__wrap">
                    <table className="ops-table ops-table--dense">
                        <tbody>
                            {rows.map(([k, v]) => (
                                <tr key={k} className="ops-table__row">
                                    <td className="ops-statrow__label">{k}</td>
                                    <td>{String(v)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </Drawer>
    );
};

/* ───────────────────────────── AI analysis ───────────────────────────── */

export const AnalysisRunner = ({ value, onChange, onRun, loading, itemCount, onItemCount, scopeLabel, canRefresh, forceRefresh, onForceRefresh }) => (
    <Panel
        span={12}
        kicker="AI analysis"
        meta={`LLM reads the top ${itemCount} listings for the seed keyword and returns keyword suggestions, gaps and angles${canRefresh ? ' · force refresh bypasses the snapshot cache' : ''}`}
    >
        <div className="kw-filterbar">
            <Input
                size="large"
                className="kw-searchinput"
                placeholder="Seed keyword or product idea — e.g. insulated water bottle for gym"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                onPressEnter={onRun}
                allowClear
            />
            <Select
                size="large"
                value={String(itemCount)}
                onChange={(v) => onItemCount(Number(v))}
                options={[5, 10, 15, 20].map((n) => ({ value: String(n), label: `Top ${n}` }))}
                style={{ width: 110 }}
            />
            {canRefresh ? (
                <Button size="large" onClick={() => onForceRefresh(!forceRefresh)} type={forceRefresh ? 'primary' : 'default'} ghost={forceRefresh}>
                    {forceRefresh ? 'Refreshing' : 'Use cache'}
                </Button>
            ) : null}
            <Button type="primary" size="large" icon={<ThunderboltOutlined />} loading={loading} onClick={onRun}>
                Analyze
            </Button>
        </div>
        <span className="kw-muted kw-footnote">
            Runs the configured LLM (NVIDIA NIM, llama-3.1-8b) — if the model is unavailable the analysis falls back to title word-frequency,
            and either way the deterministic market statistics and catalog flags next to it are computed from the same product set. Seller scope: {scopeLabel}.
        </span>
    </Panel>
);

export const AnalysisPanel = ({ analysis, source, keyword, market, catalog, insights, items, canExport, onTerm, onWatch, watched = [], onOpen }) => {
    if (!analysis) return null;

    return (
        <>
            <Panel
                span={12}
                id="panel-ai"
                kicker={`AI keyword plan — “${keyword}”`}
                meta={source === 'fallback'
                    ? 'deterministic fallback (the model was unavailable)'
                    : 'model output — treat as a starting point, verify against the numbers'}
                actions={<ExportButton kind="analysis" dataset={{ keyword, analysis, market, catalog, insights, items, source }} label={`ai-${keyword}`} disabled={!canExport} />}
            >
                {analysis.summary ? (
                    <div className="kw-aisummary">
                        <div>
                            <span className="kw-muted">Best single opportunity</span>
                            <div className="kw-aibest">{analysis.summary.bestOpportunity || '—'}</div>
                        </div>
                        <p>{analysis.summary.strategy}</p>
                    </div>
                ) : null}

                {analysis.suggestedKeywords?.length ? (
                    <div className="kw-aigrid">
                        {analysis.suggestedKeywords.map((k, i) => (
                            <div className="kw-aicard" key={`${k.keyword}-${i}`}>
                                <div className="kw-aicard__top">
                                    <button type="button" className="ops-linkbtn" onClick={() => onTerm?.(k.keyword)}>{k.keyword}</button>
                                    <span className={`kw-aiscore ops-num ${k.opportunityScore >= 70 ? 'kw-aiscore--hi' : k.opportunityScore >= 40 ? 'kw-aiscore--mid' : 'kw-aiscore--lo'}`}>
                                        {k.opportunityScore}
                                    </span>
                                </div>
                                <div className="kw-aicard__tags">
                                    <Tag>{k.type}</Tag>
                                    <Tag color={k.searchVolume === 'High' ? 'green' : k.searchVolume === 'Medium' ? 'orange' : 'default'}>{k.searchVolume} volume</Tag>
                                    <Tag color={k.competition === 'Low' ? 'green' : k.competition === 'High' ? 'red' : 'orange'}>{k.competition} competition</Tag>
                                </div>
                                <p>{k.rationale}</p>
                            </div>
                        ))}
                    </div>
                ) : null}

                <div className="kw-airow">
                    {analysis.keywordGaps?.length ? (
                        <div className="kw-aicol">
                            <span className="ops-panel__kicker">Gaps the page does not cover</span>
                            {analysis.keywordGaps.map((g, i) => (
                                <div className="kw-aigap" key={`${g.category}-${i}`}>
                                    <strong>{g.category || 'General'}</strong>
                                    <div className="kw-aitags">
                                        {(g.missingKeywords || []).map((mk) => (
                                            <button type="button" key={mk} className="kw-term kw-term--sm" onClick={() => onTerm?.(mk)}>{mk}</button>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : null}
                    {analysis.categoryOpportunities?.length ? (
                        <div className="kw-aicol">
                            <span className="ops-panel__kicker">Adjacent categories</span>
                            {analysis.categoryOpportunities.map((c, i) => (
                                <div className="kw-aigap" key={`${c.category}-${i}`}>
                                    <strong>{c.category}</strong>
                                    <div className="kw-aitags">
                                        {(c.suggestedKeywords || []).map((sk) => (
                                            <button type="button" key={sk} className="kw-term kw-term--sm" onClick={() => onTerm?.(sk)}>{sk}</button>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : null}
                    {analysis.trendingTerms?.length ? (
                        <div className="kw-aicol">
                            <span className="ops-panel__kicker">Trending terms</span>
                            <div className="kw-aitags">
                                {analysis.trendingTerms.map((t) => (
                                    <button type="button" key={t} className="kw-term kw-term--sm" onClick={() => onTerm?.(t)}>{t}</button>
                                ))}
                            </div>
                        </div>
                    ) : null}
                </div>
            </Panel>

            <MarketOverview result={{ market, catalog }} onFocus={() => {}} />
            <InsightList insights={insights} span={4} />

            {items?.length ? (
                <Panel span={12} kicker="Products the model read" meta={`${items.length} listings · ${items.filter((i) => i.inCatalog).length} in your catalog`}>
                    <div className="ops-table__wrap kw-scroll kw-table-scroll">
                        <table className="ops-table ops-table--dense">
                            <thead>
                                <tr>
                                    <th className="ops-num">#</th>
                                    <th>Product</th>
                                    <th className="ops-num">Price</th>
                                    <th className="ops-num">Rating</th>
                                    <th className="ops-num">Reviews</th>
                                    <th className="ops-num">BSR</th>
                                    <th>Catalog</th>
                                </tr>
                            </thead>
                            <tbody>
                                {items.map((item) => (
                                    <tr className="ops-table__row kw-clickrow" key={item.asin} onClick={() => onOpen?.(item)}>
                                        <td className="ops-num ops-table__rank">{item.position ?? '—'}</td>
                                        <td><ProductCell item={item} onWatch={onWatch} watched={watched.includes(item.asin)} /></td>
                                        <td className="ops-num">{money(item.price)}</td>
                                        <td className="ops-num">{isNum(item.rating) ? Number(item.rating).toFixed(1) : '—'}</td>
                                        <td className="ops-num">{int(item.reviewCount)}</td>
                                        <td className="ops-num">{int(item.mainBSR)}</td>
                                        <td>{item.inCatalog ? <Chip label="you sell" palette={{ 'YOU SELL': { bg: '#dcfce7', fg: '#166534' } }} /> : '—'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </Panel>
            ) : null}
        </>
    );
};

