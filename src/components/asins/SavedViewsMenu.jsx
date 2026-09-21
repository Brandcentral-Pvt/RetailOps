import React, { useState } from 'react';
import { Button, Dropdown, Modal, Input, Switch, Tooltip, message } from 'antd';
import { Eye, Save, Share2, Trash2, Users, User, Check } from 'lucide-react';

/**
 * Saved views menu (Step 3).
 *
 * A "view" is the whole workspace state — filters, search, sort, visible columns
 * and which surface the user was on — so a teammate can be handed a link-like
 * object instead of a paragraph of instructions. Views live on the server
 * (`AsinSavedViews`), belong to their creator and can be shared with everyone;
 * only the owner (or a global role) may change or delete one.
 */

const ViewRow = ({ view, active, onApply, onUpdate, onDelete, onToggleShare, canEdit }) => (
  <div className="d-flex align-items-center gap-2 px-2 py-1" style={{ minWidth: 280 }}>
    <span className="d-flex align-items-center gap-1" style={{ flex: 1, minWidth: 0 }}>
      {active && <Check size={12} style={{ color: 'var(--text-success)' }} />}
      <span className="text-truncate" style={{ maxWidth: 180, fontSize: 12 }} title={view.name}>
        {view.name}
      </span>
      <Tooltip title={view.isShared ? 'Shared with everyone' : 'Private'}>
        <span>{view.isShared ? <Users size={11} /> : <User size={11} />}</span>
      </Tooltip>
    </span>
    <Tooltip title="Apply this view">
      <Button size="small" type="text" icon={<Eye size={13} />} onClick={() => onApply(view)} />
    </Tooltip>
    {canEdit && active && (
      <Tooltip title="Overwrite with the current workspace state">
        <Button size="small" type="text" icon={<Save size={13} />} onClick={() => onUpdate(view)} />
      </Tooltip>
    )}
    {canEdit && (
      <Tooltip title={view.isShared ? 'Stop sharing' : 'Share with everyone'}>
        <Button size="small" type="text" icon={<Share2 size={13} />} onClick={() => onToggleShare(view)} />
      </Tooltip>
    )}
    {canEdit && (
      <Tooltip title="Delete">
        <Button size="small" type="text" danger icon={<Trash2 size={13} />} onClick={() => onDelete(view)} />
      </Tooltip>
    )}
  </div>
);

const SavedViewsMenu = ({ views = [], activeViewId, onApply, onSave, onUpdate, onDelete, onToggleShare, building = false }) => {
  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [shared, setShared] = useState(false);

  const myViews = views.filter((v) => v.isOwner);
  const teamViews = views.filter((v) => !v.isOwner);

  const submit = () => {
    if (!name.trim()) {
      message.warning('Give the view a name');
      return;
    }
    onSave({ name: name.trim(), isShared: shared });
    setModalOpen(false);
    setName('');
    setShared(false);
  };

  const items = [];
  if (myViews.length > 0) {
    items.push({ key: 'mine-header', type: 'group', label: 'My views' });
    myViews.forEach((view) => {
      items.push({
        key: `view-${view.id}`,
        label: (
          <ViewRow
            view={view}
            active={view.id === activeViewId}
            canEdit
            onApply={onApply}
            onUpdate={onUpdate}
            onDelete={onDelete}
            onToggleShare={onToggleShare}
          />
        ),
      });
    });
  }
  if (teamViews.length > 0) {
    items.push({ key: 'team-header', type: 'group', label: 'Shared with me' });
    teamViews.forEach((view) => {
      items.push({
        key: `view-${view.id}`,
        label: (
          <ViewRow
            view={view}
            active={view.id === activeViewId}
            canEdit={false}
            onApply={onApply}
            onUpdate={onUpdate}
            onDelete={onDelete}
            onToggleShare={onToggleShare}
          />
        ),
      });
    });
  }
  items.push({ type: 'divider', key: 'divider' });
  items.push({
    key: 'save-current',
    label: (
      <span className="d-flex align-items-center gap-2" style={{ fontSize: 12, fontWeight: 600 }}>
        <Save size={13} /> Save current as a view…
      </span>
    ),
    onClick: () => setModalOpen(true),
  });

  return (
    <>
      <Dropdown trigger={['click']} menu={{ items }} placement="bottomRight">
        <Button
          icon={<Eye size={14} />}
          loading={building}
          style={{ height: 32, fontSize: 'var(--font-size-xs)', fontWeight: 600, borderRadius: 'var(--radius-md)' }}
          className="d-flex align-items-center gap-2 shadow-sm"
        >
          Views{views.length > 0 ? ` (${views.length})` : ''}
        </Button>
      </Dropdown>

      <Modal
        title="Save current view"
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={submit}
        okText="Save view"
        width={420}
      >
        <div className="d-flex flex-column gap-3">
          <div>
            <div className="text-secondary fw-bold text-uppercase" style={{ fontSize: 10, marginBottom: 6 }}>Name</div>
            <Input
              autoFocus
              placeholder="e.g. Stale hero SKUs, no A+"
              value={name}
              maxLength={120}
              onChange={(e) => setName(e.target.value)}
              onPressEnter={submit}
            />
          </div>
          <div className="d-flex align-items-center gap-2">
            <Switch checked={shared} onChange={setShared} size="small" />
            <span style={{ fontSize: 12 }}>
              Share with everyone <span className="text-secondary">(otherwise only you can see it)</span>
            </span>
          </div>
          <div className="text-secondary" style={{ fontSize: 11 }}>
            A view stores the filters, search, sort, visible columns and the surface you are on — so it restores exactly.
          </div>
        </div>
      </Modal>
    </>
  );
};

export default SavedViewsMenu;
