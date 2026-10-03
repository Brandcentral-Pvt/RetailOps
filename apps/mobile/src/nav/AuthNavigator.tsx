/**
 * AuthNavigator — the unauthenticated password + OTP flow.
 *
 * Screens are hand-written feature components so they can implement the real
 * server contract while the generated registry remains design documentation.
 */
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AccountLockedScreen } from '../features/auth/AccountLockedScreen';
import { ForgotPasswordScreen } from '../features/auth/ForgotPasswordScreen';
import { ResetPasswordScreen } from '../features/auth/ResetPasswordScreen';
import { SignInScreen } from '../features/auth/SignInScreen';
import { VerifyCodeScreen } from '../features/auth/VerifyCodeScreen';

export type AuthStackParamList = {
  SignIn: { email?: string; reset?: number } | undefined;
  VerifyCode: { tempToken: string; destination: string; email: string; expiresIn: number };
  ForgotPassword: { email: string };
  ResetPassword: { email?: string; token?: string } | undefined;
  AccountLocked: { email: string; retryAfter?: number | null };
};

const Stack = createNativeStackNavigator<AuthStackParamList>();

type Props = { initialResetToken?: string | null };

/** The RootNavigator supplies a validated custom/universal-link token here. */
export function AuthNavigator({ initialResetToken = null }: Props) {
  return (
    <Stack.Navigator
      initialRouteName={initialResetToken ? 'ResetPassword' : 'SignIn'}
      screenOptions={{ headerShown: false, animation: 'slide_from_right' }}
    >
      <Stack.Screen name="SignIn" component={SignInScreen} options={{ animation: 'fade' }} />
      <Stack.Screen name="VerifyCode" component={VerifyCodeScreen} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} initialParams={initialResetToken ? { token: initialResetToken } : undefined} />
      <Stack.Screen name="AccountLocked" component={AccountLockedScreen} options={{ animation: 'fade' }} />
    </Stack.Navigator>
  );
}
