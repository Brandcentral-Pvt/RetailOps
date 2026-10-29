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
} from 'lucide-react';

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

export default function UserMenu() {
  const { user, logout, hasPermission } = useAuth();
  const { setCmdOpen } = useHeader();
  const navigate = useNavigate();

  if (!user) return null;

  const initials = getInitials(user);
  const displayName =
    user?.fullName ||
    `${user?.firstName || ''} ${user?.lastName || ''}`.trim() ||
    'User';
  const roleName = user?.role?.displayName || user?.role?.name || 'User';
  const email = user?.email || '';
  const isAdmin = ['admin', 'super_admin', 'super admin', 'supert admin'].includes(
    (user?.role?.name || user?.role || '').toString().toLowerCase()
  ) || (user?.role?.name || user?.role || '').toString().toLowerCase().includes('super');

  const openProfile = () => navigate('/profile');
  const openTeam = () => navigate('/team-management');
  const openSettings = () => navigate('/settings');
  const openShortcuts = () => setCmdOpen(true);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="flex items-center gap-2"
          aria-label="User menu"
        >
          <Avatar className="h-8 w-8">
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <div className="hidden sm:flex flex-col leading-tight">
            <span className="text-sm font-semibold text-slate-900 leading-none">
              {displayName.split(' ')[0]}
            </span>
            <span className="text-xs text-slate-500 leading-none">{roleName}</span>
          </div>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-[260px]">
        <DropdownMenuLabel className="px-3 py-2">
          <div className="flex items-center gap-3 px-2 py-1.5 border-b border-border mb-1">
            <Avatar className="h-10 w-10">
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
        <DropdownMenuItem onSelect={openProfile}>
          <User className="mr-2 h-4 w-4" />
          My Profile
        </DropdownMenuItem>
        {hasPermission('roles_view') && (
          <DropdownMenuItem onSelect={openTeam}>
            <Users2 className="mr-2 h-4 w-4" />
            Team & Workspace
          </DropdownMenuItem>
        )}
        {hasPermission('settings_manage') && (
          <DropdownMenuItem onSelect={openSettings}>
            <Settings className="mr-2 h-4 w-4" />
            Settings
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={openShortcuts}>
          <Key className="mr-2 h-4 w-4" />
          Keyboard shortcuts
          <DropdownMenuShortcut>⌘K</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => window.open('https://opencode.ai', '_blank')}>
          <HelpCircle className="mr-2 h-4 w-4" />
          Help & Support
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() => logout && logout()}
          className="text-destructive"
        >
          <LogOut className="mr-2 h-4 w-4" />
          Sign out
        </DropdownMenuItem>
        {isAdmin && (
          <DropdownMenuItem onSelect={openSettings}>
            <Settings className="mr-2 h-4 w-4" />
            Admin settings
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
