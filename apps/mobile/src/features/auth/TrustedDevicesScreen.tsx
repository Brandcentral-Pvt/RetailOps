import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { authErrorFor, type AuthError } from '../../auth/authErrors';
import { getTrustedDevices, revokeOtherTrustedDevices, revokeTrustedDevice, type TrustedDevice } from '../../services/authService';
import { Button } from '../../components/ui/Button';
import { Chip } from '../../components/ui/Chip';
import { Surface } from '../../components/ui/Surface';
import { Text } from '../../components/ui/Text';
import { useTheme } from '../../theme/ThemeProvider';
import { AuthLayout } from './AuthLayout';
import { AuthMessage } from './AuthMessage';

function displayDate(value: string | null): string {
  if (!value) return 'Last active time unavailable';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Last active time unavailable';
  return `Last active ${new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(date)}`;
}

/** AUTH-08 — current-server trusted device list, with revocation controls. */
export function TrustedDevicesScreen() {
  const t = useTheme();
  const navigation = useNavigation();
  const [devices, setDevices] = useState<TrustedDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<AuthError | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setDevices(await getTrustedDevices());
    } catch (caught) {
      setError(authErrorFor(caught, 'password'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const removeOne = (device: TrustedDevice) => {
    Alert.alert(
      'Remove trusted device?',
      `${device.name} will need a verification code the next time it signs in.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setBusyId(device.id);
              setError(null);
              try {
                await revokeTrustedDevice(device.id);
                setDevices((current) => current.filter((item) => item.id !== device.id));
              } catch (caught) {
                setError(authErrorFor(caught, 'password'));
              } finally {
                setBusyId(null);
              }
            })();
          },
        },
      ],
    );
  };

  const removeOthers = () => {
    Alert.alert(
      'Remove all other devices?',
      'Other devices will need a verification code next time they sign in.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove others',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setBusyId('others');
              setError(null);
              try {
                await revokeOtherTrustedDevices();
                setDevices((current) => current.filter((item) => item.isCurrent));
              } catch (caught) {
                setError(authErrorFor(caught, 'password'));
              } finally {
                setBusyId(null);
              }
            })();
          },
        },
      ],
    );
  };

  const hasCurrentDevice = devices.some((device) => device.isCurrent);

  return (
    <AuthLayout title="Trusted devices" subtitle="Devices that can sign in without a verification code.">
      <View style={{ gap: t.spacing.scale.lg }}>
        {error ? <AuthMessage message={error.message} /> : null}
        {!loading && devices.length > 0 && !hasCurrentDevice ? <AuthMessage tone="info" message="This installation could not be matched to a trusted-device record. You can still remove a device individually." /> : null}
        {loading ? <Text role="bodyMedium" color="onSurfaceVariant" center>Loading trusted devices…</Text> : null}
        {!loading && devices.length === 0 ? (
          <Surface tone="surfaceContainerLow" radius="md" style={{ gap: t.spacing.scale.sm }}>
            <Text role="titleSmall">No trusted devices</Text>
            <Text role="bodyMedium" color="onSurfaceVariant">When you choose to trust a device after verification, it will appear here for 12 hours.</Text>
          </Surface>
        ) : null}
        {devices.map((device) => (
          <Surface key={device.id} tone="surface" radius="md" style={{ gap: t.spacing.scale.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: t.spacing.scale.md }}>
              <View style={{ flex: 1, gap: t.spacing.scale.xxs }}>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: t.spacing.scale.sm }}>
                  <Text role="titleSmall">{device.name}</Text>
                  {device.isCurrent ? <Chip label="This device" tone="success" /> : null}
                </View>
                <Text role="bodySmall" color="onSurfaceVariant">{displayDate(device.lastUsedAt)}</Text>
                <Text role="bodySmall" color="onSurfaceVariant">{device.ipAddress ? `Last known network: ${device.ipAddress}` : 'Location unavailable'}</Text>
              </View>
              {!device.isCurrent ? (
                <Pressable
                  onPress={() => removeOne(device)}
                  disabled={busyId !== null}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${device.name}`}
                  accessibilityState={{ disabled: busyId !== null, busy: busyId === device.id }}
                  style={{ minHeight: t.component.button.touchTarget, justifyContent: 'center' }}
                >
                  <Text role="labelLarge" color="error">{busyId === device.id ? 'Removing…' : 'Remove'}</Text>
                </Pressable>
              ) : null}
            </View>
          </Surface>
        ))}
        <Button
          label={busyId === 'others' ? 'Removing other devices…' : 'Remove all other devices'}
          onPress={removeOthers}
          variant="danger"
          disabled={busyId !== null || !hasCurrentDevice || !devices.some((device) => !device.isCurrent)}
          fullWidth
        />
        <Button
          label="Biometric unlock"
          onPress={() => navigation.navigate('BiometricUnlock' as never)}
          variant="outlined"
          disabled={busyId !== null}
          fullWidth
        />
        <Button label="Back" onPress={() => navigation.goBack()} variant="text" fullWidth />
      </View>
    </AuthLayout>
  );
}
