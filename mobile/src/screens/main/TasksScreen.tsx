/**
 * Seller Tasks
 *
 * Demo task center for RetailOps.
 *
 * The UI is intentionally seller-facing:
 * - Pending actions
 * - In-progress work
 * - Completed tasks
 * - Marketplace context
 * - Priority
 * - Due dates
 *
 * Replace DEMO_TASKS with the real Tasks/PEMS API
 * when the backend endpoint is available.
 */

import React, { useMemo, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import {
  Avatar,
  Card,
  Chip,
  Divider,
  IconButton,
  SegmentedButtons,
  Text,
  useTheme,
} from 'react-native-paper';

import ScreenContainer from '../../components/ScreenContainer';
import {
  RADIUS,
  SPACING,
} from '../../theme/theme';

type TaskType =
  | 'Inventory'
  | 'Listing'
  | 'Pricing'
  | 'Content'
  | 'Advertising'
  | 'Orders';

type TaskPriority =
  | 'Low'
  | 'Medium'
  | 'High';

type TaskStatus =
  | 'Pending'
  | 'In Progress'
  | 'Completed';

type Marketplace =
  | 'Amazon'
  | 'Myntra'
  | 'Ajio'
  | 'Flipkart';

interface Task {
  id: string;
  title: string;
  description: string;
  type: TaskType;
  priority: TaskPriority;
  status: TaskStatus;
  dueDate: string;
  marketplace: Marketplace;
}

const DEMO_TASKS: Task[] = [
  {
    id: 'TASK-001',
    title: 'Review low-stock products',
    description:
      '12 products are approaching their inventory threshold. Review stock levels and replenishment plans.',
    type: 'Inventory',
    priority: 'High',
    status: 'Pending',
    dueDate: 'Today',
    marketplace: 'Amazon',
  },
  {
    id: 'TASK-002',
    title: 'Fix listing content',
    description:
      '8 listings have missing or incomplete product content. Review titles, bullets and descriptions.',
    type: 'Listing',
    priority: 'High',
    status: 'Pending',
    dueDate: 'Today',
    marketplace: 'Amazon',
  },
  {
    id: 'TASK-003',
    title: 'Review pricing mismatch',
    description:
      '5 products have a difference between the configured selling price and the current marketplace price.',
    type: 'Pricing',
    priority: 'High',
    status: 'Pending',
    dueDate: 'Today',
    marketplace: 'Myntra',
  },
  {
    id: 'TASK-004',
    title: 'Approve product images',
    description:
      'New listing images are ready for review before publishing.',
    type: 'Content',
    priority: 'Medium',
    status: 'Pending',
    dueDate: 'Tomorrow',
    marketplace: 'Ajio',
  },
  {
    id: 'TASK-005',
    title: 'Review advertising performance',
    description:
      'Check campaigns with increased spend and review ACOS performance.',
    type: 'Advertising',
    priority: 'Medium',
    status: 'Pending',
    dueDate: 'Tomorrow',
    marketplace: 'Amazon',
  },
  {
    id: 'TASK-006',
    title: 'Resolve order exceptions',
    description:
      '3 orders require attention due to fulfilment or delivery exceptions.',
    type: 'Orders',
    priority: 'High',
    status: 'In Progress',
    dueDate: 'Today',
    marketplace: 'Flipkart',
  },
  {
    id: 'TASK-007',
    title: 'Complete new product listing',
    description:
      'Review product attributes and finalize the listing before publishing.',
    type: 'Listing',
    priority: 'Medium',
    status: 'In Progress',
    dueDate: '22 Sep',
    marketplace: 'Myntra',
  },
  {
    id: 'TASK-008',
    title: 'Review suppressed listing',
    description:
      'A product listing is currently suppressed. Review the marketplace issue and required corrections.',
    type: 'Listing',
    priority: 'High',
    status: 'Pending',
    dueDate: '23 Sep',
    marketplace: 'Amazon',
  },
  {
    id: 'TASK-009',
    title: 'Review marketplace returns',
    description:
      'Return activity has increased for selected products. Review the affected SKUs.',
    type: 'Orders',
    priority: 'Low',
    status: 'Pending',
    dueDate: '24 Sep',
    marketplace: 'Ajio',
  },
  {
    id: 'TASK-010',
    title: 'Approve listing changes',
    description:
      'Updated product titles and bullet points are waiting for seller approval.',
    type: 'Content',
    priority: 'Medium',
    status: 'Completed',
    dueDate: '20 Sep',
    marketplace: 'Amazon',
  },
];

type FilterValue =
  | 'All'
  | 'Pending'
  | 'In Progress'
  | 'Completed';

function getTaskIcon(type: TaskType): string {
  switch (type) {
    case 'Inventory':
      return 'package-variant-closed';

    case 'Listing':
      return 'file-document-edit-outline';

    case 'Pricing':
      return 'tag-outline';

    case 'Content':
      return 'image-edit-outline';

    case 'Advertising':
      return 'bullhorn-outline';

    case 'Orders':
      return 'truck-delivery-outline';

    default:
      return 'clipboard-check-outline';
  }
}

function getPriorityColor(
  priority: TaskPriority,
  colors: ReturnType<typeof useTheme>['colors'],
): string {
  switch (priority) {
    case 'High':
      return colors.error;

    case 'Medium':
      return colors.tertiary;

    case 'Low':
      return colors.primary;

    default:
      return colors.onSurfaceVariant;
  }
}

function getMarketplaceInitial(
  marketplace: Marketplace,
): string {
  switch (marketplace) {
    case 'Amazon':
      return 'A';

    case 'Myntra':
      return 'M';

    case 'Ajio':
      return 'A';

    case 'Flipkart':
      return 'F';

    default:
      return 'M';
  }
}

function TaskCard({
  task,
}: {
  task: Task;
}) {
  const { colors } = useTheme();

  const priorityColor = getPriorityColor(
    task.priority,
    colors,
  );

  const completed =
    task.status === 'Completed';

  return (
    <Card
      mode="outlined"
      style={[
        styles.taskCard,
        {
          backgroundColor: colors.surface,
          borderColor: colors.outlineVariant,
          opacity: completed ? 0.72 : 1,
        },
      ]}
    >
      <Card.Content style={styles.taskContent}>
        {/* Top row */}
        <View style={styles.taskTopRow}>
          <View
            style={[
              styles.taskIcon,
              {
                backgroundColor:
                  colors.surfaceVariant,
              },
            ]}
          >
            <IconButton
              icon={getTaskIcon(task.type)}
              size={20}
              iconColor={
                completed
                  ? colors.onSurfaceVariant
                  : colors.primary
              }
              style={styles.taskIconButton}
            />
          </View>

          <View style={styles.taskTitleContainer}>
            <Text
              variant="titleMedium"
              numberOfLines={2}
              style={[
                styles.taskTitle,
                {
                  color: colors.onSurface,
                  textDecorationLine:
                    completed
                      ? 'line-through'
                      : 'none',
                },
              ]}
            >
              {task.title}
            </Text>

            <Text
              variant="bodySmall"
              style={[
                styles.taskType,
                {
                  color: colors.onSurfaceVariant,
                },
              ]}
            >
              {task.type}
            </Text>
          </View>

          <View
            style={[
              styles.priorityIndicator,
              {
                backgroundColor:
                  `${priorityColor}18`,
              },
            ]}
          >
            <Text
              variant="labelSmall"
              style={[
                styles.priorityText,
                {
                  color: priorityColor,
                },
              ]}
            >
              {task.priority}
            </Text>
          </View>
        </View>

        {/* Description */}
        <Text
          variant="bodyMedium"
          numberOfLines={3}
          style={[
            styles.description,
            {
              color: colors.onSurfaceVariant,
            },
          ]}
        >
          {task.description}
        </Text>

        <Divider style={styles.divider} />

        {/* Bottom row */}
        <View style={styles.taskBottomRow}>
          <View style={styles.metadata}>
            <View style={styles.marketplace}>
              <Avatar.Text
                size={24}
                label={getMarketplaceInitial(
                  task.marketplace,
                )}
                style={{
                  backgroundColor:
                    colors.surfaceVariant,
                }}
                color={colors.onSurfaceVariant}
                labelStyle={styles.avatarLabel}
              />

              <Text
                variant="labelMedium"
                style={[
                  styles.marketplaceText,
                  {
                    color: colors.onSurface,
                  },
                ]}
              >
                {task.marketplace}
              </Text>
            </View>

            <View style={styles.dueDate}>
              <IconButton
                icon="calendar-outline"
                size={16}
                iconColor={
                  task.dueDate === 'Today'
                    ? colors.error
                    : colors.onSurfaceVariant
                }
                style={styles.smallIcon}
              />

              <Text
                variant="labelMedium"
                style={[
                  styles.dueDateText,
                  {
                    color:
                      task.dueDate === 'Today'
                        ? colors.error
                        : colors.onSurfaceVariant,
                  },
                ]}
              >
                {task.dueDate}
              </Text>
            </View>
          </View>

          {completed ? (
            <View style={styles.completedStatus}>
              <IconButton
                icon="check-circle"
                size={18}
                iconColor={colors.primary}
                style={styles.smallIcon}
              />

              <Text
                variant="labelSmall"
                style={{
                  color: colors.primary,
                  fontWeight: '600',
                }}
              >
                Done
              </Text>
            </View>
          ) : task.status === 'In Progress' ? (
            <View style={styles.inProgressStatus}>
              <Text
                variant="labelSmall"
                style={{
                  color: colors.primary,
                  fontWeight: '600',
                }}
              >
                In progress
              </Text>
            </View>
          ) : null}
        </View>
      </Card.Content>
    </Card>
  );
}

export default function TasksScreen() {
  const { colors } = useTheme();

  const [filter, setFilter] =
    useState<FilterValue>('All');

  const filteredTasks = useMemo(() => {
    if (filter === 'All') {
      return DEMO_TASKS;
    }

    return DEMO_TASKS.filter(
      (task) => task.status === filter,
    );
  }, [filter]);

  const counts = useMemo(() => {
    return {
      all: DEMO_TASKS.length,

      pending: DEMO_TASKS.filter(
        (task) => task.status === 'Pending',
      ).length,

      inProgress: DEMO_TASKS.filter(
        (task) => task.status === 'In Progress',
      ).length,

      completed: DEMO_TASKS.filter(
        (task) => task.status === 'Completed',
      ).length,

      highPriority: DEMO_TASKS.filter(
        (task) =>
          task.priority === 'High' &&
          task.status !== 'Completed',
      ).length,
    };
  }, []);

  return (
    <ScreenContainer scroll={false}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* ------------------------------------------------ */}
        {/* Header                                           */}
        {/* ------------------------------------------------ */}

        <View style={styles.header}>
          <View style={styles.headerTitleRow}>
            <View style={styles.headerText}>
              <Text
                variant="headlineSmall"
                style={[
                  styles.title,
                  {
                    color: colors.onSurface,
                  },
                ]}
              >
                Tasks
              </Text>

              <Text
                variant="bodyMedium"
                style={[
                  styles.subtitle,
                  {
                    color: colors.onSurfaceVariant,
                  },
                ]}
              >
                Actions that need your attention.
              </Text>
            </View>

            <View
              style={[
                styles.totalBadge,
                {
                  backgroundColor:
                    colors.primaryContainer,
                },
              ]}
            >
              <Text
                variant="titleMedium"
                style={{
                  color:
                    colors.onPrimaryContainer,
                  fontWeight: '700',
                }}
              >
                {counts.pending +
                  counts.inProgress}
              </Text>

              <Text
                variant="labelSmall"
                style={{
                  color:
                    colors.onPrimaryContainer,
                }}
              >
                Open
              </Text>
            </View>
          </View>
        </View>

        {/* ------------------------------------------------ */}
        {/* Summary                                          */}
        {/* ------------------------------------------------ */}

        <View style={styles.summaryRow}>
          <View
            style={[
              styles.summaryCard,
              {
                backgroundColor: colors.surface,
                borderColor: colors.outlineVariant,
              },
            ]}
          >
            <Text
              variant="headlineSmall"
              style={[
                styles.summaryValue,
                { color: colors.error },
              ]}
            >
              {counts.highPriority}
            </Text>

            <Text
              variant="bodySmall"
              style={{
                color: colors.onSurfaceVariant,
              }}
            >
              High priority
            </Text>
          </View>

          <View
            style={[
              styles.summaryCard,
              {
                backgroundColor: colors.surface,
                borderColor: colors.outlineVariant,
              },
            ]}
          >
            <Text
              variant="headlineSmall"
              style={[
                styles.summaryValue,
                { color: colors.primary },
              ]}
            >
              {counts.inProgress}
            </Text>

            <Text
              variant="bodySmall"
              style={{
                color: colors.onSurfaceVariant,
              }}
            >
              In progress
            </Text>
          </View>

          <View
            style={[
              styles.summaryCard,
              {
                backgroundColor: colors.surface,
                borderColor: colors.outlineVariant,
              },
            ]}
          >
            <Text
              variant="headlineSmall"
              style={[
                styles.summaryValue,
                { color: colors.onSurface },
              ]}
            >
              {counts.completed}
            </Text>

            <Text
              variant="bodySmall"
              style={{
                color: colors.onSurfaceVariant,
              }}
            >
              Completed
            </Text>
          </View>
        </View>

        {/* ------------------------------------------------ */}
        {/* Filters                                          */}
        {/* ------------------------------------------------ */}

        <View style={styles.filterContainer}>
          <SegmentedButtons
            value={filter}
            onValueChange={(value) =>
              setFilter(value as FilterValue)
            }
            buttons={[
              {
                value: 'All',
                label: `All ${counts.all}`,
              },
              {
                value: 'Pending',
                label: `Pending ${counts.pending}`,
              },
              {
                value: 'In Progress',
                label: `Active ${counts.inProgress}`,
              },
              {
                value: 'Completed',
                label: `Done ${counts.completed}`,
              },
            ]}
            density="small"
          />
        </View>

        {/* ------------------------------------------------ */}
        {/* Task list                                        */}
        {/* ------------------------------------------------ */}

        <View style={styles.taskList}>
          {filteredTasks.length > 0 ? (
            filteredTasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
              />
            ))
          ) : (
            <Card
              mode="outlined"
              style={[
                styles.emptyCard,
                {
                  backgroundColor: colors.surface,
                  borderColor:
                    colors.outlineVariant,
                },
              ]}
            >
              <Card.Content
                style={styles.emptyContent}
              >
                <View
                  style={[
                    styles.emptyIcon,
                    {
                      backgroundColor:
                        colors.surfaceVariant,
                    },
                  ]}
                >
                  <IconButton
                    icon="check-all"
                    size={28}
                    iconColor={colors.primary}
                    style={styles.emptyIconButton}
                  />
                </View>

                <Text
                  variant="titleMedium"
                  style={[
                    styles.emptyTitle,
                    {
                      color: colors.onSurface,
                    },
                  ]}
                >
                  All caught up
                </Text>

                <Text
                  variant="bodyMedium"
                  style={[
                    styles.emptyDescription,
                    {
                      color:
                        colors.onSurfaceVariant,
                    },
                  ]}
                >
                  There are no tasks in this category
                  right now.
                </Text>
              </Card.Content>
            </Card>
          )}
        </View>

        {/* ------------------------------------------------ */}
        {/* Demo indicator                                   */}
        {/* ------------------------------------------------ */}

        <View style={styles.demoNotice}>
          <IconButton
            icon="information-outline"
            size={17}
            iconColor={colors.onSurfaceVariant}
            style={styles.demoIcon}
          />

          <Text
            variant="bodySmall"
            style={{
              color: colors.onSurfaceVariant,
              flex: 1,
            }}
          >
            Demo tasks are shown here while the Tasks
            service is being connected.
          </Text>
        </View>

        <View style={styles.bottomSpacing} />
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: SPACING.xxl,
  },

  /* Header */

  header: {
    marginBottom: SPACING.lg,
  },

  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  headerText: {
    flex: 1,
    paddingRight: SPACING.md,
  },

  title: {
    fontWeight: '700',
    letterSpacing: -0.3,
  },

  subtitle: {
    marginTop: SPACING.xs,
    lineHeight: 20,
  },

  totalBadge: {
    minWidth: 56,
    minHeight: 56,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Summary */

  summaryRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },

  summaryCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.sm,
  },

  summaryValue: {
    fontWeight: '700',
  },

  /* Filters */

  filterContainer: {
    marginBottom: SPACING.lg,
  },

  /* Tasks */

  taskList: {
    gap: SPACING.sm,
  },

  taskCard: {
    borderRadius: RADIUS.lg,
    elevation: 0,
  },

  taskContent: {
    paddingVertical: SPACING.md,
  },

  taskTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },

  taskIcon: {
    width: 42,
    height: 42,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.sm,
  },

  taskIconButton: {
    margin: 0,
  },

  taskTitleContainer: {
    flex: 1,
    paddingRight: SPACING.xs,
  },

  taskTitle: {
    fontWeight: '700',
    lineHeight: 21,
  },

  taskType: {
    marginTop: 2,
  },

  priorityIndicator: {
    borderRadius: RADIUS.pill,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginLeft: SPACING.xs,
  },

  priorityText: {
    fontWeight: '700',
  },

  description: {
    lineHeight: 20,
    marginTop: SPACING.md,
  },

  divider: {
    marginVertical: SPACING.md,
  },

  taskBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  metadata: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },

  marketplace: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  marketplaceText: {
    marginLeft: 6,
    fontWeight: '600',
  },

  avatarLabel: {
    fontSize: 11,
    fontWeight: '700',
  },

  dueDate: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: SPACING.md,
  },

  smallIcon: {
    margin: 0,
  },

  dueDateText: {
    marginLeft: 2,
    fontWeight: '600',
  },

  completedStatus: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  inProgressStatus: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADIUS.pill,
  },

  /* Empty */

  emptyCard: {
    borderRadius: RADIUS.lg,
    elevation: 0,
  },

  emptyContent: {
    alignItems: 'center',
    paddingVertical: SPACING.xxl,
  },

  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },

  emptyIconButton: {
    margin: 0,
  },

  emptyTitle: {
    fontWeight: '700',
  },

  emptyDescription: {
    textAlign: 'center',
    marginTop: SPACING.xs,
    lineHeight: 20,
  },

  /* Demo */

  demoNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.lg,
    paddingHorizontal: SPACING.xs,
  },

  demoIcon: {
    margin: 0,
    marginRight: 2,
  },

  bottomSpacing: {
    height: SPACING.xl,
  },
});