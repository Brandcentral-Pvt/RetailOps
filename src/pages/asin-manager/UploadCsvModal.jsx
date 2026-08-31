import React from 'react';
import { Modal, Button, Form, Input } from 'antd';
import { Upload } from 'lucide-react';
import InfiniteScrollSelect from '../../components/common/InfiniteScrollSelect';

// Verbatim extraction from src/pages/AsinManagerPage.jsx (CSV upload modal region).
const UploadCsvModal = ({
  showUploadModal,
  setShowUploadModal,
  uploading,
  selectedSellerId,
  setSelectedSellerId,
  fetchSellerDropdownData,
  handleCsvUpload,
}) => {
    return (
        <Modal
          title={
            <div className="d-flex align-items-center gap-2">
              <Upload size={18} className="text-emerald-600" />
              <span style={{ fontWeight: 600 }}>Upload CSV</span>
            </div>
          }
          open={showUploadModal}
          onCancel={() => setShowUploadModal(false)}
          footer={[
            <Button key="cancel" onClick={() => setShowUploadModal(false)}>
              Cancel
            </Button>,
            <Button
              key="submit"
              type="primary"
              loading={uploading}
              disabled={!selectedSellerId}
              onClick={() => document.querySelector('input[type="file"]')?.click()}
              style={{ background: 'var(--text-success)', borderColor: 'var(--text-success)', fontWeight: 600 }}
            >
              {uploading ? 'Uploading...' : 'Import CSV'}
            </Button>
          ]}
          width={450}
          centered
        >
          <div className="py-3">
            <Form layout="vertical">
              <Form.Item label={<span className="fw-bold text-zinc-600" style={{ fontSize: 'var(--font-size-xs)' }}>SELECT SELLER</span>}>
                <InfiniteScrollSelect
                  fetchData={fetchSellerDropdownData}
                  value={selectedSellerId}
                  onSelect={setSelectedSellerId}
                  placeholder="Select Seller..."
                />
              </Form.Item>
              <Form.Item label={<span className="fw-bold text-zinc-600" style={{ fontSize: 'var(--font-size-xs)' }}>CSV FILE</span>}>
                <Input
                  type="file"
                  accept=".csv"
                  onChange={handleCsvUpload}
                  style={{ borderRadius: 'var(--radius-md)' }}
                />
              </Form.Item>
            </Form>
          </div>
        </Modal>
    );
};

export default UploadCsvModal;
