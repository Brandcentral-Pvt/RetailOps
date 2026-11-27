import React from 'react';
import Skeleton from './Skeleton';

/**
 * Skeleton skeleton for the header brand component.
 * Shows loading state while page metadata is loading.
 */
export default function HeaderSkeleton() {
  return (
    <div className="flex flex-col gap-1 min-w-0 animate-pulse">
      <div className="flex flex-wrap items-center gap-1 text-[11px] font-medium text-slate-500">
        <span className="sk text [height:11px] [width:40%]"></span>
        <Separator className="h-3.5 w-[1px] mx-1 border-border" />
        <span className="sk text [height:11px] [width:60%]"></span>
      </div>
      <h1 className="sk text [height:14px] [width:60%] text-slate-900 leading-none" />
    </div>
  );
}
