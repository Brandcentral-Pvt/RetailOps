import React, { useMemo } from 'react';
import { Alert, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Button } from '../../components/ui/Button';
import { Chip } from '../../components/ui/Chip';
import { Surface } from '../../components/ui/Surface';
import { Text } from '../../components/ui/Text';
import { useTheme } from '../../theme/ThemeProvider';
import type { AuthStackParamList } from '../../nav/AuthNavigator';
import { AuthLayout } from './AuthLayout';
import { formatCountdown, useCountdown } from './useCountdown';

type Props = NativeStackScreenProps<AuthStackParamList, 'AccountLocked'>;

/** AUTH-13 — terminal until server-provided lock time expires. */
export function AccountLockedScreen({ navigation, route }: Props) {
  const t = useTheme();
  const deadline = useMemo(
    () => route.params.retryAfter && route.params.retryAfter > 0 ? Date.now() + route.params.retryAfter * 1000 : null,
    [route.params.retryAfter],
  );
  const remaining = useCountdown(deadline);
  const canRetry = remaining === 0;
  const lockedUntil = deadline
    ? new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit' }).format(new Date(deadline))
    : null;

  const returnToSignIn = () => {
    navigation.reset({ index: 0, routes: [{ name: 'SignIn', params: { email: route.params.email, reset: Date.now() } }] });
  };

  return (
    <AuthLayout
      title="Account temporarily locked"
      subtitle={remaining > 0 ? `Too many failed sign-in attempts. Try again in ${formatCountdown(remaining)}.` : 'The protection period has ended. You can try again now.'}
    >
      <View style={{ gap: t.spacing.scale.lg }}>
        <View style={{ alignItems: 'center', gap: t.spacing.scale.sm }}>
          <Surface tone="surfaceContainerLow" radius="full" style={{ width: t.component.avatar.lg, height: t.component.avatar.lg, alignItems: 'center', justifyContent: 'center' }}>
            <Text role="headlineMedium" color="tertiary">!</Text>
          </Surface>
          <Chip label="Sign-in protection active" tone="warning" />
        </View>
        <Surface tone="surfaceContainerLow" radius="md" style={{ alignItems: 'center', gap: t.spacing.scale.xs }}>
          <Text role="labelLarge" color="onSurfaceVariant">Locked until</Text>
          <Text role="headlineSmall">{lockedUntil ?? 'the protection period ends'}</Text>
          {remaining > 0 ? <Text role="bodySmall" color="onSurfaceVariant">{formatCountdown(remaining)} remaining</Text> : null}
        </Surface>
        <Text role="bodyMedium" color="onSurfaceVariant" center>
          If you did not make these attempts or need urgent access, contact your RetailOps administrator.
        </Text>
        <Button
          label="Contact your administrator"
          onPress={() => Alert.alert('Contact your administrator', 'Use your organisation’s usual support channel to request help with your RetailOps account.')}
          variant="outlined"
          fullWidth
        />
        <Button
          label={remaining > 0 ? `Try again in ${formatCountdown(remaining)}` : 'Try again'}
          onPress={returnToSignIn}
          disabled={!canRetry}
          variant="text"
          fullWidth
        />
      </View>
    </AuthLayout>
  );
}
