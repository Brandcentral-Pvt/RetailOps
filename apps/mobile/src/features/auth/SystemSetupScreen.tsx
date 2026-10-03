import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuthStore } from '../../auth/authStore';
import { sessionSatisfies } from '../../auth/permissions';
import { authErrorFor, type AuthError } from '../../auth/authErrors';
import { getSystemSchedule, saveSystemSetup } from '../../services/authService';
import { Button } from '../../components/ui/Button';
import { Surface } from '../../components/ui/Surface';
import { Text } from '../../components/ui/Text';
import { useTheme } from '../../theme/ThemeProvider';
import { AuthLayout } from './AuthLayout';
import { AuthMessage } from './AuthMessage';

type Marketplace = 'amazon' | 'ajio';

/** AUTH-09 — capability-gated system configuration using real scheduler settings. */
export function SystemSetupScreen() {
  const t = useTheme();
  const navigation = useNavigation();
  const session = useAuthStore((state) => state.session);
  const canManageSettings = sessionSatisfies(session, 'settings_manage');
  const [selected, setSelected] = useState<Record<Marketplace, boolean>>({ amazon: false, ajio: false });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<AuthError | null>(null);

  const load = useCallback(async () => {
    if (!canManageSettings) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const config = await getSystemSchedule();
      setSelected({
        amazon: Boolean(config.amazonAutomationEnabled),
        ajio: Boolean(config.ajioAutomationEnabled),
      });
    } catch (caught) {
      setError(authErrorFor(caught, 'password'));
    } finally {
      setLoading(false);
    }
  }, [canManageSettings]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      await saveSystemSetup({
        AUTOMATION_AMAZON_ENABLED: selected.amazon,
        AUTOMATION_AJIO_ENABLED: selected.ajio,
      });
      navigation.goBack();
    } catch (caught) {
      setError(authErrorFor(caught, 'password'));
    } finally {
      setSaving(false);
    }
  };

  if (!canManageSettings) {
    return (
      <AuthLayout title="System setup" subtitle="This setup area is only available to authorised administrators.">
        <Button label="Back" onPress={() => navigation.goBack()} fullWidth />
      </AuthLayout>
    );
  }

  const marketplace = (id: Marketplace, title: string, description: string) => (
    <Pressable
      key={id}
      onPress={() => setSelected((current) => ({ ...current, [id]: !current[id] }))}
      disabled={loading || saving}
      accessibilityRole="checkbox"
      accessibilityLabel={`${title} marketplace`}
      accessibilityState={{ checked: selected[id], disabled: loading || saving }}
      style={{ minHeight: t.component.button.touchTarget }}
    >
      <Surface tone="surface" radius="md" style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.scale.md }}>
        <View
          style={{
            width: t.spacing.scale.lg,
            height: t.spacing.scale.lg,
            borderRadius: t.shape.xs as number,
            borderWidth: selected[id] ? 0 : StyleSheet.hairlineWidth,
            borderColor: t.c.outline as string,
            backgroundColor: selected[id] ? t.c.primary as string : t.c.surface as string,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {selected[id] ? <Text role="labelSmall" color="onPrimary">✓</Text> : null}
        </View>
        <View style={{ flex: 1, gap: t.spacing.scale.xxs }}>
          <Text role="titleSmall">{title}</Text>
          <Text role="bodySmall" color="onSurfaceVariant">{description}</Text>
        </View>
      </Surface>
    </Pressable>
  );

  return (
    <AuthLayout title="Connect your marketplaces" subtitle="Step 2 of 4 · Choose the marketplace pipelines RetailOps should schedule.">
      <View style={{ gap: t.spacing.scale.lg }}>
        <View accessibilityLabel="Setup progress: Organisation complete, Marketplaces active, Team and Data sync remaining" style={{ flexDirection: 'row', gap: t.spacing.scale.xs }}>
          {['Organisation', 'Marketplaces', 'Team', 'Data sync'].map((label, index) => {
            const complete = index === 0;
            const active = index === 1;
            return (
              <View key={label} style={{ flex: 1, gap: t.spacing.scale.xxs, alignItems: 'center' }}>
                <View style={{ width: t.spacing.scale.lg, height: t.spacing.scale.lg, borderRadius: t.shape.full as number, alignItems: 'center', justifyContent: 'center', backgroundColor: complete || active ? t.c.primary as string : t.c.outlineVariant as string }}>
                  <Text role="labelSmall" color={complete || active ? 'onPrimary' : 'onSurfaceVariant'}>{complete ? '✓' : String(index + 1)}</Text>
                </View>
                <Text role="labelSmall" color={active ? 'primary' : 'onSurfaceVariant'} center>{label}</Text>
              </View>
            );
          })}
        </View>
        {error ? <AuthMessage message={error.message} /> : null}
        {loading ? <Text role="bodyMedium" color="onSurfaceVariant" center>Loading current configuration…</Text> : null}
        <View style={{ gap: t.spacing.scale.sm }}>
          {marketplace('amazon', 'Amazon India', 'Enable the scheduled Amazon marketplace pipeline.')}
          {marketplace('ajio', 'Ajio', 'Enable the scheduled Ajio marketplace pipeline.')}
          <Surface tone="surfaceContainerLow" radius="md" style={{ gap: t.spacing.scale.xs }}>
            <Text role="titleSmall" color="onSurfaceVariant">Flipkart</Text>
            <Text role="bodySmall" color="onSurfaceVariant">Not configured on this RetailOps server yet.</Text>
          </Surface>
        </View>
        <Surface tone="surfaceContainerLow" radius="md" style={{ gap: t.spacing.scale.sm }}>
          <Text role="titleSmall">Sync schedule</Text>
          <Text role="bodyMedium" color="onSurfaceVariant">Daily scheduling is currently supported by the server. Schedule time is managed in System Settings.</Text>
          <View accessibilityRole="tablist" accessibilityLabel="Sync schedule, Daily selected" style={{ flexDirection: 'row', gap: t.spacing.scale.xs }}>
            {['Hourly', 'Daily', 'Manual'].map((option) => {
              const selectedSchedule = option === 'Daily';
              return (
                <View
                  key={option}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: selectedSchedule, disabled: !selectedSchedule }}
                  style={{ flex: 1, minHeight: t.component.button.touchTarget, alignItems: 'center', justifyContent: 'center', borderRadius: t.shape.full as number, backgroundColor: selectedSchedule ? t.c.primary as string : t.c.surface as string }}
                >
                  <Text role="labelMedium" color={selectedSchedule ? 'onPrimary' : 'onSurfaceVariant'}>{option}</Text>
                </View>
              );
            })}
          </View>
        </Surface>
        <Button label={saving ? 'Saving configuration…' : 'Continue'} onPress={() => void save()} loading={saving} disabled={loading} fullWidth />
        <Button label="Back" onPress={() => navigation.goBack()} variant="text" disabled={saving} fullWidth />
      </View>
    </AuthLayout>
  );
}
