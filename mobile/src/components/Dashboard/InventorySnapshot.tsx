import React from 'react';
import { StyleSheet, View } from 'react-native';
import {
  Card,
  Text,
  useTheme,
} from 'react-native-paper';

import FluentIcon from '../FluentIcon';

import type { DashboardInventory } from '../../data/mockDashboard';
import { RADIUS, SPACING } from '../../theme/theme';
import { formatNumber } from '../../utils/formatters';

interface Props {
  inventory: DashboardInventory;
  onPress?: () => void;
}

export default function InventorySnapshot({
  inventory,
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
            Inventory
          </Text>

          <Text
            variant="bodySmall"
            style={[
              styles.subtitle,
              { color: colors.onSurfaceVariant },
            ]}
          >
            Current product stock status
          </Text>
        </View>

        <FluentIcon
          name="fluent:chevron-right-20-filled"
          size={20}
          color={colors.onSurfaceVariant}
        />
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
          <View style={styles.totalRow}>
            <View>
              <Text
                variant="labelMedium"
                style={[
                  styles.label,
                  { color: colors.onSurfaceVariant },
                ]}
              >
                Total Products
              </Text>

              <Text
                variant="headlineSmall"
                style={[
                  styles.total,
                  { color: colors.onSurface },
                ]}
              >
                {formatNumber(inventory.total)}
              </Text>
            </View>

            <View
              style={[
                styles.iconContainer,
                { backgroundColor: colors.surfaceVariant },
              ]}
            >
              <FluentIcon
              name="fluent:box-20-filled"
              size={21}
              color={colors.onSurfaceVariant}
            />
            </View>
          </View>

          <View style={styles.statusRow}>
            <InventoryStatus
              label="Healthy"
              value={inventory.healthy}
              color={colors.primary}
              backgroundColor={colors.primaryContainer}
            />

            <InventoryStatus
              label="Low Stock"
              value={inventory.lowStock}
              color={colors.error}
              backgroundColor={colors.errorContainer}
            />

            <InventoryStatus
              label="Out of Stock"
              value={inventory.outOfStock}
              color={colors.error}
              backgroundColor={colors.errorContainer}
            />
          </View>
        </Card.Content>
      </Card>
    </View>
  );
}

interface InventoryStatusProps {
  label: string;
  value: number;
  color: string;
  backgroundColor: string;
}

function InventoryStatus({
  label,
  value,
  color,
  backgroundColor,
}: InventoryStatusProps) {
  return (
    <View style={styles.status}>
      <View
        style={[
          styles.statusIndicator,
          { backgroundColor },
        ]}
      >
        <Text
          variant="titleMedium"
          style={[
            styles.statusValue,
            { color },
          ]}
        >
          {formatNumber(value)}
        </Text>
      </View>

      <Text
        variant="labelSmall"
        style={styles.statusLabel}
      >
        {label}
      </Text>
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

  card: {
    borderRadius: RADIUS.lg,
    elevation: 0,
  },

  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  label: {
    fontWeight: '500',
  },

  total: {
    marginTop: SPACING.xs,
    fontWeight: '700',
  },

  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },

  statusRow: {
    flexDirection: 'row',
    marginTop: SPACING.lg,
  },

  status: {
    flex: 1,
  },

  statusIndicator: {
    alignSelf: 'flex-start',
    minWidth: 48,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 5,
    alignItems: 'center',
  },

  statusValue: {
    fontWeight: '700',
  },

  statusLabel: {
    marginTop: 5,
    color: '#6B7280',
  },
});