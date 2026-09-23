/**
 * Call History Screen — list of past calls (missed, received, dialed).
 */

import React, { useMemo } from 'react';
import {
  FlatList,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  Avatar,
  IconButton,
  Text,
  useTheme,
} from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import type { DrawerNavigationProp } from '@react-navigation/drawer';

import { useCallStore } from '../../store/callStore';
import { initials } from '../../utils/avatar';
import type { CallSession, MainDrawerParamList } from '../../types';

const ICON_NAMES = {
  incoming: 'phone-incoming',
  outgoing: 'phone-outgoing',
  missed: 'phone-missed',
} as const;

export default function CallHistoryScreen() {
  const navigation =
    useNavigation<DrawerNavigationProp<MainDrawerParamList>>();

  const { colors } = useTheme();

  const callHistory = useCallStore((state) => state.callHistory);

  const styles = useMemo(
    () => createStyles(colors),
    [colors],
  );

  const groupedHistory = useMemo(() => {
    const groups: Record<string, CallSession[]> = {};

    callHistory.forEach((call) => {
      const date = new Date(call.startedAt);

      const today = new Date();

      const yesterday = new Date(today);
      yesterday.setDate(today.getDate() - 1);

      let label: string;

      if (date.toDateString() === today.toDateString()) {
        label = 'Today';
      } else if (date.toDateString() === yesterday.toDateString()) {
        label = 'Yesterday';
      } else {
        label = date.toLocaleDateString(undefined, {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
        });
      }

      if (!groups[label]) {
        groups[label] = [];
      }

      groups[label].push(call);
    });

    return groups;
  }, [callHistory]);

  const sections = useMemo(
    () =>
      Object.entries(groupedHistory).map(([title, data]) => ({
        title,
        data,
      })),
    [groupedHistory],
  );

  const openMessages = () => {
    navigation.navigate('Messages');
  };

  const renderItem = ({
    item,
  }: {
    item: CallSession;
  }) => {
    const isMissed =
      item.endReason === 'missed' ||
      item.endReason === 'rejected';

    const isOutgoing = item.direction === 'outgoing';

    const other = isOutgoing ? item.callee : item.caller;

    let iconName: string = ICON_NAMES.incoming;
    let iconColor = colors.primary;

    if (isMissed) {
      iconName = ICON_NAMES.missed;
      iconColor = colors.error;
    } else if (isOutgoing) {
      iconName = ICON_NAMES.outgoing;
      iconColor = colors.primary;
    }

    const duration =
      item.duration != null
        ? `${Math.floor(item.duration / 60)}:${(
            item.duration % 60
          )
            .toString()
            .padStart(2, '0')}`
        : '—';

    const time = new Date(item.startedAt).toLocaleTimeString(
      undefined,
      {
        hour: 'numeric',
        minute: '2-digit',
      },
    );

    return (
      <TouchableOpacity
        onPress={openMessages}
        style={styles.item}
        accessibilityRole="button"
        accessibilityLabel={`Open messages for ${other.name}`}
        activeOpacity={0.7}
      >
        {/* Avatar */}
        <View style={styles.itemLeft}>
          {other.avatar ? (
            <Avatar.Image
              size={48}
              source={{ uri: other.avatar }}
              accessibilityLabel={other.name}
            />
          ) : (
            <Avatar.Text
              size={48}
              label={initials(other.name)}
              color={colors.onPrimaryContainer}
              style={{
                backgroundColor: colors.primaryContainer,
              }}
            />
          )}
        </View>

        {/* Call information */}
        <View style={styles.itemCenter}>
          <View style={styles.itemTop}>
            <Text
              style={styles.callerName}
              variant="bodyLarge"
              numberOfLines={1}
            >
              {other.name}
            </Text>

            <View style={styles.iconRow}>
              <IconButton
                icon={iconName}
                size={16}
                iconColor={iconColor}
                disabled
                style={styles.typeIcon}
              />

              <Text
                style={[
                  styles.callType,
                  {
                    color: iconColor,
                  },
                ]}
                variant="labelSmall"
              >
                {item.type === 'video' ? 'Video' : 'Voice'}
              </Text>
            </View>
          </View>

          <View style={styles.itemBottom}>
            <Text
              style={styles.callTime}
              variant="labelSmall"
            >
              {time}
            </Text>

            <Text
              style={styles.callDuration}
              variant="labelSmall"
            >
              {duration}
            </Text>
          </View>
        </View>

        {/* Call action */}
        <View style={styles.itemRight}>
          <IconButton
            icon="phone"
            size={20}
            iconColor={colors.primary}
            onPress={(event) => {
              event.stopPropagation();
              openMessages();
            }}
            accessibilityLabel={`Call ${other.name}`}
          />
        </View>
      </TouchableOpacity>
    );
  };

  if (callHistory.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <View
          style={[
            styles.emptyIcon,
            {
              backgroundColor: colors.primaryContainer,
            },
          ]}
        >
          <IconButton
            icon="phone-outline"
            size={28}
            iconColor={colors.primary}
            disabled
          />
        </View>

        <Text
          style={styles.emptyText}
          variant="bodyLarge"
        >
          No call history yet
        </Text>

        <Text
          style={styles.emptySubtext}
          variant="bodyMedium"
        >
          Your incoming, outgoing, and missed calls will appear here
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      data={sections}
      keyExtractor={(section) => section.title}
      renderItem={({ item, index }) => (
        <View>
          {index > 0 ? (
            <View style={styles.sectionDivider} />
          ) : null}

          <View style={styles.section}>
            {/* Section header */}
            <View style={styles.sectionHeader}>
              <Text
                style={styles.sectionTitle}
                variant="labelLarge"
              >
                {item.title}
              </Text>
            </View>

            {/* Calls */}
            {item.data.map((call, callIndex) => (
              <React.Fragment key={call.id}>
                {callIndex > 0 ? (
                  <View style={styles.itemDivider} />
                ) : null}

                {renderItem({ item: call })}
              </React.Fragment>
            ))}
          </View>
        </View>
      )}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.listContent}
    />
  );
}

function createStyles(
  colors: ReturnType<typeof useTheme>['colors'],
) {
  return StyleSheet.create({
    listContent: {
      paddingVertical: 8,
    },

    section: {
      marginBottom: 8,
    },

    sectionHeader: {
      paddingVertical: 9,
      paddingHorizontal: 16,
      backgroundColor: colors.surfaceVariant,
    },

    sectionTitle: {
      color: colors.onSurfaceVariant,
      fontWeight: '700',
    },

    sectionDivider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors.outlineVariant,
      marginHorizontal: 16,
    },

    item: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      paddingHorizontal: 16,
      backgroundColor: colors.background,
    },

    itemLeft: {
      marginRight: 12,
    },

    itemCenter: {
      flex: 1,
      minWidth: 0,
    },

    itemTop: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 4,
      minWidth: 0,
    },

    callerName: {
      flex: 1,
      minWidth: 0,
      marginRight: 8,
      color: colors.onSurface,
      fontWeight: '500',
    },

    iconRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },

    typeIcon: {
      margin: 0,
      marginRight: 2,
    },

    callType: {
      fontWeight: '500',
      fontSize: 12,
    },

    itemBottom: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },

    callTime: {
      color: colors.onSurfaceVariant,
    },

    callDuration: {
      color: colors.onSurfaceVariant,
      fontWeight: '500',
    },

    itemRight: {
      marginLeft: 8,
    },

    itemDivider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors.outlineVariant,
      marginLeft: 76,
    },

    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 32,
      backgroundColor: colors.background,
    },

    emptyIcon: {
      width: 64,
      height: 64,
      borderRadius: 32,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 16,
    },

    emptyText: {
      color: colors.onSurface,
      textAlign: 'center',
      marginBottom: 8,
      fontWeight: '700',
    },

    emptySubtext: {
      color: colors.onSurfaceVariant,
      textAlign: 'center',
      lineHeight: 20,
    },
  });
}