import React, { useEffect } from 'react';
import { View } from 'react-native';
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
      style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: t.c.pageBackground as string }}
    >
      <Text role="displaySmall" color="primary">RetailOps</Text>
    </View>
  );
}
