/** Standard screen scaffold: safe-area aware, themed background, optional scroll. */
import React from 'react';
import { ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from 'react-native-paper';
import { SPACING } from '../theme/theme';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';

interface Props {
  children: React.ReactNode;
  scroll?: boolean;
  padded?: boolean;
  style?: ViewStyle;
}

export default function ScreenContainer({ children, scroll = false, padded = true, style }: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { contentGutter } = useResponsiveLayout();
  const contentStyle = [
    styles.content,
    padded && {
      paddingTop: insets.top + SPACING.lg,
      paddingLeft: Math.max(insets.left, contentGutter),
      paddingRight: Math.max(insets.right, contentGutter),
      paddingBottom: insets.bottom + SPACING.xl,
    },
    !padded && {
      paddingTop: insets.top,
      paddingLeft: insets.left,
      paddingRight: insets.right,
      paddingBottom: insets.bottom,
    },
    style,
  ];

  if (scroll) {
    return (
      <ScrollView
        style={[styles.flex, { backgroundColor: colors.background }]}
        contentContainerStyle={contentStyle}
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </ScrollView>
    );
  }

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }, contentStyle]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { flexGrow: 1 },
});