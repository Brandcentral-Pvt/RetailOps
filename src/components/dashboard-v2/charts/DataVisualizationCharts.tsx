import React from 'react';
import { Card, Row, Col, Progress, Tag } from 'antd';
import { 
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, 
  Legend, ResponsiveContainer, AreaChart, Area
} from 'recharts';
import { TrendingUp, TrendingDown, DollarSign, ShoppingCart, AlertTriangle } from 'lucide-react';
import styles from './DataVisualizationCharts.module.css';

interface ChartDataPoint {
  name: string;
  value: number;
  [key: string]: any;
}

interface DataChartProps {
  type: 'bar' | 'line' | 'area' | 'pie' | 'combo';
  title: string;
  data: ChartDataPoint[];
  colors?: string[];
  height?: number;
  showLegend?: boolean;
  showGrid?: boolean;
  xAxisKey?: string;
  dataKeys?: Array<{ key: string; color: string; name: string }>;
  loading?: boolean;
}

const COLORS = ['#667eea', '#764ba2', '#f093fb', '#4facfe', '#43e97b', '#fa709a', '#fee140'];

const DataVisualizationChart: React.FC<DataChartProps> = ({
  type = 'bar',
  title,
  data,
  colors = COLORS,
  height = 300,
  showLegend = true,
  showGrid = true,
  xAxisKey = 'name',
  dataKeys = [],
  loading = false
}) => {
  if (loading || !data || data.length === 0) {
    return (
      <Card className={styles.chartCard} title={title}>
        <div className={styles.emptyState}>
          <p>No data available</p>
        </div>
      </Card>
    );
  }

  const renderChart = () => {
    const commonProps = {
      width: '100%',
      height,
      data,
      margin: { top: 20, right: 30, left: 20, bottom: 40 }
    };

    switch (type) {
      case 'bar':
        return (
          <ResponsiveContainer {...commonProps}>
            <BarChart data={data}>
              {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />}
              <XAxis 
                dataKey={xAxisKey} 
                style={{ fontSize: '12px', color: '#666' }}
                tick={{ fill: '#666' }}
              />
              <YAxis style={{ fontSize: '12px', color: '#666' }} tick={{ fill: '#666' }} />
              <RechartsTooltip 
                contentStyle={{ 
                  backgroundColor: '#fff', 
                  border: 'none', 
                  borderRadius: '8px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                }}
              />
              {showLegend && <Legend wrapperStyle={{ paddingTop: '20px' }} />}
              {dataKeys.length > 0 ? (
                dataKeys.map((dk, idx) => (
                  <Bar 
                    key={dk.key} 
                    dataKey={dk.key} 
                    fill={dk.color} 
                    name={dk.name}
                    radius={[4, 4, 0, 0]}
                  />
                ))
              ) : (
                <Bar dataKey="value" fill={colors[0]} radius={[4, 4, 0, 0]} />
              )}
            </BarChart>
          </ResponsiveContainer>
        );

      case 'line':
        return (
          <ResponsiveContainer {...commonProps}>
            <LineChart data={data}>
              {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />}
              <XAxis 
                dataKey={xAxisKey} 
                style={{ fontSize: '12px', color: '#666' }}
                tick={{ fill: '#666' }}
              />
              <YAxis style={{ fontSize: '12px', color: '#666' }} tick={{ fill: '#666' }} />
              <RechartsTooltip 
                contentStyle={{ 
                  backgroundColor: '#fff', 
                  border: 'none', 
                  borderRadius: '8px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                }}
              />
              {showLegend && <Legend wrapperStyle={{ paddingTop: '20px' }} />}
              {dataKeys.length > 0 ? (
                dataKeys.map((dk, idx) => (
                  <Line 
                    key={dk.key} 
                    type="monotone" 
                    dataKey={dk.key} 
                    stroke={dk.color} 
                    name={dk.name}
                    strokeWidth={2}
                    dot={{ r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                ))
              ) : (
                <Line type="monotone" dataKey="value" stroke={colors[0]} strokeWidth={2} />
              )}
            </LineChart>
          </ResponsiveContainer>
        );

      case 'area':
        return (
          <ResponsiveContainer {...commonProps}>
            <AreaChart data={data}>
              <defs>
                {dataKeys.length > 0 ? (
                  dataKeys.map((dk, idx) => (
                    <linearGradient key={dk.key} id={`color-${dk.key}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={dk.color} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={dk.color} stopOpacity={0} />
                    </linearGradient>
                  ))
                ) : (
                  <linearGradient id="color-value" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={colors[0]} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={colors[0]} stopOpacity={0} />
                  </linearGradient>
                )}
              </defs>
              {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />}
              <XAxis 
                dataKey={xAxisKey} 
                style={{ fontSize: '12px', color: '#666' }}
                tick={{ fill: '#666' }}
              />
              <YAxis style={{ fontSize: '12px', color: '#666' }} tick={{ fill: '#666' }} />
              <RechartsTooltip 
                contentStyle={{ 
                  backgroundColor: '#fff', 
                  border: 'none', 
                  borderRadius: '8px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                }}
              />
              {showLegend && <Legend wrapperStyle={{ paddingTop: '20px' }} />}
              {dataKeys.length > 0 ? (
                dataKeys.map((dk) => (
                  <Area 
                    key={dk.key} 
                    type="monotone" 
                    dataKey={dk.key} 
                    stroke={dk.color} 
                    fillOpacity={1} 
                    fill={`url(#color-${dk.key})`} 
                    name={dk.name}
                  />
                ))
              ) : (
                <Area type="monotone" dataKey="value" stroke={colors[0]} fillOpacity={1} fill={`url(#color-value)`} />
              )}
            </AreaChart>
          </ResponsiveContainer>
        );

      case 'pie':
        return (
          <ResponsiveContainer {...commonProps}>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                labelLine={false}
                outerRadius={height / 2 - 20}
                fill="#8884d8"
                dataKey="value"
                nameKey="name"
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                ))}
              </Pie>
              <RechartsTooltip 
                contentStyle={{ 
                  backgroundColor: '#fff', 
                  border: 'none', 
                  borderRadius: '8px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                }}
              />
              {showLegend && <Legend wrapperStyle={{ paddingTop: '20px' }} />}
            </PieChart>
          </ResponsiveContainer>
        );

      case 'combo':
        return (
          <ResponsiveContainer {...commonProps}>
            <BarChart data={data}>
              {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />}
              <XAxis 
                dataKey={xAxisKey} 
                style={{ fontSize: '12px', color: '#666' }}
                tick={{ fill: '#666' }}
              />
              <YAxis yAxisId="left" style={{ fontSize: '12px', color: '#666' }} tick={{ fill: '#666' }} />
              <YAxis yAxisId="right" orientation="right" style={{ fontSize: '12px', color: '#666' }} tick={{ fill: '#666' }} />
              <RechartsTooltip 
                contentStyle={{ 
                  backgroundColor: '#fff', 
                  border: 'none', 
                  borderRadius: '8px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                }}
              />
              {showLegend && <Legend wrapperStyle={{ paddingTop: '20px' }} />}
              {dataKeys.length >= 2 ? (
                <>
                  <Bar yAxisId="left" dataKey={dataKeys[0].key} fill={dataKeys[0].color} name={dataKeys[0].name} radius={[4, 4, 0, 0]} />
                  <Line yAxisId="right" type="monotone" dataKey={dataKeys[1].key} stroke={dataKeys[1].color} name={dataKeys[1].name} strokeWidth={2} />
                </>
              ) : (
                <Bar dataKey="value" fill={colors[0]} radius={[4, 4, 0, 0]} />
              )}
            </BarChart>
          </ResponsiveContainer>
        );

      default:
        return null;
    }
  };

  return (
    <Card className={styles.chartCard} title={title} bordered={false}>
      {renderChart()}
    </Card>
  );
};

export default DataVisualizationChart;
export type { ChartDataPoint, DataChartProps };
