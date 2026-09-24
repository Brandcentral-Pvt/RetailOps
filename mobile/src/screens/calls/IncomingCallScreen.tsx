/**
 * Incoming Call Screen — full-screen call UI with accept/decline.
 */
import React, { useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  Image,
  Vibration,
  Platform,
} from 'react-native';
import {
  Avatar,
  Button,
  Text,
  useTheme,
} from 'react-native-paper';
import { useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { callService } from '../../services/callService';
import { useCallStore } from '../../store/callStore';
import { useAuthStore } from '../../store/authStore';
import { sendCallSignal } from '../../services/socketService';
import { recordCallInHistory } from '../../utils/callHistory';
import type { CallsStackParamList } from '../../types';

type Props = NativeStackScreenProps<CallsStackParamList, 'IncomingCall'>;

const RING_DURATION = 30000; // 30 seconds

export default function IncomingCallScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const route = useRoute<Props['route']>();
  const { callId, caller, callType, offer, conversationId } = route.params;

  const myId = useAuthStore((s) => s.user?.id ?? s.user?._id ?? '');
  const { setCurrentCall, updateCallStatus, setRemoteStream, clearPendingIncomingCall } = useCallStore();

  const vibrationRef = useRef<number | null>(null);
  const ringTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const answeredRef = useRef(false);
  const startTimeRef = useRef<number>(Date.now());

  useEffect(() => {
    // Start vibration
    vibrationRef.current = setInterval(() => {
      Vibration.vibrate([1000, 2000]);
    }, 3000);

    // Auto-reject after timeout
    ringTimeoutRef.current = setTimeout(() => {
      if (!answeredRef.current) {
        handleDecline('missed');
      }
    }, RING_DURATION);

    // Set up call in store
    const callSession = {
      id: callId,
      conversationId,
      caller,
      callee: { _id: myId, name: 'You', avatar: undefined },
      type: callType,
      direction: 'incoming' as const,
      status: 'ringing' as const,
      startedAt: new Date().toISOString(),
    };
    setCurrentCall(callSession);

    // Create peer connection and answer
    const pc = callService.createPeerConnection(callId, {
      isInitiator: false,
      callType,
      onRemoteStream: (stream) => setRemoteStream(stream),
      onCallEnded: (reason) => {
        if (!answeredRef.current) {
          handleDecline(reason);
        }
      },
      onConnectionStateChange: (state) => {
        if (state === 'connected') {
          updateCallStatus('active');
        }
      },
    });

    callService.createAnswer(callId, callType, offer).then(async (answer) => {
      sendCallSignal('call:answer', { callId, answer });
      updateCallStatus('connecting');
    }).catch((error) => {
      console.error('Failed to create answer:', error);
      handleDecline('failed');
    });

    return () => {
      clearInterval(vibrationRef.current!);
      clearTimeout(ringTimeoutRef.current!);
      clearPendingIncomingCall();
    };
  }, [callId, caller, callType, offer, myId]);

  const handleAccept = async () => {
    answeredRef.current = true;
    clearInterval(vibrationRef.current!);
    clearTimeout(ringTimeoutRef.current!);
    updateCallStatus('active');

    navigation.navigate('ActiveCall', {
      callId,
      otherParticipant: caller,
      callType,
      isIncoming: true,
    });
  };

  const handleDecline = (reason: 'ended' | 'rejected' | 'missed' | 'failed' | 'busy' = 'rejected') => {
    if (answeredRef.current) return;
    answeredRef.current = true;

    clearInterval(vibrationRef.current!);
    clearTimeout(ringTimeoutRef.current!);

    callService.endCall(callId, reason);
    sendCallSignal('call:end', { callId, reason });

    recordCallInHistory({
      callId,
      conversationId,
      caller,
      callee: { _id: myId, name: 'You', avatar: undefined },
      type: callType,
      direction: 'incoming',
      startedAt: new Date(startTimeRef.current).toISOString(),
      duration: 0,
      endReason: reason,
    });

    navigation.goBack();
  };

  useEffect(() => {
    const offIce = callService.onSignal('call:ice', (payload: unknown) => {
      const p = payload as { callId: string; candidate: RTCIceCandidateInit };
      if (p.callId === callId) {
        callService.addIceCandidate(callId, p.candidate);
      }
    });

    const offEnd = callService.onSignal('call:end', (payload: unknown) => {
      const p = payload as {
        callId: string;
        reason?: 'ended' | 'rejected' | 'missed' | 'failed' | 'busy';
      };
      if (p.callId === callId) {
        handleDecline(p.reason ?? 'ended');
      }
    });

    return () => {
      offIce();
      offEnd();
    };
  }, [callId, caller, callType, conversationId, myId]);

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        {/* Caller Info */}
        <View style={styles.callerSection}>
          <Avatar.Image
            size={120}
            source={caller.avatar ? { uri: caller.avatar } : undefined}
            style={styles.callerAvatar}
            fallback={caller.name.charAt(0).toUpperCase()}
          >
            {caller.name.charAt(0).toUpperCase()}
          </Avatar.Image>

          <Text style={styles.callerName} variant="headlineMedium">
            {caller.name}
          </Text>

          <Text style={styles.callTypeLabel} variant="bodyMedium">
            {callType === 'video' ? '📹 Video Call' : '📞 Voice Call'}
          </Text>

          <Text style={styles.incomingLabel} variant="labelLarge">
            Incoming Call
          </Text>
        </View>

        {/* Action Buttons */}
        <View style={styles.buttonRow}>
          <Button
            mode="outlined"
            style={styles.declineButton}
            onPress={() => handleDecline('rejected')}
            icon="phone-hangup"
            contentStyle={{ backgroundColor: '#FF3B30' }}
            labelStyle={{ color: '#FF3B30' }}
            uppercase={false}
          >
            Decline
          </Button>

          <Button
            mode="contained"
            style={styles.acceptButton}
            onPress={handleAccept}
            icon={callType === 'video' ? 'video' : 'phone'}
            contentStyle={{ backgroundColor: '#34C759' }}
            labelStyle={{ color: '#FFFFFF' }}
            uppercase={false}
          >
            Accept
          </Button>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  content: {
    alignItems: 'center',
  },
  callerSection: {
    alignItems: 'center',
    marginBottom: 60,
  },
  callerAvatar: {
    borderRadius: 60,
    backgroundColor: '#E0E0E0',
    marginBottom: 16,
  },
  callerName: {
    fontSize: 28,
    fontWeight: '600',
    marginBottom: 4,
  },
  callTypeLabel: {
    color: '#666',
    marginBottom: 16,
  },
  incomingLabel: {
    color: '#34C759',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 40,
  },
  declineButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
  },
  acceptButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
});