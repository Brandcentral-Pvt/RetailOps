import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Input, Modal, Tag, Empty } from 'antd';
import { SearchOutlined, ArrowRightOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

const CommandPalette = ({ open, onClose }) => {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
      setQuery('');
    }
  }, [open]);

  const commands = useMemo(() => [
    { id: 'dashboard', label: 'Dashboard', path: '/dashboard', category: 'Navigation', icon: '📊' },
    { id: 'sellers', label: 'Sellers', path: '/sellers', category: 'Navigation', icon: '🏪' },
    { id: 'asin-manager', label: 'ASIN Manager', path: '/asin-tracker', category: 'Navigation', icon: '📦' },
    { id: 'ads-manager', label: 'Ads Manager', path: '/ads-manager', category: 'Navigation', icon: '📈' },
    { id: 'gms-tracker', label: 'GMS Tracker', path: '/gms-tracker', category: 'Navigation', icon: '💹' },
    { id: 'seller-tracker', label: 'Seller Tracker', path: '/seller-tracker', category: 'Navigation', icon: '🎯' },
    { id: 'parent-trends', label: 'Parent Trends', path: '/parent-asin-report', category: 'Navigation', icon: '📊' },
    { id: 'sku-analysis', label: 'SKU Analysis', path: '/sku-report', category: 'Navigation', icon: '🔍' },
    { id: 'rule-sets', label: 'Rule Sets', path: '/rule-sets', category: 'Automation', icon: '⚡' },
    { id: 'tasks', label: 'Tasks', path: '/tasks', category: 'Automation', icon: '📋' },
    { id: 'pems', label: 'PEMS Dashboard', path: '/pems/dashboard', category: 'Automation', icon: '📈' },
    { id: 'scheduled-runs', label: 'Scheduled Runs', path: '/scheduled-runs', category: 'Automation', icon: '⏰' },
    { id: 'live-sync', label: 'Live Sync Tracker', path: '/live-sync-tracker', category: 'Automation', icon: '🔄' },
    { id: 'live-data', label: 'Live Data Inspector', path: '/live-data-inspector', category: 'Automation', icon: '🔬' },
    { id: 'profit-loss', label: 'Profit & Loss', path: '/profit-loss', category: 'Finance', icon: '💰' },
    { id: 'inventory', label: 'Inventory', path: '/inventory', category: 'Finance', icon: '📦' },
    { id: 'target', label: 'Target vs Achievement', path: '/target-achievement', category: 'Finance', icon: '🎯' },
    { id: 'monthly', label: 'Monthly Recap', path: '/month-wise-report', category: 'Finance', icon: '📅' },
    { id: 'performance', label: 'Performance', path: '/actions/achievement-report', category: 'Finance', icon: '📊' },
    { id: 'users', label: 'Users', path: '/users', category: 'System', icon: '👥' },
    { id: 'roles', label: 'Roles & Permissions', path: '/roles', category: 'System', icon: '🔐' },
    { id: 'settings', label: 'Settings', path: '/settings', category: 'System', icon: '⚙️' },
    { id: 'webhooks', label: 'Webhooks', path: '/webhooks', category: 'System', icon: '🔗' },
    { id: 'chat', label: 'Messaging', path: '/chat', category: 'Communication', icon: '💬' },
    { id: 'profile', label: 'My Profile', path: '/profile', category: 'Account', icon: '👤' },
  ], []);

  const filtered = useMemo(() => {
    if (!query) return commands;
    const q = query.toLowerCase();
    return commands.filter(c => 
      c.label.toLowerCase().includes(q) || 
      c.category.toLowerCase().includes(q)
    );
  }, [query, commands]);

  const grouped = useMemo(() => {
    const groups = {};
    filtered.forEach(c => {
      if (!groups[c.category]) groups[c.category] = [];
      groups[c.category].push(c);
    });
    return groups;
  }, [filtered]);

  const handleSelect = (path) => {
    navigate(path);
    onClose();
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      closable={false}
      width={560}
      styles={{ body: { padding: 0, borderRadius: "var(--radius-lg)", overflow: 'hidden' } }}
    >
      <div style={{ borderBottom: '1px solid var(--border-light, #d9e6e9)', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <SearchOutlined style={{ fontSize: 18, color: 'var(--text-secondary, #64748b)' }} />
        <input
          ref={inputRef}
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search pages, commands..."
          style={{ flex: 1, border: 'none', outline: 'none', fontSize: 15, fontWeight: 500, color: 'var(--text-primary, #0f172a)', background: 'transparent' }}
        />
        <Tag style={{ fontSize: 10, margin: 0, borderRadius: "var(--radius-sm)" }}>ESC</Tag>
      </div>
      <div style={{ maxHeight: 400, overflowY: 'auto', padding: '8px 0' }}>
        {Object.keys(grouped).length === 0 ? (
          <Empty description="No results found" style={{ padding: '40px 0' }} />
        ) : (
          Object.entries(grouped).map(([category, items]) => (
            <div key={category}>
              <div style={{ padding: '8px 16px 4px', fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--text-secondary, #64748b)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                {category}
              </div>
              {items.map(item => (
                <div
                  key={item.id}
                  onClick={() => handleSelect(item.path)}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', cursor: 'pointer', transition: 'background 0.15s' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-tertiary, #f4f4f5)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <span style={{ fontSize: 'var(--font-size-lg)' }}>{item.icon}</span>
                  <span style={{ flex: 1, fontSize: 'var(--font-size-base)', fontWeight: 500, color: 'var(--text-primary, #0f172a)' }}>{item.label}</span>
                  <ArrowRightOutlined style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-tertiary, #a1a1aa)' }} />
                </div>
              ))}
            </div>
          ))
        )}
      </div>
    </Modal>
  );
};

export const useCommandPalette = () => {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(prev => !prev);
      }
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return { open, setOpen, CommandPalette };
};

export default CommandPalette;
