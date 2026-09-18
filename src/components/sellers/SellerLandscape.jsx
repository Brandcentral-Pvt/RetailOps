import React, { useState, useEffect, useMemo } from 'react';
import { Typography, Skeleton } from 'antd';
import { sellerApi } from '../../services/api';

const { Text } = Typography;

const MP_COLORS = {
  'amazon.in': 'var(--text-brand, #1976D2)',
  'ajio': '#9C27B0',
  'myntra': '#E65100',
};

const SellerLandscape = ({ statusFilter, marketplaceFilter, managerFilter, debouncedSearch }) => {
  const [sellers, setSellers] = useState(null);
  const [asOf, setAsOf] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const params = { limit: 5000 };
        if (marketplaceFilter !== 'all') params.marketplace = marketplaceFilter;
        if (managerFilter !== 'all') params.manager = managerFilter;
        if (statusFilter !== 'all') params.status = statusFilter;
        if (debouncedSearch) params.search = debouncedSearch;
        const res = await sellerApi.getAll(params);
        const list = res?.data?.sellers || (Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : []);
        if (!cancelled) {
          setSellers(list);
          setAsOf(Date.now());
        }
      } catch {
        if (!cancelled) {
          setSellers([]);
          setAsOf(Date.now());
        }
      }
    })();
    return () => { cancelled = true; };
  }, [marketplaceFilter, managerFilter, statusFilter, debouncedSearch]);

  const stats = useMemo(() => {
    if (!sellers || asOf === null) return null;
    const total = sellers.length;
    const mp = {};
    const status = { Active: 0, Paused: 0 };
    let totalAsins = 0;
    const fresh = { '24h': 0, '7d': 0, stale: 0 };
    const now = asOf;

    sellers.forEach(s => {
      const mkt = (s.marketplace || '').toLowerCase() || 'unknown';
      if (!mp[mkt]) mp[mkt] = { stores: 0, asins: 0 };
      mp[mkt].stores += 1;
      mp[mkt].asins += (s.totalAsins || 0);
      totalAsins += (s.totalAsins || 0);
      status[s.status === 'Active' ? 'Active' : 'Paused'] += 1;

      const scraped = s.lastScraped ? new Date(s.lastScraped) : null;
      if (scraped && !isNaN(scraped)) {
        const hoursAgo = (now - scraped.getTime()) / 3600000;
        if (hoursAgo <= 24) fresh['24h'] += 1;
        else if (hoursAgo <= 168) fresh['7d'] += 1;
        else fresh.stale += 1;
      } else {
        fresh.stale += 1;
      }
    });

    const mpList = Object.entries(mp).map(([k, v]) => ({
      marketplace: k,
      stores: v.stores,
      asins: v.asins,
      share: total ? v.stores / total : 0,
    })).sort((a, b) => b.stores - a.stores);

    const avgAsins = total ? Math.round(totalAsins / total) : 0;

    return { total, marketplaces: mpList, status, totalAsins, avgAsins, freshness: fresh };
  }, [sellers, asOf]);

  if (!stats) {
    return (
      <div style={{ background: '#fff', border: '1px solid var(--border-light, #d9e6e9)', borderRadius: 'var(--radius-lg)', padding: 16 }}>
        <Skeleton active paragraph={{ rows: 1 }} title={{ width: '25%' }} />
      </div>
    );
  }

  if (stats.total === 0) {
    return (
      <div style={{ background: '#fff', border: '1px solid var(--border-light, #d9e6e9)', borderRadius: 'var(--radius-lg)', padding: 16, textAlign: 'center' }}>
        <Text style={{ color: 'var(--text-muted, #94a3b8)', fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>
          No storefronts match your current filters.
        </Text>
      </div>
    );
  }

  return (
    <div style={{ background: '#fff', border: '1px solid var(--border-light, #d9e6e9)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
      <div style={{ padding: '12px 16px 8px', borderBottom: '1px solid var(--border-light, #d9e6e9)' }}>
        <Text style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--text-secondary, #64748b)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          Seller Landscape
        </Text>
        <Text style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted, #94a3b8)', marginLeft: 8 }}>
          {stats.total} storefront{stats.total !== 1 ? 's' : ''}
        </Text>
      </div>

      <div style={{ display: 'flex' }}>
        <div style={{ flex: 2, padding: '14px 16px', borderRight: '1px solid var(--border-light, #d9e6e9)' }}>
          <Text style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--text-secondary, #64748b)', letterSpacing: '0.05em', textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>
            Marketplace Mix
          </Text>
          <div style={{ height: 6, borderRadius: 3, overflow: 'hidden', display: 'flex', background: '#ECEFF1', marginBottom: 10 }}>
            {stats.marketplaces.map(mp => (
              <div key={mp.marketplace} title={`${mp.marketplace}: ${mp.stores} stores, ${mp.asins.toLocaleString()} ASINs`}
                style={{ width: `${mp.share * 100}%`, background: MP_COLORS[mp.marketplace] || '#94A3B8', minWidth: mp.stores > 0 ? 2 : 0 }} />
            ))}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {stats.marketplaces.map(mp => (
              <div key={mp.marketplace} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: MP_COLORS[mp.marketplace] || '#94A3B8', flexShrink: 0 }} />
                  <Text style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--text-primary, #0f172a)', textTransform: 'uppercase' }}>{mp.marketplace}</Text>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <Text strong style={{ fontSize: 'var(--font-size-xs)' }}>{mp.stores}</Text>
                  <Text style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted, #94a3b8)', marginLeft: 4 }}>
                    {Math.round(mp.share * 100)}%
                  </Text>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ flex: 1, padding: '14px 16px', borderRight: '1px solid var(--border-light, #d9e6e9)' }}>
          <Text style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--text-secondary, #64748b)', letterSpacing: '0.05em', textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>
            Inventory Health
          </Text>
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700, color: 'var(--text-primary, #0f172a)', lineHeight: 1 }}>
              {stats.totalAsins.toLocaleString()}
            </div>
            <Text style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted, #94a3b8)' }}>Total ASINs</Text>
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <div style={{ flex: 1, background: 'var(--bg-secondary, #f8fafc)', borderRadius: 'var(--radius-md, 8px)', padding: '6px 8px', border: '1px solid var(--border-light, #d9e6e9)' }}>
              <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, color: 'var(--text-success, #2E7D32)' }}>{stats.status.Active}</div>
              <Text style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted, #94a3b8)' }}>Active</Text>
            </div>
            <div style={{ flex: 1, background: 'var(--bg-secondary, #f8fafc)', borderRadius: 'var(--radius-md, 8px)', padding: '6px 8px', border: '1px solid var(--border-light, #d9e6e9)' }}>
              <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, color: 'var(--text-secondary, #64748b)' }}>{stats.status.Paused}</div>
              <Text style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted, #94a3b8)' }}>Paused</Text>
            </div>
          </div>
          <Text style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted, #94a3b8)' }}>
            Avg. {stats.avgAsins.toLocaleString()} ASINs / store
          </Text>
        </div>

        <div style={{ flex: 1.2, padding: '14px 16px' }}>
          <Text style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--text-secondary, #64748b)', letterSpacing: '0.05em', textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>
            Sync Activity
          </Text>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              { label: 'Last 24h', count: stats.freshness['24h'], color: '#2E7D32' },
              { label: 'Last 7d', count: stats.freshness['7d'], color: '#E65100' },
              { label: 'Stale', count: stats.freshness.stale, color: '#64748b' },
            ].map((item) => (
              <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: item.color, flexShrink: 0 }} />
                <div style={{ flex: 1, height: 6, borderRadius: 3, background: '#ECEFF1', overflow: 'hidden' }}>
                  <div style={{ width: `${stats.total ? (item.count / stats.total) * 100 : 0}%`, height: '100%', background: item.color, borderRadius: 3 }} />
                </div>
                <Text strong style={{ fontSize: 'var(--font-size-xs)', width: 20, textAlign: 'right' }}>{item.count}</Text>
                <Text style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted, #94a3b8)', width: 44 }}>{item.label}</Text>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SellerLandscape;
