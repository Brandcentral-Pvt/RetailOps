/**
 * NewChatScreen
 *
 * Start a direct conversation or create a group conversation.
 *
 * Contacts are permission-scoped by the backend.
 *
 * Direct:
 *   - Tap a contact
 *   - Creates/opens the direct conversation
 *
 * Group:
 *   - Enter a group title
 *   - Select members
 *   - Select the seller anchor
 *   - Create the group
 */

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  View,
} from 'react-native';

import {
  Avatar,
  Button,
  Checkbox,
  Divider,
  SegmentedButtons,
  Text,
  TextInput,
  useTheme,
} from 'react-native-paper';

import type {
  NativeStackScreenProps,
} from '@react-navigation/native-stack';

import {
  chatApiService,
} from '../../services/chatApiService';

import {
  useAuthStore,
} from '../../store/authStore';

import {
  initials,
} from '../../utils/avatar';

import type {
  ChatContact,
  MessagesStackParamList,
} from '../../types';

type Props =
  NativeStackScreenProps<
    MessagesStackParamList,
    'NewChat'
  >;

type ChatMode =
  | 'direct'
  | 'group';

const SEARCH_DEBOUNCE = 350;

/* -------------------------------------------------------------------------- */
/* Screen                                                                     */
/* -------------------------------------------------------------------------- */

export default function NewChatScreen({
  navigation,
}: Props) {
  const theme = useTheme();

  const { colors } = theme ?? { colors: {} };

  const isLoadingTheme = !theme?.colors;

  const user =
    useAuthStore(
      (state) => state.user,
    );

  /*
   * Seller IDs assigned to this authenticated
   * seller/user.
   *
   * Your current User type defines assignedSellers
   * as string[].
   */
  const assignedSellers =
    user?.assignedSellers ?? [];

  if (isLoadingTheme) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }

  /* ------------------------------------------------------------------------ */
  /* Local state                                                              */
  /* ------------------------------------------------------------------------ */

  const [mode, setMode] =
    useState<ChatMode>(
      'direct',
    );

  const [search, setSearch] =
    useState('');

  const [contacts, setContacts] =
    useState<ChatContact[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [creating, setCreating] =
    useState(false);

  const [error, setError] =
    useState<string | null>(
      null,
    );

  const [groupTitle, setGroupTitle] =
    useState('');

  const [selected, setSelected] =
    useState<Set<string>>(
      () => new Set(),
    );

  const [sellerId, setSellerId] =
    useState<string>(
      assignedSellers[0] ?? '',
    );

  /*
   * Keep the latest search term available to
   * callbacks without recreating them unnecessarily.
   */
  const searchRef =
    useRef(search);

  searchRef.current =
    search;

  /*
   * Prevent an old search response from replacing
   * a newer search result.
   */
  const requestIdRef =
    useRef(0);

  /* ------------------------------------------------------------------------ */
  /* Seller synchronization                                                   */
  /* ------------------------------------------------------------------------ */

  useEffect(() => {
    if (
      assignedSellers.length === 0
    ) {
      setSellerId('');
      return;
    }

    /*
     * If the currently selected seller is still
     * assigned, preserve it.
     */
    if (
      sellerId &&
      assignedSellers.includes(
        sellerId,
      )
    ) {
      return;
    }

    setSellerId(
      assignedSellers[0],
    );
  }, [
    assignedSellers,
    sellerId,
  ]);

  /* ------------------------------------------------------------------------ */
  /* Load contacts                                                            */
  /* ------------------------------------------------------------------------ */

  const loadContacts =
    useCallback(
      async (
        term: string,
      ) => {
        const requestId =
          ++requestIdRef.current;

        setLoading(true);
        setError(null);

        try {
          const rows =
            await chatApiService
              .listContacts(
                term.trim(),
              );

          /*
           * Ignore an older request if a newer
           * search has already started.
           */
          if (
            requestId !==
            requestIdRef.current
          ) {
            return;
          }

          setContacts(
            Array.isArray(rows)
              ? rows
              : [],
          );
        } catch (err) {
          if (
            requestId !==
            requestIdRef.current
          ) {
            return;
          }

          setError(
            err instanceof Error
              ? err.message
              : 'Failed to load contacts',
          );

          setContacts([]);
        } finally {
          if (
            requestId ===
            requestIdRef.current
          ) {
            setLoading(false);
          }
        }
      },
      [],
    );

  /*
   * Initial contact load.
   */
  useEffect(() => {
    void loadContacts('');
  }, [loadContacts]);

  /*
   * Debounced search.
   *
   * Empty search is handled here as well, so we don't
   * need a second effect for the initial request.
   */
  useEffect(() => {
    const timer =
      setTimeout(() => {
        void loadContacts(
          searchRef.current.trim(),
        );
      }, SEARCH_DEBOUNCE);

    return () => {
      clearTimeout(timer);
    };
  }, [
    search,
    loadContacts,
  ]);

  /* ------------------------------------------------------------------------ */
  /* Direct conversation                                                      */
  /* ------------------------------------------------------------------------ */

  const startDirect =
    useCallback(
      async (
        contact: ChatContact,
      ) => {
        if (creating) {
          return;
        }

        setCreating(true);
        setError(null);

        try {
          const conversation =
            await chatApiService
              .createDirect(
                contact._id,
              );

          navigation.replace(
            'Chat',
            {
              conversationId:
                conversation.id,
              title:
                conversation.title ??
                contact.name,
            },
          );
        } catch (err) {
          setError(
            err instanceof Error
              ? err.message
              : 'Could not start conversation',
          );

          setCreating(false);
        }
      },
      [
        creating,
        navigation,
      ],
    );

  /* ------------------------------------------------------------------------ */
  /* Group selection                                                          */
  /* ------------------------------------------------------------------------ */

  const toggleMember =
    useCallback(
      (id: string) => {
        if (creating) {
          return;
        }

        setSelected(
          (previous) => {
            const next =
              new Set(
                previous,
              );

            if (
              next.has(id)
            ) {
              next.delete(id);
            } else {
              next.add(id);
            }

            return next;
          },
        );
      },
      [creating],
    );

  /* ------------------------------------------------------------------------ */
  /* Create group                                                             */
  /* ------------------------------------------------------------------------ */

  const createGroupChat =
    useCallback(
      async () => {
        const title =
          groupTitle.trim();

        if (!title) {
          setError(
            'Enter a group title.',
          );
          return;
        }

        if (
          selected.size === 0
        ) {
          setError(
            'Select at least one member.',
          );
          return;
        }

        if (!sellerId) {
          setError(
            'No seller is available for this group.',
          );
          return;
        }

        if (creating) {
          return;
        }

        setCreating(true);
        setError(null);

        try {
          const conversation =
            await chatApiService
              .createGroup({
                title,
                sellerId,
                participantIds:
                  Array.from(
                    selected,
                  ),
              });

          navigation.replace(
            'Chat',
            {
              conversationId:
                conversation.id,
              title,
            },
          );
        } catch (err) {
          setError(
            err instanceof Error
              ? err.message
              : 'Could not create group',
          );

          setCreating(false);
        }
      },
      [
        creating,
        groupTitle,
        navigation,
        selected,
        sellerId,
      ],
    );

  /* ------------------------------------------------------------------------ */
  /* Search                                                                   */
  /* ------------------------------------------------------------------------ */

  const handleSearchChange =
    useCallback(
      (value: string) => {
        setSearch(value);
      },
      [],
    );

  const handleRefresh =
    useCallback(() => {
      void loadContacts(
        searchRef.current.trim(),
      );
    }, [loadContacts]);

  /* ------------------------------------------------------------------------ */
  /* Contact row                                                              */
  /* ------------------------------------------------------------------------ */

  const renderContact =
    useCallback(
      ({
        item,
      }: {
        item: ChatContact;
      }) => {
        const isSelected =
          selected.has(
            item._id,
          );

        const handlePress =
          () => {
            if (
              mode === 'direct'
            ) {
              void startDirect(
                item,
              );
              return;
            }

            toggleMember(
              item._id,
            );
          };

        return (
          <View
            style={[
              styles.contactRow,
              {
                backgroundColor:
                  colors.surface,
              },
            ]}
          >
            <View
              style={
                styles.contactTouchable
              }
            >
              <Avatar.Text
                size={46}
                label={initials(
                  item.name,
                )}
                color={
                  colors.primary
                }
                style={[
                  styles.avatar,
                  {
                    backgroundColor:
                      colors.primaryContainer,
                  },
                ]}
              />

              <View
                style={
                  styles.contactInfo
                }
              >
                <Text
                  variant="titleSmall"
                  numberOfLines={
                    1
                  }
                  style={[
                    styles.contactName,
                    {
                      color:
                        colors.onSurface,
                    },
                  ]}
                  onPress={
                    handlePress
                  }
                >
                  {item.name}
                </Text>

                {item.email ? (
                  <Text
                    variant="bodySmall"
                    numberOfLines={
                      1
                    }
                    style={[
                      styles.contactEmail,
                      {
                        color:
                          colors.onSurfaceVariant,
                      },
                    ]}
                    onPress={
                      handlePress
                    }
                  >
                    {item.email}
                  </Text>
                ) : null}
              </View>

              {mode ===
              'group' ? (
                <Checkbox
                  status={
                    isSelected
                      ? 'checked'
                      : 'unchecked'
                  }
                  onPress={() =>
                    toggleMember(
                      item._id,
                    )
                  }
                  color={
                    colors.primary
                  }
                  disabled={
                    creating
                  }
                />
              ) : (
                <Text
                  variant="bodyMedium"
                  style={[
                    styles.startLabel,
                    {
                      color:
                        colors.primary,
                    },
                  ]}
                  onPress={
                    handlePress
                  }
                >
                  Start
                </Text>
              )}
            </View>
          </View>
        );
      },
      [
        colors,
        creating,
        mode,
        selected,
        startDirect,
        toggleMember,
      ],
    );

  const renderSeparator =
    useCallback(
      () => (
        <Divider
          style={[
            styles.separator,
            {
              backgroundColor:
                colors.outlineVariant,
            },
          ]}
        />
      ),
      [colors],
    );

  /* ------------------------------------------------------------------------ */
  /* Empty state                                                              */
  /* ------------------------------------------------------------------------ */

  const renderEmpty =
    useCallback(() => {
      if (loading) {
        return null;
      }

      return (
        <View
          style={
            styles.emptyContainer
          }
        >
          <Avatar.Icon
            size={58}
            icon="account-search-outline"
            color={
              colors.primary
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
            {search.trim()
              ? 'No contacts found'
              : 'No contacts available'}
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
            {search.trim()
              ? 'Try a different name or email address.'
              : 'There are no contacts available for your account.'}
          </Text>
        </View>
      );
    }, [
      colors,
      loading,
      search,
    ]);

  /* ------------------------------------------------------------------------ */
  /* Render                                                                   */
  /* ------------------------------------------------------------------------ */

  return (
    <KeyboardAvoidingView
      style={[
        styles.container,
        {
          backgroundColor:
            colors.background,
        },
      ]}
      behavior={
        Platform.OS === 'ios'
          ? 'padding'
          : undefined
      }
    >
      {/* Search */}
      <View
        style={[
          styles.searchSection,
          {
            backgroundColor:
              colors.surface,
            borderBottomColor:
              colors.outlineVariant,
          },
        ]}
      >
        <TextInput
          mode="outlined"
          value={search}
          onChangeText={
            handleSearchChange
          }
          placeholder="Search contacts"
          placeholderTextColor={
            colors.onSurfaceVariant
          }
          left={
            <TextInput.Icon
              icon="magnify"
              color={
                colors.onSurfaceVariant
              }
            />
          }
          right={
            search.length > 0 ? (
              <TextInput.Icon
                icon="close"
                color={
                  colors.onSurfaceVariant
                }
                onPress={() =>
                  setSearch('')
                }
              />
            ) : null
          }
          editable={!creating}
          style={[
            styles.searchInput,
            {
              backgroundColor:
                colors.surface,
            },
          ]}
          outlineColor={
            colors.outline
          }
          activeOutlineColor={
            colors.primary
          }
        />
      </View>

      {/* Mode selector */}
      <View
        style={
          styles.modeSection
        }
      >
        <SegmentedButtons
          value={mode}
          onValueChange={(
            value,
          ) => {
            if (
              value ===
                'direct' ||
              value ===
                'group'
            ) {
              setMode(
                value,
              );
            }
          }}
          buttons={[
            {
              value:
                'direct',
              label:
                'Direct',
              icon:
                'account-outline',
            },
            {
              value:
                'group',
              label:
                'Group',
              icon:
                'account-group-outline',
            },
          ]}
          density="small"
          disabled={
            creating
          }
        />
      </View>

      {/* Group configuration */}
      {mode ===
      'group' ? (
        <View
          style={[
            styles.groupSection,
            {
              backgroundColor:
                colors.surface,
              borderBottomColor:
                colors.outlineVariant,
            },
          ]}
        >
          <TextInput
            mode="outlined"
            label="Group title"
            placeholder="Enter group title"
            value={groupTitle}
            onChangeText={
              setGroupTitle
            }
            editable={!creating}
            style={
              styles.groupTitleInput
            }
            outlineColor={
              colors.outline
            }
            activeOutlineColor={
              colors.primary
            }
          />

          {/* Seller anchor */}
          <View
            style={
              styles.sellerSection
            }
          >
            <View
              style={
                styles.sellerHeader
              }
            >
              <Text
                variant="labelLarge"
                style={[
                  styles.sellerLabel,
                  {
                    color:
                      colors.onSurfaceVariant,
                  },
                ]}
              >
                Seller
              </Text>

              <Text
                variant="bodyMedium"
                style={[
                  styles.sellerValue,
                  {
                    color:
                      colors.onSurface,
                  },
                ]}
                numberOfLines={
                  1
                }
              >
                {sellerId ||
                  'No seller available'}
              </Text>
            </View>

            {assignedSellers.length >
            1 ? (
              <FlatList
                horizontal
                data={
                  assignedSellers
                }
                keyExtractor={(
                  id,
                ) => id}
                showsHorizontalScrollIndicator={
                  false
                }
                contentContainerStyle={
                  styles.sellerList
                }
                renderItem={({
                  item,
                }) => {
                  const active =
                    item ===
                    sellerId;

                  return (
                    <Button
                      mode={
                        active
                          ? 'contained'
                          : 'outlined'
                      }
                      compact
                      onPress={() =>
                        setSellerId(
                          item,
                        )
                      }
                      disabled={
                        creating
                      }
                      style={
                        styles.sellerButton
                      }
                    >
                      {item}
                    </Button>
                  );
                }}
              />
            ) : null}
          </View>

          {/* Member count */}
          <View
            style={
              styles.memberSummary
            }
          >
            <View
              style={[
                styles.memberCountIcon,
                {
                  backgroundColor:
                    colors.primaryContainer,
                },
              ]}
            >
              <Avatar.Icon
                size={28}
                icon="account-multiple-outline"
                color={
                  colors.primary
                }
                style={
                  styles.memberIcon
                }
              />
            </View>

            <View
              style={
                styles.memberSummaryText
              }
            >
              <Text
                variant="labelLarge"
                style={{
                  color:
                    colors.onSurface,
                }}
              >
                {selected.size}{' '}
                member
                {selected.size !==
                1
                  ? 's'
                  : ''}{' '}
                selected
              </Text>

              <Text
                variant="bodySmall"
                style={{
                  color:
                    colors.onSurfaceVariant,
                }}
              >
                Select people below
                to add them to this
                group.
              </Text>
            </View>
          </View>
        </View>
      ) : null}

      {/* Error */}
      {error ? (
        <View
          style={[
            styles.errorContainer,
            {
              backgroundColor:
                colors.errorContainer,
              borderColor:
                colors.error,
            },
          ]}
        >
          <Avatar.Icon
            size={28}
            icon="alert-circle-outline"
            color={
              colors.error
            }
            style={[
              styles.errorIcon,
              {
                backgroundColor:
                  'transparent',
              },
            ]}
          />

          <Text
            variant="bodySmall"
            style={[
              styles.errorText,
              {
                color:
                  colors.onErrorContainer,
              },
            ]}
          >
            {error}
          </Text>
        </View>
      ) : null}

      {/* Contact list */}
      {loading &&
      contacts.length ===
        0 ? (
        <View
          style={
            styles.loadingContainer
          }
        >
          <ActivityIndicator
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
            Loading contacts…
          </Text>
        </View>
      ) : (
        <FlatList
          data={
            Array.isArray(
              contacts,
            )
              ? contacts
              : []
          }
          renderItem={
            renderContact
          }
          ItemSeparatorComponent={
            renderSeparator
          }
          keyExtractor={(
            item,
          ) => item._id}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={
            false
          }
          ListEmptyComponent={
            renderEmpty
          }
          refreshing={
            loading
          }
          onRefresh={
            handleRefresh
          }
          contentContainerStyle={[
            styles.listContent,
            contacts.length ===
            0
              ? styles.emptyList
              : undefined,
          ]}
        />
      )}

      {/* Group creation CTA */}
      {mode ===
        'group' &&
      selected.size > 0 ? (
        <View
          style={[
            styles.bottomAction,
            {
              backgroundColor:
                colors.surface,
              borderTopColor:
                colors.outlineVariant,
            },
          ]}
        >
          <View
            style={
              styles.bottomActionInfo
            }
          >
            <Text
              variant="labelLarge"
              style={{
                color:
                  colors.onSurface,
              }}
            >
              {selected.size}{' '}
              member
              {selected.size !==
              1
                ? 's'
                : ''}
            </Text>

            <Text
              variant="bodySmall"
              style={{
                color:
                  colors.onSurfaceVariant,
              }}
            >
              Ready to create
              group
            </Text>
          </View>

          <Button
            mode="contained"
            icon="account-group"
            onPress={
              createGroupChat
            }
            loading={
              creating
            }
            disabled={
              creating ||
              !groupTitle.trim() ||
              !sellerId
            }
            contentStyle={
              styles.createButtonContent
            }
            style={
              styles.createButton
            }
          >
            Create Group
          </Button>
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}

/* -------------------------------------------------------------------------- */
/* Styles                                                                     */
/* -------------------------------------------------------------------------- */

const styles =
  StyleSheet.create({
    container: {
      flex: 1,
    },

    searchSection: {
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 10,
      borderBottomWidth:
        StyleSheet.hairlineWidth,
    },

    searchInput: {
      minHeight: 48,
    },

    modeSection: {
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 10,
    },

    groupSection: {
      paddingHorizontal: 16,
      paddingTop: 4,
      paddingBottom: 14,
      borderBottomWidth:
        StyleSheet.hairlineWidth,
    },

    groupTitleInput: {
      marginBottom: 14,
    },

    sellerSection: {
      marginBottom: 12,
    },

    sellerHeader: {
      flexDirection:
        'row',
      alignItems:
        'center',
      justifyContent:
        'space-between',
      gap: 16,
    },

    sellerLabel: {
      fontWeight:
        '500',
    },

    sellerValue: {
      flex: 1,
      textAlign:
        'right',
      fontWeight:
        '600',
    },

    sellerList: {
      gap: 8,
      paddingTop: 10,
    },

    sellerButton: {
      marginRight: 4,
    },

    memberSummary: {
      flexDirection:
        'row',
      alignItems:
        'center',
      marginTop: 4,
    },

    memberCountIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems:
        'center',
      justifyContent:
        'center',
      marginRight: 10,
    },

    memberIcon: {
      width: 28,
      height: 28,
      backgroundColor:
        'transparent',
    },

    memberSummaryText: {
      flex: 1,
    },

    errorContainer: {
      flexDirection:
        'row',
      alignItems:
        'center',
      marginHorizontal: 16,
      marginTop: 10,
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderRadius: 8,
      borderWidth:
        StyleSheet.hairlineWidth,
    },

    errorIcon: {
      marginRight: 4,
    },

    errorText: {
      flex: 1,
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

    listContent: {
      paddingBottom: 110,
    },

    emptyList: {
      flexGrow: 1,
    },

    contactRow: {
      minHeight: 72,
    },

    contactTouchable: {
      flex: 1,
      flexDirection:
        'row',
      alignItems:
        'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
    },

    avatar: {
      marginRight: 12,
    },

    contactInfo: {
      flex: 1,
      minWidth: 0,
    },

    contactName: {
      fontWeight:
        '600',
    },

    contactEmail: {
      marginTop: 3,
    },

    startLabel: {
      fontWeight:
        '600',
      marginLeft: 8,
    },

    separator: {
      marginLeft: 74,
    },

    emptyContainer: {
      flex: 1,
      alignItems:
        'center',
      justifyContent:
        'center',
      paddingHorizontal: 32,
      paddingVertical: 60,
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
      maxWidth: 320,
      textAlign:
        'center',
      lineHeight: 21,
    },

    bottomAction: {
      position:
        'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      flexDirection:
        'row',
      alignItems:
        'center',
      justifyContent:
        'space-between',
      paddingHorizontal: 16,
      paddingTop: 10,
      paddingBottom:
        Platform.OS === 'ios'
          ? 28
          : 12,
      borderTopWidth:
        StyleSheet.hairlineWidth,
      elevation: 8,
    },

    bottomActionInfo: {
      flex: 1,
      marginRight: 12,
    },

    createButton: {
      minWidth: 150,
    },

    createButtonContent: {
      height: 44,
    },
  });