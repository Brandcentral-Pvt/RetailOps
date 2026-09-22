/**
 * Notifications screen — the in-app notification centre.
 *
 * Remote device push is intentionally not wired up yet; the screen relies
 * on the in-app feed (Socket.IO + REST).
 */
import React, { useEffect } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  Button,
  Card,
  Text,
  useTheme,
} from 'react-native-paper';
import { useNotificationStore } from '../../store/notificationStore';
import { timeAgo } from '../../utils/time';
import FluentIcon from '../../components/FluentIcon';
import type { AppNotification } from '../../types';
import type { MainDrawerParamList } from '../../types';
import type { DrawerScreenProps } from '@react-navigation/drawer';

type Props = DrawerScreenProps<MainDrawerParamList, 'Notifications'>;

const ICON_BY_TYPE: Record<string, string> = {
  ALERT: 'fluent-color:alert-20',
  SLA_WARNING: 'fluent-color:alert-urgent-20',
  SLA_BREACH: 'fluent-color:alert-20',
  TASK: 'fluent:clipboard-task-20-filled',
  ACTION: 'fluent:checkmark-square-20-filled',
  TREND: 'fluent:arrow-trending-20-filled',
};

function notificationIcon(type: string | undefined): string {
  if (!type) return 'fluent:megaphone-20-filled';
  return ICON_BY_TYPE[String(type).toUpperCase()] ?? 'fluent:megaphone-20-filled';
}

function notificationTitle(item: AppNotification): string {
  const type = String(item.Type ?? '').replace(/_/g, ' ').trim();
  if (type) return type.charAt(0).toUpperCase() + type.slice(1);
  return 'Notification';
}

export default function NotificationsScreen(_props: Props) {
  const { colors } = useTheme();

  const items = useNotificationStore((s) => s.items);
  const unreadCount = useNotificationStore((s) => s.unreadCount);
  const isLoading = useNotificationStore((s) => s.isLoading);
  const isRefreshing = useNotificationStore((s) => s.isRefreshing);
  const error = useNotificationStore((s) => s.error);
  const refresh = useNotificationStore((s) => s.refresh);
  const loadMore = useNotificationStore((s) => s.loadMore);
  const markRead = useNotificationStore((s) => s.markRead);
  const markAllRead = useNotificationStore((s) => s.markAllRead);

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const renderItem = ({ item }: { item: AppNotification }) => {
    const id = item._id ?? item.Id;
    const isRead = Boolean(item.IsRead);
    return (
      <TouchableOpacity
        onPress={() => markRead(id)}
        activeOpacity={0.7}
      >
        <Card
          mode="outlined"
          style={[
            styles.card,
            { borderColor: colors.outlineVariant },
            !isRead && { backgroundColor: colors.primaryContainer },
          ]}
        >
          <Card.Content style={styles.cardContent}>
            <View
              style={[
                styles.iconWrap,
                { backgroundColor: colors.primaryContainer },
              ]}
            >
              <FluentIcon
                name={notificationIcon(item.Type)}
                size={20}
                color={colors.primary}
              />
            </View>

            <View style={styles.cardBody}>
              <View style={styles.cardTitleRow}>
                <Text
                  variant="labelLarge"
                  style={[
                    styles.cardTitle,
                    { color: colors.onSurface },
                    !isRead && styles.unreadText,
                  ]}
                  numberOfLines={1}
                >
                  {notificationTitle(item)}
                </Text>
                <Text
                  variant="labelSmall"
                  style={{ color: colors.onSurfaceVariant }}
                >
                  {timeAgo(item.CreatedAt)}
                </Text>
              </View>

              <Text
                variant="bodySmall"
                style={{ color: colors.onSurfaceVariant }}
                numberOfLines={3}
              >
                {item.Message}
              </Text>
            </View>

            {!isRead ? (
              <View
                style={[
                  styles.unreadDot,
                  { backgroundColor: colors.primary },
                ]}
              />
            ) : null}
          </Card.Content>
        </Card>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      {unreadCount > 0 ? (
        <View style={styles.actionsRow}>
          <Button
            mode="text"
            compact
            onPress={markAllRead}
          >
            Mark all as read
          </Button>
        </View>
      ) : null}

      <FlatList
        data={items}
        keyExtractor={(item) => item._id ?? item.Id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        onEndReached={loadMore}
        onEndReachedThreshold={0.4}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={refresh}
            tintColor={colors.primary}
          />
        }
        ListEmptyComponent={
          isLoading ? (
            <View style={styles.stateContainer}>
              <ActivityIndicator size={26} color={colors.primary} />
            </View>
          ) : (
            <View style={styles.stateContainer}>
              <FluentIcon
                name="fluent-color:checkmark-circle-20"
                size={40}
              />
              <Text
                variant="bodyMedium"
                style={{
                  color: colors.onSurfaceVariant,
                  marginTop: 10,
                  textAlign: 'center',
                }}
              >
                {error ? error : 'You are all caught up.'}
              </Text>
            </View>
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },

  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 8,
    marginTop: 4,
  },

  listContent: {
    padding: 16,
    paddingTop: 8,
    flexGrow: 1,
  },

  card: {
    marginBottom: 10,
    borderRadius: 12,
  },

  cardContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
  },

  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },

  cardBody: {
    flex: 1,
  },

  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },

  cardTitle: {
    flex: 1,
    marginRight: 8,
  },

  unreadText: {
    fontWeight: '700',
  },

  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: 8,
    marginTop: 6,
  },

  stateContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 32,
  },
});