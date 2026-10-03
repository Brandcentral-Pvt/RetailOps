import React, { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuthStore } from '../../auth/authStore';
import { authErrorFor, authCopy, type AuthError } from '../../auth/authErrors';
import { login } from '../../services/authService';
import { Button } from '../../components/ui/Button';
import { Text } from '../../components/ui/Text';
import { useTheme } from '../../theme/ThemeProvider';
import type { AuthStackParamList } from '../../nav/AuthNavigator';
import { AuthField } from './AuthField';
import { AuthLayout } from './AuthLayout';
import { AuthMessage } from './AuthMessage';
import { formatCountdown, useCountdown } from './useCountdown';

type Props = NativeStackScreenProps<AuthStackParamList, 'SignIn'>;
type FieldErrors = { email?: string; password?: string };

export function SignInScreen({ navigation, route }: Props) {
  const t = useTheme();
  const signInWithTokens = useAuthStore((state) => state.signInWithTokens);
  const notice = useAuthStore((state) => state.notice);
  const consumeNotice = useAuthStore((state) => state.consumeNotice);
  const [email, setEmail] = useState(route.params?.email ?? '');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [authError, setAuthError] = useState<AuthError | null>(null);
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [retryAt, setRetryAt] = useState<number | null>(null);
  const retryIn = useCountdown(retryAt);

  useEffect(() => {
    if (route.params?.email !== undefined) setEmail(route.params.email);
    if (route.params?.reset) {
      setPassword('');
      setFieldErrors({});
      setAuthError(null);
    }
  }, [route.params?.email, route.params?.reset]);

  useEffect(() => {
    if (!notice) return;
    setNoticeMessage(notice === 'password-updated'
      ? 'Password updated. Sign in with your new password.'
      : authCopy('session-expired'));
    consumeNotice();
  }, [notice, consumeNotice]);

  const updateEmail = (value: string) => {
    setEmail(value);
    setFieldErrors((current) => ({ ...current, email: undefined }));
    setAuthError(null);
  };

  const updatePassword = (value: string) => {
    setPassword(value);
    setFieldErrors((current) => ({ ...current, password: undefined }));
    setAuthError(null);
  };

  const submit = async () => {
    if (submitting || retryIn > 0) return;
    const normalizedEmail = email.trim().toLowerCase();
    const errors: FieldErrors = {};
    if (!normalizedEmail) errors.email = 'Enter your work email.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) errors.email = 'Enter a valid work email.';
    if (!password) errors.password = 'Enter your password.';
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSubmitting(true);
    setAuthError(null);
    setNoticeMessage(null);
    try {
      const result = await login({ email: normalizedEmail, password });
      if (result.kind === 'otp') {
        setPassword('');
        navigation.navigate('VerifyCode', {
          tempToken: result.tempToken,
          destination: result.destination,
          email: normalizedEmail,
          expiresIn: result.expiresIn,
        });
        return;
      }
      await signInWithTokens({ accessToken: result.accessToken, refreshToken: result.refreshToken });
    } catch (error) {
      const mapped = authErrorFor(error, 'login');
      if (mapped.code === 'account-locked') {
        navigation.navigate('AccountLocked', { email: normalizedEmail, retryAfter: mapped.retryAfter });
        return;
      }
      setAuthError(mapped);
      if (mapped.retryAfter) setRetryAt(Date.now() + mapped.retryAfter * 1000);
    } finally {
      setSubmitting(false);
    }
  };

  const retryLabel = retryIn > 0 ? `Try again in ${formatCountdown(retryIn)}` : 'Continue';

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to your RetailOps workspace."
      footer={
        <Text role="bodySmall" color="onSurfaceVariant" center>
          Need access to RetailOps? Contact your administrator.
        </Text>
      }
    >
      <View style={{ gap: t.spacing.scale.lg }}>
        {noticeMessage ? <AuthMessage message={noticeMessage} tone="info" /> : null}
        {authError ? <AuthMessage message={authError.message} /> : null}
        <AuthField
          label="Work email"
          value={email}
          onChangeText={updateEmail}
          error={fieldErrors.email}
          placeholder="name@company.com"
          keyboardType="email-address"
          autoComplete="email"
          textContentType="username"
          returnKeyType="next"
          accessibilityHint="Enter the email address assigned to your RetailOps account."
        />
        <AuthField
          label="Password"
          value={password}
          onChangeText={updatePassword}
          error={fieldErrors.password}
          placeholder="Enter your password"
          secure
          autoComplete="current-password"
          textContentType="password"
          returnKeyType="go"
          onSubmitEditing={() => void submit()}
        />
        <Pressable
          onPress={() => navigation.navigate('ForgotPassword', { email: email.trim() })}
          disabled={submitting}
          accessibilityRole="link"
          accessibilityLabel="Forgot password?"
          style={{ alignSelf: 'flex-start', minHeight: t.component.button.touchTarget, justifyContent: 'center' }}
        >
          <Text role="labelLarge" color="primary">Forgot password?</Text>
        </Pressable>
        <Button
          label={submitting ? 'Signing in…' : retryLabel}
          onPress={() => void submit()}
          loading={submitting}
          disabled={retryIn > 0}
          fullWidth
          accessibilityHint="Signs in with your work email and password."
        />
      </View>
    </AuthLayout>
  );
}
