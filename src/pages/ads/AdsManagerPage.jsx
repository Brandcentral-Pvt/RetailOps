/**
 * Ads Intelligence — Ads Manager + Ads Report + AI Analyst in one module.
 *
 * Replaces the previous Ads Manager / Ads Report pages (both retired): the
 * legacy report lived on a second route with its own data path, which meant two
 * inconsistent numbers for the same window. Here there is exactly one scoped
 * data source (`/api/ads/*`), one filter bar, and four views over it.
 *
 * Data honesty rules enforced by the UI:
 *  - every ratio renders "—" when its denominator is unknown (never a fake 0);
 *  - a failed section shows its own retry state, not a zeroed panel;
 *  - the ASIN table paginates server-side, and its footer totals describe the
 *    whole filtered set rather than the visible page;
 *  - the AI review is opt-in and shows which rule findings grounded it.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Button, Select, Tooltip, message } from 'antd';
import { usePageTitle } from '../../contexts/PageTitleContext';
import { useDateRange } from '../../contexts/DateRangeContext';
import { useAuth } from '../../contexts/AuthContext';
import { adsApi } from '../../services/api';
import { Panel, MiniState, Segmented, SkeletonPage, fmtNum, timeAgo, useNow } from '../opsCenter/primitives';
import { useAdsOverview, useAdsTable, useAdsReport, useAdsFilterOptions, useAiReview } from '../../hooks/useAdsModule';
import AdsImportModal from '../../components/ads/AdsImportModal';
import {
    KpiRow, TrendPanel, MixPanel, MoversPanel, EfficiencyPanel, TargetsPanel,
    FreshnessPanel, InsightRail, TablePanel, DrillModal, AiAnalystPanel, ReportPanel,
    SERIES_MODE,
} from './panels';
import '../opsCenter/ops.css';
import './ads.css';

const iso = (d) => {
    if (!d) return undefined;
    const date = d instanceof Date ? d : new Date(d);
    if (Number.isNaN(date.getTime())) return undefined;
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
};

const TABS = [
    { value: 'performance', label: 'Performance' },
    { value: 'efficiency', label: 'Efficiency' },
    { value: 'table', label: 'ASIN table' },
    { value: 'report', label: 'Report' },
    { value: 'analyst', label: 'AI Analyst' },
];

const dateLabel = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '—');

const AdsManagerPage = () => {
    const { setPageTitle } = usePageTitle();
    const { startDate, endDate, updateDateRange, openPicker } = useDateRange();
    const { hasPermission } = useAuth();
    const now = useNow(30000);

    useEffect(() => { setPageTitle('Ads Intelligence'); }, [setPageTitle]);

    const canExport = hasPermission('adsreport_export');
    const canImport = hasPermission('adsreport_import');

    const [tab, setTab] = useState('performance');
    const [filters, setFilters] = useState({
        sellerId: 'all',
        brand: '',
        category: '',
        reportType: 'daily',
        granularity: 'auto',
        flag: 'all',
        search: '',
        groupBy: 'asin',
        page: 1,
        limit: 50,
        sortBy: 'totalSales',
        sortOrder: 'desc',
    });
    const [question, setQuestion] = useState('');
    const [mixDim, setMixDim] = useState('brand');
    const [chartMode, setChartMode] = useState('revenue');
    const [chartFocus, setChartFocus] = useState(null);
    const [drill, setDrill] = useState(null);
    const [importOpen, setImportOpen] = useState(false);
    const [exporting, setExporting] = useState(false);

    const patchFilters = useCallback((patch) => {
        setFilters((f) => ({ ...f, ...patch }));
    }, []);

    const baseParams = useMemo(() => ({
        startDate: iso(startDate),
        endDate: iso(endDate),
        sellerId: filters.sellerId !== 'all' ? filters.sellerId : undefined,
        brand: filters.brand || undefined,
        category: filters.category || undefined,
        reportType: filters.reportType,
        granularity: filters.granularity,
    }), [startDate, endDate, filters.sellerId, filters.brand, filters.category, filters.reportType, filters.granularity]);

    const pickerParams = useMemo(() => ({
        startDate: iso(startDate),
        endDate: iso(endDate),
        sellerId: baseParams.sellerId,
        reportType: filters.reportType,
    }), [startDate, endDate, baseParams.sellerId, filters.reportType]);

    // ── Data ────────────────────────────────────────────────────────────
    const options = useAdsFilterOptions(pickerParams);
    const overview = useAdsOverview({ ...baseParams, groupBy: filters.groupBy });
    const table = useAdsTable(
        {
            ...baseParams,
            groupBy: filters.groupBy,
            flag: filters.flag,
            search: filters.search || undefined,
            page: filters.page,
            limit: filters.limit,
            sortBy: filters.sortBy,
            sortOrder: filters.sortOrder,
        },
        { enabled: tab === 'table' || tab === 'performance' || tab === 'efficiency' },
    );
    const report = useAdsReport({ ...pickerParams, granularity: 'month', months: 12 }, { enabled: tab === 'report' });
    const ai = useAiReview();

    const loading = overview.isPending && !overview.data;
    const data = overview.data;
    const insights = data?.insights;
    const scopeError = overview.error?.code === 'forbidden_seller' ? overview.error : null;
    const statusOf = (q, isEmpty) => {
        if (q.isError) return 'error';
        if (q.isPending) return 'loading';
        if (isEmpty) return 'empty';
        return 'ok';
    };

    const sellers = useMemo(() => options.data?.sellers || [], [options.data]);
    const sellerLabel = useMemo(() => {
        if (scopeError) return 'Scope denied';
        if (data?.scope?.empty) return 'No sellers assigned';
        if (filters.sellerId === 'all') return data?.scope?.isGlobal ? 'All sellers' : `${sellers.length || data?.scope?.assignedSellers?.length || 0} assigned sellers`;
        return sellers.find((s) => s.id === filters.sellerId)?.name || filters.sellerId;
    }, [data, filters.sellerId, sellers, scopeError]);

    const jumpTo = useCallback((panelId) => {
        const el = document.getElementById(panelId);
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
            el.classList.add('ops-panel--flash');
            setTimeout(() => el.classList.remove('ops-panel--flash'), 1200);
        }
    }, []);

    // A rule finding can point at a tab that is not mounted — switch first.
    const jump = useCallback((panelId) => {
        const map = { 'panel-efficiency': 'efficiency', 'panel-ai': 'analyst', 'panel-mix': 'performance', 'panel-movers': 'performance', 'panel-trends': 'performance', 'panel-freshness': 'efficiency', 'panel-targets': 'efficiency', 'panel-table': 'table' };
        const target = map[panelId];
        if (target && target !== tab) {
            setTab(target);
            setTimeout(() => jumpTo(panelId), 250);
        } else {
            jumpTo(panelId);
        }
    }, [tab, jumpTo]);

    const runAi = useCallback((overrideQuestion) => {
        ai.mutate({
            ...baseParams,
            groupBy: filters.groupBy,
            question: overrideQuestion !== undefined ? overrideQuestion : question,
        });
    }, [ai, baseParams, filters.groupBy, question]);

    const handleExport = useCallback(async () => {
        setExporting(true);
        const hide = message.loading('Queuing ads export…', 0);
        try {
            const res = await adsApi.exportData({
                ...baseParams,
                groupBy: filters.groupBy,
                search: filters.search || undefined,
            });
            hide();
            message.success(res?.downloadId
                ? `Export queued (${res.downloadId}). The workbook appears in your downloads when ready.`
                : 'Export queued.');
        } catch (err) {
            hide();
            message.error(err?.message || 'Ads export failed');
        } finally {
            setExporting(false);
        }
    }, [baseParams, filters.groupBy, filters.search]);

    const applyPreset = (days) => {
        const end = new Date();
        const start = new Date();
        start.setDate(start.getDate() - (days - 1));
        updateDateRange({ startDate: start, endDate: end, rangeType: `last${days}` });
    };

    if (loading && !data) return <SkeletonPage />;

    return (
        <div className="ops ads-page">
            <div className="ops-head">
                <div>
                    <div className="ops-head__title">Ads Intelligence</div>
                    <div className="ops-head__sub">
                        <span className={`ops-pill ${data?.freshness?.complete ? 'ops-pill--live' : 'ops-pill--reconnecting'}`}>
                            <span className="ops-pill__dot" />
                            {filters.reportType === 'daily' ? 'Daily rows' : 'Monthly rows'}
                        </span>
                        <span className="ops-num">{dateLabel(startDate)} – {dateLabel(endDate)}</span>
                        <span className="ops-muted">vs previous {data?.period?.days || 0} days</span>
                        <span>·</span>
                        <span>{sellerLabel}</span>
                        {data?.freshness?.lastDate && (
                            <>
                                <span>·</span>
                                <span>
                                    Last row <span className="ops-num">{data.freshness.lastDate}</span>
                                    {(data.freshness.gapDays || []).length > 0 && (
                                        <Tooltip title={`Missing: ${data.freshness.gapDays.slice(0, 12).join(', ')}`}>
                                            <span style={{ color: '#b54708' }}> · {data.freshness.gapDays.length} gap day(s)</span>
                                        </Tooltip>
                                    )}
                                </span>
                            </>
                        )}
                        <span>·</span>
                        <span>Updated {timeAgo(new Date(overview.dataUpdatedAt || now.getTime()).toISOString())}</span>
                    </div>
                </div>
                <div className="ops-head__controls">
                    <Select
                        size="small"
                        className="ops-select"
                        showSearch
                        optionFilterProp="label"
                        value={filters.sellerId}
                        onChange={(v) => patchFilters({ sellerId: v, page: 1 })}
                        style={{ minWidth: 170 }}
                        options={[
                            { value: 'all', label: 'All accessible sellers' },
                            ...sellers.map((s) => ({ value: s.id, label: s.name })),
                        ]}
                    />
                    <Select
                        size="small"
                        className="ops-select"
                        allowClear
                        showSearch
                        placeholder="All brands"
                        value={filters.brand || undefined}
                        onChange={(v) => patchFilters({ brand: v || '', page: 1 })}
                        style={{ minWidth: 150 }}
                        options={(options.data?.brands || []).map((b) => ({ value: b, label: b }))}
                    />
                    <Select
                        size="small"
                        className="ops-select"
                        allowClear
                        showSearch
                        placeholder="All categories"
                        value={filters.category || undefined}
                        onChange={(v) => patchFilters({ category: v || '', page: 1 })}
                        style={{ minWidth: 150 }}
                        options={(options.data?.categories || []).map((c) => ({ value: c, label: c }))}
                    />
                    <Segmented
                        options={[{ value: 'daily', label: 'Daily' }, { value: 'monthly', label: 'Monthly' }]}
                        value={filters.reportType}
                        onChange={(v) => patchFilters({ reportType: v, page: 1 })}
                        ariaLabel="Report type"
                    />
                    <Segmented
                        options={[{ value: 7, label: '7D' }, { value: 30, label: '30D' }, { value: 90, label: '90D' }, { value: 180, label: '180D' }]}
                        value={null}
                        onChange={(v) => applyPreset(v)}
                        ariaLabel="Quick range"
                    />
                    <Button size="small" onClick={openPicker}>Custom range</Button>
                    <Button size="small" loading={overview.isFetching || table.isFetching} onClick={() => { overview.refetch(); table.refetch(); if (tab === 'report') report.refetch(); }}>
                        Refresh
                    </Button>
                    <Button size="small" type="primary" loading={exporting} disabled={!canExport} onClick={handleExport} title={canExport ? 'Queue an XLSX export of the current filter set' : 'Requires the ads export permission'}>
                        Export
                    </Button>
                </div>
            </div>

            {scopeError && (
                <Alert
                    type="error"
                    showIcon
                    style={{ marginBottom: 12 }}
                    message="Seller scope denied"
                    description={`${scopeError.message} Assigned: ${(scopeError.details?.assignedSellers || []).join(', ') || 'none'}.`}
                />
            )}

            {overview.isError && !scopeError && (
                <Alert
                    type="error"
                    showIcon
                    style={{ marginBottom: 12 }}
                    message="Ads data failed to load"
                    description={overview.error?.message || 'Unknown error'}
                    action={<Button size="small" onClick={() => overview.refetch()}>Retry</Button>}
                />
            )}

            {data?.scope?.empty && (
                <Panel span={12} kicker="No data scope">
                    <MiniState
                        tone="empty"
                        title="No sellers are assigned to your account"
                        note="Ask an administrator to assign sellers — until then this module returns nothing rather than another seller's advertising data."
                    />
                </Panel>
            )}

            {data && !data.scope?.empty && (
                <>
                    <InsightRail insights={insights} onJump={jump} />

                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
                        <Segmented options={TABS} value={tab} onChange={setTab} ariaLabel="Ads view" />
                        <span className="ops-muted" style={{ fontSize: 11.5 }}>
                            {insights?.headline ? `Top finding: ${insights.headline}` : 'Rule engine found nothing material in this window.'}
                        </span>
                    </div>

                    <div className="ops-grid">
                        {(tab === 'performance' || tab === 'efficiency') && (
                            <KpiRow
                                overview={data}
                                focus={chartFocus}
                                onFocus={(seriesKey) => {
                                    // Tile → chart: switch the metric group and focus the series.
                                    setChartMode(SERIES_MODE[seriesKey] || 'revenue');
                                    setChartFocus(seriesKey);
                                    if (tab !== 'performance') setTab('performance');
                                    setTimeout(() => jumpTo('panel-trends'), tab === 'performance' ? 0 : 260);
                                }}
                            />
                        )}

                        {tab === 'performance' && (
                            <>
                                <TrendPanel
                                    overview={data}
                                    status={statusOf(overview, !data.series?.keys?.length)}
                                    onRetry={() => overview.refetch()}
                                    granularity={filters.granularity}
                                    onGranularity={(v) => patchFilters({ granularity: v })}
                                    mode={chartMode}
                                    onMode={(m) => { setChartMode(m); setChartFocus(null); }}
                                    focusKey={chartFocus}
                                    onFocusKey={setChartFocus}
                                />
                                <MixPanel
                                    mix={data.mix}
                                    dim={mixDim}
                                    onDim={setMixDim}
                                    status={statusOf(overview, (data.mix?.[mixDim] || []).length === 0)}
                                    onRetry={() => overview.refetch()}
                                    onSelectSeller={(id) => patchFilters({ sellerId: id, page: 1 })}
                                />
                                <MoversPanel
                                    movers={data.movers}
                                    status={statusOf(overview, false)}
                                    onRetry={() => overview.refetch()}
                                    onDrill={setDrill}
                                />
                            </>
                        )}

                        {tab === 'efficiency' && (
                            <>
                                <EfficiencyPanel
                                    efficiency={data.efficiency}
                                    status={statusOf(overview, false)}
                                    onRetry={() => overview.refetch()}
                                    onDrill={setDrill}
                                />
                                <TargetsPanel
                                    targets={data.targets}
                                    totals={data.totals}
                                    scope={data.scope}
                                    status={statusOf(overview, false)}
                                    onRetry={() => overview.refetch()}
                                />
                                <FreshnessPanel
                                    freshness={data.freshness}
                                    period={data.period}
                                    reportType={data.reportType}
                                    scope={data.scope}
                                />
                                <Panel span={6} kicker="Blended read" meta="Derived from the same scoped rows">
                                    <div className="ops-statrow">
                                        <div className="ops-stat">
                                            <span className="ops-stat__label">Ad share of sales</span>
                                            <span className="ops-stat__value ops-num">
                                                {data.totals.adSharePct === null ? '—' : `${Number(data.totals.adSharePct).toFixed(1)}%`}
                                            </span>
                                            <span className="ops-stat__sub ops-muted ops-num">
                                                {fmtNum(Math.round(data.totals.sales))} ad / {fmtNum(Math.round(data.totals.totalSales))} total
                                            </span>
                                        </div>
                                        <div className="ops-stat">
                                            <span className="ops-stat__label">Cost per order</span>
                                            <span className="ops-stat__value ops-num">
                                                {data.totals.costPerOrder === null ? '—' : `₹${Math.round(data.totals.costPerOrder).toLocaleString('en-IN')}`}
                                            </span>
                                            <span className="ops-stat__sub ops-muted ops-num">
                                                AOV {data.totals.aov === null ? '—' : `₹${Math.round(data.totals.aov).toLocaleString('en-IN')}`}
                                            </span>
                                        </div>
                                        <div className="ops-stat">
                                            <span className="ops-stat__label">CPM / CPC</span>
                                            <span className="ops-stat__value ops-num">
                                                {data.totals.cpm === null ? '—' : `₹${data.totals.cpm.toFixed(0)}`} / {data.totals.cpc === null ? '—' : `₹${data.totals.cpc.toFixed(1)}`}
                                            </span>
                                            <span className="ops-stat__sub ops-muted ops-num">
                                                {fmtNum(data.totals.impressions)} impressions · {fmtNum(data.totals.clicks)} clicks
                                            </span>
                                        </div>
                                    </div>
                                    <div className="ops-muted" style={{ fontSize: 11.5, marginTop: 8 }}>
                                        Ad share above ~70% means revenue is bid-dependent; below ~25% the best incremental spend is
                                        usually the keys with organic sales and no ads.
                                    </div>
                                </Panel>
                            </>
                        )}

                        {tab === 'table' && (
                            <TablePanel
                                key={`${filters.sellerId}-${baseParams.startDate}-${baseParams.endDate}-t`}
                                table={table.data}
                                filters={filters}
                                onFilters={patchFilters}
                                status={table.isError ? 'error' : table.isPending && !table.data ? 'loading' : (table.data?.rows?.length ? 'ok' : 'empty')}
                                onRetry={() => table.refetch()}
                                onDrill={setDrill}
                                canExport={canExport}
                                exporting={exporting}
                                onExport={handleExport}
                                canImport={canImport}
                                onImport={() => setImportOpen(true)}
                            />
                        )}

                        {tab === 'report' && (
                            <ReportPanel
                                report={report.data}
                                status={report.isError ? 'error' : report.isPending ? 'loading' : 'ok'}
                                onRetry={() => report.refetch()}
                                onOpenMonth={(m) => {
                                    const start = `${m.key}-01`;
                                    const end = new Date(Number(m.year), Number(m.monthIndex), 0);
                                    updateDateRange({
                                        startDate: new Date(`${start}T00:00:00`),
                                        endDate: end,
                                        rangeType: 'custom',
                                    });
                                    setTab('performance');
                                }}
                            />
                        )}

                        {tab === 'analyst' && (
                            <>
                                <AiAnalystPanel
                                    insights={insights}
                                    ai={{
                                        data: ai.data,
                                        isPending: ai.isPending,
                                        error: ai.error ? { code: ai.error.code, message: ai.error.message, details: ai.error.details } : null,
                                    }}
                                    onRun={runAi}
                                    question={question}
                                    setQuestion={setQuestion}
                                    canRun={!data?.scope?.empty && data?.freshness?.rowCount > 0}
                                />
                                <TargetsPanel
                                    targets={data.targets}
                                    totals={data.totals}
                                    scope={data.scope}
                                    status={statusOf(overview, false)}
                                    onRetry={() => overview.refetch()}
                                />
                            </>
                        )}

                        {(tab === 'performance' || tab === 'efficiency') && (
                            <TablePanel
                                key={`${filters.sellerId}-${baseParams.startDate}-${baseParams.endDate}-p`}
                                table={table.data}
                                filters={filters}
                                onFilters={patchFilters}
                                status={table.isError ? 'error' : table.isPending && !table.data ? 'loading' : (table.data?.rows?.length ? 'ok' : 'empty')}
                                onRetry={() => table.refetch()}
                                onDrill={setDrill}
                                canExport={canExport}
                                exporting={exporting}
                                onExport={handleExport}
                                canImport={canImport}
                                onImport={() => setImportOpen(true)}
                            />
                        )}
                    </div>
                </>
            )}

            {!data && !overview.isError && (
                <Panel span={12} kicker="Loading">
                    <MiniState tone="empty" title="Loading ads data…" note="Fetching the scoped window from the database." />
                </Panel>
            )}

            <DrillModal target={drill} filters={baseParams} onClose={() => setDrill(null)} />

            {canImport && (
                <AdsImportModal
                    isOpen={importOpen}
                    onClose={() => setImportOpen(false)}
                    onComplete={() => {
                        setImportOpen(false);
                        message.success('Ads upload finished — refreshing the view.');
                        overview.refetch();
                        table.refetch();
                    }}
                    selectedSeller={filters.sellerId === 'all' ? null : filters.sellerId}
                />
            )}
        </div>
    );
};

export default AdsManagerPage;
