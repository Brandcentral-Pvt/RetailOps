/**
 * The nine interaction states, one component each (design schema §11).
 *
 * Every screen composes from these. A screen that invents its own empty or
 * error treatment breaks the contract, which is why they live here rather than
 * being written per screen.
 */
import React from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { Text } from '../ui/Text';
import { Button } from '../ui/Button';
import { Surface } from '../ui/Surface';
import { Chip } from '../ui/Chip';
import { SkeletonList, Skeleton } from '../ui/Skeleton';
import { ApiError } from '../../services/ApiError';

/* ── 1 · Loading (first) ─────────────────────────────────────────────────── */

export function LoadingFirst({ rows = 6 }: { rows?: number }) {
  const t = useTheme();
  return (
    <View accessibilityLabel="Loading" style={{ gap: t.spacing.scale.lg, padding: t.padding }}>
      <Skeleton width="45%" height={28} radius="md" />
      <View style={{ gap: t.spacing.scale.sm }}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={{ gap: t.spacing.scale.xs }}>
            <Skeleton width="30%" height={12} />
            <Skeleton width="100%" height={44} radius="md" />
          </View>
        ))}
      </View>
      <SkeletonList rows={rows} />
    </View>
  );
}

/* ── 2 · Loading (refresh) ───────────────────────────────────────────────── */

export function LoadingRefresh() {
  const t = useTheme();
  return (
    <View
      accessibilityLabel="Refreshing"
      style={{ height: t.shape.xs as number, backgroundColor: t.c.surfaceContainerHighest as string }}
    >
      <View style={{ flex: 1, height: t.shape.xs as number, backgroundColor: t.c.primary as string, opacity: 0.65 }} />
    </View>
  );
}

/* ── 3 · Empty (true) ────────────────────────────────────────────────────── */

export function EmptyTrue({
  title,
  body,
  ctaLabel,
  onCta,
}: {
  title: string;
  body: string;
  ctaLabel?: string;
  onCta?: () => void;
}) {
  const t = useTheme();
  return (
    <View style={styles.centered}>
      <View
        style={{
          width: 96, height: 96, borderRadius: t.shape.xl as number,
          backgroundColor: t.c.surfaceContainerHigh as string,
          alignItems: 'center', justifyContent: 'center', marginBottom: t.spacing.scale.xl,
        }}
      >
        <Text role="displaySmall" color="onSurfaceVariant">{glyph}</Text>
      </View>
      <Text role="titleMedium" center>{title}</Text>
      <Text role="bodyMedium" color="onSurfaceVariant" center style={{ marginTop: t.spacing.scale.sm, maxWidth: 320 }}>
        {body}
      </Text>
      {ctaLabel && onCta ? (
        <Button label={ctaLabel} onPress={onCta} style={{ marginTop: t.spacing.scale.xl }} />
      ) : null}
    </View>
  );
}

const glyph = '◍';

/* ── 4 · Empty (filtered) ────────────────────────────────────────────────── */

export function EmptyFiltered({ onClear, filterSummary }: { onClear: () => void; filterSummary?: string }) {
  const t = useTheme();
  return (
    <View style={styles.centered}>
      <Text role="displaySmall" color="onSurfaceVariant">⌕</Text>
      <Text role="titleMedium" center style={{ marginTop: t.spacing.scale.md }}>
        No results for these filters
      </Text>
      {filterSummary ? (
        <Text role="bodySmall" color="onSurfaceVariant" center style={{ marginTop: t.spacing.scale.xs }}>
          {filterSummary}
        </Text>
      ) : null}
      <Button label="Clear filters" onPress={onClear} variant="tonal" style={{ marginTop: t.spacing.scale.lg }} />
    </View>
  );
}

/* ── 5 · Error (recoverable) ─────────────────────────────────────────────── */

export function ErrorRecoverable({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const t = useTheme();
  const apiError = error instanceof ApiError ? error : null;
  return (
    <Surface tone="errorContainer" radius="md" style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.scale.md }}>
      <Text role="titleSmall" color="onErrorContainer" style={{ flex: 1 }}>
        {apiError?.message ?? 'Something went wrong loading this section.'}
      </Text>
      <Button label="Retry" onPress={onRetry} variant="text" />
    </Surface>
  );
}

/* ── 6 · Error (fatal / 500) ─────────────────────────────────────────────── */

export function ErrorFatal({ error, onRetry, onGoHome }: { error: unknown; onRetry: () => void; onGoHome: () => void }) {
  const t = useTheme();
  const apiError = error instanceof ApiError ? error : null;
  return (
    <View style={styles.centered}>
      <Text role="displaySmall" color="error">⚠</Text>
      <Text role="titleMedium" center style={{ marginTop: t.spacing.scale.md }}>
        We couldn&apos;t load this
      </Text>
      <Text role="bodyMedium" color="onSurfaceVariant" center style={{ marginTop: t.spacing.scale.sm, maxWidth: 320 }}>
        {apiError?.message ?? 'The server had a problem. Your data is safe.'}
      </Text>
      {apiError?.requestId ? (
        <Text role="bodySmall" color="onSurfaceVariant" center numeric style={{ marginTop: t.spacing.scale.md }}>
          Reference: {apiError.requestId}
        </Text>
      ) : null}
      <View style={{ flexDirection: 'row', gap: t.spacing.scale.sm, marginTop: t.spacing.scale.xl }}>
        <Button label="Go home" onPress={onGoHome} variant="text" />
        <Button label="Retry" onPress={onRetry} />
      </View>
    </View>
  );
}

/* ── 7 · No permission (403) ─────────────────────────────────────────────── */

export function NoAccess({ module }: { module: string }) {
  const t = useTheme();
  return (
    <View style={styles.centered}>
      <Text role="displaySmall" color="onSurfaceVariant">⛔</Text>
      <Text role="titleMedium" center style={{ marginTop: t.spacing.scale.md }}>
        You don&apos;t have access to {module}
      </Text>
      <Text role="bodyMedium" color="onSurfaceVariant" center style={{ marginTop: t.spacing.scale.sm, maxWidth: 320 }}>
        Ask an admin to grant you permission, then try again.
      </Text>
    </View>
  );
}

/* ── 8 · Offline / degraded ──────────────────────────────────────────────── */

export function OfflineBanner({ isOffline, isDegraded }: { isOffline: boolean; isDegraded?: boolean }) {
  const t = useTheme();
  if (!isOffline && !isDegraded) return null;
  const label = isOffline ? "You're offline — showing saved data" : 'Some data may be out of date';
  return (
    <View
      accessibilityRole="alert"
      style={{
        backgroundColor: t.c.tertiaryContainer as string,
        paddingVertical: t.spacing.scale.sm,
        paddingHorizontal: t.padding,
        flexDirection: 'row',
        alignItems: 'center',
        gap: t.spacing.scale.sm,
      }}
    >
      <Text role="labelMedium" color="onTertiaryContainer">{isOffline ? '⚠' : '△'}</Text>
      <Text role="labelMedium" color="onTertiaryContainer" style={{ flex: 1 }}>{label}</Text>
    </View>
  );
}

/* ── 9 · Partial / stale data ────────────────────────────────────────────── */

export function StaleSection({
  label,
  onRetry,
}: {
  label?: string;
  onRetry?: () => void;
}) {
  const t = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row', alignItems: 'center', gap: t.spacing.scale.sm,
        paddingVertical: t.spacing.scale.xs,
      }}
    >
      <Chip label={label ?? 'Partial data'} tone="warning" icon="△" />
      {onRetry ? <Button label="Retry" onPress={onRetry} variant="text" /> : null}
    </View>
  );
}

/* ── Additional states (§11) ─────────────────────────────────────────────── */

export function ConflictBanner({ onReload }: { onReload: () => void }) {
  const t = useTheme();
  return (
    <Surface tone="errorContainer" style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.scale.md }}>
      <Text role="bodyMedium" color="onErrorContainer" style={{ flex: 1 }}>
        This changed somewhere else. Reload to see the latest version.
      </Text>
      <Button label="Reload" onPress={onReload} variant="text" />
    </Surface>
  );
}

export function RateLimited({ retryInSeconds, onRetry }: { retryInSeconds: number; onRetry: () => void }) {
  const t = useTheme();
  return (
    <View style={styles.centered}>
      <ActivityIndicator color={t.c.primary as string} />
      <Text role="bodyMedium" color="onSurfaceVariant" center style={{ marginTop: t.spacing.scale.md }}>
        Too many requests. Try again in {retryInSeconds}s.
      </Text>
      <Button label="Retry now" onPress={onRetry} variant="text" style={{ marginTop: t.spacing.scale.md }} />
    </View>
  );
}

export function BulkProgress({ done, total }: { done: number; total: number }) {
  const t = useTheme();
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  return (
    <View style={{ gap: t.spacing.scale.xs, paddingHorizontal: t.padding }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text role="labelMedium" color="onSurfaceVariant" numeric>Updating {done} of {total}</Text>
        <Text role="labelMedium" color="onSurfaceVariant" numeric>{pct}%</Text>
      </View>
      <View style={{ height: t.shape.xs as number, backgroundColor: t.c.surfaceContainerHighest as string, borderRadius: t.shape.full as number, overflow: 'hidden' }}>
        <View style={{ width: `${pct}%`, height: '100%', backgroundColor: t.c.primary as string }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
});
