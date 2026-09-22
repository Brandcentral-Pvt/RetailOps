import React from 'react';
import { StyleSheet, View } from 'react-native';
import {
  Card,
  Text,
  useTheme,
} from 'react-native-paper';

import FluentIcon from '../FluentIcon';

import type { DashboardAdvertising } from '../../data/mockDashboard';
import { RADIUS, SPACING } from '../../theme/theme';
import { formatCurrency } from '../../utils/formatters';

interface Props {
  advertising: DashboardAdvertising;
  onPress?: () => void;
}

export default function AdvertisingSummary({
  advertising,
  onPress,
}: Props) {
  const { colors } = useTheme();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text
            variant="titleMedium"
            style={[
              styles.title,
              { color: colors.onSurface },
            ]}
          >
            Advertising
          </Text>

          <Text
            variant="bodySmall"
            style={[
              styles.subtitle,
              { color: colors.onSurfaceVariant },
            ]}
          >
            Performance across your ad campaigns
          </Text>
        </View>

        <View
          style={[
            styles.iconContainer,
            { backgroundColor: colors.surfaceVariant },
          ]}
        >
          <FluentIcon
            name="fluent:megaphone-20-filled"
            size={20}
            color={colors.onSurfaceVariant}
          />
        </View>
      </View>

      <Card
        mode="outlined"
        style={[
          styles.card,
          {
            backgroundColor: colors.surface,
            borderColor: colors.outlineVariant,
          },
        ]}
        onPress={onPress}
      >
        <Card.Content>
          <View style={styles.primaryRow}>
            <View style={styles.primaryMetric}>
              <Text
                variant="labelMedium"
                style={[
                  styles.label,
                  { color: colors.onSurfaceVariant },
                ]}
              >
                Ad Sales
              </Text>

              <Text
                variant="headlineSmall"
                style={[
                  styles.primaryValue,
                  { color: colors.onSurface },
                ]}
              >
                {formatCurrency(advertising.adSales)}
              </Text>
            </View>

            <View style={styles.roas}>
              <Text
                variant="labelMedium"
                style={[
                  styles.label,
                  { color: colors.onSurfaceVariant },
                ]}
              >
                ROAS
              </Text>

              <Text
                variant="titleLarge"
                style={[
                  styles.roasValue,
                  { color: colors.primary },
                ]}
              >
                {advertising.roas.toFixed(2)}x
              </Text>
            </View>
          </View>

          <View
            style={[
              styles.divider,
              { backgroundColor: colors.outlineVariant },
            ]}
          />

          <View style={styles.metricsRow}>
            <View style={styles.metric}>
              <Text
                variant="labelSmall"
                style={[
                  styles.metricLabel,
                  { color: colors.onSurfaceVariant },
                ]}
              >
                Spend
              </Text>

              <Text
                variant="bodyMedium"
                style={[
                  styles.metricValue,
                  { color: colors.onSurface },
                ]}
              >
                {formatCurrency(advertising.spend)}
              </Text>
            </View>

            <View
              style={[
                styles.metricDivider,
                { backgroundColor: colors.outlineVariant },
              ]}
            />

            <View style={styles.metric}>
              <Text
                variant="labelSmall"
                style={[
                  styles.metricLabel,
                  { color: colors.onSurfaceVariant },
                ]}
              >
                ACOS
              </Text>

              <Text
                variant="bodyMedium"
                style={[
                  styles.metricValue,
                  { color: colors.onSurface },
                ]}
              >
                {advertising.acos.toFixed(2)}%
              </Text>
            </View>

            <FluentIcon
              name="fluent:chevron-right-20-filled"
              size={20}
              color={colors.onSurfaceVariant}
            />
          </View>
        </Card.Content>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: SPACING.lg,
    paddingHorizontal: SPACING.lg,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },

  title: {
    fontWeight: '700',
  },

  subtitle: {
    marginTop: 3,
  },

  iconContainer: {
    width: 38,
    height: 38,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },

  card: {
    borderRadius: RADIUS.lg,
    elevation: 0,
  },

  primaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  primaryMetric: {
    flex: 1,
  },

  label: {
    fontWeight: '500',
  },

  primaryValue: {
    marginTop: SPACING.xs,
    fontWeight: '700',
    letterSpacing: -0.4,
  },

  roas: {
    alignItems: 'flex-end',
  },

  roasValue: {
    marginTop: SPACING.xs,
    fontWeight: '700',
  },

  divider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: SPACING.md,
  },

  metricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  metric: {
    flex: 1,
  },

  metricLabel: {
    fontWeight: '500',
  },

  metricValue: {
    marginTop: 3,
    fontWeight: '600',
  },

  metricDivider: {
    width: StyleSheet.hairlineWidth,
    height: 32,
    marginHorizontal: SPACING.md,
  },
});