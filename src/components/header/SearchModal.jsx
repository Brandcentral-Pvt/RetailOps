import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { X, Search, ArrowRight, Clock, TrendingUp, Package, CheckSquare, Zap, BarChart, Users, Settings, ExternalLink, Layout } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useHeader } from '../../contexts/HeaderContext';
import { useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { usePlatform, useKeyboardShortcut } from './headerHooks.js';

const SECTIONS = [
  { key: 'navigation', label: 'Navigation', icon: Layout },
  { key: 'recent', label: 'Recent', icon: Clock },
  { key: 'asins', label: 'ASINs', icon: Package },
  { key: 'sellers', label: 'Sellers', icon: TrendingUp },
  { key: 'tasks', label: 'Tasks', icon: CheckSquare },
  { key: 'analytics', label: 'Analytics', icon: BarChart },
  { key: 'settings', label: 'Settings', icon: Settings },
];

const NAVIGATION_ITEMS = [
  { id: 'nav-dashboard', title: 'Dashboard', hint: 'Main operations overview', icon: Layout, url: '/', permission: 'dashboard_view', keywords: ['dashboard', 'home', 'main', 'overview'] },
  { id: 'nav-asin-tracker', title: 'ASIN Tracker', hint: 'Browse all tracked products', icon: Package, url: '/asin-tracker', permission: 'asinmanager_view', keywords: ['asin', 'product', 'catalog', 'tracker'] },
  { id: 'nav-gms', title: 'GMS Analytics', hint: 'Revenue & performance reports', icon: BarChart, url: '/gms-tracker', permission: 'gms_tracker_view', keywords: ['gms', 'analytics', 'revenue', 'report'] },
  { id: 'nav-tasks', title: 'My Day / Tasks', hint: 'Pending actions & workflows', icon: CheckSquare, url: '/tasks/my-day', permission: 'tasks_view', keywords: ['tasks', 'actions', 'workflow', 'myday'] },
  { id: 'nav-inventory', title: 'Inventory', hint: 'Stock levels & availability', icon: Package, url: '/inventory', permission: 'inventory_view', keywords: ['inventory', 'stock', 'availability'] },
  { id: 'nav-pnl', title: 'P&L Reports', hint: 'Profit & loss analysis', icon: BarChart, url: '/profit-loss', permission: 'profit_loss_view', keywords: ['pnl', 'profit', 'loss', 'financial'] },
  { id: 'nav-sellers', title: 'Sellers', hint: 'Manage seller accounts', icon: TrendingUp, url: '/sellers', permission: 'sellers_view', keywords: ['sellers', 'accounts', 'marketplace'] },
  { id: 'nav-profile', title: 'Profile', hint: 'Account & preferences', icon: Users, url: '/profile', permission: 'dashboard_view', keywords: ['profile', 'account', 'settings'] },
  { id: 'nav-settings', title: 'Workspace Settings', hint: 'Team & integrations', icon: Settings, url: '/settings', permission: 'settings_manage', keywords: ['workspace', 'team', 'integrations', 'admin'] },
];

function SearchResultItem({ item, onSelect, highlighted, sectionIcon, isRecent }) {
  const Icon = item.icon;
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors',
        'hover:bg-accent hover:text-accent-foreground',
        'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
        highlighted && 'bg-accent text-accent-foreground',
        isRecent && 'text-sm'
      )}
      role="option"
      aria-selected={highlighted}
    >
      <div className={cn('flex h-8 w-8 items-center justify-center rounded-md shrink-0', isRecent ? 'bg-muted' : 'bg-accent text-accent-foreground')}>
        {Icon ? <Icon size={16} /> : <Package size={16} />}
      </div>
      <div className="flex-1 min-w-0 text-left">
        <div className="truncate font-medium">{item.title}</div>
        {item.hint && <div className="truncate text-xs text-muted-foreground">{item.hint}</div>}
      </div>
      {item.shortcut && <span className="text-xs text-muted-foreground font-mono">{item.shortcut}</span>}
      {item.external && <ExternalLink size={12} className="text-muted-foreground" />}
    </button>
  );
}

function SectionHeader({ title, icon, count }) {
  const Icon = icon;
  return (
    <div className="px-3 py-2 flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
      {Icon && <Icon size={12} className="shrink-0" />}
      {title}
      {count !== undefined && <span className="ml-auto px-2 py-0.5 rounded-full bg-muted text-xs">{count}</span>}
    </div>
  );
}

function NoResults({ query }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <Search size={32} className="text-muted-foreground/50 mb-3" />
      <p className="text-sm text-muted-foreground">No results for <span className="font-mono text-foreground">"{query}"</span></p>
      <p className="text-xs text-muted-foreground mt-1">Try a different keyword or check spelling</p>
    </div>
  );
}

export default function SearchModal() {
  const { hasPermission } = useAuth();
  const { cmdOpen, setCmdOpen } = useHeader();
  const navigate = useNavigate();
  const { modKey } = usePlatform();
  const inputRef = useRef(null);
  const [query, setQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [recentSearches, setRecentSearches] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('search_recent') || '[]');
    } catch { return []; }
  });
  const [showRecent, setShowRecent] = useState(false);

  const addToRecent = useCallback((searchItem) => {
    setRecentSearches(prev => {
      const filtered = prev.filter(r => r.id !== searchItem.id);
      const updated = [searchItem, ...filtered].slice(0, 5);
      localStorage.setItem('search_recent', JSON.stringify(updated));
      return updated;
    });
  }, []);

  const filteredNavigation = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return NAVIGATION_ITEMS
      .filter(item => !item.permission || hasPermission(item.permission))
      .filter(item => 
        item.title.toLowerCase().includes(q) ||
        (item.hint?.toLowerCase().includes(q) ?? false) ||
        (item.keywords?.some(k => k.toLowerCase().includes(q)) ?? false)
      )
      .map(item => ({ ...item, section: 'navigation' }));
  }, [query, hasPermission]);

  const filteredRecent = useMemo(() => {
    if (!query.trim()) return recentSearches;
    const q = query.toLowerCase();
    return recentSearches.filter(r => 
      r.title.toLowerCase().includes(q) ||
      (r.hint?.toLowerCase().includes(q) ?? false)
    );
  }, [query, recentSearches]);

  const allResults = useMemo(() => {
    const results = [];
    if (filteredRecent.length > 0) {
      results.push({ section: 'recent', items: filteredRecent, icon: Clock });
    }
    if (filteredNavigation.length > 0) {
      results.push({ section: 'navigation', items: filteredNavigation, icon: Layout });
    }
    return results;
  }, [filteredRecent, filteredNavigation]);

  const flatResults = useMemo(() => {
    return allResults.flatMap(group => group.items.map(item => ({ ...item, _section: group.section, _sectionIcon: group.icon })));
  }, [allResults]);

  useEffect(() => {
    setHighlightedIndex(-1);
  }, [query, flatResults.length]);

  useEffect(() => {
    if (cmdOpen) {
      setTimeout(() => inputRef.current?.focus(), 0);
      setShowRecent(!query.trim());
    }
  }, [cmdOpen, query]);

  useKeyboardShortcut(
    ['k'],
    () => setCmdOpen(true),
    { metaKey: true, preventDefault: true }
  );

  useEffect(() => {
    if (!cmdOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setCmdOpen(false);
        return;
      }
      if (e.target.tagName === 'INPUT') return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlightedIndex(i => Math.min(i + 1, flatResults.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlightedIndex(i => Math.max(i - 1, 0));
      } else if (e.key === 'Enter' && highlightedIndex >= 0) {
        e.preventDefault();
        const item = flatResults[highlightedIndex];
        if (item) {
          addToRecent(item);
          if (item.url) navigate(item.url);
          if (item.onSelect) item.onSelect();
          setCmdOpen(false);
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [cmdOpen, flatResults, highlightedIndex, navigate, addToRecent, setCmdOpen]);

  if (!cmdOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 px-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setCmdOpen(false)} />
      <div className="relative w-full max-w-2xl bg-background shadow-xl rounded-xl border border-border overflow-hidden animate-in fade-in-0 zoom-in-95 duration-150">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
          <Search size={18} className="text-muted-foreground shrink-0" />
          <Input
            ref={inputRef}
            className="flex-1 bg-transparent p-0 text-base placeholder:text-muted-foreground"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search pages, ASINs, sellers, tasks..."
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Escape') setCmdOpen(false);
              else if (e.key === 'ArrowDown') {
                e.preventDefault();
                setHighlightedIndex(i => Math.min(i + 1, flatResults.length - 1));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setHighlightedIndex(i => Math.max(i - 1, 0));
              } else if (e.key === 'Enter' && highlightedIndex >= 0) {
                e.preventDefault();
                const item = flatResults[highlightedIndex];
                if (item) {
                  addToRecent(item);
                  if (item.url) navigate(item.url);
                  if (item.onSelect) item.onSelect();
                  setCmdOpen(false);
                }
              }
            }}
          />
          <kbd className="px-2 py-1 text-xs font-mono text-muted-foreground bg-muted rounded">{modKey}K</kbd>
        </div>

        <div className="h-[calc(100vh-120px)] max-h-[500px] overflow-y-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-muted" style={{ scrollbarWidth: 'thin' }}>
          <div className="p-2">
            {query.trim() ? (
              flatResults.length > 0 ? (
                <>
                  {allResults.map((group, gi) => (
                    <React.Fragment key={group.section}>
                      <SectionHeader title={group.section.charAt(0).toUpperCase() + group.section.slice(1)} icon={group.icon} count={group.items.length} />
                      {group.items.map((item, ii) => {
                        const globalIndex = flatResults.findIndex(r => r.id === item.id && r._section === group.section);
                        const highlighted = globalIndex === highlightedIndex;
                        return (
                          <SearchResultItem
                            key={item.id}
                            item={item}
                            highlighted={highlighted}
                            sectionIcon={group.icon}
                            isRecent={group.section === 'recent'}
                            onSelect={() => {
                              addToRecent(item);
                              if (item.url) navigate(item.url);
                              if (item.onSelect) item.onSelect();
                              setCmdOpen(false);
                            }}
                          />
                        );
                      })}
                      {gi < allResults.length - 1 && <Separator className="my-2" />}
                    </React.Fragment>
                  ))}
                </>
              ) : (
                <NoResults query={query} />
              )
            ) : (
              <div className="space-y-4">
                {recentSearches.length > 0 && (
                  <>
                    <SectionHeader title="Recent Searches" icon={Clock} count={recentSearches.length} />
                    {recentSearches.map((item, i) => (
                      <SearchResultItem
                        key={item.id}
                        item={item}
                        highlighted={false}
                        sectionIcon={Clock}
                        isRecent={true}
                        onSelect={() => {
                          addToRecent(item);
                          if (item.url) navigate(item.url);
                          if (item.onSelect) item.onSelect();
                          setCmdOpen(false);
                        }}
                      />
                    ))}
                    <Separator className="my-2" />
                  </>
                )}
                <SectionHeader title="Quick Navigation" icon={Zap} />
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 px-1 pb-2">
                  {NAVIGATION_ITEMS
                    .filter(item => !item.permission || hasPermission(item.permission))
                    .slice(0, 6)
                    .map(item => (
                      <SearchResultItem
                        key={item.id}
                        item={item}
                        highlighted={false}
                        sectionIcon={Layout}
                        onSelect={() => {
                          addToRecent(item);
                          navigate(item.url);
                          setCmdOpen(false);
                        }}
                      />
                    ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="px-4 py-3 border-t border-border bg-muted/50 flex items-center justify-between text-xs text-muted-foreground">
          <span>{modKey}K to open • ↑↓ to navigate • Enter to select • Esc to close</span>
          <Button variant="ghost" size="sm" onClick={() => setCmdOpen(false)}>Close</Button>
        </div>
      </div>
    </div>
  );
}