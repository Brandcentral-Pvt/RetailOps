/**
 * MessagesScreen
 *
 * Displays the seller's conversations.
 *
 * Notes:
 * - Uses atomic Zustand selectors for reactive state.
 * - Gets store actions through getState() so action functions do not
 *   participate in React subscriptions.
 * - Never conditionally calls hooks.
 * - Defensively handles undefined conversation arrays.
 * - Supports pull-to-refresh.
 * - Opens an existing conversation.
 * - Provides a FAB for starting a new conversation.
 */

import React, {
  useCallback,
} from 'react';

import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  View,
} from 'react-native';

import {
  Avatar,
  Badge,
  FAB,
  Icon,
  Text,
  TouchableRipple,
  useTheme,
} from 'react-native-paper';

import {
  useFocusEffect,
} from '@react-navigation/native';

import type {
  NativeStackScreenProps,
} from '@react-navigation/native-stack';

import {
  useAuthStore,
} from '../../store/authStore';

import { useShallow } from 'zustand/react/shallow';

import {
  useChatStore,
} from '../../store/chatStore';

import type {
  ChatConversation,
  MessagesStackParamList,
} from '../../types';

import { timeAgo } from '../../utils/time';

type Props =
  NativeStackScreenProps<
    MessagesStackParamList,
    'MessagesList'
  >;

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function getInitials(
  name: string,
): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  return parts
    .slice(0, 2)
    .map(
      (part) =>
        part.charAt(0).toUpperCase(),
    )
    .join('');
}

function getConversationTitle(
  conversation: ChatConversation,
  myId: string,
): string {
  if (
    conversation.type === 'GROUP'
  ) {
    return (
      conversation.title?.trim() ||
      'Group conversation'
    );
  }

  const otherParticipant =
    conversation.participants?.find(
      (participant) =>
        participant._id !== myId,
    );

  return (
    otherParticipant?.name?.trim() ||
    'Conversation'
  );
}

function getMessagePreview(
  conversation: ChatConversation,
  myId: string,
): string {
  const message =
    conversation.lastMessage;

  if (!message) {
    return 'No messages yet';
  }

  const senderPrefix =
    message.senderId === myId
      ? 'You: '
      : '';

  switch (message.type) {
    case 'IMAGE':
      return `${senderPrefix}Photo`;

    case 'FILE':
      return `${senderPrefix}Attachment`;

    default:
      return (
        senderPrefix +
        (message.content?.trim() ||
          'Message')
      );
  }
}

/* -------------------------------------------------------------------------- */
/* Screen                                                                     */
/* -------------------------------------------------------------------------- */

export default function MessagesScreen({
  navigation,
}: Props) {
  const { colors } =
    useTheme();

  /*
   * IMPORTANT:
   *
   * These are primitive / stable selectors.
   * Do not replace these with:
   *
   * useAuthStore(state => ({
   *   myId: ...
   * }))
   *
   * because that creates a new object on every
   * selector execution under Zustand 5.
   */
  const myId =
    useAuthStore(
      (state) =>
        state.user?.id ??
        state.user?._id ??
        '',
    );

  const conversations =
    useChatStore(
      useShallow((state) => state.conversations),
    );

  const loadingConversations =
    useChatStore(
      useShallow((state) => state.loadingConversations),
    );

  /*
   * Actions do not need to be React subscriptions.
   *
   * This avoids unnecessary component updates when
   * Zustand state changes elsewhere.
   */
  const refresh =
    useChatStore.getState()
      .refresh;

  const refreshUnread =
    useChatStore.getState()
      .refreshUnread;

  /*
   * Refresh whenever this screen receives focus.
   *
   * The callback intentionally has no Zustand action
   * dependencies because actions are read directly
   * from the store.
   */
  useFocusEffect(
    useCallback(() => {
      void refresh();
      void refreshUnread();
    }, []),
  );

  /*
   * Always guarantee an array for FlatList.
   */
  const safeConversations =
    Array.isArray(
      conversations,
    )
      ? conversations
      : [];

  /* ------------------------------------------------------------------------ */
  /* Handlers                                                                 */
  /* ------------------------------------------------------------------------ */

  const handleRefresh =
    useCallback(() => {
      void refresh();
      void refreshUnread();
    }, []);

  const handleConversationPress =
    useCallback(
      (
        conversation: ChatConversation,
      ) => {
        const title =
          getConversationTitle(
            conversation,
            myId,
          );

        navigation.navigate(
          'Chat',
          {
            conversationId:
              conversation.id,
            title,
          },
        );
      },
      [
        navigation,
        myId,
      ],
    );

  /* ------------------------------------------------------------------------ */
  /* Conversation row                                                         */
  /* ------------------------------------------------------------------------ */

  const renderConversation =
    useCallback(
      ({
        item,
      }: {
        item: ChatConversation;
      }) => {
        const title =
          getConversationTitle(
            item,
            myId,
          );

        const preview =
          getMessagePreview(
            item,
            myId,
          );

        const timestamp =
          timeAgo(
            item.lastMessage
              ?.createdAt ??
              item.updatedAt,
          );

        const unreadCount =
          Number(
            item.unreadCount ?? 0,
          );

        const isGroup =
          item.type === 'GROUP';

        const avatarColor =
          colors.onPrimaryContainer;

        return (
          <TouchableRipple
            onPress={() =>
              handleConversationPress(
                item,
              )
            }
            rippleColor={
              colors.primaryContainer
            }
            accessibilityRole="button"
            accessibilityLabel={title}
            style={[
              styles.conversationRow,
              {
                borderBottomColor:
                  colors.outlineVariant,
              },
            ]}
          >
            <View
              style={
                styles.rowInner
              }
            >
              {/* Avatar */}
              {isGroup ? (
                <Avatar.Icon
                  size={48}
                  icon="account-group-outline"
                  color={avatarColor}
                  style={[
                    styles.avatar,
                    {
                      backgroundColor:
                        colors.primaryContainer,
                    },
                  ]}
                />
              ) : (
                <Avatar.Text
                  size={48}
                  label={getInitials(
                    title,
                  )}
                  color={avatarColor}
                  style={[
                    styles.avatar,
                    {
                      backgroundColor:
                        colors.primaryContainer,
                    },
                  ]}
                />
              )}

              {/* Conversation content */}
              <View
                style={
                  styles.conversationBody
                }
              >
                {/* Title + timestamp */}
                <View
                  style={
                    styles.titleRow
                  }
                >
                  <Text
                    variant="titleSmall"
                    numberOfLines={
                      1
                    }
                    style={[
                      styles.conversationTitle,
                      unreadCount > 0 && {
                        fontWeight: '700',
                      },
                      {
                        color:
                          colors.onSurface,
                      },
                    ]}
                  >
                    {title}
                  </Text>

                  <Text
                    variant="labelSmall"
                    style={[
                      styles.timestamp,
                      {
                        color:
                          colors.onSurfaceVariant,
                      },
                    ]}
                  >
                    {timestamp}
                  </Text>
                </View>

                {/* Preview + unread */}
                <View
                  style={
                    styles.previewRow
                  }
                >
                  <Text
                    variant="bodySmall"
                    numberOfLines={
                      1
                    }
                    style={[
                      styles.preview,
                      unreadCount > 0 && {
                        fontWeight: '500',
                      },
                      {
                        color:
                          colors.onSurfaceVariant,
                      },
                    ]}
                  >
                    {preview}
                  </Text>

                  {unreadCount >
                  0 ? (
                    <Badge
                      size={20}
                      style={{
                        backgroundColor:
                          colors.primary,
                      }}
                    >
                      {unreadCount >
                      99
                        ? '99+'
                        : unreadCount}
                    </Badge>
                  ) : null}
                </View>
              </View>

              {/* Chevron */}
              <View style={styles.chevron}>
                <Icon
                  source="chevron-right"
                  size={20}
                  color={
                    colors.onSurfaceVariant
                  }
                />
              </View>
            </View>
          </TouchableRipple>
        );
      },
      [
        colors,
        handleConversationPress,
        myId,
      ],
    );

  /* ------------------------------------------------------------------------ */
  /* Empty state                                                              */
  /* ------------------------------------------------------------------------ */

  const renderEmptyState =
    useCallback(() => {
      if (
        loadingConversations
      ) {
        return null;
      }

      return (
        <View
          style={
            styles.emptyContainer
          }
        >
          <Avatar.Icon
            size={60}
            icon="message-outline"
            color={
              colors.onPrimaryContainer
            }
            style={[
              styles.emptyIcon,
              {
                backgroundColor:
                  colors.primaryContainer,
              },
            ]}
          />

          <Text
            variant="titleMedium"
            style={[
              styles.emptyTitle,
              {
                color:
                  colors.onSurface,
              },
            ]}
          >
            No conversations yet
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
            Start a conversation
            to connect with your
            team or support.
          </Text>
        </View>
      );
    }, [
      colors,
      loadingConversations,
    ]);

  /* ------------------------------------------------------------------------ */
  /* Loading state                                                            */
  /* ------------------------------------------------------------------------ */

  if (
    loadingConversations &&
    safeConversations.length === 0
  ) {
    return (
      <View
        style={[
          styles.screen,
          {
            backgroundColor:
              colors.background,
          },
        ]}
      >
        <View
          style={
            styles.loadingContainer
          }
        >
          <ActivityIndicator
            size="small"
            color={
              colors.primary
            }
          />

          <Text
            variant="bodyMedium"
            style={[
              styles.loadingText,
              {
                color:
                  colors.onSurfaceVariant,
              },
            ]}
          >
            Loading conversations…
          </Text>
        </View>
      </View>
    );
  }

  /* ------------------------------------------------------------------------ */
  /* Render                                                                   */
  /* ------------------------------------------------------------------------ */

  return (
    <View
      style={[
        styles.screen,
        {
          backgroundColor:
            colors.background,
        },
      ]}
    >
      <FlatList
        data={
          safeConversations
        }
        keyExtractor={(
          item,
        ) => item.id}
        renderItem={
          renderConversation
        }
        showsVerticalScrollIndicator={
          false
        }
        contentContainerStyle={
          safeConversations.length ===
          0
            ? styles.emptyList
            : styles.listContent
        }
        ListEmptyComponent={
          renderEmptyState
        }
        refreshControl={
          <RefreshControl
            refreshing={
              loadingConversations
            }
            onRefresh={
              handleRefresh
            }
            tintColor={
              colors.primary
            }
            colors={[
              colors.primary,
            ]}
          />
        }
      />

      {/* New conversation */}
      <FAB
        icon="chat-plus-outline"
        variant="primary"
        style={styles.fab}
        onPress={() =>
          navigation.navigate(
            'NewChat',
          )
        }
      />
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/* Styles                                                                     */
/* -------------------------------------------------------------------------- */

const styles =
  StyleSheet.create({
    screen: {
      flex: 1,
    },

    listContent: {
      paddingBottom: 96,
    },

    emptyList: {
      flexGrow: 1,
      paddingBottom: 96,
    },

    loadingContainer: {
      flex: 1,
      alignItems:
        'center',
      justifyContent:
        'center',
      gap: 10,
    },

    loadingText: {
      textAlign:
        'center',
    },

    conversationRow: {
      borderBottomWidth:
        StyleSheet.hairlineWidth,
      overflow: 'hidden',
    },

    rowInner: {
      minHeight: 76,
      flexDirection:
        'row',
      alignItems:
        'center',
      paddingHorizontal: 16,
      paddingVertical: 13,
    },

    avatar: {
      marginRight: 12,
    },

    conversationBody: {
      flex: 1,
      minWidth: 0,
    },

    titleRow: {
      flexDirection:
        'row',
      alignItems:
        'center',
      justifyContent:
        'space-between',
      gap: 12,
      marginBottom: 5,
    },

    conversationTitle: {
      flex: 1,
      fontWeight:
        '600',
    },

    timestamp: {
      flexShrink: 0,
    },

    previewRow: {
      flexDirection:
        'row',
      alignItems:
        'center',
      justifyContent:
        'space-between',
      gap: 10,
    },

    preview: {
      flex: 1,
    },

    chevron: {
      width: 20,
      alignItems:
        'flex-end',
      marginLeft: 8,
    },

    emptyContainer: {
      flex: 1,
      alignItems:
        'center',
      justifyContent:
        'center',
      paddingHorizontal: 32,
    },

    emptyIcon: {
      marginBottom: 16,
    },

    emptyTitle: {
      marginBottom: 6,
      fontWeight:
        '600',
      textAlign:
        'center',
    },

    emptyDescription: {
      maxWidth: 300,
      textAlign:
        'center',
      lineHeight: 21,
    },

    fab: {
      position:
        'absolute',
      right: 16,
      bottom: 16,
    },
  });