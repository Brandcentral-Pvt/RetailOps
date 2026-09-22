import React from 'react';
import { StyleSheet, View } from 'react-native';
import {
  Card,
  Text,
  useTheme,
} from 'react-native-paper';

import FluentIcon from '../FluentIcon';

import type { DashboardMarketplace } from '../../data/mockDashboard';
import { RADIUS, SPACING } from '../../theme/theme';
import {
  formatCurrency,
  formatNumber,
} from '../../utils/formatters';

interface Props {
  marketplaces: DashboardMarketplace[];
}

const MARKETPLACE_ICON = 'fluent-color:building-store-20';

export default function MarketplacePerformance({
  marketplaces,
}: Props) {
  const { colors } = useTheme();

  return (
    <View style={styles.container}>
      <Text
        variant="titleMedium"
        style={[
          styles.sectionTitle,
          { color: colors.onSurface },
        ]}
      >
        Marketplace Performance
      </Text>

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
        {marketplaces.map((marketplace, index) => {
          const positive = marketplace.changePct >= 0;

          return (
            <View key={marketplace.id}>
              <View style={styles.row}>
                <View
                  style={[
                    styles.iconContainer,
                    {
                      backgroundColor:
                        colors.surfaceVariant,
                    },
                  ]}
                >
                  <FluentIcon
                    name={MARKETPLACE_ICON}
                    size={19}
                  />
                </View>

                <View style={styles.marketplaceInfo}>
                  <Text
                    variant="bodyMedium"
                    style={[
                      styles.name,
                      { color: colors.onSurface },
                    ]}
                  >
                    {marketplace.name}
                  </Text>

                  <Text
                    variant="labelSmall"
                    style={[
                      styles.orders,
                      { color: colors.onSurfaceVariant },
                    ]}
                  >
                    {formatNumber(marketplace.orders)} orders
                  </Text>
                </View>

                <View style={styles.performance}>
                  <Text
                    variant="bodyMedium"
                    style={[
                      styles.sales,
                      { color: colors.onSurface },
                    ]}
                  >
                    {formatCurrency(marketplace.sales)}
                  </Text>

                  <Text
                    variant="labelSmall"
                    style={[
                      styles.change,
                      {
                        color: positive
                          ? colors.primary
                          : colors.error,
                      },
                    ]}
                  >
                    {positive ? '↑' : '↓'}{' '}
                    {Math.abs(
                      marketplace.changePct,
                    ).toFixed(1)}
                    %
                  </Text>
                </View>

                <FluentIcon
                  name="fluent:chevron-right-20-filled"
                  size={20}
                  color={colors.onSurfaceVariant}
                />
              </View>

              {index < marketplaces.length - 1 ? (
                <View
                  style={[
                    styles.divider,
                    {
                      backgroundColor:
                        colors.outlineVariant,
                    },
                  ]}
                />
              ) : null}
            </View>
          );
        })}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: SPACING.lg,
    paddingHorizontal: SPACING.lg,
  },

  sectionTitle: {
    fontWeight: '700',
    marginBottom: SPACING.sm,
  },

  card: {
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    elevation: 0,
  },

  row: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
  },

  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.sm,
  },

  marketplaceInfo: {
    flex: 1,
    minWidth: 0,
  },

  name: {
    fontWeight: '600',
  },

  orders: {
    marginTop: 3,
  },

  performance: {
    alignItems: 'flex-end',
    marginRight: SPACING.sm,
  },

  sales: {
    fontWeight: '700',
  },

  change: {
    marginTop: 3,
    fontWeight: '600',
  },

  divider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 68,
  },
});