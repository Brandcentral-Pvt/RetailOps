import React, { useState } from 'react';
import { Layout, Row, Col, Card, Select, DatePicker, Button, Space, Tag, Tooltip } from 'antd';
import { 
  RefreshCw, Download, Filter, Grid3x3, List, 
  Maximize2, Settings, Bell, Search, Plus 
} from 'lucide-react';
import { RangePicker } from 'antd/es/date-picker';
import styles from './DashboardLayout.module.css';

const { Header, Content } = Layout;

interface DashboardLayoutProps {
  children: React.ReactNode;
  title?: string;
  showFilters?: boolean;
  showActions?: boolean;
  onRefresh?: () => void;
  onExport?: () => void;
  onSettings?: () => void;
  loading?: boolean;
  filters?: React.ReactNode;
  actions?: React.ReactNode;
}

const DashboardLayout: React.FC<DashboardLayoutProps> = ({
  children,
  title = 'Dashboard',
  showFilters = true,
  showActions = true,
  onRefresh,
  onExport,
  onSettings,
  loading = false,
  filters,
  actions
}) => {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  return (
    <Layout className={styles.dashboardLayout}>
      <Header className={styles.dashboardHeader}>
        <div className={styles.headerLeft}>
          <h1 className={styles.pageTitle}>{title}</h1>
          {showFilters && (
            <Space size="middle">
              {filters || (
                <>
                  <Select
                    defaultValue="all"
                    style={{ width: 150 }}
                    options={[
                      { value: 'all', label: 'All Sellers' },
                      { value: 'seller1', label: 'Seller 1' },
                      { value: 'seller2', label: 'Seller 2' },
                    ]}
                  />
                  <RangePicker />
                </>
              )}
            </Space>
          )}
        </div>
        
        <div className={styles.headerRight}>
          <Space size="small">
            <Tooltip title="Search">
              <Button icon={<Search size={16} />} shape="circle" />
            </Tooltip>
            
            <Tooltip title="Notifications">
              <Button icon={<Bell size={16} />} shape="circle" />
            </Tooltip>
            
            {showActions && (
              <>
                <Tooltip title="Refresh Data">
                  <Button 
                    icon={<RefreshCw size={16} className={loading ? 'spin' : ''} />} 
                    onClick={onRefresh}
                    loading={loading}
                  />
                </Tooltip>
                
                <Tooltip title="Export">
                  <Button icon={<Download size={16} />} onClick={onExport} />
                </Tooltip>
                
                <Tooltip title="Settings">
                  <Button icon={<Settings size={16} />} onClick={onSettings} />
                </Tooltip>
                
                <Button.Group>
                  <Button 
                    icon={<Grid3x3 size={16} />} 
                    type={viewMode === 'grid' ? 'primary' : 'default'}
                    onClick={() => setViewMode('grid')}
                  />
                  <Button 
                    icon={<List size={16} />} 
                    type={viewMode === 'list' ? 'primary' : 'default'}
                    onClick={() => setViewMode('list')}
                  />
                </Button.Group>
                
                {actions}
              </>
            )}
          </Space>
        </div>
      </Header>
      
      <Content className={styles.dashboardContent}>
        <div className={`${styles.contentWrapper} ${viewMode === 'grid' ? styles.gridView : styles.listView}`}>
          {children}
        </div>
      </Content>
    </Layout>
  );
};

export default DashboardLayout;
export type { DashboardLayoutProps };
