import React from 'react';
import { View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Button } from '../../components/ui/Button';
import { Text } from '../../components/ui/Text';
import { useTheme } from '../../theme/ThemeProvider';
import type { AuthStackParamList } from '../../nav/AuthNavigator';
import { AuthLayout } from './AuthLayout';

type Props = NativeStackScreenProps<AuthStackParamList, 'AccountLocked'>;

export function AccountLockedScreen({ navigation, route }: Props) {
  const t = useTheme();
  return (
    <AuthLayout
      title="Account temporarily locked"
      subtitle="Too many unsuccessful sign-in attempts were detected. For your security, please wait before trying again."
    >
      <View style={{ gap: t.spacing.scale.lg }}>
        <Text role="bodyMedium" color="onSurfaceVariant" center>
          If you need access sooner, contact your RetailOps administrator and mention {route.params.email || 'your work email'}.
        </Text>
        <Button
          label="Back to sign in"
          onPress={() => navigation.reset({ index: 0, routes: [{ name: 'SignIn', params: { email: route.params.email, reset: Date.now() } }] })}
          fullWidth
        />
      </View>
    </AuthLayout>
  );
}
