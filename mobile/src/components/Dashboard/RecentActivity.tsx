import React from 'react';
import { StyleSheet, View } from 'react-native';
import {
  Card,
  Text,
  useTheme,
} from 'react-native-paper';

import FluentIcon from '../FluentIcon';

import type { DashboardActivity } from '../../data/mockDashboard';
import { RADIUS, SPACING } from '../../theme/theme';

interface Props {
  activities: DashboardActivity[];
  onActivityPress?: (
    activity: DashboardActivity,
  ) => void;
}

const ICONS: Record<
  DashboardActivity['type'],
  string
> = {
  listing: 'fluent:document-text-20-filled',
  inventory: 'fluent:box-20-filled',
  pricing: 'fluent:tag-20-filled',
  order: 'fluent:shopping-bag-20-filled',
  advertising: 'fluent:megaphone-20-filled',
};

export default function RecentActivity({
  activities,
  onActivityPress,
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
          Recent Activity
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
        {activities.map((activity, index) => (
          <View key={activity.id}>
            <View
              style={styles.row}
              onTouchEnd={() =>
                onActivityPress?.(activity)
              }
            >
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
                  name={ICONS[activity.type]}
                  size={18}
                  color={colors.onSurfaceVariant}
                />
              </View>

              <View style={styles.content}>
                <Text
                  variant="bodyMedium"
                  style={[
                    styles.activityTitle,
                    { color: colors.onSurface },
                  ]}
                  numberOfLines={1}
                >
                  {activity.title}
                </Text>

                <Text
                  variant="labelSmall"
                  style={[
                    styles.description,
                    { color: colors.onSurfaceVariant },
                  ]}
                  numberOfLines={1}
                >
                  {activity.description}
                </Text>

                <Text
                  variant="labelSmall"
                  style={[
                    styles.timestamp,
                    { color: colors.onSurfaceVariant },
                  ]}
                >
                  {activity.timestamp}
                </Text>
              </View>

              <FluentIcon
                name="fluent:chevron-right-20-filled"
                size={19}
                color={colors.onSurfaceVariant}
              />
            </View>

            {index < activities.length - 1 ? (
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
        ))}
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
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
  },

  iconContainer: {
    width: 38,
    height: 38,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.sm,
  },

  content: {
    flex: 1,
    minWidth: 0,
    marginRight: SPACING.sm,
  },

  activityTitle: {
    fontWeight: '600',
  },

  description: {
    marginTop: 3,
  },

  timestamp: {
    marginTop: 3,
  },

  divider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 66,
  },
});