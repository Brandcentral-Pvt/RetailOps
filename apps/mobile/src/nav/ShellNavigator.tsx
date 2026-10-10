/**
 * ShellNavigator — the permission-filtered bottom bar and its stacks.
 *
 * The bar is built by destinationsFor(session), so its contents are a pure
 * function of the session. There is no separate "admin menu" and "seller menu"
 * to keep in sync: one list, filtered.
 */
import React, { useMemo } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeProvider';
import { useAuthStore } from '../auth/authStore';
import { destinationsFor, screensForTab, landingFor } from './destinations';
import { SCREENS } from './screenRegistry.generated';
import { Text } from '../components/ui/Text';
import { Chip } from '../components/ui/Chip';
import type { Session } from '../auth/permissions';
import type { ScreenId } from './types';
import { TrustedDevicesScreen } from '../features/auth/TrustedDevicesScreen';
import { BiometricUnlockScreen } from '../features/auth/BiometricUnlockScreen';
import { SystemSetupScreen } from '../features/auth/SystemSetupScreen';
import { SecuritySettingsScreen } from '../features/auth/SecuritySettingsScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

/** A stack containing every screen this session can open in one tab. */
function TabStack({ tab }: { tab: string }) {
  const session = useAuthStore((s) => s.session) as Session | null;
  const ids = useMemo(() => (session ? screensForTab(session, tab) : []), [session, tab]);
  if (ids.length === 0) return null;
  return (
    <Stack.Navigator initialRouteName={tab === 'more' ? 'SecurityHome' : undefined} screenOptions={{ headerShown: false }}>
      {tab === 'more' ? <Stack.Screen name="SecurityHome" component={SecuritySettingsScreen} /> : null}
      {ids.map((id) => (
        <Stack.Screen key={id} name={SCREENS[id]!.route} component={SCREENS[id]!.component as React.ComponentType} />
      ))}
      {/* Account-security routes are deliberately present in each reachable
          tab stack so the More/Preferences entry works on either surface. */}
      <Stack.Screen name="TrustedDevices" component={TrustedDevicesScreen} />
      <Stack.Screen name="BiometricUnlock" component={BiometricUnlockScreen} />
      <Stack.Screen name="SystemSetup" component={SystemSetupScreen} />
    </Stack.Navigator>
  );
}

function TabButton({ label, focused, onPress }: { label: string; focused: boolean; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={label}
      style={styles.tabButton}
    >
      <View
        style={{
          width: 64, height: 32, borderRadius: t.shape.full as number,
          backgroundColor: focused ? t.c.secondaryContainer as string : 'transparent',
          alignItems: 'center', justifyContent: 'center',
        }}
      >
        <Text role="labelMedium" color="onSurfaceVariant" style={{ color: focused ? t.c.onSecondaryContainer as string : t.c.onSurfaceVariant as string }}>
          {label.slice(0, 2)}
        </Text>
      </View>
      <Text role="labelSmall" color="onSurfaceVariant" numberOfLines={1} style={{ color: focused ? t.c.onSurface as string : t.c.onSurfaceVariant as string }}>
        {label}
      </Text>
    </Pressable>
  );
}

export function ShellNavigator() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const session = useAuthStore((s) => s.session) as Session | null;
  const destinations = useMemo(() => destinationsFor(session), [session]);
  const initial = useMemo(() => landingFor(session)?.tab ?? 'home', [session]);

  if (!session) return null;

  // A session with no reachable destination must not land on an empty bar.
  if (destinations.length === 0) {
    return <NoDestinations session={session} />;
  }

  return (
    <Tab.Navigator
      initialRouteName={initial}
      screenOptions={{ headerShown: false, tabBarShowLabel: false }}
      tabBar={({ state, navigation }) => (
        <View
          accessibilityRole="tablist"
          style={[
            styles.bar,
            {
              paddingBottom: insets.bottom,
              backgroundColor: t.c.surfaceContainer as string,
              borderTopColor: t.c.outlineVariant as string,
              paddingHorizontal: t.padding / 2,
            },
          ]}
        >
          {state.routes.map((route) => {
            const dest = destinations.find((d) => d.tab === route.name);
            if (!dest) return null;
            return (
              <TabButton
                key={route.key}
                label={dest.label}
                focused={state.index === state.routes.indexOf(route)}
                onPress={() => navigation.navigate(route.name)}
              />
            );
          })}
        </View>
      )}
    >
      {destinations.map((d) => (
        <Tab.Screen key={d.tab} name={d.tab}>
          {() => <TabStack tab={d.tab} />}
        </Tab.Screen>
      ))}
    </Tab.Navigator>
  );
}

/**
 * Reachable only if a session has zero permitted screens. That is a data or
 * permissions problem, not a user error, so it says so rather than blaming the
 * account.
 */
function NoDestinations({ session }: { session: Session }) {
  const t = useTheme();
  return (
    <View style={[styles.noDest, { backgroundColor: t.c.pageBackground as string, padding: t.padding }]}>
      <Text role="headlineSmall" center>No modules are enabled for your account</Text>
      <Text role="bodyMedium" color="onSurfaceVariant" center style={{ marginTop: t.spacing.scale.sm }}>
        You are signed in as {session.displayName}, but none of your roles grant access to a mobile module yet.
      </Text>
      <Chip label={`Role: ${session.role}`} tone="neutral" style={{ marginTop: t.spacing.scale.lg }} />
      <Text role="bodySmall" color="onSurfaceVariant" center style={{ marginTop: t.spacing.scale.lg }}>
        Ask an admin to check your role permissions, then sign in again.
      </Text>
    </View>
  );
}

/** Exported for the "More" menu, which needs every non-landing screen. */
export function screensForGroup(session: Session, prefix: string): ScreenId[] {
  return screensForTab(session, prefix);
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 6 },
  tabButton: { flex: 1, alignItems: 'center', gap: 2, minHeight: 48, justifyContent: 'center' },
  noDest: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
