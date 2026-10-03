/**
 * AuthNavigator — the AUTH-* screens, in the order the backend flow demands.
 *
 * The backend is two-legged: password, then OTP unless the device is trusted
 * (backend/controllers/authController.js `login`). The OTP screen is only
 * pushed when the login response actually asks for it, so a trusted device
 * never sees it.
 *
 * Screen IDs are asserted against the inventory by
 * `npm run doctor`; a rename in the design system fails there rather than
 * producing a blank screen at runtime.
 */
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SCREENS } from './screenRegistry.generated';

const screen = (id: string) => SCREENS[id]!.component as React.ComponentType;

export type AuthStackParamList = {
  SignIn: undefined;
  VerifyCode: { tempToken: string; destination: string; email: string };
  ForgotPassword: { email: string };
  ResetPassword: { email: string };
  SetPassword: undefined;
  AccountLocked: { email: string };
  SessionExpired: undefined;
};

const Stack = createNativeStackNavigator<AuthStackParamList>();

export function AuthNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="SignIn" component={screen('AUTH-02')} options={{ animation: 'fade' }} />
      <Stack.Screen name="VerifyCode" component={screen('AUTH-03')} />
      <Stack.Screen name="ForgotPassword" component={screen('AUTH-04')} />
      <Stack.Screen name="ResetPassword" component={screen('AUTH-05')} />
      <Stack.Screen name="SetPassword" component={screen('AUTH-06')} />
      <Stack.Screen
        name="AccountLocked"
        component={screen('AUTH-13')}
        options={{ animation: 'fade' }}
      />
      <Stack.Screen
        name="SessionExpired"
        component={screen('AUTH-12')}
        options={{ gestureEnabled: false, animation: 'fade' }}
      />
    </Stack.Navigator>
  );
}
