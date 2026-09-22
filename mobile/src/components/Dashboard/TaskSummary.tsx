import React from 'react';
import { StyleSheet, View } from 'react-native';
import {
  Card,
  Text,
  useTheme,
} from 'react-native-paper';

import FluentIcon from '../FluentIcon';

import type { DashboardTasks } from '../../data/mockDashboard';
import { RADIUS, SPACING } from '../../theme/theme';
import { formatNumber } from '../../utils/formatters';

interface Props {
  tasks: DashboardTasks;
  onPress?: () => void;
}

export default function TaskSummary({
  tasks,
  onPress,
}: Props) {
  const { colors } = useTheme();

  const total =
    tasks.pending +
    tasks.inProgress +
    tasks.review;

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
            Tasks
          </Text>

          <Text
            variant="bodySmall"
            style={[
              styles.subtitle,
              { color: colors.onSurfaceVariant },
            ]}
          >
            Work requiring your attention
          </Text>
        </View>

        <Text
          variant="labelMedium"
          style={[
            styles.viewAll,
            { color: colors.primary },
          ]}
          onPress={onPress}
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
        onPress={onPress}
      >
        <Card.Content>
          <View style={styles.summary}>
            <View
              style={[
                styles.iconContainer,
                { backgroundColor: colors.surfaceVariant },
              ]}
            >
              <FluentIcon
                name="fluent:clipboard-task-20-filled"
                size={21}
                color={colors.onSurfaceVariant}
              />
            </View>

            <View style={styles.summaryInfo}>
              <Text
                variant="titleLarge"
                style={[
                  styles.total,
                  { color: colors.onSurface },
                ]}
              >
                {formatNumber(total)}
              </Text>

              <Text
                variant="bodySmall"
                style={[
                  styles.totalLabel,
                  { color: colors.onSurfaceVariant },
                ]}
              >
                Open tasks
              </Text>
            </View>

            <FluentIcon
              name="fluent:chevron-right-20-filled"
              size={20}
              color={colors.onSurfaceVariant}
            />
          </View>

          <View
            style={[
              styles.divider,
              { backgroundColor: colors.outlineVariant },
            ]}
          />

          <View style={styles.statusRow}>
            <TaskStatus
              label="Pending"
              value={tasks.pending}
              color={colors.onSurface}
            />

            <TaskStatus
              label="In Progress"
              value={tasks.inProgress}
              color={colors.onSurface}
            />

            <TaskStatus
              label="Review"
              value={tasks.review}
              color={colors.onSurface}
            />
          </View>
        </Card.Content>
      </Card>
    </View>
  );
}

interface TaskStatusProps {
  label: string;
  value: number;
  color: string;
}

function TaskStatus({
  label,
  value,
  color,
}: TaskStatusProps) {
  return (
    <View style={styles.status}>
      <Text
        variant="titleMedium"
        style={[
          styles.statusValue,
          { color },
        ]}
      >
        {formatNumber(value)}
      </Text>

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

  viewAll: {
    fontWeight: '600',
  },

  card: {
    borderRadius: RADIUS.lg,
    elevation: 0,
  },

  summary: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  iconContainer: {
    width: 42,
    height: 42,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.sm,
  },

  summaryInfo: {
    flex: 1,
  },

  total: {
    fontWeight: '700',
  },

  totalLabel: {
    marginTop: 2,
  },

  divider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: SPACING.md,
  },

  statusRow: {
    flexDirection: 'row',
  },

  status: {
    flex: 1,
  },

  statusValue: {
    fontWeight: '700',
  },

  statusLabel: {
    marginTop: 3,
    color: '#6B7280',
  },
});