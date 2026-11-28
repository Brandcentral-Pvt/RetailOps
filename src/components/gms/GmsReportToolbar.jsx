import React from 'react';
import {Alert,Badge,Button,Card,Col,Flex,Input,Row,Select,Space,Tag,Tooltip,Typography} from 'antd';
import {DownloadOutlined,HistoryOutlined,ReloadOutlined,SearchOutlined,UploadOutlined} from '@ant-design/icons';
import dayjs from 'dayjs';
import {formatCount} from './gmsPresentation.mjs';
import ReportDateRangePicker from '../common/ReportDateRangePicker';
const {Text}=Typography;
export default function GmsReportToolbar({startDate,endDate,onDateRangeChange,sellers,managers,selectedSellers,selectedManagers,search,onSellersChange,onManagersChange,onSearchChange,onReset,metadataLoading,metadataError,analytics,loading,reportLoading,error,lastLoadedAt,onRefresh,canImport,canExport,onImport,onHistory,onExport}){
  const meta=analytics?.meta;
  const filters=selectedSellers.length+selectedManagers.length+(search.trim()?1:0);
  const sync=error?'Sync failed':loading?'Syncing…':lastLoadedAt?'Synced '+dayjs(lastLoadedAt).format('HH:mm:ss'):'Not synced';
  return <Card size="small" className="gms-toolbar">
    <Flex vertical gap={10}>
      <Flex justify="space-between" align="center" wrap gap={12}>
        <div className="gms-toolbar-heading"><Typography.Title level={4} className="gms-section-title">GMS Tracker</Typography.Title><Text type="secondary">Financial reporting workspace</Text></div>
        <Space wrap size={8} className="gms-toolbar-actions">
          <Badge status={error?'error':loading?'processing':lastLoadedAt?'success':'default'} text={sync}/>
          <Tooltip title="Refresh report and filter options"><Button icon={<ReloadOutlined/>} aria-label="Refresh data" loading={loading} onClick={onRefresh}/></Tooltip>
          {canImport&&<Button aria-label="Import history" icon={<HistoryOutlined/>} onClick={onHistory}>Import history</Button>}
          {canExport&&<Button aria-label="Export" icon={<DownloadOutlined/>} onClick={onExport} disabled={loading||!!error}>Export</Button>}
          {canImport&&<Button aria-label="Upload Data" type="primary" icon={<UploadOutlined/>} onClick={onImport}>Upload Data</Button>}
        </Space>
      </Flex>
      <Row gutter={[12,8]} align="bottom" className="gms-filter-grid">
        <Col xs={24} md={12} xl={8} xxl={7}>
          <label className="gms-field-label" htmlFor="gms-report-range">Reporting dates</label>
          <ReportDateRangePicker idPrefix="gms-report-range" startDate={startDate} endDate={endDate} onDateRangeChange={onDateRangeChange}/>
        </Col>
        <Col xs={24} sm={12} md={12} xl={5} xxl={5}>
          <label className="gms-field-label" htmlFor="gms-seller-filter">Seller</label>
          <Select id="gms-seller-filter" mode="multiple" allowClear maxTagCount="responsive" showSearch optionFilterProp="label"
            placeholder="All sellers" value={selectedSellers} onChange={onSellersChange} options={sellers}
            loading={metadataLoading} style={{width:'100%'}}/>
        </Col>
        <Col xs={24} sm={12} md={12} xl={5} xxl={5}>
          <label className="gms-field-label" htmlFor="gms-manager-filter">Manager</label>
          <Select id="gms-manager-filter" mode="multiple" allowClear maxTagCount="responsive" showSearch optionFilterProp="label"
            placeholder="All managers" value={selectedManagers} onChange={onManagersChange} options={managers}
            loading={metadataLoading} style={{width:'100%'}}/>
        </Col>
        <Col xs={24} md={12} xl={6} xxl={7}>
          <label className="gms-field-label" htmlFor="gms-search">Search</label>
          <Input id="gms-search" allowClear prefix={<SearchOutlined/>} maxLength={200} value={search} onChange={e=>onSearchChange(e.target.value)}
            placeholder="ASIN, title, brand or store" suffix={filters?<Tooltip title="Reset seller, manager and search filters"><Button type="text" size="small" onClick={onReset}>Reset</Button></Tooltip>:null}/>
        </Col>
      </Row>
      {metadataError&&<Alert type="warning" showIcon title="Filter options unavailable" description={metadataError}/>}
      {meta&&!reportLoading&&<Flex align="center" wrap gap={8} role="note" aria-label="Dataset summary" className="gms-dataset-strip">
        <Tag>{formatCount(meta.records)} daily records</Tag><Tag>{formatCount(meta.asins)} ASINs</Tag><Tag>{formatCount(meta.sellers)} {meta.sellers===1?'seller':'sellers'}</Tag>
        <Tooltip title="Unmatched daily records remain in authorized totals; Seller (DB) is shown as a dash until RetailOps resolves the assignment."><Tag color={meta.unmatchedRecords?'warning':'default'}>{formatCount(meta.unmatchedRecords??0)} unmatched records</Tag></Tooltip>
        {meta.last&&<Text type="secondary">Last report: {dayjs(meta.last).format('DD MMM YYYY')}</Text>}
        {!!filters&&<Button size="small" type="link" onClick={onReset}>Clear all filters</Button>}
      </Flex>}

    </Flex>
  </Card>;
}
