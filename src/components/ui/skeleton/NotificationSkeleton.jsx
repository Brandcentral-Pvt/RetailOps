import React from 'react';
import Skeleton from './Skeleton';

/**
 * Skeleton for notification center button.
 * Shows loading state while notifications are loading.
 */
export function NotificationSkeleton() {
  return (
    <button className="flex items-center gap-2 px-3 py-2 bg-transparent border border-transparent rounded-md cursor-pointer text-slate-500 disabled:pointer-events-none disabled:opacity-50 animate-pulse" disabled>
      <div className="sk text [height:20px] [width:20px]" />
      <div className="sk text [height:14px] [width:40%]" />
    </button>
  );
}

export default NotificationSkeleton;
