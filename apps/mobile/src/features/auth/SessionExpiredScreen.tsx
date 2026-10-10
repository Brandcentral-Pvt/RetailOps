import React, { useState } from 'react';
import { SafeAreaView, View } from 'react-native';
import { useAuthStore } from '../../auth/authStore';
import { Button } from '../../components/ui/Button';
import { Surface } from '../../components/ui/Surface';
import { Text } from '../../components/ui/Text';
import { useTheme } from '../../theme/ThemeProvider';

/** AUTH-12 — a modal presentation after the client exhausts its refresh retry. */
export function SessionExpiredScreen() {
  const t = useTheme();
  const dismiss = useAuthStore((state) => state.dismissSessionExpired);
  const clearSession = useAuthStore((state) => state.clearSession);
  const [reauthenticating, setReauthenticating] = useState(false);

  const continueToSignIn = () => {
    setReauthenticating(true);
    // The failed refresh has already removed server-invalid tokens. Switching
    // to AUTH-02 is deliberate; no stale bearer token is reused.
    dismiss();
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.c.pageBackground as string }}>
      {/* A retained visual backdrop makes this a true interruption state rather
          than a blank redirect after refresh failure. It contains no live data
          or request-capable controls because the session has been cleared. */}
      <View pointerEvents="none" style={{ flex: 1, padding: t.padding, gap: t.spacing.scale.lg }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View style={{ gap: t.spacing.scale.xs }}>
            <Text role="headlineSmall">Dashboard</Text>
            <Text role="bodySmall" color="onSurfaceVariant">Your workspace</Text>
          </View>
          <Surface tone="surfaceContainerHigh" radius="full" style={{ width: t.component.avatar.sm, height: t.component.avatar.sm }} />
        </View>
        <Surface tone="surface" radius="md" style={{ gap: t.spacing.scale.md }}>
          <Text role="titleMedium">Today at a glance</Text>
          <View style={{ flexDirection: 'row', gap: t.spacing.scale.sm }}>
            {[0, 1, 2].map((item) => <Surface key={item} tone="surfaceContainerHigh" radius="sm" style={{ flex: 1, minHeight: t.component.avatar.lg }} />)}
          </View>
        </Surface>
        <Surface tone="surface" radius="md" style={{ minHeight: t.component.chart.height }} />
      </View>
      <View pointerEvents="none" style={{ position: 'absolute', inset: 0, backgroundColor: t.c.scrim as string, opacity: 0.72 }} />
      <View style={{ position: 'absolute', inset: 0, padding: t.padding, justifyContent: 'center' }}>
        <Surface tone="surface" radius="xl" style={{ gap: t.spacing.scale.lg }}>
          <View style={{ gap: t.spacing.scale.sm, alignItems: 'center' }}>
            <Surface tone="primaryContainer" radius="full" style={{ width: t.component.avatar.md, height: t.component.avatar.md, alignItems: 'center', justifyContent: 'center' }}>
              <Text role="headlineSmall" color="onPrimaryContainer">⌁</Text>
            </Surface>
            <Text role="headlineSmall" center>Session expired</Text>
            <Text role="bodyMedium" color="onSurfaceVariant" center>For your security, your sign-in session has ended. Your place has been saved.</Text>
          </View>
          <Button
            label={reauthenticating ? 'Opening sign in…' : 'Sign in again'}
            onPress={continueToSignIn}
            loading={reauthenticating}
            fullWidth
          />
          <Button label="Sign out" onPress={() => void clearSession()} variant="text" disabled={reauthenticating} fullWidth />
        </Surface>
      </View>
    </SafeAreaView>
  );
}
