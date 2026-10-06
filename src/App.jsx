import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate, useParams } from 'react-router-dom';
import { ConfigProvider, App as AntdApp } from 'antd';
import retailOpsTheme from './theme/antdTheme';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { SidebarProvider } from './contexts/SidebarContext';
import { PageTitleProvider } from './contexts/PageTitleContext';
import { DateRangeProvider } from './contexts/DateRangeContext';
import ProtectedRoute from './components/ProtectedRoute';
import GlobalHeader from './components/header/GlobalHeader';
import { HeaderProvider } from './contexts/HeaderContext';
import RoutePageMeta from './components/layout/RoutePageMeta';
import RouteProgress from './components/ui/RouteProgress';
import ModuleFallback from './components/ui/ModuleFallback';
import Sidebar from './components/common/Sidebar';
import ErrorBoundary from './components/ErrorBoundary';
import OpenAIShortcut from './components/ai/OpenAIShortcut';
const LoginPage = lazy(() => import('./pages/LoginPage'));
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage'));
import { SocketProvider } from './contexts/SocketContext';
import { ToastProvider } from './contexts/ToastContext';
import { OnboardingProvider, useOnboarding } from './contexts/OnboardingContext';
import { RefreshProvider } from './contexts/RefreshContext';
const OnboardingWizard = lazy(() => import('./components/onboarding/OnboardingWizard'));
const GlobalNotificationListener = lazy(() => import('./components/GlobalNotificationListener'));
import './App.css';

// Lazy load pages for better performance
const Dashboard = lazy(() => import('./pages/Dashboard'));
// ✅ Redesigned corporate dashboard (no legacy dashboard components) — serves / and /dashboard
const OpsCenter = lazy(() => import('./pages/opsCenter/OpsCenter'));
const DashboardV2 = lazy(() => import('./pages/DashboardV2'));
const SkuReport = lazy(() => import('./pages/SkuReport'));
const ParentAsinReport = lazy(() => import('./pages/ParentAsinReport'));
const MonthWiseReport = lazy(() => import('./pages/MonthWiseReport'));
const UploadExport = lazy(() => import('./pages/UploadExport'));
const AlertRulesPage = lazy(() => import('./pages/AlertRulesPage'));
const RuleSetsPage = lazy(() => import('./pages/RuleSetsPage'));
const RulesetBuilderPage = lazy(() => import('./pages/RulesetBuilderPage'));
const ProfitLossPage = lazy(() => import('./pages/ProfitLossPage'));
const InventoryPage = lazy(() => import('./pages/InventoryPage'));
const AsinManagerPage = lazy(() => import('./pages/AsinManagerPage'));
// Ads Intelligence = Ads Manager + Ads Report + AI Analyst in one rebuilt module
const AdsIntelligencePage = lazy(() => import('./pages/ads/AdsManagerPage'));
const GmsTrackerPage = lazy(() => import('./pages/GmsTrackerPage'));
const SellerAsinTrackerPage = lazy(() => import('./pages/SellerAsinTrackerPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const UsersPage = lazy(() => import('./pages/UsersPage'));
const ScrapeTasksPage = lazy(() => import('./pages/ScrapeTasksPage'));
const ScraperDashboardPage = lazy(() => import('./pages/ScraperDashboardPage'));
const SellersPage = lazy(() => import('./pages/SellersPage'));
const ScheduledRunsPage = lazy(() => import('./pages/ScheduledRunsPage'));
const ActivityLog = lazy(() => import('./pages/ActivityLog'));
const GoalAchievementReport = lazy(() => import('./pages/GoalAchievementReport'));
const TargetVsAchievement = lazy(() => import('./pages/TargetVsAchievement'));
const TargetVsAchievementDashboard = lazy(() => import('./pages/TargetVsAchievementDashboard'));
const TargetCreationPage = lazy(() => import('./pages/TargetCreationPage'));
const RevenueCalculatorPage = lazy(() => import('./pages/RevenueCalculatorPage'));
const TemplateManagerPage = lazy(() => import('./pages/TemplateManagerPage'));

const TaskPerformanceDashboard = lazy(() => import('./modules/tasks/pages/TaskPerformanceDashboard'));
const TaskTemplatesPage = lazy(() => import('./modules/tasks/pages/TaskTemplatesPage'));
const MyDayPage = lazy(() => import('./modules/tasks/pages/MyDayPage'));
const TaskInstancesPage = lazy(() => import('./modules/tasks/pages/TaskInstancesPage'));
const ReviewQueuePage = lazy(() => import('./modules/tasks/pages/ReviewQueuePage'));
const TaskAnalyticsPage = lazy(() => import('./modules/tasks/pages/TaskAnalyticsPage'));
const TemplateDetailPage = lazy(() => import('./modules/tasks/pages/TemplateDetailPage'));
const LiveSyncTrackerPage = lazy(() => import('./pages/LiveSyncTrackerPage'));
const LiveDataInspectorPage = lazy(() => import('./pages/LiveDataInspectorPage'));
const LiveSyncPage = lazy(() => import('./pages/LiveSyncPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const Unauthorized = lazy(() => import('./pages/Unauthorized'));
const RolesPage = lazy(() => import('./pages/RolesPage'));
const ApiKeysPage = lazy(() => import('./pages/ApiKeysPage'));
const FileManagerPage = lazy(() => import('./pages/FileManagerPage'));
const TeamManagementPage = lazy(() => import('./pages/TeamManagementPage'));
const WebhookSettingsPage = lazy(() => import('./pages/WebhookSettingsPage'));
const SetupWizardPage = lazy(() => import('./pages/SetupWizardPage'));
const KeywordResearchPage = lazy(() => import('./pages/keywords/KeywordResearchPage'));
const AIChatPage = lazy(() => import('./pages/AIChatPage'));

// Layout wrapper — flex row: Sidebar takes its own width, content fills the rest
function AppLayout({ children }) {
  return (
    <HeaderProvider>
      <OpenAIShortcut />
      <div className="app-shell">
        <Sidebar />
        <div className="content-wrapper">
          <GlobalHeader />
          <main className="main-content">
            <div className="routes-container">
              {children}
            </div>
          </main>
        </div>
      </div>
    </HeaderProvider>
  );
}

import { PageLoading } from './components/Spinner';

// Legacy /pems/templates/:id bookmarks must keep the template id, so the
// target has to be interpolated rather than passed through as a literal path.
function LegacyTemplateRedirect() {
  const { id } = useParams();
  return <Navigate to={`/tasks/templates/${id}`} replace />;
}

// First landing of a session: employees (non-admin, non-global roles that can use
// Tasks) start on "My Day" — their plan for today. Admins and managers keep the
// Ops Center. MyDayPage marks the session as greeted, so a later visit to "/"
// (e.g. the Dashboard link) shows the dashboard instead of bouncing back.
function HomeRoute() {
  const { isAdmin, isGlobalUser, hasPermission } = useAuth();
  const greeted = typeof sessionStorage !== 'undefined' && sessionStorage.getItem('landing.myday') === '1';
  const isEmployee = !isAdmin && !isGlobalUser && hasPermission('tasks_view');
  if (isEmployee && !greeted) return <Navigate to="/tasks/my-day" replace />;
  return <ProtectedRoute permission="dashboard_view"><OpsCenter /></ProtectedRoute>;
}

function AppRoutes() {
  const { loading } = useAuth();
  const { showWizard, isLoading: onboardingLoading } = useOnboarding();

  if (loading || onboardingLoading) return <PageLoading message="Checking authentication..." />;

  return (
    <Suspense fallback={<PageLoading message="Loading..." />}>
      <RouteProgress />
      {showWizard && <OnboardingWizard />}
      <GlobalNotificationListener />
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<LoginPage />} />

        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/setup-wizard" element={<ProtectedRoute><SetupWizardPage /></ProtectedRoute>} />

        {/* Protected routes with sidebar + header layout */}
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <AppLayout>
                <ModuleFallback>
                <RoutePageMeta />
                <Routes>
                  <Route path="/" element={<HomeRoute />} />
                  <Route path="/dashboard" element={<ProtectedRoute permission="dashboard_view"><OpsCenter /></ProtectedRoute>} />
                  <Route path="/dashboard-v2" element={<ProtectedRoute permission="dashboard_view"><DashboardV2 /></ProtectedRoute>} />
                  <Route path="/sku-report" element={<ProtectedRoute permission="skureport_view"><SkuReport /></ProtectedRoute>} />
                  <Route path="/parent-asin-report" element={<ProtectedRoute permission="parentreport_view"><ParentAsinReport /></ProtectedRoute>} />
                  <Route path="/month-wise-report" element={<ProtectedRoute permission="monthlyreport_view"><MonthWiseReport /></ProtectedRoute>} />
                  {/* Legacy route kept as a redirect: the Ads Report surface is now a view inside Ads Intelligence. */}
                  <Route path="/ads-report" element={<Navigate to="/ads-manager" replace />} />
                  <Route path="/asin-tracker" element={<ProtectedRoute permission="asinmanager_view"><AsinManagerPage /></ProtectedRoute>} />
                  <Route path="/keyword-research" element={<ProtectedRoute><KeywordResearchPage /></ProtectedRoute>} />
                  <Route path="/ads-manager" element={<ProtectedRoute permission="adsreport_view"><AdsIntelligencePage /></ProtectedRoute>} />
                  <Route path="/gms-tracker" element={<ProtectedRoute permission="gms_tracker_view"><GmsTrackerPage /></ProtectedRoute>} />
                  <Route path="/profit-loss" element={<ProtectedRoute permission="pnlreport_view"><ProfitLossPage /></ProtectedRoute>} />
                  <Route path="/inventory" element={<ProtectedRoute permission="inventoryreport_view"><InventoryPage /></ProtectedRoute>} />
                  <Route path="/users" element={<ProtectedRoute permission="users_view"><UsersPage /></ProtectedRoute>} />
                  <Route path="/roles" element={<ProtectedRoute permission="roles_view"><RolesPage /></ProtectedRoute>} />
                  <Route path="/team-management" element={<ProtectedRoute permission="roles_view"><TeamManagementPage /></ProtectedRoute>} />
                  <Route path="/settings" element={<ProtectedRoute permission="settings_manage"><SettingsPage /></ProtectedRoute>} />
                  <Route path="/api-keys" element={<ProtectedRoute permission="apikeys_manage"><ApiKeysPage /></ProtectedRoute>} />
                  <Route path="/file-manager" element={<ProtectedRoute permission="files_manage"><FileManagerPage /></ProtectedRoute>} />
                  <Route path="/upload-export" element={<ProtectedRoute permission="asinmanager_import"><UploadExport /></ProtectedRoute>} />
                  <Route path="/alerts" element={<ProtectedRoute permission="activitylogs_view"><ActivityLog /></ProtectedRoute>} />
                  <Route path="/alert-rules" element={<ProtectedRoute permission="rules_view"><AlertRulesPage /></ProtectedRoute>} />
                  <Route path="/rule-sets" element={<ProtectedRoute permission="rules_view"><RuleSetsPage /></ProtectedRoute>} />
                  <Route path="/rule-sets/new" element={<ProtectedRoute permission="rules_manage"><RulesetBuilderPage /></ProtectedRoute>} />
                  <Route path="/rule-sets/:id" element={<ProtectedRoute permission="rules_manage"><RulesetBuilderPage /></ProtectedRoute>} />
                   <Route path="/scrape-tasks" element={<ProtectedRoute permission="scraping_view"><ScrapeTasksPage /></ProtectedRoute>} />
                   <Route path="/scraper" element={<ProtectedRoute permission="scraping_view"><ScraperDashboardPage /></ProtectedRoute>} />
                   <Route path="/live-sync-tracker" element={<ProtectedRoute permission="scraping_view"><LiveSyncPage /></ProtectedRoute>} />
                   <Route path="/live-data-inspector" element={<ProtectedRoute permission="scraping_view"><LiveSyncPage /></ProtectedRoute>} />
                   <Route path="/live-sync" element={<ProtectedRoute permission="scraping_view"><LiveSyncPage /></ProtectedRoute>} />
                  <Route path="/scheduled-runs" element={<ProtectedRoute permission="scraping_view"><ScheduledRunsPage /></ProtectedRoute>} />
                  <Route path="/sellers" element={<ProtectedRoute permission="seller_view"><ErrorBoundary><SellersPage /></ErrorBoundary></ProtectedRoute>} />
                  <Route path="/seller-tracker" element={<ProtectedRoute permission="asintracker_view"><ErrorBoundary><SellerAsinTrackerPage /></ErrorBoundary></ProtectedRoute>} />
                  <Route path="/seller-tracker/:sellerId" element={<ProtectedRoute permission="asintracker_view"><ErrorBoundary><SellerAsinTrackerPage /></ErrorBoundary></ProtectedRoute>} />
                  <Route path="/activity-log" element={<ProtectedRoute permission="activitylogs_view"><ActivityLog /></ProtectedRoute>} />
                  <Route path="/actions/templates" element={<ProtectedRoute permission="actions_manage"><TemplateManagerPage /></ProtectedRoute>} />
                  <Route path="/actions/achievement-report" element={<ProtectedRoute permission="monthlyreport_view"><GoalAchievementReport /></ProtectedRoute>} />
                  <Route path="/target-achievement" element={<ProtectedRoute permission="monthlyreport_view"><TargetVsAchievement /></ProtectedRoute>} />
                  <Route path="/target-achievement/dashboard" element={<ProtectedRoute permission="monthlyreport_view"><TargetVsAchievementDashboard /></ProtectedRoute>} />
                  <Route path="/target-achievement/create" element={<ProtectedRoute permission="monthlyreport_edit"><TargetCreationPage /></ProtectedRoute>} />
                  <Route path="/ai-chat" element={<ProtectedRoute permission="dashboard_view"><AIChatPage /></ProtectedRoute>} />
                  <Route path="/revenue-calculator" element={<ProtectedRoute permission="calculator_view"><RevenueCalculatorPage /></ProtectedRoute>} />
                  <Route path="/tasks" element={<Navigate to="/tasks/tasks" replace />} />
                  <Route path="/tasks/my-day" element={<ProtectedRoute permission="tasks_view"><MyDayPage /></ProtectedRoute>} />
                  <Route path="/tasks/dashboard" element={<ProtectedRoute permission="tasks_view"><TaskPerformanceDashboard /></ProtectedRoute>} />
                  <Route path="/tasks/templates" element={<ProtectedRoute permission="tasks_manage"><TaskTemplatesPage /></ProtectedRoute>} />
                  <Route path="/tasks/templates/:id" element={<ProtectedRoute permission="tasks_manage"><TemplateDetailPage /></ProtectedRoute>} />
                  <Route path="/tasks/tasks" element={<ProtectedRoute permission="tasks_view"><TaskInstancesPage /></ProtectedRoute>} />
                  <Route path="/tasks/reviews" element={<ProtectedRoute permission="tasks_view"><ReviewQueuePage /></ProtectedRoute>} />
                  <Route path="/tasks/analytics" element={<ProtectedRoute permission="tasks_view"><TaskAnalyticsPage /></ProtectedRoute>} />
                  {/* Legacy PEMS URLs — kept so existing bookmarks keep working. */}
                  <Route path="/pems/dashboard" element={<Navigate to="/tasks/dashboard" replace />} />
                  <Route path="/pems/templates" element={<Navigate to="/tasks/templates" replace />} />
                  <Route path="/pems/templates/:id" element={<LegacyTemplateRedirect />} />
                  <Route path="/pems/tasks" element={<Navigate to="/tasks/tasks" replace />} />
                  <Route path="/pems/reviews" element={<Navigate to="/tasks/reviews" replace />} />
                  <Route path="/pems/analytics" element={<Navigate to="/tasks/analytics" replace />} />
                  <Route path="/webhooks" element={<ProtectedRoute permission="rules_manage"><WebhookSettingsPage /></ProtectedRoute>} />

                  <Route path="/profile" element={<ProfilePage />} />
                  <Route path="/profile/:id" element={<ProfilePage />} />
                  <Route path="/unauthorized" element={<Unauthorized />} />
                </Routes>
                </ModuleFallback>
              </AppLayout>
            </ProtectedRoute>
          }
        />
      </Routes>
    </Suspense>
  );
}



function App() {
  return (
    <ErrorBoundary>
      <RefreshProvider>
          <AuthProvider>
            <OnboardingProvider>
              <SocketProvider>
                <SidebarProvider>
                  <DateRangeProvider>
                    <PageTitleProvider>
                      <ToastProvider>
                        <ConfigProvider
                          theme={retailOpsTheme}
                          spin={{ indicator: <span className="icon-[svg-spinners--eclipse]" aria-hidden="true" /> }}
                        >
                        <AntdApp>
                          <AppRoutes />
                        </AntdApp>
                        </ConfigProvider>
                      </ToastProvider>
                    </PageTitleProvider>
                  </DateRangeProvider>
                </SidebarProvider>
              </SocketProvider>
            </OnboardingProvider>
          </AuthProvider>
        </RefreshProvider>
    </ErrorBoundary>
  );
}

export default App;
