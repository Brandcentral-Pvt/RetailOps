import React, { useMemo } from 'react';
import { Card, Table, Typography, Tag, Progress } from 'antd';
import { ShoppingCart, TrendingUp, TrendingDown } from 'lucide-react';

const { Text } = Typography;

const MarketplaceComparison = ({ data = [] }) => {
  const marketplaceData = useMemo(() => {
    // Group by marketplace (mock data since we don't have marketplace field in ads data)
    // In real implementation, this would come from API
    const marketplaces = [
      { name: 'Amazon India', color: '#FF9900', status: 'active' },
      { name: 'Flipkart', color: '#2874F0', status: 'active' },
      { name: 'Ajio', color: '#D23B6C', status: 'active' },
      { name: 'Myntra', color: '#FF3F6C', status: 'active' }
    ];

    // Distribute data across marketplaces for demo
    const totalSpend = data.reduce((a, b) => a + Number(b.spend || 0), 0);
    const totalSales = data.reduce((a, b) => a + Number(b.sales || 0), 0);

    return marketplaces.map((mp, i) => ({
      key: i,
      name: mp.name,
      color: mp.color,
      spend: totalSpend * (0.35 - i * 0.08),
      sales: totalSales * (0.38 - i * 0.07),
      acos: 20 + Math.random() * 15,
      roas: 2 + Math.random() * 2,
      health: 70 + Math.random() * 25,
      status: mp.status
    }));
  }, [data]);

  const columns = [
    {
      title: 'Marketplace',
      dataIndex: 'name',
      key: 'name',
      render: (name, record) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: record.color }} />
          <Text style={{ fontSize: 13, fontWeight: 600 }}>{name}</Text>
        </div>
      )
    },
    {
      title: 'Spend',
      dataIndex: 'spend',
      key: 'spend',
      align: 'right',
      render: (val) => <Text style={{ fontSize: 12, fontWeight: 600 }}>₹{(val / 1000).toFixed(1)}K</Text>
    },
    {
      title: 'Sales',
      dataIndex: 'sales',
      key: 'sales',
      align: 'right',
      render: (val) => <Text style={{ fontSize: 12, fontWeight: 600, color: '#2E7D32' }}>₹{(val / 1000).toFixed(1)}K</Text>
    },
    {
      title: 'ACOS',
      dataIndex: 'acos',
      key: 'acos',
      align: 'center',
      render: (val) => (
        <Tag color={val < 25 ? 'green' : val < 35 ? 'orange' : 'red'} style={{ borderRadius: 4 }}>
          {val.toFixed(1)}%
        </Tag>
      )
    },
    {
      title: 'ROAS',
      dataIndex: 'roas',
      key: 'roas',
      align: 'center',
      render: (val) => (
        <Tag color={val > 3 ? 'green' : val > 2 ? 'orange' : 'red'} style={{ borderRadius: 4 }}>
          {val.toFixed(2)}x
        </Tag>
      )
    },
    {
      title: 'Health',
      dataIndex: 'health',
      key: 'health',
      width: 120,
      render: (val) => (
        <div>
          <Progress 
            percent={val} 
            size="small" 
            strokeColor={val >= 80 ? '#2E7D32' : val >= 60 ? '#ED6C02' : '#C62828'}
            format={(v) => `${v}%`}
          />
        </div>
      )
    }
  ];

  return (
    <Card 
      size="small"
      style={{ borderRadius: 10, marginBottom: 16 }}
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 3, height: 14, background: '#1976D2', borderRadius: 2 }} />
          <Text strong style={{ fontSize: 13 }}>Marketplace Comparison</Text>
        </div>
      }
    >
      <Table 
        dataSource={marketplaceData} 
        columns={columns} 
        pagination={false} 
        size="small"
        style={{ borderRadius: 8 }}
      />
    </Card>
  );
};

export default MarketplaceComparison;
