import React, { useMemo, useState } from 'react';
import { Checkbox, Button, Input, Progress } from 'antd';
import { ShopOutlined } from '@ant-design/icons';

/**
 * Brand coverage for a multi-brand routine ("did I cover every brand I look after today?").
 * Pure presentation — the caller owns persistence. `canEdit` is false until the task is started.
 */
export default function BrandChecklist({ brands = [], canEdit = true, busy = false, onToggle, onToggleAll, hint }) {
  const [q, setQ] = useState('');
  const done = brands.filter(b => b.IsCompleted).length;
  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t ? brands.filter(b => (b.SellerName || '').toLowerCase().includes(t)) : brands;
  }, [brands, q]);
  if (!brands.length) return null;

  return (
    <div className="md-brands" data-testid="brand-checklist">
      <div className="md-brands__head">
        <span className="md-brands__title"><ShopOutlined /> Brands <b>{done}/{brands.length}</b></span>
        <Progress percent={Math.round((done / brands.length) * 100)} showInfo={false} size="small" style={{ flex: 1, margin: '0 10px' }} />
        {onToggleAll && (
          <Button type="link" size="small" disabled={!canEdit || busy} onClick={() => onToggleAll(done !== brands.length)}>
            {done === brands.length ? 'Clear all' : 'Mark all done'}
          </Button>
        )}
      </div>
      {brands.length > 8 && <Input size="small" allowClear placeholder="Find a brand…" value={q} onChange={e => setQ(e.target.value)} style={{ marginBottom: 6 }} />}
      {!canEdit && hint && <div className="md-brands__hint">{hint}</div>}
      <div className="md-brands__list">
        {shown.map(b => (
          <label key={b.Id} className={`md-brand${b.IsCompleted ? ' done' : ''}`}>
            <Checkbox checked={!!b.IsCompleted} disabled={!canEdit || busy} onChange={e => onToggle?.(b, e.target.checked)} />
            <span className="n">{b.SellerName || 'Unnamed brand'}</span>
          </label>
        ))}
        {!shown.length && <div className="md-brands__hint">No brand matches “{q}”.</div>}
      </div>
    </div>
  );
}
