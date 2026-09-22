import React from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import {
  Surface,
  Text,
  TouchableRipple,
  useTheme,
} from 'react-native-paper';

import FluentIcon from '../FluentIcon';

import { RADIUS, SPACING } from '../../theme/theme';

export type DashboardPeriodKey = '7d' | '30d' | '3m' | '1y';

export interface DashboardPeriod {
  key: DashboardPeriodKey;
  label: string;
}

export const DASHBOARD_PERIODS: DashboardPeriod[] = [
  {
    key: '7d',
    label: 'Last 7 days',
  },
  {
    key: '30d',
    label: 'Last 30 days',
  },
  {
    key: '3m',
    label: 'Last 3 months',
  },
  {
    key: '1y',
    label: 'Last 12 months',
  },
];

interface Props {
  visible: boolean;
  selectedPeriod: DashboardPeriodKey;
  onSelect: (period: DashboardPeriodKey) => void;
  onDismiss: () => void;
  onCustomRangePress?: () => void;
}

export default function DashboardPeriodSelector({
  visible,
  selectedPeriod,
  onSelect,
  onDismiss,
  onCustomRangePress,
}: Props) {
  const { colors } = useTheme();

  const handlePeriodSelect = (period: DashboardPeriodKey) => {
    onSelect(period);
    onDismiss();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
    >
      <View style={styles.overlay}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onDismiss}
        />

        <Surface
          elevation={5}
          style={[
            styles.sheet,
            {
              backgroundColor: colors.surface,
            },
          ]}
        >
          <View style={styles.handleContainer}>
            <View
              style={[
                styles.handle,
                {
                  backgroundColor: colors.outlineVariant,
                },
              ]}
            />
          </View>

          <View style={styles.header}>
            <View style={styles.headerText}>
              <Text
                variant="titleLarge"
                style={[
                  styles.title,
                  {
                    color: colors.onSurface,
                  },
                ]}
              >
                Select period
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
                Choose the reporting period for your dashboard
              </Text>
            </View>

            <TouchableRipple
              borderless
              onPress={onDismiss}
              style={styles.closeButton}
              rippleColor={colors.surfaceVariant}
            >
              <FluentIcon
                name="fluent:dismiss-20-filled"
                size={21}
                color={colors.onSurfaceVariant}
              />
            </TouchableRipple>
          </View>

          <View style={styles.section}>
            <Text
              variant="labelMedium"
              style={[
                styles.sectionLabel,
                {
                  color: colors.onSurfaceVariant,
                },
              ]}
            >
              TIME RANGE
            </Text>

            <View
              style={[
                styles.optionsContainer,
                {
                  borderColor: colors.outlineVariant,
                  backgroundColor: colors.surface,
                },
              ]}
            >
              {DASHBOARD_PERIODS.map((period, index) => {
                const selected = period.key === selectedPeriod;
                const isLast =
                  index === DASHBOARD_PERIODS.length - 1;

                return (
                  <View key={period.key}>
                    <TouchableRipple
                      onPress={() =>
                        handlePeriodSelect(period.key)
                      }
                      rippleColor={colors.primaryContainer}
                    >
                      <View
                        style={[
                          styles.option,
                          selected && {
                            backgroundColor:
                              colors.primaryContainer,
                          },
                        ]}
                      >
                        <View
                          style={[
                            styles.optionIcon,
                            {
                              backgroundColor: selected
                                ? colors.primary
                                : colors.surfaceVariant,
                            },
                          ]}
                        >
                          <FluentIcon
                            name="fluent-color:calendar-20"
                            size={18}
                          />
                        </View>

                        <Text
                          variant="bodyLarge"
                          style={[
                            styles.optionLabel,
                            {
                              color: colors.onSurface,
                            },
                            selected && styles.selectedOptionLabel,
                          ]}
                        >
                          {period.label}
                        </Text>

                        {selected ? (
                          <View
                            style={[
                              styles.checkContainer,
                              {
                                backgroundColor:
                                  colors.primary,
                              },
                            ]}
                          >
                            <FluentIcon
                              name="fluent:checkmark-20-filled"
                              size={15}
                              color={colors.onPrimary}
                            />
                          </View>
                        ) : (
                          <FluentIcon
                            name="fluent:chevron-right-20-filled"
                            size={20}
                            color={colors.onSurfaceVariant}
                          />
                        )}
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
              })}
            </View>
          </View>

          {onCustomRangePress ? (
            <View style={styles.customSection}>
              <Text
                variant="labelMedium"
                style={[
                  styles.sectionLabel,
                  {
                    color: colors.onSurfaceVariant,
                  },
                ]}
              >
                CUSTOM
              </Text>

              <TouchableRipple
                onPress={() => {
                  onDismiss();
                  onCustomRangePress();
                }}
                rippleColor={colors.primaryContainer}
                style={[
                  styles.customButton,
                  {
                    borderColor: colors.outlineVariant,
                    backgroundColor: colors.surface,
                  },
                ]}
              >
                <View style={styles.customContent}>
                  <View
                    style={[
                      styles.customIcon,
                      {
                        backgroundColor:
                          colors.surfaceVariant,
                      },
                    ]}
                  >
                    <FluentIcon
                      name="fluent-color:calendar-20"
                      size={18}
                    />
                  </View>

                  <View style={styles.customText}>
                    <Text
                      variant="bodyMedium"
                      style={[
                        styles.customTitle,
                        {
                          color: colors.onSurface,
                        },
                      ]}
                    >
                      Custom date range
                    </Text>

                    <Text
                      variant="bodySmall"
                      style={[
                        styles.customSubtitle,
                        {
                          color: colors.onSurfaceVariant,
                        },
                      ]}
                    >
                      Choose specific start and end dates
                    </Text>
                  </View>

                  <FluentIcon
                    name="fluent:chevron-right-20-filled"
                    size={20}
                    color={colors.onSurfaceVariant}
                  />
                </View>
              </TouchableRipple>
            </View>
          ) : null}

          <View style={styles.bottomSpacing} />
        </Surface>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(15, 23, 42, 0.42)',
  },

  sheet: {
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    paddingTop: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.md,
  },

  handleContainer: {
    alignItems: 'center',
    marginBottom: SPACING.md,
  },

  handle: {
    width: 38,
    height: 4,
    borderRadius: RADIUS.pill,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.lg,
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
    marginTop: 4,
    lineHeight: 18,
  },

  closeButton: {
    width: 38,
    height: 38,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },

  section: {
    width: '100%',
  },

  sectionLabel: {
    fontWeight: '700',
    letterSpacing: 0.7,
    marginBottom: SPACING.sm,
  },

  optionsContainer: {
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
  },

  option: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.sm,
  },

  optionIcon: {
    width: 38,
    height: 38,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.sm,
  },

  optionLabel: {
    flex: 1,
    fontWeight: '500',
  },

  selectedOptionLabel: {
    fontWeight: '700',
  },

  checkContainer: {
    width: 26,
    height: 26,
    borderRadius: RADIUS.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },

  divider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 54,
  },

  customSection: {
    marginTop: SPACING.lg,
  },

  customButton: {
    minHeight: 64,
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
  },

  customContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
  },

  customIcon: {
    width: 38,
    height: 38,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.sm,
  },

  customText: {
    flex: 1,
  },

  customTitle: {
    fontWeight: '600',
  },

  customSubtitle: {
    marginTop: 2,
  },

  bottomSpacing: {
    height: SPACING.sm,
  },
});