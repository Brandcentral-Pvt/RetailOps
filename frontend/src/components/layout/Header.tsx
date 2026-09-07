'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Dropdown } from 'antd';
import { 
  Bell01,
  ChevronRight,
  Home01,
  LogOut01,
  Menu01,
  Moon01,
  SearchLg,
  Settings01,
  Sun,
  User01,
} from '@untitled-ui/icons-react';
import { useAuthStore } from '@/store/authStore';
import { useLogout } from '@/hooks/useApi';

interface HeaderProps {
  onMenuClick: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout: localLogout } = useAuthStore();
  const { mutate: logout } = useLogout();
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const initials = `${user?.firstName?.[0] || ''}${user?.lastName?.[0] || user?.firstName?.[1] || ''}`.toUpperCase() || 'U';
  const breadcrumbLabels: Record<string, string> = {
    'asin-tracker': 'ASIN Manager',
    pems: 'PEMS',
    'live-sync-tracker': 'Live Sync Tracker',
    'month-wise-report': 'Monthly Recap',
    'target-achievement': 'Target vs Achievement',
  };
  const breadcrumbSegments = pathname === '/'
    ? [{ label: 'Dashboard', path: '/' }]
    : pathname.split('/').filter(Boolean).map((segment, index, segments) => ({
        label: breadcrumbLabels[segment] || segment.replace(/-/g, ' '),
        path: `/${segments.slice(0, index + 1).join('/')}`,
      }));

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | null;
    if (savedTheme) {
      setTheme(savedTheme);
    } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setTheme('dark');
    }
  }, []);

  useEffect(() => {
    document.documentElement.classList.remove('light', 'dark');
    document.documentElement.classList.add(theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const menuItems = [
    {
      key: 'profile',
      label: (
        <Link href="/profile" className="w-full flex items-center gap-2">
          <User01 width={16} height={16} className="mr-2" />
          Profile
        </Link>
      ),
    },
    {
      key: 'settings',
      label: (
        <Link href="/settings" className="w-full flex items-center gap-2">
          <Settings01 width={16} height={16} className="mr-2" />
          Settings
        </Link>
      ),
    },
    {
      type: 'divider' as const,
    },
    {
      key: 'logout',
      label: (
        <>
          <LogOut01 width={16} height={16} className="mr-2" />
          Log out
        </>
      ),
      onClick: () => {
        logout(undefined, {
          onSuccess: () => {
            localLogout();
            router.replace('/login');
          },
        });
      },
      danger: true,
    },
  ];

  return (
    <header className="sticky top-0 z-30 w-full border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
      <div className="flex h-16 items-center gap-4 px-4 md:px-6 lg:px-8">
        <button
          className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground lg:hidden"
          onClick={onMenuClick}
          aria-label="Toggle sidebar"
        >
          <Menu01 width={20} height={20} />
        </button>

        <div className="flex min-w-0 flex-1 items-center justify-between gap-4">
          <nav className="min-w-0 flex-1 overflow-x-auto" aria-label="Breadcrumb">
            <ol className="flex min-w-max items-center gap-2 text-sm">
              <li>
                <Link href="/" className="flex items-center text-muted-foreground transition-colors hover:text-primary" aria-label="Home">
                  <Home01 width={17} height={17} />
                </Link>
              </li>
              {breadcrumbSegments.map((segment, index) => (
                <li key={segment.path} className="flex items-center gap-2">
                  <ChevronRight width={15} height={15} className="text-muted-foreground/60" aria-hidden="true" />
                  <Link
                    href={segment.path}
                    className={index === breadcrumbSegments.length - 1 ? 'font-semibold capitalize text-foreground' : 'capitalize text-muted-foreground transition-colors hover:text-primary'}
                    aria-current={index === breadcrumbSegments.length - 1 ? 'page' : undefined}
                  >
                    {segment.label}
                  </Link>
                </li>
              ))}
            </ol>
          </nav>

          <div className="flex min-w-0 shrink-0 items-center gap-2">
            <div className="relative hidden w-56 sm:block lg:w-72">
              <input
                type="search"
                placeholder="Search products, sellers, orders..."
                className="h-10 w-full rounded-lg border border-input bg-background pl-10 pr-4 text-sm text-foreground shadow-xs outline-none transition-shadow placeholder:text-muted-foreground focus:border-primary focus:ring-4 focus:ring-primary/10"
              />
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                <SearchLg width={18} height={18} />
              </span>
            </div>

          <div className="flex items-center gap-1">
            <button className="relative rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground" aria-label="Notifications">
              <Bell01 width={19} height={19} />
              <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-red-500" />
            </button>
            <button
              className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              onClick={() => {
                setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
              }}
              aria-label="Toggle theme"
            >
              {theme === 'light' ? <Moon01 width={19} height={19} /> : <Sun width={19} height={19} />}
            </button>

            <Dropdown menu={{ items: menuItems }}>
              <button className="ml-1 rounded-full p-0.5 transition-shadow hover:ring-4 hover:ring-primary/10" aria-label="Open account menu">
                <span className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                  {user?.avatar ? (
                    <img className="h-full w-full object-cover" src={user.avatar} alt={`${user?.firstName || ''} ${user?.lastName || ''}`.trim()} />
                  ) : (
                    initials
                  )}
                </span>
              </button>
            </Dropdown>
          </div>
        </div>
      </div>
      </div>
    </header>
  );
}