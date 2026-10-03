import React, { useState } from 'react';
import { View } from 'react-native';
import { useAuthStore } from '../../auth/authStore';
import { authErrorFor, type AuthError } from '../../auth/authErrors';
import { changePassword, logout } from '../../services/authService';
import { Button } from '../../components/ui/Button';
import { useTheme } from '../../theme/ThemeProvider';
import { AuthField } from './AuthField';
import { AuthLayout } from './AuthLayout';
import { AuthMessage } from './AuthMessage';
import { PasswordRequirements } from './PasswordRequirements';
import { passwordIsCompliant } from './passwordPolicy';

type FieldErrors = { current?: string; next?: string; confirm?: string };

/** Forced AUTH credential update for an expired password (not the first-login wizard). */
export function CredentialUpdateScreen() {
  const t = useTheme();
  const clearSession = useAuthStore((state) => state.clearSession);
  const [currentPassword, setCurrentPassword] = useState('');
  const [nextPassword, setNextPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<AuthError | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const update = (field: keyof FieldErrors, setter: (value: string) => void) => (value: string) => {
    setter(value);
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
    setError(null);
  };

  const submit = async () => {
    if (submitting) return;
    const errors: FieldErrors = {};
    if (!currentPassword) errors.current = 'Enter your current password.';
    if (!passwordIsCompliant(nextPassword)) errors.next = 'Use every password requirement below.';
    if (nextPassword !== confirmPassword) errors.confirm = 'Passwords do not match.';
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSubmitting(true);
    setError(null);
    try {
      await changePassword(currentPassword, nextPassword);
      try {
        await logout();
      } catch {
        // Password update invalidates the token server-side before this call.
      }
      await clearSession('password-updated');
    } catch (caught) {
      setError(authErrorFor(caught, 'password'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout title="Update your password" subtitle="Your password needs to be updated before you can continue.">
      <View style={{ gap: t.spacing.scale.lg }}>
        {error ? <AuthMessage message={error.message} /> : null}
        <AuthField
          label="Current password"
          value={currentPassword}
          onChangeText={update('current', setCurrentPassword)}
          error={fieldErrors.current}
          secure
          autoComplete="current-password"
          textContentType="password"
          returnKeyType="next"
        />
        <AuthField
          label="New password"
          value={nextPassword}
          onChangeText={update('next', setNextPassword)}
          error={fieldErrors.next}
          secure
          autoComplete="new-password"
          textContentType="newPassword"
          returnKeyType="next"
        />
        <AuthField
          label="Confirm new password"
          value={confirmPassword}
          onChangeText={update('confirm', setConfirmPassword)}
          error={fieldErrors.confirm}
          secure
          autoComplete="new-password"
          textContentType="newPassword"
          returnKeyType="done"
          onSubmitEditing={() => void submit()}
        />
        <PasswordRequirements password={nextPassword} />
        <Button label={submitting ? 'Updating password…' : 'Update password'} onPress={() => void submit()} loading={submitting} fullWidth />
      </View>
    </AuthLayout>
  );
}
