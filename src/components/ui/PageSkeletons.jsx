import React from 'react';
import { StatCardSkeleton, TableSkeleton } from '../ui/skeleton';
import Skeleton from '../ui/skeleton/Skeleton.jsx';
import '../ui/skeleton/Skeleton.css';

export function SellersSkeleton() {
  return (
    <div className="sk-dashboard">
      <div className="sk-stats-row">
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
      </div>
      <div className="sk-section">
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <Skeleton variant="rectangular" width="120px" height="32px" borderRadius="6px" animation="wave" />
          <Skeleton variant="rectangular" width="120px" height="32px" borderRadius="6px" animation="wave" />
          <Skeleton variant="rectangular" width="120px" height="32px" borderRadius="6px" animation="wave" />
        </div>
        <TableSkeleton rows={8} columns={6} />
      </div>
    </div>
  );
}

export function AsinManagerSkeleton() {
  return (
    <div className="sk-dashboard">
      <div className="sk-stats-row">
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
      </div>
      <div className="sk-section">
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <Skeleton variant="rectangular" width="200px" height="36px" borderRadius="6px" animation="wave" />
          <Skeleton variant="rectangular" width="100px" height="36px" borderRadius="6px" animation="wave" />
          <Skeleton variant="rectangular" width="100px" height="36px" borderRadius="6px" animation="wave" />
        </div>
        <TableSkeleton rows={10} columns={8} />
      </div>
    </div>
  );
}

export function GmsTrackerSkeleton() {
  return (
    <div className="sk-dashboard">
      <div className="sk-stats-row">
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
      </div>
      <div className="sk-section">
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <Skeleton variant="rectangular" width="150px" height="32px" borderRadius="6px" animation="wave" />
          <Skeleton variant="rectangular" width="150px" height="32px" borderRadius="6px" animation="wave" />
        </div>
        <TableSkeleton rows={8} columns={10} />
      </div>
    </div>
  );
}

export function AdsManagerSkeleton() {
  return (
    <div className="sk-dashboard">
      <div className="sk-stats-row">
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
      </div>
      <div className="sk-chart-area">
        <div className="sk-chart-box">
          <Skeleton variant="text" width="180px" height="20px" animation="wave" />
          <Skeleton variant="rectangular" height="250px" borderRadius="8px" animation="wave" />
        </div>
      </div>
      <div className="sk-section">
        <TableSkeleton rows={6} columns={7} />
      </div>
    </div>
  );
}

export function ReportsSkeleton() {
  return (
    <div className="sk-dashboard">
      <div className="sk-stats-row">
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
      </div>
      <div className="sk-chart-area">
        <div className="sk-chart-box">
          <Skeleton variant="text" width="180px" height="20px" animation="wave" />
          <Skeleton variant="rectangular" height="300px" borderRadius="8px" animation="wave" />
        </div>
        <div className="sk-chart-box sk-chart-side">
          <Skeleton variant="text" width="140px" height="20px" animation="wave" />
          <Skeleton variant="circular" width={160} height={160} animation="wave" />
        </div>
      </div>
      <div className="sk-section">
        <TableSkeleton rows={6} columns={5} />
      </div>
    </div>
  );
}

export function SettingsSkeleton() {
  return (
    <div className="sk-dashboard">
      <div className="sk-section">
        <Skeleton variant="text" width="200px" height="24px" animation="wave" />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16 }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="sk-form__field">
              <Skeleton variant="text" width="100px" height="13px" animation="wave" />
              <Skeleton variant="rectangular" height="38px" borderRadius="6px" animation="wave" />
            </div>
          ))}
        </div>
        <Skeleton variant="rectangular" width="120px" height="40px" borderRadius="6px" animation="wave" style={{ marginTop: 16 }} />
      </div>
    </div>
  );
}

export function UsersSkeleton() {
  return (
    <div className="sk-dashboard">
      <div className="sk-stats-row">
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
      </div>
      <div className="sk-section">
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <Skeleton variant="rectangular" width="200px" height="36px" borderRadius="6px" animation="wave" />
          <Skeleton variant="rectangular" width="100px" height="36px" borderRadius="6px" animation="wave" />
        </div>
        <TableSkeleton rows={8} columns={5} />
      </div>
    </div>
  );
}
