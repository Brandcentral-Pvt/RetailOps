/**
 * RootNavigator — auth gate, then the shell.
 *
 * There is exactly one place that decides "signed in or not", and it reads the
 * auth store. No navigator branches on a role.
 */
import React, { useMemo } from 'react';
import { NavigationContainer, DarkTheme, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTheme } from '../theme/ThemeProvider';
import { useAuthStore } from '../auth/authStore';
import { BootstrapScreen } from '../components/BootstrapScreen';
import { AuthNavigator } from './AuthNavigator';
import { ShellNavigator } from './ShellNavigator';

const Stack = createNativeStackNavigator();

export function RootNavigator() {
  const t = useTheme();
  const session = useAuthStore((s) => s.session);
  const bootstrapping = useAuthStore((s) => s.bootstrapping);

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
        ) : session ? (
          <Stack.Screen name="Shell" component={ShellNavigator} />
        ) : (
          <Stack.Screen name="Auth" component={AuthNavigator} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
