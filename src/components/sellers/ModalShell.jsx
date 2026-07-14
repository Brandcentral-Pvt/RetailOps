import React from 'react';
import { Button, Typography } from 'antd';
import { X } from 'lucide-react';
import styles from './SellerModals.module.css';

const { Text, Title } = Typography;

/**
 * Consistent modal header with icon, title, and subtitle.
 * @param {React.ReactNode} icon - Lucide icon component
 * @param {string} title - Main heading
 * @param {string} subtitle - Secondary text
 * @param {string} [accent] - Icon background color (CSS value)
 * @param {React.ReactNode} [extra] - Right-side content (e.g., tags)
 * @param {boolean} [dark] - Dark header variant (for AddBulkAsin)
 */
export const ModalHeader = ({ icon: Icon, title, subtitle, accent, extra, dark }) => (
  <div className={`${styles.modalHeader} ${dark ? styles.modalHeaderDark : ''}`}>
    <div className={styles.modalHeaderLeft}>
      <div
        className={styles.modalHeaderIcon}
        style={accent ? { background: accent, color: '#fff' } : undefined}
      >
        <Icon size={18} />
      </div>
      <div>
        <Title level={5} className={styles.modalTitle}>{title}</Title>
        {subtitle && <Text className={styles.modalSubtitle}>{subtitle}</Text>}
      </div>
    </div>
    {extra && <div className={styles.modalHeaderExtra}>{extra}</div>}
  </div>
);

/**
 * Consistent modal footer with cancel and action buttons.
 * @param {Function} onCancel - Close handler
 * @param {Function} onConfirm - Submit handler
 * @param {string} confirmText - Button label
 * @param {boolean} [loading] - Loading state
 * @param {boolean} [disabled] - Disabled state
 * @param {React.ReactNode} [confirmIcon - Icon for confirm button
 * @param {React.ReactNode} [extra] - Left-side content (e.g., status text)
 * @param {string} [confirmType] - Button type (default: 'primary')
 */
export const ModalFooter = ({
  onCancel,
  onConfirm,
  confirmText = 'Save',
  loading = false,
  disabled = false,
  confirmIcon,
  extra,
  confirmType = 'primary',
}) => (
  <div className={styles.modalFooter}>
    <div className={styles.modalFooterLeft}>
      {extra}
    </div>
    <div className={styles.modalFooterRight}>
      <Button
        onClick={onCancel}
        disabled={loading}
        className={styles.modalFooterCancel}
      >
        Cancel
      </Button>
      {onConfirm && (
        <Button
          type={confirmType}
          loading={loading}
          disabled={disabled}
          onClick={onConfirm}
          icon={confirmIcon}
          className={styles.modalFooterConfirm}
        >
          {confirmText}
        </Button>
      )}
    </div>
  </div>
);
