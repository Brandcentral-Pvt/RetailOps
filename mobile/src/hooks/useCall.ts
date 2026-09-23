/**
 * useCall hook — initiate calls from chat screens.
 *
 * Only handles permissions + routing. The OutgoingCallScreen owns the full
 * WebRTC lifecycle (peer connection, offer, signaling, status) so the hook
 * stays a thin, failure-free entry point.
 */
import { useCallback } from 'react';
import { Alert, PermissionsAndroid, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { CallType, CallParticipant } from '../types';

interface UseCallOptions {
  callType: CallType;
  callee: CallParticipant;
  conversationId?: string;
}

async function ensureCallPermissions(callType: CallType): Promise<boolean> {
  if (Platform.OS !== 'android') return true;

  const permissions = [PermissionsAndroid.PERMISSIONS.RECORD_AUDIO];
  if (callType === 'video') {
    permissions.push(PermissionsAndroid.PERMISSIONS.CAMERA);
  }

  const results = await PermissionsAndroid.requestMultiple(permissions);
  return permissions.every(
    (permission) => results[permission] === PermissionsAndroid.RESULTS.GRANTED
  );
}

export function useCall() {
  const navigation = useNavigation<any>();

  const initiateCall = useCallback(
    async ({ callType, callee, conversationId }: UseCallOptions): Promise<void> => {
      const granted = await ensureCallPermissions(callType);
      if (!granted) {
        Alert.alert(
          'Permission Required',
          `RetailOps needs microphone${
            callType === 'video' ? ' and camera' : ''
          } access to start ${
            callType === 'video' ? 'video' : 'voice'
          } calls.`
        );
        return;
      }

      const callId = `call-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

      // Navigate to the root call stack (OutgoingCall screen handles the
      // offer, signaling, and call lifecycle).
      navigation.navigate('Calls', {
        screen: 'OutgoingCall',
        params: { callId, callee, callType, conversationId },
      });
    },
    [navigation]
  );

  return { initiateCall };
}