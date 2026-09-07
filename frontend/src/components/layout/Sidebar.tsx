'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Activity,
  Archive as Warehouse,
  ArrowsLeft as ArrowLeftRight,
  BarChart02 as BarChart2,
  BarChart03 as BarChart3,
  Bell01 as Bell,
  Calendar as CalendarDays,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Clock,
  Database01 as Database,
  FileSearch01 as ScanSearch,
  Folder,
  GitBranch01 as GitBranch,
  Home01 as LayoutDashboard,
  Key01 as KeyRound,
  LayoutAlt01 as LayoutTemplate,
  LayoutLeft as PanelLeftClose,
  LayoutLeft as PanelLeftOpen,
  List as ListTodo,
  LogOut01 as LogOut,
  Map01 as Map,
  Menu01 as Menu,
  MessageChatCircle as MessageSquare,
  Package,
  SearchLg as Search,
  Settings01 as Settings,
  ShoppingBag01 as Store,
  Target01 as Target,
  TrendUp01 as TrendingUp,
  Users01 as Users,
} from '@untitled-ui/icons-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/authStore';
import { asinsApi } from '@/lib/api';

interface SidebarProps {
  isOpen: boolean;
  collapsed: boolean;
  onClose: () => void;
  onToggle: () => void;
}

interface NavigationItem {
  label: string;
  path: string;
  icon: typeof Activity;
  permission?: string;
  roles?: string[];
  badge?: string | number;
}

interface NavigationSection {
  label: string;
  items: NavigationItem[];
}

const sections: NavigationSection[] = [
  {
    label: 'Overview',
    items: [
      { label: 'Dashboard', path: '/', icon: LayoutDashboard, permission: 'dashboard_view' },
      { label: 'Sellers', path: '/sellers', icon: Store, permission: 'seller_view', roles: ['brand manager', 'catalog manager', 'listing team'] },
    ],
  },
  {
    label: 'Catalog & Ads',
    items: [
      { label: 'ASIN Manager', path: '/asin-tracker', icon: Package, permission: 'asinmanager_view', roles: ['catalog manager', 'listing team'] },
      { label: 'Ads Manager', path: '/ads-manager', icon: BarChart3, permission: 'adsreport_view' },
      { label: 'Keyword Research', path: '/keyword-research', icon: Search, roles: ['catalog manager'] },
      { label: 'GMS Tracker', path: '/gms-tracker', icon: TrendingUp, permission: 'gms_tracker_view' },
      { label: 'Seller Tracker', path: '/seller-tracker', icon: Activity, permission: 'asintracker_view', roles: ['brand manager'] },
      { label: 'Parent Trends', path: '/parent-asin-report', icon: TrendingUp, permission: 'parentreport_view', roles: ['brand manager'] },
      { label: 'SKU Analysis', path: '/sku-report', icon: ScanSearch, permission: 'skureport_view' },
    ],
  },
  {
    label: 'Automation & Tasks',
    items: [
      { label: 'Rule Sets', path: '/rule-sets', icon: GitBranch, permission: 'rules_view' },
      { label: 'PEMS Dashboard', path: '/pems/dashboard', icon: BarChart2, permission: 'tasks_view' },
      { label: 'Task Templates', path: '/pems/templates', icon: LayoutTemplate, permission: 'tasks_manage' },
      { label: 'Tasks', path: '/pems/tasks', icon: ListTodo, permission: 'tasks_view' },
      { label: 'Review Queue', path: '/pems/reviews', icon: CheckCircle, permission: 'tasks_view' },
      { label: 'Analytics', path: '/pems/analytics', icon: BarChart3, permission: 'tasks_view' },
      { label: 'Scheduled Runs', path: '/scheduled-runs', icon: Clock, permission: 'scraping_view' },
      { label: 'Live Sync Tracker', path: '/live-sync-tracker', icon: ArrowLeftRight, permission: 'scraping_view' },
      { label: 'Live Data Inspector', path: '/live-data-inspector', icon: BarChart2 },
      { label: 'Templates', path: '/actions/templates', icon: LayoutTemplate, permission: 'actions_view' },
    ],
  },
  {
    label: 'Analytics & Finance',
    items: [
      { label: 'Profit & Loss', path: '/profit-loss', icon: BarChart2, permission: 'pnlreport_view', roles: ['brand manager'] },
      { label: 'Inventory', path: '/inventory', icon: Warehouse, permission: 'inventoryreport_view' },
      { label: 'Target vs Achievement', path: '/target-achievement', icon: Target, permission: 'targets_view', roles: ['brand manager'] },
      { label: 'Monthly Recap', path: '/month-wise-report', icon: CalendarDays, permission: 'monthlyreport_view', roles: ['brand manager'] },
      { label: 'Performance', path: '/actions/achievement-report', icon: TrendingUp, permission: 'monthlyreport_view', roles: ['brand manager'] },
    ],
  },
  {
    label: 'System & Control',
    items: [
      { label: 'Activity Log', path: '/alerts', icon: Activity, permission: 'activitylogs_view' },
      { label: 'Users', path: '/users', icon: Users, permission: 'users_view' },
      { label: 'Team Map', path: '/team-management', icon: Map, permission: 'roles_view' },
      { label: 'Data Migration', path: '/upload-export', icon: Database, permission: 'asinmanager_import' },
      { label: 'File Manager', path: '/file-manager', icon: Folder, permission: 'files_manage' },
      { label: 'API Keys', path: '/api-keys', icon: KeyRound, permission: 'apikeys_manage' },
      { label: 'Settings', path: '/settings', icon: Settings, permission: 'settings_manage' },
      { label: 'Webhooks', path: '/webhooks', icon: Bell, permission: 'rules_manage' },
      { label: 'Messaging', path: '/chat', icon: MessageSquare, permission: 'chat_view' },
    ],
  },
];

export function Sidebar({ isOpen, collapsed, onClose, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const { user, logout } = useAuthStore();
  const [asinCount, setAsinCount] = useState<number | null>(null);
  const roleName = user?.role?.name?.toLowerCase().trim() || '';
  const isAdmin = roleName === 'admin' || roleName === 'super_admin';
  const isGlobalUser = roleName === 'global';
  const permissions = user?.permissions || [];
  const canAccess = (item: NavigationItem) => {
    if (!user || isAdmin) return true;
    if (item.roles?.includes(roleName)) return true;
    if (item.permission && (permissions.includes(item.permission) || (isGlobalUser && item.permission !== 'users_view' && item.permission !== 'roles_view'))) return true;
    return !item.permission && !item.roles;
  };
  const initials = `${user?.firstName?.[0] || ''}${user?.lastName?.[0] || user?.firstName?.[1] || ''}`.toUpperCase() || 'U';

  useEffect(() => {
    if (!user || !canAccess({ label: 'ASIN Manager', path: '/asin-tracker', icon: Package, permission: 'asinmanager_view' })) return;
    asinsApi.list({ limit: 1 })
      .then((response) => setAsinCount(response.data.total))
      .catch(() => setAsinCount(0));
  }, [user, roleName, permissions]);

  return (
    <>
      {isOpen && <button className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={onClose} aria-label="Close sidebar" />}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex flex-col border-r border-border bg-card transition-[width,transform] duration-200 ease-out',
          collapsed ? 'w-[72px]' : 'w-64',
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
        aria-label="Sidebar"
      >
        <div className={cn('relative flex h-16 items-center border-b border-border transition-[padding] duration-200', collapsed ? 'justify-center px-2' : 'justify-between px-4')}>
          <Link href="/" className="flex min-w-0 items-center gap-3" onClick={onClose}>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <BarChart3 width={18} height={18} />
            </div>
            <span className={cn('overflow-hidden whitespace-nowrap text-lg font-semibold tracking-tight text-foreground transition-all duration-200', collapsed ? 'w-0 -translate-x-2 opacity-0' : 'w-auto translate-x-0 opacity-100')}>BrandCentral</span>
          </Link>
          <button className="rounded-md p-2 text-muted-foreground hover:bg-accent lg:hidden" onClick={onClose} aria-label="Close sidebar">
            <Menu width={18} height={18} />
          </button>
          <button className="absolute -right-3 top-5 hidden h-6 w-6 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-sm transition-transform duration-200 hover:scale-105 hover:bg-accent lg:flex" onClick={onToggle} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
            {collapsed ? <PanelLeftOpen width={14} height={14} /> : <PanelLeftClose width={14} height={14} />}
          </button>
        </div>

        <nav className={cn('flex-1 overflow-y-auto py-4 transition-[padding] duration-200', collapsed ? 'px-2' : 'px-3')} aria-label="Main navigation">
          {sections.map((section) => {
            const visibleItems = section.items.filter(canAccess);
            if (visibleItems.length === 0) return null;
            return (
              <div key={section.label} className="mb-6">
                <p className={cn('overflow-hidden px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground transition-all duration-200', collapsed ? 'mb-0 h-0 opacity-0' : 'mb-2 h-4 opacity-100')}>{section.label}</p>
                <div className="space-y-1">
                  {visibleItems.map((item) => {
                    const Icon = item.icon;
                    const active = pathname === item.path || (item.path !== '/' && pathname.startsWith(`${item.path}/`));
                    return (
                      <Link
                        key={item.path}
                        href={item.path}
                        onClick={onClose}
                        title={collapsed ? item.label : undefined}
                        className={cn(
                          'flex min-h-10 items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-[background-color,color,padding] duration-150',
                          collapsed && 'justify-center px-2',
                          active ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                        )}
                      >
                        <Icon className="shrink-0" width={17} height={17} strokeWidth={1.8} />
                        <span className={cn('min-w-0 truncate transition-all duration-200', collapsed ? 'w-0 flex-none -translate-x-2 opacity-0' : 'w-auto flex-1 translate-x-0 opacity-100')}>{item.label}</span>
                        {!collapsed && item.path === '/asin-tracker' && asinCount !== null && <span className="rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">{asinCount}</span>}
                        {!collapsed && item.badge !== undefined && <span className="rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">{item.badge}</span>}
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>

        <div className={cn('border-t border-border transition-[padding] duration-200', collapsed ? 'p-2' : 'p-3')}>
          <Link href="/profile" onClick={onClose} className="flex items-center gap-3 rounded-md p-2 hover:bg-accent">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-foreground text-sm font-semibold text-background">{initials}</div>
            <div className={cn('min-w-0 overflow-hidden transition-all duration-200', collapsed ? 'w-0 flex-none opacity-0' : 'w-auto flex-1 opacity-100')}>
              <p className="truncate text-sm font-medium text-foreground">{user?.firstName || 'User'} {user?.lastName || ''}</p>
              <p className="truncate text-xs text-muted-foreground">{user?.role?.displayName || user?.role?.name || 'User'}</p>
            </div>
            {!collapsed && <ChevronRight width={16} height={16} className="text-muted-foreground" />}
          </Link>
          <button onClick={logout} className={cn('mt-2 flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground', collapsed && 'justify-center px-2')}>
            <LogOut width={17} height={17} />
            <span className={cn('transition-all duration-200', collapsed ? 'w-0 overflow-hidden opacity-0' : 'w-auto opacity-100')}>Logout</span>
          </button>
        </div>
      </aside>
    </>
  );
}

export default Sidebar;
