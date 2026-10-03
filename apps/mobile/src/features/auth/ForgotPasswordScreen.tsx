import React, { useState } from 'react';
import { View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { authErrorFor, type AuthError } from '../../auth/authErrors';
import { forgotPassword } from '../../services/authService';
import { Button } from '../../components/ui/Button';
import { useTheme } from '../../theme/ThemeProvider';
import type { AuthStackParamList } from '../../nav/AuthNavigator';
import { AuthField } from './AuthField';
import { AuthLayout } from './AuthLayout';
import { AuthMessage } from './AuthMessage';

type Props = NativeStackScreenProps<AuthStackParamList, 'ForgotPassword'>;

export function ForgotPasswordScreen({ navigation, route }: Props) {
  const t = useTheme();
  const [email, setEmail] = useState(route.params.email ?? '');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [error, setError] = useState<AuthError | null>(null);
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (submitting) return;
    const normalized = email.trim().toLowerCase();
    if (!normalized) {
      setFieldError('Enter your work email.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
      setFieldError('Enter a valid work email.');
      return;
    }

    setSubmitting(true);
    setFieldError(null);
    setError(null);
    try {
      await forgotPassword(normalized);
      // The backend intentionally returns the same success response whether or
      // not the account exists. Preserve that privacy property on the device.
      setSent(true);
    } catch (caught) {
      setError(authErrorFor(caught, 'password'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title="Reset your password"
      subtitle="Enter your work email and we’ll send reset instructions if an account is available."
    >
      <View style={{ gap: t.spacing.scale.lg }}>
        {sent ? (
          <AuthMessage
            tone="success"
            message="If an account exists for this email, reset instructions have been sent. Check your inbox and spam folder."
          />
        ) : null}
        {error ? <AuthMessage message={error.message} /> : null}
        <AuthField
          label="Work email"
          value={email}
          onChangeText={(value) => {
            setEmail(value);
            setFieldError(null);
            setError(null);
            setSent(false);
          }}
          error={fieldError}
          placeholder="name@company.com"
          keyboardType="email-address"
          autoComplete="email"
          textContentType="username"
          returnKeyType="send"
          onSubmitEditing={() => void submit()}
        />
        <Button
          label={submitting ? 'Sending reset link…' : sent ? 'Send again' : 'Send reset link'}
          onPress={() => void submit()}
          loading={submitting}
          fullWidth
        />
        <Button label="Back to sign in" onPress={() => navigation.goBack()} variant="text" fullWidth />
      </View>
    </AuthLayout>
  );
}
