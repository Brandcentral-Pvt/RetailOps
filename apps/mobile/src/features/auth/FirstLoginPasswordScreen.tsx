import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { authErrorFor, type AuthError } from '../../auth/authErrors';
import { getFirstLoginSetupStatus, setFirstLoginPassword } from '../../services/authService';
import { Button } from '../../components/ui/Button';
import { Text } from '../../components/ui/Text';
import { useTheme } from '../../theme/ThemeProvider';
import type { SetupStackParamList } from '../../nav/SetupNavigator';
import { AuthField } from './AuthField';
import { AuthLayout } from './AuthLayout';
import { AuthMessage } from './AuthMessage';
import { PasswordRequirements } from './PasswordRequirements';
import { passwordIsCompliant } from './passwordPolicy';

type Props = NativeStackScreenProps<SetupStackParamList, 'FirstLoginPassword'>;

/** AUTH-06 — first-login password replacement. The temporary password is never persisted. */
export function FirstLoginPasswordScreen({ navigation }: Props) {
  const t = useTheme();
  const [checking, setChecking] = useState(true);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [errors, setErrors] = useState<{ current?: string; next?: string; confirmation?: string }>({});
  const [error, setError] = useState<AuthError | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let live = true;
    void getFirstLoginSetupStatus()
      .then((status) => {
        if (!live) return;
        if (status.completedSteps?.includes('change_password')) {
          navigation.replace('SecurityPolicy');
          return;
        }
        setChecking(false);
      })
      .catch((caught) => {
        if (!live) return;
        setChecking(false);
        setError(authErrorFor(caught, 'password'));
      });
    return () => { live = false; };
  }, [navigation]);

  const submit = async () => {
    if (submitting || checking) return;
    const nextErrors: { current?: string; next?: string; confirmation?: string } = {};
    if (!currentPassword) nextErrors.current = 'Enter the temporary password you were given.';
    if (!passwordIsCompliant(newPassword)) nextErrors.next = 'Use every password requirement below.';
    if (newPassword !== confirmation) nextErrors.confirmation = 'Passwords do not match.';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    setError(null);
    try {
      await setFirstLoginPassword(currentPassword, newPassword);
      setCurrentPassword('');
      navigation.replace('SecurityPolicy');
    } catch (caught) {
      setError(authErrorFor(caught, 'password'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout title="Create your password" subtitle="Step 1 of 2 · This replaces the temporary password you were given.">
      <View style={{ gap: t.spacing.scale.lg }}>
        {checking ? <Text role="bodyMedium" color="onSurfaceVariant" center>Checking your setup progress…</Text> : null}
        {error ? <AuthMessage message={error.message} /> : null}
        <AuthField
          label="Temporary password"
          value={currentPassword}
          onChangeText={(value) => {
            setCurrentPassword(value);
            setErrors((current) => ({ ...current, current: undefined }));
            setError(null);
          }}
          error={errors.current}
          secure
          editable={!checking && !submitting}
          autoComplete="current-password"
          textContentType="password"
          returnKeyType="next"
        />
        <AuthField
          label="New password"
          value={newPassword}
          onChangeText={(value) => {
            setNewPassword(value);
            setErrors((current) => ({ ...current, next: undefined }));
            setError(null);
          }}
          error={errors.next}
          secure
          editable={!checking && !submitting}
          autoComplete="new-password"
          textContentType="newPassword"
          returnKeyType="next"
        />
        <AuthField
          label="Confirm new password"
          value={confirmation}
          onChangeText={(value) => {
            setConfirmation(value);
            setErrors((current) => ({ ...current, confirmation: undefined }));
            setError(null);
          }}
          error={errors.confirmation}
          secure
          editable={!checking && !submitting}
          autoComplete="new-password"
          textContentType="newPassword"
          returnKeyType="done"
          onSubmitEditing={() => void submit()}
        />
        <PasswordRequirements password={newPassword} showStrength={false} />
        <Button
          label={submitting ? 'Saving password…' : 'Set password and continue'}
          onPress={() => void submit()}
          loading={submitting}
          disabled={checking}
          fullWidth
        />
      </View>
    </AuthLayout>
  );
}
