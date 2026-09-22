import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import {
  Button,
  Card,
  Text,
  useTheme,
} from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import type { DrawerNavigationProp } from '@react-navigation/drawer';

import DashboardHeader from '../../components/Dashboard/DashboardHeader';
import DashboardPeriodSelector, {
  type DashboardPeriodKey,
} from '../../components/Dashboard/DashboardPeriodSelector';

import BusinessOverview from '../../components/Dashboard/BusinessOverview';
import NeedsAttention from '../../components/Dashboard/AttentionSection';
import SalesTrendCard from '../../components/Dashboard/SalesTrendCard';
import MarketplacePerformance from '../../components/Dashboard/MarketplacePerformance';
import TopProducts from '../../components/Dashboard/TopProducts';
import AdvertisingSummary from '../../components/Dashboard/AdvertisingSummary';
import InventorySnapshot from '../../components/Dashboard/InventorySnapshot';
import TaskSummary from '../../components/Dashboard/TaskSummary';
import RecentActivity from '../../components/Dashboard/RecentActivity';

import { getApiErrorMessage } from '../../services/apiClient';
import dashboardService from '../../services/dashboardService';
import type {
  DashboardViewData,
} from '../../services/dashboardService';

import { useAuthStore } from '../../store/authStore';
import { useNotificationStore } from '../../store/notificationStore';

import type {
  DashboardActivity,
  DashboardAttentionItem,
  DashboardProduct,
} from '../../data/mockDashboard';
import type { MainDrawerParamList } from '../../types';

import { SPACING } from '../../theme/theme';

function greetingForHour(hour: number): string {
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function DashboardScreen() {
  const { colors } = useTheme();
  const navigation = useNavigation<DrawerNavigationProp<MainDrawerParamList>>();

  const user = useAuthStore((s) => s.user);
  const unreadCount = useNotificationStore((s) => s.unreadCount);
  const greetingName =
    user?.firstName ||
    user?.fullName ||
    user?.email?.split('@')[0] ||
    'there';
  const greeting = greetingForHour(new Date().getHours());

  const [selectedPeriod, setSelectedPeriod] =
    useState<DashboardPeriodKey>('30d');
  const [periodSelectorVisible, setPeriodSelectorVisible] =
    useState(false);

  const [data, setData] = useState<DashboardViewData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = useCallback(
    async (period: DashboardPeriodKey) => {
      setIsLoading(true);
      setError(null);

      try {
        const response =
          await dashboardService.getDashboard(period);
        setData(dashboardService.mapDashboardToView(response));
      } catch (err) {
        setError(getApiErrorMessage(err));
        setData(null);
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    loadDashboard(selectedPeriod);
  }, [selectedPeriod, loadDashboard]);

  const selectedPeriodLabel = useMemo(() => {
    const labels: Record<DashboardPeriodKey, string> = {
      '7d': 'Last 7 days',
      '30d': 'Last 30 days',
      '3m': 'Last 3 months',
      '1y': 'Last 12 months',
    };

    return labels[selectedPeriod];
  }, [selectedPeriod]);

  const handlePeriodChange = (
    newPeriod: DashboardPeriodKey,
  ) => {
    setSelectedPeriod(newPeriod);
  };

  const handleAttentionPress = (
    item: DashboardAttentionItem,
  ) => {
    console.log('Attention item selected:', item.type, item.id);
  };

  const handleProductPress = (
    product: DashboardProduct,
  ) => {
    console.log('Product selected:', product.id);
  };

  const handleActivityPress = (
    activity: DashboardActivity,
  ) => {
    console.log('Activity selected:', activity.id);
  };

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <DashboardHeader
          greeting={greeting}
          name={greetingName}
          periodLabel={selectedPeriodLabel}
          onPeriodPress={() =>
            setPeriodSelectorVisible(true)
          }
          onNotificationPress={() =>
            navigation.navigate('Notifications')
          }
          notificationCount={unreadCount}
        />

        {isLoading && data ? (
          <View style={styles.refreshingRow}>
            <ActivityIndicator size={16} color={colors.primary} />
            <Text
              variant="labelMedium"
              style={{ color: colors.onSurfaceVariant }}
            >
              Updating…
            </Text>
          </View>
        ) : null}

        {!data && isLoading ? (
          <View style={styles.stateContainer}>
            <ActivityIndicator
              size={28}
              color={colors.primary}
            />
          </View>
        ) : null}

        {!data && !isLoading && error ? (
          <View style={styles.stateContainer}>
            <Card
              mode="outlined"
              style={[
                styles.errorCard,
                { borderColor: colors.outlineVariant },
              ]}
            >
              <Card.Content>
                <Text
                  variant="titleMedium"
                  style={{ color: colors.onSurface }}
                >
                  Couldn't load dashboard
                </Text>
                <Text
                  variant="bodySmall"
                  style={{
                    color: colors.onSurfaceVariant,
                    marginTop: 4,
                  }}
                >
                  {error}
                </Text>
                <Button
                  mode="contained"
                  style={styles.retryButton}
                  onPress={() =>
                    loadDashboard(selectedPeriod)
                  }
                >
                  Retry
                </Button>
              </Card.Content>
            </Card>
          </View>
        ) : null}

        {data ? (
          <>
            <BusinessOverview
              sales={data.overview.sales}
              orders={data.overview.orders}
              adSpend={data.overview.adSpend}
              products={data.overview.products}
            />

            <NeedsAttention
              items={data.attention}
              onItemPress={handleAttentionPress}
            />

            <SalesTrendCard
              totalSales={data.overview.sales.value}
              changePct={data.overview.sales.changePct}
              data={data.salesTrend}
            />

            <MarketplacePerformance
              marketplaces={data.marketplaces}
            />

            <TopProducts
              products={data.topProducts}
              onProductPress={handleProductPress}
            />

            <AdvertisingSummary
              advertising={data.advertising}
              onPress={() => {
                console.log('Advertising selected');
              }}
            />

            <InventorySnapshot
              inventory={data.inventory}
              onPress={() => {
                console.log('Inventory selected');
              }}
            />

            <TaskSummary
              tasks={data.tasks}
              onPress={() => {
                console.log('Tasks selected');
              }}
            />

            <RecentActivity
              activities={data.recentActivity}
              onActivityPress={handleActivityPress}
            />
          </>
        ) : null}

        <View style={styles.bottomSpacer} />
      </ScrollView>

      <DashboardPeriodSelector
        visible={periodSelectorVisible}
        selectedPeriod={selectedPeriod}
        onSelect={handlePeriodChange}
        onDismiss={() =>
          setPeriodSelectorVisible(false)
        }
        onCustomRangePress={() => {
          console.log('Custom date range selected');
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },

  content: {
    paddingBottom: 16,
  },

  bottomSpacer: {
    height: 16,
  },

  refreshingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: SPACING.lg,
    marginTop: SPACING.sm,
  },

  stateContainer: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.xl,
    alignItems: 'center',
  },

  errorCard: {
    width: '100%',
    borderRadius: 12,
  },

  retryButton: {
    alignSelf: 'flex-start',
    marginTop: SPACING.md,
  },
});