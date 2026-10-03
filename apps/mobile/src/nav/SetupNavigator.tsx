import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuthStore } from '../auth/authStore';
import { CredentialUpdateScreen } from '../features/auth/CredentialUpdateScreen';
import { FirstLoginPasswordScreen } from '../features/auth/FirstLoginPasswordScreen';
import { SecurityPolicyScreen } from '../features/auth/SecurityPolicyScreen';

export type SetupStackParamList = {
  FirstLoginPassword: undefined;
  SecurityPolicy: undefined;
  CredentialUpdate: undefined;
};

const Stack = createNativeStackNavigator<SetupStackParamList>();

/** Authenticated-but-blocked AUTH-06/07 flow, plus ordinary forced reset. */
export function SetupNavigator() {
  const session = useAuthStore((state) => state.session);
  const firstLogin = Boolean(session?.requiresSetup);

  return (
    <Stack.Navigator
      initialRouteName={firstLogin ? 'FirstLoginPassword' : 'CredentialUpdate'}
      screenOptions={{ headerShown: false, gestureEnabled: false }}
    >
      <Stack.Screen name="FirstLoginPassword" component={FirstLoginPasswordScreen} />
      <Stack.Screen name="SecurityPolicy" component={SecurityPolicyScreen} />
      <Stack.Screen name="CredentialUpdate" component={CredentialUpdateScreen} />
    </Stack.Navigator>
  );
}
