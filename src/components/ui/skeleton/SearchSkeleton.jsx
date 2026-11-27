import React from 'react';
import Skeleton from './Skeleton';

/**
 * Skeleton for search trigger button.
 * Shows loading state while search component is loading.
 */
export default function SearchSkeleton() {
  return (
    <button className="flex items-center gap-2 px-3 py-2 bg-transparent border border-transparent rounded-md cursor-pointer text-slate-500 disabled:pointer-events-none disabled:opacity-50 animate-pulse" disabled>
      <div className="sk text [height:16px] [width:20px]" />
      <div className="sk text [height:14px] [width:40%]" />
    </button>
  );
}
