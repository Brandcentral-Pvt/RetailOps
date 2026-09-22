import React from 'react';
import { addIcon, Icon } from '@iconify/react/offline';
import { fluentIcons } from './generated/fluent-icons';

// Register all icons once at module load
Object.entries(fluentIcons).forEach(([name, data]) => {
  addIcon(name, data);
});

/**
 * Factory: returns a React component that renders the given fluent icon
 * inline via @iconify/react/offline. Mirrors the lucide-react component API
 * (size, color, className, style, strokeWidth) so call sites stay unchanged.
 */
const makeIcon = (iconName) => {
  const Component = ({ size = 20, width, height, color, className, style, ...rest }) => {
    const svgProps = {};
    for (const key of Object.keys(rest)) {
      if (key === 'strokeWidth' || key === 'absoluteStrokeWidth') continue;
      svgProps[key] = rest[key];
    }
    return (
      <Icon
        icon={iconName}
        width={width ?? size}
        height={height ?? size}
        color={color}
        className={className}
        style={style}
        {...svgProps}
      />
    );
  };
  Component.displayName = iconName;
  return Component;
};

// ─── Icon name map: export name -> fluent iconify name ────────────────────────
const ICON_MAP = {
  LayoutDashboard: 'fluent-color:home-20',
  Store: 'fluent-color:building-store-20',
  Package: 'fluent:box-20-filled',
  Activity: 'fluent:pulse-20-filled',
  Clock: 'fluent-color:clock-20',
  GitBranch: 'fluent:branch-fork-20-filled',
  LayoutTemplate: 'fluent:board-20-filled',
  BarChart2: 'fluent-color:data-bar-vertical-ascending-20',
  BarChart3: 'fluent-color:data-bar-vertical-ascending-20',
  Folder: 'fluent:folder-20-filled',
  FolderOpen: 'fluent:folder-open-20-filled',
  MessageSquare: 'fluent-color:chat-20',
  ScanSearch: 'fluent:search-20-filled',
  Search: 'fluent:search-20-filled',
  TrendingUp: 'fluent-color:data-trending-20',
  TrendingDown: 'fluent:arrow-trending-down-20-filled',
  Calendar: 'fluent-color:calendar-20',
  CalendarDays: 'fluent-color:calendar-20',
  ArrowLeftRight: 'fluent:arrow-swap-20-filled',
  Warehouse: 'fluent:archive-20-filled',
  Users: 'fluent-color:people-20',
  Map: 'fluent:map-20-filled',
  Settings: 'fluent-color:settings-20',
  KeyRound: 'fluent:key-20-filled',
  Database: 'fluent-color:database-20',
  ChevronLeft: 'fluent:chevron-left-20-filled',
  ChevronRight: 'fluent:chevron-right-20-filled',
  ChevronDown: 'fluent:chevron-down-20-filled',
  LogOut: 'fluent:sign-out-20-filled',
  ListTodo: 'fluent:task-list-square-20-filled',
  CheckCircle: 'fluent-color:checkmark-circle-20',
  CheckCircle2: 'fluent-color:checkmark-circle-20',
  Bell: 'fluent-color:alert-20',
  BellRing: 'fluent-color:alert-urgent-20',
  Target: 'fluent:target-20-filled',
  PieChart: 'fluent-color:data-pie-20',
  FileText: 'fluent-color:document-text-20',
  Layers: 'fluent:stack-20-filled',
  ShoppingBag: 'fluent:shopping-bag-20-filled',
  Zap: 'fluent:flash-20-filled',
  Webhook: 'fluent:plug-connected-20-filled',
  ClipboardList: 'fluent-color:clipboard-task-20',
  CheckSquare: 'fluent:checkmark-square-20-filled',
  UserCheck: 'fluent-color:person-available-20',
  LineChart: 'fluent-color:data-line-20',
  RefreshCcw: 'fluent:arrow-counterclockwise-20-filled',
  RefreshCw: 'fluent:arrow-counterclockwise-20-filled',
  RotateCcw: 'fluent:arrow-counterclockwise-20-filled',
  Menu: 'fluent:navigation-20-filled',
  Download: 'fluent:arrow-download-20-filled',
  Info: 'fluent:info-20-filled',
  Check: 'fluent:checkmark-20-filled',
  X: 'fluent:dismiss-20-filled',
  XCircle: 'fluent:dismiss-circle-20-filled',
  AlertTriangle: 'fluent-color:warning-20',
  AlertCircle: 'fluent-color:error-circle-20',
  ShieldAlert: 'fluent-color:shield-20',
  Minus: 'fluent:subtract-20-regular',
  LayoutGrid: 'fluent:grid-20-filled',
  Square: 'fluent:square-20-regular',
  Filter: 'fluent:filter-20-filled',
  Sparkles: 'fluent:sparkle-20-filled',
  HelpCircle: 'fluent:question-circle-20-filled',
  User: 'fluent-color:person-20',

  // @untitledui/icons names used by DropdownButton
  Container: 'fluent:box-20-filled',
  LayersTwo01: 'fluent:stack-20-filled',
  LogOut01: 'fluent:sign-out-20-filled',
  Settings01: 'fluent:settings-20-filled',
  User01: 'fluent:person-20-filled',
};

// ─── Named exports ────────────────────────────────────────────────────────────
const exports_ = {};
for (const [exportName, iconifyName] of Object.entries(ICON_MAP)) {
  exports_[exportName] = makeIcon(iconifyName);
}

export const {
  LayoutDashboard,
  Store,
  Package,
  Activity,
  Clock,
  GitBranch,
  LayoutTemplate,
  BarChart2,
  BarChart3,
  Folder,
  FolderOpen,
  MessageSquare,
  ScanSearch,
  Search,
  TrendingUp,
  TrendingDown,
  Calendar,
  CalendarDays,
  ArrowLeftRight,
  Warehouse,
  Users,
  Map,
  Settings,
  KeyRound,
  Database,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  LogOut,
  ListTodo,
  CheckCircle,
  CheckCircle2,
  Bell,
  BellRing,
  Target,
  PieChart,
  FileText,
  Layers,
  ShoppingBag,
  Zap,
  Webhook,
  ClipboardList,
  CheckSquare,
  UserCheck,
  LineChart,
  RefreshCcw,
  RefreshCw,
  RotateCcw,
  Menu,
  Download,
  Info,
  Check,
  X,
  XCircle,
  AlertTriangle,
  AlertCircle,
  ShieldAlert,
  Minus,
  LayoutGrid,
  Square,
  Filter,
  Sparkles,
  HelpCircle,
  User,
  Container,
  LayersTwo01,
  LogOut01,
  Settings01,
  User01,
} = exports_;

// ─── Generic component (for dynamic/single-use rendering) ─────────────────────
export const FluentIcon = ({ name, ...props }) => {
  const Component = exports_[name] || Activity;
  return <Component {...props} />;
};

// ─── KPICard resolver: string icon names -> component ─────────────────────────
// Covers the lucide-style names and the bootstrap 'bi-*' names passed by pages.
const KPI_MAP = {
  Store: 'fluent-color:building-store-20',
  RefreshCcw: 'fluent:arrow-counterclockwise-20-filled',
  Package: 'fluent:box-20-filled',
  Percent: 'fluent:arrow-trending-20-filled',
  Server: 'fluent:server-20-filled',
  Activity: 'fluent:pulse-20-filled',
  Zap: 'fluent:flash-20-filled',
  TrendingUp: 'fluent-color:data-trending-20',
  TrendingDown: 'fluent:arrow-trending-down-20-filled',
  'bi-currency-rupee': 'fluent:currency-20-filled',
  'bi-wallet2': 'fluent:wallet-20-filled',
  'bi-graph-up': 'fluent-color:data-trending-20',
  'bi-percent': 'fluent:arrow-trending-20-filled',
  'bi-box': 'fluent:box-20-filled',
  'bi-box-seam': 'fluent:box-20-filled',
  'bi-calculator': 'fluent:calculator-20-filled',
  'bi-exclamation-triangle': 'fluent-color:warning-20',
  'bi-x-circle': 'fluent:dismiss-circle-20-filled',
};

const KpiComponents = {};
for (const [key, iconifyName] of Object.entries(KPI_MAP)) {
  KpiComponents[key] = makeIcon(iconifyName);
}

export const KpiIcon = ({ name, ...props }) => {
  const Component = KpiComponents[name] || Activity;
  return <Component {...props} />;
};

export default FluentIcon;