import React from 'react';
import { useLocation } from 'react-router-dom';
import { PageLoading } from '../Spinner';

export default function ModuleFallback({ children }) {
  const location = useLocation();

  return (
    <React.Suspense
      key={location.pathname}
      fallback={<PageLoading message="Loading page..." />}
    >
      {children}
    </React.Suspense>
  );
}
