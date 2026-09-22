import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import {
  ActivityIndicator,
  Button,
  Card,
  Chip,
  Divider,
  Icon,
  IconButton,
  Text,
  useTheme,
} from 'react-native-paper';

import adsService from '../../services/adsService';
import { RADIUS, SPACING } from '../../theme/theme';

type PeriodKey = '7d' | '30d' | '3m' | '1y';

type InsightType =
  | 'positive'
  | 'warning'
  | 'opportunity'
  | 'info';

interface Metric {
  value: number;
  changePct?: number;
}

interface AdsSeriesPoint {
  date: string;
  sales: number;
  spend: number;
}

interface AdsInsight {
  id: string;
  type: InsightType;
  title: string;
  description: string;
}

interface AdsPerformanceRow {
  id: string;
  name: string;
  campaign?: string;
  sales: number;
  spend: number;
  roas: number;
  acos: number;
}

interface AdsViewModel {
  adSales: Metric;
  adSpend: Metric;
  roas: Metric;
  acos: Metric;
  series: AdsSeriesPoint[];
  insights: AdsInsight[];
  table: AdsPerformanceRow[];
}

const EMPTY_DATA: AdsViewModel = {
  adSales: {
    value: 0,
  },
  adSpend: {
    value: 0,
  },
  roas: {
    value: 0,
  },
  acos: {
    value: 0,
  },
  series: [],
  insights: [],
  table: [],
};

/* -------------------------------------------------------------------------- */
/* Formatting                                                                  */
/* -------------------------------------------------------------------------- */

function formatCurrency(value: number): string {
  if (!Number.isFinite(value)) {
    return '₹0';
  }

  if (value >= 10000000) {
    return `₹${(value / 10000000).toFixed(2)}Cr`;
  }

  if (value >= 100000) {
    return `₹${(value / 100000).toFixed(2)}L`;
  }

  if (value >= 1000) {
    return `₹${(value / 1000).toFixed(1)}K`;
  }

  return `₹${value.toLocaleString('en-IN')}`;
}

function formatPercent(value: number): string {
  if (!Number.isFinite(value)) {
    return '0.00%';
  }

  return `${value.toFixed(2)}%`;
}

function formatChange(value?: number): string {
  if (
    value === undefined ||
    value === null ||
    !Number.isFinite(value)
  ) {
    return '';
  }

  return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
}

function safeNumber(value: unknown): number {
  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : 0;
}

/* -------------------------------------------------------------------------- */
/* Reusable UI                                                                  */
/* -------------------------------------------------------------------------- */

function ChangeIndicator({
  value,
  inverse = false,
}: {
  value?: number;
  inverse?: boolean;
}) {
  const theme = useTheme();

  if (
    value === undefined ||
    value === null ||
    !Number.isFinite(value)
  ) {
    return null;
  }

  const positive = inverse ? value <= 0 : value >= 0;

  return (
    <View style={styles.changeContainer}>
      <Icon
        source={
          value === 0
            ? 'minus'
            : value > 0
              ? 'arrow-top-right'
              : 'arrow-bottom-right'
        }
        size={12}
        color={
          positive
            ? theme.colors.primary
            : theme.colors.error
        }
      />

      <Text
        variant="labelSmall"
        style={{
          color: positive
            ? theme.colors.primary
            : theme.colors.error,
          fontWeight: '600',
        }}
      >
        {formatChange(value)}
      </Text>
    </View>
  );
}

function MetricCard({
  title,
  value,
  change,
  inverse = false,
  icon,
}: {
  title: string;
  value: string;
  change?: number;
  inverse?: boolean;
  icon: string;
}) {
  const theme = useTheme();

  return (
    <Card
      mode="outlined"
      style={styles.metricCard}
    >
      <Card.Content>
        <View style={styles.metricHeader}>
          <View
            style={[
              styles.metricIcon,
              {
                backgroundColor:
                  theme.colors.primaryContainer,
              },
            ]}
          >
            <Icon
              source={icon}
              size={17}
              color={theme.colors.primary}
            />
          </View>

          <Text
            variant="labelMedium"
            style={styles.metricTitle}
          >
            {title}
          </Text>
        </View>

        <Text
          variant="headlineSmall"
          style={styles.metricValue}
        >
          {value}
        </Text>

        <ChangeIndicator
          value={change}
          inverse={inverse}
        />
      </Card.Content>
    </Card>
  );
}

function SectionHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <View style={styles.sectionHeader}>
      <Text
        variant="titleMedium"
        style={styles.sectionTitle}
      >
        {title}
      </Text>

      {subtitle ? (
        <Text
          variant="bodySmall"
          style={styles.sectionSubtitle}
        >
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/* Trend                                                                        */
/* -------------------------------------------------------------------------- */

function PerformanceTrend({
  data,
}: {
  data: AdsSeriesPoint[];
}) {
  const theme = useTheme();

  const visibleData = data.slice(-14);

  if (!visibleData.length) {
    return (
      <Card
        mode="outlined"
        style={styles.card}
      >
        <Card.Content style={styles.emptyChart}>
          <View
            style={[
              styles.emptyIcon,
              {
                backgroundColor:
                  theme.colors.surfaceVariant,
              },
            ]}
          >
            <Icon
              source="chart-line"
              size={24}
              color={theme.colors.onSurfaceVariant}
            />
          </View>

          <Text
            variant="titleSmall"
            style={styles.emptyTitle}
          >
            No trend data available
          </Text>

          <Text
            variant="bodySmall"
            style={styles.emptyDescription}
          >
            Advertising performance will appear here when
            data is available.
          </Text>
        </Card.Content>
      </Card>
    );
  }

  const maxValue = Math.max(
    ...visibleData.flatMap(item => [
      safeNumber(item.sales),
      safeNumber(item.spend),
    ]),
    1,
  );

  return (
    <Card
      mode="outlined"
      style={styles.card}
    >
      <Card.Content>
        <View style={styles.chartHeader}>
          <View style={styles.legend}>
            <View style={styles.legendItem}>
              <View
                style={[
                  styles.legendDot,
                  {
                    backgroundColor:
                      theme.colors.primary,
                  },
                ]}
              />

              <Text
                variant="labelSmall"
                style={styles.legendText}
              >
                Ad Sales
              </Text>
            </View>

            <View style={styles.legendItem}>
              <View
                style={[
                  styles.legendDot,
                  {
                    backgroundColor:
                      theme.colors.error,
                  },
                ]}
              />

              <Text
                variant="labelSmall"
                style={styles.legendText}
              >
                Spend
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.chart}>
          {visibleData.map((item, index) => {
            const salesHeight =
              (safeNumber(item.sales) / maxValue) *
              130;

            const spendHeight =
              (safeNumber(item.spend) / maxValue) *
              130;

            const showLabel =
              index === 0 ||
              index === visibleData.length - 1 ||
              index % 3 === 0;

            return (
              <View
                key={`${item.date}-${index}`}
                style={styles.chartColumn}
              >
                <View style={styles.chartBars}>
                  <View
                    style={[
                      styles.chartBar,
                      {
                        height: Math.max(
                          salesHeight,
                          4,
                        ),
                        backgroundColor:
                          theme.colors.primary,
                      },
                    ]}
                  />

                  <View
                    style={[
                      styles.chartBar,
                      {
                        height: Math.max(
                          spendHeight,
                          4,
                        ),
                        backgroundColor:
                          theme.colors.error,
                      },
                    ]}
                  />
                </View>

                {showLabel ? (
                  <Text
                    variant="labelSmall"
                    numberOfLines={1}
                    style={styles.chartLabel}
                  >
                    {String(item.date).slice(5)}
                  </Text>
                ) : (
                  <View style={styles.chartLabelSpacer} />
                )}
              </View>
            );
          })}
        </View>
      </Card.Content>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/* Insights                                                                     */
/* -------------------------------------------------------------------------- */

function InsightCard({
  insight,
}: {
  insight: AdsInsight;
}) {
  const theme = useTheme();

  const iconMap: Record<InsightType, string> = {
    positive: 'check-circle-outline',
    warning: 'alert-circle-outline',
    opportunity: 'lightbulb-outline',
    info: 'information-outline',
  };

  const colorMap: Record<InsightType, string> = {
    positive: theme.colors.primary,
    warning: theme.colors.error,
    opportunity: theme.colors.primary,
    info: theme.colors.onSurfaceVariant,
  };

  const color = colorMap[insight.type];

  return (
    <View style={styles.insightRow}>
      <View
        style={[
          styles.insightIcon,
          {
            backgroundColor:
              theme.colors.surfaceVariant,
          },
        ]}
      >
        <Icon
          source={iconMap[insight.type]}
          size={19}
          color={color}
        />
      </View>

      <View style={styles.insightContent}>
        <Text
          variant="labelLarge"
          numberOfLines={2}
          style={styles.insightTitle}
        >
          {insight.title}
        </Text>

        {insight.description ? (
          <Text
            variant="bodySmall"
            style={styles.insightDescription}
          >
            {insight.description}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/* Performance rows                                                             */
/* -------------------------------------------------------------------------- */

function PerformanceRow({
  item,
}: {
  item: AdsPerformanceRow;
}) {
  return (
    <View style={styles.performanceRow}>
      <View style={styles.performanceMain}>
        <Text
          variant="labelLarge"
          numberOfLines={1}
          style={styles.performanceName}
        >
          {item.name}
        </Text>

        {item.campaign ? (
          <Text
            variant="bodySmall"
            numberOfLines={1}
            style={styles.performanceCampaign}
          >
            {item.campaign}
          </Text>
        ) : null}
      </View>

      <View style={styles.performanceMetric}>
        <Text
          variant="labelMedium"
          style={styles.performanceMetricValue}
        >
          {formatCurrency(item.sales)}
        </Text>

        <Text
          variant="labelSmall"
          style={styles.performanceSecondary}
        >
          Sales
        </Text>
      </View>

      <View style={styles.performanceMetric}>
        <Text
          variant="labelMedium"
          style={styles.performanceMetricValue}
        >
          {item.roas.toFixed(2)}x
        </Text>

        <Text
          variant="labelSmall"
          style={styles.performanceSecondary}
        >
          ROAS
        </Text>
      </View>
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/* Backend adapter                                                             */
/* -------------------------------------------------------------------------- */

function normalizeData(
  overview: unknown,
  series: unknown,
  insights: unknown,
  table: unknown,
): AdsViewModel {
  const overviewObject =
    overview &&
    typeof overview === 'object'
      ? overview as Record<string, any>
      : {};

  const seriesObject =
    series &&
    typeof series === 'object'
      ? series as Record<string, any>
      : {};

  const insightsObject =
    insights &&
    typeof insights === 'object'
      ? insights as Record<string, any>
      : {};

  const tableObject =
    table &&
    typeof table === 'object'
      ? table as Record<string, any>
      : {};

  const rawSeries = Array.isArray(series)
    ? series
    : Array.isArray(seriesObject.data)
      ? seriesObject.data
      : Array.isArray(seriesObject.series)
        ? seriesObject.series
        : Array.isArray(seriesObject.rows)
          ? seriesObject.rows
          : [];

  const rawInsights = Array.isArray(insights)
    ? insights
    : Array.isArray(insightsObject.insights)
      ? insightsObject.insights
      : Array.isArray(insightsObject.data)
        ? insightsObject.data
        : Array.isArray(insightsObject.rows)
          ? insightsObject.rows
          : [];

  const rawTable = Array.isArray(table)
    ? table
    : Array.isArray(tableObject.rows)
      ? tableObject.rows
      : Array.isArray(tableObject.data)
        ? tableObject.data
        : Array.isArray(tableObject.items)
          ? tableObject.items
          : [];

  return {
    adSales: {
      value: safeNumber(
        overviewObject.adSales ??
          overviewObject.sales ??
          overviewObject.AdSales ??
          overviewObject.ad_sales ??
          overviewObject.totalAdSales,
      ),

      changePct: safeNumber(
        overviewObject.adSalesChangePct ??
          overviewObject.salesChangePct ??
          overviewObject.AdSalesChangePct ??
          overviewObject.adSalesChange ??
          overviewObject.salesChange,
      ),
    },

    adSpend: {
      value: safeNumber(
        overviewObject.adSpend ??
          overviewObject.spend ??
          overviewObject.AdSpend ??
          overviewObject.ad_spend ??
          overviewObject.totalAdSpend,
      ),

      changePct: safeNumber(
        overviewObject.adSpendChangePct ??
          overviewObject.spendChangePct ??
          overviewObject.AdSpendChangePct ??
          overviewObject.adSpendChange ??
          overviewObject.spendChange,
      ),
    },

    roas: {
      value: safeNumber(
        overviewObject.roas ??
          overviewObject.ROAS ??
          overviewObject.returnOnAdSpend,
      ),

      changePct: safeNumber(
        overviewObject.roasChangePct ??
          overviewObject.ROASChangePct ??
          overviewObject.roasChange,
      ),
    },

    acos: {
      value: safeNumber(
        overviewObject.acos ??
          overviewObject.ACoS ??
          overviewObject.ACOS ??
          overviewObject.acosPercentage,
      ),

      changePct: safeNumber(
        overviewObject.acosChangePct ??
          overviewObject.ACoSChangePct ??
          overviewObject.ACOSChangePct ??
          overviewObject.acosChange,
      ),
    },

    series: rawSeries.map(
      (item: any, index: number) => ({
        date: String(
          item?.date ??
            item?.Date ??
            item?.day ??
            item?.Day ??
            item?.label ??
            index,
        ),

        sales: safeNumber(
          item?.sales ??
            item?.adSales ??
            item?.AdSales ??
            item?.ad_sales ??
            item?.revenue,
        ),

        spend: safeNumber(
          item?.spend ??
            item?.adSpend ??
            item?.AdSpend ??
            item?.ad_spend ??
            item?.cost,
        ),
      }),
    ),

    insights: rawInsights
      .map(
        (item: any, index: number) => {
          const rawType = String(
            item?.type ??
              item?.Type ??
              item?.severity ??
              'info',
          ).toLowerCase();

          let type: InsightType = 'info';

          if (
            rawType === 'positive' ||
            rawType === 'success'
          ) {
            type = 'positive';
          } else if (
            rawType === 'warning' ||
            rawType === 'critical' ||
            rawType === 'negative'
          ) {
            type = 'warning';
          } else if (
            rawType === 'opportunity'
          ) {
            type = 'opportunity';
          }

          return {
            id: String(
              item?.id ??
                item?.Id ??
                item?._id ??
                index,
            ),

            type,

            title: String(
              item?.title ??
                item?.Title ??
                item?.name ??
                item?.Name ??
                'Advertising insight',
            ),

            description: String(
              item?.description ??
                item?.Description ??
                item?.message ??
                item?.Message ??
                item?.reason ??
                '',
            ),
          };
        },
      ),

    table: rawTable.map(
      (item: any, index: number) => ({
        id: String(
          item?.id ??
            item?.Id ??
            item?._id ??
            index,
        ),

        name: String(
          item?.name ??
            item?.Name ??
            item?.productName ??
            item?.ProductName ??
            item?.campaignName ??
            item?.CampaignName ??
            item?.asin ??
            item?.Asin ??
            item?.sku ??
            item?.Sku ??
            'Advertising item',
        ),

        campaign:
          item?.campaign ??
          item?.Campaign ??
          item?.campaignName ??
          item?.CampaignName,

        sales: safeNumber(
          item?.sales ??
            item?.adSales ??
            item?.AdSales ??
            item?.ad_sales ??
            item?.revenue,
        ),

        spend: safeNumber(
          item?.spend ??
            item?.adSpend ??
            item?.AdSpend ??
            item?.ad_spend ??
            item?.cost,
        ),

        roas: safeNumber(
          item?.roas ??
            item?.ROAS ??
            item?.returnOnAdSpend,
        ),

        acos: safeNumber(
          item?.acos ??
            item?.ACoS ??
            item?.ACOS ??
            item?.acosPercentage,
        ),
      }),
    ),
  };
}

/* -------------------------------------------------------------------------- */
/* Screen                                                                       */
/* -------------------------------------------------------------------------- */

export default function AdsScreen() {
  const theme = useTheme();

  const [period, setPeriod] =
    useState<PeriodKey>('30d');

  const [data, setData] =
    useState<AdsViewModel>(EMPTY_DATA);

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const [aiReviewLoading, setAiReviewLoading] =
    useState(false);

  const loadAds = useCallback(
    async (isRefresh = false) => {
      try {
        if (!isRefresh) {
          setLoading(true);
        }

        setError(null);

        const params = {
          period,
        };

        const [
          overview,
          series,
          insights,
          table,
        ] = await Promise.all([
          adsService.getOverview(params),
          adsService.getSeries(params),
          adsService.getInsights(params),
          adsService.getTable(params),
        ]);

        const normalized = normalizeData(
          overview,
          series,
          insights,
          table,
        );

        setData(normalized);
      } catch (err: any) {
        setError(
          err?.response?.data?.message ??
            err?.message ??
            'Unable to load advertising data.',
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [period],
  );

  useEffect(() => {
    loadAds();
  }, [loadAds]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadAds(true);
  }, [loadAds]);

  const handleAiReview = async () => {
    try {
      setAiReviewLoading(true);
      setError(null);

      await adsService.aiReview({
        period,
      });

      await loadAds();
    } catch (err: any) {
      setError(
        err?.response?.data?.message ??
          err?.message ??
          'Unable to complete AI review.',
      );
    } finally {
      setAiReviewLoading(false);
    }
  };

  const periodLabel = useMemo(() => {
    switch (period) {
      case '7d':
        return 'Last 7 days';

      case '3m':
        return 'Last 3 months';

      case '1y':
        return 'Last year';

      case '30d':
      default:
        return 'Last 30 days';
    }
  }, [period]);

  /* ------------------------------------------------------------------------ */
  /* Initial loading                                                           */
  /* ------------------------------------------------------------------------ */

  if (loading) {
    return (
      <View
        style={[
          styles.centered,
          {
            backgroundColor:
              theme.colors.background,
          },
        ]}
      >
        <ActivityIndicator
          size="small"
          color={theme.colors.primary}
        />

        <Text
          variant="bodyMedium"
          style={styles.loadingText}
        >
          Loading advertising performance...
        </Text>
      </View>
    );
  }

  /* ------------------------------------------------------------------------ */
  /* Render                                                                    */
  /* ------------------------------------------------------------------------ */

  return (
    <ScrollView
      style={[
        styles.container,
        {
          backgroundColor:
            theme.colors.background,
        },
      ]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={theme.colors.primary}
        />
      }
    >
      {/* Header ------------------------------------------------------------- */}

      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text
            variant="headlineSmall"
            style={styles.title}
          >
            Ads Intelligence
          </Text>

          <Text
            variant="bodyMedium"
            style={styles.subtitle}
          >
            Advertising performance across your business
          </Text>
        </View>

        <IconButton
          icon="tune-variant"
          mode="outlined"
          size={20}
          onPress={() => {
            // Connect to AdsFilterSheet here.
          }}
          accessibilityLabel="Open advertising filters"
        />
      </View>

      {/* Period ------------------------------------------------------------- */}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.periods}
      >
        {(
          [
            ['7d', '7 days'],
            ['30d', '30 days'],
            ['3m', '3 months'],
            ['1y', '1 year'],
          ] as const
        ).map(([key, label]) => (
          <Chip
            key={key}
            selected={period === key}
            onPress={() => setPeriod(key)}
            style={styles.periodChip}
            showSelectedOverlay
          >
            {label}
          </Chip>
        ))}
      </ScrollView>

      {/* Error -------------------------------------------------------------- */}

      {error ? (
        <Card
          mode="outlined"
          style={styles.errorCard}
        >
          <Card.Content style={styles.errorContent}>
            <View
              style={[
                styles.errorIcon,
                {
                  backgroundColor:
                    theme.colors.errorContainer,
                },
              ]}
            >
              <Icon
                source="alert-circle-outline"
                size={21}
                color={theme.colors.error}
              />
            </View>

            <View style={styles.errorText}>
              <Text
                variant="labelLarge"
                style={styles.errorTitle}
              >
                Unable to load ads data
              </Text>

              <Text
                variant="bodySmall"
                style={styles.errorDescription}
              >
                {error}
              </Text>
            </View>

            <Button
              mode="text"
              compact
              onPress={() => loadAds()}
            >
              Retry
            </Button>
          </Card.Content>
        </Card>
      ) : null}

      {/* Overview ----------------------------------------------------------- */}

      <SectionHeader
        title="Performance Overview"
        subtitle={periodLabel}
      />

      <View style={styles.metricGrid}>
        <MetricCard
          title="Ad Sales"
          value={formatCurrency(
            data.adSales.value,
          )}
          change={data.adSales.changePct}
          icon="cash-multiple"
        />

        <MetricCard
          title="Ad Spend"
          value={formatCurrency(
            data.adSpend.value,
          )}
          change={data.adSpend.changePct}
          inverse
          icon="cash-minus"
        />

        <MetricCard
          title="ROAS"
          value={`${data.roas.value.toFixed(2)}x`}
          change={data.roas.changePct}
          icon="chart-line"
        />

        <MetricCard
          title="ACoS"
          value={formatPercent(
            data.acos.value,
          )}
          change={data.acos.changePct}
          inverse
          icon="percent"
        />
      </View>

      {/* Trend -------------------------------------------------------------- */}

      <SectionHeader
        title="Performance Trend"
        subtitle="Ad sales and spend"
      />

      <PerformanceTrend
        data={data.series}
      />

      {/* Insights ----------------------------------------------------------- */}

      <SectionHeader
        title="Advertising Insights"
        subtitle="What needs attention"
      />

      <Card
        mode="outlined"
        style={styles.card}
      >
        <Card.Content>
          {data.insights.length > 0 ? (
            data.insights
              .slice(0, 5)
              .map((insight, index) => (
                <React.Fragment
                  key={insight.id}
                >
                  <InsightCard
                    insight={insight}
                  />

                  {index <
                  Math.min(
                    data.insights.length,
                    5,
                  ) -
                    1 ? (
                    <Divider
                      style={styles.divider}
                    />
                  ) : null}
                </React.Fragment>
              ))
          ) : (
            <View
              style={styles.emptySection}
            >
              <View
                style={[
                  styles.emptyIcon,
                  {
                    backgroundColor:
                      theme.colors.surfaceVariant,
                  },
                ]}
              >
                <Icon
                  source="lightbulb-outline"
                  size={24}
                  color={
                    theme.colors
                      .onSurfaceVariant
                  }
                />
              </View>

              <Text
                variant="bodyMedium"
                style={styles.emptySectionTitle}
              >
                No advertising insights
              </Text>

              <Text
                variant="bodySmall"
                style={
                  styles.emptyDescription
                }
              >
                There are no insights available
                for this period.
              </Text>
            </View>
          )}
        </Card.Content>
      </Card>

      {/* Performance -------------------------------------------------------- */}

      <SectionHeader
        title="Performance"
        subtitle="Top advertising contributors"
      />

      <Card
        mode="outlined"
        style={styles.card}
      >
        <Card.Content>
          {data.table.length > 0 ? (
            data.table
              .slice(0, 8)
              .map((item, index) => (
                <React.Fragment
                  key={item.id}
                >
                  <PerformanceRow
                    item={item}
                  />

                  {index <
                  Math.min(
                    data.table.length,
                    8,
                  ) -
                    1 ? (
                    <Divider
                      style={styles.divider}
                    />
                  ) : null}
                </React.Fragment>
              ))
          ) : (
            <View
              style={styles.emptySection}
            >
              <View
                style={[
                  styles.emptyIcon,
                  {
                    backgroundColor:
                      theme.colors.surfaceVariant,
                  },
                ]}
              >
                <Icon
                  source="chart-box-outline"
                  size={24}
                  color={
                    theme.colors
                      .onSurfaceVariant
                  }
                />
              </View>

              <Text
                variant="bodyMedium"
                style={styles.emptySectionTitle}
              >
                No performance data
              </Text>

              <Text
                variant="bodySmall"
                style={
                  styles.emptyDescription
                }
              >
                Advertising performance data
                will appear here when available.
              </Text>
            </View>
          )}
        </Card.Content>
      </Card>

      {/* AI Review ---------------------------------------------------------- */}

      <Card
        mode="outlined"
        style={styles.aiCard}
      >
        <Card.Content>
          <View style={styles.aiHeader}>
            <View
              style={[
                styles.aiIcon,
                {
                  backgroundColor:
                    theme.colors.primaryContainer,
                },
              ]}
            >
              <Icon
                source="auto-fix"
                size={21}
                color={theme.colors.primary}
              />
            </View>

            <View style={styles.aiHeaderText}>
              <Text
                variant="titleSmall"
                style={styles.aiTitle}
              >
                AI Ads Review
              </Text>

              <Text
                variant="bodySmall"
                style={styles.aiDescription}
              >
                Get a deeper review of spend
                efficiency, opportunities and
                advertising issues.
              </Text>
            </View>
          </View>

          <Button
            mode="contained"
            onPress={handleAiReview}
            loading={aiReviewLoading}
            disabled={aiReviewLoading}
            style={styles.aiButton}
            contentStyle={
              styles.aiButtonContent
            }
          >
            Review advertising
          </Button>
        </Card.Content>
      </Card>
    </ScrollView>
  );
}

/* -------------------------------------------------------------------------- */
/* Styles                                                                       */
/* -------------------------------------------------------------------------- */

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  content: {
    padding: SPACING.md,
    paddingBottom: SPACING.xxl,
  },

  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xl,
  },

  loadingText: {
    marginTop: SPACING.sm,
    color: '#64748B',
  },

  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
  },

  headerText: {
    flex: 1,
    paddingRight: SPACING.md,
  },

  title: {
    color: '#111827',
    fontWeight: '700',
  },

  subtitle: {
    marginTop: 4,
    color: '#64748B',
    lineHeight: 20,
  },

  periods: {
    gap: SPACING.sm,
    paddingBottom: SPACING.lg,
  },

  periodChip: {
    borderRadius: RADIUS.pill,
  },

  sectionHeader: {
    marginTop: SPACING.sm,
    marginBottom: SPACING.sm,
  },

  sectionTitle: {
    color: '#111827',
    fontWeight: '700',
  },

  sectionSubtitle: {
    marginTop: 2,
    color: '#64748B',
  },

  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },

  metricCard: {
    width: '48%',
    borderRadius: RADIUS.lg,
  },

  metricHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },

  metricIcon: {
    width: 29,
    height: 29,
    borderRadius: RADIUS.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },

  metricTitle: {
    flex: 1,
    color: '#64748B',
  },

  metricValue: {
    marginTop: SPACING.sm,
    color: '#111827',
    fontWeight: '700',
  },

  changeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginTop: 5,
  },

  card: {
    borderRadius: RADIUS.lg,
    marginBottom: SPACING.md,
  },

  /* Trend */

  chartHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },

  legend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },

  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },

  legendDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },

  legendText: {
    color: '#64748B',
  },

  chart: {
    height: 170,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
  },

  chartColumn: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },

  chartBars: {
    flex: 1,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 2,
    paddingTop: SPACING.md,
  },

  chartBar: {
    width: 4,
    minHeight: 4,
    borderRadius: 2,
  },

  chartLabel: {
    width: 30,
    marginTop: 5,
    textAlign: 'center',
    color: '#64748B',
  },

  chartLabelSpacer: {
    height: 17,
  },

  /* Insights */

  insightRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
    paddingVertical: SPACING.sm,
  },

  insightIcon: {
    width: 35,
    height: 35,
    borderRadius: RADIUS.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },

  insightContent: {
    flex: 1,
  },

  insightTitle: {
    color: '#111827',
    fontWeight: '600',
  },

  insightDescription: {
    marginTop: 3,
    color: '#64748B',
    lineHeight: 18,
  },

  divider: {
    marginVertical: 2,
  },

  /* Performance */

  performanceRow: {
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },

  performanceMain: {
    flex: 1,
    minWidth: 0,
  },

  performanceName: {
    color: '#111827',
    fontWeight: '600',
  },

  performanceCampaign: {
    marginTop: 2,
    color: '#64748B',
  },

  performanceMetric: {
    width: 64,
    alignItems: 'flex-end',
  },

  performanceMetricValue: {
    color: '#111827',
    fontWeight: '600',
  },

  performanceSecondary: {
    marginTop: 2,
    color: '#94A3B8',
  },

  /* Error */

  errorCard: {
    borderRadius: RADIUS.lg,
    marginBottom: SPACING.md,
  },

  errorContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },

  errorIcon: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },

  errorText: {
    flex: 1,
  },

  errorTitle: {
    color: '#111827',
    fontWeight: '600',
  },

  errorDescription: {
    marginTop: 2,
    color: '#64748B',
    lineHeight: 17,
  },

  /* Empty */

  emptyChart: {
    minHeight: 180,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.lg,
  },

  emptyIcon: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.sm,
  },

  emptyTitle: {
    color: '#475569',
    fontWeight: '600',
  },

  emptyDescription: {
    maxWidth: 290,
    marginTop: 3,
    textAlign: 'center',
    color: '#94A3B8',
    lineHeight: 18,
  },

  emptySection: {
    minHeight: 120,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
  },

  emptySectionTitle: {
    color: '#475569',
    fontWeight: '600',
  },

  /* AI */

  aiCard: {
    borderRadius: RADIUS.lg,
    marginTop: SPACING.sm,
  },

  aiHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
  },

  aiIcon: {
    width: 39,
    height: 39,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },

  aiHeaderText: {
    flex: 1,
  },

  aiTitle: {
    color: '#111827',
    fontWeight: '700',
  },

  aiDescription: {
    marginTop: 3,
    color: '#64748B',
    lineHeight: 18,
  },

  aiButton: {
    marginTop: SPACING.md,
    borderRadius: RADIUS.md,
  },

  aiButtonContent: {
    minHeight: 44,
  },
});