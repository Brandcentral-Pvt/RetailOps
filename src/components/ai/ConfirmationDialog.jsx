import { Modal, Button } from 'antd';
import { ShieldCheck, AlertTriangle } from 'lucide-react';

const ConfirmationDialog = ({ open, onCancel, onConfirm, actions = [], scope = [], intensity = 'medium' }) => {
  const critical = intensity === 'high';

  return (
    <Modal
      open={open}
      onCancel={onCancel}
      footer={null}
      width={520}
      centered
      destroyOnHidden
      title={
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 15 }}>
          {critical ? <AlertTriangle size={16} style={{ color: 'var(--dash-danger)' }} /> : <ShieldCheck size={16} style={{ color: 'var(--dash-warning)' }} />}
          {critical ? 'Review required before execution' : 'Confirm execution'}
        </span>
      }
    >
      <div style={{ fontSize: 13, color: 'var(--bc-text-body)', lineHeight: 1.6 }}>
        {critical ? (
          <p style={{ marginBottom: 12 }}>This action may affect a large number of entities. RetailOps AI will ask you to confirm before high-impact operations.</p>
        ) : (
          <p style={{ marginBottom: 12 }}>RetailOps AI is ready to perform the approved action below. It will only proceed after you confirm.</p>
        )}

        {actions.length ? (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.07em', color: 'var(--bc-text-muted)', textTransform: 'uppercase', marginBottom: 6 }}>Proposed actions</div>
            {actions.map((a) => (
              <div key={a.label} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '7px 10px', border: '1px solid var(--bc-border-default)', borderRadius: 8, marginBottom: 6, background: 'var(--bc-surface-card)' }}>
                <span style={{ fontWeight: 550 }}>{a.label}</span>
                <span style={{ color: 'var(--bc-text-muted)', fontSize: 12 }}>{a.detail || ''}</span>
              </div>
            ))}
          </div>
        ) : null}

        {scope.length ? (
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.07em', color: 'var(--bc-text-muted)', textTransform: 'uppercase', marginBottom: 6 }}>Scope</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {scope.map((s) => (
                <span key={s} className="ai-ws__chip" style={{ cursor: 'default' }}>{s}</span>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 6 }}>
        <Button onClick={onCancel}>Cancel</Button>
        <Button type="primary" danger={critical} onClick={onConfirm}>
          Confirm & execute
        </Button>
      </div>
    </Modal>
  );
};

export default ConfirmationDialog;