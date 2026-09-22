import React from 'react';
import { StyleSheet, View } from 'react-native';
import {
  Card,
  Text,
  TouchableRipple,
  useTheme,
} from 'react-native-paper';

import FluentIcon from '../FluentIcon';

import type { DashboardAttentionItem } from '../../data/mockDashboard';
import { RADIUS, SPACING } from '../../theme/theme';

interface Props {
  items: DashboardAttentionItem[];
  onItemPress?: (item: DashboardAttentionItem) => void;
}

const ITEM_ICONS: Record<DashboardAttentionItem['type'], string> = {
  listing: 'fluent:document-text-20-filled',
  inventory: 'fluent:box-20-filled',
  pricing: 'fluent:tag-20-filled',
  order: 'fluent:shopping-bag-20-filled',
};

export default function AttentionSection({
  items,
  onItemPress,
}: Props) {
  const { colors } = useTheme();

  const safeItems = Array.isArray(items) ? items : [];

  return (
    <View style={styles.container}>
      {/* Section header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Text
            variant="titleMedium"
            style={[
              styles.title,
              {
                color: colors.onSurface,
              },
            ]}
          >
            Business Health
          </Text>

          <Text
            variant="bodySmall"
            style={[
              styles.subtitle,
              {
                color: colors.onSurfaceVariant,
              },
            ]}
          >
            Items that may need your attention
          </Text>
        </View>

        {safeItems.length > 0 ? (
          <View
            style={[
              styles.totalBadge,
              {
                backgroundColor: colors.errorContainer,
              },
            ]}
          >
            <Text
              variant="labelMedium"
              style={[
                styles.totalBadgeText,
                {
                  color: colors.onErrorContainer,
                },
              ]}
            >
              {safeItems.reduce(
                (total, item) => total + item.count,
                0,
              )}
            </Text>
          </View>
        ) : null}
      </View>

      {/* Attention list */}
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
        {safeItems.length > 0 ? (
          safeItems.map((item, index) => {
            const isLast = index === safeItems.length - 1;

            return (
              <View key={item.id}>
                <TouchableRipple
                  onPress={() => onItemPress?.(item)}
                  borderless
                  rippleColor={colors.primaryContainer}
                >
                  <View style={styles.row}>
                    {/* Count */}
                    <View style={styles.countContainer}>
                      <Text
                        variant="headlineSmall"
                        style={[
                          styles.count,
                          {
                            color: colors.onSurface,
                          },
                        ]}
                      >
                        {item.count}
                      </Text>
                    </View>

                    {/* Content */}
                    <View style={styles.content}>
                      <View style={styles.titleRow}>
                        <Text
                          variant="bodyMedium"
                          style={[
                            styles.itemTitle,
                            {
                              color: colors.onSurface,
                            },
                          ]}
                          numberOfLines={1}
                        >
                          {item.title}
                        </Text>
                      </View>

                      <Text
                        variant="bodySmall"
                        style={[
                          styles.description,
                          {
                            color: colors.onSurfaceVariant,
                          },
                        ]}
                        numberOfLines={2}
                      >
                        {item.description}
                      </Text>
                    </View>

                    {/* Category icon + chevron */}
                    <View style={styles.actionContainer}>
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
                          name={ITEM_ICONS[item.type]}
                          size={17}
                          color={colors.onSurfaceVariant}
                        />
                      </View>

                      <FluentIcon
                        name="fluent:chevron-right-20-filled"
                        size={20}
                        color={colors.onSurfaceVariant}
                      />
                    </View>
                  </View>
                </TouchableRipple>

                {!isLast ? (
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
          })
        ) : (
          <View style={styles.emptyState}>
            <View
              style={[
                styles.emptyIconContainer,
                {
                  backgroundColor: colors.primaryContainer,
                },
              ]}
            >
              <FluentIcon
                name="fluent-color:checkmark-circle-20"
                size={22}
              />
            </View>

            <View style={styles.emptyContent}>
              <Text
                variant="bodyMedium"
                style={[
                  styles.emptyTitle,
                  {
                    color: colors.onSurface,
                  },
                ]}
              >
                Everything looks good
              </Text>

              <Text
                variant="bodySmall"
                style={[
                  styles.emptyDescription,
                  {
                    color: colors.onSurfaceVariant,
                  },
                ]}
              >
                No business issues require your attention right now.
              </Text>
            </View>
          </View>
        )}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: SPACING.lg,
    paddingHorizontal: SPACING.md,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },

  headerContent: {
    flex: 1,
  },

  title: {
    fontWeight: '700',
  },

  subtitle: {
    marginTop: 2,
  },

  totalBadge: {
    minWidth: 32,
    height: 28,
    paddingHorizontal: SPACING.sm,
    borderRadius: RADIUS.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: SPACING.md,
  },

  totalBadgeText: {
    fontWeight: '700',
  },

  card: {
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
  },

  row: {
    minHeight: 82,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },

  countContainer: {
    width: 42,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },

  count: {
    fontWeight: '700',
    letterSpacing: -0.4,
  },

  content: {
    flex: 1,
    minWidth: 0,
    paddingRight: SPACING.sm,
  },

  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  itemTitle: {
    flex: 1,
    fontWeight: '700',
  },

  description: {
    marginTop: 4,
    lineHeight: 17,
  },

  actionContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },

  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },

  divider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: SPACING.md + 42,
  },

  emptyState: {
    minHeight: 100,
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
  },

  emptyIconContainer: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },

  emptyContent: {
    flex: 1,
  },

  emptyTitle: {
    fontWeight: '700',
  },

  emptyDescription: {
    marginTop: 3,
    lineHeight: 17,
  },
});