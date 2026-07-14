import React, { useState } from 'react';
import { Modal, Input, Select, Button } from 'antd';
import { Edit3 } from 'lucide-react';
import { ModalHeader, ModalFooter } from './ModalShell';
import styles from './SellerModals.module.css';

const EditAsinModal = ({ asin, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    asinCode: asin.asinCode,
    sku: asin.sku || '',
    status: asin.status || 'Active'
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <Modal
      open
      centered
      onCancel={onClose}
      width={440}
      destroyOnHidden
      className={styles.modalContent}
      footer={null}
    >
      <ModalHeader
        icon={Edit3}
        title="Edit Product Data"
        subtitle={`Editing ${asin.asinCode}`}
      />
      <form onSubmit={handleSubmit}>
        <div style={{ padding: '0 24px 24px' }}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--text-secondary, #64748b)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>ASIN Identifier</label>
            <Input
              value={formData.asinCode}
              disabled
              style={{ fontWeight: 600, fontFamily: 'monospace', borderRadius: "var(--radius-lg)", background: 'var(--bg-secondary, #f8fafc)' }}
            />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--text-secondary, #64748b)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Internal SKU / Label</label>
            <Input
              value={formData.sku}
              onChange={e => setFormData({ ...formData, sku: e.target.value })}
              placeholder="Enter store specific SKU"
              style={{ borderRadius: "var(--radius-lg)" }}
            />
          </div>
          <div style={{ marginBottom: 0 }}>
            <label style={{ display: 'block', fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--text-secondary, #64748b)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Catalog Status</label>
            <Select
              value={formData.status}
              onChange={value => setFormData({ ...formData, status: value })}
              style={{ width: '100%', borderRadius: "var(--radius-lg)" }}
              options={[
                { value: 'Active', label: 'Active Tracking' },
                { value: 'Paused', label: 'Paused / Inactive' },
              ]}
            />
          </div>
        </div>
      </form>
      <ModalFooter
        onCancel={onClose}
        onConfirm={handleSubmit}
        confirmText="Save Changes"
      />
    </Modal>
  );
};

export default React.memo(EditAsinModal);
