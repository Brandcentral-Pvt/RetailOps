/**
 * RootNavigator — auth gate, then the shell.
 *
 * There is exactly one place that decides "signed in or not", and it reads the
 * auth store. No navigator branches on a role.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Linking } from 'react-native';
import { NavigationContainer, DarkTheme, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTheme } from '../theme/ThemeProvider';
import { useAuthStore } from '../auth/authStore';
import { BootstrapScreen } from '../components/BootstrapScreen';
import { AuthNavigator } from './AuthNavigator';
import { ShellNavigator } from './ShellNavigator';
import { SetupNavigator } from './SetupNavigator';
import { SellerOnboardingScreen } from '../features/auth/SellerOnboardingScreen';
import { BiometricUnlockScreen } from '../features/auth/BiometricUnlockScreen';
import { SessionExpiredScreen } from '../features/auth/SessionExpiredScreen';

const Stack = createNativeStackNavigator();

/** Only accept reset links issued for the registered mobile scheme or live host. */
function resetTokenFromUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    const isMobileScheme = parsed.protocol === 'retailops:';
    const isLiveHost = parsed.protocol === 'https:' && parsed.host === 'data.brandcentral.in';
    if (!isMobileScheme && !isLiveHost) return null;
    const pathname = parsed.pathname.replace(/^\/+|\/+$/g, '');
    const matchesResetPath = pathname === 'reset-password'
      || (isMobileScheme && parsed.host === 'reset-password')
      || (isMobileScheme && parsed.host === 'auth' && pathname === 'reset-password');
    const token = parsed.searchParams.get('token')?.trim() ?? '';
    return matchesResetPath && token.length > 0 && token.length <= 512 ? token : null;
  } catch {
    return null;
  }
}

export function RootNavigator() {
  const t = useTheme();
  const session = useAuthStore((s) => s.session);
  const bootstrapping = useAuthStore((s) => s.bootstrapping);
  const sessionExpired = useAuthStore((s) => s.sessionExpired);
  const biometricRequired = useAuthStore((s) => s.biometricRequired);
  const sellerOnboarding = useAuthStore((s) => s.sellerOnboarding);
  const clearSession = useAuthStore((s) => s.clearSession);
  const [resetToken, setResetToken] = useState<string | null>(null);
  const [clearingForReset, setClearingForReset] = useState(false);
  const requiresCredentialUpdate = Boolean(session?.requiresSetup || session?.needsPasswordReset);

  useEffect(() => {
    // Retain a newly received token while an already-signed-in workspace is
    // being cleared, then discard it once a later successful sign-in restores
    // a session so it cannot reopen an old reset screen on logout.
    if (!session && clearingForReset) setClearingForReset(false);
    if (session && resetToken && !clearingForReset) setResetToken(null);
  }, [session, resetToken, clearingForReset]);

  useEffect(() => {
    const receive = (url: string | null) => {
      if (!url) return;
      const token = resetTokenFromUrl(url);
      if (!token) return;
      setResetToken(token);
      // A password-reset token belongs to an unauthenticated flow. Do not let
      // it open behind a live workspace session.
      if (useAuthStore.getState().session) {
        setClearingForReset(true);
        void clearSession();
      }
    };
    void Linking.getInitialURL().then(receive).catch(() => undefined);
    const subscription = Linking.addEventListener('url', ({ url }) => receive(url));
    return () => subscription.remove();
  }, [clearSession]);

  const navTheme = useMemo(
    () =>
      t.scheme === 'dark'
        ? {
            ...DarkTheme,
            colors: {
              ...DarkTheme.colors,
              background: t.c.pageBackground as string,
              card: t.c.surfaceContainer as string,
              text: t.c.onSurface as string,
              primary: t.c.primary as string,
              border: t.c.outlineVariant as string,
            },
          }
        : {
            ...DefaultTheme,
            colors: {
              ...DefaultTheme.colors,
              background: t.c.pageBackground as string,
              card: t.c.surfaceContainer as string,
              text: t.c.onSurface as string,
              primary: t.c.primary as string,
              border: t.c.outlineVariant as string,
            },
          },
    [t],
  );

  return (
    <NavigationContainer theme={navTheme}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {bootstrapping ? (
          <Stack.Screen name="Bootstrap" component={BootstrapScreen} />
        ) : biometricRequired ? (
          <Stack.Screen name="BiometricUnlock" component={BiometricUnlockScreen} options={{ gestureEnabled: false }} />
        ) : sessionExpired ? (
          <Stack.Screen name="SessionExpired" component={SessionExpiredScreen} options={{ gestureEnabled: false }} />
        ) : session ? (
          requiresCredentialUpdate ? (
            <Stack.Screen name="CredentialUpdate" component={SetupNavigator} />
          ) : sellerOnboarding === 'required' ? (
            <Stack.Screen name="SellerOnboarding" component={SellerOnboardingScreen} options={{ gestureEnabled: false }} />
          ) : (
            <Stack.Screen name="Shell" component={ShellNavigator} />
          )
        ) : (
          <Stack.Screen name="Auth">
            {() => <AuthNavigator key={`auth-${resetToken ?? 'sign-in'}`} initialResetToken={resetToken} />}
          </Stack.Screen>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
