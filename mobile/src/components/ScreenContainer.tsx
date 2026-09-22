/** Standard screen scaffold: safe-area aware, themed background, optional scroll. */
import React from 'react';
import { ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from 'react-native-paper';
import { SPACING } from '../theme/theme';

interface Props {
  children: React.ReactNode;
  scroll?: boolean;
  padded?: boolean;
  style?: ViewStyle;
}

export default function ScreenContainer({ children, scroll = false, padded = true, style }: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const contentStyle = [
    styles.content,
    padded && { padding: SPACING.md },
    { paddingBottom: insets.bottom + SPACING.md },
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