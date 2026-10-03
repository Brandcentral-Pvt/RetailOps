import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuthStore } from '../../auth/authStore';
import { biometricAvailable, biometricEnabled, requestBiometricUnlock, setBiometricEnabled } from '../../auth/biometricService';
import { Button } from '../../components/ui/Button';
import { Surface } from '../../components/ui/Surface';
import { Text } from '../../components/ui/Text';
import { useTheme } from '../../theme/ThemeProvider';
import { AuthLayout } from './AuthLayout';
import { AuthMessage } from './AuthMessage';

/** AUTH-11 — optional local device lock, always with password fallback. */
export function BiometricUnlockScreen() {
  const t = useTheme();
  const navigation = useNavigation();
  const required = useAuthStore((state) => state.biometricRequired);
  const unlock = useAuthStore((state) => state.unlockWithBiometrics);
  const usePasswordInstead = useAuthStore((state) => state.usePasswordInstead);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    void Promise.all([biometricAvailable(), biometricEnabled()]).then(([canUse, preference]) => {
      if (!live) return;
      setAvailable(canUse);
      setEnabled(canUse && preference);
    });
    return () => { live = false; };
  }, []);

  const unlockNow = async () => {
    setBusy(true);
    setMessage(null);
    const success = required ? await unlock() : await requestBiometricUnlock();
    if (!success) setMessage('We could not verify device security. Try again or use your password instead.');
    setBusy(false);
  };

  const togglePreference = async () => {
    if (!available || busy) return;
    if (enabled) {
      await setBiometricEnabled(false);
      setEnabled(false);
      setMessage('Biometric unlock is turned off for future launches.');
      return;
    }
    setBusy(true);
    setMessage(null);
    const verified = await requestBiometricUnlock();
    if (verified) {
      await setBiometricEnabled(true);
      setEnabled(true);
      setMessage('Biometric unlock is enabled for future launches.');
    } else {
      setMessage('We could not enable biometric unlock on this device.');
    }
    setBusy(false);
  };

  const title = required ? 'Unlock RetailOps' : 'Biometric unlock';
  const subtitle = required
    ? 'Use your device security to continue to your saved workspace.'
    : 'Use your device security before restoring a saved RetailOps session.';

  return (
    <AuthLayout title={title} subtitle={subtitle}>
      <View style={{ gap: t.spacing.scale.xl }}>
        <Surface
          tone="primaryContainer"
          radius="full"
          style={{
            alignSelf: 'center',
            width: t.component.avatar.xl,
            height: t.component.avatar.xl,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text role="displaySmall" color="onPrimaryContainer">◉</Text>
        </Surface>
        {message ? <AuthMessage tone={message.includes('enabled') || message.includes('off') ? 'success' : 'error'} message={message} /> : null}
        {available === null ? <Text role="bodyMedium" color="onSurfaceVariant" center>Checking device security…</Text> : null}
        {available === false ? (
          <AuthMessage tone="info" message="Biometric unlock is not available in this build or has not been enrolled on this device. You can always use your password." />
        ) : null}
        {required ? (
          <>
            <View style={{ alignItems: 'center', gap: t.spacing.scale.sm }}>
              <Surface tone="surfaceContainerLow" radius="full" style={{ width: t.component.avatar.lg, height: t.component.avatar.lg, alignItems: 'center', justifyContent: 'center' }}>
                <Text role="headlineSmall" color="primary">◉</Text>
              </Surface>
              <Text role="bodySmall" color="onSurfaceVariant">Touch the sensor</Text>
            </View>
            <Button label={busy ? 'Unlocking…' : 'Unlock with device security'} onPress={() => void unlockNow()} loading={busy} disabled={available !== true} fullWidth />
            <Button label="Use password instead" onPress={() => void usePasswordInstead()} variant="text" disabled={busy} fullWidth />
          </>
        ) : (
          <>
            <Text role="bodyMedium" color="onSurfaceVariant" center>{enabled ? 'Biometric unlock is enabled on this device.' : 'Enable it only on a device you own.'}</Text>
            <Button
              label={busy ? 'Verifying…' : enabled ? 'Turn off biometric unlock' : 'Enable biometric unlock'}
              onPress={() => void togglePreference()}
              loading={busy}
              disabled={available !== true}
              variant={enabled ? 'outlined' : 'filled'}
              fullWidth
            />
            <Button label="Back" onPress={() => navigation.goBack()} variant="text" disabled={busy} fullWidth />
          </>
        )}
      </View>
    </AuthLayout>
  );
}
