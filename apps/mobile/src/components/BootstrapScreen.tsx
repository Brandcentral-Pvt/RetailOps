import React, { useEffect } from 'react';
import { ActivityIndicator, Image, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { useAuthStore } from '../auth/authStore';
import { Text } from './ui/Text';

/** AUTH-01 — restores a stored session before the app decides where to go. */
export function BootstrapScreen() {
  const t = useTheme();
  const bootstrap = useAuthStore((s) => s.bootstrap);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  return (
    <View
      accessibilityLabel="Starting RetailOps"
      style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: t.spacing.scale.md, backgroundColor: t.c.surface as string }}
    >
      <Image
        source={require('../../assets/brandcentral-logo.png')}
        accessibilityLabel="BrandCentral"
        resizeMode="contain"
        style={{ width: t.component.avatar.xl, height: t.component.avatar.xl }}
      />
      <View style={{ alignItems: 'center', gap: t.spacing.scale.xs }}>
        <Text role="headlineSmall">RetailOps</Text>
        <Text role="labelMedium" color="onSurfaceVariant">E-commerce operations</Text>
      </View>
      <ActivityIndicator accessibilityLabel="Loading" color={t.c.primary as string} />
    </View>
  );
}
