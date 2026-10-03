/**
 * AuthProvider — restores the session once, at the root.
 *
 * Kept separate from the store so the store stays a plain data module that a
 * test or a Storybook can drive directly.
 */
import React, { useEffect, type ReactNode } from 'react';
import { useAuthStore } from './authStore';

export function AuthProvider({ children }: { children: ReactNode }) {
  const bootstrap = useAuthStore((s) => s.bootstrap);
  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);
  return <>{children}</>;
}
