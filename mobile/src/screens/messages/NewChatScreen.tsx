/**
 * New chat — start a direct conversation (tap a contact) or a group
 * (title + members + seller anchor). Contacts are permission-scoped by the
 * backend (users you share a seller with).
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  Avatar,
  Button,
  Checkbox,
  Divider,
  SegmentedButtons,
  Text,
  useTheme,
} from 'react-native-paper';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { chatApiService } from '../../services/chatApiService';
import { useAuthStore } from '../../store/authStore';
import { initials } from '../../utils/avatar';
import type { ChatContact } from '../../types';
import type { MessagesStackParamList } from '../../types';

type Props = NativeStackScreenProps<MessagesStackParamList, 'NewChat'>;

const SEARCH_DEBOUNCE = 350;

export default function NewChatScreen({ navigation }: Props) {
  const { colors } = useTheme();

  const user = useAuthStore((s) => s.user);
  const myId = user?.id ?? user?._id ?? '';
  const sellers = useMemo(() => user?.assignedSellers ?? [], [user]);

  const [mode, setMode] = useState<'direct' | 'group'>('direct');
  const [search, setSearch] = useState('');
  const [contacts, setContacts] = useState<ChatContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [groupTitle, setGroupTitle] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sellerId, setSellerId] = useState<string>(sellers[0] ?? '');

  const searchRef = useRef(search);
  searchRef.current = search;

  const loadContacts = useCallback(async (term: string) => {
    setLoading(true);
    setError(null);
    try {
      const rows = await chatApiService.listContacts(term);
      setContacts(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load contacts');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadContacts('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      const term = searchRef.current.trim();
      if (!term) {
        loadContacts('');
      } else {
        loadContacts(term);
      }
    }, SEARCH_DEBOUNCE);
    return () => clearTimeout(timer);
  }, [search, loadContacts]);

  const startDirect = async (contact: ChatContact) => {
    setCreating(true);
    setError(null);
    try {
      const conversation = await chatApiService.createDirect(contact._id);
      navigation.replace('Chat', {
        conversationId: conversation.id,
        title: conversation.title ?? contact.name,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start chat');
      setCreating(false);
    }
  };

  const createGroupChat = async () => {
    const title = groupTitle.trim();
    if (!title || selected.size === 0) return;
    if (!sellerId) {
      setError('No seller available to anchor the group');
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const conversation = await chatApiService.createGroup({
        title,
        sellerId,
        participantIds: [...selected],
      });
      navigation.replace('Chat', { conversationId: conversation.id, title });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create group');
      setCreating(false);
    }
  };

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const renderContact = ({ item }: { item: ChatContact }) => (
    <TouchableOpacity
      onPress={() => (mode === 'direct' ? startDirect(item) : toggle(item._id))}
      activeOpacity={0.7}
      disabled={creating}
    >
      <View
        style={[
          styles.contactRow,
          { borderBottomColor: colors.outlineVariant },
        ]}
      >
        <Avatar.Text
          size={42}
          label={initials(item.name)}
          style={[styles.avatar, { backgroundColor: colors.primaryContainer }]}
          color={colors.primary}
        />
        <View style={styles.contactInfo}>
          <Text
            variant="titleSmall"
            style={{ color: colors.onSurface }}
            numberOfLines={1}
          >
            {item.name}
          </Text>
          {item.email ? (
            <Text
              variant="bodySmall"
              style={{ color: colors.onSurfaceVariant }}
              numberOfLines={1}
            >
              {item.email}
            </Text>
          ) : null}
        </View>
        {mode === 'group' ? (
          <Checkbox
            status={selected.has(item._id) ? 'checked' : 'unchecked'}
            onPress={() => toggle(item._id)}
          />
        ) : (
          <Text variant="labelLarge" style={{ color: colors.primary }}>
            Chat
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );

  const canCreateGroup =
    mode === 'group' &&
    groupTitle.trim().length > 0 &&
    selected.size >= 1 &&
    !!sellerId;

  return (
    <KeyboardAvoidingView
      style={[styles.screen, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.headerActions}>
        <SegmentedButtons
          value={mode}
          onValueChange={(value) =>
            setMode(value as 'direct' | 'group')
          }
          style={styles.segments}
          buttons={[
            { value: 'direct', label: 'Message' },
            { value: 'group', label: 'Group' },
          ]}
        />

        {mode === 'group' && sellers.length > 0 ? (
          <View style={styles.groupFields}>
            <TextInput
              value={groupTitle}
              onChangeText={setGroupTitle}
              placeholder="Group name"
              placeholderTextColor={colors.onSurfaceVariant}
              style={[
                styles.titleInput,
                {
                  color: colors.onSurface,
                  backgroundColor: colors.surface,
                  borderColor: colors.outlineVariant,
                },
              ]}
            />

            {sellers.length > 1 ? (
              <View style={styles.sellerRow}>
                <Text
                  variant="bodySmall"
                  style={{ color: colors.onSurfaceVariant }}
                >
                  Seller:
                </Text>
                {sellers.slice(0, 6).map((id) => (
                  <TouchableOpacity
                    key={id}
                    onPress={() => setSellerId(id)}
                    style={[
                      styles.sellerChip,
                      {
                        backgroundColor:
                          sellerId === id ? colors.primaryContainer : colors.surface,
                        borderColor:
                          sellerId === id ? colors.primary : colors.outlineVariant,
                      },
                    ]}
                  >
                    <Text
                      variant="labelSmall"
                      style={{ color: sellerId === id ? colors.primary : colors.onSurface }}
                    >
                      {id.slice(0, 6)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : null}
          </View>
        ) : null}
      </View>

      <Divider />

      <FlatList
        data={contacts}
        keyExtractor={(item) => item._id}
        renderItem={renderContact}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search people"
            placeholderTextColor={colors.onSurfaceVariant}
            style={[
              styles.searchInput,
              {
                color: colors.onSurface,
                backgroundColor: colors.surface,
                borderColor: colors.outlineVariant,
              },
            ]}
          />
        }
        ListEmptyComponent={
          loading ? (
            <View style={styles.stateContainer}>
              <ActivityIndicator size={26} color={colors.primary} />
            </View>
          ) : (
            <View style={styles.stateContainer}>
              <Text
                variant="bodyMedium"
                style={{ color: colors.onSurfaceVariant, textAlign: 'center' }}
              >
                {error ?? 'No contacts found'}
              </Text>
            </View>
          )
        }
      />

      {mode === 'group' ? (
        <View style={styles.footer}>
          <Button
            mode="contained"
            loading={creating}
            disabled={!canCreateGroup}
            onPress={createGroupChat}
            style={styles.footerButton}
          >
            Create group
          </Button>
        </View>
      ) : null}

      {error && mode === 'direct' ? (
        <View style={styles.errorBanner}>
          <Text
            variant="bodySmall"
            style={{ color: colors.error, textAlign: 'center' }}
          >
            {error}
          </Text>
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },

  headerActions: {
    paddingHorizontal: 16,
    paddingTop: 14,
  },

  segments: {
    marginBottom: 4,
  },

  groupFields: {
    marginTop: 12,
  },

  titleInput: {
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 15,
  },

  sellerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
  },

  sellerChip: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },

  listContent: {
    padding: 16,
    paddingTop: 8,
    flexGrow: 1,
  },

  searchInput: {
    height: 42,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    marginBottom: 12,
    fontSize: 15,
  },

  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 6,
  },

  avatar: {
    marginRight: 12,
  },

  contactInfo: {
    flex: 1,
    minWidth: 0,
  },

  stateContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 32,
  },

  footer: {
    padding: 16,
    backgroundColor: '#FFFFFF',
  },

  footerButton: {
    borderRadius: 10,
  },

  errorBanner: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
});