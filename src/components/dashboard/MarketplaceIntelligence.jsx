import React from 'react';
import { Progress, Tag, Typography, Badge } from 'antd';
import { 
  ShoppingCart, TrendingUp, AlertTriangle, CheckCircle, 
  RefreshCw, Image, FileText, BarChart3 
} from 'lucide-react';

const { Text } = Typography;

const MarketplaceCard = ({ name, icon, listings, pending, rejected, approvalStatus, seoScore, syncStatus, health, color }) => {
  const getHealthColor = (h) => h >= 80 ? '#2E7D32' : h >= 60 ? '#ED6C02' : '#C62828';
  const getSyncColor = (s) => s === 'synced' ? '#2E7D32' : s === 'syncing' ? '#4F46E5' : '#C62828';

  return (
    <div style={{ 
      padding: '16px', 
      background: '#fff', 
      border: '1px solid #e4e4e7', 
      borderRadius: 10,
      borderLeft: `4px solid ${color}`
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <ShoppingCart size={20} color={color} />
        </div>
        <div style={{ flex: 1 }}>
          <Text style={{ fontSize: 14, fontWeight: 700, color: '#18181b', display: 'block' }}>{name}</Text>
          <Tag style={{ fontSize: 9, borderRadius: 4, margin: 0, color: getSyncColor(syncStatus), background: getSyncColor(syncStatus) + '15', border: 'none' }}>
            {syncStatus === 'synced' ? '✓ Synced' : syncStatus === 'syncing' ? '⟳ Syncing' : '✗ Error'}
          </Tag>
        </div>
        <div style={{ textAlign: 'right' }}>
          <Text style={{ fontSize: 9, color: '#71717a', display: 'block' }}>Health</Text>
          <Text style={{ fontSize: 18, fontWeight: 700, color: getHealthColor(health) }}>{health}%</Text>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
        <div style={{ padding: '8px 10px', background: '#f4f4f5', borderRadius: 6 }}>
          <Text style={{ fontSize: 9, color: '#71717a', display: 'block' }}>Listings</Text>
          <Text style={{ fontSize: 14, fontWeight: 700, color: '#18181b' }}>{listings.toLocaleString()}</Text>
        </div>
        <div style={{ padding: '8px 10px', background: '#f4f4f5', borderRadius: 6 }}>
          <Text style={{ fontSize: 9, color: '#71717a', display: 'block' }}>Pending</Text>
          <Text style={{ fontSize: 14, fontWeight: 700, color: pending > 0 ? '#ED6C02' : '#18181b' }}>{pending}</Text>
        </div>
        <div style={{ padding: '8px 10px', background: '#f4f4f5', borderRadius: 6 }}>
          <Text style={{ fontSize: 9, color: '#71717a', display: 'block' }}>Rejected</Text>
          <Text style={{ fontSize: 14, fontWeight: 700, color: rejected > 0 ? '#C62828' : '#18181b' }}>{rejected}</Text>
        </div>
        <div style={{ padding: '8px 10px', background: '#f4f4f5', borderRadius: 6 }}>
          <Text style={{ fontSize: 9, color: '#71717a', display: 'block' }}>SEO Score</Text>
          <Text style={{ fontSize: 14, fontWeight: 700, color: seoScore >= 80 ? '#2E7D32' : '#ED6C02' }}>{seoScore}%</Text>
        </div>
      </div>

      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <Text style={{ fontSize: 10, color: '#71717a' }}>Approval Status</Text>
          <Text style={{ fontSize: 10, fontWeight: 600, color: '#18181b' }}>{approvalStatus}%</Text>
        </div>
        <Progress percent={approvalStatus} size="small" strokeColor={color} showInfo={false} />
      </div>
    </div>
  );
};

const MarketplaceIntelligence = ({ marketplaces = [] }) => {
  const defaultMarketplaces = marketplaces.length > 0 ? marketplaces : [
    { name: 'Amazon India', icon: ShoppingCart, listings: 12450, pending: 234, rejected: 18, approvalStatus: 92, seoScore: 85, syncStatus: 'synced', health: 94, color: '#FF9900' },
    { name: 'Flipkart', icon: ShoppingCart, listings: 8920, pending: 156, rejected: 12, approvalStatus: 88, seoScore: 79, syncStatus: 'synced', health: 87, color: '#2874F0' },
    { name: 'Ajio', icon: ShoppingCart, listings: 5670, pending: 89, rejected: 8, approvalStatus: 95, seoScore: 82, syncStatus: 'syncing', health: 91, color: '#D32F2F' },
    { name: 'Myntra', icon: ShoppingCart, listings: 4230, pending: 67, rejected: 5, approvalStatus: 91, seoScore: 78, syncStatus: 'synced', health: 89, color: '#FF3F6C' },
  ];

  return (
    <div style={{ 
      padding: '16px 20px', 
      background: '#fff', 
      borderRadius: 12, 
      border: '1px solid #e4e4e7'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <BarChart3 size={14} color="#1976D2" />
          </div>
          <Text strong style={{ fontSize: 14, color: '#18181b' }}>Marketplace Intelligence</Text>
        </div>
        <Badge count={defaultMarketplaces.filter(m => m.health < 80).length} style={{ backgroundColor: '#C62828' }} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
        {defaultMarketplaces.map((mp, i) => (
          <MarketplaceCard key={i} {...mp} />
        ))}
      </div>
    </div>
  );
};

export default MarketplaceIntelligence;
