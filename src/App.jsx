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
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/dashboard" element={<Dashboard />} />
                    <Route path="/sku-report" element={<SkuReport />} />
                    <Route path="/parent-asin-report" element={<ParentAsinReport />} />
                    <Route path="/month-wise-report" element={<MonthWiseReport />} />
                    <Route path="/ads-report" element={<AdsReport />} />
                    <Route path="/asin-tracker" element={<AsinManagerPage />} />
                    <Route path="/profit-loss" element={<ProfitLossPage />} />
                    <Route path="/inventory" element={<InventoryPage />} />
                    <Route path="/actions" element={<ActionsPage />} />
                    <Route path="/users" element={<UsersPage />} />
                    <Route path="/settings" element={<SettingsPage />} />
                    <Route path="/upload-export" element={<UploadExport />} />
                    <Route path="/alerts" element={<AlertsPage />} />
                    <Route path="/alert-rules" element={<AlertRulesPage />} />
                    <Route path="/scrape-tasks" element={<ScrapeTasksPage />} />
                    <Route path="/sellers" element={<SellersPage />} />
                    <Route path="/activity-log" element={<ActivityLog />} />
                    <Route path="/actions/templates" element={<TemplateManagerPage />} />
                    <Route path="/actions/achievement-report" element={<GoalAchievementReport />} />
                    <Route path="/revenue-calculator" element={<RevenueCalculatorPage />} />
                    <Route path="/profile" element={<ProfilePage />} />
                    <Route path="/profile/:id" element={<ProfilePage />} />
                    <Route path="/chat" element={< ChatContainer />} />
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
