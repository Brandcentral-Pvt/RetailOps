import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import {
  DashboardSkeleton,
  FormSkeleton,
  ProfileSkeleton,
} from '../ui/skeleton';
import {
  SellersSkeleton,
  AsinManagerSkeleton,
  GmsTrackerSkeleton,
  AdsManagerSkeleton,
  ReportsSkeleton,
  SettingsSkeleton,
  UsersSkeleton,
} from '../ui/PageSkeletons';
import { Spinner } from '../Spinner';
import { completeProgress } from './RouteProgress';

const skeletonMap = [
  { pattern: /^\/$/, fallback: <DashboardSkeleton statsCount={4} tableRows={6} /> },
  { pattern: /^\/dashboard/, fallback: <DashboardSkeleton statsCount={4} tableRows={6} /> },

  { pattern: /^\/sku-report/, fallback: <ReportsSkeleton /> },
  { pattern: /^\/parent-asin-report/, fallback: <ReportsSkeleton /> },
  { pattern: /^\/month-wise-report/, fallback: <ReportsSkeleton /> },
  { pattern: /^\/ads-report/, fallback: <ReportsSkeleton /> },
  { pattern: /^\/profit-loss/, fallback: <ReportsSkeleton /> },
  { pattern: /^\/actions\/achievement-report/, fallback: <ReportsSkeleton /> },
  { pattern: /^\/target-achievement\/?$/, fallback: <ReportsSkeleton /> },
  { pattern: /^\/target-achievement\/dashboard/, fallback: <ReportsSkeleton /> },

  { pattern: /^\/sellers/, fallback: <SellersSkeleton /> },
  { pattern: /^\/asin-tracker/, fallback: <AsinManagerSkeleton /> },
  { pattern: /^\/seller-tracker/, fallback: <AsinManagerSkeleton /> },
  { pattern: /^\/gms-tracker/, fallback: <GmsTrackerSkeleton /> },
  { pattern: /^\/ads-manager/, fallback: <AdsManagerSkeleton /> },

  { pattern: /^\/users/, fallback: <UsersSkeleton /> },
  { pattern: /^\/roles/, fallback: <UsersSkeleton /> },
  { pattern: /^\/team-management/, fallback: <UsersSkeleton /> },

  { pattern: /^\/settings/, fallback: <SettingsSkeleton /> },
  { pattern: /^\/api-keys/, fallback: <SettingsSkeleton /> },
  { pattern: /^\/webhooks/, fallback: <SettingsSkeleton /> },
  { pattern: /^\/file-manager/, fallback: <SettingsSkeleton /> },

  { pattern: /^\/inventory/, fallback: <ReportsSkeleton /> },

  { pattern: /^\/alert-rules/, fallback: <FormSkeleton fields={5} /> },
  { pattern: /^\/rule-sets/, fallback: <FormSkeleton fields={6} /> },
  { pattern: /^\/upload-export/, fallback: <FormSkeleton fields={4} /> },
  { pattern: /^\/target-achievement\/create/, fallback: <FormSkeleton fields={5} /> },
  { pattern: /^\/revenue-calculator/, fallback: <FormSkeleton fields={4} /> },

  { pattern: /^\/profile/, fallback: <ProfileSkeleton /> },

  { pattern: /^\/chat/, fallback: <Spinner fullPage tip="Loading chat..." /> },
  { pattern: /^\/login/, fallback: <Spinner fullPage tip="Loading..." /> },
  { pattern: /^\/register/, fallback: <Spinner fullPage tip="Loading..." /> },
  { pattern: /^\/forgot-password/, fallback: <Spinner fullPage tip="Loading..." /> },
  { pattern: /^\/reset-password/, fallback: <Spinner fullPage tip="Loading..." /> },
  { pattern: /^\/unauthorized/, fallback: <Spinner fullPage tip="Loading..." /> },
  { pattern: /^\/setup-wizard/, fallback: <Spinner fullPage tip="Loading wizard..." /> },
];

function resolveFallback(pathname) {
  for (const { pattern, fallback } of skeletonMap) {
    if (pattern.test(pathname)) return fallback;
  }
  return <DashboardSkeleton statsCount={4} tableRows={6} />;
}

function ProgressNotifier({ children }) {
  useEffect(() => {
    completeProgress();
  }, []);
  return children;
}

export default function ModuleFallback({ children }) {
  const location = useLocation();

  return (
    <React.Suspense
      key={location.pathname}
      fallback={
        <div style={{ padding: 24 }}>
          {resolveFallback(location.pathname)}
        </div>
      }
    >
      <ProgressNotifier>{children}</ProgressNotifier>
    </React.Suspense>
  );
}
