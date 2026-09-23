/**
 * Calls Navigator — stack navigator for calling module.
 */
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { CallsStackParamList } from '../types';
import IncomingCallScreen from '../screens/calls/IncomingCallScreen';
import OutgoingCallScreen from '../screens/calls/OutgoingCallScreen';
import ActiveCallScreen from '../screens/calls/ActiveCallScreen';
import CallHistoryScreen from '../screens/calls/CallHistoryScreen';

const Stack = createNativeStackNavigator<CallsStackParamList>();

export default function CallsNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#FFFFFF' },
      }}
    >
      <Stack.Screen
        name="IncomingCall"
        component={IncomingCallScreen}
        options={{ presentation: 'modal' }}
      />
      <Stack.Screen
        name="OutgoingCall"
        component={OutgoingCallScreen}
        options={{ presentation: 'modal' }}
      />
      <Stack.Screen
        name="ActiveCall"
        component={ActiveCallScreen}
        options={{ presentation: 'fullScreenModal' }}
      />
      <Stack.Screen
        name="CallHistory"
        component={CallHistoryScreen}
        options={{ title: 'Call History' }}
      />
    </Stack.Navigator>
  );
}