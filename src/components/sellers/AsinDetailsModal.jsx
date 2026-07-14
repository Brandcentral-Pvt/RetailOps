import React from 'react';
import { Package, Zap, Store, ExternalLink, CheckCircle2, AlertCircle, Tag as TagIcon, BarChart } from 'lucide-react';
import { Modal, Row, Col, Typography, Tag, Image, Space, Button, Statistic, Badge } from 'antd';
import styles from './SellerModals.module.css';
import { ModalHeader, ModalFooter } from './ModalShell';

const { Title, Text } = Typography;

const AsinDetailsModal = ({ asin, onClose }) => {
  if (!asin) return null;

  // Calculate discount safely
  const discountPct = asin.currentPrice && asin.mrp ? Math.round((1 - asin.currentPrice / asin.mrp) * 100) : 0;

  return (
    <Modal
      open={!!asin}
      onCancel={onClose}
      className={styles.modalContent}
      closable={false}
      footer={null}
      width={940}
      centered
      destroyOnHidden
      styles={{
        body: { padding: '20px 24px', backgroundColor: 'var(--bg-primary)' }
      }}
      maskStyle={{
        backdropFilter: 'blur(6px)',
        backgroundColor: 'rgba(15, 23, 42, 0.3)'
      }}
    >
      <ModalHeader
        icon={Package}
        title={asin.asinCode}
        subtitle={asin.title ? `${asin.title.substring(0, 60)}...` : 'Product details'}
        extra={
          <Tag color={asin.status === 'Active' ? 'success' : 'default'} style={{ borderRadius: 'var(--radius-md, 8px)', fontWeight: 600, fontSize: 'var(--font-size-xs)', padding: '0 6px' }}>
            {asin.status?.toUpperCase() || 'INACTIVE'}
          </Tag>
        }
      />
      <Row gutter={[24, 24]}>
        {/* Sidebar Column (Left) */}
        <Col xs={24} md={8}>
          <div style={{ 
            background: 'var(--bg-secondary, #f8fafc)', 
            borderRadius: 'var(--radius-xl)', 
            padding: '16px', 
            border: '1px solid var(--border-light, #d9e6e9)',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            height: '100%'
          }}>
            {/* Main Image Box */}
            <div style={{ 
              padding: '12px', 
              background: '#fff', 
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border-light, #d9e6e9)',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: '220px'
            }}>
              <Image.PreviewGroup>
                <Image
                  src={asin.mainImageUrl || asin.imageUrl || 'https://via.placeholder.com/400x400?text=No+Image'}
                  alt={asin.title}
                  style={{ maxHeight: '180px', objectFit: 'contain' }}
                  fallback="https://via.placeholder.com/400x400?text=No+Image"
                />
                
                {/* Dense Gallery Row */}
                {asin.images?.length > 0 && (
                  <div style={{ 
                    display: 'flex', 
                    flexWrap: 'wrap', 
                    gap: '6px', 
                    marginTop: '12px', 
                    justifyContent: 'center',
                    maxHeight: '60px',
                    overflowY: 'auto'
                  }} className={styles.denseScrollbox}>
                    {asin.images.slice(0, 6).map((img, idx) => (
                      <div key={idx} className={styles.subImgGrid}>
                        <Image src={img} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </div>
                    ))}
                  </div>
                )}
              </Image.PreviewGroup>
            </div>

            {/* Tech Specs Directory */}
            <div style={{ background: '#fff', padding: '12px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-light, #d9e6e9)' }}>
              <Text type="secondary" style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '10px' }}>
                Catalog Directory
              </Text>
              <Space orientation="vertical" size={8} style={{ width: '100%' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text type="secondary" style={{ fontSize: 'var(--font-size-xs)', display: 'flex', alignItems: 'center', gap: '4px' }}><Store size={12} /> Sold By</Text>
                  <Text strong style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-primary, #0f172a)', maxWidth: '130px' }} ellipsis>{asin.soldBy || 'N/A'}</Text>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text type="secondary" style={{ fontSize: 'var(--font-size-xs)', display: 'flex', alignItems: 'center', gap: '4px' }}><TagIcon size={12} /> Category</Text>
                  <Text strong style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-primary, #0f172a)', maxWidth: '130px' }} ellipsis title={asin.category}>{asin.category || 'N/A'}</Text>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text type="secondary" style={{ fontSize: 'var(--font-size-xs)', display: 'flex', alignItems: 'center', gap: '4px' }}><Package size={12} /> Local SKU</Text>
                  <Text strong style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-primary, #0f172a)', fontFamily: 'monospace' }}>{asin.sku || 'N/A'}</Text>
                </div>
              </Space>
            </div>

            {/* Dense Sentiment Block */}
            <div style={{ 
              background: 'linear-gradient(135deg, var(--text-primary, #0f172a) 0%, var(--text-primary, #0f172a) 100%)', 
              borderRadius: 'var(--radius-lg)', 
              padding: '14px',
              color: '#fff'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <Text style={{ color: 'var(--text-muted, #94a3b8)', fontSize: 'var(--font-size-xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Customer Feedback</Text>
                <div style={{ display: 'flex', alignItems: 'center', gap: '3px', background: 'rgba(250, 204, 21, 0.15)', color: '#facc15', padding: '2px 6px', borderRadius: 'var(--radius-md, 8px)', fontSize: 'var(--font-size-xs)', fontWeight: 700 }}>
                  <Zap size={10} fill="currentColor" /> {typeof asin.rating === 'number' ? asin.rating.toFixed(1) : (asin.rating || '0.0')}
                </div>
              </div>
              <Text strong style={{ color: '#ffffff', fontSize: 'var(--font-size-lg)', display: 'block', lineHeight: 1 }}>
                {asin.reviewCount?.toLocaleString() || '0'} Reviews
              </Text>
            </div>
          </div>
        </Col>

        {/* Content Column (Right) */}
        <Col xs={24} md={16}>
          <Space orientation="vertical" size={18} style={{ width: '100%' }}>
            
            {/* Title Block */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <Tag color={asin.titleLength > 150 ? 'success' : 'warning'} variant="filled" style={{ fontWeight: 600, fontSize: 'var(--font-size-xs)', borderRadius: 'var(--radius-sm)' }}>
                  {asin.titleLength || 0} CHARS
                </Tag>
                <Button 
                  type="link" 
                  size="small" 
                  icon={<ExternalLink size={12} />}
                  href={asin.pageUrl || (asin.marketplace === 'ajio' ? `https://www.ajio.com/p/${asin.asinCode}` : asin.marketplace === 'myntra' ? `https://www.myntra.com` : `https://amazon.in/dp/${asin.asinCode}`)}
                  target="_blank"
                  style={{ padding: 0, fontSize: 'var(--font-size-xs)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px', height: 'auto' }}
                >
                  Open Marketplace
                </Button>
              </div>
              <Title level={5} style={{ margin: 0, fontWeight: 600, color: 'var(--text-primary, #0f172a)', fontSize: 'var(--font-size-base)', lineHeight: 1.4 }}>
                {asin.title || 'Listing title pending ingestion...'}
              </Title>
            </div>

            {/* Integrated Segmented KPI Container */}
            <div className={styles.compactKpi}>
              <div className={styles.compactKpiItem}>
                <Statistic
                  title={<Text type="secondary" style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Pricing</Text>}
                  value={asin.currentPrice || 0}
                  prefix="₹"
                  styles={{ content: { color: 'var(--text-primary, #0f172a)', fontWeight: 700, fontSize: 'var(--font-size-lg)', lineHeight: 1.2 } }}
                />
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                  {discountPct > 0 && (
                    <>
                      <Text type="secondary" delete style={{ fontSize: 'var(--font-size-xs)' }}>₹{asin.mrp || 0}</Text>
                      <span style={{ color: 'var(--text-success, #2E7D32)', fontWeight: 600, fontSize: 'var(--font-size-xs)' }}>-{discountPct}%</span>
                    </>
                  )}
                </div>
              </div>
              
              <div className={styles.compactKpiItem}>
                <Statistic
                  title={<Text type="secondary" style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>BSR Rank</Text>}
                  value={asin.bsr || 0}
                  formatter={(val) => `#${val?.toLocaleString() || '—'}`}
                  styles={{ content: { color: 'var(--text-brand, #1976D2)', fontWeight: 700, fontSize: 'var(--font-size-lg)', lineHeight: 1.2 } }}
                />
                <Text type="secondary" style={{ fontSize: 'var(--font-size-xs)', display: 'block', marginTop: '2px' }}>Category Tier</Text>
              </div>
            </div>

            {/* Compact Sub BSR Layout */}
            {asin.subBSRs?.length > 0 && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '6px' }}>
                  <BarChart size={11} style={{ color: 'var(--text-secondary, #64748b)' }} />
                  <Text type="secondary" style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Sub-Category Segments</Text>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {asin.subBSRs.map((rank, idx) => (
                    <Tag key={idx} variant="filled" style={{ 
                      background: 'var(--bg-secondary, #f8fafc)', 
                      padding: '2px 8px', 
                      borderRadius: 'var(--radius-md, 8px)',
                      fontWeight: 600,
                      fontSize: 'var(--font-size-xs)',
                      color: '#475569',
                      margin: 0
                    }}>
                      {rank}
                    </Tag>
                  ))}
                </div>
              </div>
            )}

            {/* Highly Compact Feature Bullet Points Box */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <Text type="secondary" style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Enhanced Bullets</Text>
                <Text type="secondary" style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--text-muted, #94a3b8)' }}>{asin.bulletPointsList?.length || 0} Total</Text>
              </div>
              <div 
                style={{ 
                  maxHeight: '180px', 
                  overflowY: 'auto', 
                  background: 'var(--bg-secondary, #f8fafc)', 
                  border: '1px solid var(--border-light, #d9e6e9)', 
                  borderRadius: 'var(--radius-lg)', 
                  padding: '12px' 
                }} 
                className={styles.denseScrollbox}
              >
                {asin.bulletPointsList?.length > 0 ? (
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {asin.bulletPointsList.map((point, idx) => (
                      <li key={idx} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                        <CheckCircle2 size={12} style={{ color: 'var(--text-success, #2E7D32)', flexShrink: 0, marginTop: '2px' }} />
                        <Text style={{ color: '#475569', fontSize: 'var(--font-size-xs)', lineHeight: 1.4 }}>{point}</Text>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div style={{ textAlign: 'center', padding: '16px 0', color: 'var(--text-muted, #94a3b8)' }}>
                    <AlertCircle size={16} style={{ marginBottom: '4px' }} />
                    <Text type="secondary" style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontStyle: 'italic' }}>No structured bullet descriptions available.</Text>
                  </div>
                )}
              </div>
            </div>

          </Space>
        </Col>
      </Row>

      <ModalFooter
        onCancel={onClose}
        confirmText="Close"
      />

    </Modal>
  );
};

export default React.memo(AsinDetailsModal);
