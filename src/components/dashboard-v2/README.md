# Dashboard V2 - Data-Driven Architecture

## Overview

This is a complete redesign of the dashboard system with a **data-driven, enterprise-grade architecture** that addresses the limitations of the previous static implementation.

## Key Improvements Over V1

### Before (V1 - Beginner/Static)
- ❌ Hardcoded mock data in components
- ❌ No real API integration
- ❌ Static visualizations without interactivity
- ❌ No data fetching logic
- ❌ No caching or optimization
- ❌ No TypeScript types for data
- ❌ No real-time updates
- ❌ No error handling
- ❌ No loading states

### After (V2 - Data-Driven/Enterprise)
- ✅ Real-time API integration with React Query
- ✅ Comprehensive TypeScript types for all data models
- ✅ Automatic caching, background refetching, stale-while-revalidate
- ✅ Real-time streaming updates via Server-Sent Events
- ✅ Optimistic mutations for instant UI feedback
- ✅ Proper loading, error, and empty states
- ✅ Data freshness tracking
- ✅ Modular, composable widget architecture
- ✅ Advanced filtering and sorting
- ✅ Projection and trend analysis

## Architecture

```
dashboard-v2/
├── types/              # TypeScript interfaces for all data models
│   └── index.ts        # KpiMetric, GoalProgress, Alert, Task, etc.
├── services/           # API layer with typed fetchers
│   └── dashboardApi.ts # REST + SSE clients
├── hooks/              # React hooks for data fetching
│   └── useDashboardData.ts
├── widgets/            # Reusable data-driven components
│   └── DataDrivenKpiCard.tsx
└── index.ts            # Public API exports
```

## Data Models

### Core Types

```typescript
// KPI with full metadata
interface KpiMetric {
  id: string;
  metricType: MetricType;      // GMS, ADS_SPEND, CVR, etc.
  label: string;
  currentValue: number;
  previousValue: number;
  targetValue?: number;
  unit: string;
  format: 'currency' | 'percentage' | 'number' | 'ratio';
  trend: 'up' | 'down' | 'stable';
  changePercent: number;
  changeAbsolute: number;
  status: GoalStatus;          // AHEAD, ON_TRACK, BEHIND, PENDING
  sparkline?: TimeSeriesDataPoint[];
  isLoaded: boolean;
}

// Goal tracking with projections
interface GoalProgress {
  id: string;
  title: string;
  metricType: MetricType;
  targetValue: number;
  currentValue: number;
  progressPercent: number;
  gap: number;
  runRateRequired: number;
  projectedValue: number;
  isOnTrack: boolean;
  daysRemaining: number;
  trend: 'accelerating' | 'on pace' | 'decelerating' | 'stalled';
  contributors: Contributor[];
}

// Intelligent alerts with recommendations
interface Alert {
  id: string;
  type: AlertCategory;         // inventory, ads, listing, sales
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  title: string;
  message: string;
  affectedEntities: Entity[];
  detectedAt: string;
  acknowledged: boolean;
  recommendedActions: string[];
}

// AI-powered tasks with impact estimation
interface OptimizedTask {
  id: string;
  title: string;
  recommendation: string;
  priority: TaskPriority;
  impactScore: number;
  estimatedImpact: {
    metric: MetricType;
    currentValue: number;
    projectedValue: number;
    uplift: number;
    confidence: number;
  };
  aiGenerated: boolean;
  aiReasoning?: string;
}
```

## Usage Examples

### Basic Dashboard Integration

```tsx
import { useDashboardData, DataDrivenKpiCard } from '@/components/dashboard-v2';

function MyDashboard() {
  const {
    kpis,
    goals,
    tasks,
    alerts,
    isLoading,
    isRefreshing,
    error,
    refresh,
    updateFilters,
  } = useDashboardData({
    dateRange: {
      start: new Date('2025-01-01'),
      end: new Date(),
      preset: 'ytd',
    },
    sellerIds: ['seller-123'],
    metricTypes: ['GMS', 'ADS_SPEND', 'CVR'],
  }, {
    refreshInterval: 60000,    // Auto-refresh every minute
    autoRefresh: true,
    enableStreaming: true,     // Real-time updates
  });

  if (isLoading) return <DashboardSkeleton />;
  if (error) return <ErrorState error={error} onRetry={refresh} />;

  return (
    <div className="dashboard-grid">
      {/* KPI Cards */}
      <div className="kpi-grid">
        {kpis.map(metric => (
          <DataDrivenKpiCard
            key={metric.id}
            metric={metric}
            showTarget={true}
            showSparkline={true}
            onClick={() => navigate(`/metrics/${metric.metricType}`)}
          />
        ))}
      </div>

      {/* Goals Tracker */}
      <GoalsTracker goals={goals} />

      {/* Tasks with AI Recommendations */}
      <TaskList tasks={tasks} onExecute={executeTask} />

      {/* Real-time Alerts */}
      <AlertFeed alerts={alerts} onAcknowledge={acknowledgeAlert} />
    </div>
  );
}
```

### Advanced Filtering

```tsx
const { updateFilters, setFilters } = useDashboardData(initialFilters);

// Update specific filter
updateFilters({
  dateRange: {
    start: new Date('2025-01-01'),
    end: new Date('2025-01-31'),
    preset: 'custom',
  },
});

// Replace all filters
setFilters({
  dateRange: { start, end },
  sellerIds: ['seller-456'],
  managerId: 'manager-789',
  metricTypes: ['GMS', 'ACOS'],
  includeProjections: true,
  comparePreviousPeriod: true,
});
```

### Manual Refresh & Cache Control

```tsx
const { refresh, invalidateCache, autoRefreshEnabled, toggleAutoRefresh } = useDashboardData();

// Force refresh
await refresh();

// Invalidate cache (triggers refetch)
invalidateCache();

// Toggle auto-refresh
toggleAutoRefresh();
```

## API Service Layer

The service layer provides typed API clients with proper error handling:

```typescript
// Fetch complete dashboard snapshot
const snapshot = await fetchDashboardSnapshot(filters);

// Fetch individual data sources
const kpis = await fetchKpis(filters);
const goals = await fetchGoals(filters);
const tasks = await fetchTasks(filters);
const alerts = await fetchAlerts(filters);
const products = await fetchTopProducts(filters);

// Mutations
await acknowledgeAlert(alertId, userId);
await updateTaskStatus(taskId, 'COMPLETED', userId);
await executeAction('adjust_bid', { campaignId, newBid });

// Real-time streaming
const unsubscribe = subscribeToDashboardUpdates(
  (update) => {
    // Handle real-time updates
    console.log('Stream update:', update.type, update.action);
  },
  (error) => {
    console.error('Stream error:', error);
  }
);

// Cleanup
unsubscribe();
```

## React Query Configuration

The hook uses optimized React Query settings:

```typescript
useQuery({
  queryKey: ['dashboard-v2', filters],
  queryFn: () => fetchDashboardSnapshot(filters),
  staleTime: 30000,              // Data fresh for 30s
  gcTime: 5 * 60 * 1000,         // Cache for 5 minutes
  refetchOnWindowFocus: true,    // Refetch when tab regains focus
  refetchOnReconnect: true,      // Refetch on network reconnect
  retry: 3,                      // Retry failed requests 3 times
  retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 30000), // Exponential backoff
});
```

## Real-Time Streaming

Supports Server-Sent Events (SSE) for real-time updates:

```typescript
// Stream updates for KPIs, alerts, tasks, goals
subscribeToDashboardUpdates((update) => {
  switch (update.type) {
    case 'kpis':
      // Update specific KPI in cache
      break;
    case 'alerts':
      // Add new alert to feed
      break;
    case 'tasks':
      // Update task status
      break;
    case 'goals':
      // Update goal progress
      break;
  }
});
```

## Widget Components

### DataDrivenKpiCard Features

- **Automatic formatting**: Currency, percentage, ratio
- **Trend indicators**: Up/down/stable with color coding
- **Sparkline charts**: Mini time series visualization
- **Target tracking**: Progress bar with percentage
- **Status badges**: AHEAD, ON_TRACK, BEHIND, PENDING
- **Risk warnings**: Alerts when progress < 50%
- **Loading states**: Skeleton placeholders
- **Hover interactions**: Scale and shadow effects
- **Click handlers**: Navigation support

## Backend Requirements

To fully utilize Dashboard V2, your backend should provide:

### Endpoints

```
GET  /dashboard/v2/snapshot     # Complete dashboard data
GET  /dashboard/v2/kpis         # KPI metrics
GET  /dashboard/v2/stream       # SSE endpoint for real-time updates
GET  /goals                     # Goal tracking
GET  /tasks/optimized           # AI-generated tasks
GET  /alerts                    # Intelligent alerts
GET  /analytics/products        # Product performance
GET  /ads/performance           # Ads metrics
GET  /inventory/health          # Inventory status
POST /alerts/:id/acknowledge    # Acknowledge alert
PATCH /tasks/:id                # Update task
POST /actions/execute           # Execute recommended action
```

### Response Format

```json
{
  "success": true,
  "data": {
    "timestamp": "2025-01-15T10:30:00Z",
    "period": { "start": "2025-01-01", "end": "2025-01-15", "label": "YTD" },
    "kpis": [...],
    "goals": [...],
    "tasks": [...],
    "alerts": [...],
    "dataFreshness": {
      "lastUpdated": "2025-01-15T10:29:45Z",
      "stalenessSeconds": 15,
      "sources": [
        { "name": "sales_db", "lastSync": "...", "status": "ok" }
      ]
    }
  },
  "meta": {
    "requestId": "req_123",
    "generatedAt": "2025-01-15T10:30:00Z",
    "processingTimeMs": 145,
    "cacheHit": false
  }
}
```

## Migration Guide

### From V1 to V2

1. **Replace old imports**:
   ```diff
   - import ModuleCard from '@/components/dashboard/ModuleCard';
   + import { DataDrivenKpiCard, useDashboardData } from '@/components/dashboard-v2';
   ```

2. **Update data flow**:
   ```diff
   - const { orch } = useDashboardOrchestration();
   - const kpis = useMemo(() => computeKpis(orch), [orch]);
   
   + const { kpis, isLoading } = useDashboardData(filters);
   ```

3. **Add TypeScript types**:
   ```diff
   - function KpiCard({ data }) { ... }
   + function KpiCard({ metric }: { metric: KpiMetric }) { ... }
   ```

4. **Enable real-time features**:
   ```diff
   - const data = useDashboardData(filters);
   + const data = useDashboardData(filters, { enableStreaming: true });
   ```

## Performance Optimizations

- **Stale-while-revalidate**: Show cached data while fetching updates
- **Background refetching**: Silent updates without UI disruption
- **Optimistic mutations**: Instant UI feedback before server confirmation
- **Selective refetching**: Only refetch affected queries
- **Request deduplication**: Multiple components share same query
- **Exponential backoff**: Smart retry strategy
- **Cache persistence**: Survives page navigation

## Next Steps

To complete the Dashboard V2 implementation:

1. **Create additional widgets**:
   - `GoalTrackerWidget` - Visual goal progress tracking
   - `TaskListWidget` - AI-recommended tasks with execution
   - `AlertFeedWidget` - Real-time alert stream
   - `RevenueChartWidget` - Interactive revenue breakdown
   - `InventoryHealthWidget` - Stock level monitoring

2. **Add advanced features**:
   - Custom dashboard layouts (drag-and-drop widgets)
   - Export functionality (PDF, CSV, Excel)
   - Comparison mode (period-over-period)
   - Anomaly detection highlights
   - Predictive forecasting

3. **Backend integration**:
   - Implement `/dashboard/v2/*` endpoints
   - Set up SSE streaming
   - Add data aggregation jobs
   - Configure cache layers

## Support

For questions or issues, refer to:
- Type definitions in `types/index.ts`
- API examples in `services/dashboardApi.ts`
- Hook usage in `hooks/useDashboardData.ts`
- Component patterns in `widgets/DataDrivenKpiCard.tsx`
