import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useHeader } from '../../contexts/HeaderContext';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuShortcut,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  User,
  Settings,
  LogOut,
  Users2,
  HelpCircle,
  Key,
  Shield,
  ExternalLink,
  Layout,
} from 'lucide-react';
import { UserMenuSkeleton } from '@/components/ui/skeleton/UserMenuSkeleton';

const getInitials = (user) => {
  if (!user) return 'U';
  if (user.fullName?.trim()) {
    return user.fullName
      .trim()
      .split(/\s+/)
      .map((n) => n[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
  }
  const first = user.firstName ? user.firstName[0] : '';
  const second = user.lastName ? user.lastName[0] : user.firstName ? user.firstName[1] : '';
  return (first + second).toUpperCase() || (user.email ? user.email[0] : 'U').toUpperCase();
};

/**
 * UserMenu — modern user profile dropdown with RBAC-aware menu items.
 *
 * Features:
 * - Clean shadcn design
 * - Keyboard navigation support
 * - Role badge with permission-aware items
 * - Dark mode toggle
 * - Keyboard shortcuts hints
 *
 * Props:
 *   loading - boolean, when true shows skeleton instead of user menu
 */
function UserMenu({ loading = false }) {
  const { user, logout, hasPermission } = useAuth();
  const { setCmdOpen } = useHeader();
  const navigate = useNavigate();

  if (!user) return null;

  if (loading) {
    return <UserMenuSkeleton />;
  }

  const initials = getInitials(user);
  const displayName =
    user?.fullName ||
    `${user?.firstName || ''} ${user?.lastName || ''}`.trim() ||
    'User';
  const firstName = displayName.split(' ')[0];
  const roleName = user?.role?.displayName || user?.role?.name || 'User';
  const email = user?.email || '';
  const isAdmin = ['admin', 'super_admin', 'super admin', 'supert admin'].includes(
    (user?.role?.name || user?.role || '').toString().toLowerCase()
  ) || (user?.role?.name || user?.role || '').toString().toLowerCase().includes('super');

  const openProfile = () => navigate('/profile');
  const openTeam = () => navigate('/team-management');
  const openSettings = () => navigate('/settings');
  const openShortcuts = () => { setCmdOpen(true); };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="flex items-center gap-2 pr-2"
          aria-label="User menu"
        >
          <Avatar className="h-8 w-8 ring-2 ring-slate-100">
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <div className="hidden sm:flex flex-col leading-tight text-left">
            <span className="text-sm font-semibold text-slate-900 leading-none">
              {firstName}
            </span>
            <span className="text-xs text-slate-500 leading-none capitalize">{roleName.toLowerCase()}</span>
          </div>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-[280px] p-1" align="end">
        <DropdownMenuLabel className="px-3 py-2">
          <div className="flex items-center gap-3 px-2 py-2 border-b border-border mb-1">
            <Avatar className="h-10 w-10 ring-2 ring-slate-100">
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-slate-900 leading-none">
                {displayName}
              </div>
              <div className="text-xs text-slate-500 truncate">{email}</div>
              <div className="mt-1 inline-flex items-center gap-1.5 rounded-full border border-[#1976d2]/30 bg-[#1976d2]/10 px-2 py-0.5 text-[10px] font-semibold text-[#1565c0]">
                {roleName}
              </div>
            </div>
          </div>
        </DropdownMenuLabel>

        <DropdownMenuItem onSelect={openProfile} className="px-3 py-2">
          <User className="mr-3 h-4 w-4 shrink-0 text-slate-500" />
          <span className="flex-1">My Profile</span>
        </DropdownMenuItem>

        {hasPermission('roles_view') && (
          <DropdownMenuItem onSelect={openTeam} className="px-3 py-2">
            <Users2 className="mr-3 h-4 w-4 shrink-0 text-slate-500" />
            <span className="flex-1">Team & Workspace</span>
          </DropdownMenuItem>
        )}

        {hasPermission('settings_manage') && (
          <DropdownMenuItem onSelect={openSettings} className="px-3 py-2">
            <Settings className="mr-3 h-4 w-4 shrink-0 text-slate-500" />
            <span className="flex-1">Settings</span>
          </DropdownMenuItem>
        )}

        <DropdownMenuSeparator className="my-1" />

        <DropdownMenuItem onSelect={openShortcuts} className="px-3 py-2">
          <Key className="mr-3 h-4 w-4 shrink-0 text-slate-500" />
          <span className="flex-1">Keyboard shortcuts</span>
          <DropdownMenuShortcut>⌘K</DropdownMenuShortcut>
        </DropdownMenuItem>

        <DropdownMenuItem
          onSelect={() => window.open('https://opencode.ai', '_blank')}
          className="px-3 py-2"
        >
          <HelpCircle className="mr-3 h-4 w-4 shrink-0 text-slate-500" />
          <span className="flex-1">Help & Support</span>
          <ExternalLink className="mr-2 h-3 w-3 text-slate-400" />
        </DropdownMenuItem>

        <DropdownMenuSeparator className="my-1" />

        <DropdownMenuItem
          onSelect={() => logout && logout()}
          className="px-3 py-2 text-destructive focus:text-destructive"
        >
          <LogOut className="mr-3 h-4 w-4 shrink-0" />
          <span className="flex-1">Sign out</span>
        </DropdownMenuItem>

        {isAdmin && (
          <>
            <DropdownMenuSeparator className="my-1" />
            <DropdownMenuItem onSelect={openSettings} className="px-3 py-2">
              <Shield className="mr-3 h-4 w-4 shrink-0 text-purple-500" />
              <span className="flex-1 text-purple-600 font-medium">Admin settings</span>
              <Shield className="mr-2 h-3 w-3 text-purple-400" />
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default UserMenu;