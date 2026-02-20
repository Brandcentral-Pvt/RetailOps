import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Header from './components/Header';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import Dashboard from './pages/Dashboard';
import SkuReport from './pages/SkuReport';
import ParentAsinReport from './pages/ParentAsinReport';
import MonthWiseReport from './pages/MonthWiseReport';
import AdsReport from './pages/AdsReport';
import UploadExport from './pages/UploadExport';
import AlertsPage from './pages/AlertsPage';
import AlertRulesPage from './pages/AlertRulesPage';
import ProfitLossPage from './pages/ProfitLossPage';
import InventoryPage from './pages/InventoryPage';
import AsinManagerPage from './pages/AsinManagerPage';
import ActionsPage from './pages/ActionsPage';
import SettingsPage from './pages/SettingsPage';
import UsersPage from './pages/UsersPage';
import ScrapeTasksPage from './pages/ScrapeTasksPage';
import SellersPage from './pages/SellersPage';
import ActivityLog from './pages/ActivityLog';
import GoalAchievementReport from './pages/GoalAchievementReport';
import RevenueCalculatorPage from './pages/RevenueCalculatorPage';
import TemplateManagerPage from './pages/TemplateManagerPage';
import TasksOperationsPage from './pages/TasksOperationsPage';
import ProfilePage from './pages/ProfilePage';
import ChatContainer from './components/chat/ChatContainer';
import Unauthorized from './pages/Unauthorized';
import RolesPage from './pages/RolesPage';
import './App.css';

function AppRoutes() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return null; // ProtectedRoute will show loading state
  }

  return (
    <Routes>
      {/* Public routes */}
      <Route
        path="/login"
        element={isAuthenticated ? <Navigate to="/" replace /> : <LoginPage />}
      />
      <Route
        path="/register"
        element={isAuthenticated ? <Navigate to="/" replace /> : <RegisterPage />}
      />

      {/* Protected routes */}
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <div className="app-layout">
              <Header />
              <main className="main-content">
                <div className="routes-container">
                  <Routes>
                    <Route path="/" element={<ProtectedRoute permission="dashboard_view"><Dashboard /></ProtectedRoute>} />
                    <Route path="/dashboard" element={<ProtectedRoute permission="dashboard_view"><Dashboard /></ProtectedRoute>} />
                    <Route path="/sku-report" element={<ProtectedRoute permission="reports_sku_view"><SkuReport /></ProtectedRoute>} />
                    <Route path="/parent-asin-report" element={<ProtectedRoute permission="reports_parent_view"><ParentAsinReport /></ProtectedRoute>} />
                    <Route path="/month-wise-report" element={<ProtectedRoute permission="reports_monthly_view"><MonthWiseReport /></ProtectedRoute>} />
                    <Route path="/ads-report" element={<ProtectedRoute permission="reports_ads_view"><AdsReport /></ProtectedRoute>} />
                    <Route path="/asin-tracker" element={<ProtectedRoute permission="sellers_view"><AsinManagerPage /></ProtectedRoute>} />
                    <Route path="/profit-loss" element={<ProtectedRoute permission="reports_profit_view"><ProfitLossPage /></ProtectedRoute>} />
                    <Route path="/inventory" element={<ProtectedRoute permission="reports_inventory_view"><InventoryPage /></ProtectedRoute>} />
                    <Route path="/actions" element={<ProtectedRoute permission="actions_view"><ActionsPage /></ProtectedRoute>} />
                    <Route path="/users" element={<ProtectedRoute permission="users_view"><UsersPage /></ProtectedRoute>} />
                    <Route path="/roles" element={<ProtectedRoute permission="roles_view"><RolesPage /></ProtectedRoute>} />
                    <Route path="/settings" element={<ProtectedRoute permission="settings_view"><SettingsPage /></ProtectedRoute>} />
                    <Route path="/upload-export" element={<ProtectedRoute permission="sellers_manage_asins"><UploadExport /></ProtectedRoute>} />
                    <Route path="/alerts" element={<ProtectedRoute permission="dashboard_view"><AlertsPage /></ProtectedRoute>} />
                    <Route path="/alert-rules" element={<ProtectedRoute permission="settings_view"><AlertRulesPage /></ProtectedRoute>} />
                    <Route path="/scrape-tasks" element={<ProtectedRoute permission="scraping_view"><ScrapeTasksPage /></ProtectedRoute>} />
                    <Route path="/sellers" element={<ProtectedRoute permission="sellers_view"><SellersPage /></ProtectedRoute>} />
                    <Route path="/activity-log" element={<ProtectedRoute permission="settings_view"><ActivityLog /></ProtectedRoute>} />
                    <Route path="/actions/templates" element={<ProtectedRoute permission="actions_manage"><TemplateManagerPage /></ProtectedRoute>} />
                    <Route path="/actions/achievement-report" element={<ProtectedRoute permission="reports_monthly_view"><GoalAchievementReport /></ProtectedRoute>} />
                    <Route path="/revenue-calculator" element={<ProtectedRoute permission="calculator_view"><RevenueCalculatorPage /></ProtectedRoute>} />
                    <Route path="/profile" element={<ProfilePage />} />
                    <Route path="/profile/:id" element={<ProfilePage />} />
                    <Route path="/chat" element={<ChatContainer />} />
                    <Route path="/unauthorized" element={<Unauthorized />} />
                  </Routes>
                </div>
              </main>
            </div>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

import { SocketProvider } from './contexts/SocketContext';
import { ToastProvider } from './contexts/ToastContext';
import GlobalNotificationListener from './components/GlobalNotificationListener';


function App() {
  return (
    <AuthProvider>
      <SocketProvider>
        <ToastProvider>
          <GlobalNotificationListener />

          <AppRoutes />
        </ToastProvider>
      </SocketProvider>
    </AuthProvider>
  );
}

export default App;
