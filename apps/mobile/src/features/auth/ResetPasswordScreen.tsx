import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { authErrorFor, type AuthError } from '../../auth/authErrors';
import { ApiError } from '../../services/ApiError';
import { resetPassword, validateResetToken } from '../../services/authService';
import { Button } from '../../components/ui/Button';
import { Text } from '../../components/ui/Text';
import { useTheme } from '../../theme/ThemeProvider';
import type { AuthStackParamList } from '../../nav/AuthNavigator';
import { AuthField } from './AuthField';
import { AuthLayout } from './AuthLayout';
import { AuthMessage } from './AuthMessage';
import { PasswordRequirements } from './PasswordRequirements';
import { passwordIsCompliant } from './passwordPolicy';

type Props = NativeStackScreenProps<AuthStackParamList, 'ResetPassword'>;

export function ResetPasswordScreen({ navigation, route }: Props) {
  const t = useTheme();
  const token = route.params?.token?.trim() ?? '';
  const [tokenState, setTokenState] = useState<'checking' | 'valid' | 'invalid'>(token ? 'checking' : 'invalid');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [newPasswordError, setNewPasswordError] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [error, setError] = useState<AuthError | null>(null);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let live = true;
    if (!token) return () => { live = false; };
    void validateResetToken(token)
      .then((result) => {
        if (!live) return;
        setTokenState(result.valid ? 'valid' : 'invalid');
      })
      .catch(() => {
        if (live) setTokenState('invalid');
      });
    return () => { live = false; };
  }, [token]);

  const submit = async () => {
    if (submitting || tokenState !== 'valid') return;
    const passwordError = passwordIsCompliant(newPassword) ? null : 'Use every password requirement below.';
    const confirmationError = newPassword === confirmPassword ? null : 'Passwords do not match.';
    setNewPasswordError(passwordError);
    setConfirmError(confirmationError);
    if (passwordError || confirmationError) return;

    setSubmitting(true);
    setError(null);
    try {
      await resetPassword(token, newPassword);
      setSuccess(true);
    } catch (caught) {
      // Classify server text without rendering it. The only safe special case
      // is a link that became invalid between the preflight and submission.
      const source = caught instanceof ApiError && caught.payload && typeof caught.payload === 'object'
        ? String((caught.payload as { message?: unknown }).message ?? '').toLowerCase()
        : '';
      if (caught instanceof ApiError && caught.status === 400 && /reset link|invalid.*link|expired|already used/.test(source)) {
        setTokenState('invalid');
      } else {
        setError(authErrorFor(caught, 'password'));
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (tokenState === 'checking') {
    return (
      <AuthLayout title="Checking reset link" subtitle="We’re verifying your password reset link.">
        <Text role="bodyMedium" color="onSurfaceVariant" center>Please wait…</Text>
      </AuthLayout>
    );
  }

  if (tokenState === 'invalid') {
    return (
      <AuthLayout title="Reset link unavailable" subtitle="This reset link is invalid or has expired.">
        <View style={{ gap: t.spacing.scale.lg }}>
          <AuthMessage message="Request a new reset link to continue." />
          <Button label="Request a new link" onPress={() => navigation.replace('ForgotPassword', { email: route.params?.email ?? '' })} fullWidth />
          <Button label="Back to sign in" onPress={() => navigation.reset({ index: 0, routes: [{ name: 'SignIn', params: { email: route.params?.email, reset: Date.now() } }] })} variant="text" fullWidth />
        </View>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title={success ? 'Password updated' : 'Create a new password'}
      subtitle={success ? 'You can now sign in with your new password.' : 'Choose a password you do not use anywhere else.'}
    >
      <View style={{ gap: t.spacing.scale.lg }}>
        {success ? (
          <>
            <AuthMessage tone="success" message="Your password has been updated securely." />
            <Button label="Go to sign in" onPress={() => navigation.reset({ index: 0, routes: [{ name: 'SignIn', params: { email: route.params?.email, reset: Date.now() } }] })} fullWidth />
          </>
        ) : (
          <>
            {error ? <AuthMessage message={error.message} /> : null}
            <AuthField
              label="New password"
              value={newPassword}
              onChangeText={(value) => {
                setNewPassword(value);
                setNewPasswordError(null);
                setError(null);
              }}
              error={newPasswordError}
              secure
              autoComplete="new-password"
              textContentType="newPassword"
              returnKeyType="next"
            />
            <AuthField
              label="Confirm new password"
              value={confirmPassword}
              onChangeText={(value) => {
                setConfirmPassword(value);
                setConfirmError(null);
                setError(null);
              }}
              error={confirmError}
              secure
              autoComplete="new-password"
              textContentType="newPassword"
              returnKeyType="done"
              onSubmitEditing={() => void submit()}
            />
            <PasswordRequirements password={newPassword} includePreviousPassword />
            <Button label={submitting ? 'Updating password…' : 'Update password'} onPress={() => void submit()} loading={submitting} fullWidth />
            <Button label="Back to sign in" onPress={() => navigation.reset({ index: 0, routes: [{ name: 'SignIn', params: { email: route.params?.email, reset: Date.now() } }] })} variant="text" fullWidth />
          </>
        )}
      </View>
    </AuthLayout>
  );
}
