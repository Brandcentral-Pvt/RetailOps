import React from 'react';
import { View } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { Text } from '../../components/ui/Text';
import { passwordRequirements, passwordStrength } from './passwordPolicy';

type Props = {
  password: string;
  showStrength?: boolean;
  /** Password history is verified only by the server after submission. */
  includePreviousPassword?: boolean;
};

/** Live, text-labelled password requirements for reset and first-login flows. */
export function PasswordRequirements({ password, showStrength = true, includePreviousPassword = false }: Props) {
  const t = useTheme();
  const requirements = passwordRequirements(password);
  const strength = passwordStrength(password);
  const activeColor = strength.score >= 3 ? t.c.tertiary : strength.score >= 2 ? t.c.primary : t.c.error;

  return (
    <View accessibilityLabel={`Password strength ${strength.label}`} style={{ gap: t.spacing.scale.sm }}>
      {showStrength ? (
        <View style={{ gap: t.spacing.scale.xs }}>
          <View style={{ flexDirection: 'row', gap: t.spacing.scale.xs }}>
            {Array.from({ length: 4 }, (_, index) => (
              <View
                key={index}
                style={{
                  flex: 1,
                  height: t.spacing.scale.xs,
                  borderRadius: t.shape.full as number,
                  backgroundColor: index < strength.score ? activeColor as string : t.c.outlineVariant as string,
                }}
              />
            ))}
          </View>
          <Text role="labelMedium" color="onSurfaceVariant">Password strength: {strength.label}</Text>
        </View>
      ) : null}
      <View style={{ gap: t.spacing.scale.xs }}>
        {requirements.map((requirement) => (
          <View key={requirement.id} style={{ flexDirection: 'row', gap: t.spacing.scale.sm, alignItems: 'center' }}>
            <Text role="labelMedium" color={requirement.met ? 'primary' : 'onSurfaceVariant'}>
              {requirement.met ? '✓' : '○'}
            </Text>
            <Text role="bodySmall" color={requirement.met ? 'onSurface' : 'onSurfaceVariant'}>{requirement.label}</Text>
          </View>
        ))}
        {includePreviousPassword ? (
          <View style={{ flexDirection: 'row', gap: t.spacing.scale.sm, alignItems: 'center' }}>
            <Text role="labelMedium" color="onSurfaceVariant">○</Text>
            <Text role="bodySmall" color="onSurfaceVariant">Not a previous password</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}
