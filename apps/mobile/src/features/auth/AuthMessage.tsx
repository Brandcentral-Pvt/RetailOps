import React from 'react';
import { View } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { Text } from '../../components/ui/Text';

type Props = {
  message: string;
  tone?: 'error' | 'info' | 'success';
};

export function AuthMessage({ message, tone = 'error' }: Props) {
  const t = useTheme();
  const palette = tone === 'error'
    ? { background: t.c.errorContainer, foreground: t.c.onErrorContainer, marker: '!' }
    : tone === 'success'
      ? { background: t.c.tertiaryContainer, foreground: t.c.onTertiaryContainer, marker: '✓' }
      : { background: t.c.secondaryContainer, foreground: t.c.onSecondaryContainer, marker: 'i' };

  return (
    <View
      accessibilityRole="alert"
      style={{
        flexDirection: 'row',
        gap: t.spacing.scale.sm,
        alignItems: 'flex-start',
        backgroundColor: palette.background as string,
        borderRadius: t.shape.md as number,
        padding: t.spacing.scale.md,
      }}
    >
      <Text role="labelLarge" color="onSurface" style={{ color: palette.foreground as string }}>{palette.marker}</Text>
      <Text role="bodyMedium" color="onSurface" style={{ color: palette.foreground as string, flex: 1 }}>{message}</Text>
    </View>
  );
}
