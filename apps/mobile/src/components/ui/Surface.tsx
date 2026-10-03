/**
 * Surface — the card primitive. Elevation and radius come from tokens only.
 */
import React from 'react';
import { View, StyleSheet, type StyleProp, type ViewStyle, type ViewProps } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';

type Tone = 'surface' | 'surfaceContainerLow' | 'surfaceContainer' | 'surfaceContainerHigh' | 'inverseSurface' | 'primaryContainer' | 'errorContainer';

type Props = ViewProps & {
  tone?: Tone;
  radius?: keyof ReturnType<typeof useTheme>['shape'];
  padding?: number;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
};

export function Surface({ tone = 'surfaceContainerLow', radius = 'md', padding, style, children, ...rest }: Props) {
  const t = useTheme();
  return (
    <View
      {...rest}
      style={[
        {
          backgroundColor: (t.c[tone] ?? t.c.surfaceContainerLow) as string,
          borderRadius: t.shape[radius] as number,
          padding: padding ?? t.spacing.scale.md,
        },
        tone === 'surface' && styles.hairline,
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  hairline: { borderWidth: StyleSheet.hairlineWidth },
});
