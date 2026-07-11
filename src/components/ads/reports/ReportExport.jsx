import React, { useState } from 'react';
import { Card, Button, Select, Space, Typography, message, Dropdown } from 'antd';
import { Download, FileSpreadsheet, FileText, File, Loader2 } from 'lucide-react';
import { adsApi } from '../../services/api';
import toast from '../../utils/toast';

const { Text } = Typography;

const ReportExport = ({ data = [], filters = {} }) => {
  const [exporting, setExporting] = useState(false);

  const handleExport = async (format) => {
    if (data.length === 0) {
      toast.warning('No data to export');
      return;
    }

    setExporting(true);
    try {
      const params = {
        ...filters,
        format,
        includeHeaders: true
      };

      const res = await adsApi.exportAdsManagerData(params);
      if (res.success && res.downloadUrl) {
        // Trigger download
        const link = document.createElement('a');
        link.href = res.downloadUrl;
        link.download = `ads-report-${new Date().toISOString().split('T')[0]}.${format}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success(`Export started! Check Downloads.`);
      } else {
        toast.success('Export queued. Check Downloads for status.');
      }
    } catch (err) {
      console.error('Export failed:', err);
      toast.error('Export failed. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  const exportOptions = [
    {
      key: 'excel',
      label: 'Export as Excel',
      icon: <FileSpreadsheet size={14} />,
      onClick: () => handleExport('xlsx')
    },
    {
      key: 'csv',
      label: 'Export as CSV',
      icon: <FileText size={14} />,
      onClick: () => handleExport('csv')
    },
    {
      key: 'pdf',
      label: 'Export as PDF',
      icon: <File size={14} />,
      onClick: () => handleExport('pdf')
    }
  ];

  return (
    <Card 
      size="small"
      style={{ borderRadius: 10, marginBottom: 16 }}
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 3, height: 14, background: '#2E7D32', borderRadius: 2 }} />
          <Text strong style={{ fontSize: 13 }}>Export Report</Text>
        </div>
      }
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ fontSize: 12, color: '#71717a' }}>
          Export {data.length} records in your preferred format
        </Text>
        <Dropdown menu={{ items: exportOptions }} trigger={['click']}>
          <Button 
            type="primary" 
            icon={exporting ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
            loading={exporting}
            style={{ borderRadius: 8, fontWeight: 600 }}
          >
            Export
          </Button>
        </Dropdown>
      </div>
    </Card>
  );
};

export default ReportExport;
