import React from 'react';
import { View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { Text } from './Text';

export type ChipTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'brand';

type StatusToken = {
  fg: string;
  bg: string;
  border: string;
  icon: string;
  darkFg: string;
  darkBg: string;
  darkBorder: string;
};

type Props = {
  label: string;
  tone?: ChipTone;
  /** Overrides the token's icon. Omit to use the token's own. */
  icon?: string;
  style?: StyleProp<ViewStyle>;
};

/**
 * Chip carries status, freshness and scope.
 *
 * Contract: status is ALWAYS colour + icon + word. Colour alone is a WCAG 1.4.1
 * failure and is rejected by the consistency contract.
 */
export function Chip({ label, tone = 'neutral', icon, style }: Props) {
  const t = useTheme();
  const status = t.domain.status as unknown as Record<string, StatusToken | undefined>;
  // `noUncheckedIndexedAccess` means every lookup is T | undefined. The token
  // file defines `neutral`, so this fallback is unreachable in practice — but
  // assert it rather than shipping a possibly-undefined token.
  const token: StatusToken = status[tone] ?? status.neutral ?? status.success!;
  const dark = t.scheme === 'dark';
  const fg = dark ? token.darkFg : token.fg;
  const bg = dark ? token.darkBg : token.bg;
  const bd = dark ? token.darkBorder : token.border;

  return (
    <View
      accessible
      accessibilityLabel={label}
      style={[
        styles.chip,
        {
          backgroundColor: bg,
          borderColor: bd,
          borderWidth: StyleSheet.hairlineWidth,
          borderRadius: t.shape.full as number,
          paddingHorizontal: t.spacing.scale.sm,
          paddingVertical: t.spacing.scale.xs,
        },
        style,
      ]}
    >
      <Text role="labelSmall" color="onSurfaceVariant" style={{ color: fg }}>
        {icon ?? iconFor(token.icon)}
      </Text>
      <Text role="labelMedium" color="onSurfaceVariant" style={{ color: fg }}>
        {label}
      </Text>
    </View>
  );
}

/**
 * Material Symbols are not yet wired (see component library, P-10). Until they
 * are, status markers use a short text glyph so the state is still conveyed
 * when colour is not perceivable. Replace with the real font in Wave 1.
 */
function iconFor(tokenIcon: string): string {
  switch (tokenIcon) {
    case 'checkmark-circle': return '✓';
    case 'warning': return '!';
    case 'error-circle': return '×';
    case 'info': return 'i';
    case 'cloud-off': return '⚠';
    case 'history': return '↻';
    case 'sync': return '⟳';
    case 'alert': return '△';
    default: return '•';
  }
}

const styles = StyleSheet.create({
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start' },
});
