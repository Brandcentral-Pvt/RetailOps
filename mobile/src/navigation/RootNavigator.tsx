/**
 * Root navigator
 *
 * Gates Auth vs Main based on the current authentication session.
 *
 * Flow:
 *
 * App
 *  │
 *  ├── Bootstrapping
 *  │      └── Restore persisted session
 *  │
 *  ├── Authenticated
 *  │      └── MainNavigator
 *  │
 *  └── Not authenticated
 *         └── AuthNavigator
 */

import React, { useEffect, useMemo } from 'react';
import {
  DarkTheme as NavigationDarkTheme,
  DefaultTheme as NavigationLightTheme,
  NavigationContainer,
  type Theme as NavigationTheme,
} from '@react-navigation/native';
import {
  ActivityIndicator,
  Text,
  useTheme,
} from 'react-native-paper';
import {
  StyleSheet,
  View,
} from 'react-native';
import {
  createNativeStackNavigator,
} from '@react-navigation/native-stack';

import AuthNavigator from './AuthNavigator';
import MainNavigator from './MainNavigator';
import BrandLogo from '../components/BrandLogo';
import { useAuthStore } from '../store/authStore';
import { useNotificationStore } from '../store/notificationStore';

type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
};

const Stack =
  createNativeStackNavigator<RootStackParamList>();

function buildNavigationTheme(
  paperTheme: ReturnType<typeof useTheme>,
): NavigationTheme {
  const baseTheme = paperTheme.dark
    ? NavigationDarkTheme
    : NavigationLightTheme;

  return {
    ...baseTheme,

    dark: paperTheme.dark,

    colors: {
      ...baseTheme.colors,

      primary: paperTheme.colors.primary,

      background: paperTheme.colors.background,

      card: paperTheme.colors.surface,

      text: paperTheme.colors.onSurface,

      border: paperTheme.colors.outlineVariant,

      notification: paperTheme.colors.error,
    },
  };
}

function BootstrapScreen() {
  const { colors } = useTheme();

  return (
    <View
      style={[
        styles.bootstrap,
        {
          backgroundColor: colors.background,
        },
      ]}
    >
      <View
        style={[
          styles.logoContainer,
          {
            backgroundColor: colors.surface,
          },
        ]}
      >
        <BrandLogo size={52} />
      </View>

      <Text
        variant="titleMedium"
        style={[
          styles.brandName,
          {
            color: colors.onSurface,
          },
        ]}
      >
        RetailOps
      </Text>

      <Text
        variant="bodySmall"
        style={[
          styles.loadingText,
          {
            color: colors.onSurfaceVariant,
          },
        ]}
      >
        Preparing your workspace
      </Text>

      <ActivityIndicator
        size="small"
        color={colors.primary}
        style={styles.indicator}
      />
    </View>
  );
}

export default function RootNavigator() {
  const paperTheme = useTheme();

  const bootstrap = useAuthStore(
    (state) => state.bootstrap,
  );

  const isBootstrapping = useAuthStore(
    (state) => state.isBootstrapping,
  );

  const isAuthenticated = useAuthStore(
    (state) => state.isAuthenticated,
  );

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  const navigationTheme = useMemo(
    () => buildNavigationTheme(paperTheme),
    [paperTheme],
  );

  /*
   * Do not render NavigationContainer until the persisted
   * authentication state has been restored.
   *
   * This prevents:
   *
   * App → Login → Dashboard
   *
   * flashing briefly while bootstrap is running.
   */
  if (isBootstrapping) {
    return <BootstrapScreen />;
  }

  return (
    <NavigationContainer theme={navigationTheme}>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,

          /*
           * Authentication state changes should feel like
           * an application state change rather than a user
           * navigating between screens.
           */
          animation: 'none',
        }}
      >
        {isAuthenticated ? (
          <Stack.Screen
            name="Main"
            component={MainNavigator}
          />
        ) : (
          <Stack.Screen
            name="Auth"
            component={AuthNavigator}
          />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  bootstrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },

  logoContainer: {
    width: 76,
    height: 76,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',

    /*
     * No shadow/elevation here.
     *
     * The bootstrap screen should be intentionally quiet
     * rather than looking like a splash animation.
     */
  },

  brandName: {
    marginTop: 18,
    fontWeight: '700',
    letterSpacing: -0.2,
  },

  loadingText: {
    marginTop: 4,
  },

  indicator: {
    marginTop: 18,
  },
});