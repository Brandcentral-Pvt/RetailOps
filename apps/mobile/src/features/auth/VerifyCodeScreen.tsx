import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuthStore } from '../../auth/authStore';
import { authCopy, authErrorFor, maskDestination, type AuthError } from '../../auth/authErrors';
import { resendOtp, verifyOtp } from '../../services/authService';
import { Button } from '../../components/ui/Button';
import { Text } from '../../components/ui/Text';
import { useTheme } from '../../theme/ThemeProvider';
import type { AuthStackParamList } from '../../nav/AuthNavigator';
import { AuthField } from './AuthField';
import { AuthLayout } from './AuthLayout';
import { AuthMessage } from './AuthMessage';
import { formatCountdown, useCountdown } from './useCountdown';

type Props = NativeStackScreenProps<AuthStackParamList, 'VerifyCode'>;

export function VerifyCodeScreen({ navigation, route }: Props) {
  const t = useTheme();
  const signInWithTokens = useAuthStore((state) => state.signInWithTokens);
  const [code, setCode] = useState('');
  const [trustDevice, setTrustDevice] = useState(false);
  const [error, setError] = useState<AuthError | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [expiresAt, setExpiresAt] = useState(() => Date.now() + Math.max(route.params.expiresIn, 0) * 1000);
  const [resendAt, setResendAt] = useState(() => Date.now() + 60_000);
  const expiresIn = useCountdown(expiresAt);
  const resendIn = useCountdown(resendAt);
  const busy = submitting || resending;
  const destination = useMemo(
    () => maskDestination(route.params.destination, route.params.email),
    [route.params.destination, route.params.email],
  );
  const terminal = error?.code === 'otp-attempts' || error?.code === 'session-expired';

  const backToSignIn = () => {
    navigation.reset({
      index: 0,
      routes: [{ name: 'SignIn', params: { email: route.params.email, reset: Date.now() } }],
    });
  };

  const submit = async () => {
    if (busy || terminal) return;
    if (expiresIn <= 0) {
      setError({ code: 'otp-expired', message: authCopy('otp-expired'), retryAfter: null });
      return;
    }
    if (!/^\d{6}$/.test(code)) {
      setError({ code: 'otp-invalid', message: 'Enter all six digits of your verification code.', retryAfter: null });
      return;
    }

    setSubmitting(true);
    setError(null);
    setNotice(null);
    try {
      const result = await verifyOtp(route.params.tempToken, code, trustDevice);
      await signInWithTokens({ accessToken: result.accessToken, refreshToken: result.refreshToken });
    } catch (caught) {
      const mapped = authErrorFor(caught, 'otp');
      setError(mapped);
      if (mapped.code === 'session-expired') backToSignIn();
    } finally {
      setSubmitting(false);
    }
  };

  const resend = async () => {
    if (busy || resendIn > 0 || error?.code === 'session-expired') return;
    setResending(true);
    setError(null);
    setNotice(null);
    try {
      const result = await resendOtp(route.params.tempToken);
      const lifetime = typeof result.expiresIn === 'number' && result.expiresIn >= 0 ? result.expiresIn : 300;
      setCode('');
      setExpiresAt(Date.now() + lifetime * 1000);
      setResendAt(Date.now() + 60_000);
      setNotice('A new code has been sent.');
    } catch (caught) {
      setError(authErrorFor(caught, 'resend'));
    } finally {
      setResending(false);
    }
  };

  const expiresLabel = expiresIn > 0 ? `Expires in ${formatCountdown(expiresIn)}` : 'Code expired';
  const resendLabel = resending ? 'Sending a new code…' : resendIn > 0 ? `Resend code in ${formatCountdown(resendIn)}` : 'Resend code';

  return (
    <AuthLayout
      title="Verify your identity"
      subtitle={`Enter the verification code sent to ${destination}.`}
    >
      <View style={{ gap: t.spacing.scale.lg }}>
        {error ? <AuthMessage message={error.message} /> : null}
        {notice ? <AuthMessage message={notice} tone="success" /> : null}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text role="labelLarge">Verification code</Text>
          <Text role="labelMedium" color={expiresIn > 0 ? 'onSurfaceVariant' : 'error'}>{expiresLabel}</Text>
        </View>
        <AuthField
          label="6-digit code"
          value={code}
          onChangeText={(value) => {
            setCode(value.replace(/\D/g, ''));
            setError(null);
            setNotice(null);
          }}
          placeholder="••••••"
          secure
          editable={!busy && expiresIn > 0 && !terminal}
          keyboardType="number-pad"
          autoComplete="one-time-code"
          textContentType="oneTimeCode"
          returnKeyType="done"
          maxLength={6}
          onSubmitEditing={() => void submit()}
          error={error?.code === 'otp-invalid' ? error.message : null}
          accessibilityHint="Enter the six digit code sent to your work email."
        />
        <Pressable
          onPress={() => setTrustDevice((value) => !value)}
          disabled={busy || terminal}
          accessibilityRole="checkbox"
          accessibilityLabel="Trust this device for 12 hours"
          accessibilityHint="Use only on a personal or company-issued device."
          accessibilityState={{ checked: trustDevice, disabled: busy || terminal }}
          style={{ flexDirection: 'row', gap: t.spacing.scale.sm, alignItems: 'flex-start', minHeight: t.component.button.touchTarget }}
        >
          <View
            style={{
              width: t.spacing.scale.lg,
              height: t.spacing.scale.lg,
              marginTop: t.spacing.scale.xs,
              borderRadius: t.shape.xs as number,
              borderWidth: trustDevice ? 0 : StyleSheet.hairlineWidth,
              borderColor: t.c.outline as string,
              backgroundColor: trustDevice ? t.c.primary as string : t.c.surface as string,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {trustDevice ? <Text role="labelSmall" color="onPrimary">✓</Text> : null}
          </View>
          <View style={{ flex: 1, gap: t.spacing.scale.xxs }}>
            <Text role="labelLarge">Trust this device for 12 hours</Text>
            <Text role="bodySmall" color="onSurfaceVariant">Only on a device you own. Never on a shared device.</Text>
          </View>
        </Pressable>
        <Button
          label={submitting ? 'Verifying…' : 'Verify and continue'}
          onPress={() => void submit()}
          loading={submitting}
          disabled={resending || terminal || expiresIn <= 0}
          fullWidth
        />
        <View style={{ alignItems: 'center', gap: t.spacing.scale.xs }}>
          <Text role="bodySmall" color="onSurfaceVariant">Didn&apos;t receive the code?</Text>
          <Button
            label={resendLabel}
            onPress={() => void resend()}
            variant="text"
            disabled={busy || resendIn > 0 || error?.code === 'session-expired'}
          />
        </View>
        <Button label="Back to sign in" onPress={backToSignIn} variant="text" disabled={submitting} fullWidth />
      </View>
    </AuthLayout>
  );
}
