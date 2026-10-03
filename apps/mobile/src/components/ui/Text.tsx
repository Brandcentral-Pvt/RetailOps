/**
 * Text — the only sanctioned way to render a string with a type role.
 *
 * There is deliberately no "custom size" escape hatch: every value comes from
 * the token scale, so the type ramp cannot drift between screens.
 */
import React from 'react';
import { Text as RNText, StyleSheet, type StyleProp, type TextStyle } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';

export type TypeRole =
  | 'displayLarge' | 'displayMedium' | 'displaySmall'
  | 'headlineLarge' | 'headlineMedium' | 'headlineSmall'
  | 'titleLarge' | 'titleMedium' | 'titleSmall'
  | 'bodyLarge' | 'bodyMedium' | 'bodySmall'
  | 'labelLarge' | 'labelMedium' | 'labelSmall';

export type ColorRole =
  | 'onSurface' | 'onSurfaceVariant' | 'onSurfaceSubtle'
  | 'primary' | 'onPrimary' | 'primaryContainer' | 'onPrimaryContainer'
  | 'secondary' | 'onSecondary' | 'secondaryContainer' | 'onSecondaryContainer'
  | 'tertiary' | 'onTertiary' | 'tertiaryContainer' | 'onTertiaryContainer'
  | 'error' | 'onError' | 'errorContainer' | 'onErrorContainer'
  | 'outline' | 'outlineVariant' | 'scrim'
  | 'surface' | 'surfaceContainerLowest' | 'surfaceContainerLow' | 'surfaceContainer'
  | 'surfaceContainerHigh' | 'surfaceContainerHighest' | 'pageBackground'
  | 'inverseSurface' | 'inverseOnSurface' | 'inversePrimary' | 'surfaceTint';

type Props = {
  children: React.ReactNode;
  role?: TypeRole;
  color?: ColorRole;
  /** Metric roles use tabular figures so money aligns in a column. */
  numeric?: boolean;
  center?: boolean;
  numberOfLines?: number;
  style?: StyleProp<TextStyle>;
  accessibilityRole?: 'header' | 'text' | 'link' | 'summary';
};

export function Text({
  children,
  role = 'bodyMedium',
  color = 'onSurface',
  numeric = false,
  center = false,
  numberOfLines,
  style,
  accessibilityRole,
}: Props) {
  const t = useTheme();
  const spec = t.type.scale[role];
  const fg = t.c[color];

  return (
    <RNText
      numberOfLines={numberOfLines}
      accessibilityRole={accessibilityRole}
      style={[
        {
          fontSize: spec.size,
          lineHeight: spec.lineHeight,
          fontWeight: String(spec.weight) as TextStyle['fontWeight'],
          letterSpacing: spec.tracking,
          color: fg,
          textAlign: center ? 'center' : 'left',
        },
        numeric && styles.numeric,
        style,
      ]}
    >
      {children}
    </RNText>
  );
}

const styles = StyleSheet.create({
  numeric: { fontVariant: ['tabular-nums'] },
});
