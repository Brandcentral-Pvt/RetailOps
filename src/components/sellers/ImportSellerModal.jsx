import React, { useState, useEffect } from 'react';
import { FileUp, ShieldCheck, ChevronRight, RefreshCw, Inbox } from 'lucide-react';
import { userApi } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';
import { Modal, Button, Upload, Typography, Space, Alert, Tag } from 'antd';
import { ModalHeader, ModalFooter } from './ModalShell';
import styles from './SellerModals.module.css';

const { Text } = Typography;
const { Dragger } = Upload;

const ImportSellerModal = ({ onClose, onImport }) => {
  const [isUploading, setIsUploading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [fileStats, setFileStats] = useState(null);
  const [managers, setManagers] = useState([]);
  const { addToast } = useToast();

  useEffect(() => {
    userApi.getManagers()
      .then(data => setManagers(data))
      .catch(() => setManagers([]));
  }, []);

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      addToast({ title: 'Invalid File', message: 'Please upload a CSV file.', type: 'error' });
      return;
    }

    setIsUploading(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target.result;
        const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
        if (lines.length < 2) throw new Error('CSV is empty or missing data rows.');

        const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
        const dataLines = lines.slice(1);

        const nameIdx = headers.findIndex(h => h.includes('name'));
        const idIdx = headers.findIndex(h => h.includes('id'));
        const managerIdx = headers.findIndex(h => h.includes('manager'));
        const marketIdx = headers.findIndex(h => h.includes('market'));

        if (nameIdx === -1 || idIdx === -1) {
          throw new Error('CSV must contain "Store Name" and "Seller ID" columns.');
        }

        const parsedSellers = dataLines.map(line => {
          const cells = line.split(',').map(c => c.trim());
          const name = cells[nameIdx];
          const sellerId = cells[idIdx];
          const managerSearch = managerIdx !== -1 ? cells[managerIdx] : '';
          const marketplace = marketIdx !== -1 ? (cells[marketIdx] || 'amazon.in') : 'amazon.in';

          let managerId = '';
          if (managerSearch) {
            const match = managers.find(m =>
              m.email?.toLowerCase() === managerSearch.toLowerCase() ||
              `${m.firstName} ${m.lastName}`.toLowerCase().includes(managerSearch.toLowerCase())
            );
            if (match) managerId = match._id;
          }

          return { name, sellerId, marketplace, managerId, plan: 'Starter' };
        }).filter(s => s.name && s.sellerId);

        setFileStats({
          name: file.name,
          count: parsedSellers.length,
          data: parsedSellers
        });
      } catch (err) {
        addToast({ title: 'Parse Error', message: err.message, type: 'error' });
      } finally {
        setIsUploading(false);
      }
    };
    reader.readAsText(file);
  };

  const handleImportComplete = async () => {
    if (!fileStats) return;
    setIsImporting(true);
    try {
      await onImport(fileStats.data);
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Modal
      open={true}
      onCancel={onClose}
      className={styles.modalContent}
      closable={false}
      footer={null}
      width={480}
      centered
      destroyOnHidden
    >
      <ModalHeader
        icon={FileUp}
        title="Bulk Migration Pipeline"
        subtitle="Import sellers from a CSV manifest"
      />
      {!fileStats ? (
        <Dragger
          accept=".csv"
          showUploadList={false}
          beforeUpload={(file) => {
            handleFileChange({ target: { files: [file] } });
            return false;
          }}
          style={{ 
            padding: '32px 24px', 
            background: '#fafafa', 
            borderRadius: "var(--radius-xl)", 
            border: '2px dashed var(--border-light, #d9e6e9)' 
          }}
        >
          <p className="ant-upload-drag-icon">
            <div style={{ width: 64, height: 64, background: '#fff', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', border: '1px solid #f0f0f0' }}>
              <FileUp size={32} style={{ color: 'var(--text-primary, #0f172a)' }} />
            </div>
          </p>
          <Text strong style={{ fontSize: 'var(--font-size-lg)', display: 'block', marginTop: 16, color: 'var(--text-primary, #0f172a)' }}>Select Store File</Text>
          <Text type="secondary" style={{ fontSize: 'var(--font-size-sm)', display: 'block', marginTop: 4 }}>
            Upload a .csv file containing store names, merchant IDs, and assigned managers.
          </Text>
          <Button 
            style={{ marginTop: 24, borderRadius: 'var(--radius-full)', fontWeight: 600, padding: '0 24px', background: 'var(--text-primary, #0f172a)', color: '#fff' }}
          >
            {isUploading ? <RefreshCw size={14} className="spin" /> : <ChevronRight size={14} />}
            <span style={{ marginLeft: 8 }}>Browse manifests</span>
          </Button>
        </Dragger>
      ) : (
        <Space orientation="vertical" size={16} style={{ width: '100%' }}>
          <Alert
            message={
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ padding: '8px', background: 'var(--text-success, #2E7D32)', color: '#fff', borderRadius: '50%', display: 'flex' }}>
                  <ShieldCheck size={18} />
                </div>
                <div>
                  <Text strong style={{ color: '#064e3b', display: 'block' }}>{fileStats.name}</Text>
                  <Text style={{ color: '#064e3b', fontSize: 'var(--font-size-xs)', opacity: 0.8 }}>{fileStats.count} Valid store profiles identified</Text>
                </div>
              </div>
            }
            type="success"
            style={{ borderRadius: "var(--radius-lg)", padding: 16, border: 'none', background: 'var(--bg-success-subtle, #f0fdf4)' }}
          />
          
          <div style={{ padding: 16, background: 'var(--bg-secondary, #f8fafc)', borderRadius: "var(--radius-lg)", border: '1px solid var(--border-light, #d9e6e9)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <Text strong style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted, #94a3b8)', letterSpacing: '0.1em' }}>TARGET DATABASE</Text>
              <Tag color="blue" style={{ borderRadius: 'var(--radius-full)', border: 'none', fontWeight: 600, fontSize: 'var(--font-size-xs)', padding: '0 8px' }}>Live Sync</Tag>
            </div>
            <Text type="secondary" style={{ fontSize: 'var(--font-size-sm)', lineHeight: 1.5 }}>
              Our sync agents will automatically allocate these stores to the respective managers and start scanning product data.
            </Text>
          </div>
        </Space>
      )}
      <ModalFooter
        onCancel={onClose}
        onConfirm={handleImportComplete}
        confirmText={isImporting ? 'Syncing...' : 'Confirm Migration'}
        loading={isImporting}
        disabled={!fileStats}
      />
    </Modal>
  );
};

export default React.memo(ImportSellerModal);
