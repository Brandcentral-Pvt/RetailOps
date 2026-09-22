/**
 * Temporary screen shown for modules that are not yet implemented on mobile.
 * Supports both direct prop usage (embedded) and navigation `initialParams`
 * (used by Drawer.Screen registrations via route.params).
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Icon, Text, useTheme } from 'react-native-paper';
import ScreenContainer from './ScreenContainer';
import { SPACING } from '../theme/theme';

interface Props {
  title?: string;
  description?: string;
  icon?: string;
  route?: { params?: { title?: string; description?: string; icon?: string } };
}

export default function PlaceholderScreen({ title, description, icon, route }: Props) {
  const { colors } = useTheme();
  const params = route?.params;
  const resolvedTitle = params?.title ?? title ?? 'Coming soon';
  const resolvedIcon = params?.icon ?? icon ?? 'hammer-wrench';
  return (
    <ScreenContainer>
      <View style={styles.center}>
        <Icon source={resolvedIcon} size={64} color={colors.onSurfaceVariant} />
        <Text variant="titleLarge" style={styles.title}>
          {resolvedTitle}
        </Text>
        <Text variant="bodyMedium" style={[styles.desc, { color: colors.onSurfaceVariant }]}>
          {params?.description ?? description ?? 'This module is being ported to Android.'}
        </Text>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: SPACING.xxl * 2 },
  title: { marginTop: SPACING.md, fontWeight: '600' },
  desc: { marginTop: SPACING.sm, textAlign: 'center', paddingHorizontal: SPACING.lg },
});