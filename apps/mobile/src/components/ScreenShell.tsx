/**
 * ScreenShell — the frame every screen renders inside.
 *
 * It owns the app bar, the permission gate, the offline banner and the nine
 * states. A screen supplies only its content, and only when `state` is ready.
 * Because the gate and the states live here, they cannot be forgotten.
 */
import React from 'react';
import { View, StyleSheet, Pressable, useWindowDimensions, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeProvider';
import { Text } from './ui/Text';
import { Button } from './ui/Button';
import { Chip } from './ui/Chip';
import { PermissionGate } from '../auth/PermissionGate';
import { useSession } from '../auth/useCan';
import {
  LoadingFirst,
  LoadingRefresh,
  ErrorFatal,
  ErrorRecoverable,
  NoAccess,
  OfflineBanner,
  EmptyTrue,
} from './states';
import type { ScreenMeta, ScreenStatus } from '../nav/types';

type Props = {
  meta: ScreenMeta;
  state: ScreenStatus;
  error?: unknown;
  refreshing?: boolean;
  isOffline?: boolean;
  onRetry: () => void;
  onBack?: () => void;
  onGoHome?: () => void;
  /** Rendered when the screen has no data source wired yet. */
  children: (data: never) => React.ReactNode;
};

export function ScreenShell({
  meta,
  state,
  error,
  refreshing = false,
  isOffline = false,
  onRetry,
  onBack,
  onGoHome,
  children,
}: Props) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const session = useSession();

  return (
    <View style={{ flex: 1, backgroundColor: t.c.pageBackground as string }}>
      <OfflineBanner isOffline={isOffline} />

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: t.spacing.scale.sm,
          paddingTop: insets.top + t.spacing.scale.sm,
          paddingHorizontal: t.padding,
          paddingBottom: t.spacing.scale.md,
          minHeight: 56,
        }}
      >
        {onBack ? (
          <Pressable onPress={onBack} accessibilityRole="button" accessibilityLabel="Go back" hitSlop={12}>
            <Text role="titleLarge" color="onSurface">←</Text>
          </Pressable>
        ) : null}
        <View style={{ flex: 1 }}>
          <Text role="headlineSmall" numberOfLines={1}>{meta.name}</Text>
        </View>
        {meta.critical ? <Chip label="Critical" tone="info" icon="★" /> : null}
        {session?.scope === 'self' ? <Chip label="Own account" tone="neutral" /> : null}
      </View>

      {refreshing ? <LoadingRefresh /> : null}

      <PermissionGate surface={meta.surface} permission={meta.permission} roleKeys={meta.roleKeys} module={meta.name}>
        <View style={{ flex: 1 }}>
          {state.kind === 'loading-first' ? <LoadingFirst /> : null}

          {state.kind === 'error' && state.fatal ? (
            <ErrorFatal error={error ?? state.error} onRetry={onRetry} onGoHome={onGoHome ?? (() => {})} />
          ) : null}

          {state.kind === 'error' && !state.fatal ? (
            <View style={{ padding: t.padding }}>
              <ErrorRecoverable error={error ?? state.error} onRetry={onRetry} />
            </View>
          ) : null}

          {state.kind === 'empty-true' ? (
            <EmptyTrue
              title={`Nothing here yet`}
              body={`${meta.name} has no data for this account yet. New items will appear as the nightly sync runs.`}
            />
          ) : null}

          {state.kind === 'ready' ? (
            width >= 600 ? (
              <ScrollView contentContainerStyle={styles.wide}>{children(state.data as never)}</ScrollView>
            ) : (
              children(state.data as never)
            )
          ) : null}
        </View>
      </PermissionGate>
    </View>
  );
}

const styles = StyleSheet.create({
  wide: { maxWidth: 720, alignSelf: 'center', width: '100%' },
});

export { NoAccess, Button };
