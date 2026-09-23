import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
  Modal,
  Alert,
  Pressable,
  Dimensions,
} from 'react-native';
import { IconButton, Text, useTheme, type MD3Theme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as Clipboard from 'expo-clipboard';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withSequence,
  withTiming,
  withDelay,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useShallow } from 'zustand/react/shallow';
import { useHeaderHeight } from '@react-navigation/elements';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useChatStore } from '../../store/chatStore';
import { useAuthStore } from '../../store/authStore';
import { useCallStore } from '../../store/callStore';
import { chatApiService } from '../../services/chatApiService';
import { useCall } from '../../hooks/useCall';
import { initials } from '../../utils/avatar';
import type {
  CallSession,
  CallType,
  ChatMessage,
  ChatParticipant,
  MessagesStackParamList,
} from '../../types';

type Props = NativeStackScreenProps<MessagesStackParamList, 'Chat'>;

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const REPLY_THRESHOLD = 70;
const MAX_SWIPE = 90;
const REACTIONS = ['❤️', '😂', '😮', '😢', '🙏', '👍'];

// ─── Utilities ─────────────────────────────────────────────────────────────

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function dayLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (sameDay(date, today)) return 'Today';
  if (sameDay(date, yesterday)) return 'Yesterday';
  return date.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' });
}

function clockLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

const handleDownload = async (url: string, fileName: string = 'attachment') => {
  try {
    if (!url) return Alert.alert('Download Failed', 'Invalid file URL.');
    const safeName = fileName.replace(/[^\w.\-()+ ]+/g, '_') || 'attachment';
    const base = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
    if (!base) return Alert.alert('Download Failed', 'Storage is not available on this device.');
    
    const tempUri = `${base}dl-${Date.now()}-${safeName}`;
    const { uri } = await FileSystem.downloadAsync(url, tempUri);

    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      await Sharing.shareAsync(uri, { dialogTitle: `Save or share ${safeName}` });
    } else {
      Alert.alert('Downloaded', `File saved to app storage.`);
    }
  } catch (e) {
    Alert.alert('Download Failed', 'Could not save the file.');
  }
};

// ─── Avatar Component ──────────────────────────────────────────────────────

const Avatar = memo(function Avatar({ participant, theme, size = 28 }: { participant?: ChatParticipant; theme: MD3Theme; size?: number }) {
  const { colors } = theme;
  return (
    <View style={[styles.avatarWrapper, { width: size, height: size, borderRadius: size / 2 }]}>
      {participant?.avatar ? (
        <Image source={{ uri: chatApiService.assetUrl(participant.avatar) }} style={styles.avatarImage} />
      ) : (
        <View style={[styles.avatarPlaceholder, { backgroundColor: colors.primaryContainer }]}>
          <Text style={{ color: colors.primary, fontWeight: '700', fontSize: size * 0.4 }}>
            {participant ? initials(participant.name) : '?'}
          </Text>
        </View>
      )}
    </View>
  );
});

// ─── Bubble Component ──────────────────────────────────────────────────────

interface BubbleProps {
  item: ChatMessage;
  prev: ChatMessage | undefined;
  mine: boolean;
  isGroup: boolean;
  sender: ChatParticipant | undefined;
  repliedMessage: any;
  repliedSenderName: string | undefined;
  isHighlighted: boolean;
  theme: MD3Theme;
  onReply: (msg: ChatMessage) => void;
  onResend: (msg: ChatMessage) => void;
  onPressReplyPreview: (messageId: string) => void;
  onViewImage: (url: string) => void;
  onMessageAction: (msg: ChatMessage, layout: { x: number; y: number; width: number; height: number }) => void;
}

const Bubble = memo(function Bubble({
  item,
  prev,
  mine,
  isGroup,
  sender,
  repliedMessage,
  repliedSenderName,
  isHighlighted,
  theme,
  onReply,
  onResend,
  onPressReplyPreview,
  onViewImage,
  onMessageAction,
}: BubbleProps) {
  const { colors } = theme;
  const translateX = useSharedValue(0);
  const highlightOpacity = useSharedValue(0);
  const bubbleRef = useRef<View>(null);

  const showDay = !prev || !sameDay(new Date(prev.createdAt), new Date(item.createdAt));
  const showTail = !prev || prev.senderId !== item.senderId || showDay;

  useEffect(() => {
    if (isHighlighted) {
      highlightOpacity.value = withSequence(
        withTiming(1, { duration: 250 }),
        withDelay(1000, withTiming(0, { duration: 500 }))
      );
    }
  }, [isHighlighted]);

  const imgSrc = item.attachmentUrl ? (item.pending || item.failed ? item.attachmentUrl : chatApiService.assetUrl(item.attachmentUrl)) : null;
  const isFile = item.type === 'FILE' || (imgSrc && !imgSrc.match(/\.(jpeg|jpg|gif|png|webp)$/i));

  const panGesture = useMemo(
    () => Gesture.Pan()
      .activeOffsetX([-15, 15])
      .failOffsetY([-10, 10])
      .onUpdate((e) => {
        'worklet';
        translateX.value = mine ? Math.max(Math.min(e.translationX, 0), -MAX_SWIPE) : Math.min(Math.max(e.translationX, 0), MAX_SWIPE);
      })
      .onEnd(() => {
        'worklet';
        if (Math.abs(translateX.value) >= REPLY_THRESHOLD) runOnJS(onReply)(item);
        translateX.value = withSpring(0, { damping: 20, stiffness: 200 });
      }),
    [mine, translateX, onReply, item]
  );

  const handleLongPress = () => {
    // Measure exact screen coordinates of the bubble
    bubbleRef.current?.measure((x, y, width, height, pageX, pageY) => {
      onMessageAction(item, { x: pageX, y: pageY, width, height });
    });
  };

  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ translateX: translateX.value }] }));
  const replyIconStyle = useAnimatedStyle(() => ({
    opacity: Math.min(Math.abs(translateX.value) / REPLY_THRESHOLD, 1),
    transform: [{ scale: 0.5 + Math.min(Math.abs(translateX.value) / REPLY_THRESHOLD, 1) * 0.5 }],
  }));
  const highlightStyle = useAnimatedStyle(() => ({ opacity: highlightOpacity.value }));

  const bubbleColor = mine ? colors.primary : '#FFFFFF';
  const textColor = mine ? '#FFFFFF' : '#1C1C1E';
  const metaColor = mine ? 'rgba(255,255,255,0.7)' : '#8E8E93';

  return (
    <>
      {showDay && <View style={styles.dayDivider}><View style={styles.dayPill}><Text style={styles.dayPillText}>{dayLabel(item.createdAt)}</Text></View></View>}

      <View style={styles.gestureContainer}>
        <Animated.View style={[styles.highlightOverlay, highlightStyle, { backgroundColor: colors.primaryContainer }]} pointerEvents="none" />

        <Animated.View pointerEvents="none" style={[styles.replyIndicator, mine ? styles.replyIndicatorRight : styles.replyIndicatorLeft, replyIconStyle]}>
          <View style={styles.replyIndicatorCircle}><MaterialCommunityIcons name="reply" size={20} color="#FFFFFF" /></View>
        </Animated.View>

        <GestureDetector gesture={panGesture}>
          <Animated.View style={animatedStyle}>
            <View style={[styles.msgRow, mine ? styles.msgRowMine : styles.msgRowTheirs, !showTail && { marginTop: 2 }]}>
              
              {!mine && (
                <View style={styles.avatarColumn}>
                  {showTail ? <Avatar participant={sender} theme={theme} /> : <View style={{ width: 28 }} />}
                </View>
              )}

              <View style={[styles.bubbleWrapper, mine ? styles.bubbleWrapperMine : styles.bubbleWrapperTheirs]}>
                {showTail && <View style={[styles.tail, mine ? styles.tailMine : styles.tailTheirs, { borderBottomColor: bubbleColor }]} />}

                <View ref={bubbleRef} collapsable={false}>
                  <Pressable
                    onLongPress={handleLongPress}
                    delayLongPress={250}
                    style={({ pressed }) => [
                      styles.bubble,
                      { backgroundColor: bubbleColor },
                      mine ? styles.bubbleMine : styles.bubbleTheirs,
                      !showTail && (mine ? styles.bubbleMineNoTail : styles.bubbleTheirsNoTail),
                      item.pending && { opacity: 0.7 },
                      item.failed && { borderWidth: 1, borderColor: colors.error },
                      pressed && { opacity: 0.85 }
                    ]}
                  >
                    
                    {!mine && isGroup && showTail && sender && <Text style={[styles.senderName, { color: colors.primary }]}>{sender.name}</Text>}

                    {(item.replyTo || repliedMessage) && (
                      <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() => item.replyTo && onPressReplyPreview(item.replyTo as string)}
                        style={[
                          styles.inBubbleReply,
                          { borderLeftColor: mine ? 'rgba(255,255,255,0.7)' : colors.primary, backgroundColor: mine ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.05)' },
                        ]}
                      >
                        <Text style={[styles.inBubbleReplyName, { color: mine ? '#FFFFFF' : colors.primary }]} numberOfLines={1}>{repliedSenderName ?? 'Message'}</Text>
                        <Text style={[styles.inBubbleReplyText, { color: mine ? 'rgba(255,255,255,0.9)' : '#333333' }]} numberOfLines={2}>
                          {repliedMessage?.type === 'IMAGE' ? '📷 Photo' : repliedMessage?.type === 'FILE' ? '📄 Document' : repliedMessage?.content ?? 'Original message'}
                        </Text>
                      </TouchableOpacity>
                    )}

                    {imgSrc && !isFile && (
                      <TouchableOpacity activeOpacity={0.9} onPress={() => onViewImage(imgSrc)}>
                        <Image source={{ uri: imgSrc }} style={styles.imageAttachment} resizeMode="cover" />
                      </TouchableOpacity>
                    )}

                    {isFile && imgSrc && (
                      <TouchableOpacity 
                        style={[styles.fileAttachment, { backgroundColor: mine ? 'rgba(255,255,255,0.15)' : '#F2F2F7' }]}
                        onPress={() => handleDownload(imgSrc, item.attachmentName || 'document')}
                      >
                        <View style={[styles.fileIconBox, { backgroundColor: mine ? 'rgba(255,255,255,0.2)' : colors.primaryContainer }]}><MaterialCommunityIcons name="file-document-outline" size={24} color={mine ? '#FFF' : colors.primary} /></View>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.fileName, { color: textColor }]} numberOfLines={1}>{item.attachmentName || 'Document'}</Text>
                          <Text style={[styles.fileSize, { color: metaColor }]}>Tap to download</Text>
                        </View>
                      </TouchableOpacity>
                    )}

                    {item.content ? <Text style={[styles.bubbleText, { color: textColor }]}>{item.content}</Text> : null}

                    <View style={styles.metaRow}>
                      <Text style={[styles.timeText, { color: metaColor }]}>{clockLabel(item.createdAt)}</Text>
                      {mine && (
                        item.pending ? <ActivityIndicator size={10} color="rgba(255,255,255,0.7)" style={{ marginLeft: 4 }} />
                        : item.failed ? <TouchableOpacity onPress={() => onResend(item)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}><MaterialCommunityIcons name="alert-circle" size={12} color="#FF3B30" style={{ marginLeft: 4 }} /></TouchableOpacity>
                        : <MaterialCommunityIcons name="check-all" size={14} color="#4ADE80" style={{ marginLeft: 4, marginTop: 1 }} />
                      )}
                    </View>
                  </Pressable>
                </View>
              </View>
            </View>
          </Animated.View>
        </GestureDetector>
      </View>
    </>
  );
});

// ─── Call Log Row Component ────────────────────────────────────────────────

type ChatItem =
  | { kind: 'message'; msg: ChatMessage }
  | { kind: 'call'; call: CallSession };

const CallRow = memo(function CallRow({
  call,
  mine,
  showDay,
  theme,
}: {
  call: CallSession;
  mine: boolean;
  showDay: boolean;
  theme: MD3Theme;
}) {
  const { colors } = theme;
  const isMissed = call.endReason === 'missed' || call.endReason === 'rejected';
  const icon = mine ? 'phone-outgoing' : isMissed ? 'phone-missed' : 'phone-incoming';
  const color = isMissed ? colors.error : colors.primary;

  const duration =
    call.duration != null
      ? `${Math.floor(call.duration / 60)}:${(call.duration % 60).toString().padStart(2, '0')}`
      : null;

  const label = isMissed
    ? mine
      ? 'Call not answered'
      : 'Missed call'
    : call.type === 'video'
      ? 'Video call'
      : 'Voice call';

  return (
    <>
      {showDay && (
        <View style={styles.dayDivider}>
          <View style={styles.dayPill}><Text style={styles.dayPillText}>{dayLabel(call.startedAt)}</Text></View>
        </View>
      )}

      <View style={styles.callRow}>
        <View style={[styles.callRowInner, { backgroundColor: colors.surfaceVariant }]}>
          <MaterialCommunityIcons name={icon} size={16} color={color} />
          <Text style={[styles.callRowText, { color }]}>
            {label}
            {duration !== null ? ` · ${duration}` : ''} · {clockLabel(call.startedAt)}
          </Text>
        </View>
      </View>
    </>
  );
});

// ─── Main Screen ───────────────────────────────────────────────────────────

export default function ChatScreen({ navigation, route }: Props) {
  const theme = useTheme();
  const { colors } = theme;
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();

  const [draft, setDraft] = useState('');
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [editingMsg, setEditingMsg] = useState<ChatMessage | null>(null);
  const [isKeyboardVisible, setKeyboardVisible] = useState(false);
  const [attachMenuOpen, setAttachMenuOpen] = useState(false);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [viewingImage, setViewingImage] = useState<string | null>(null);
  
  // Custom Action Menu State
  const [actionData, setActionData] = useState<{ msg: ChatMessage; layout: { x: number; y: number; width: number; height: number } } | null>(null);

  const listRef = useRef<FlatList<ChatItem>>(null);

  const { conversationId, title } = route.params;
  const myId = useAuthStore((s) => s.user?.id ?? s.user?._id ?? '');
  
  const messages = useChatStore(useShallow((s) => s.messagesByConversation[conversationId] ?? []));
  const participants = useChatStore(useShallow((s) => s.participantsByConversation[conversationId] ?? []));
  const typers = useChatStore(useShallow((s) => s.typingByConversation[conversationId] ?? []));
  const callHistory = useCallStore((s) => s.callHistory);
  
  const isGroup = participants.length > 2;
  const otherParticipant = participants.find(p => p._id !== myId);
  const otherTypers = useMemo(() => typers.filter((id) => id !== myId), [typers, myId]);

  const { initiateCall } = useCall();

  const startCall = useCallback(
    (callType: CallType) => {
      if (!otherParticipant) return;
      initiateCall({
        callType,
        callee: {
          _id: otherParticipant._id,
          name: otherParticipant.name,
          avatar: otherParticipant.avatar,
        },
        conversationId,
      });
    },
    [initiateCall, otherParticipant, conversationId]
  );

  const messageMap = useMemo(() => new Map(messages.map(m => [m._id, m])), [messages]);
  const participantMap = useMemo(() => new Map(participants.map(p => [p._id, p])), [participants]);

  // Calls belonging to this conversation: match by conversationId when the
  // call flow carried it, otherwise by the non-self participant's id.
  const chatCallIds = useMemo(() => {
    const ids = new Set(participants.map((p) => p._id));
    ids.delete(myId);
    return ids;
  }, [participants, myId]);

  const chatCalls = useMemo(
    () =>
      callHistory
        .filter((call) => {
          if (call.conversationId && call.conversationId === conversationId) return true;
          return chatCallIds.has(call.caller._id) || chatCallIds.has(call.callee._id);
        })
        .sort((a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime()),
    [callHistory, chatCallIds, conversationId],
  );

  const displayItems = useMemo<ChatItem[]>(() => {
    const items: ChatItem[] = messages.map((msg) => ({ kind: 'message', msg }));

    for (const call of chatCalls) {
      const t = new Date(call.startedAt).getTime();
      const index = items.findIndex((item) => {
        const ts = item.kind === 'message'
          ? new Date(item.msg.createdAt).getTime()
          : new Date(item.call.startedAt).getTime();
        return ts > t;
      });

      if (index === -1) {
        items.push({ kind: 'call', call });
      } else {
        items.splice(index, 0, { kind: 'call', call });
      }
    }

    return items;
  }, [messages, chatCalls]);

  useEffect(() => {
    useChatStore.getState().openConversation(conversationId);
    return () => useChatStore.getState().closeConversation();
  }, [conversationId]);

  const typingText = useMemo(() => {
    if (otherTypers.length === 0) return null;
    if (!isGroup) return 'typing...';
    const names = otherTypers.map((id) => participantMap.get(id)?.name).filter(Boolean) as string[];
    return `${names.join(', ')} typing...`;
  }, [otherTypers, participantMap, isGroup]);

  useEffect(() => {
    const titleText = title ?? (isGroup ? 'Group' : otherParticipant?.name ?? 'Chat');
    navigation.setOptions({
      headerTitleAlign: 'left',
      headerTitle: () => (
        <TouchableOpacity activeOpacity={0.7} style={styles.headerTitleContainer} onPress={() => Alert.alert('Profile', `View ${titleText}'s profile`)}>
          <Avatar participant={isGroup ? undefined : otherParticipant} theme={theme} size={36} />
          <View style={styles.headerTextContainer}>
            <Text style={styles.headerTitleText} numberOfLines={1}>{titleText}</Text>
            {typingText ? (
              <Text style={[styles.headerSubtitleText, { color: colors.primary }]} numberOfLines={1}>{typingText}</Text>
            ) : (
              <Text style={styles.headerSubtitleText} numberOfLines={1}>{isGroup ? 'Tap here for group info' : 'Tap here for contact info'}</Text>
            )}
          </View>
        </TouchableOpacity>
      ),
      ...(isGroup
        ? {}
        : {
            headerRight: () => (
              <View style={styles.headerActions}>
                <IconButton
                  icon="phone"
                  size={22}
                  iconColor={colors.primary}
                  accessibilityLabel="Call"
                  onPress={() => startCall('audio')}
                  style={styles.headerActionBtn}
                  hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                />
                <IconButton
                  icon="video"
                  size={22}
                  iconColor={colors.primary}
                  accessibilityLabel="Video call"
                  onPress={() => startCall('video')}
                  style={styles.headerActionBtn}
                  hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                />
              </View>
            ),
          }),
    });
  }, [navigation, title, isGroup, otherParticipant, typingText, theme, colors, startCall]);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    
    const s = Keyboard.addListener(showEvent, () => {
      setKeyboardVisible(true);
      setAttachMenuOpen(false);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    });
    const h = Keyboard.addListener(hideEvent, () => setKeyboardVisible(false));
    return () => { s.remove(); h.remove(); };
  }, []);

  const handleScrollToMessage = useCallback((targetId: string) => {
    const index = messages.findIndex(m => m._id === targetId);
    if (index !== -1) {
      listRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.5 });
      setHighlightId(targetId);
      setTimeout(() => setHighlightId(null), 2000);
    }
  }, [messages]);

  const handleSend = () => {
    if (!draft.trim()) return;
    
    if (editingMsg) {
      useChatStore.getState().editMessage(conversationId, editingMsg._id, draft);
      setEditingMsg(null);
    } else {
      useChatStore.getState().sendText(conversationId, draft, myId, replyingTo?._id);
      setReplyingTo(null);
    }
    setDraft('');
  };

  // ── Action Menu Handlers ──
  const onReact = (emoji: string) => {
    // Call store reaction logic here
    console.log(`Reacted ${emoji} to ${actionData?.msg._id}`);
    setActionData(null);
  };

  const onCopy = async () => {
    if (actionData?.msg.content) await Clipboard.setStringAsync(actionData.msg.content);
    setActionData(null);
  };

  const onReplyFromMenu = () => {
    setReplyingTo(actionData?.msg ?? null);
    setEditingMsg(null);
    setActionData(null);
  };

  const onEditFromMenu = () => {
    if (actionData?.msg.content) setDraft(actionData.msg.content);
    setEditingMsg(actionData?.msg ?? null);
    setReplyingTo(null);
    setActionData(null);
  };

  const onDownloadFromMenu = () => {
    if (actionData?.msg.attachmentUrl) {
      handleDownload(chatApiService.assetUrl(actionData.msg.attachmentUrl), actionData.msg.attachmentName || 'download');
    }
    setActionData(null);
  };

  const onDeleteFromMenu = () => {
    if (actionData?.msg) {
      useChatStore.getState().deleteMessage(conversationId, actionData.msg._id);
    }
    setActionData(null);
  };

  // ── Calculate Anchored Menu Position ──
  const getMenuPosition = () => {
    if (!actionData) return {};
    const { x, y, width, height } = actionData.layout;
    const isMine = actionData.msg.senderId === myId;
    const menuHeight = 260; // Approx height of the menu
    const spacing = 8;

    let topPos = y + height + spacing;
    let bottomPos = undefined;

    // If message is too low on screen, open the menu ABOVE the message
    if (topPos + menuHeight > SCREEN_HEIGHT) {
      topPos = undefined as any;
      bottomPos = SCREEN_HEIGHT - y + spacing;
    }

    return {
      top: topPos,
      bottom: bottomPos,
      left: isMine ? undefined : x,
      right: isMine ? SCREEN_WIDTH - (x + width) : undefined,
    };
  };

  const renderItem = useCallback(({ item, index }: { item: ChatItem; index: number }) => {
    const prevItem = displayItems[index - 1];

    if (item.kind === 'call') {
      const prevDate = prevItem
        ? prevItem.kind === 'message'
          ? new Date(prevItem.msg.createdAt)
          : new Date(prevItem.call.startedAt)
        : undefined;
      const showDay = !prevDate || !sameDay(prevDate, new Date(item.call.startedAt));

      return (
        <CallRow
          call={item.call}
          mine={item.call.direction === 'outgoing'}
          showDay={showDay}
          theme={theme}
        />
      );
    }

    const msg = item.msg;
    const prev = prevItem?.kind === 'message' ? prevItem.msg : undefined;
    let replyId = typeof msg.replyTo === 'string' ? msg.replyTo : (msg.replyTo as any)?._id;
    const finalReplyMsg = (replyId ? messageMap.get(replyId) : msg.replyTo) as ChatMessage;

    return (
      <Bubble
        item={msg}
        prev={prev}
        mine={msg.senderId === myId}
        isGroup={isGroup}
        sender={participantMap.get(msg.senderId)}
        repliedMessage={finalReplyMsg}
        repliedSenderName={finalReplyMsg?.senderId === myId ? 'You' : participantMap.get(finalReplyMsg?.senderId)?.name}
        isHighlighted={highlightId === msg._id}
        theme={theme}
        onReply={setReplyingTo}
        onResend={() => {}}
        onPressReplyPreview={handleScrollToMessage}
        onViewImage={setViewingImage}
        onMessageAction={(m, layout) => setActionData({ msg: m, layout })} // Trigger Anchored Menu
      />
    );
  }, [displayItems, messageMap, participantMap, myId, isGroup, highlightId, theme, handleScrollToMessage]);

  const composerBottomPad = Platform.OS === 'ios' ? (isKeyboardVisible ? 10 : Math.max(insets.bottom, 10)) : 10;
  const isEditing = !!editingMsg;
  const composerPreviewMsg = editingMsg || replyingTo;

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={headerHeight} style={{ flex: 1 }}>
      <View style={[styles.screen, { backgroundColor: '#EFEFF4' }]}>
        
        <FlatList
          ref={listRef}
          data={displayItems}
          keyExtractor={(item) => (item.kind === 'call' ? `call-${item.call.id}` : item.msg._id)}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          keyboardDismissMode="interactive"
          maintainVisibleContentPosition={{ minIndexForVisible: 0, autoscrollToTopThreshold: 10 }}
        />

        {/* ── WhatsApp/Instagram Anchored Overlay Menu ── */}
        <Modal visible={!!actionData} transparent animationType="fade" onRequestClose={() => setActionData(null)}>
          <Pressable style={styles.actionModalOverlay} onPress={() => setActionData(null)}>
            
            {/* The Floating Menu */}
            {actionData && (
              <View style={[styles.anchoredMenu, getMenuPosition()]}>
                
                {/* Reactions Row */}
                <View style={styles.reactionRow}>
                  {REACTIONS.map((emoji) => (
                    <TouchableOpacity key={emoji} onPress={() => onReact(emoji)} style={styles.reactionBtn}>
                      <Text style={styles.reactionEmoji}>{emoji}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Actions List */}
                <View style={styles.actionList}>
                  <TouchableOpacity style={styles.actionItem} onPress={onReplyFromMenu}>
                    <MaterialCommunityIcons name="reply" size={22} color="#1C1C1E" style={styles.actionIcon} />
                    <Text style={styles.actionText}>Reply</Text>
                  </TouchableOpacity>

                  {actionData.msg.content && (
                    <TouchableOpacity style={styles.actionItem} onPress={onCopy}>
                      <MaterialCommunityIcons name="content-copy" size={22} color="#1C1C1E" style={styles.actionIcon} />
                      <Text style={styles.actionText}>Copy</Text>
                    </TouchableOpacity>
                  )}

                  {actionData.msg.senderId === myId && actionData.msg.content && (
                    <TouchableOpacity style={styles.actionItem} onPress={onEditFromMenu}>
                      <MaterialCommunityIcons name="pencil" size={22} color="#1C1C1E" style={styles.actionIcon} />
                      <Text style={styles.actionText}>Edit</Text>
                    </TouchableOpacity>
                  )}

                  {actionData.msg.attachmentUrl && (
                    <TouchableOpacity style={styles.actionItem} onPress={onDownloadFromMenu}>
                      <MaterialCommunityIcons name="download" size={22} color="#1C1C1E" style={styles.actionIcon} />
                      <Text style={styles.actionText}>Save File</Text>
                    </TouchableOpacity>
                  )}

                  {actionData.msg.senderId === myId && (
                    <TouchableOpacity style={[styles.actionItem, { borderBottomWidth: 0 }]} onPress={onDeleteFromMenu}>
                      <MaterialCommunityIcons name="delete-outline" size={22} color="#FF3B30" style={styles.actionIcon} />
                      <Text style={[styles.actionText, { color: '#FF3B30' }]}>Delete</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            )}
          </Pressable>
        </Modal>

        {/* ── Attach Menu ── */}
        {attachMenuOpen && (
          <View style={styles.attachMenu}>
            <TouchableOpacity style={styles.attachOption} onPress={async () => {
              setAttachMenuOpen(false);
              const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images', 'videos'], quality: 0.7 });
              if (!res.canceled) useChatStore.getState().sendImage(conversationId, res.assets[0].uri, res.assets[0].fileName, res.assets[0].mimeType, myId);
            }}>
              <View style={[styles.attachIcon, { backgroundColor: '#007AFF' }]}><MaterialCommunityIcons name="image" size={24} color="#FFF" /></View>
              <Text style={styles.attachText}>Photos & Videos</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.attachOption} onPress={async () => {
              setAttachMenuOpen(false);
              const res = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
              if (!res.canceled) useChatStore.getState().sendImage(conversationId, res.assets[0].uri, res.assets[0].name, res.assets[0].mimeType, myId);
            }}>
              <View style={[styles.attachIcon, { backgroundColor: '#FF9500' }]}><MaterialCommunityIcons name="file-document" size={24} color="#FFF" /></View>
              <Text style={styles.attachText}>Document</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Composer Area ── */}
        <View style={[styles.composerContainer, { paddingBottom: composerBottomPad }]}>
          
          {composerPreviewMsg && (
            <View style={styles.replyBar}>
              <View style={[styles.replyBarBorder, { backgroundColor: colors.primary }]} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.replyBarName, { color: colors.primary }]}>
                  {isEditing ? 'Edit Message' : (composerPreviewMsg.senderId === myId ? 'You' : 'Reply')}
                </Text>
                <Text style={styles.replyBarText} numberOfLines={1}>
                  {composerPreviewMsg.type === 'IMAGE' ? '📷 Photo' : composerPreviewMsg.type === 'FILE' ? '📄 Document' : composerPreviewMsg.content}
                </Text>
              </View>
              <TouchableOpacity onPress={() => { setReplyingTo(null); setEditingMsg(null); setDraft(''); }} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <MaterialCommunityIcons name="close-circle" size={20} color="#8E8E93" />
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.inputRow}>
            <TouchableOpacity onPress={() => { Keyboard.dismiss(); setAttachMenuOpen(!attachMenuOpen); }} style={styles.plusBtn}>
              <MaterialCommunityIcons name={attachMenuOpen ? "close" : "plus"} size={28} color={colors.primary} />
            </TouchableOpacity>
            
            <View style={styles.textInputBox}>
              <TextInput
                value={draft}
                onChangeText={(t) => { setDraft(t); useChatStore.getState().emitTyping(conversationId); }}
                placeholder="Message..."
                placeholderTextColor="#8E8E93"
                multiline
                style={styles.textInput}
              />
              <TouchableOpacity onPress={handleSend} disabled={!draft.trim()} style={[styles.sendBtn, { backgroundColor: draft.trim() ? colors.primary : '#E5E5EA' }]}>
                <MaterialCommunityIcons name={isEditing ? "check" : "send"} size={16} color="#FFF" style={!isEditing && { marginLeft: 2 }} />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* ── Fullscreen Image Viewer Modal ── */}
        <Modal visible={!!viewingImage} transparent={true} animationType="fade" onRequestClose={() => setViewingImage(null)}>
          <View style={styles.fullScreenImageContainer}>
            <TouchableOpacity style={styles.closeImageBtn} onPress={() => setViewingImage(null)}>
              <MaterialCommunityIcons name="close" size={30} color="#FFF" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.downloadImageBtn} onPress={() => viewingImage && handleDownload(viewingImage, 'image.jpg')}>
              <MaterialCommunityIcons name="download" size={28} color="#FFF" />
            </TouchableOpacity>
            {viewingImage && <Image source={{ uri: viewingImage }} style={styles.fullScreenImage} resizeMode="contain" />}
          </View>
        </Modal>

      </View>
    </KeyboardAvoidingView>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1 },
  listContent: { paddingHorizontal: 10, paddingVertical: 16, flexGrow: 1 },
  
  headerTitleContainer: { flexDirection: 'row', alignItems: 'center', marginLeft: Platform.OS === 'ios' ? 0 : -16 },
  headerTextContainer: { marginLeft: 10, justifyContent: 'center' },
  headerTitleText: { fontSize: 16, fontWeight: '600', color: '#1C1C1E', maxWidth: 150 },
  headerSubtitleText: { fontSize: 12, fontWeight: '400', color: '#8E8E93', marginTop: 1 },
  headerActions: { flexDirection: 'row', alignItems: 'center', marginRight: 4 },
  headerActionBtn: { margin: 0 },

  dayDivider: { alignItems: 'center', marginVertical: 16 },
  dayPill: { backgroundColor: 'rgba(0,0,0,0.08)', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
  dayPillText: { fontSize: 11, fontWeight: '600', color: '#666' },

  callRow: { flexDirection: 'row', justifyContent: 'center', marginVertical: 8 },
  callRowInner: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14 },
  callRowText: { fontSize: 13, fontWeight: '500' },

  gestureContainer: { position: 'relative' },
  highlightOverlay: { ...StyleSheet.absoluteFillObject, zIndex: 10, opacity: 0, borderRadius: 18 },
  
  msgRow: { flexDirection: 'row', marginVertical: 6, alignItems: 'flex-end' },
  msgRowMine: { justifyContent: 'flex-end' },
  msgRowTheirs: { justifyContent: 'flex-start' },
  
  avatarColumn: { width: 28, marginRight: 8, justifyContent: 'flex-end' },
  avatarWrapper: { overflow: 'hidden' },
  avatarImage: { width: '100%', height: '100%' },
  avatarPlaceholder: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },

  bubbleWrapper: { maxWidth: '75%', position: 'relative' },
  bubbleWrapperMine: { alignItems: 'flex-end' },
  bubbleWrapperTheirs: { alignItems: 'flex-start' },

  bubble: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 18, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 1, elevation: 1 },
  bubbleMine: { borderBottomRightRadius: 18 },
  bubbleTheirs: { borderBottomLeftRadius: 18 },
  bubbleMineNoTail: { borderBottomRightRadius: 18 },
  bubbleTheirsNoTail: { borderBottomLeftRadius: 18 },

  tail: { position: 'absolute', bottom: 0, width: 20, height: 20, borderBottomWidth: 10, borderBottomColor: 'transparent', zIndex: -1 },
  tailMine: { right: -6, borderRightWidth: 10, borderRightColor: 'transparent', borderBottomLeftRadius: 16, transform: [{ rotate: '90deg' }] },
  tailTheirs: { left: -6, borderLeftWidth: 10, borderLeftColor: 'transparent', borderBottomRightRadius: 16, transform: [{ rotate: '-90deg' }] },

  senderName: { fontSize: 13, fontWeight: '700', marginBottom: 4 },
  bubbleText: { fontSize: 16, lineHeight: 22 },

  inBubbleReply: { borderRadius: 8, borderLeftWidth: 4, paddingHorizontal: 8, paddingVertical: 6, marginBottom: 6 },
  inBubbleReplyName: { fontSize: 12, fontWeight: '700', marginBottom: 2 },
  inBubbleReplyText: { fontSize: 13, lineHeight: 18 },

  imageAttachment: { width: 240, height: 240, borderRadius: 12, marginBottom: 6 },
  fileAttachment: { flexDirection: 'row', alignItems: 'center', padding: 8, borderRadius: 12, marginBottom: 6, width: 220 },
  fileIconBox: { width: 40, height: 40, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  fileName: { fontSize: 14, fontWeight: '600', marginBottom: 2 },
  fileSize: { fontSize: 11 },

  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: 4 },
  timeText: { fontSize: 10, fontWeight: '500' },

  replyIndicator: { position: 'absolute', top: 0, bottom: 0, justifyContent: 'center' },
  replyIndicatorLeft: { left: 16 },
  replyIndicatorRight: { right: 16 },
  replyIndicatorCircle: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#8E8E93', alignItems: 'center', justifyContent: 'center' },

  composerContainer: { backgroundColor: '#F9F9F9', borderTopWidth: 1, borderTopColor: '#E5E5EA', paddingTop: 10, paddingHorizontal: 12 },
  replyBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', padding: 10, borderRadius: 12, marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 3, elevation: 1 },
  replyBarBorder: { width: 4, height: '100%', borderRadius: 2, marginRight: 10 },
  replyBarName: { fontSize: 13, fontWeight: '700', marginBottom: 2 },
  replyBarText: { fontSize: 13, color: '#8E8E93' },

  inputRow: { flexDirection: 'row', alignItems: 'flex-end' },
  plusBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', marginRight: 8, marginBottom: 2 },
  textInputBox: { flex: 1, flexDirection: 'row', alignItems: 'flex-end', backgroundColor: '#FFFFFF', borderRadius: 20, borderWidth: 1, borderColor: '#E5E5EA', paddingLeft: 16, paddingRight: 4, paddingTop: 6, paddingBottom: 6 },
  textInput: { flex: 1, maxHeight: 100, minHeight: 28, fontSize: 16, color: '#1C1C1E', paddingTop: Platform.OS === 'ios' ? 4 : 0, paddingBottom: Platform.OS === 'ios' ? 4 : 0 },
  sendBtn: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', marginLeft: 8 },

  attachMenu: { flexDirection: 'row', backgroundColor: '#F9F9F9', paddingVertical: 16, paddingHorizontal: 20, borderTopWidth: 1, borderTopColor: '#E5E5EA' },
  attachOption: { alignItems: 'center', marginRight: 30 },
  attachIcon: { width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  attachText: { fontSize: 12, color: '#1C1C1E', fontWeight: '500' },

  fullScreenImageContainer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center' },
  fullScreenImage: { width: '100%', height: '100%' },
  closeImageBtn: { position: 'absolute', top: 50, left: 20, zIndex: 10, padding: 10, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 20 },
  downloadImageBtn: { position: 'absolute', top: 50, right: 20, zIndex: 10, padding: 10, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 20 },

  // ── Anchored Action Menu Styles ──
  actionModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.1)' },
  anchoredMenu: { position: 'absolute', width: 220, zIndex: 100 },
  reactionRow: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#FFFFFF', borderRadius: 30, paddingVertical: 8, paddingHorizontal: 12, marginBottom: 8, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10, elevation: 5 },
  reactionBtn: { padding: 4 },
  reactionEmoji: { fontSize: 24 },
  actionList: { backgroundColor: '#FFFFFF', borderRadius: 16, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10, elevation: 5 },
  actionItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E5E5EA' },
  actionIcon: { marginRight: 12 },
  actionText: { fontSize: 15, color: '#1C1C1E', fontWeight: '500' },
});