import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import {
  Card,
  Text,
  useTheme,
} from 'react-native-paper';

import FluentIcon from '../FluentIcon';

import type { DashboardProduct } from '../../data/mockDashboard';
import { RADIUS, SPACING } from '../../theme/theme';
import {
  formatCurrency,
  formatNumber,
} from '../../utils/formatters';

interface Props {
  products: DashboardProduct[];
  onProductPress?: (product: DashboardProduct) => void;
}

export default function TopProducts({
  products,
  onProductPress,
}: Props) {
  const { colors } = useTheme();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text
          variant="titleMedium"
          style={[
            styles.title,
            { color: colors.onSurface },
          ]}
        >
          Top Products
        </Text>

        <Text
          variant="labelMedium"
          style={[
            styles.viewAll,
            { color: colors.primary },
          ]}
        >
          View all
        </Text>
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
      >
        {products.map((product, index) => {
          const positive = product.changePct >= 0;

          return (
            <View key={product.id}>
              <View
                style={styles.row}
                onTouchEnd={() => onProductPress?.(product)}
              >
                <View
                  style={[
                    styles.rank,
                    {
                      backgroundColor:
                        colors.surfaceVariant,
                    },
                  ]}
                >
                  <Text
                    variant="labelMedium"
                    style={[
                      styles.rankText,
                      { color: colors.onSurfaceVariant },
                    ]}
                  >
                    {index + 1}
                  </Text>
                </View>

                <View
                  style={[
                    styles.productImage,
                    {
                      backgroundColor:
                        colors.surfaceVariant,
                    },
                  ]}
                >
                  {product.imageUrl ? (
                    <Image
                      source={{ uri: product.imageUrl }}
                      style={styles.productImageContent}
                      resizeMode="cover"
                    />
                  ) : (
                    <FluentIcon
                      name="fluent:box-20-filled"
                      size={21}
                      color={colors.onSurfaceVariant}
                    />
                  )}
                </View>

                <View style={styles.productInfo}>
                  <Text
                    variant="bodyMedium"
                    style={[
                      styles.productTitle,
                      { color: colors.onSurface },
                    ]}
                    numberOfLines={1}
                  >
                    {product.title}
                  </Text>

                  <View style={styles.metaRow}>
                    <Text
                      variant="labelSmall"
                      style={[
                        styles.meta,
                        { color: colors.onSurfaceVariant },
                      ]}
                    >
                      {product.sku}
                    </Text>

                    <Text
                      variant="labelSmall"
                      style={[
                        styles.separator,
                        { color: colors.outline },
                      ]}
                    >
                      •
                    </Text>

                    <Text
                      variant="labelSmall"
                      style={[
                        styles.meta,
                        { color: colors.onSurfaceVariant },
                      ]}
                    >
                      {product.marketplace}
                    </Text>
                  </View>
                </View>

                <View style={styles.sales}>
                  <Text
                    variant="bodyMedium"
                    style={[
                      styles.salesValue,
                      { color: colors.onSurface },
                    ]}
                  >
                    {formatCurrency(product.sales)}
                  </Text>

                  <Text
                    variant="labelSmall"
                    style={[
                      styles.units,
                      { color: colors.onSurfaceVariant },
                    ]}
                  >
                    {formatNumber(product.units)} units
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
                      product.changePct,
                    ).toFixed(1)}
                    %
                  </Text>
                </View>

                <FluentIcon
                  name="fluent:chevron-right-20-filled"
                  size={19}
                  color={colors.onSurfaceVariant}
                />
              </View>

              {index < products.length - 1 ? (
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

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },

  title: {
    fontWeight: '700',
  },

  viewAll: {
    fontWeight: '600',
  },

  card: {
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    elevation: 0,
  },

  row: {
    minHeight: 78,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
  },

  rank: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.xs,
  },

  rankText: {
    fontWeight: '700',
  },

  productImage: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.md,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.sm,
  },

  productImageContent: {
    width: '100%',
    height: '100%',
  },

  productInfo: {
    flex: 1,
    minWidth: 0,
    marginRight: SPACING.xs,
  },

  productTitle: {
    fontWeight: '600',
  },

  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },

  meta: {
    flexShrink: 1,
  },

  separator: {
    marginHorizontal: 5,
  },

  sales: {
    alignItems: 'flex-end',
    marginRight: SPACING.xs,
  },

  salesValue: {
    fontWeight: '700',
  },

  units: {
    marginTop: 2,
  },

  change: {
    marginTop: 2,
    fontWeight: '600',
  },

  divider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 84,
  },
});