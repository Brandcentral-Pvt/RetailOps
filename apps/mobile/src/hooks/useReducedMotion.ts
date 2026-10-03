import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * Contract rule (tokens → motion.rules.reduceMotion): when the OS asks for
 * reduced motion, disable shimmer and replace transitions with short opacity
 * cross-fades. Screens must honour this.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let alive = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((v) => {
      if (alive) setReduced(v);
    });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', (v) => setReduced(v));
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);
  return reduced;
}
