'use client';

import { useState } from 'react';
import { Card, CardContent, Badge, Button, Tabs, TabsList, TabsTrigger, TabsContent, Select, SelectTrigger, SelectValue, SelectContent, SelectItem, Input, Skeleton, DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui';
import { RefreshCw, Download, Search, ChevronDown, ChevronUp, Loader2, Clock, CheckCircle, XCircle, AlertCircle, TrendingUp, Database, Zap, BarChart2, MoreHorizontal, Eye, PauseCircle, PlayCircle, ExternalLink } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { useLiveSyncOverview, useLiveSyncSellers, useLiveSyncSellerDetail, useLiveSyncActivity, useLiveSyncRuns, useLiveSyncTrigger } from '@/hooks/useApi';
import { useAuthStore } from '@/store/authStore';

const statusColors = {
  synced: 'bg-green-100 text-green-800 border-green-200',
  enabled: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  not_enabled: 'bg-gray-100 text-gray-800 border-gray-200',
  'not synced': 'bg-gray-100 text-gray-800 border-gray-200',
  running: 'bg-blue-100 text-blue-800 border-blue-200',
  completed: 'bg-green-100 text-green-800 border-green-200',
  failed: 'bg-red-100 text-red-800 border-red-200',
  partial: 'bg-yellow-100 text-yellow-800 border-yellow-200',
};

const sourceColors = {
  LIVE: 'bg-green-100 text-green-800 border-green-200',
  OCTOPARSE: 'bg-blue-100 text-blue-800 border-blue-200',
  MANUAL: 'bg-purple-100 text-purple-800 border-purple-200',
};

function formatNumber(num: number | null | undefined) {
  if (!num) return '0';
  return new Intl.NumberFormat().format(num);
}

function SyncStatusBadge({ status }: { status: string }) {
  const normalized = status.toLowerCase().replace('_', ' ');
  return (
    <Badge className={`${statusColors[normalized as keyof typeof statusColors] || 'bg-gray-100 text-gray-800'} capitalize`}>
      {status.replace('_', ' ')}
    </Badge>
  );
}

function SourceBadge({ source }: { source: string }) {
  return (
    <Badge className={`${sourceColors[source as keyof typeof sourceColors] || 'bg-gray-100 text-gray-800'}`}>
      {source}
    </Badge>
  );
}

function OverviewCards({ data }: { data: any }) {
  if (!data) return null;
  
  const stats = [
    { label: 'Total Sellers', value: formatNumber(data.totalSellers), icon: Database, color: 'text-blue-600' },
    { label: 'Live Sync Enabled', value: formatNumber(data.liveSyncEnabled), icon: Zap, color: 'text-green-600' },
    { label: 'Synced Sellers', value: formatNumber(data.syncedSellers), icon: CheckCircle, color: 'text-emerald-600' },
    { label: 'Not Enabled', value: formatNumber(data.notEnabledSellers), icon: XCircle, color: 'text-gray-500' },
    { label: 'Total ASINs', value: formatNumber(data.totalAsins), icon: BarChart2, color: 'text-purple-600' },
    { label: 'ASINs with Live Sync', value: formatNumber(data.hasLiveSyncDate), icon: Zap, color: 'text-cyan-600' },
    { label: 'Latest Sync', value: data.latestLiveSync ? formatDistanceToNow(new Date(data.latestLiveSync), { addSuffix: true }) : 'Never', icon: Clock, color: 'text-orange-600' },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-6">
      {stats.map((stat, i) => (
        <Card key={i} className="hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{stat.label}</p>
                <p className="text-2xl font-bold text-foreground">{stat.value}</p>
              </div>
              <div className={`p-2 rounded-lg bg-muted ${stat.color}`}>
                <stat.icon className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function SimpleProgress({ value, max = 100, className }: { value: number; max?: number; className?: string }) {
  const percentage = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className={`relative h-2 w-full overflow-hidden rounded-full bg-secondary ${className || ''}`}>
      <div 
        className="h-full bg-primary transition-all duration-300" 
        style={{ width: `${percentage}%` }}
      />
    </div>
  );
}

function SellersTable({ sellers, loading, onTriggerSync, triggeringIds }: { 
  sellers: any[], 
  loading: boolean,
  onTriggerSync: (id: string) => void,
  triggeringIds: Set<string>
}) {
  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="bg-muted/50 text-left text-sm font-medium text-muted-foreground">
            <th className="p-3 w-10"><input type="checkbox" className="rounded border-input" /></th>
            <th className="p-3">Seller</th>
            <th className="p-3">Marketplace</th>
            <th className="p-3 text-right">Total ASINs</th>
            <th className="p-3 text-right">Live Synced</th>
            <th className="p-3 text-right">Coverage</th>
            <th className="p-3">Status</th>
            <th className="p-3">Last Sync</th>
            <th className="p-3">Hours Since Sync</th>
            <th className="p-3 w-32">Actions</th>
          </tr>
        </thead>
        <tbody>
          {sellers.map((seller: any) => (
            <tr key={seller.id} className="border-t hover:bg-muted/30 transition-colors">
              <td className="p-3 w-10"><input type="checkbox" value={seller.id} className="rounded border-input" /></td>
              <td className="p-3 font-medium">{seller.name}</td>
              <td className="p-3">
                <Badge variant="secondary">{seller.marketplace}</Badge>
              </td>
              <td className="p-3 text-right font-mono text-sm">{formatNumber(seller.totalAsins)}</td>
              <td className="p-3 text-right font-mono text-sm">{formatNumber(seller.syncedAsins)}</td>
              <td className="p-3 text-right">
                <div className="flex items-center justify-end gap-2">
                  <SimpleProgress value={seller.totalAsins > 0 ? (seller.syncedAsins / seller.totalAsins) * 100 : 0} className="w-32" />
                  <span className="text-xs text-muted-foreground font-mono">
                    {seller.totalAsins > 0 ? ((seller.syncedAsins / seller.totalAsins) * 100).toFixed(1) : 0}%
                  </span>
                </div>
              </td>
              <td className="p-3"><SyncStatusBadge status={seller.syncStatus} /></td>
              <td className="p-3 text-sm">
                {seller.lastAsinSync ? format(new Date(seller.lastAsinSync), 'MMM dd, yyyy HH:mm') : '—'}
              </td>
              <td className="p-3 text-sm text-muted-foreground">
                {seller.hoursSinceSync !== null ? `${seller.hoursSinceSync}h` : '—'}
              </td>
              <td className="p-3">
                <DropdownMenu
                  overlay={
                    <DropdownMenuContent>
                      <DropdownMenuItem onClick={() => onTriggerSync(seller.id)} disabled={triggeringIds.has(seller.id)}>
                        {triggeringIds.has(seller.id) ? (
                          <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Triggering...</span>
                        ) : (
                          <span className="flex items-center gap-2"><Zap className="h-4 w-4" />Trigger Live Sync</span>
                        )}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => window.open(`/live-sync-tracker/${seller.id}`, '_blank')}>
                        <span className="flex items-center gap-2"><Eye className="h-4 w-4" />View Details</span>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-red-600" onClick={() => console.log('Disable', seller.id)}>
                        <span className="flex items-center gap-2"><PauseCircle className="h-4 w-4" />Disable Live Sync</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  }
                >
                  <DropdownMenuTrigger>
                    <Button variant="text" className="h-8 w-8 p-0">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                </DropdownMenu>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ActivityTable({ activities, loading }: { activities: any[], loading: boolean }) {
  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="bg-muted/50 text-left text-sm font-medium text-muted-foreground">
            <th className="p-3">ASIN</th>
            <th className="p-3">Seller</th>
            <th className="p-3">Source</th>
            <th className="p-3">Price</th>
            <th className="p-3">BSR</th>
            <th className="p-3">Rating</th>
            <th className="p-3">Synced At</th>
          </tr>
        </thead>
        <tbody>
          {activities.map((activity) => (
            <tr key={`${activity.asinCode}-${activity.lastLiveSyncAt}`} className="border-t hover:bg-muted/30">
              <td className="p-3 font-mono font-medium">{activity.asinCode}</td>
              <td className="p-3">{activity.sellerName}</td>
              <td className="p-3"><SourceBadge source={activity.lastSyncSource} /></td>
              <td className="p-3 font-mono">{activity.currentPrice ? `$${activity.currentPrice}` : '—'}</td>
              <td className="p-3 font-mono">{formatNumber(activity.bsr)}</td>
              <td className="p-3">{activity.rating ? `${activity.rating.toFixed(1)} ⭐` : '—'}</td>
              <td className="p-3 text-sm">{format(new Date(activity.lastLiveSyncAt), 'MMM dd, yyyy HH:mm:ss')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RunsTable({ runs, loading }: { runs: any[], loading: boolean }) {
  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="bg-muted/50 text-left text-sm font-medium text-muted-foreground">
            <th className="p-3">Run ID</th>
            <th className="p-3">Seller</th>
            <th className="p-3">Trigger</th>
            <th className="p-3">Status</th>
            <th className="p-3">Started</th>
            <th className="p-3">Completed</th>
            <th className="p-3">Duration</th>
            <th className="p-3 text-right">Processed</th>
            <th className="p-3 text-right">Failed</th>
          </tr>
        </thead>
        <tbody>
          {runs.map((run) => (
            <tr key={run.id} className="border-t hover:bg-muted/30">
              <td className="p-3 font-mono text-sm font-medium">{run.id.slice(-8).toUpperCase()}</td>
              <td className="p-3">{run.sellerName}</td>
              <td className="p-3">
                <Badge variant="default">{run.triggerType}</Badge>
              </td>
              <td className="p-3">
                <Badge className={statusColors[run.status.toLowerCase() as keyof typeof statusColors] || ''}>
                  {run.status}
                </Badge>
              </td>
              <td className="p-3 text-sm">{format(new Date(run.startedAt), 'MMM dd, HH:mm:ss')}</td>
              <td className="p-3 text-sm">{run.completedAt ? format(new Date(run.completedAt), 'MMM dd, HH:mm:ss') : '—'}</td>
              <td className="p-3 text-sm font-mono">
                {run.completedAt ? `${((new Date(run.completedAt).getTime() - new Date(run.startedAt).getTime()) / 1000).toFixed(1)}s` : '—'}
              </td>
              <td className="p-3 text-right font-mono">{formatNumber(run.processedCount)}</td>
              <td className="p-3 text-right font-mono text-red-600">{formatNumber(run.failedCount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ErrorAlert({ message }: { message: string }) {
  return (
    <div className="mb-4 p-4 rounded-lg bg-red-50 border border-red-200 text-red-700">
      {message}
    </div>
  );
}

export default function LiveSyncTrackerPage() {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'overview' | 'sellers' | 'activity' | 'runs'>('overview');
  const [selectedSellerIds, setSelectedSellerIds] = useState<Set<string>>(new Set());
  const [triggeringIds, setTriggeringIds] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'synced' | 'enabled' | 'not_enabled'>('all');
  const [marketplaceFilter, setMarketplaceFilter] = useState<string>('all');
  const [refreshKey, setRefreshKey] = useState(0);

  const overview = useLiveSyncOverview({ refreshKey });
  const sellers = useLiveSyncSellers({ refreshKey });
  const activity = useLiveSyncActivity({ refreshKey });
  const runs = useLiveSyncRuns({ refreshKey });
  const triggerSync = useLiveSyncTrigger();

  const handleSelectAll = (checked: boolean) => {
    if (checked && sellersData) {
      const filtered = getFilteredSellers();
      setSelectedSellerIds(new Set(filtered.map((s: any) => s.id)));
    } else {
      setSelectedSellerIds(new Set());
    }
  };

  const getFilteredSellers = () => {
    if (!sellers.data) return [];
    return sellers.data.filter((s: any) => {
      const matchesSearch = !searchTerm || 
        s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.id.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'all' || s.syncStatus === statusFilter;
      const matchesMarketplace = marketplaceFilter === 'all' || s.marketplace === marketplaceFilter;
      return matchesSearch && matchesStatus && matchesMarketplace;
    });
  };

  const handleTriggerSelected = async () => {
    if (selectedSellerIds.size === 0) return;
    const ids = Array.from(selectedSellerIds);
    setTriggeringIds(new Set(ids));
    try {
      await triggerSync.mutateAsync(ids);
      setSelectedSellerIds(new Set());
      setRefreshKey(prev => prev + 1);
    } catch (error) {
      console.error('Trigger sync failed:', error);
    } finally {
      setTriggeringIds(new Set());
    }
  };

  const handleTriggerSingle = async (id: string) => {
    setTriggeringIds(prev => new Set(prev).add(id));
    try {
      await triggerSync.mutateAsync([id]);
      setRefreshKey(prev => prev + 1);
    } catch (error) {
      console.error('Trigger sync failed:', error);
    } finally {
      setTriggeringIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const isLoading = overview.isLoading || sellers.isLoading || activity.isLoading || runs.isLoading;
  const hasError = overview.isError || sellers.isError || activity.isError || runs.isError;

  const overviewData = overview.data;
  const sellersData = sellers.data;
  const activityData = activity.data;
  const runsData = runs.data;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Live Sync Tracker</h1>
          <p className="text-muted-foreground mt-1">
            Monitor and manage live data synchronization across all sellers
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            onClick={() => setRefreshKey(prev => prev + 1)}
            disabled={isLoading}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button 
            variant="outline" 
            onClick={() => console.log('Export')}
            className="gap-2"
          >
            <Download className="h-4 w-4" />
            Export
          </Button>
          {selectedSellerIds.size > 0 && (
            <Button 
              onClick={handleTriggerSelected}
              disabled={triggeringIds.size > 0}
              className="gap-2 bg-primary"
            >
              <Zap className="h-4 w-4" />
              Trigger Sync ({selectedSellerIds.size})
            </Button>
          )}
        </div>
      </div>

      <OverviewCards data={overviewData} />

      <Card className="border-border">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative flex-1 min-w-[200px] max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search sellers..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={(v: string) => setStatusFilter(v as any)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="synced">Synced</SelectItem>
                <SelectItem value="enabled">Enabled (Not Synced)</SelectItem>
                <SelectItem value="not_enabled">Not Enabled</SelectItem>
              </SelectContent>
            </Select>
            <Select value={marketplaceFilter} onValueChange={(v: string) => setMarketplaceFilter(v)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Marketplaces" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Marketplaces</SelectItem>
                <SelectItem value="amazon.in">Amazon.in</SelectItem>
                <SelectItem value="amazon.com">Amazon.com</SelectItem>
                <SelectItem value="amazon.ae">Amazon.ae</SelectItem>
                <SelectItem value="ajio">AJIO</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              {getFilteredSellers().length} of {sellersData?.length || 0} sellers
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={(v: string) => setActiveTab(v as any)} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="sellers">Sellers ({sellersData?.length || 0})</TabsTrigger>
          <TabsTrigger value="activity">Recent Activity ({activityData?.length || 0})</TabsTrigger>
          <TabsTrigger value="runs">Run Logs ({runsData?.length || 0})</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <Card>
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold mb-4">Live Sync Overview</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {overviewData && [
                  { label: 'Sellers with Live Sync Enabled', value: overviewData.liveSyncEnabled, desc: `of ${overviewData.totalSellers} total` },
                  { label: 'Sellers Fully Synced', value: overviewData.syncedSellers, desc: `${overviewData.totalSellers > 0 ? ((overviewData.syncedSellers / overviewData.totalSellers) * 100).toFixed(1) : 0}%` },
                  { label: 'Total ASINs Tracked', value: formatNumber(overviewData.totalAsins), desc: 'Across all sellers' },
                  { label: 'ASINs with Live Data', value: formatNumber(overviewData.hasLiveSyncDate), desc: `${overviewData.totalAsins > 0 ? ((overviewData.hasLiveSyncDate / overviewData.totalAsins) * 100).toFixed(1) : 0}% coverage` },
                ].map((stat, i) => (
                  <div key={i} className="p-4 rounded-lg border">
                    <p className="text-sm text-muted-foreground">{stat.label}</p>
                    <p className="text-3xl font-bold mt-1">{stat.value}</p>
                    <p className="text-xs text-muted-foreground mt-1">{stat.desc}</p>
                  </div>
                ))}
              </div>
              
              {overviewData?.sellers && (
                <div className="mt-6">
                  <h4 className="font-semibold mb-3">By Marketplace</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {Object.entries(overviewData.sellers.byMarketplace).map(([marketplace, data]: [string, any]) => (
                      <Card key={marketplace} className="p-4">
                        <p className="text-sm font-medium text-muted-foreground capitalize">{marketplace}</p>
                        <div className="space-y-2 mt-2 text-sm">
                          <div className="flex justify-between"><span>Total Sellers</span><span className="font-medium">{data.total}</span></div>
                          <div className="flex justify-between"><span>Live Sync Enabled</span><span className="font-medium text-green-600">{data.enabled}</span></div>
                          <div className="flex justify-between"><span>Synced</span><span className="font-medium text-emerald-600">{data.synced}</span></div>
                          <div className="flex justify-between"><span>Total ASINs</span><span className="font-medium">{formatNumber(data.totalAsins)}</span></div>
                          <div className="flex justify-between"><span>Live Synced ASINs</span><span className="font-medium text-cyan-600">{formatNumber(data.hasLiveSyncDate)}</span></div>
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sellers" className="space-y-4">
          <Card>
            <CardContent className="p-0">
              <SellersTable 
                sellers={getFilteredSellers()} 
                loading={sellers.isLoading}
                onTriggerSync={handleTriggerSingle}
                triggeringIds={triggeringIds}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity" className="space-y-4">
          <Card>
            <CardContent className="p-0">
              <ActivityTable 
                activities={activityData || []} 
                loading={activity.isLoading}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="runs" className="space-y-4">
          <Card>
            <CardContent className="p-0">
              <RunsTable 
                runs={runsData || []} 
                loading={runs.isLoading}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {hasError && (
        <ErrorAlert message="Failed to load some data. Please refresh or check connection." />
      )}
    </div>
  );
}