import React from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { Text } from './Text';

export type Variant = 'filled' | 'tonal' | 'outlined' | 'text' | 'danger';

type Props = {
  label: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
  /** Announced by screen readers when the label alone is ambiguous. */
  accessibilityHint?: string;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function Button({
  label,
  onPress,
  variant = 'filled',
  disabled = false,
  loading = false,
  accessibilityHint,
  fullWidth = false,
  style,
}: Props) {
  const t = useTheme();
  const inert = disabled || loading;

  const palette = (() => {
    switch (variant) {
      case 'filled':
        return { bg: t.c.primary, fg: t.c.onPrimary, border: 'transparent' };
      case 'tonal':
        return { bg: t.c.secondaryContainer, fg: t.c.onSecondaryContainer, border: 'transparent' };
      case 'outlined':
        return { bg: 'transparent', fg: t.c.primary, border: t.c.outline };
      case 'danger':
        return { bg: t.c.error, fg: t.c.onError, border: 'transparent' };
      case 'text':
      default:
        return { bg: 'transparent', fg: t.c.primary, border: 'transparent' };
    }
  })();

  return (
    <Pressable
      onPress={onPress}
      disabled={inert}
      accessibilityRole="button"
      accessibilityLabel={label}
      {...(accessibilityHint ? { accessibilityHint } : {})}
      accessibilityState={{ disabled: inert, busy: loading }}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: palette.bg as string,
          borderColor: palette.border as string,
          borderWidth: variant === 'outlined' ? StyleSheet.hairlineWidth : 0,
          borderRadius: t.shape.full as number,
          paddingVertical: t.spacing.scale.md,
          paddingHorizontal: t.spacing.scale.xl,
          opacity: inert ? 0.38 : pressed ? 0.82 : 1,
          alignSelf: fullWidth ? 'stretch' : 'flex-start',
        },
        style,
      ]}
    >
      {loading ? (
        <View style={[styles.spinner, { borderColor: (palette.fg as string) + '55', borderTopColor: palette.fg as string }]} />
      ) : null}
      <Text role="labelLarge" color="onPrimary" style={{ color: palette.fg as string }}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 44 },
  spinner: { width: 16, height: 16, borderRadius: 8, borderWidth: 2 },
});
