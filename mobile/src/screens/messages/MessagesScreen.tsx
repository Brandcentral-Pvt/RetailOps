/**
 * Messages list — conversations with unread badges; FAB starts a new chat.
 */
import React, { useCallback, useEffect } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  Avatar,
  Badge,
  Button,
  FAB,
  Text,
  useTheme,
} from 'react-native-paper';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useChatStore } from '../../store/chatStore';
import { useAuthStore } from '../../store/authStore';
import { timeAgo } from '../../utils/time';
import type { ChatConversation } from '../../types';
import type { MessagesStackParamList } from '../../types';

type Props = NativeStackScreenProps<MessagesStackParamList, 'MessagesList'>;

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

function conversationTitle(conv: ChatConversation, myId: string): string {
  if (conv.type === 'GROUP') return conv.title || 'Group chat';
  const other = conv.participants.find((p) => p._id !== myId);
  return other?.name || 'Chat';
}

function previewText(conv: ChatConversation, myId: string): string {
  const last = conv.lastMessage;
  if (!last) return 'No messages yet';
  const sender = last.senderId === myId ? 'You: ' : '';
  if (last.type === 'IMAGE') return `${sender}Photo`;
  if (last.type === 'FILE') return `${sender}Attachment`;
  return `${sender}${last.content || ''}`;
}

export default function MessagesScreen({ navigation }: Props) {
  const { colors } = useTheme();

  const myId = useAuthStore((s) => s.user?.id ?? s.user?._id ?? '');
  const conversations = useChatStore((s) => s.conversations);
  const loadingConversations = useChatStore((s) => s.loadingConversations);
  const refresh = useChatStore((s) => s.refresh);
  const refreshUnread = useChatStore((s) => s.refreshUnread);

  useEffect(() => {
    refresh();
    refreshUnread();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
      refreshUnread();
    }, [refresh, refreshUnread]),
  );

  const renderItem = ({ item }: { item: ChatConversation }) => {
    const title = conversationTitle(item, myId);
    const preview = previewText(item, myId);
    const when = timeAgo(item.lastMessage?.createdAt ?? item.updatedAt);

    return (
      <TouchableOpacity
        onPress={() => navigation.navigate('Chat', { conversationId: item.id, title })}
        activeOpacity={0.7}
      >
        <View
          style={[
            styles.row,
            { borderBottomColor: colors.outlineVariant },
          ]}
        >
          {item.type === 'GROUP' ? (
            <Avatar.Icon
              size={46}
              icon="account-group"
              style={[styles.avatar, { backgroundColor: colors.primaryContainer }]}
              color={colors.primary}
            />
          ) : (
            <Avatar.Text
              size={46}
              label={initials(title)}
              style={[styles.avatar, { backgroundColor: colors.primaryContainer }]}
              color={colors.primary}
            />
          )}

          <View style={styles.rowBody}>
            <View style={styles.rowTop}>
              <Text
                variant="titleSmall"
                style={[styles.rowTitle, { color: colors.onSurface }]}
                numberOfLines={1}
              >
                {title}
              </Text>
              <Text
                variant="labelSmall"
                style={{ color: colors.onSurfaceVariant }}
              >
                {when}
              </Text>
            </View>

            <View style={styles.rowBottom}>
              <Text
                variant="bodySmall"
                style={[styles.rowPreview, { color: colors.onSurfaceVariant }]}
                numberOfLines={1}
              >
                {preview}
              </Text>
              {item.unreadCount > 0 ? (
                <Badge
                  size={20}
                  style={{ backgroundColor: colors.primary }}
                >
                  {item.unreadCount}
                </Badge>
              ) : null}
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <FlatList
        data={conversations}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={loadingConversations}
            onRefresh={refresh}
            tintColor={colors.primary}
          />
        }
        ListEmptyComponent={
          loadingConversations ? (
            <View style={styles.stateContainer}>
              <ActivityIndicator size={26} color={colors.primary} />
            </View>
          ) : (
            <View style={styles.stateContainer}>
              <Text
                variant="bodyMedium"
                style={{
                  color: colors.onSurfaceVariant,
                  textAlign: 'center',
                }}
              >
                No conversations yet.
              </Text>
              <Button
                mode="contained"
                compact
                style={{ marginTop: 12 }}
                onPress={() => navigation.navigate('NewChat')}
              >
                Start a chat
              </Button>
            </View>
          )
        }
      />

      <FAB
        icon="plus"
        style={[styles.fab, { backgroundColor: colors.primary }]}
        color="#FFFFFF"
        onPress={() => navigation.navigate('NewChat')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },

  listContent: {
    flexGrow: 1,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    backgroundColor: '#FFFFFF',
  },

  avatar: {
    marginRight: 12,
  },

  rowBody: {
    flex: 1,
    minWidth: 0,
  },

  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },

  rowTitle: {
    flex: 1,
    marginRight: 8,
  },

  rowBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },

  rowPreview: {
    flex: 1,
    marginRight: 10,
  },

  fab: {
    position: 'absolute',
    margin: 20,
    right: 0,
    bottom: 0,
  },

  stateContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 56,
    paddingHorizontal: 32,
  },
});