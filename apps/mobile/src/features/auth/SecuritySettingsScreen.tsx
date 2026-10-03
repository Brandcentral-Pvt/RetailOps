import React from 'react';
import { Pressable, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuthStore } from '../../auth/authStore';
import { sessionSatisfies } from '../../auth/permissions';
import { Button } from '../../components/ui/Button';
import { Surface } from '../../components/ui/Surface';
import { Text } from '../../components/ui/Text';
import { useTheme } from '../../theme/ThemeProvider';

function SettingLink({ title, description, onPress }: { title: string; description: string; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
      style={{ minHeight: t.component.button.touchTarget }}
    >
      <Surface tone="surface" radius="md" style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.scale.md }}>
        <View style={{ flex: 1, gap: t.spacing.scale.xxs }}>
          <Text role="titleSmall">{title}</Text>
          <Text role="bodySmall" color="onSurfaceVariant">{description}</Text>
        </View>
        <Text role="titleSmall" color="primary">›</Text>
      </Surface>
    </Pressable>
  );
}

/** Account-security entry point rendered in the existing More/Preferences routes. */
export function SecuritySettingsScreen({ seller = false }: { seller?: boolean }) {
  const t = useTheme();
  const navigation = useNavigation();
  const session = useAuthStore((state) => state.session);
  const signOut = useAuthStore((state) => state.signOut);
  const canManageSettings = sessionSatisfies(session, 'settings_manage');

  return (
    <View style={{ flex: 1, backgroundColor: t.c.pageBackground as string, padding: t.padding, gap: t.spacing.scale.lg }}>
      <View style={{ gap: t.spacing.scale.xs }}>
        <Text role="headlineSmall">{seller ? 'Account & preferences' : 'Security'}</Text>
        <Text role="bodyMedium" color="onSurfaceVariant">Manage how this device accesses your RetailOps account.</Text>
      </View>
      <View style={{ gap: t.spacing.scale.sm }}>
        <SettingLink
          title="Trusted devices"
          description="Review devices that can skip a verification code."
          onPress={() => navigation.navigate('TrustedDevices' as never)}
        />
        <SettingLink
          title="Biometric unlock"
          description="Use enrolled device security when restoring your session."
          onPress={() => navigation.navigate('BiometricUnlock' as never)}
        />
        {canManageSettings ? (
          <SettingLink
            title="System setup"
            description="Configure marketplace automation and its current schedule."
            onPress={() => navigation.navigate('SystemSetup' as never)}
          />
        ) : null}
      </View>
      <Button label="Sign out" onPress={() => void signOut()} variant="outlined" fullWidth />
    </View>
  );
}
