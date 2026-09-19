import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePageTitle } from '../../contexts/PageTitleContext';
import { useDateRange } from '../../contexts/DateRangeContext';
import { useDashboardData } from '../../hooks/useDashboardData';
import { computeBlendedAchievement, targetAchievementPct } from '../../utils/targetMetrics';
import api from '../../services/api';
import { Spinner } from '../../components/Spinner';
import { Alert } from 'antd';
import {
  CorpCard, CorpMetric, CorpChip, CorpMeter, CorpEmpty, CorpSel, CorpStat, Sparkline,
} from '../../components/corp/primitives';
import { CorpLineChart, CorpBarChart, CorpPieChart } from '../../components/corp/charts';
import {
  formatIndianCurrencyShort as formatIndianCurrency, formatNumber,
} from '../../components/dashboard/utils';
import { formatRelativeTime } from '../../components/header/headerHooks';
import {
  Target, Package, TrendingUp, AlertTriangle, Clock,
  RefreshCw, Activity, Layers, Store, Radio,
  Boxes, Users, Lightbulb, ShieldAlert, BarChart3, Wallet, Percent,
} from 'lucide-react';

const computeTrend = (series = []) => {
  const data = (Array.isArray(series) ? series : []).map(Number).filter((v) => !isNaN(v));
  const meaningful = data.filter((v) => v !== 0);
  if (data.length < 2 || meaningful.length === 0) return null;
  const first = data.find((v) => v !== 0) ?? data[0];
  const last = data[data.length - 1];
  if (first === 0) return null;
  const pct = ((last - first) / Math.abs(first)) * 100;
  if (Math.abs(pct) < 0.05) return { text: 'Flat', tone: 'flat' };
  return { text: `${pct > 0 ? '+' : ''}${pct.toFixed(1)}% vs period`, tone: pct >= 0 ? 'up' : 'down' };
};

const STATE_COLORS = ['#1976d2', '#15804d', '#b45309', '#b42318', '#0e7490', '#6d28d9'];

const getStatusTone = (status = '') => {
  const s = String(status).toUpperCase();
  if (s === 'COMPLETED' || s === 'DONE' || s === 'SUCCESS') return 'success';
  if (s === 'PENDING' || s === 'TODO' || s === 'QUEUED') return 'warning';
  if (s === 'ERROR' || s === 'FAILED' || s === 'FAILURE' || s === 'CRITICAL') return 'danger';
  if (s === 'RUNNING' || s === 'IN_PROGRESS' || s === 'ACTIVE' || s === 'SYNC' || s === 'PROCESSING') return 'info';
  return 'neutral';
};

const serial = (v) => {
  const n = Number(v);
  return isNaN(n) ? 0 : n;
};

const parseMoney = (v) => {
  if (typeof v === 'number') return v;
  const n = Number(String(v ?? '').replace(/[^0-9.-]/g, ''));
  return isNaN(n) ? 0 : n;
};

function ModuleHealth({ moduleStats, hasTargets }) {
  if (!moduleStats) return <CorpEmpty title="No data" />;
  const { asins, ads, targets, tasks, alerts, pipeline } = moduleStats;

  const rows = [];
  if (asins.total) rows.push({
    label: 'Catalog Health', value: `${formatNumber(asins.active)} / ${formatNumber(asins.total)} active`,
    pct: (asins.active / asins.total) * 100, tone: 'success',
  });
  if (pipeline.total) rows.push({
    label: 'Pipeline', value: `${formatNumber(pipeline.completed)} / ${formatNumber(pipeline.total)} completed`,
    pct: (pipeline.completed / pipeline.total) * 100, tone: '',
  });
  if (tasks.total) rows.push({
    label: 'Tasks', value: `${formatNumber(tasks.completed)} / ${formatNumber(tasks.total)} done`,
    pct: tasks.total ? (tasks.completed / tasks.total) * 100 : 0, tone: '',
  });
  if (hasTargets) rows.push({
    label: 'Targets', value: `${formatNumber(targets.completed)} / ${formatNumber(targets.total)} met`,
    pct: targets.rate, tone: targets.rate >= 60 ? 'success' : targets.rate >= 30 ? 'warning' : 'danger',
  });
  if (ads.totalSales) rows.push({
    label: 'Ads Efficiency', value: `ACOS ${ads.acos.toFixed(1)}%`,
    pct: Math.max(0, Math.min(100, 100 - ads.acos)), tone: ads.acos <= 30 ? 'success' : 'warning',
  });
  if (alerts.total) rows.push({
    label: 'Alerts', value: `${formatNumber(alerts.critical)} critical`,
    pct: Math.max(0, 100 - alerts.critical * 6), tone: alerts.critical > 0 ? 'danger' : 'success',
  });

  if (rows.length === 0) return <CorpEmpty title="No data" subtitle="Nothing to report for this period." />;

  return (
    <div className="corp-row-gap">
      {rows.map((r) => (
        <div key={r.label}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--corp-text-2)' }}>{r.label}</span>
            <span style={{ fontSize: 11.5, color: 'var(--corp-text-3)', fontWeight: 500 }}>{r.value}</span>
          </div>
          <CorpMeter value={r.pct} tone={r.tone} />
        </div>
      ))}
    </div>
  );
}

function MarketplaceDist({ marketplaces }) {
  const data = (marketplaces || [])
    .filter((mp) => mp.name && mp.name !== 'Unknown')
    .slice(0, 8);
  if (!data.length) return <CorpEmpty title="No marketplace data" />;

  const total = data.reduce((a, b) => a + serial(b.count), 0) || 1;
  const topIdx = data.reduce((best, m, i, arr) => (serial(m.count) > serial(arr[best].count) ? i : best), 0);
  const colors = data.map((mp, i) => mp.color || (i === topIdx ? '#1976d2' : STATE_COLORS[(i + 1) % STATE_COLORS.length]));

  return (
    <div className="corp-row-gap">
      <CorpBarChart
        height={150}
        labels={data.map((mp) => (mp.name || '').slice(0, 9))}
        series={[{ data: data.map((mp) => serial(mp.count)), color: colors[0] }]}
      />
      <div className="corp-legend">
        {data.slice(0, 5).map((mp, i) => (
          <CorpStat
            key={mp.name}
            label={mp.name}
            swatch={colors[i]}
            value={formatNumber(mp.count)}
            pct={Math.round((serial(mp.count) / total) * 100)}
          />
        ))}
      </div>
    </div>
  );
}

function MarketCatalogDeepDive({ raw, marketplaces }) {
  const stats = raw?.stats || {};
  const kpi = raw?.kpi || [];
  const catalogValue = parseMoney(kpi.find((k) => String(k.title || '').toLowerCase().includes('catalog'))?.value);

  const totalAsins = serial(stats.totalAsins);
  const activeAsins = serial(stats.activeAsins);
  const oos = serial(stats.outOfStockAsins);
  const newThisMonth = serial(stats.newThisMonthAsins);
  const totalSellers = serial(stats.totalSellers);
  const activeSellers = serial(stats.activeSellers);
  const oosRate = totalAsins ? (oos / totalAsins) * 100 : 0;
  const sellerRate = totalSellers ? (activeSellers / totalSellers) * 100 : 0;
  const oosTone = oosRate >= 15 ? 'danger' : oosRate >= 8 ? 'warning' : 'success';

  const mps = (marketplaces || []).filter((m) => m.name && m.name !== 'Unknown');
  const mpTotal = mps.reduce((a, m) => a + serial(m.count), 0);
  const topIdx = mps.reduce((best, m, i, arr) => (serial(m.count) > serial(arr[best].count) ? i : best), 0);
  const topMp = mps[topIdx];
  const topShare = mpTotal && topMp ? (serial(topMp.count) / mpTotal) * 100 : 0;

  if (!totalAsins && !totalSellers) {
    return <CorpEmpty title="No catalog data" subtitle="Catalog metrics will appear once seller data syncs." />;
  }

  return (
    <CorpCard title="Market & catalog deep-dive" subtitle="Inventory, sellers and marketplace concentration — computed live from sync data">
      <div className="corp-deepdive">
        <div className="corp-deepdive__col">
          <div className="corp-deep-big">{formatIndianCurrency(catalogValue)}</div>
          <div className="corp-deep-sub">Catalog value across {formatNumber(totalAsins)} ASINs</div>
          <div style={{ height: 14 }} />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--corp-text-2)' }}>Out-of-stock risk</span>
            <CorpChip tone={oosTone} dot>{oosRate.toFixed(1)}%</CorpChip>
          </div>
          <CorpMeter value={oosRate} tone={oosTone} />
          <div style={{ height: 4 }} />
          <div className="corp-deepstat"><span className="corp-deepstat__lbl">Out of stock</span><span className="corp-deepstat__val">{formatNumber(oos)}</span></div>
          <div className="corp-deepstat"><span className="corp-deepstat__lbl">Active / total ASINs</span><span className="corp-deepstat__val">{formatNumber(activeAsins)} / {formatNumber(totalAsins)}</span></div>
          <div className="corp-deepstat"><span className="corp-deepstat__lbl">New this month</span><span className="corp-deepstat__val">{formatNumber(newThisMonth)}</span></div>
        </div>

        <div className="corp-deepdive__col">
          <div className="corp-deep-big">{formatNumber(activeSellers)}</div>
          <div className="corp-deep-sub">Active of {formatNumber(totalSellers)} sellers</div>
          <div style={{ height: 14 }} />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--corp-text-2)' }}>Seller activity</span>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--corp-text-2)' }}>{sellerRate.toFixed(1)}%</span>
          </div>
          <CorpMeter value={sellerRate} tone="success" />
          <div style={{ height: 4 }} />
          <div className="corp-deepstat"><span className="corp-deepstat__lbl">Avg catalog value / seller</span><span className="corp-deepstat__val">{formatIndianCurrency(activeSellers ? catalogValue / activeSellers : 0)}</span></div>
          <div className="corp-deepstat"><span className="corp-deepstat__lbl">Avg ASINs / seller</span><span className="corp-deepstat__val">{formatNumber(activeSellers ? totalAsins / activeSellers : 0)}</span></div>
          <div className="corp-deepstat"><span className="corp-deepstat__lbl">Inactive sellers</span><span className="corp-deepstat__val">{formatNumber(Math.max(0, totalSellers - activeSellers))}</span></div>
        </div>

        <div className="corp-deepdive__col">
          <div className="corp-deep-big">{topMp ? formatNumber(serial(topMp.count)) : '—'}</div>
          <div className="corp-deep-sub">ASINs on {topMp ? topMp.name : 'top marketplace'}</div>
          <div style={{ height: 14 }} />
          <div className="corp-deepstat">
            <span className="corp-deepstat__lbl">Concentration</span>
            <CorpChip tone={topShare >= 90 ? 'danger' : 'warning'} dot>{topShare >= 90 ? `${topShare.toFixed(1)}% single-platform` : 'distributed'}</CorpChip>
          </div>
          {mps.slice(0, 5).map((m) => {
            const share = mpTotal ? (serial(m.count) / mpTotal) * 100 : 0;
            return (
              <div key={m.name} className="corp-sharebar">
                <span style={{ width: 64, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</span>
                <div className="corp-sharebar__track"><div className="corp-sharebar__fill" style={{ width: `${share}%`, background: m.color || '#1976d2' }} /></div>
                <span className="corp-sharebar__val">{formatNumber(m.count)}</span>
                <span className="corp-sharebar__pct">{share.toFixed(0)}%</span>
              </div>
            );
          })}
          {topShare >= 90 && topMp && (
            <div style={{ marginTop: 10 }}><CorpChip tone="danger" dot>High concentration — reliance on {topMp.name}</CorpChip></div>
          )}
        </div>
      </div>
    </CorpCard>
  );
}

function TrendInsightPanel({ raw, marketplaces, adSales, adSpend, targetSummary }) {
  const stats = raw?.stats || {};
  const kpi = raw?.kpi || [];
  const catalogValue = parseMoney(kpi.find((k) => String(k.title || '').toLowerCase().includes('catalog'))?.value);
  const totalAsins = serial(stats.totalAsins);
  const oos = serial(stats.outOfStockAsins);
  const totalSellers = serial(stats.totalSellers);
  const activeSellers = serial(stats.activeSellers);
  const mps = (marketplaces || []).filter((m) => m.name && m.name !== 'Unknown');
  const mpTotal = mps.reduce((a, m) => a + serial(m.count), 0);
  const topIdx = mps.reduce((best, m, i, arr) => (serial(m.count) > serial(arr[best].count) ? i : best), 0);
  const topMp = mps[topIdx];
  const topShare = mpTotal && topMp ? (serial(topMp.count) / mpTotal) * 100 : 0;

  const acos = adSales > 0 ? (adSpend / adSales) * 100 : null;

  const insights = [];

  if (totalAsins) {
    const rate = totalAsins ? (oos / totalAsins) * 100 : 0;
    insights.push({
      icon: <ShieldAlert size={14} />,
      title: `${formatNumber(oos)} ASINs out of stock`,
      desc: `${rate.toFixed(1)}% of the ${formatNumber(totalAsins)}-ASIN catalog is currently unavailable. Restock these to protect sales.`,
      chip: <CorpChip tone={rate >= 15 ? 'danger' : rate >= 8 ? 'warning' : 'success'} dot>{rate.toFixed(1)}%</CorpChip>,
    });
  }
  if (topMp && mpTotal) {
    insights.push({
      icon: <TrendingUp size={14} />,
      title: totalAsins ? `Sales concentrated on ${topMp.name}` : `Catalog concentrated on ${topMp.name}`,
      desc: `${topShare.toFixed(1)}% of listings sit on one marketplace. Diversifying reduces single-platform risk.`,
      chip: <CorpChip tone={topShare >= 90 ? 'danger' : 'warning'} dot>{topShare.toFixed(0)}%</CorpChip>,
    });
  }
  if (totalSellers) {
    const rate = totalSellers ? (activeSellers / totalSellers) * 100 : 0;
    insights.push({
      icon: <Users size={14} />,
      title: `${activeSellers} of ${totalSellers} sellers active`,
      desc: `${rate.toFixed(1)}% seller participation. ${Math.max(0, totalSellers - activeSellers)} sellers are idle this period.`,
      chip: <CorpChip tone={rate >= 90 ? 'success' : 'warning'} dot>{rate.toFixed(0)}%</CorpChip>,
    });
  }
  if (totalAsins && catalogValue) {
    const perSeller = activeSellers ? totalAsins / activeSellers : totalAsins;
    insights.push({
      icon: <Boxes size={14} />,
      title: `Catalog valued at ${formatIndianCurrency(catalogValue)}`,
      desc: `Spread across ${formatNumber(totalAsins)} ASINs — ~${formatNumber(perSeller)} ASINs per active seller.`,
      chip: null,
    });
  }
  if (acos !== null) {
    insights.push({
      icon: <Percent size={14} />,
      title: `Advertising runs at ${acos.toFixed(1)}% ACOS`,
      desc: `Spend-to-sales ${(acos).toFixed(1)}% with ${formatIndianCurrency(adSpend)} spend producing ${formatIndianCurrency(adSales)} in ad revenue.`,
      chip: <CorpChip tone={acos <= 30 ? 'success' : 'warning'} dot>{acos.toFixed(0)}% ACOS</CorpChip>,
    });
  }
  if (targetSummary && targetSummary.total) {
    insights.push({
      icon: <Target size={14} />,
      title: `Target attainment ${Math.round(targetSummary.rate)}%`,
      desc: `${targetSummary.completed} of ${targetSummary.total} targets met, ${targetSummary.atRisk} at risk.`,
      chip: <CorpChip tone={targetSummary.rate >= 60 ? 'success' : targetSummary.rate >= 30 ? 'warning' : 'danger'} dot>{Math.round(targetSummary.rate)}%</CorpChip>,
    });
  }

  if (insights.length === 0) {
    return <CorpEmpty title="No analysis yet" subtitle="Insights will compute as catalog, sellers and ad data flow in." />;
  }

  return (
    <div className="corp-card corp-card--insights" style={{ display: 'flex', flexDirection: 'column' }}>
      <header className="corp-card__head">
        <div style={{ minWidth: 0 }}>
          <div className="corp-card__title"><Lightbulb size={14} /> Analysis insights</div>
          <div className="corp-card__sub">Auto-computed from live data</div>
        </div>
      </header>
      <div className="corp-card__body" style={{ flex: 1 }}>
        {insights.map((ins, i) => (
          <div key={i} className="corp-insight">
            <span className="corp-insight__icon">{ins.icon}</span>
            <div className="corp-insight__body">
              <div className="corp-insight__title">{ins.title} {ins.chip}</div>
              <div className="corp-insight__desc">{ins.desc}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TargetsLeaderboard({ targets }) {
  const list = targets || [];
  if (!list.length) {
    return <CorpEmpty title="No targets set" subtitle="Add revenue goals to see attainment and seller leaderboard." />;
  }

  const byType = {};
  const bySeller = {};
  list.forEach((t) => {
    const gt = (t.GoalType || 'GMS').toUpperCase();
    const target = t.TotalTargetValue || 0;
    const achieved = t.overallAchieved || 0;
    byType[gt] = byType[gt] || { label: gt, total: 0, achieved: 0, count: 0 };
    byType[gt].total += target;
    byType[gt].achieved += achieved;
    byType[gt].count += 1;

    const sk = t.SellerId || t.Seller || 'Unknown';
    bySeller[sk] = bySeller[sk] || {
      seller: t.SellerName || t.sellerName || t.Brand || t.SellerId || 'Seller',
      total: 0, achieved: 0, count: 0,
    };
    bySeller[sk].total += target;
    bySeller[sk].achieved += achieved;
    bySeller[sk].count += 1;
  });

  const typeRows = Object.values(byType).map((r) => ({
    ...r, rate: r.total ? (r.achieved / r.total) * 100 : 0,
  })).sort((a, b) => b.rate - a.rate);

  const sellerRows = Object.values(bySeller).map((r) => ({
    ...r, rate: r.total ? (r.achieved / r.total) * 100 : 0,
  })).sort((a, b) => b.achieved - a.achieved).slice(0, 6);

  return (
    <div className="corp-row-gap">
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {typeRows.map((r) => (
          <CorpChip key={r.label} tone={r.rate >= 60 ? 'success' : r.rate >= 30 ? 'warning' : 'danger'} dot>
            {r.label} · {Math.round(r.rate)}%
          </CorpChip>
        ))}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {sellerRows.map((r, i) => (
          <div key={r.seller + i} style={{ padding: '7px 2px', borderBottom: '1px solid var(--corp-border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <span style={{ width: 16, fontSize: 11, fontWeight: 700, color: 'var(--corp-text-4)' }}>{i + 1}</span>
              <span style={{ flex: 1, fontSize: 12.5, fontWeight: 600, color: 'var(--corp-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.seller}</span>
              <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--corp-text)' }}>{formatIndianCurrency(r.achieved)}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ flex: 1 }}><CorpMeter value={r.rate} tone={r.rate >= 60 ? 'success' : r.rate >= 30 ? 'warning' : 'danger'} /></div>
              <span style={{ width: 52, textAlign: 'right', fontSize: 11, fontWeight: 600, color: 'var(--corp-text-2)' }}>{r.rate.toFixed(0)}%</span>
              {r.rate < 50 && <CorpChip tone="danger" dot>At risk</CorpChip>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProfitabilityPanel({ raw, adSales, adSpend, adSalesSeries, adSpendSeries }) {
  if (!adSales && !adSpend) {
    return (
      <div className="corp-row-gap" style={{ flex: 1 }}>
        <div style={{
          border: '1px dashed var(--corp-border)', borderRadius: 'var(--corp-r-md)',
          padding: '18px 14px', textAlign: 'center', flex: 1,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4,
        }}>
          <BarChart3 size={18} color="var(--corp-text-3)" />
          <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--corp-text)' }}>No ad activity this period</div>
          <div style={{ fontSize: 11.5, color: 'var(--corp-text-3)', maxWidth: 260, lineHeight: 1.45 }}>
            ACOS, ROAS and channel mix will populate here once ad spend and sales are recorded.
          </div>
        </div>
      </div>
    );
  }

  const acosRate = adSales > 0 ? (adSpend / adSales) * 100 : 0;
  const roas = adSpend > 0 ? adSales / adSpend : 0;
  const spendShop = adSales > 0 ? (adSpend / adSales) * 100 : 0;
  const margin = adSales > 0 ? 100 - spendShop : 0;

  const areaSeries = raw?.areaSeries || [];
  const organicTot = (areaSeries[0]?.data || []).reduce((a, b) => a + b, 0);
  const adTot = adSales;
  const mixTotal = organicTot + adTot;
  const organicShare = mixTotal ? (organicTot / mixTotal) * 100 : 0;
  const adMixShare = mixTotal ? 100 - organicShare : 0;

  const spendTrend = computeTrend(adSpendSeries);
  const salesTrend = computeTrend(adSalesSeries);

  const acosTone = acosRate <= 30 ? 'success' : acosRate <= 50 ? 'warning' : 'danger';

  return (
    <div className="corp-row-gap">
      <div className="corp-ptiles">
        <div className="corp-ptile">
          <div className="corp-ptile__lbl">ACOS</div>
          <div className="corp-ptile__val">{acosRate.toFixed(1)}%</div>
          <div className="corp-ptile__sub">ad spend ÷ ad sales</div>
          <div style={{ marginTop: 6 }}><CorpMeter value={Math.min(100, acosRate)} tone={acosTone} /></div>
        </div>
        <div className="corp-ptile">
          <div className="corp-ptile__lbl">ROAS</div>
          <div className="corp-ptile__val">{roas.toFixed(2)}×</div>
          <div className="corp-ptile__sub">return on ad spend</div>
          <div style={{ marginTop: 6 }}><CorpChip tone={roas >= 2 ? 'success' : 'warning'} dot>{roas >= 2 ? 'healthy' : 'thin'}</CorpChip></div>
        </div>
        <div className="corp-ptile">
          <div className="corp-ptile__lbl">Spend → sale</div>
          <div className="corp-ptile__val">{spendShop.toFixed(1)}%</div>
          <div className="corp-ptile__sub">{margin.toFixed(1)}% gross margin on ads</div>
          <div style={{ marginTop: 6 }}><CorpMeter value={Math.min(100, spendShop)} tone={acosTone} /></div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {salesTrend && <CorpChip tone={salesTrend.tone === 'down' ? 'danger' : 'success'} dot>Sales {salesTrend.text}</CorpChip>}
        {spendTrend && <CorpChip tone="warning" dot>Spend {spendTrend.text}</CorpChip>}
      </div>

      <div className="corp-mix">
        <span style={{ fontSize: 11, color: 'var(--corp-text-3)', whiteSpace: 'nowrap' }}>Channel mix</span>
        <div className="corp-mix__bar">
          <div className="corp-mix__seg" style={{ width: `${organicShare}%`, background: '#0e7490' }} title={`Organic ${organicShare.toFixed(1)}%`} />
          <div className="corp-mix__seg" style={{ width: `${adMixShare}%`, background: '#1976d2' }} title={`Ad ${adMixShare.toFixed(1)}%`} />
        </div>
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--corp-text-2)', whiteSpace: 'nowrap' }}>
          {organicShare.toFixed(0)}% / {adMixShare.toFixed(0)}%
        </span>
      </div>
    </div>
  );
}

function TargetHealth({ targets, rate }) {
  const t = targets || { completed: 0, onTrack: 0, atRisk: 0, total: 0 };
  if (!t.total) return <CorpEmpty title="No targets" subtitle="Set revenue goals to track achievement." />;
  const slices = [
    { label: 'Completed', value: t.completed, color: '#15804d' },
    { label: 'On track', value: t.onTrack, color: '#1976d2' },
    { label: 'At risk', value: t.atRisk, color: '#b45309' },
  ];
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
      <CorpPieChart
        data={slices}
        centerLabel={{ value: `${Math.round(rate)}%`, sub: 'achievement' }}
        height={170}
        innerRadius={58}
      />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {slices.map((s) => (
          <CorpStat key={s.label} label={s.label} swatch={s.color} value={formatNumber(s.value)} />
        ))}
        <div style={{ marginTop: 4 }}>
          <CorpChip tone={rate >= 60 ? 'success' : rate >= 30 ? 'warning' : 'danger'} dot>
            {Math.round(rate)}% of target achieved
          </CorpChip>
        </div>
      </div>
    </div>
  );
}

function TopAsins({ products, onView }) {
  return (
    <CorpCard
      title="Top ASINs by revenue"
      subtitle="Best performers in the selected period"
      extra={<button className="corp-btn corp-btn--sm" onClick={onView}>View all</button>}
    >
      {(!products || products.length === 0) ? (
        <CorpEmpty title="No ASIN data" subtitle="No products recorded for this period." />
      ) : (
        <table className="corp-table corp-table--scroll">
          <thead>
            <tr>
              <th>ASIN</th>
              <th>Product</th>
              <th style={{ textAlign: 'right' }}>Units</th>
              <th style={{ textAlign: 'right' }}>Revenue</th>
            </tr>
          </thead>
          <tbody>
            {products.slice(0, 5).map((p, idx) => {
              const asin = p.asin || p.NumberRange_ASIN || p.ASIN || '—';
              const units = serial(p.units || p.orders);
              const revenue = serial(p.revenue || p.sales);
              return (
                <tr key={asin + idx}>
                  <td>
                    <div style={{ fontWeight: 600, color: 'var(--corp-text)', fontFamily: 'monospace', fontSize: 11.5 }}>{asin}</div>
                    {(p.marketplace || p.Marketplace) && (
                      <div style={{ fontSize: 10.5, color: 'var(--corp-text-3)' }}>{p.marketplace || p.Marketplace}</div>
                    )}
                  </td>
                  <td>
                    <div style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500 }}>{p.title || p.brand || 'Untitled'}</div>
                    {p.brand && <div style={{ fontSize: 10.5, color: 'var(--corp-text-3)' }}>{p.brand}</div>}
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatNumber(units)}</td>
                  <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--corp-text)' }}>{formatIndianCurrency(revenue)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </CorpCard>
  );
}

function TasksList({ tasks, onView }) {
  const pending = (tasks || []).filter((t) => (t.status || '').toUpperCase() !== 'COMPLETED').slice(0, 6);
  return (
    <CorpCard
      title="Optimization tasks"
      subtitle="Actionable items across sellers"
      extra={<button className="corp-btn corp-btn--sm" onClick={onView}>View all</button>}
    >
      {pending.length === 0 ? (
        <CorpEmpty title="All caught up" subtitle="No open optimization tasks." />
      ) : (
        <div className="corp-row-gap" style={{ gap: 4 }}>
          {pending.map((t, i) => {
            const status = (t.status || 'TODO').toUpperCase();
            const tone = getStatusTone(status);
            const overdue = status !== 'COMPLETED' && t.dueDate && new Date(t.dueDate) < new Date();
            return (
              <div key={t.id || t._id || i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 4px', borderBottom: '1px solid var(--corp-border)' }}>
                <span className="corp-card__title-num" style={{ width: 18, fontSize: 11, fontWeight: 700, color: 'var(--corp-text-4)', flexShrink: 0 }}>{i + 1}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--corp-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {t.title || t.Title || 'Untitled task'}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--corp-text-3)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 8 }}>
                    {overdue && <span style={{ color: 'var(--corp-danger)', fontWeight: 600 }}>Overdue</span>}
                    {t.dueDate && !overdue && <span>Due {formatRelativeTime(t.dueDate)}</span>}
                    {t.priority && <span className="corp-chip">{t.priority}</span>}
                  </div>
                </div>
                <CorpChip tone={tone}>{status}</CorpChip>
              </div>
            );
          })}
        </div>
      )}
    </CorpCard>
  );
}

function AlertsList({ alerts, onView }) {
  const rows = (alerts || []).slice(0, 6);
  return (
    <CorpCard
      title="Alerts"
      subtitle="Latest system & listing signals"
      extra={<button className="corp-btn corp-btn--sm" onClick={onView}>View all</button>}
    >
      {rows.length === 0 ? (
        <CorpEmpty title="No alerts" subtitle="All clear for this period." />
      ) : (
        <div className="corp-row-gap" style={{ gap: 4 }}>
          {rows.map((a, i) => {
            const type = (a.Type || a.type || '').toUpperCase();
            const tone = type.includes('ERROR') || type.includes('FAIL') ? 'danger' : type.includes('DELETE') ? 'warning' : 'info';
            return (
              <div key={a._id || i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 4px', borderBottom: '1px solid var(--corp-border)' }}>
                <span className={`corp-alert-icon corp-alert-icon--${tone}`}>
                  {tone === 'danger' ? <AlertTriangle size={13} /> : tone === 'warning' ? <Clock size={13} /> : <Activity size={13} />}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--corp-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {a.entityTitle || a.EntityTitle || 'System event'}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--corp-text-3)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {a.description || a.Description || type}
                  </div>
                  <div style={{ fontSize: 10.5, color: 'var(--corp-text-4)', marginTop: 3 }}>
                    {formatRelativeTime(a.createdAt || a.CreatedAt)}
                  </div>
                </div>
                <CorpChip tone={tone} dot>{type || 'INFO'}</CorpChip>
              </div>
            );
          })}
        </div>
      )}
    </CorpCard>
  );
}

function ActivityFeed({ logs }) {
  return (
    <CorpCard
      title="System activity"
      subtitle="Operational activity across the workspace"
      footer={<>Showing latest {Math.min((logs || []).length, 10)} events</>}
    >
      {(!logs || logs.length === 0) ? (
        <CorpEmpty title="No activity" subtitle="No events recorded yet." />
      ) : (
        <div className="corp-row-gap" style={{ gap: 6 }}>
          {logs.slice(0, 6).map((log, i) => {
            const type = (log.type || log.Type || '').toUpperCase() || 'EVENT';
            const tone = type.includes('ERROR') || type.includes('FAIL') ? 'danger' : 'info';
            return (
              <div key={log._id || log.id || i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, flexShrink: 0, paddingTop: 2 }}>
                  <span style={{ width: 26, height: 26, borderRadius: 6, background: tone === 'danger' ? 'var(--corp-danger-soft)' : 'var(--corp-primary-soft)', color: tone === 'danger' ? 'var(--corp-danger)' : 'var(--corp-primary)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                    {tone === 'danger' ? <AlertTriangle size={13} /> : <Activity size={13} />}
                  </span>
                  {i < Math.min((logs || []).length, 6) - 1 && <span style={{ flex: 1, width: 1, background: 'var(--corp-border)' }} />}
                </div>
                <div style={{ paddingBottom: 14, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--corp-text)' }}>{log.entityTitle || log.EntityTitle || 'System event'}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--corp-text-2)', marginTop: 2 }}>{log.description || log.Description || '—'}</div>
                  <div style={{ fontSize: 10.5, color: 'var(--corp-text-4)', marginTop: 3 }}>{formatRelativeTime(log.createdAt || log.CreatedAt)}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </CorpCard>
  );
}

function NotificationsCard({ notifications, onMarkAllRead, onViewAll }) {
  const unread = (notifications || []).filter((n) => !n.IsRead).length;
  return (
    <CorpCard
      title="Notifications"
      subtitle={unread > 0 ? `${unread} unread` : 'All caught up'}
      extra={
        <button className="corp-btn corp-btn--sm" onClick={onMarkAllRead}>Mark all read</button>
      }
      footer={
        <button className="corp-btn corp-btn--sm" onClick={onViewAll}>View alert center</button>
      }
    >
      {(!notifications || notifications.length === 0) ? (
        <CorpEmpty title="No notifications" subtitle="Nothing new yet." />
      ) : (
        <div className="corp-row-gap" style={{ gap: 4, height: '100%', maxHeight: 320, overflowY: 'auto' }}>
          {notifications.slice(0, 8).map((n, i) => (
            <div key={n._id || i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 4px', borderBottom: '1px solid var(--corp-border)' }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', marginTop: 6, flexShrink: 0, background: n.IsRead ? 'var(--corp-border-strong)' : 'var(--corp-primary)' }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--corp-text)', lineHeight: 1.35 }}>{n.Title || n.title || 'Update'}</div>
                <div style={{ fontSize: 11.5, color: 'var(--corp-text-2)', marginTop: 2, lineHeight: 1.4 }}>{n.Message || n.message || ''}</div>
                <div style={{ fontSize: 10.5, color: 'var(--corp-text-4)', marginTop: 3 }}>{formatRelativeTime(n.CreatedAt || n.createdAt)}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </CorpCard>
  );
}

const CorpDashboardPage = () => {
  const navigate = useNavigate();
  const { setPageTitle } = usePageTitle();
  const { startDate, endDate } = useDateRange();

  useEffect(() => { setPageTitle('Operations Command Center'); }, [setPageTitle]);

  const [filterSel, setFilterSel] = useState({ sellerId: 'all', managerId: 'all', goalType: 'all' });
  const filters = useMemo(
    () => ({ ...filterSel, dateRange: { start: startDate, end: endDate } }),
    [filterSel, startDate, endDate]
  );

  const {
    userSellers, managers, activityLogs, scrapeTasks,
    optimizationTasks, topProducts, orch, moduleStats,
    loading, isHydrated, refresh, matchesManagerFilter,
  } = useDashboardData(filters);

  const [notifications, setNotifications] = useState([]);
  useEffect(() => {
    api.notificationApi.getNotifications({ page: 1, limit: 20 })
      .then((res) => {
        // ✅ Envelope-tolerant unwrap (same as Dashboard): the notifications
        // API returns { success, data: [...] }.
        const body = res?.data ?? res ?? {};
        const data = body?.data?.notifications ?? body?.notifications ?? body?.data ?? [];
        setNotifications(Array.isArray(data) ? data : []);
      })
      .catch(() => {});
  }, []);

  const kpiValues = useMemo(() => {
    const adsPerf = orch.dashboardRaw?.adsPerformanceSeries || [];
    const adSales = (adsPerf[0]?.data || []).reduce((a, b) => a + b, 0);
    const adSpend = (adsPerf[1]?.data || []).reduce((a, b) => a + b, 0);
    const orders = orch.dashboardRaw?.kpi?.[0]?.trend || 0;
    const acos = adSales > 0 ? (adSpend / adSales) * 100 : 0;
    const unitsSeries = orch.dashboardRaw?.unitsSeries || [];
    // ✅ Actual orders — the unlabeled orders × 1.48 estimate is gone.
    const units = unitsSeries.reduce((a, b) => a + b, 0) || orders;

    const targetsList = orch.targets || [];
    let totalTarget, totalAchieved;
    let completed = 0, atRisk = 0;
    let filteredTargets = targetsList;
    if (filters.sellerId !== 'all') filteredTargets = filteredTargets.filter((t) => t.SellerId === filters.sellerId);
    if (filters.managerId !== 'all') filteredTargets = filteredTargets.filter((t) => matchesManagerFilter(t, filters.managerId));
    if (filters.goalType !== 'all') filteredTargets = filteredTargets.filter((t) => (t.GoalType || 'GMS').toUpperCase() === filters.goalType);
    filteredTargets.forEach((t) => {
      // ✅ Goal separation: per-target inverted math for lower-is-better
      // (ACoS) goals; blended rate sums currency goals only.
      const pct = targetAchievementPct(t);
      if (pct >= 100) completed++;
      else if (pct < 50) atRisk++;
    });
    const blended = computeBlendedAchievement(filteredTargets);
    totalTarget = blended.totalTarget;
    totalAchieved = blended.totalAchieved;
    const achievementRate = blended.rate;

    return {
      adSales, adSpend, orders, acos, units,
      targetTotal: totalTarget, targetAchieved: totalAchieved, achievementRate,
      targetSummary: { total: filteredTargets.length, completed, atRisk, rate: achievementRate },
    };
  }, [orch.dashboardRaw, orch.targets, filters, matchesManagerFilter]);

  const sparklineData = useMemo(() => {
    const adsPerf = orch.dashboardRaw?.adsPerformanceSeries || [];
    const adSalesSeries = adsPerf[0]?.data || [];
    const adSpendSeries = adsPerf[1]?.data || [];
    const acosDay = adSalesSeries.map((s, i) => {
      const sp = serial(adSpendSeries[i]);
      return serial(s) > 0 ? (sp / serial(s)) * 100 : 0;
    });
    return {
      adSales: adSalesSeries,
      adSpend: adSpendSeries,
      acos: acosDay,
      orders: orch.dashboardRaw?.ordersSeries || [],
      units: orch.dashboardRaw?.unitsSeries || [],
    };
  }, [orch.dashboardRaw]);

  const salesTrendLabels = useMemo(() => orch.dashboardRaw?.labels || [], [orch.dashboardRaw]);
  const salesTrendRevenue = useMemo(() => (orch.dashboardRaw?.adsPerformanceSeries || [])[0]?.data || [], [orch.dashboardRaw]);
  const salesTrendSpend = useMemo(() => (orch.dashboardRaw?.adsPerformanceSeries || [])[1]?.data || [], [orch.dashboardRaw]);
  const marketplaceCategory = useMemo(() => orch.dashboardRaw?.category || [], [orch.dashboardRaw]);

  const adRevTrend = computeTrend(sparklineData.adSales);
  const adSpendTrend = computeTrend(sparklineData.adSpend);
  const ordersTrend = computeTrend(sparklineData.orders);
  const acosTrend = computeTrend(sparklineData.acos);
  const unitsTrend = computeTrend(sparklineData.units);

  const hasTargets = kpiValues.targetTotal > 0;
  const runningPipelines = scrapeTasks?.filter((t) => t.status === 'RUNNING')?.length || 0;
  const pendingTasks = optimizationTasks?.filter((t) => String(t.status || '').toUpperCase() === 'PENDING')?.length || 0;
  const criticalAlerts = moduleStats?.alerts?.critical || activityLogs?.filter((a) => !a.AcknowledgedAt)?.length || 0;

  // ✅ Explicit errors: surface failed sections instead of silent zeros.
  // (Hooks must run before any early return.)
  const orchErrors = useMemo(
    () => Object.entries(orch.errors || {}).filter(([, v]) => !!v),
    [orch.errors]
  );

  if (loading && !isHydrated) return <Spinner tip="Loading your dashboard data..." minHeight={400} />;

  // ✅ Explicit errors: surface failed sections instead of silent zeros.
  const errorBanner = orchErrors.length > 0 ? (
    <Alert
      type="error"
      showIcon
      style={{ marginBottom: 16 }}
      message="Some dashboard sections failed to load"
      description={`${orchErrors.map(([section, msg]) => `${section}: ${msg}`).join(' \u00b7 ')} — use Sync to retry.`}
    />
  ) : null;

  const metrics = [
    {
      label: 'Ad sales', value: formatIndianCurrency(kpiValues.adSales),
      sub: `Spend ${formatIndianCurrency(kpiValues.adSpend)}`,
      delta: adRevTrend ? { text: adRevTrend.text, tone: adRevTrend.tone } : null,
      icon: <TrendingUp size={14} color="var(--corp-text-3)" />,
      spark: sparklineData.adSales, sparkColor: '#1976d2',
    },
    {
      label: 'Orders', value: formatNumber(kpiValues.orders),
      delta: ordersTrend ? { text: ordersTrend.text, tone: ordersTrend.tone } : null,
      icon: <Store size={14} color="var(--corp-text-3)" />,
      spark: sparklineData.orders, sparkColor: '#0e7490',
    },
    {
      label: 'Units', value: formatNumber(kpiValues.units),
      delta: unitsTrend ? { text: unitsTrend.text, tone: unitsTrend.tone } : null,
      icon: <Layers size={14} color="var(--corp-text-3)" />,
      spark: sparklineData.units, sparkColor: '#6d28d9',
    },
    {
      label: 'ACOS', value: kpiValues.adSales > 0 ? `${kpiValues.acos.toFixed(1)}%` : '—',
      delta: acosTrend ? { text: acosTrend.text, tone: acosTrend.tone } : null,
      icon: <Target size={14} color="var(--corp-text-3)" />,
      spark: sparklineData.acos, sparkColor: '#b42318',
    },
    {
      label: 'Target achievement', value: hasTargets ? `${Math.round(kpiValues.achievementRate)}%` : '—',
      delta: hasTargets ? { text: `of ${formatIndianCurrency(kpiValues.targetTotal)}`, tone: kpiValues.achievementRate >= 60 ? 'up' : kpiValues.achievementRate >= 30 ? 'flat' : 'down' } : { text: 'No targets set', tone: 'flat' },
      icon: <Target size={14} color="var(--corp-text-3)" />,
    },
    {
      label: 'Ad spend', value: formatIndianCurrency(kpiValues.adSpend),
      delta: adSpendTrend ? { text: `Spend ${adSpendTrend.text}`, tone: adSpendTrend.tone } : null,
      icon: <Package size={14} color="var(--corp-text-3)" />,
      spark: sparklineData.adSpend, sparkColor: '#b45309',
    },
  ];

  return (
    <div className="corp-content-inner">
      {errorBanner}
      {/* Page head + filters */}
      <div className="corp-page-head">
        <div>
          <div className="corp-page-head__title">Operations Command Center</div>
          <div className="corp-page-head__sub">Live performance across your sellers, pipelines and targets</div>
        </div>
        <div className="corp-page-head__actions">
          <div className="corp-page-head__kpis">
            <div className="corp-page-head__kpi">
              <span className="corp-page-head__kpi-val"><span className="corp-chip corp-chip--accent" style={{ gap: 4 }}><Radio size={11} /> Live</span></span>
            </div>
            <div className="corp-page-head__kpi">
              <span className="corp-page-head__kpi-lbl">Pipeline</span>
              <span className="corp-page-head__kpi-val">{formatNumber(runningPipelines)} running</span>
            </div>
            <div className="corp-page-head__kpi">
              <span className="corp-page-head__kpi-lbl">Pending tasks</span>
              <span className="corp-page-head__kpi-val">{formatNumber(pendingTasks)}</span>
            </div>
            <div className="corp-page-head__kpi">
              <span className="corp-page-head__kpi-lbl">Critical alerts</span>
              <span className="corp-page-head__kpi-val">{formatNumber(criticalAlerts)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Filter toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 18 }}>
        <CorpSel
          value={filters.sellerId} onChange={(v) => setFilterSel((p) => ({ ...p, sellerId: v }))}
          options={userSellers || []} allLabel="All sellers"
          style={{ minWidth: 150 }}
        />
        <CorpSel
          value={filters.managerId} onChange={(v) => setFilterSel((p) => ({ ...p, managerId: v }))}
          options={managers || []} allLabel="All managers"
          style={{ minWidth: 140 }}
        />
        <CorpSel
          value={filters.goalType} onChange={(v) => setFilterSel((p) => ({ ...p, goalType: v }))}
          options={[{ id: 'GMS', name: 'GMS' }, { id: 'GMV', name: 'GMV' }]}
          allLabel="All goals"
          style={{ minWidth: 120 }}
        />
        <button className="corp-btn" onClick={refresh}><RefreshCw size={13} /> Sync</button>
      </div>

      {/* Metrics */}
      <div className="corp-dash-metrics">
        {metrics.map((m) => (
          <CorpMetric key={m.label} label={m.label} value={m.value} delta={m.delta} icon={m.icon} hint={m.sub} spark={m.spark} sparkColor={m.sparkColor} />
        ))}
      </div>

      {/* Row: Module health / Insights / Target leaderboard */}
      <div className="corp-dash-row corp-dash-row--3c">
        <CorpCard title="Module health" subtitle="Operational status across modules">
          <ModuleHealth moduleStats={moduleStats} hasTargets={hasTargets} />
        </CorpCard>
        <TrendInsightPanel
          raw={orch.dashboardRaw}
          marketplaces={marketplaceCategory}
          adSales={kpiValues.adSales}
          adSpend={kpiValues.adSpend}
          targetSummary={kpiValues.targetSummary}
        />
        <CorpCard title="Target leaderboard" subtitle="Achievement by goal type and seller ranking">
          <TargetsLeaderboard targets={orch.targets || []} />
        </CorpCard>
      </div>

      {/* Full-width: Market & catalog deep-dive */}
      <div className="corp-dash-row" style={{ gridTemplateColumns: '1fr', marginBottom: 16 }}>
        <MarketCatalogDeepDive raw={orch.dashboardRaw} marketplaces={marketplaceCategory} />
      </div>

      {/* Row: Revenue vs Spend (3fr) / Profitability (2fr) */}
      <div className="corp-dash-row corp-dash-row--32">
        <CorpCard
          title="Revenue vs ad spend"
          subtitle="Period trend of advertising revenue against spend"
          bodyClassName="corp-chart-spread"
        >
          <CorpLineChart
            labels={salesTrendLabels}
            series={[
              { label: 'Ad revenue', data: salesTrendRevenue, color: '#1976d2', area: true },
              { label: 'Ad spend', data: salesTrendSpend, color: '#b45309' },
            ]}
            height={240}
          />
        </CorpCard>
        <CorpCard title="Ad profitability" subtitle="Efficiency ratios computed from this period's ad performance">
          <ProfitabilityPanel
            raw={orch.dashboardRaw}
            adSales={kpiValues.adSales}
            adSpend={kpiValues.adSpend}
            adSalesSeries={sparklineData.adSales}
            adSpendSeries={sparklineData.adSpend}
          />
        </CorpCard>
      </div>

      {/* Row: Top ASINs / Tasks / Alerts */}
      <div className="corp-dash-row corp-dash-row--3c">
        <TopAsins products={topProducts || []} onView={() => navigate('/asin-tracker')} />
        <TasksList tasks={optimizationTasks || []} onView={() => navigate('/pems/tasks')} />
        <AlertsList alerts={activityLogs || []} onView={() => navigate('/activity-log')} />
      </div>

      {/* Row: Activity / Notifications */}
      <div className="corp-dash-row corp-dash-row--2c">
        <ActivityFeed logs={activityLogs || []} />
        <NotificationsCard
          notifications={notifications}
          onMarkAllRead={() => api.notificationApi.markAllAsRead().then(() => setNotifications((prev) => prev.map((n) => ({ ...n, IsRead: true }))))}
          onViewAll={() => navigate('/alerts')}
        />
      </div>
    </div>
  );
};

export default CorpDashboardPage;