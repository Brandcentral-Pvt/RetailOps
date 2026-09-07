'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Header } from '@/components/layout/Header';
import { Sidebar } from '@/components/layout/Sidebar';

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    const handleSidebarToggle = () => {
      setSidebarOpen((open) => !open);
    };

    document.addEventListener('sidebar-toggle', handleSidebarToggle);
    return () => document.removeEventListener('sidebar-toggle', handleSidebarToggle);
  }, []);

  if (pathname === '/login') {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-background">
      <Sidebar
        isOpen={sidebarOpen}
        collapsed={sidebarCollapsed}
        onClose={() => setSidebarOpen(false)}
        onToggle={() => setSidebarCollapsed((collapsed) => !collapsed)}
      />
      <div className={`flex min-h-screen flex-col transition-[margin] duration-200 ease-out ${sidebarCollapsed ? 'lg:ml-[72px]' : 'lg:ml-64'}`}>
        <Header onMenuClick={() => setSidebarOpen((open) => !open)} />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
