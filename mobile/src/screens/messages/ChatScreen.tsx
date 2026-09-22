/**
 * Chat screen — the conversation detail: bubbles, typing indicator,
 * read receipts, image attachments and older-message pagination.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { IconButton, Text, useTheme } from 'react-native-paper';
import * as ImagePicker from 'expo-image-picker';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useChatStore } from '../../store/chatStore';
import { useAuthStore } from '../../store/authStore';
import { chatApiService } from '../../services/chatApiService';
import { timeAgo } from '../../utils/time';
import type { ChatMessage, ChatParticipant } from '../../types';
import type { MessagesStackParamList } from '../../types';

type Props = NativeStackScreenProps<MessagesStackParamList, 'Chat'>;

function sameDay(a: string, b: string): boolean {
  const da = new Date(a);
  const db = new Date(b);
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  );
}

function dayLabel(value: string): string {
  const date = new Date(value);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (sameDay(value, today.toISOString())) return 'Today';
  if (sameDay(value, yesterday.toISOString())) return 'Yesterday';
  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

function clockLabel(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function readStatus(
  message: ChatMessage,
  participants: ChatParticipant[],
  myId: string,
): { seen: boolean; seenCount: number; total: number } {
  const others = participants.filter((p) => p._id !== myId);
  if (others.length === 0) return { seen: false, seenCount: 0, total: 0 };
  const msgTime = new Date(message.createdAt).getTime();
  const read = others.filter(
    (p) => p.lastReadAt && msgTime <= new Date(p.lastReadAt).getTime(),
  );
  return {
    seen: read.length === others.length,
    seenCount: read.length,
    total: others.length,
  };
}

const TYPING_EMIT_THROTTLE = 1200;

export default function ChatScreen({ navigation, route }: Props) {
  const { colors } = useTheme();
  const { conversationId, title } = route.params;

  const myId = useAuthStore((s) => s.user?.id ?? s.user?._id ?? '');
  const messages = useChatStore((s) => s.messagesByConversation[conversationId] ?? []);
  const participants = useChatStore((s) => s.participantsByConversation[conversationId] ?? []);
  const hasMore = useChatStore((s) => s.hasMoreByConversation[conversationId] ?? false);
  const loadingOlder = useChatStore((s) => s.loadingOlder[conversationId] ?? false);
  const typers = useChatStore((s) => s.typingByConversation[conversationId] ?? []);

  const openConversation = useChatStore((s) => s.openConversation);
  const closeConversation = useChatStore((s) => s.closeConversation);
  const loadOlder = useChatStore((s) => s.loadOlder);
  const sendText = useChatStore((s) => s.sendText);
  const sendImage = useChatStore((s) => s.sendImage);
  const emitTyping = useChatStore((s) => s.emitTyping);

  const [draft, setDraft] = useState('');
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const lastIdRef = useRef<string | null>(null);
  const lastEmitRef = useRef(0);

  const otherTypers = typers.filter((t) => t !== myId);

  useEffect(() => {
    openConversation(conversationId);
    return () => closeConversation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  // Dynamic header title (group title or the peer's name).
  useEffect(() => {
    if (title) {
      navigation.setOptions({ title });
      return;
    }
    navigation.setOptions({ title: 'Chat' });
  }, [title, navigation]);

  // Auto-scroll to the newest message when the last item changes.
  const lastItemId = messages[messages.length - 1]?._id;
  useEffect(() => {
    if (lastItemId && lastItemId !== lastIdRef.current) {
      lastIdRef.current = lastItemId;
      setTimeout(() => listRef.current?.scrollToEnd({ animated: false }), 60);
    }
  }, [lastItemId, messages.length]);

  const handleSend = () => {
    const text = draft.trim();
    if (!text) return;
    sendText(conversationId, text, myId);
    setDraft('');
  };

  const handleResend = (message: ChatMessage) => {
    if (message.type !== 'TEXT') return;
    // Replace the failed bubble optimistically and resend.
    sendText(conversationId, message.content, myId);
    useChatStore.setState((state) => ({
      messagesByConversation: {
        ...state.messagesByConversation,
        [conversationId]: (state.messagesByConversation[conversationId] ?? []).filter(
          (m) => m._id !== message._id,
        ),
      },
    }));
  };

  const handleAttach = async () => {
    try {
      const permitted = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permitted.granted) return;

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.7,
      });
      if (result.canceled || !result.assets.length) return;
      const asset = result.assets[0];
      await sendImage(
        conversationId,
        asset.uri,
        asset.fileName ?? null,
        asset.mimeType ?? null,
        myId,
      );
    } catch {
      // Upload failures are surfaced on the bubble; leave composer usable.
    }
  };

  const handleChangeText = (text: string) => {
    setDraft(text);
    const now = Date.now();
    if (text.trim() && now - lastEmitRef.current > TYPING_EMIT_THROTTLE) {
      lastEmitRef.current = now;
      emitTyping(conversationId);
    }
  };

  const renderDayDivider = (
    <View style={styles.dayDivider}>
      <Text variant="labelSmall" style={{ color: colors.onSurfaceVariant }}>
        {messages.length ? dayLabel(messages[messages.length - 1].createdAt) : ''}
      </Text>
    </View>
  );

  const renderBubble = ({ item, index }: { item: ChatMessage; index: number }) => {
    const mine = item.senderId === myId;
    const isGroup = participants.length > 2;
    const sender = participants.find((p) => p._id === item.senderId);

    const prev = messages[index - 1];
    const showDay = !prev || !sameDay(prev.createdAt, item.createdAt);
    const showName = !mine && isGroup;
    const status = mine ? readStatus(item, participants, myId) : null;

    const imgSrc = item.pending || item.failed
      ? item.attachmentUrl
      : chatApiService.assetUrl(item.attachmentUrl);

    return (
      <React.Fragment key={item._id}>
        {showDay ? (
          <View style={styles.dayDivider}>
            <Text variant="labelSmall" style={{ color: colors.onSurfaceVariant }}>
              {dayLabel(item.createdAt)}
            </Text>
          </View>
        ) : null}

        <View style={[styles.msgRow, mine ? styles.msgRowMine : styles.msgRowTheirs]}>
          <View
            style={[
              styles.bubble,
              mine
                ? [styles.bubbleMine, { backgroundColor: colors.primary }]
                : [
                    styles.bubbleTheirs,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.outlineVariant,
                    },
                  ],
              item.pending && styles.bubblePending,
              item.failed && { borderWidth: 1, borderColor: colors.error },
            ]}
          >
            {showName && sender ? (
              <Text
                variant="labelSmall"
                style={[styles.senderName, { color: colors.primary }]}
              >
                {sender.name}
              </Text>
            ) : null}

            {item.type === 'IMAGE' && imgSrc ? (
              <Image
                source={{ uri: imgSrc }}
                style={[
                  styles.image,
                  { backgroundColor: colors.outlineVariant },
                ]}
                resizeMode="cover"
              />
            ) : null}

            {item.content ? (
              <Text
                style={[
                  styles.bubbleText,
                  { color: mine ? '#FFFFFF' : colors.onSurface },
                ]}
              >
                {item.content}
              </Text>
            ) : null}

            <View
              style={[
                styles.metaRow,
                mine ? styles.metaRowMine : styles.metaRowTheirs,
              ]}
            >
              <Text
                variant="labelSmall"
                style={{ color: mine ? 'rgba(255,255,255,0.8)' : colors.onSurfaceVariant }}
              >
                {clockLabel(item.createdAt)}
              </Text>

              {mine ? (
                item.pending ? (
                  <ActivityIndicator
                    size={10}
                    color="rgba(255,255,255,0.8)"
                    style={{ marginLeft: 6 }}
                  />
                ) : item.failed ? (
                  <TouchableOpacity
                    onPress={() => handleResend(item)}
                    style={{ marginLeft: 6 }}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Text style={{ color: colors.error, fontSize: 12, fontWeight: '700' }}>
                      Failed · Tap to retry
                    </Text>
                  </TouchableOpacity>
                ) : status && status.total > 0 ? (
                  <Text
                    variant="labelSmall"
                    style={{ color: 'rgba(255,255,255,0.8)', marginLeft: 6 }}
                  >
                    {status.seen ? 'Seen' : status.seenCount > 0 ? `Seen by ${status.seenCount}` : 'Delivered'}
                  </Text>
                ) : null
              ) : null}
            </View>
          </View>
        </View>
      </React.Fragment>
    );
  };

  const typingText = useMemo(() => {
    if (otherTypers.length === 0) return null;
    const names = otherTypers
      .map((id) => participants.find((p) => p._id === id)?.name)
      .filter(Boolean);
    if (names.length === 0) return `${otherTypers.length} typing`;
    return `${names.join(', ')} ${names.length === 1 ? 'is' : 'are'} typing…`;
  }, [otherTypers, participants]);

  return (
    <KeyboardAvoidingView
      style={[styles.screen, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(item) => item._id}
        renderItem={renderBubble}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        onScrollBeginDrag={() => {
          if (hasMore && !loadingOlder) {
            loadOlder(conversationId);
          }
        }}
        ListHeaderComponent={
          <View style={styles.listHeader}>
            {hasMore ? <ActivityIndicator size="small" color={colors.primary} /> : null}
          </View>
        }
        ListFooterComponent={messages.length ? renderDayDivider : null}
        keyboardShouldPersistTaps="handled"
      />

      {typingText ? (
        <View style={[styles.typingRow, { backgroundColor: colors.background }]}>
          <Text
            variant="labelSmall"
            style={{ color: colors.onSurfaceVariant, fontStyle: 'italic' }}
          >
            {typingText}
          </Text>
        </View>
      ) : null}

      <View
        style={[
          styles.composer,
          {
            backgroundColor: colors.surface,
            borderTopColor: colors.outlineVariant,
          },
        ]}
      >
        <IconButton
          icon="image-outline"
          size={24}
          iconColor={colors.primary}
          onPress={handleAttach}
        />
        <TextInput
          value={draft}
          onChangeText={handleChangeText}
          placeholder="Message"
          placeholderTextColor={colors.onSurfaceVariant}
          multiline
          style={[
            styles.input,
            {
              color: colors.onSurface,
              backgroundColor: colors.background,
              borderColor: colors.outlineVariant,
            },
          ]}
        />
        <IconButton
          icon="send"
          size={22}
          iconColor="#FFFFFF"
          containerColor={colors.primary}
          disabled={!draft.trim()}
          mode="contained"
          style={styles.sendButton}
          onPress={handleSend}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },

  listContent: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    flexGrow: 1,
  },

  listHeader: {
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },

  dayDivider: {
    alignItems: 'center',
    marginVertical: 10,
  },

  msgRow: {
    marginVertical: 3,
    flexDirection: 'row',
  },

  msgRowMine: {
    justifyContent: 'flex-end',
  },

  msgRowTheirs: {
    justifyContent: 'flex-start',
  },

  bubble: {
    maxWidth: '78%',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },

  bubbleMine: {
    borderBottomRightRadius: 4,
  },

  bubbleTheirs: {
    borderBottomLeftRadius: 4,
    borderWidth: StyleSheet.hairlineWidth,
  },

  bubblePending: {
    opacity: 0.7,
  },

  senderName: {
    marginBottom: 2,
    fontWeight: '700',
  },

  image: {
    width: 220,
    height: 180,
    borderRadius: 10,
    marginBottom: 6,
    marginTop: 2,
  },

  bubbleText: {
    fontSize: 15,
    lineHeight: 20,
  },

  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
  },

  metaRowMine: {
    justifyContent: 'flex-end',
  },

  metaRowTheirs: {
    justifyContent: 'flex-start',
  },

  typingRow: {
    paddingHorizontal: 16,
    paddingBottom: 2,
  },

  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 6,
    paddingVertical: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
  },

  input: {
    flex: 1,
    maxHeight: 110,
    minHeight: 42,
    borderRadius: 21,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 10,
    fontSize: 15,
    marginHorizontal: 4,
  },

  sendButton: {
    borderRadius: 22,
    margin: 0,
  },
});