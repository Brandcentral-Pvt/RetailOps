import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useHeader } from '../../contexts/HeaderContext';
import {
  CommandDialog,
} from '@/components/ui/command';
import { Layout, Users, Settings, DollarSign, Activity } from 'lucide-react';

type CommandDialogItem = {
  id: string
  title: string
  hint?: string
  shortcut?: string
  icon?: React.ReactNode
  onSelect: () => void
  disabled?: boolean
  section?: string
  keywords?: string[]
  permission?: string
}

/**
 * CommandPalette → CommandDialog.
 *
 * Keyboard-accessible command palette (Cmd+K) rendered inside a Radix Dialog.
 * Every navigation command is RBAC-gated (Rule 10). Mock / console-only
 * actions are removed (Rule 11): "Sync data now" and "Export report" no longer
 * log to the console; export is wired to the real exportApi, sync is exposed
 * through QuickActions as truthful connection status.
 */
export default function CommandPalette() {
  const { cmdOpen, setCmdOpen } = useHeader();
  const { hasPermission } = useAuth();
  const navigate = useNavigate();

  const items = useMemo<CommandDialogItem[]>(() => [
    {
      id: 'nav-dashboard',
      title: 'Go to Dashboard',
      hint: 'View main operations overview',
      icon: <Layout size={16} />,
      section: 'Navigation',
      keywords: ['dashboard', 'home', 'main'],
      permission: 'dashboard_view',
      onSelect: () => navigate('/dashboard'),
    },
    {
      id: 'nav-asins',
      title: 'ASIN Tracker',
      hint: 'Browse all tracked products',
      icon: <DollarSign size={16} />,
      section: 'Navigation',
      keywords: ['asin', 'product', 'catalog'],
      permission: 'asinmanager_view',
      onSelect: () => navigate('/asin-tracker'),
    },
    {
      id: 'nav-gms',
      title: 'Open Analytics',
      hint: 'GMS, revenue, and performance reports',
      icon: <Activity size={16} />,
      section: 'Navigation',
      keywords: ['analytics', 'gms', 'report'],
      permission: 'gms_tracker_view',
      onSelect: () => navigate('/gms-tracker'),
    },
    {
      id: 'nav-tasks',
      title: 'View Tasks',
      hint: 'Check pending actions and workflows',
      icon: <Activity size={16} />,
      section: 'Navigation',
      keywords: ['tasks', 'actions', 'workflow'],
      permission: 'tasks_view',
      onSelect: () => navigate('/tasks/my-day'),
    },
    {
      id: 'nav-profile',
      title: 'Profile settings',
      hint: 'Edit account & preferences',
      icon: <Users size={16} />,
      section: 'Settings',
      keywords: ['profile', 'account', 'settings'],
      permission: 'dashboard_view',
      onSelect: () => navigate('/profile'),
    },
    {
      id: 'nav-settings',
      title: 'Workspace settings',
      hint: 'Manage team & integrations',
      icon: <Settings size={16} />,
      section: 'Settings',
      keywords: ['workspace', 'team', 'integrations'],
      permission: 'settings_manage',
      onSelect: () => navigate('/settings'),
    },
  ], [hasPermission, navigate, setCmdOpen]);

  const permitted = items.filter(
    (i) => !i.permission || hasPermission(i.permission)
  );

  return (
    <CommandDialog
      open={cmdOpen}
      onOpenChange={setCmdOpen}
      items={permitted}
      placeholder="Search pages and commands..."
      noResultsMessage="No matching commands or pages."
    />
  );
}
