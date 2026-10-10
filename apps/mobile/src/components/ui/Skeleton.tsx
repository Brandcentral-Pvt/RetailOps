import React, { useEffect, useRef } from 'react';
import { Animated, View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { useReducedMotion } from '../../hooks/useReducedMotion';

/**
 * Skeleton — state 1 (loading, first).
 *
 * Contract rule: a skeleton must MIRROR the final layout. A generic shimmer
 * block where content will be is not acceptable, and a bare spinner for content
 * is explicitly banned by the design schema §11.
 */
export function Skeleton({
  width = '100%',
  height,
  radius = 'sm',
  style,
}: {
  width?: number | `${number}%`;
  height: number;
  radius?: 'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'full';
  style?: StyleProp<ViewStyle>;
}) {
  const t = useTheme();
  const reduced = useReducedMotion();
  const pulse = useRef(new Animated.Value(0.5)).current;
  const duration = t.motion.duration.medium2;

  useEffect(() => {
    // Reduced motion: hold a static placeholder. Do not animate.
    if (reduced) {
      pulse.setValue(0.55);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.5, duration, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, duration, reduced]);

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        {
          width: width as ViewStyle['width'],
          height,
          borderRadius: t.shape[radius] as number,
          backgroundColor: t.c.surfaceContainerHigh as string,
          opacity: pulse,
        },
        style,
      ]}
    />
  );
}

/** A list-row skeleton that matches listRow.twoLine from the spacing tokens. */
export function SkeletonList({ rows = 5, twoLine = true }: { rows?: number; twoLine?: boolean }) {
  const t = useTheme();
  const rowHeight = twoLine ? t.spacing.listRow.twoLine : t.spacing.listRow.oneLine;
  return (
    <View style={{ gap: t.spacing.scale.sm }} accessibilityLabel="Loading content">
      {Array.from({ length: rows }).map((_, i) => (
        <View key={i} style={[styles.row, { height: rowHeight, gap: t.spacing.scale.md }]}>
          <Skeleton width={40} height={40} radius="full" />
          <View style={{ flex: 1, gap: t.spacing.scale.xs }}>
            <Skeleton width="70%" height={14} />
            {twoLine ? <Skeleton width="45%" height={12} /> : null}
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
});
