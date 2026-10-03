/**
 * AuthNavigator — the unauthenticated password + OTP flow.
 *
 * These routes use hand-written feature components rather than generated
 * scaffold bodies, so the design registry can remain generated and checked
 * while the real auth flow stays independently testable.
 */
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SCREENS } from './screenRegistry.generated';
import { AccountLockedScreen } from '../features/auth/AccountLockedScreen';
import { ForgotPasswordScreen } from '../features/auth/ForgotPasswordScreen';
import { SignInScreen } from '../features/auth/SignInScreen';
import { VerifyCodeScreen } from '../features/auth/VerifyCodeScreen';

const screen = (id: string) => SCREENS[id]!.component as React.ComponentType;

export type AuthStackParamList = {
  SignIn: { email?: string; reset?: number } | undefined;
  VerifyCode: { tempToken: string; destination: string; email: string; expiresIn: number };
  ForgotPassword: { email: string };
  ResetPassword: { email: string; token?: string };
  SetPassword: undefined;
  AccountLocked: { email: string };
  SessionExpired: undefined;
};

const Stack = createNativeStackNavigator<AuthStackParamList>();

export function AuthNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="SignIn" component={SignInScreen} options={{ animation: 'fade' }} />
      <Stack.Screen name="VerifyCode" component={VerifyCodeScreen} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      <Stack.Screen name="ResetPassword" component={screen('AUTH-05')} />
      <Stack.Screen name="SetPassword" component={screen('AUTH-06')} />
      <Stack.Screen name="AccountLocked" component={AccountLockedScreen} options={{ animation: 'fade' }} />
      <Stack.Screen name="SessionExpired" component={screen('AUTH-12')} options={{ gestureEnabled: false, animation: 'fade' }} />
    </Stack.Navigator>
  );
}
