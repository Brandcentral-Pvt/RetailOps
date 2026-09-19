/**
 * Keyword Research — analysis panels.
 *
 * Every panel is fed the same enriched payload the API returns
 * (`{ items, market, catalog, insights, raw }`) and renders it with the shared
 * opsCenter primitives so the page reads as part of the platform rather than a
 * bespoke screen. Numbers are printed exactly as measured, with the sample size
 * next to them, and "—" wherever the API had nothing to give.
 */
import React, { useState } from 'react';
import { Button, Input, Pagination, Select, Tag, Tooltip as AntTooltip } from 'antd';
import {
    CheckCircleFilled, DownloadOutlined, PlusOutlined, ReloadOutlined, SearchOutlined,
    StarFilled, StarOutlined, ThunderboltOutlined,
} from '@ant-design/icons';
import {
    Panel, MiniState, Delta, Chip, Segmented, SegmentedBar, SortHeader, ShareBar, Tip,
    fmtINR, fmtINRFull, fmtNumFull,
} from '../opsCenter/primitives';
import { Bars, Ring } from '../opsCenter/charts';

/* ───────────────────────────── helpers ───────────────────────────── */

const isNum = (v) => v !== null && v !== undefined && v !== '' && Number.isFinite(Number(v));
const pct = (v, d = 1) => (isNum(v) ? `${Number(v).toFixed(d)}%` : '—');
const int = (v) => (isNum(v) ? fmtNumFull(v) : '—');
const money = (v, full = false) => (isNum(v) ? (full ? fmtINRFull(v) : fmtINR(v)) : '—');
const TONE_COLOR = { pos: '#15803d', neg: '#b91c1c', warn: '#b45309', info: '#1349c6' };

/** Opportunity band → the platform's delta vocabulary. */
const bandMeta = (band) => ({
    strong: { label: 'Strong opportunity', cls: 'ops-delta--pos' },
    workable: { label: 'Workable', cls: 'ops-delta--pos' },
    crowded: { label: 'Crowded', cls: 'ops-delta--neutral' },
    avoid: { label: 'Hard to win', cls: 'ops-delta--neg' },
    unknown: { label: 'Not enough data', cls: 'ops-delta--none' },
}[band] || { label: 'Not enough data', cls: 'ops-delta--none' });

export const ProductThumb = ({ src, alt }) => (
    src ? (
        <img
            className="kw-thumb"
            src={src}
            alt={alt || ''}
            loading="lazy"
            onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }}
        />
    ) : <span className="kw-thumb kw-thumb--empty" aria-hidden="true" />
);

/**
 * Product ASIN cell shared by the search and compare tables: thumbnail, title,
 * catalog flags and the ratings line.
 */
export const ProductCell = ({ item, onWatch, watched, onOpen, showKeyword }) => (
    <div className="ops-table__product">
        <ProductThumb src={item.mainImage} alt={item.title} />
        <div className="ops-table__title-cell">
            <div className="kw-title-line">
                {showKeyword && item.keyword ? <Tag className="kw-kwtag">{item.keyword}</Tag> : null}
                {onOpen ? (
                    <button type="button" className="ops-linkbtn kw-title-btn" onClick={() => onOpen(item)} title={item.title}>
                        {item.title || '—'}
                    </button>
                ) : <span title={item.title}>{item.title || '—'}</span>}
            </div>
            <div className="ops-table__subline">
                <span className="ops-table__code">{item.asin}</span>
                {isNum(item.rating) ? (
                    <span className="kw-rating"><StarFilled /> {Number(item.rating).toFixed(1)} · {int(item.reviewCount)} reviews</span>
                ) : <span className="kw-muted">no rating</span>}
                {isNum(item.mainBSR) ? <span className="kw-muted">BSR {int(item.mainBSR)}</span> : null}
                {item.isBuyBoxWinner ? <Chip label="buy box" palette={{ 'BUY BOX': { bg: '#e0e7ff', fg: '#3730a3' } }} /> : null}
            </div>
            {Array.isArray(item.ourListings) && item.ourListings.length > 0 ? (
                <div className="kw-ourline">
                    <CheckCircleFilled className="kw-ours" />
                    <span>
                        You sell this — {item.ourListings.map((l) => l.sellerName || l.sellerId).join(', ')}
                        {isNum(item.ourListings[0].priceVsMarketMedianPct)
                            ? ` · ${Number(item.ourListings[0].priceVsMarketMedianPct) > 0 ? '+' : ''}${Number(item.ourListings[0].priceVsMarketMedianPct).toFixed(1)}% vs market median`
                            : ''}
                        {item.ourListings[0].missingTerms?.length
                            ? ` · ${item.ourListings[0].missingTerms.length} title terms you don't use`
                            : ''}
                    </span>
                </div>
            ) : null}
        </div>
        {onWatch ? (
            <AntTooltip title={watched ? 'Remove from watchlist' : 'Watch this listing'}>
                <button type="button" className={`kw-star ${watched ? 'kw-star--on' : ''}`} onClick={() => onWatch(item)} aria-label={watched ? 'Remove from watchlist' : 'Watch this listing'}>
                    {watched ? <StarFilled /> : <StarOutlined />}
                </button>
            </AntTooltip>
        ) : null}
    </div>
);

/* ───────────────────────────── filter bar ───────────────────────────── */

export const FilterBar = ({
    filters, onFilters, categories = [], onSearch, loading, canRefresh, onRefresh, scope, meta, children,
}) => {
    const set = (patch) => onFilters({ ...filters, ...patch });
    return (
        <Panel
            span={12}
            kicker="Search"
            meta={(
                <span className="kw-filtermmeta">
                    {scope?.isGlobal ? 'All sellers' : `${scope?.sellerIds?.length || 0} assigned seller${scope?.sellerIds?.length === 1 ? '' : 's'}`}
                    {meta?.cache?.entries ? ` · ${meta.cache.entries} cached snapshots (${meta.cache.hitRate ?? 0}% hit rate)` : ''}
                </span>
            )}
            actions={(
                <span className="kw-filteractions">
                    {canRefresh ? (
                        <AntTooltip title="Bypass the shared snapshot cache and re-query the API (keywords_manage)">
                            <Button size="small" icon={<ReloadOutlined />} onClick={onRefresh} loading={loading}>Force refresh</Button>
                        </AntTooltip>
                    ) : null}
                    {children}
                </span>
            )}
        >
            <div className="kw-filterbar">
                <Input
                    className="kw-searchinput"
                    size="large"
                    allowClear
                    placeholder="Seed keyword — e.g. stainless steel water bottle"
                    prefix={<SearchOutlined />}
                    value={filters.keywords}
                    onChange={(e) => set({ keywords: e.target.value })}
                    onPressEnter={onSearch}
                />
                <Button type="primary" size="large" icon={<ThunderboltOutlined />} onClick={onSearch} loading={loading}>Search</Button>
            </div>

            <div className="kw-filtergrid">
                <label className="kw-field">
                    <span>Category</span>
                    <Select
                        size="small"
                        value={filters.searchIndex || 'All'}
                        onChange={(v) => set({ searchIndex: v })}
                        options={categories.map((c) => ({ value: c.value, label: c.label }))}
                        showSearch
                        optionFilterProp="label"
                    />
                </label>
                <label className="kw-field">
                    <span>Brand</span>
                    <Input size="small" allowClear placeholder="Any brand" value={filters.brand} onChange={(e) => set({ brand: e.target.value })} />
                </label>
                <label className="kw-field kw-field--pair">
                    <span>Price (₹)</span>
                    <span className="kw-pair">
                        <Input size="small" type="number" min="0" placeholder="min" value={filters.minPrice} onChange={(e) => set({ minPrice: e.target.value })} />
                        <Input size="small" type="number" min="0" placeholder="max" value={filters.maxPrice} onChange={(e) => set({ maxPrice: e.target.value })} />
                    </span>
                </label>
                <label className="kw-field">
                    <span>Min rating</span>
                    <Select
                        size="small"
                        value={filters.minReviewsRating || ''}
                        onChange={(v) => set({ minReviewsRating: v })}
                        options={[
                            { value: '', label: 'Any' },
                            { value: '3', label: '3★ and up' },
                            { value: '4', label: '4★ and up' },
                            { value: '4.5', label: '4.5★ and up' },
                        ]}
                    />
                </label>
                <label className="kw-field">
                    <span>Min discount</span>
                    <Select
                        size="small"
                        value={filters.minSavingPercent || ''}
                        onChange={(v) => set({ minSavingPercent: v })}
                        options={[
                            { value: '', label: 'Any' },
                            { value: '10', label: '10%+' },
                            { value: '25', label: '25%+' },
                            { value: '50', label: '50%+' },
                        ]}
                    />
                </label>
                <label className="kw-field">
                    <span>Availability</span>
                    <Select
                        size="small"
                        value={filters.availability || ''}
                        onChange={(v) => set({ availability: v })}
                        options={[
                            { value: '', label: 'Default' },
                            { value: 'Available', label: 'Available only' },
                            { value: 'IncludeOutOfStock', label: 'Include out of stock' },
                        ]}
                    />
                </label>
                <label className="kw-field">
                    <span>Condition</span>
                    <Select
                        size="small"
                        value={filters.condition || ''}
                        onChange={(v) => set({ condition: v })}
                        options={[
                            { value: '', label: 'Any' },
                            { value: 'New', label: 'New' },
                            { value: 'Used', label: 'Used' },
                            { value: 'Renewed', label: 'Renewed' },
                        ]}
                    />
                </label>
                <label className="kw-field">
                    <span>Sort</span>
                    <Select
                        size="small"
                        value={filters.sortBy || 'Featured'}
                        onChange={(v) => set({ sortBy: v })}
                        options={(meta?.sortOptions || [
                            { value: 'Featured', label: 'Featured' },
                            { value: 'Price:LowToHigh', label: 'Price: low to high' },
                            { value: 'Price:HighToLow', label: 'Price: high to low' },
                            { value: 'AvgCustomerReviews', label: 'Customer reviews' },
                            { value: 'NewestArrivals', label: 'Newest arrivals' },
                        ]).map((o) => ({ value: o.value, label: o.label }))}
                    />
                </label>
                <label className="kw-field">
                    <span>Results</span>
                    <Select
                        size="small"
                        value={String(filters.itemCount)}
                        onChange={(v) => set({ itemCount: v })}
                        options={[10, 20, 30, 40, 50].map((n) => ({ value: String(n), label: `${n} products` }))}
                    />
                </label>
            </div>
        </Panel>
    );
};

/* ───────────────────────────── market overview ───────────────────────────── */

export const MarketOverview = ({ result, onFocus }) => {
    const market = result?.market;
    if (!market) return <Panel span={8} kicker="Market"><MiniState tone="empty" title="No search yet" note="Run a keyword search to see the market picture." /></Panel>;

    const sample = market.sample || {};
    const opp = market.opportunity || {};
    const band = bandMeta(opp.band);
    const components = Object.entries(opp.components || {});

    return (
        <Panel
            span={8}
            kicker="Market picture"
            id="panel-market"
            meta={<span className="kw-sampnote">{int(sample.products)} of {int(sample.totalResultCount)} reported results analysed</span>}
        >
            <div className="kw-oppwrap">
                <Ring pct={opp.score ?? 0} size={104} stroke={10} label="opportunity" color={TONE_COLOR[opp.band === 'avoid' ? 'neg' : opp.band === 'crowded' ? 'warn' : 'pos']} />
                <div className="kw-oppbody">
                    <div className="kw-opphead">
                        <span className={`ops-delta ${band.cls}`}>{band.label}</span>
                        <Tip text={opp.disclaimer || ''}><span className="kw-muted">how this is scored</span></Tip>
                    </div>
                    <div className="ops-statrow"><span className="ops-statrow__label">Median price</span><span className="ops-statrow__value ops-num">{money(market.price?.median, true)}</span></div>
                    <div className="ops-statrow"><span className="ops-statrow__label">Price range</span><span className="ops-statrow__value ops-num">{money(market.price?.min)} – {money(market.price?.max)}</span></div>
                    <div className="ops-statrow"><span className="ops-statrow__label">Average discount</span><span className="ops-statrow__value ops-num">{pct(market.price?.avgDiscountPct)}</span></div>
                    <div className="ops-statrow"><span className="ops-statrow__label">Median sales rank</span><span className="ops-statrow__value ops-num">{int(market.bsr?.median)}</span></div>
                </div>
            </div>

            <div className="kw-componentlist">
                {components.map(([key, c]) => (
                    <div className="kw-component" key={key}>
                        <div className="kw-component__top">
                            <span className="kw-component__label">{key === 'listingQuality' ? 'Listing quality gap' : key}</span>
                            <span className="ops-num">{isNum(c.value) ? Math.round(c.value) : '—'}<small>/100</small></span>
                        </div>
                        <ShareBar pct={isNum(c.value) ? c.value : 0} color={TONE_COLOR[c.value >= 60 ? 'pos' : c.value >= 40 ? 'warn' : 'neg']} />
                        <span className="kw-component__note">{c.note}</span>
                    </div>
                ))}
            </div>

            <div className="kw-overviewfoot">
                <button type="button" className="kw-jumpstat" onClick={() => onFocus?.('products')}>
                    <em>Sample</em>
                    <b className="ops-num">{int(sample.products)}</b>
                    <span>{int(sample.rated)} rated · {int(sample.ranked)} ranked</span>
                </button>
                <button type="button" className="kw-jumpstat" onClick={() => onFocus?.('brands')}>
                    <em>Brands</em>
                    <b className="ops-num">{int(market.brands?.unique)}</b>
                    <span>{market.brands?.topBrand ? `leader ${market.brands.topBrand.brand} (${pct(market.brands.topShare, 0)})` : '—'}</span>
                </button>
                <button type="button" className="kw-jumpstat" onClick={() => onFocus?.('catalog')}>
                    <em>Our listings</em>
                    <b className="ops-num">{int(result?.catalog?.summary?.matchedCount)}</b>
                    <span>{result?.catalog?.summary?.bestPosition ? `best position #${result.catalog.summary.bestPosition}` : 'not in this page'}</span>
                </button>
            </div>
        </Panel>
    );
};

/* ───────────────────────────── insights ───────────────────────────── */

export const InsightList = ({ insights, onJump, span = 4, showKeyword }) => {
    const list = insights?.insights || [];
    return (
        <Panel span={span} kicker="Signals" meta={insights?.counts ? `${insights.counts.pos || 0} positive · ${insights.counts.warn || 0} watch · ${insights.counts.neg || 0} negative` : null}>
            {list.length === 0
                ? <MiniState tone="empty" title="Nothing material in this sample" note="No rule crossed its threshold — the numbers above are still valid." />
                : (
                    <div className="ops-insights__list">
                        {list.map((insight) => (
                            <button
                                type="button"
                                key={`${insight.id}-${insight.title}`}
                                className={`kw-insight kw-insight--${insight.tone} kw-insightbtn`}
                                onClick={() => insight.target && onJump?.(insight.target)}
                                title={insight.target ? 'Jump to the related panel' : undefined}
                            >
                                <div className="kw-insighthead">
                                    {showKeyword && insight.keyword ? <Tag className="kw-kwtag">{insight.keyword}</Tag> : null}
                                    <strong>{insight.title}</strong>
                                </div>
                                <p>{insight.detail}</p>
                                {insight.metrics && Object.keys(insight.metrics).length ? (
                                    <div className="kw-insightmetrics">
                                        {Object.entries(insight.metrics).map(([k, v]) => (
                                            <span key={k}><em>{k}</em><b className="ops-num">{String(v)}</b></span>
                                        ))}
                                    </div>
                                ) : null}
                            </button>
                        ))}
                    </div>
                )}
        </Panel>
    );
};

/* ───────────────────────────── price ───────────────────────────── */

export const PricePanel = ({ market, onBand, activeBand }) => {
    if (!market?.price?.bands) return null;
    const bands = market.price.bands;
    return (
        <Panel
            span={6}
            kicker="Price landscape"
            id="panel-price"
            meta={<>median {money(market.price.median, true)} ·{' '}
                <Delta value={isNum(market.price.avgDiscountPct) ? market.price.avgDiscountPct : null} neutral compact />
            </>}
        >
            <SegmentedBar
                segments={bands.map((b, i) => ({ key: b.key, label: b.label, value: b.count, color: ['#1349c6', '#2a63d8', '#5b8ae8', '#8fb0f2', '#c3d4f8', '#e0e8fb'][i] }))}
                total={market.sample?.priced || 0}
                selected={activeBand}
                onSelect={(k) => onBand?.(activeBand === k ? null : k)}
            />
            <div className="ops-table__wrap kw-scroll">
                <table className="ops-table ops-table--dense">
                    <thead>
                        <tr>
                            <th>Band</th>
                            <th className="ops-num">Listings</th>
                            <th className="ops-num">Share</th>
                            <th className="ops-num">Avg rating</th>
                            <th className="ops-num">Median reviews</th>
                            <th className="ops-num">Cheapest</th>
                        </tr>
                    </thead>
                    <tbody>
                        {bands.map((b) => (
                            <tr key={b.key} className={`ops-table__row ${activeBand === b.key ? 'ops-table__row--open' : ''}`} onClick={() => onBand?.(activeBand === b.key ? null : b.key)}>
                                <td>{b.label}</td>
                                <td className="ops-num">{b.count}</td>
                                <td className="ops-num">{pct(b.share, 0)}</td>
                                <td className="ops-num">{isNum(b.avgRating) ? Number(b.avgRating).toFixed(2) : '—'}</td>
                                <td className="ops-num">{int(b.medianReviews)}</td>
                                <td className="ops-num">{money(b.cheapest)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <Bars
                labels={bands.map((b) => b.label)}
                data={bands.map((b) => b.count)}
                unit="num"
                height={110}
                color="#5b8ae8"
            />
        </Panel>
    );
};

/* ───────────────────────────── competition ───────────────────────────── */

export const CompetitionPanel = ({ market }) => {
    if (!market?.ratings) return null;
    const ratings = market.ratings;
    const moat = ratings.reviewMoat || {};
    const bsr = market.bsr || {};

    return (
        <Panel span={6} kicker="Competition & demand" id="panel-competition" meta={`${int(market.sample?.ranked)} ranked listings`}>
            <div className="kw-split">
                <div className="kw-split__col">
                    <span className="ops-statrow__label">Review moat</span>
                    <div className="kw-bigvalue ops-num">{pct(moat.top3Share, 0)}</div>
                    <span className="kw-muted">top 3 listings hold {int(moat.top3Reviews)} of {int(ratings.totalReviews)} reviews</span>
                    {moat.leader ? (
                        <div className="kw-leader">
                            <span className="kw-muted">Leader</span>
                            <strong>{moat.leader.title ? `${String(moat.leader.title).slice(0, 58)}${String(moat.leader.title).length > 58 ? '…' : ''}` : moat.leader.asin}</strong>
                            <span className="ops-num">{int(moat.leader.reviews)} reviews · {isNum(moat.leader.rating) ? Number(moat.leader.rating).toFixed(1) : '—'}★</span>
                        </div>
                    ) : null}
                </div>
                <div className="kw-split__col">
                    <span className="ops-statrow__label">Ratings spread</span>
                    <div className="kw-ratingbars">
                        {(ratings.distribution || []).map((d) => (
                            <div className="kw-ratingbar" key={d.key}>
                                <span className="kw-ratingbar__label">{d.label}</span>
                                <ShareBar pct={d.share || 0} color={d.key === 'r_lt_3' ? '#b91c1c' : d.key === 'r_45_plus' ? '#15803d' : '#1349c6'} />
                                <span className="ops-num kw-ratingbar__value">{d.count}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="kw-statgrid">
                <div className="kw-stat"><span>Average rating</span><b className="ops-num">{isNum(ratings.avg) ? Number(ratings.avg).toFixed(2) : '—'}</b></div>
                <div className="kw-stat"><span>Review-weighted</span><b className="ops-num">{isNum(ratings.weightedAvg) ? Number(ratings.weightedAvg).toFixed(2) : '—'}</b></div>
                <div className="kw-stat"><span>Median reviews</span><b className="ops-num">{int(ratings.medianReviews)}</b></div>
                <div className="kw-stat"><span>Under 4★ or &lt;50 reviews</span><b className="ops-num">{pct(ratings.weakListingShare, 0)}</b></div>
                <div className="kw-stat"><span>Median BSR</span><b className="ops-num">{int(bsr.median)}</b></div>
                <div className="kw-stat"><span>Top 10k BSR share</span><b className="ops-num">{pct(bsr.top10kShare, 0)}</b></div>
            </div>
        </Panel>
    );
};

/* ───────────────────────────── brands ───────────────────────────── */

export const BrandPanel = ({ market }) => {
    if (!market?.brands) return null;
    const rows = market.brands.rows || [];
    const top = market.brands.topBrand;

    return (
        <Panel
            span={4}
            kicker="Brand concentration"
            id="panel-brands"
            meta={`${market.brands.unique} brands · HHI ${int(market.brands.hhi)}`}
        >
            {top ? (
                <div className="kw-leadbrand">
                    <div>
                        <span className="kw-muted">Leading brand</span>
                        <div className="kw-leadbrand__name">{top.brand}</div>
                    </div>
                    <div className="kw-leadbrand__stats">
                        <span className="ops-num">{top.count} listings</span>
                        <span className="ops-num">{pct(market.brands.topShare, 0)} of page</span>
                        <span className="ops-num">{int(top.reviews)} reviews</span>
                    </div>
                </div>
            ) : null}

            <div className="ops-table__wrap kw-scroll">
                <table className="ops-table ops-table--dense">
                    <thead>
                        <tr>
                            <th>Brand</th>
                            <th className="ops-num">Listings</th>
                            <th className="ops-num">Share</th>
                            <th className="ops-num">Reviews</th>
                            <th className="ops-num">Avg price</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((b) => (
                            <tr className="ops-table__row" key={b.brand}>
                                <td>{b.brand}</td>
                                <td className="ops-num">{b.count}</td>
                                <td className="ops-num">{pct(b.countShare, 0)}</td>
                                <td className="ops-num">{int(b.reviews)}</td>
                                <td className="ops-num">{money(b.avgPrice)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <span className="kw-muted kw-footnote">HHI above 2,500 means one or two brands control the page; below 1,500 the field is fragmented.</span>
        </Panel>
    );
};

/* ───────────────────────────── title terms ───────────────────────────── */

export const TermsPanel = ({ market, onTerm, currentKeyword }) => {
    const [tab, setTab] = useState('bigrams');
    const terms = market?.terms;
    if (!terms) return null;

    const options = [
        { value: 'bigrams', label: `2-word (${(terms.bigrams || []).length})` },
        { value: 'words', label: `Words (${(terms.words || []).length})` },
        { value: 'trigrams', label: `3-word (${(terms.trigrams || []).length})` },
    ];
    const list = terms[tab] || [];

    return (
        <Panel
            span={4}
            kicker="Title language"
            meta={<Segmented options={options} value={tab} onChange={setTab} ariaLabel="Term length" />}
        >
            {list.length === 0
                ? <MiniState tone="empty" title="No repeated terms" note="Every term in this page appeared once — the sample is too small to infer language." />
                : (
                    <div className="kw-terms">
                        {list.map((t) => (
                            <button
                                type="button"
                                key={t.term}
                                className={`kw-term ${currentKeyword && t.term.includes(String(currentKeyword).toLowerCase()) ? 'kw-term--on' : ''}`}
                                onClick={() => onTerm?.(t.term)}
                                title={`Search "${t.term}" as a seed keyword`}
                            >
                                <span className="kw-term__text">{t.term}</span>
                                <span className="kw-term__meta ops-num">{t.count} · {pct(t.share, 0)}</span>
                            </button>
                        ))}
                    </div>
                )}
            <span className="kw-muted kw-footnote">Terms appearing in more than one title, ranked by frequency. Click one to run it as a seed keyword.</span>
        </Panel>
    );
};

/* ───────────────────────────── catalog link ───────────────────────────── */

export const CatalogPanel = ({ result, onSelectAsin, span = 4 }) => {
    const catalog = result?.catalog;
    const summary = catalog?.summary;
    if (!catalog) return null;

    if (catalog.note) {
        return (
            <Panel span={span} kicker="Your catalog" id="panel-catalog">
                <MiniState tone="error" title="Catalog lookup unavailable" note={catalog.note} />
            </Panel>
        );
    }

    const rows = (catalog.rows || []).filter((r) => r.inCatalog);
    return (
        <Panel
            span={span}
            kicker="Your catalog"
            id="panel-catalog"
            meta={`${int(summary?.matchedCount)} of ${int(catalog.rows?.length)} listings on this page`}
        >
            {rows.length === 0 ? (
                <MiniState
                    tone="empty"
                    title="None of your sellers rank here"
                    note="The first page of this keyword carries none of your assigned sellers' ASINs. A low-bid exact-match test campaign is the cheapest way in."
                />
            ) : (
                <>
                    <div className="kw-statgrid kw-statgrid--3">
                        <div className="kw-stat"><span>Coverage</span><b className="ops-num">{pct(summary.coveragePct, 0)}</b></div>
                        <div className="kw-stat"><span>Best position</span><b className="ops-num">#{summary.bestPosition ?? '—'}</b></div>
                        <div className="kw-stat"><span>Price vs market</span><b className="ops-num">{isNum(summary.avgPriceVsMarketPct) ? `${summary.avgPriceVsMarketPct > 0 ? '+' : ''}${Number(summary.avgPriceVsMarketPct).toFixed(1)}%` : '—'}</b></div>
                    </div>
                    <div className="kw-catalist">
                        {rows.map((row) => (
                            <div className="kw-catarow" key={row.asin}>
                                <div className="kw-catarow__head">
                                    <button type="button" className="ops-linkbtn" onClick={() => onSelectAsin?.(row.asin)}>{row.asin}</button>
                                    <span className="kw-muted">position #{row.position}</span>
                                </div>
                                {(row.ourListings || []).map((l) => (
                                    <div className="kw-catalisting" key={`${row.asin}-${l.sellerId}-${l.sku}`}>
                                        <div className="kw-catalisting__top">
                                            <strong>{l.sellerName || l.sellerId}</strong>
                                            <span className="ops-num">{money(l.price, true)}</span>
                                        </div>
                                        <div className="kw-catalisting__sub">
                                            <span className="ops-num">{isNum(l.priceVsMarketMedianPct) ? `${l.priceVsMarketMedianPct > 0 ? '+' : ''}${Number(l.priceVsMarketMedianPct).toFixed(1)}% vs median` : '—'}</span>
                                            <span className="ops-num">{int(l.reviewCount)} reviews{l.reviewGapToTop3 ? ` · ${int(l.reviewGapToTop3)} behind top 3` : ''}</span>
                                            <span>{l.status || '—'}{isNum(l.stockLevel) ? ` · stock ${int(l.stockLevel)}` : ''}</span>
                                            {l.lqs !== null && l.lqs !== undefined ? <span className="ops-num">LQS {Number(l.lqs).toFixed(0)}</span> : null}
                                        </div>
                                        {l.missingTerms?.length ? (
                                            <div className="kw-missingterms">
                                                <span className="kw-muted">Market terms missing from your title:</span>
                                                {l.missingTerms.map((t) => <span className="kw-missingterm" key={t.term}>{t.term} <em className="ops-num">{t.count}</em></span>)}
                                            </div>
                                        ) : null}
                                    </div>
                                ))}
                            </div>
                        ))}
                    </div>
                    {summary.sellers?.length ? (
                        <span className="kw-muted kw-footnote">
                            Sellers on this page: {summary.sellers.map((s) => `${s.sellerName} (${s.count})`).join(' · ')}
                        </span>
                    ) : null}
                </>
            )}
        </Panel>
    );
};

/* ───────────────────────────── product table ───────────────────────────── */

const PRODUCT_COLUMNS = [
    { key: 'position', label: '#', numeric: true, width: 44 },
    { key: 'title', label: 'Product' },
    { key: 'price', label: 'Price', numeric: true, sub: 'mrp' },
    { key: 'discountPercent', label: 'Disc.', numeric: true },
    { key: 'rating', label: 'Rating', numeric: true },
    { key: 'reviewCount', label: 'Reviews', numeric: true },
    { key: 'mainBSR', label: 'BSR', numeric: true },
    { key: 'seller', label: 'Seller' },
    { key: 'inCatalog', label: 'Catalog' },
];

export const ProductTable = ({
    items = [], sort, onWatch, onOpen, watched = [], showKeyword = false, onExport, canExport, exporting,
    onLoadMore, moreLoading = false, moreError = null, totalHits = null,
}) => {
    const columns = PRODUCT_COLUMNS;
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);

    const sourceKey = `${items.length}|${items[0]?.asin}|${sort?.key}|${sort?.dir}`;
    const [source, setSource] = useState(() => sourceKey);
    if (sourceKey !== source) {
        setSource(sourceKey);
        setPage(1);
    }

    if (!items.length) {
        return <Panel span={12} kicker="Products"><MiniState tone="empty" title="No products" note="The API returned no listings for these filters." /></Panel>;
    }

    const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
    const current = Math.min(page, totalPages);
    const paged = items.slice((current - 1) * pageSize, current * pageSize);

    return (
        <Panel
            span={12}
            id="panel-products"
            kicker="Result listings"
            meta={`${items.length} listings${showKeyword ? ' across all keywords' : ''} · ${items.filter((i) => i.inCatalog).length} in your catalog`}
            actions={canExport ? (
                <Button size="small" icon={<DownloadOutlined />} onClick={onExport} loading={exporting}>Export XLSX</Button>
            ) : null}
        >
            <div className="ops-table__wrap">
                <table className="ops-table ops-table--dense">
                    <thead>
                        <tr>
                            {columns.map((c) => (
                                <th key={c.key} className={c.numeric ? 'ops-num' : undefined}>
                                    {sort?.onSort && c.key !== 'title' && c.key !== 'inCatalog' && c.key !== 'seller' ? (
                                        <SortHeader
                                            label={c.label}
                                            sortKey={c.key}
                                            activeKey={sort.key}
                                            dir={sort.dir}
                                            onSort={() => sort.onSort(c.key)}
                                            numeric={c.numeric}
                                        />
                                    ) : c.label}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {paged.map((item) => (
                            <tr className="ops-table__row" key={`${item.keyword || ''}-${item.asin}`}>
                                <td className="ops-num ops-table__rank">{item.position ?? '—'}</td>
                                <td>
                                    <ProductCell
                                        item={item}
                                        showKeyword={showKeyword}
                                        onOpen={onOpen}
                                        onWatch={onWatch}
                                        watched={watched.includes(item.asin)}
                                    />
                                </td>
                                <td className="ops-num">
                                    {money(item.price)}
                                    {isNum(item.mrp) && isNum(item.price) && item.mrp > item.price ? <small className="kw-mutedsm">MRP {money(item.mrp)}</small> : null}
                                </td>
                                <td className="ops-num">{isNum(item.discountPercent) ? `${Number(item.discountPercent).toFixed(0)}%` : '—'}</td>
                                <td className="ops-num">{isNum(item.rating) ? Number(item.rating).toFixed(1) : '—'}</td>
                                <td className="ops-num">{int(item.reviewCount)}</td>
                                <td className="ops-num">{int(item.mainBSR)}</td>
                                <td className="kw-truncate" title={item.seller || ''}>{item.seller || '—'}</td>
                                <td>{item.inCatalog ? <Chip label="you sell" palette={{ 'YOU SELL': { bg: '#dcfce7', fg: '#166534' } }} /> : <span className="kw-muted">—</span>}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {(onLoadMore || items.length > 10) ? (
                <div className="ops-table__pager">
                    {onLoadMore ? (
                        <span className="ops-table__more">
                            <Button
                                size="small"
                                icon={<PlusOutlined />}
                                onClick={onLoadMore}
                                loading={moreLoading}
                            >
                                {moreLoading ? 'Loading next page…' : totalHits != null
                                    ? `Show next products (${items.length} of ${Number(totalHits).toLocaleString('en-IN')})`
                                    : 'Show more products'}
                            </Button>
                            {moreError ? <span className="kw-errline">{moreError}</span> : null}
                        </span>
                    ) : null}
                    {items.length > 10 ? (
                        <Pagination
                            size="small"
                            current={current}
                            pageSize={pageSize}
                            total={items.length}
                            showTotal={(t, range) => `${range[0]}–${range[1]} of ${t} listings`}
                            showSizeChanger
                            pageSizeOptions={[10, 20, 50, 100]}
                            onChange={(p, size) => { setPage(p); setPageSize(size); }}
                            showLessItems
                        />
                    ) : null}
                </div>
            ) : null}
        </Panel>
    );
};

/* ───────────────────────────── bundle / export ───────────────────────────── */

export const EmptyResult = ({ tone = 'empty', title, note, onRetry }) => (
    <Panel span={12}><MiniState tone={tone} title={title} note={note} onRetry={onRetry} /></Panel>
);

export const ResultSummaryBar = ({ result, children }) => {
    const market = result?.market;
    if (!market) return null;
    return (
        <Panel span={12} className="kw-summarybar" kicker={result.keyword ? `“${result.keyword}”` : 'Result'}>
            <div className="kw-quickstats">
                <span><em>Products</em><b className="ops-num">{int(market.sample?.products)}</b></span>
                <span><em>Median price</em><b className="ops-num">{money(market.price?.median, true)}</b></span>
                <span><em>Avg discount</em><b className="ops-num">{pct(market.price?.avgDiscountPct)}</b></span>
                <span><em>Top-3 review share</em><b className="ops-num">{pct(market.ratings?.reviewMoat?.top3Share, 0)}</b></span>
                <span><em>Leading brand</em><b>{market.brands?.topBrand?.brand || '—'}</b></span>
                <span><em>Your listings</em><b className="ops-num">{int(result.catalog?.summary?.matchedCount)}</b></span>
                <span><em>Opportunity</em><b className="ops-num">{int(market.opportunity?.score)}<small>/100</small></b></span>
            </div>
            {children ? <div className="kw-quickactions">{children}</div> : null}
        </Panel>
    );
};

