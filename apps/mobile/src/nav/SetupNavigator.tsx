import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { CredentialUpdateScreen } from '../features/auth/CredentialUpdateScreen';

type SetupStackParamList = { CredentialUpdate: undefined };
const Stack = createNativeStackNavigator<SetupStackParamList>();

/** Authenticated-but-blocked state for first login and forced password resets. */
export function SetupNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, gestureEnabled: false }}>
      <Stack.Screen name="CredentialUpdate" component={CredentialUpdateScreen} />
    </Stack.Navigator>
  );
}
