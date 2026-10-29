import React, { useState } from 'react';
import { Upload, Button, Card, Alert, Space, Typography, Descriptions, Tag, Spin, Divider } from 'antd';
import { UploadOutlined, CheckCircleOutlined, FileExcelOutlined, WarningOutlined, InfoCircleOutlined } from '@ant-design/icons';
import tasksApi from '../../../services/tasksApi';
import { message } from 'antd';

const { Text } = Typography;

const ACCEPT_TYPES = '.csv,.xlsx,.xls';

export default function OosInventoryUpload({ taskId, runId, onUploadComplete }) {
  const [vendorFile, setVendorFile] = useState(null);
  const [brandFile, setBrandFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const validateFile = (file) => {
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['csv', 'xlsx', 'xls'].includes(ext)) {
      message.error('Only CSV, XLSX, and XLS files are accepted');
      return false;
    }
    if (file.size > 50 * 1024 * 1024) {
      message.error('File size must be less than 50MB');
      return false;
    }
    return true;
  };

  const handleUpload = async () => {
    if (!vendorFile && !brandFile) {
      message.warning('Please select at least one file');
      return;
    }

    setUploading(true);
    setError(null);
    setResult(null);

    try {
      const res = await tasksApi.uploadInventory(taskId, runId, vendorFile, brandFile);
      setResult(res);
      message.success('Inventory uploaded and reconciliation completed');
      if (onUploadComplete) onUploadComplete();
    } catch (err) {
      setError(err.message || 'Upload failed');
      message.error(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const reset = () => {
    setVendorFile(null);
    setBrandFile(null);
    setResult(null);
    setError(null);
  };

  const renderFileInfo = (file, label, color) => (
    file && (
      <Card size="small" style={{ width: '100%', borderColor: color }}>
        <Space>
          <FileExcelOutlined style={{ fontSize: 16, color }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <Text strong>{file.name}</Text>
            <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>
              {label} • {(file.size / 1024).toFixed(1)} KB
            </Text>
          </div>
          <Button size="small" danger onClick={() => label === 'Vendor Central' ? setVendorFile(null) : setBrandFile(null)}>
            Remove
          </Button>
        </Space>
      </Card>
    )
  );

  const renderResult = () => {
    if (!result) return null;

    const { uploads, reconciliation } = result;

    return (
      <Card size="small" style={{ marginTop: 16 }}>
        <Alert
          message="Upload & Reconciliation Complete"
          type="success"
          showIcon
          closable
          onClose={() => setResult(null)}
        />
        
        <Divider>Upload Summary</Divider>
        <Space direction="vertical" style={{ width: '100%', padding: 8 }}>
          {uploads.vendorCentral && (
            <Descriptions column={4} size="small">
              <Descriptions.Item label="Source">Vendor Central</Descriptions.Item>
              <Descriptions.Item label="Accepted">{uploads.vendorCentral.accepted}</Descriptions.Item>
              <Descriptions.Item label="Rejected">{uploads.vendorCentral.rejected}</Descriptions.Item>
              <Descriptions.Item label="Import ID">{uploads.vendorCentral.import?.Id?.slice(0, 12)}...</Descriptions.Item>
            </Descriptions>
          )}
          {uploads.brandCentral && (
            <Descriptions column={4} size="small">
              <Descriptions.Item label="Source">Brand Central</Descriptions.Item>
              <Descriptions.Item label="Accepted">{uploads.brandCentral.accepted}</Descriptions.Item>
              <Descriptions.Item label="Rejected">{uploads.brandCentral.rejected}</Descriptions.Item>
              <Descriptions.Item label="Import ID">{uploads.brandCentral.import?.Id?.slice(0, 12)}...</Descriptions.Item>
            </Descriptions>
          )}
          {uploads.brandCentral?.asinSources && (
            <Descriptions column={4} size="small">
              <Descriptions.Item label="From Model No (ASIN)">{uploads.brandCentral.asinSources.modelNoDirect}</Descriptions.Item>
              <Descriptions.Item label="From SKU Lookup">{uploads.brandCentral.asinSources.skuLookup}</Descriptions.Item>
            </Descriptions>
          )}
        </Space>

        {reconciliation && (
          <>
            <Divider>Reconciliation</Divider>
            <Descriptions column={4} size="small">
              <Descriptions.Item label="ASINs Analysed">{reconciliation.analysed}</Descriptions.Item>
              <Descriptions.Item label="Decisions">{reconciliation.decisions}</Descriptions.Item>
              {reconciliation.counts && Object.entries(reconciliation.counts).map(([cat, count]) => (
                <Descriptions.Item key={cat} label={cat}>{count}</Descriptions.Item>
              ))}
            </Descriptions>
          </>
        )}
      </Card>
    );
  };

  return (
    <Card size="small" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: 16, flex: 1 }}>
        <div style={{ marginBottom: 24 }}>
          <Typography.Title level={4}>Inventory Upload</Typography.Title>
          <Text type="secondary" style={{ display: 'block', marginTop: 8 }}>
            Upload Vendor Central and/or BrandCentral inventory files to enrich the OOS reconciliation.
            The system will extract ASINs, match with RetailOps data, and auto-run reconciliation.
          </Text>
        </div>

        <Alert
          message="File Requirements"
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        >
          <Space direction="vertical" style={{ width: '100%' }}>
            <Text><strong>Vendor Central:</strong> CSV/Excel with columns: ASIN, SKU, Available units, Status</Text>
            <Text><strong>Brand Central:</strong> CSV/Excel with columns: Model No (col E, contains ASIN like <code>`B0D2LK39FD`</code>), old_quantity, sku</Text>
            <Text>Max file size: 50MB. ASINs must be valid Amazon format (B0XXXXXXXX).</Text>
          </Space>
        </Alert>

        {error && (
          <Alert
            message="Upload Failed"
            description={error}
            type="error"
            showIcon
            closable
            onClose={() => setError(null)}
            style={{ marginBottom: 16 }}
          />
        )}

        <Divider>Vendor Central Inventory</Divider>
        <Space direction="vertical" style={{ width: '100%', marginBottom: 16 }}>
          <Upload
            accept={ACCEPT_TYPES}
            showUploadList={false}
            beforeUpload={validateFile}
            onChange={({ file }) => {
              if (file.originFileObj && validateFile(file.originFileObj)) {
                setVendorFile(file.originFileObj);
              }
            }}
          >
            <Button
              icon={<UploadOutlined />}
              type={vendorFile ? 'default' : 'primary'}
              disabled={uploading}
              style={{ width: '100%' }}
            >
              {vendorFile ? 'Vendor Central File Selected' : 'Select Vendor Central File'}
            </Button>
          </Upload>
          {renderFileInfo(vendorFile, 'Vendor Central', '#1890ff')}
        </Space>

        <Divider>BrandCentral Inventory</Divider>
        <Space direction="vertical" style={{ width: '100%', marginBottom: 16 }}>
          <Upload
            accept={ACCEPT_TYPES}
            showUploadList={false}
            beforeUpload={validateFile}
            onChange={({ file }) => {
              if (file.originFileObj && validateFile(file.originFileObj)) {
                setBrandFile(file.originFileObj);
              }
            }}
          >
            <Button
              icon={<UploadOutlined />}
              type={brandFile ? 'default' : 'primary'}
              disabled={uploading}
              style={{ width: '100%' }}
            >
              {brandFile ? 'BrandCentral File Selected' : 'Select BrandCentral File'}
            </Button>
          </Upload>
          {renderFileInfo(brandFile, 'Brand Central', '#722ed1')}
        </Space>

        <Divider />
        <Space size="middle" style={{ width: '100%' }}>
          <Button
            type="primary"
            icon={<UploadOutlined />}
            size="large"
            onClick={handleUpload}
            disabled={uploading || (!vendorFile && !brandFile)}
            style={{ flex: 1 }}
            loading={uploading}
          >
            {uploading ? 'Uploading & Reconciling...' : 'Upload & Reconcile'}
          </Button>
          {(vendorFile || brandFile || result) && (
            <Button onClick={reset} disabled={uploading} style={{ flex: 1 }}>
              Clear
            </Button>
          )}
        </Space>

        {renderResult()}
      </div>
    </Card>
  );
}