// components/asins/AddBulkAsinModal.jsx

import React, {
  useState, useCallback, useMemo,
  useEffect, useRef, memo
} from 'react';
import {
  Modal, Button, Input, Tag,
  Typography, Divider, Alert, Tooltip
} from 'antd';
import {
  Plus, Scan,
  CheckCircle2, AlertCircle, X, Copy, Info
} from 'lucide-react';
import { ModalHeader, ModalFooter } from './ModalShell';
import styles from './SellerModals.module.css';

const { Text } = Typography;
const { TextArea } = Input;

// ─── ASIN validation ──────────────────────────────────────────────────────────
// Amazon ASINs are exactly 10 alphanumeric characters (B + 9 chars for products)

const ASIN_REGEX = /^[A-Z0-9]{10}$/i;

function parseAsins(raw) {
  const tokens = raw
    .split(/[\n,;\s]+/)
    .map(t => t.trim().toUpperCase())
    .filter(Boolean);

  const seen = new Set();
  const valid = [];
  const invalid = [];

  tokens.forEach(t => {
    if (seen.has(t)) return; // deduplicate
    seen.add(t);
    if (ASIN_REGEX.test(t)) valid.push(t);
    else invalid.push(t);
  });

  return { valid, invalid };
}

// ─── Component ────────────────────────────────────────────────────────────────

const AddBulkAsinModal = memo(({ seller, onClose, onAdd, isSubmitting = false }) => {
  const [text, setText] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const textAreaRef = useRef(null);

  // Auto-focus textarea on open
  useEffect(() => {
    const timer = setTimeout(() => textAreaRef.current?.focus(), 100);
    return () => clearTimeout(timer);
  }, []);

  // Parse & validate ASINs in real time
  const { valid, invalid } = useMemo(() => parseAsins(text), [text]);

  const hasContent = text.trim().length > 0;
  const canSubmit = valid.length > 0 && !isSubmitting;
  const showValidation = hasContent;

  // ── Handlers ──────────────────────────────────────────────────────────

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return;
    setSubmitted(true);
    try {
      await onAdd(valid);
      setText('');
    } finally {
      setSubmitted(false);
    }
  }, [canSubmit, valid, onAdd]);

  // Ctrl+Enter to submit
  const handleKeyDown = useCallback((e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      void handleSubmit();
    }
    if (e.key === 'Escape') {
      onClose();
    }
  }, [handleSubmit, onClose]);

  // Paste + auto-clean
  const handlePaste = useCallback((e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text');
    // Normalise separators on paste
    const normalised = pasted.replace(/[,;\t]+/g, '\n').trim();
    setText(prev => prev ? `${prev}\n${normalised}` : normalised);
  }, []);

  // Copy valid ASINs
  const handleCopyValid = useCallback(() => {
    navigator.clipboard.writeText(valid.join('\n'));
  }, [valid]);

  // Clear all
  const handleClear = useCallback(() => {
    setText('');
    textAreaRef.current?.focus();
  }, []);

  const sellerName = seller?.name || 'this seller';

  return (
    <Modal
      open={true}
      onCancel={onClose}
      width={520}
      footer={null}
      closable={false}
      destroyOnHidden
      className={styles.modalContent}
      styles={{
        body: { padding: 0 }
      }}
    >
      {/* ── Header ──────────────────────────────────────────────── */}
      <ModalHeader
        icon={Plus}
        title="Add ASINs"
        subtitle={`→ ${sellerName}`}
        dark
      />

      {/* ── Body ────────────────────────────────────────────────── */}
      <div style={{ padding: '20px 24px', background: '#fff' }}>

        {/* Instruction */}
        <div style={{
          display: 'flex', gap: 10, padding: '10px 14px',
          background: '#f0f9ff', border: '1px solid var(--color-info-border, #bae6fd)',
          borderRadius: 'var(--radius-lg, 12px)', marginBottom: 16
        }}>
          <Info size={15} color="#0284c7" style={{ flexShrink: 0, marginTop: 1 }} />
          <Text style={{ fontSize: 'var(--font-size-sm)', color: '#075985', lineHeight: '18px' }}>
            Enter ASINs separated by <strong>commas, spaces, or new lines</strong>.
            Duplicates are automatically removed.
            Press <kbd style={{ background: '#e0f2fe', padding: '1px 5px', borderRadius: "var(--radius-sm)", fontSize: 'var(--font-size-xs)', fontFamily: 'monospace' }}>Ctrl+Enter</kbd> to submit.
          </Text>
        </div>

        {/* Label row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <label style={{
            fontSize: 'var(--font-size-xs)', fontWeight: 600, color: '#475569',
            letterSpacing: '0.05em', textTransform: 'uppercase',
            display: 'flex', alignItems: 'center', gap: 5
          }}>
            <Scan size={13} color="var(--text-secondary, #64748b)" /> ASIN List
          </label>
          {hasContent && (
            <Button type="text" size="small" icon={<X size={11} />}
              onClick={handleClear}
              style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted, #94a3b8)', height: 'auto', padding: '2px 6px' }}>
              Clear
            </Button>
          )}
        </div>

        {/* Textarea */}
        <TextArea
          ref={textAreaRef}
          rows={7}
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder={`B07X6C9RMF\nB08N5WRWNW\nB08L5TNJHK\n\n...or paste a comma-separated list`}
          style={{
            fontFamily: 'monospace', fontSize: 'var(--font-size-sm)',
            borderRadius: 'var(--radius-lg, 12px)', lineHeight: '20px',
            resize: 'vertical', border: '1.5px solid var(--border-light, #d9e6e9)'
          }}
          aria-label="ASIN input"
          aria-describedby="asin-hint"
        />
        <div id="asin-hint" style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted, #94a3b8)', marginTop: 5, fontStyle: 'italic' }}>
          Valid ASINs are exactly 10 alphanumeric characters (e.g. B07X6C9RMF)
        </div>

        {/* ── Live validation preview ──────────────────────── */}
        {showValidation && (
          <div style={{ marginTop: 14 }}>
            <Divider style={{ margin: '0 0 12px' }} />

            <div style={{ display: 'flex', gap: 10 }}>
              {/* Valid count */}
              <div style={{
                flex: 1, padding: '10px 14px', borderRadius: 'var(--radius-lg, 12px)',
                background: valid.length > 0 ? 'var(--bg-success-subtle, #f0fdf4)' : 'var(--bg-secondary, #f8fafc)',
                border: `1.5px solid ${valid.length > 0 ? '#86efac' : 'var(--border-light, #d9e6e9)'}`
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                  <CheckCircle2 size={14} color={valid.length > 0 ? 'var(--text-success, #2E7D32)' : 'var(--text-muted, #94a3b8)'} />
                  <Text style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: valid.length > 0 ? 'var(--text-success, #2E7D32)' : 'var(--text-muted, #94a3b8)' }}>
                    {valid.length} Valid ASIN{valid.length !== 1 ? 's' : ''}
                  </Text>
                  {valid.length > 0 && (
                    <Tooltip title="Copy valid ASINs">
                      <Button type="text" size="small"
                        icon={<Copy size={10} />}
                        onClick={handleCopyValid}
                        style={{ marginLeft: 'auto', padding: '0 4px', height: 'auto', color: 'var(--text-success, #2E7D32)' }}
                      />
                    </Tooltip>
                  )}
                </div>
                {/* Show first 5 valid ASINs */}
                {valid.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {valid.slice(0, 5).map(asin => (
                      <Tag key={asin} style={{
                        fontFamily: 'monospace', fontSize: 'var(--font-size-xs)', fontWeight: 600,
                        borderRadius: "var(--radius-sm)", margin: 0,
                        background: 'var(--bg-success-subtle, #dcfce7)', border: '1px solid var(--color-success-border, #bbf7d0)', color: 'var(--text-success, #2E7D32)'
                      }}>
                        {asin}
                      </Tag>
                    ))}
                    {valid.length > 5 && (
                      <Tag style={{
                        fontSize: 'var(--font-size-xs)', borderRadius: "var(--radius-sm)", margin: 0,
                        background: 'var(--bg-success-subtle, #dcfce7)', border: '1px solid var(--color-success-border, #bbf7d0)', color: 'var(--text-success, #2E7D32)'
                      }}>
                        +{valid.length - 5} more
                      </Tag>
                    )}
                  </div>
                )}
              </div>

              {/* Invalid count */}
              {invalid.length > 0 && (
                <div style={{
                  flex: 1, padding: '10px 14px', borderRadius: 'var(--radius-lg, 12px)',
                  background: 'var(--bg-danger-subtle, #fef2f2)', border: '1.5px solid #fca5a5'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                    <AlertCircle size={14} color="var(--text-danger, #D32F2F)" />
                    <Text style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--text-danger, #D32F2F)' }}>
                      {invalid.length} Invalid
                    </Text>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {invalid.slice(0, 4).map(val => (
                      <Tag key={val} style={{
                        fontFamily: 'monospace', fontSize: 'var(--font-size-xs)',
                        borderRadius: "var(--radius-sm)", margin: 0,
                        background: 'var(--bg-danger-subtle, #fee2e2)', border: '1px solid #fca5a5', color: 'var(--text-danger, #D32F2F)'
                      }}>
                        {val}
                      </Tag>
                    ))}
                    {invalid.length > 4 && (
                      <Tag style={{
                        fontSize: 'var(--font-size-xs)', borderRadius: "var(--radius-sm)", margin: 0,
                        background: 'var(--bg-danger-subtle, #fee2e2)', border: '1px solid #fca5a5', color: 'var(--text-danger, #D32F2F)'
                      }}>
                        +{invalid.length - 4} more
                      </Tag>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Only-invalid warning */}
            {hasContent && valid.length === 0 && invalid.length > 0 && (
              <Alert
                type="warning"
                showIcon
                message="No valid ASINs found"
                description="ASINs must be exactly 10 alphanumeric characters. Check your input."
                style={{ marginTop: 10, borderRadius: 'var(--radius-lg, 12px)', fontSize: 'var(--font-size-sm)' }}
              />
            )}
          </div>
        )}
      </div>

      {/* ── Footer ──────────────────────────────────────────────── */}
      <ModalFooter
        onCancel={onClose}
        onConfirm={handleSubmit}
        confirmText={valid.length > 0 ? `Add ${valid.length} ASIN${valid.length !== 1 ? 's' : ''}` : 'Add to Catalog'}
        loading={isSubmitting}
        disabled={!canSubmit}
        confirmIcon={!isSubmitting ? <Plus size={14} /> : undefined}
        extra={
          <Text style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted, #94a3b8)' }}>
            {valid.length > 0 ? `Ready to add ${valid.length} ASIN${valid.length !== 1 ? 's' : ''}` : 'Paste or type your ASINs above'}
          </Text>
        }
      />

    </Modal>
  );
});

export default AddBulkAsinModal;