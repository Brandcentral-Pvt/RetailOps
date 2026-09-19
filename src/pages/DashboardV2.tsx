import React, { useState } from 'react';
import { Row, Col } from 'antd';
import DashboardLayout from '../components/dashboard-v2/layouts/DashboardLayout';
import ModernKpiCard, { KpiData } from '../components/dashboard-v2/widgets/ModernKpiCard';
import DataVisualizationChart from '../components/dashboard-v2/charts/DataVisualizationCharts';
import { DollarSign, ShoppingCart, Target, Activity } from 'lucide-react';

const DashboardV2: React.FC = () => {
  const [loading, setLoading] = useState(false);

  // Mock data for demonstration - replace with real API data
  const kpiCards: KpiData[] = [
    {
      id: 'revenue',
      title: 'Total Revenue',
      value: 128450,
      prefix: '$',
      trend: 12.5,
      sparklineData: Array.from({ length: 7 }, (_, i) => ({ name: `Day ${i+1}`, value: Math.random() * 10000 + 8000 })),
      status: 'success',
      icon: <DollarSign size={18} />
    },
    {
      id: 'orders',
      title: 'Total Orders',
      value: 3842,
      trend: 8.2,
      sparklineData: Array.from({ length: 7 }, (_, i) => ({ name: `Day ${i+1}`, value: Math.floor(Math.random() * 500 + 300) })),
      status: 'info',
      icon: <ShoppingCart size={18} />
    },
    {
      id: 'target',
      title: 'Target Achievement',
      value: 87.3,
      suffix: '%',
      trend: 5.1,
      target: 100,
      achievement: 87.3,
      status: 'warning',
      icon: <Target size={18} />
    },
    {
      id: 'acos',
      title: 'ACOS',
      value: 22.4,
      suffix: '%',
      trend: -3.2,
      status: 'success',
      icon: <Activity size={18} />
    }
  ];

  const revenueChartData = Array.from({ length: 30 }, (_, i) => ({
    name: `Day ${i+1}`,
    revenue: Math.random() * 5000 + 3000,
    target: 4000
  }));

  const categoryData = [
    { name: 'Electronics', value: 35 },
    { name: 'Home & Garden', value: 25 },
    { name: 'Sports', value: 20 },
    { name: 'Books', value: 12 },
    { name: 'Others', value: 8 }
  ];

  const topProductsData = Array.from({ length: 8 }, (_, i) => ({
    name: `Product ${i+1}`,
    sales: Math.floor(Math.random() * 1000 + 200)
  }));

  const ordersReturnsData = Array.from({ length: 12 }, (_, i) => ({
    name: `Month ${i+1}`,
    orders: Math.floor(Math.random() * 2000 + 1000),
    returns: Math.floor(Math.random() * 200 + 50)
  }));

  const handleRefresh = async () => {
    setLoading(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    setLoading(false);
  };

  const handleExport = () => {
    console.log('Exporting dashboard data...');
  };

  const handleSettings = () => {
    console.log('Opening settings...');
  };

  return (
    <DashboardLayout
      title="Analytics Dashboard V2"
      onRefresh={handleRefresh}
      onExport={handleExport}
      onSettings={handleSettings}
      loading={loading}
    >
      {/* KPI Cards Row */}
      <Row gutter={[20, 20]} style={{ marginBottom: 24 }}>
        {kpiCards.map((kpi) => (
          <Col xs={24} sm={12} lg={6} key={kpi.id}>
            <ModernKpiCard 
              kpi={kpi} 
              showSparkline={true} 
              showTarget={kpi.id === 'target'}
            />
          </Col>
        ))}
      </Row>

      {/* Charts Row 1 */}
      <Row gutter={[20, 20]} style={{ marginBottom: 24 }}>
        <Col xs={24} lg={16}>
          <DataVisualizationChart
            type="area"
            title="Revenue Trend (Last 30 Days)"
            data={revenueChartData}
            dataKeys={[
              { key: 'revenue', color: '#667eea', name: 'Revenue' },
              { key: 'target', color: '#43e97b', name: 'Target' }
            ]}
            height={300}
            loading={loading}
          />
        </Col>
        <Col xs={24} lg={8}>
          <DataVisualizationChart
            type="pie"
            title="Sales by Category"
            data={categoryData}
            height={300}
            loading={loading}
          />
        </Col>
      </Row>

      {/* Charts Row 2 */}
      <Row gutter={[20, 20]} style={{ marginBottom: 24 }}>
        <Col xs={24} lg={12}>
          <DataVisualizationChart
            type="bar"
            title="Top Performing Products"
            data={topProductsData}
            dataKeys={[
              { key: 'sales', color: '#764ba2', name: 'Sales' }
            ]}
            height={250}
            loading={loading}
          />
        </Col>
        <Col xs={24} lg={12}>
          <DataVisualizationChart
            type="line"
            title="Orders vs Returns"
            data={ordersReturnsData}
            dataKeys={[
              { key: 'orders', color: '#4facfe', name: 'Orders' },
              { key: 'returns', color: '#fa709a', name: 'Returns' }
            ]}
            height={250}
            loading={loading}
          />
        </Col>
      </Row>
    </DashboardLayout>
  );
};

export default DashboardV2;
