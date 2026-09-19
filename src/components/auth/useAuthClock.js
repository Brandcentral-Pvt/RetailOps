import { useEffect, useState } from 'react';

// Use deadlines, not decremented counters: background tabs and device sleep
// must not extend a code's lifetime or the resend cooldown.
export default function useAuthClock() {
  const [now, setNow] = useState(Date.now);

  useEffect(() => {
    const update = () => setNow(Date.now());
    const interval = window.setInterval(update, 1000);
    document.addEventListener('visibilitychange', update);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', update);
    };
  }, []);

  return now;
}

export function secondsRemaining(deadline, now) {
  return Math.max(0, Math.ceil((deadline - now) / 1000));
}

export function formatCountdown(seconds) {
  return `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
}
