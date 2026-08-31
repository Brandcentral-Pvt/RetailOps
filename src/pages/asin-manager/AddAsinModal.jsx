import React from 'react';
import { Modal, Button, Form, Input } from 'antd';
import { PlusCircle } from 'lucide-react';
import InfiniteScrollSelect from '../../components/common/InfiniteScrollSelect';

// Verbatim extraction from src/pages/AsinManagerPage.jsx (add-ASIN modal region).
const AddAsinModal = ({
  showAddModal,
  setShowAddModal,
  newAsin,
  setNewAsin,
  syncing,
  handleSync,
  selectedSellerId,
  setSelectedSellerId,
  fetchSellerDropdownData,
}) => {
    return (
        <Modal
          title={
            <div className="d-flex align-items-center gap-2">
              <PlusCircle size={18} className="text-primary" />
              <span style={{ fontWeight: 600 }}>Add New ASINs</span>
            </div>
          }
          open={showAddModal}
          onCancel={() => setShowAddModal(false)}
          footer={[
            <Button key="cancel" onClick={() => setShowAddModal(false)}>
              Cancel
            </Button>,
            <Button
              key="submit"
              type="primary"
              loading={syncing}
              onClick={handleSync}
              style={{ fontWeight: 600 }}
            >
              {syncing ? 'Adding...' : 'Add ASINs'}
            </Button>
          ]}
          width={480}
          centered
          styles={{
            header: { borderBottom: '1px solid #f0f0f0', paddingBottom: 12 },
            footer: { borderTop: '1px solid #f0f0f0', paddingTop: 12 }
          }}
        >
          <div className="py-2">
            <Form layout="vertical">
              <Form.Item
                label={<span className="fw-bold text-zinc-600" style={{ fontSize: 'var(--font-size-xs)' }}>ASIN LIST (COMMA SEPARATED)</span>}
              >
                <Input.TextArea
                  value={newAsin}
                  onChange={(e) => setNewAsin(e.target.value)}
                  placeholder="B0XXXXXXX, B0YYYYYYY"
                  rows={4}
                  style={{ borderRadius: 'var(--radius-md)' }}
                />
              </Form.Item>
              <Form.Item
                label={<span className="fw-bold text-zinc-600" style={{ fontSize: 'var(--font-size-xs)' }}>SELECT SELLER</span>}
              >
                <InfiniteScrollSelect
                  fetchData={fetchSellerDropdownData}
                  value={selectedSellerId}
                  onSelect={setSelectedSellerId}
                  placeholder="Select Seller..."
                />
              </Form.Item>
            </Form>
          </div>
        </Modal>
    );
};

export default AddAsinModal;
