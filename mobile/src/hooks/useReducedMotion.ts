import { useEffect, useState } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';

export function useReducedMotion() {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    let mounted = true;

    const updatePreference = () => {
      if (Platform.OS === 'web') {
        setReducedMotion(false);
        return;
      }

      AccessibilityInfo.isReduceMotionEnabled()?.then((enabled) => {
        if (mounted) setReducedMotion(Boolean(enabled));
      }).catch(() => {
        if (mounted) setReducedMotion(false);
      });
    };

    updatePreference();
    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      updatePreference,
    );

    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  return reducedMotion;
}
