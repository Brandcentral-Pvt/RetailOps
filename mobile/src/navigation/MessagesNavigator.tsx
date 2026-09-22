/**
 * Messages stack — the in-app messaging (chat) module.
 *
 * Drawer route `Messages` renders this navigator so the stack controls its own
 * headers (the drawer header is hidden for that route).
 */
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { MessagesStackParamList } from '../types';
import MessagesScreen from '../screens/messages/MessagesScreen';
import NewChatScreen from '../screens/messages/NewChatScreen';
import ChatScreen from '../screens/messages/ChatScreen';

const Stack = createNativeStackNavigator<MessagesStackParamList>();

export default function MessagesNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: '#FFFFFF' },
        headerTintColor: '#111827',
        headerTitleStyle: { fontSize: 17, fontWeight: '700' },
        headerTitleAlign: 'left',
        headerShadowVisible: false,
        contentStyle: { backgroundColor: '#F8FAFC' },
        gestureEnabled: true,
      }}
    >
      <Stack.Screen
        name="MessagesList"
        component={MessagesScreen}
        options={{ title: 'Messages' }}
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