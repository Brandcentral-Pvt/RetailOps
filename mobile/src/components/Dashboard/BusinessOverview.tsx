import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Card, Text, useTheme } from 'react-native-paper';
import { RADIUS, SPACING } from '../../theme/theme';

interface Metric {
  value: string;
  changePct: number;
}

interface ProductsMetric {
  value: string;
  issueCount: number;
}

interface Props {
  sales: Metric;
  orders: Metric;
  adSpend: Metric;
  products: ProductsMetric;
}

function ChangeIndicator({
  value,
  positive,
  inverse = false,
}: {
  value: number;
  positive: boolean;
  inverse?: boolean;
}) {
  const { colors } = useTheme();

  // For expenses, a negative change is positive.
  const isGood = inverse ? !positive : positive;

  return (
    <Text
      variant="labelMedium"
      style={[
        styles.change,
        {
          color: isGood ? colors.primary : colors.error,
        },
      ]}
    >
      {value >= 0 ? '↑' : '↓'} {Math.abs(value).toFixed(1)}%
    </Text>
  );
}

export default function BusinessOverview({
  sales,
  orders,
  adSpend,
  products,
}: Props) {
  const { colors } = useTheme();

  return (
    <View style={styles.container}>
      <Text
        variant="titleMedium"
        style={[styles.sectionTitle, { color: colors.onSurface }]}
      >
        Business Performance
      </Text>

      {/* Primary sales metric */}
      <Card
        mode="outlined"
        style={[
          styles.salesCard,
          {
            backgroundColor: colors.surface,
            borderColor: colors.outlineVariant,
          },
        ]}
      >
        <Card.Content>
          <View style={styles.salesHeader}>
            <Text
              variant="labelLarge"
              style={[
                styles.label,
                { color: colors.onSurfaceVariant },
              ]}
            >
              SALES
            </Text>

            <View
              style={[
                styles.changeBadge,
                { backgroundColor: colors.primaryContainer },
              ]}
            >
              <ChangeIndicator
                value={sales.changePct}
                positive={sales.changePct >= 0}
              />
            </View>
          </View>

          <Text
            variant="displaySmall"
            style={[
              styles.salesValue,
              { color: colors.onSurface },
            ]}
          >
            {sales.value}
          </Text>

          <Text
            variant="bodySmall"
            style={[
              styles.salesSubtitle,
              { color: colors.onSurfaceVariant },
            ]}
          >
            Ordered revenue
          </Text>

          <View
            style={[
              styles.salesDivider,
              { backgroundColor: colors.outlineVariant },
            ]}
          />

          <View style={styles.salesMeta}>
            <View>
              <Text
                variant="labelSmall"
                style={[
                  styles.metaLabel,
                  { color: colors.onSurfaceVariant },
                ]}
              >
                ORDERS
              </Text>

              <Text
                variant="titleMedium"
                style={[
                  styles.metaValue,
                  { color: colors.onSurface },
                ]}
              >
                {orders.value}
              </Text>
            </View>

            <View
  style={[
    styles.metaSeparator,
    { backgroundColor: colors.outlineVariant },
  ]}
/>

            <View>
              <Text
                variant="labelSmall"
                style={[
                  styles.metaLabel,
                  { color: colors.onSurfaceVariant },
                ]}
              >
                AD SPEND
              </Text>

              <Text
                variant="titleMedium"
                style={[
                  styles.metaValue,
                  { color: colors.onSurface },
                ]}
              >
                {adSpend.value}
              </Text>
            </View>
          </View>
        </Card.Content>
      </Card>

      {/* Secondary metrics */}
      <View style={styles.grid}>
        <Card
          mode="outlined"
          style={[
            styles.secondaryCard,
            {
              backgroundColor: colors.surface,
              borderColor: colors.outlineVariant,
            },
          ]}
        >
          <Card.Content style={styles.secondaryContent}>
            <Text
              variant="labelMedium"
              style={[
                styles.label,
                { color: colors.onSurfaceVariant },
              ]}
            >
              ORDERS
            </Text>

            <Text
              variant="headlineSmall"
              style={[
                styles.secondaryValue,
                { color: colors.onSurface },
              ]}
            >
              {orders.value}
            </Text>

            <ChangeIndicator
              value={orders.changePct}
              positive={orders.changePct >= 0}
            />
          </Card.Content>
        </Card>

        <Card
          mode="outlined"
          style={[
            styles.secondaryCard,
            {
              backgroundColor: colors.surface,
              borderColor: colors.outlineVariant,
            },
          ]}
        >
          <Card.Content style={styles.secondaryContent}>
            <Text
              variant="labelMedium"
              style={[
                styles.label,
                { color: colors.onSurfaceVariant },
              ]}
            >
              AD SPEND
            </Text>

            <Text
              variant="headlineSmall"
              style={[
                styles.secondaryValue,
                { color: colors.onSurface },
              ]}
            >
              {adSpend.value}
            </Text>

            <ChangeIndicator
              value={adSpend.changePct}
              positive={adSpend.changePct >= 0}
              inverse
            />
          </Card.Content>
        </Card>

        <Card
          mode="outlined"
          style={[
            styles.secondaryCard,
            {
              backgroundColor: colors.surface,
              borderColor: colors.outlineVariant,
            },
          ]}
        >
          <Card.Content style={styles.secondaryContent}>
            <Text
              variant="labelMedium"
              style={[
                styles.label,
                { color: colors.onSurfaceVariant },
              ]}
            >
              PRODUCTS
            </Text>

            <Text
              variant="headlineSmall"
              style={[
                styles.secondaryValue,
                { color: colors.onSurface },
              ]}
            >
              {products.value}
            </Text>

            <Text
              variant="labelMedium"
              style={[
                styles.issueText,
                {
                  color:
                    products.issueCount > 0
                      ? colors.error
                      : colors.onSurfaceVariant,
                },
              ]}
            >
              {products.issueCount > 0
                ? `${products.issueCount} need attention`
                : 'No issues'}
            </Text>
          </Card.Content>
        </Card>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: SPACING.lg,
    paddingHorizontal: SPACING.md,
  },

  sectionTitle: {
    fontWeight: '700',
    marginBottom: SPACING.sm,
  },

  salesCard: {
    borderRadius: RADIUS.lg,
  },

  salesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  label: {
    fontWeight: '700',
    letterSpacing: 0.5,
  },

  changeBadge: {
    borderRadius: RADIUS.pill,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 5,
  },

  change: {
    fontWeight: '700',
  },

  salesValue: {
    fontWeight: '700',
    marginTop: SPACING.sm,
    letterSpacing: -0.8,
  },

  salesSubtitle: {
    marginTop: 2,
  },

  salesDivider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: SPACING.md,
  },

  salesMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  metaLabel: {
    fontWeight: '600',
    letterSpacing: 0.4,
  },

  metaValue: {
    fontWeight: '700',
    marginTop: 2,
  },

  metaSeparator: {
    width: StyleSheet.hairlineWidth,
    height: 30,
    marginHorizontal: SPACING.xl,
  },

  grid: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },

  secondaryCard: {
    flex: 1,
    borderRadius: RADIUS.lg,
  },

  secondaryContent: {
    minHeight: 112,
    justifyContent: 'center',
  },

  secondaryValue: {
    fontWeight: '700',
    marginTop: 4,
  },

  issueText: {
    fontWeight: '600',
    marginTop: 4,
  },
});