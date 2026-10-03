import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useAuthStore } from '../../auth/authStore';
import { authErrorFor, type AuthError } from '../../auth/authErrors';
import { acknowledgeFirstLoginSetup, completeFirstLoginSetup, getFirstLoginSetupStatus, logout } from '../../services/authService';
import { Button } from '../../components/ui/Button';
import { Surface } from '../../components/ui/Surface';
import { Text } from '../../components/ui/Text';
import { useTheme } from '../../theme/ThemeProvider';
import { AuthLayout } from './AuthLayout';
import { AuthMessage } from './AuthMessage';

/** AUTH-07 — policy acknowledgement is a server-recorded setup requirement. */
export function SecurityPolicyScreen() {
  const t = useTheme();
  const clearSession = useAuthStore((state) => state.clearSession);
  const [accepted, setAccepted] = useState(false);
  const [checking, setChecking] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<AuthError | null>(null);

  useEffect(() => {
    let live = true;
    void getFirstLoginSetupStatus()
      .then((status) => {
        if (!live) return;
        setAccepted(Boolean(status.securityAccepted));
        setChecking(false);
      })
      .catch((caught) => {
        if (!live) return;
        setError(authErrorFor(caught, 'password'));
        setChecking(false);
      });
    return () => { live = false; };
  }, []);

  const complete = async () => {
    if (!accepted || submitting || checking) return;
    setSubmitting(true);
    setError(null);
    try {
      await acknowledgeFirstLoginSetup();
      await completeFirstLoginSetup();
      try {
        await logout();
      } catch {
        // Password setup may have already revoked the refresh token.
      }
      await clearSession('password-updated');
    } catch (caught) {
      setError(authErrorFor(caught, 'password'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout title="Security policy" subtitle="Step 2 of 2 · Review and accept before opening your workspace.">
      <View style={{ gap: t.spacing.scale.lg }}>
        {error ? <AuthMessage message={error.message} /> : null}
        <Surface tone="surface" radius="md" style={{ gap: t.spacing.scale.md }}>
          <View style={{ gap: t.spacing.scale.xs }}>
            <Text role="titleSmall">Authorized access</Text>
            <Text role="bodySmall" color="onSurfaceVariant">Use RetailOps only for work you are authorized to perform. Do not share reports, customer data, passwords or verification codes.</Text>
          </View>
          <View style={{ gap: t.spacing.scale.xs }}>
            <Text role="titleSmall">Device trust</Text>
            <Text role="bodySmall" color="onSurfaceVariant">Trust a device only when you own it or it is company-issued. Remove trusted access if a device is lost, shared or replaced.</Text>
          </View>
          <View style={{ gap: t.spacing.scale.xs }}>
            <Text role="titleSmall">Acceptable use</Text>
            <Text role="bodySmall" color="onSurfaceVariant">Keep account information accurate, follow your organisation’s policies, and report suspected unauthorized access promptly.</Text>
          </View>
        </Surface>
        <Pressable
          onPress={() => {
            setAccepted((value) => !value);
            setError(null);
          }}
          disabled={checking || submitting}
          accessibilityRole="checkbox"
          accessibilityLabel="I have read and accept the security policy"
          accessibilityState={{ checked: accepted, disabled: checking || submitting }}
          style={{ flexDirection: 'row', gap: t.spacing.scale.sm, minHeight: t.component.button.touchTarget }}
        >
          <View
            style={{
              width: t.spacing.scale.lg,
              height: t.spacing.scale.lg,
              marginTop: t.spacing.scale.xs,
              borderRadius: t.shape.xs as number,
              borderWidth: accepted ? 0 : StyleSheet.hairlineWidth,
              borderColor: t.c.outline as string,
              backgroundColor: accepted ? t.c.primary as string : t.c.surface as string,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {accepted ? <Text role="labelSmall" color="onPrimary">✓</Text> : null}
          </View>
          <Text role="bodyMedium" color="onSurface" style={{ flex: 1 }}>I have read and accept the security policy.</Text>
        </Pressable>
        {checking ? <Text role="bodySmall" color="onSurfaceVariant" center>Checking setup progress…</Text> : null}
        <Button
          label={submitting ? 'Completing setup…' : 'Continue'}
          onPress={() => void complete()}
          loading={submitting}
          disabled={!accepted || checking}
          fullWidth
        />
      </View>
    </AuthLayout>
  );
}
