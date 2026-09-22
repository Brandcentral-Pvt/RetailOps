import React from 'react';
import { StyleSheet, View } from 'react-native';
import {
  Surface,
  Text,
  TouchableRipple,
  useTheme,
} from 'react-native-paper';

import FluentIcon from '../FluentIcon';

import { RADIUS, SPACING } from '../../theme/theme';

interface Props {
  greeting: string;
  name: string;
  periodLabel: string;
  onPeriodPress?: () => void;
  onNotificationPress?: () => void;
  notificationCount?: number;
}

export default function DashboardHeader({
  greeting,
  name,
  periodLabel,
  onPeriodPress,
  onNotificationPress,
  notificationCount = 0,
}: Props) {
  const { colors } = useTheme();

  return (
    <View style={styles.container}>
      {/* Top context row */}
      <View style={styles.topRow}>
        <View style={styles.contextContainer}>
          <View
            style={[
              styles.contextIndicator,
              {
                backgroundColor: colors.primary,
              },
            ]}
          />

          <Text
            variant="labelMedium"
            style={[
              styles.contextLabel,
              {
                color: colors.onSurfaceVariant,
              },
            ]}
          >
            BUSINESS OVERVIEW
          </Text>
        </View>

        {onNotificationPress ? (
          <Surface
            mode="flat"
            style={[
              styles.notificationContainer,
              {
                backgroundColor: colors.surface,
                borderColor: colors.outlineVariant,
              },
            ]}
          >
            <TouchableRipple
              borderless
              onPress={onNotificationPress}
              style={styles.notificationButton}
              rippleColor={colors.primaryContainer}
            >
              <View style={styles.notificationContent}>
                <FluentIcon
                  name="fluent-color:alert-20"
                  size={20}
                />

                {notificationCount > 0 ? (
                  <View
                    style={[
                      styles.notificationBadge,
                      {
                        backgroundColor: colors.error,
                      },
                    ]}
                  >
                    <Text
                      variant="labelSmall"
                      style={styles.notificationBadgeText}
                    >
                      {notificationCount > 9
                        ? '9+'
                        : notificationCount}
                    </Text>
                  </View>
                ) : null}
              </View>
            </TouchableRipple>
          </Surface>
        ) : null}
      </View>

      {/* Greeting */}
      <View style={styles.heading}>
        <Text
          variant="headlineSmall"
          style={[
            styles.greeting,
            {
              color: colors.onSurface,
            },
          ]}
          numberOfLines={1}
        >
          {greeting}, {name}
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
          Here's what's happening across your business.
        </Text>
      </View>

      {/* Period selector */}
      <TouchableRipple
        onPress={onPeriodPress}
        borderless
        rippleColor={colors.primaryContainer}
        style={[
          styles.periodButton,
          {
            backgroundColor: colors.surface,
            borderColor: colors.outlineVariant,
          },
        ]}
      >
        <View style={styles.periodContent}>
          <View
            style={[
              styles.calendarContainer,
              {
                backgroundColor: colors.surfaceVariant,
              },
            ]}
          >
            <FluentIcon
              name="fluent-color:calendar-20"
              size={17}
            />
          </View>

          <View style={styles.periodTextContainer}>
            <Text
              variant="labelSmall"
              style={[
                styles.periodLabel,
                {
                  color: colors.onSurfaceVariant,
                },
              ]}
            >
              PERIOD
            </Text>

            <Text
              variant="labelLarge"
              style={[
                styles.periodText,
                {
                  color: colors.onSurface,
                },
              ]}
              numberOfLines={1}
            >
              {periodLabel}
            </Text>
          </View>

          <FluentIcon
            name="fluent:chevron-down-20-filled"
            size={19}
            color={colors.onSurfaceVariant}
          />
        </View>
      </TouchableRipple>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.sm,
  },

  topRow: {
    minHeight: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  contextContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  contextIndicator: {
    width: 6,
    height: 6,
    borderRadius: RADIUS.pill,
    marginRight: SPACING.sm,
  },

  contextLabel: {
    fontWeight: '700',
    letterSpacing: 0.8,
  },

  notificationContainer: {
    width: 38,
    height: 38,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    overflow: 'hidden',
  },

  notificationButton: {
    width: '100%',
    height: '100%',
  },

  notificationContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  notificationBadge: {
    position: 'absolute',
    top: 3,
    right: 3,
    minWidth: 18,
    height: 18,
    borderRadius: RADIUS.pill,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },

  notificationBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '700',
  },

  heading: {
    marginTop: SPACING.md,
    marginBottom: SPACING.md,
  },

  greeting: {
    fontWeight: '700',
    letterSpacing: -0.5,
  },

  subtitle: {
    marginTop: SPACING.xs,
    lineHeight: 20,
  },

  periodButton: {
    alignSelf: 'stretch',
    minHeight: 56,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },

  periodContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
  },

  calendarContainer: {
    width: 38,
    height: 38,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.sm,
  },

  periodTextContainer: {
    flex: 1,
  },

  periodLabel: {
    fontWeight: '700',
    letterSpacing: 0.5,
  },

  periodText: {
    fontWeight: '600',
    marginTop: 1,
  },
});