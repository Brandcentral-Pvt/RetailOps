import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useAuthStore } from '../../auth/authStore';
import { authErrorFor, type AuthError } from '../../auth/authErrors';
import {
  acknowledgeFirstLoginSetup,
  changePassword,
  completeFirstLoginSetup,
  getFirstLoginSetupStatus,
  logout,
  setFirstLoginPassword,
} from '../../services/authService';
import { Button } from '../../components/ui/Button';
import { Text } from '../../components/ui/Text';
import { useTheme } from '../../theme/ThemeProvider';
import { AuthField } from './AuthField';
import { AuthLayout } from './AuthLayout';
import { AuthMessage } from './AuthMessage';

type FieldErrors = { current?: string; next?: string; confirm?: string; policy?: string };

/**
 * Forced password update for an expired credential and the first-login setup
 * path. It deliberately finishes by clearing local tokens: both backend paths
 * rotate/revoke refresh credentials, so the next sign-in obtains a clean pair.
 */
export function CredentialUpdateScreen() {
  const t = useTheme();
  const session = useAuthStore((state) => state.session);
  const clearSession = useAuthStore((state) => state.clearSession);
  const refreshSession = useAuthStore((state) => state.refreshSession);
  const [currentPassword, setCurrentPassword] = useState('');
  const [nextPassword, setNextPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [acceptPolicy, setAcceptPolicy] = useState(false);
  const [passwordSaved, setPasswordSaved] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<AuthError | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const isFirstLogin = Boolean(session?.requiresSetup);

  // If an app was interrupted after the password write but before the final
  // wizard acknowledgement, resume safely. We must not ask for the already
  // replaced temporary password a second time.
  useEffect(() => {
    let live = true;
    if (!isFirstLogin) return () => { live = false; };
    void getFirstLoginSetupStatus()
      .then((status) => {
        if (!live) return;
        if (status.needsSetup === false) {
          void refreshSession();
          return;
        }
        if (status.completedSteps?.includes('change_password')) setPasswordSaved(true);
      })
      .catch(() => undefined);
    return () => { live = false; };
  }, [isFirstLogin, refreshSession]);

  const update = (field: keyof FieldErrors, setter: (value: string) => void) => (value: string) => {
    setter(value);
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
    setError(null);
  };

  const finishWithFreshSignIn = async () => {
    // Both server paths invalidate the refresh credential. Explicitly call
    // logout when possible to blacklist this access token too, then always
    // clear device storage even if it was already rejected by the server.
    try {
      await logout();
    } catch {
      // The password endpoint may already have invalidated this token.
    }
    await clearSession('password-updated');
  };

  const finishFirstLogin = async () => {
    await completeFirstLoginSetup();
    await finishWithFreshSignIn();
  };

  const submit = async () => {
    if (submitting) return;
    if (isFirstLogin && passwordSaved) {
      setSubmitting(true);
      setError(null);
      try {
        await finishFirstLogin();
      } catch (caught) {
        setError(authErrorFor(caught, 'password'));
      } finally {
        setSubmitting(false);
      }
      return;
    }

    const errors: FieldErrors = {};
    if (!currentPassword) errors.current = 'Enter your current temporary password.';
    if (nextPassword.length < 12) errors.next = 'Use at least 12 characters.';
    else if (!/[A-Z]/.test(nextPassword) || !/[a-z]/.test(nextPassword) || !/[0-9]/.test(nextPassword)) {
      errors.next = 'Include uppercase, lowercase and a number.';
    }
    if (nextPassword !== confirmPassword) errors.confirm = 'Passwords do not match.';
    if (isFirstLogin && !acceptPolicy) errors.policy = 'Accept the security policy to continue.';
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSubmitting(true);
    setError(null);
    try {
      if (isFirstLogin) {
        // Record non-secret acknowledgements before mutating the temporary
        // credential. This makes a failed acknowledgement retryable.
        await acknowledgeFirstLoginSetup();
        await setFirstLoginPassword(currentPassword, nextPassword);
        setPasswordSaved(true);
        await finishFirstLogin();
      } else {
        await changePassword(currentPassword, nextPassword);
        await finishWithFreshSignIn();
      }
    } catch (caught) {
      setError(authErrorFor(caught, 'password'));
    } finally {
      setSubmitting(false);
    }
  };

  const title = isFirstLogin && passwordSaved ? 'Finish setting up' : isFirstLogin ? 'Set your password' : 'Update your password';
  const subtitle = isFirstLogin && passwordSaved
    ? 'Your password is saved. Complete setup to open your workspace.'
    : isFirstLogin
      ? 'Create a permanent password and accept the security policy before opening your workspace.'
      : 'Your password needs to be updated before you can continue.';

  return (
    <AuthLayout title={title} subtitle={subtitle}>
      <View style={{ gap: t.spacing.scale.lg }}>
        {error ? <AuthMessage message={error.message} /> : null}
        {isFirstLogin && passwordSaved ? (
          <>
            <AuthMessage tone="info" message="Your new password is saved. You can safely finish the remaining setup now." />
            <Button
              label={submitting ? 'Finishing setup…' : 'Finish setup'}
              onPress={() => void submit()}
              loading={submitting}
              fullWidth
            />
          </>
        ) : (
          <>
            <AuthField
              label={isFirstLogin ? 'Current temporary password' : 'Current password'}
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
            <Text role="bodySmall" color="onSurfaceVariant">
              Use at least 12 characters with uppercase, lowercase and a number. Do not reuse a password from another service.
            </Text>
            {isFirstLogin ? (
              <View style={{ gap: t.spacing.scale.xs }}>
                <Pressable
                  onPress={() => {
                    setAcceptPolicy((accepted) => !accepted);
                    setFieldErrors((current) => ({ ...current, policy: undefined }));
                  }}
                  disabled={submitting}
                  accessibilityRole="checkbox"
                  accessibilityLabel="Accept security policy"
                  accessibilityState={{ checked: acceptPolicy, disabled: submitting }}
                  style={{ flexDirection: 'row', gap: t.spacing.scale.sm, minHeight: t.component.button.touchTarget }}
                >
                  <View
                    style={{
                      width: t.spacing.scale.lg,
                      height: t.spacing.scale.lg,
                      marginTop: t.spacing.scale.xs,
                      borderRadius: t.shape.xs as number,
                      borderWidth: acceptPolicy ? 0 : StyleSheet.hairlineWidth,
                      borderColor: t.c.outline as string,
                      backgroundColor: acceptPolicy ? t.c.primary as string : t.c.surface as string,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {acceptPolicy ? <Text role="labelSmall" color="onPrimary">✓</Text> : null}
                  </View>
                  <Text role="bodySmall" color="onSurfaceVariant" style={{ flex: 1 }}>
                    I understand that I must protect my password and verification codes, and use RetailOps only for authorized work.
                  </Text>
                </Pressable>
                {fieldErrors.policy ? <Text role="bodySmall" color="error">{fieldErrors.policy}</Text> : null}
              </View>
            ) : null}
            <Button
              label={submitting ? 'Updating password…' : 'Update password'}
              onPress={() => void submit()}
              loading={submitting}
              fullWidth
            />
          </>
        )}
      </View>
    </AuthLayout>
  );
}
