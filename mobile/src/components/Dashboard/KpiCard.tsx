import React from 'react';
import { StyleSheet, View } from 'react-native';
import {
  Card,
  IconButton,
  Text,
  useTheme,
} from 'react-native-paper';

import { RADIUS, SPACING } from '../../theme/theme';

interface Props {
  label: string;
  value: string;
  delta?: string;
  deltaPositive?: boolean;
  icon?: string;
  subtitle?: string;
}

export default function KpiCard({
  label,
  value,
  delta,
  deltaPositive,
  icon,
  subtitle,
}: Props) {
  const { colors } = useTheme();

  const deltaColor =
    deltaPositive === undefined
      ? colors.onSurfaceVariant
      : deltaPositive
        ? colors.primary
        : colors.error;

  return (
    <Card
      mode="outlined"
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.outlineVariant,
        },
      ]}
    >
      <Card.Content style={styles.content}>
        <View style={styles.topRow}>
          <Text
            variant="labelMedium"
            style={[
              styles.label,
              { color: colors.onSurfaceVariant },
            ]}
          >
            {label}
          </Text>

          {icon ? (
            <View
              style={[
                styles.iconContainer,
                {
                  backgroundColor: colors.surfaceVariant,
                },
              ]}
            >
              <IconButton
                icon={icon}
                size={17}
                iconColor={colors.onSurfaceVariant}
                style={styles.icon}
              />
            </View>
          ) : null}
        </View>

        <Text
          variant="headlineSmall"
          style={[
            styles.value,
            { color: colors.onSurface },
          ]}
        >
          {value}
        </Text>

        {(delta || subtitle) && (
          <View style={styles.metaRow}>
            {delta ? (
              <Text
                variant="labelSmall"
                style={[
                  styles.delta,
                  { color: deltaColor },
                ]}
              >
                {delta}
              </Text>
            ) : null}

            {subtitle ? (
              <Text
                variant="labelSmall"
                style={[
                  styles.subtitle,
                  { color: colors.onSurfaceVariant },
                ]}
              >
                {subtitle}
              </Text>
            ) : null}
          </View>
        )}
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: RADIUS.lg,
    elevation: 0,
  },

  content: {
    paddingVertical: SPACING.md,
  },

  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  label: {
    flex: 1,
    fontWeight: '500',
  },

  iconContainer: {
    width: 30,
    height: 30,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },

  icon: {
    margin: 0,
  },

  value: {
    marginTop: SPACING.sm,
    fontWeight: '700',
    letterSpacing: -0.4,
  },

  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginTop: SPACING.xs,
  },

  delta: {
    fontWeight: '600',
    marginRight: 5,
  },

  subtitle: {
    flexShrink: 1,
  },
});