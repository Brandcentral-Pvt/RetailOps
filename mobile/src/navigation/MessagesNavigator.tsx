/**
 * Messages stack — the in-app messaging (chat) module.
 *
 * Drawer route `Messages` renders this navigator so the stack controls its own
 * headers (the drawer header is hidden for that route). The list header keeps
 * a hamburger button that opens the parent navigation drawer.
 */
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import {
  IconButton,
  useTheme,
} from 'react-native-paper';
import type {
  NavigationProp,
} from '@react-navigation/native';
import type { DrawerNavigationProp } from '@react-navigation/drawer';
import type { MessagesStackParamList, MainDrawerParamList } from '../types';
import MessagesScreen from '../screens/messages/MessagesScreen';
import NewChatScreen from '../screens/messages/NewChatScreen';
import ChatScreen from '../screens/messages/ChatScreen';

const Stack = createNativeStackNavigator<MessagesStackParamList>();

function openDrawerFromStack(
  navigation: NavigationProp<MessagesStackParamList>,
): void {
  navigation
    .getParent<DrawerNavigationProp<MainDrawerParamList>>()
    ?.openDrawer();
}

export default function MessagesNavigator() {
  const { colors } = useTheme();

  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.onSurface,
        headerTitleStyle: { fontSize: 17, fontWeight: '700' },
        headerTitleAlign: 'left',
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.background },
        gestureEnabled: true,
      }}
    >
      <Stack.Screen
        name="MessagesList"
        component={MessagesScreen}
        options={({ navigation }) => ({
          title: 'Messages',
          headerLeft: () => (
            <IconButton
              icon="menu"
              size={24}
              iconColor={colors.onSurface}
              accessibilityLabel="Open navigation menu"
              accessibilityHint="Opens the main navigation drawer"
              onPress={() => openDrawerFromStack(navigation)}
              style={{ marginLeft: -4 }}
            />
          ),
        })}
      />
      <Stack.Screen
        name="NewChat"
        component={NewChatScreen}
        options={{ title: 'New Message' }}
      />
      <Stack.Screen
        name="Chat"
        component={ChatScreen}
        options={{ title: '' }}
      />
    </Stack.Navigator>
  );
}