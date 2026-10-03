import { useEffect, useState } from 'react';

/** Renders a deadline as remaining whole seconds without trusting device state elsewhere. */
export function useCountdown(deadline: number | null): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    setNow(Date.now());
    if (deadline === null) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [deadline]);

  if (deadline === null) return 0;
  return Math.max(0, Math.ceil((deadline - now) / 1000));
}

export function formatCountdown(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}:${String(remainder).padStart(2, '0')}`;
}
