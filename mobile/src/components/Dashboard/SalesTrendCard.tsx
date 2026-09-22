import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  Card,
  Text,
  useTheme,
} from 'react-native-paper';

import type { DashboardSalesPoint } from '../../data/mockDashboard';
import { RADIUS, SPACING } from '../../theme/theme';
import { formatCurrency } from '../../utils/formatters';

interface Props {
  totalSales: string;
  changePct: number;
  data?: DashboardSalesPoint[];
}

const CHART_HEIGHT = 150;

export default function SalesTrendCard({
  totalSales,
  changePct,
  data = [],
}: Props) {
  const { colors } = useTheme();

  const chartData = useMemo(
    () => (Array.isArray(data) ? data : []),
    [data],
  );

  const values = chartData.map((point) => point.value);

  const maxValue =
    values.length > 0
      ? Math.max(...values)
      : 0;

  const minValue =
    values.length > 0
      ? Math.min(...values)
      : 0;

  const range = maxValue - minValue || 1;

  const changePositive = changePct >= 0;

  return (
    <View style={styles.container}>
      <View style={styles.sectionHeader}>
        <Text
          variant="titleMedium"
          style={[
            styles.title,
            { color: colors.onSurface },
          ]}
        >
          Sales Performance
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
        <Card.Content>
          <View style={styles.summaryRow}>
            <View>
              <Text
                variant="labelMedium"
                style={[
                  styles.label,
                  { color: colors.onSurfaceVariant },
                ]}
              >
                Total Sales
              </Text>

              <Text
                variant="headlineSmall"
                style={[
                  styles.totalSales,
                  { color: colors.onSurface },
                ]}
              >
                {totalSales}
              </Text>
            </View>

            <View
              style={[
                styles.changeBadge,
                {
                  backgroundColor: changePositive
                    ? colors.primaryContainer
                    : colors.errorContainer,
                },
              ]}
            >
              <Text
                variant="labelMedium"
                style={{
                  color: changePositive
                    ? colors.primary
                    : colors.error,
                  fontWeight: '700',
                }}
              >
                {changePositive ? '↑' : '↓'}{' '}
                {Math.abs(changePct).toFixed(1)}%
              </Text>
            </View>
          </View>

          <View style={styles.chartContainer}>
            {chartData.length > 0 ? (
              <>
                <View style={styles.grid}>
                  <View
                    style={[
                      styles.gridLine,
                      { backgroundColor: colors.outlineVariant },
                    ]}
                  />
                  <View
                    style={[
                      styles.gridLine,
                      { backgroundColor: colors.outlineVariant },
                    ]}
                  />
                  <View
                    style={[
                      styles.gridLine,
                      { backgroundColor: colors.outlineVariant },
                    ]}
                  />
                  <View
                    style={[
                      styles.gridLine,
                      { backgroundColor: colors.outlineVariant },
                    ]}
                  />
                </View>

                <View style={styles.bars}>
                  {chartData.map((point, index) => {
                    const normalized =
                      (point.value - minValue) / range;

                    const height = Math.max(
                      8,
                      normalized * CHART_HEIGHT,
                    );

                    return (
                      <View
                        key={`${point.date}-${index}`}
                        style={styles.barColumn}
                      >
                        <View
                          style={[
                            styles.bar,
                            {
                              height,
                              backgroundColor:
                                colors.primary,
                            },
                          ]}
                        />
                      </View>
                    );
                  })}
                </View>
              </>
            ) : (
              <View style={styles.emptyState}>
                <Text
                  variant="bodyMedium"
                  style={{
                    color: colors.onSurfaceVariant,
                  }}
                >
                  No sales data available
                </Text>
              </View>
            )}
          </View>

          {chartData.length > 0 ? (
            <View style={styles.axis}>
              <Text
                variant="labelSmall"
                style={[
                  styles.axisText,
                  { color: colors.onSurfaceVariant },
                ]}
              >
                {chartData[0]?.date ?? ''}
              </Text>

              <Text
                variant="labelSmall"
                style={[
                  styles.axisText,
                  { color: colors.onSurfaceVariant },
                ]}
              >
                {chartData[
                  Math.floor(chartData.length / 2)
                ]?.date ?? ''}
              </Text>

              <Text
                variant="labelSmall"
                style={[
                  styles.axisText,
                  { color: colors.onSurfaceVariant },
                ]}
              >
                {chartData[chartData.length - 1]?.date ?? ''}
              </Text>
            </View>
          ) : null}
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

  sectionHeader: {
    marginBottom: SPACING.sm,
  },

  title: {
    fontWeight: '700',
  },

  card: {
    borderRadius: RADIUS.lg,
    elevation: 0,
    overflow: 'hidden',
  },

  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  label: {
    fontWeight: '500',
  },

  totalSales: {
    marginTop: SPACING.xs,
    fontWeight: '700',
    letterSpacing: -0.4,
  },

  changeBadge: {
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
  },

  chartContainer: {
    height: CHART_HEIGHT,
    marginTop: SPACING.lg,
    position: 'relative',
  },

  grid: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
  },

  gridLine: {
    height: StyleSheet.hairlineWidth,
    width: '100%',
  },

  bars: {
    height: CHART_HEIGHT,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },

  barColumn: {
    flex: 1,
    height: CHART_HEIGHT,
    marginHorizontal: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },

  bar: {
    width: '65%',
    minHeight: 8,
    borderRadius: 4,
  },

  axis: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: SPACING.xs,
  },

  axisText: {
    fontSize: 10,
  },

  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});