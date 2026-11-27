import React from 'react';
import Skeleton from './Skeleton';

/**
 * Skeleton for UserMenu button.
 * Shows loading state while user data is loading.
 */
export default function UserMenuSkeleton() {
  return (
    <button className="flex items-center gap-2 px-4 py-2 bg-transparent border border-transparent rounded-md cursor-pointer text-slate-500 disabled:pointer-events-none disabled:opacity-50 animate-pulse" disabled>
      <div className="flex items-center gap-2 px-3 py-2 bg-transparent border border-transparent rounded-md cursor-pointer text-slate-500 disabled:pointer-events-none disabled:opacity-50 animate-pulse" disabled>
        <div className="sk text [height:28px] [width:28px] rounded-full" />
        <div className="flex flex-col gap-1">
          <div className="sk text [height:11px] [width:60%]"></div>
          <div className="sk text [height:9px] [width:40%]"></div>
        </div>
      </div>
    </button>
  );
}
