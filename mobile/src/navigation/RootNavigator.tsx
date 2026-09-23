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
import type { MD3Theme } from 'react-native-paper';
import {
  StyleSheet,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  createNativeStackNavigator,
} from '@react-navigation/native-stack';

import AuthNavigator from './AuthNavigator';
import MainNavigator from './MainNavigator';
import CallsNavigator from './CallsNavigator';
import BrandLogo from '../components/BrandLogo';
import { useAuthStore } from '../store/authStore';

type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
  Calls: undefined;
};

const Stack =
  createNativeStackNavigator<RootStackParamList>();

function buildNavigationTheme(
  paperTheme: MD3Theme,
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
    <LinearGradient
      colors={[colors.background, colors.primaryContainer, colors.background]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.bootstrap}
    >
      <View
        style={[
          styles.logoContainer,
          {
            backgroundColor: colors.surface,
            shadowColor: colors.shadow,
            ...styles.elevation,
          },
        ]}
      >
        <BrandLogo size={36} />
      </View>

      <Text
        variant="titleLarge"
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
        variant="bodyMedium"
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
    </LinearGradient>
  );
}

export default function RootNavigator() {
  const paperTheme = useTheme() as MD3Theme;

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

        {/* Call stack overlays the whole app (incoming calls, active call) */}
        <Stack.Screen
          name="Calls"
          component={CallsNavigator}
          options={{
            presentation: 'containedTransparentModal',
            gestureEnabled: false,
            animation: 'slide_from_bottom',
          }}
        />
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

  elevation: {
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 4,
  },

  logoContainer: {
    width: 88,
    height: 64,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },

  brandName: {
    marginTop: 20,
    fontWeight: '700',
  },

  loadingText: {
    marginTop: 6,
  },

  indicator: {
    marginTop: 20,
  },
});