'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  ArrowUpRight,
  BarChart03,
  CheckDone01,
  ChevronDown,
  Clock,
  Package,
  RefreshCcw05 as RefreshCcw,
  ShoppingBag01,
  TrendDown01,
  TrendUp01,
} from '@untitled-ui/icons-react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatCurrency, formatNumber } from '@/lib/utils';
import { useDashboardCommandCenter } from '@/hooks/useApi';

type Period = '30d' | '90d' | '1y';

const periodLabels: Record<Period, string> = { '30d': 'Last 30 days', '90d': 'Last 90 days', '1y': 'Last 12 months' };

function StatCard({ label, value, trend, icon: Icon, tone }: { label: string; value: string; trend?: number; icon: typeof Package; tone: string }) {
  const positive = (trend ?? 0) >= 0;
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground">{value}</p>
        </div>
        <span className={`flex h-10 w-10 items-center justify-center rounded-lg ${tone}`}><Icon width={20} height={20} /></span>
      </div>
      {trend !== undefined && (
        <div className={`mt-4 flex items-center gap-1 text-xs font-medium ${positive ? 'text-emerald-600' : 'text-red-600'}`}>
          {positive ? <TrendUp01 width={14} height={14} /> : <TrendDown01 width={14} height={14} />}
          {Math.abs(trend).toFixed(1)}% <span className="font-normal text-muted-foreground">vs previous period</span>
        </div>
      )}
    </div>
  );
}

export function DashboardContent() {
  const [period, setPeriod] = useState<Period>('30d');
  const { data: response, isLoading, isError, refetch } = useDashboardCommandCenter({ period });
  const data = response?.data;
  const chartData = useMemo(() => (data?.labels || []).map((label, index) => ({
    label,
    sales: data?.adsPerformanceSeries?.[0]?.data?.[index] || 0,
    spend: data?.adsPerformanceSeries?.[1]?.data?.[index] || 0,
  })), [data]);
  const kpi = data?.kpi || [];
  const stats = data?.stats ?? { totalSellers: 0, activeSellers: 0, totalAsins: 0, activeAsins: 0, outOfStockAsins: 0, newThisMonthAsins: 0 };
  const workload = data?.userStats ?? { pending: 0, inProgress: 0, review: 0, completed: 0, total: 0 };

  if (isLoading) {
    return <div className="space-y-6 animate-pulse"><div className="h-20 w-72 rounded-xl bg-muted" /><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[1, 2, 3, 4].map((item) => <div key={item} className="h-36 rounded-xl bg-muted" />)}</div><div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]"><div className="h-96 rounded-xl bg-muted" /><div className="h-96 rounded-xl bg-muted" /></div></div>;
  }

  if (isError || !data) {
    return <div className="flex min-h-[420px] flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card text-center"><AlertCircle width={28} height={28} className="text-red-500" /><h2 className="mt-4 text-lg font-semibold text-foreground">Dashboard data unavailable</h2><p className="mt-1 max-w-sm text-sm text-muted-foreground">Sign in with a dashboard-enabled account to load your RetailOps command center.</p><button onClick={() => refetch()} className="mt-5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90">Retry</button></div>;
  }

  const revenue = Number(kpi.find((item) => item.title === 'Total Ad Sales')?.value?.replace(/[^0-9.-]/g, '') || 0);
  const marketplaceTotal = data.category.reduce((sum, item) => sum + (item.data[0] || 0), 0);

  return (
    <div className="space-y-6">
      <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div><p className="text-sm font-medium text-primary">Operations command center</p><h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">Good morning, here is your retail pulse.</h1><p className="mt-1 text-sm text-muted-foreground">Monitor growth, catalog health, and execution from one view.</p></div>
        <div className="flex items-center gap-2"><button onClick={() => refetch()} className="flex h-10 items-center gap-2 rounded-lg border border-border bg-card px-3 text-sm font-semibold text-foreground shadow-sm hover:bg-accent"><RefreshCcw width={16} height={16} /> Refresh</button><label className="relative"><span className="sr-only">Dashboard period</span><select value={period} onChange={(event) => setPeriod(event.target.value as Period)} className="h-10 appearance-none rounded-lg border border-border bg-card py-2 pl-3 pr-9 text-sm font-semibold text-foreground shadow-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/10">{Object.entries(periodLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><ChevronDown width={16} height={16} className="pointer-events-none absolute right-3 top-3 text-muted-foreground" /></label></div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Ad sales" value={kpi[0]?.value || formatCurrency(revenue)} trend={kpi[0]?.trend} icon={BarChart03} tone="bg-emerald-50 text-emerald-600" />
        <StatCard label="Ad spend" value={kpi[1]?.value || formatCurrency(0)} trend={kpi[1]?.trend} icon={ShoppingBag01} tone="bg-amber-50 text-amber-600" />
        <StatCard label="Active ASINs" value={formatNumber(stats.activeAsins)} trend={kpi[2]?.trend} icon={Package} tone="bg-indigo-50 text-indigo-600" />
        <StatCard label="Catalog value" value={kpi[3]?.value || formatCurrency(0)} trend={kpi[3]?.trend} icon={ShoppingBag01} tone="bg-sky-50 text-sky-600" />
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm"><div className="flex items-start justify-between"><div><h2 className="font-semibold text-foreground">Sales performance</h2><p className="mt-1 text-sm text-muted-foreground">Ad sales and spend across {periodLabels[period].toLowerCase()}</p></div><Link href="/ads-manager" className="flex items-center gap-1 text-sm font-semibold text-primary hover:underline">View report <ArrowUpRight width={15} height={15} /></Link></div><div className="mt-6 h-72">{chartData.length ? <ResponsiveContainer width="100%" height="100%"><AreaChart data={chartData}><defs><linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#7f56d9" stopOpacity={0.24} /><stop offset="95%" stopColor="#7f56d9" stopOpacity={0} /></linearGradient></defs><CartesianGrid vertical={false} stroke="#eaecf0" /><XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#667085' }} interval="preserveStartEnd" /><YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#667085' }} tickFormatter={(value) => `₹${Math.round(value / 1000)}k`} /><Tooltip formatter={(value) => formatCurrency(Number(value ?? 0))} contentStyle={{ borderRadius: 8, border: '1px solid #eaecf0' }} /><Area type="monotone" dataKey="sales" name="Ad sales" stroke="#7f56d9" strokeWidth={2.5} fill="url(#salesFill)" /><Area type="monotone" dataKey="spend" name="Ad spend" stroke="#f79009" strokeWidth={2} fill="none" /></AreaChart></ResponsiveContainer> : <div className="flex h-full items-center justify-center rounded-lg bg-muted text-sm text-muted-foreground">No sales data for this period</div>}</div></div>

        <div className="rounded-xl border border-border bg-card p-5 shadow-sm"><div className="flex items-start justify-between"><div><h2 className="font-semibold text-foreground">Portfolio health</h2><p className="mt-1 text-sm text-muted-foreground">Catalog coverage and operational risk</p></div><Package width={20} height={20} className="text-primary" /></div><div className="mt-6 space-y-5"><div><div className="flex justify-between text-sm"><span className="text-muted-foreground">Active ASINs</span><span className="font-semibold text-foreground">{formatNumber(stats.activeAsins)} / {formatNumber(stats.totalAsins)}</span></div><div className="mt-2 h-2 rounded-full bg-muted"><div className="h-2 rounded-full bg-primary" style={{ width: `${stats.totalAsins ? Math.min(100, stats.activeAsins / stats.totalAsins * 100) : 0}%` }} /></div></div><div className="grid grid-cols-2 gap-3"><div className="rounded-lg bg-red-50 p-3"><p className="text-xs text-red-700">Out of stock</p><p className="mt-1 text-xl font-semibold text-red-900">{formatNumber(stats.outOfStockAsins)}</p></div><div className="rounded-lg bg-emerald-50 p-3"><p className="text-xs text-emerald-700">New this month</p><p className="mt-1 text-xl font-semibold text-emerald-900">{formatNumber(stats.newThisMonthAsins)}</p></div></div><div className="flex items-center justify-between border-t border-border pt-4"><span className="text-sm text-muted-foreground">ROAS</span><span className="text-2xl font-semibold text-foreground">{data.roas}x</span></div><div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">Daily ad spend</span><span className="font-semibold text-foreground">{formatCurrency(Number(data.dailySpend))}</span></div></div></div>
      </section>

      <section className="grid gap-6 lg:grid-cols-3"><div className="rounded-xl border border-border bg-card p-5 shadow-sm"><div className="flex items-center justify-between"><div><h2 className="font-semibold text-foreground">Marketplace mix</h2><p className="mt-1 text-sm text-muted-foreground">ASIN distribution by channel</p></div><ShoppingBag01 width={20} height={20} className="text-primary" /></div><div className="mt-5 space-y-4">{data.category.length ? data.category.map((marketplace) => { const count = marketplace.data[0] || 0; return <div key={marketplace.name}><div className="flex justify-between text-sm"><span className="text-muted-foreground">{marketplace.name}</span><span className="font-semibold text-foreground">{formatNumber(count)} <span className="font-normal text-muted-foreground">({marketplaceTotal ? Math.round(count / marketplaceTotal * 100) : 0}%)</span></span></div><div className="mt-2 h-2 rounded-full bg-muted"><div className="h-2 rounded-full" style={{ width: `${marketplaceTotal ? count / marketplaceTotal * 100 : 0}%`, backgroundColor: marketplace.color }} /></div></div>; }) : <p className="py-8 text-center text-sm text-muted-foreground">No marketplace data</p>}</div></div>

        <div className="rounded-xl border border-border bg-card p-5 shadow-sm"><div className="flex items-center justify-between"><div><h2 className="font-semibold text-foreground">My workload</h2><p className="mt-1 text-sm text-muted-foreground">Action execution status</p></div><CheckDone01 width={20} height={20} className="text-primary" /></div><div className="mt-5 grid grid-cols-2 gap-3">{[['Pending', workload.pending, 'bg-amber-50 text-amber-700'], ['In progress', workload.inProgress, 'bg-blue-50 text-blue-700'], ['In review', workload.review, 'bg-violet-50 text-violet-700'], ['Completed', workload.completed, 'bg-emerald-50 text-emerald-700']].map(([label, value, tone]) => <div key={String(label)} className={`rounded-lg p-3 ${tone}`}><p className="text-xs">{label}</p><p className="mt-1 text-xl font-semibold">{formatNumber(Number(value))}</p></div>)}</div><Link href="/pems/tasks" className="mt-5 flex items-center justify-center gap-1 text-sm font-semibold text-primary hover:underline">Open task center <ArrowUpRight width={15} height={15} /></Link></div>

        <div className="rounded-xl border border-border bg-card p-5 shadow-sm"><div className="flex items-center justify-between"><div><h2 className="font-semibold text-foreground">Latest alerts</h2><p className="mt-1 text-sm text-muted-foreground">Signals needing attention</p></div><AlertCircle width={20} height={20} className="text-red-500" /></div><div className="mt-4 space-y-3">{data.alerts.length ? data.alerts.slice(0, 4).map((alert) => <div key={alert.id} className="flex gap-3 border-b border-border pb-3 last:border-0"><span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-red-500" /><div className="min-w-0"><p className="truncate text-sm font-medium text-foreground">{alert.message}</p><p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground"><Clock width={12} height={12} /> {alert.time}</p></div></div>) : <p className="py-8 text-center text-sm text-muted-foreground">No active alerts</p>}</div><Link href="/alerts" className="mt-3 flex items-center justify-center gap-1 text-sm font-semibold text-primary hover:underline">View all alerts <ArrowUpRight width={15} height={15} /></Link></div></section>

      <section className="rounded-xl border border-border bg-card shadow-sm"><div className="flex items-center justify-between border-b border-border px-5 py-4"><div><h2 className="font-semibold text-foreground">Top performing ASINs</h2><p className="mt-1 text-sm text-muted-foreground">Highest order volume in the selected period</p></div><Link href="/asin-tracker" className="text-sm font-semibold text-primary hover:underline">View catalog</Link></div><div className="overflow-x-auto"><table className="w-full min-w-[680px] text-left text-sm"><thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground"><tr><th className="px-5 py-3 font-medium">Product</th><th className="px-5 py-3 font-medium">Category</th><th className="px-5 py-3 text-right font-medium">Revenue</th><th className="px-5 py-3 text-right font-medium">Orders</th><th className="px-5 py-3 text-right font-medium">ACOS</th></tr></thead><tbody className="divide-y divide-border">{data.tableData.slice(0, 6).map((product) => <tr key={product.asin} className="hover:bg-accent"><td className="px-5 py-3"><div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-xs font-semibold text-muted-foreground"><Package width={16} height={16} /></span><div><p className="max-w-[280px] truncate font-medium text-foreground">{product.title}</p><p className="text-xs text-muted-foreground">{product.asin}</p></div></div></td><td className="px-5 py-3 text-muted-foreground">{product.category}</td><td className="px-5 py-3 text-right font-medium text-foreground">{formatCurrency(product.revenue)}</td><td className="px-5 py-3 text-right text-muted-foreground">{formatNumber(product.units)}</td><td className="px-5 py-3 text-right text-muted-foreground">{product.acos}</td></tr>)}{!data.tableData.length && <tr><td colSpan={5} className="px-5 py-10 text-center text-muted-foreground">No product performance data available</td></tr>}</tbody></table></div></section>
    </div>
  );
}
