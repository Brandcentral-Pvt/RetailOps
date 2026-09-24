/**
 * Outgoing Call Screen
 *
 * Premium outgoing-call UI with:
 * - Animated pulsing rings around the avatar
 * - Gradient background
 * - Mute / speaker pre-call toggles
 * - Proper WebRTC signaling & lifecycle
 */

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  View,
  Vibration,
} from 'react-native';
import {
  Avatar,
  IconButton,
  Text,
  useTheme,
} from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { callService } from '../../services/callService';
import { sendCallSignal } from '../../services/socketService';
import { useAuthStore } from '../../store/authStore';
import { useCallStore } from '../../store/callStore';
import { recordCallInHistory } from '../../utils/callHistory';

import type { CallsStackParamList } from '../../types';

type Props = NativeStackScreenProps<CallsStackParamList, 'OutgoingCall'>;

const RING_TIMEOUT = 45_000;

export default function OutgoingCallScreen({ route, navigation }: Props) {
  const { colors } = useTheme();
  const { callId, callee, callType, conversationId } = route.params;

  const myId = useAuthStore(
    (state) => state.user?.id ?? state.user?._id ?? '',
  );

  const setCurrentCall = useCallStore((s) => s.setCurrentCall);
  const updateCallStatus = useCallStore((s) => s.updateCallStatus);
  const setRemoteStream = useCallStore((s) => s.setRemoteStream);

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const connectedRef = useRef(false);
  const endingRef = useRef(false);
  const startedRef = useRef(false);
  const startTimeRef = useRef<number>(Date.now());

  const [callStatus, setCallStatus] = useState<
    'ringing' | 'connecting' | 'active'
  >('ringing');
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaker, setIsSpeaker] = useState(callType === 'video');

  // ---------------- Ring (while dialing) ----------------
  useEffect(() => {
    if (callStatus !== 'ringing') return;

    const ring = setInterval(() => {
      if (Platform.OS === 'android') {
        Vibration.vibrate([1000, 2000]);
      } else {
        Vibration.vibrate();
      }
    }, 3000);

    return () => clearInterval(ring);
  }, [callStatus]);

  // ---------------- Animations ----------------
  const pulse1 = useRef(new Animated.Value(0)).current;
  const pulse2 = useRef(new Animated.Value(0)).current;
  const pulse3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const createPulse = (value: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(value, {
            toValue: 1,
            duration: 2400,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      );

    const anim = Animated.parallel([
      createPulse(pulse1, 0),
      createPulse(pulse2, 800),
      createPulse(pulse3, 1600),
    ]);
    anim.start();

    return () => anim.stop();
  }, [pulse1, pulse2, pulse3]);

  const makePulseStyle = (value: Animated.Value) => ({
    transform: [
      {
        scale: value.interpolate({
          inputRange: [0, 1],
          outputRange: [1, 2.2],
        }),
      },
    ],
    opacity: value.interpolate({
      inputRange: [0, 1],
      outputRange: [0.55, 0],
    }),
  });

  // ---------------- Lifecycle ----------------
  const clearRingTimeout = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const handleEnd = useCallback(
    (
      reason:
        | 'ended'
        | 'rejected'
        | 'missed'
        | 'failed'
        | 'busy' = 'ended',
    ) => {
      if (endingRef.current) return;
      endingRef.current = true;

      clearRingTimeout();

      if (connectedRef.current) {
        navigation.navigate('ActiveCall', {
          callId,
          otherParticipant: callee,
          callType,
          isIncoming: false,
        });
        return;
      }

      callService.endCall(callId, reason);
      sendCallSignal('call:end', { callId, reason });

      recordCallInHistory({
        callId,
        conversationId,
        caller: { _id: myId, name: 'You', avatar: undefined },
        callee,
        type: callType,
        direction: 'outgoing',
        startedAt: new Date(startTimeRef.current).toISOString(),
        duration: Math.max(
          0,
          Math.floor((Date.now() - startTimeRef.current) / 1000),
        ),
        endReason: reason,
      });

      navigation.goBack();
    },
    [callId, callee, callType, clearRingTimeout, navigation, myId],
  );

  useEffect(() => {
    let mounted = true;

    // This effect may re-run on re-render; the call itself is one-shot.
    if (startedRef.current) return;
    startedRef.current = true;

    setCurrentCall({
      id: callId,
      conversationId,
      caller: { _id: myId, name: 'You', avatar: undefined },
      callee,
      type: callType,
      direction: 'outgoing',
      status: 'ringing',
      startedAt: new Date().toISOString(),
    });

    timeoutRef.current = setTimeout(() => {
      if (!connectedRef.current && mounted) handleEnd('missed');
    }, RING_TIMEOUT);

    callService.createPeerConnection(callId, {
      isInitiator: true,
      callType,
      onRemoteStream: (stream) => {
        if (!mounted) return;
        setRemoteStream(stream);
        if (!connectedRef.current) {
          connectedRef.current = true;
          setCallStatus('active');
          updateCallStatus('active');
          clearRingTimeout();
        }
      },
      onCallEnded: (reason) => {
        if (!mounted) return;
        if (!connectedRef.current) handleEnd(reason);
      },
      onConnectionStateChange: (state) => {
        if (!mounted) return;
        if (state === 'connecting') setCallStatus('connecting');
        if (state === 'connected' && !connectedRef.current) {
          connectedRef.current = true;
          setCallStatus('active');
          updateCallStatus('active');
          clearRingTimeout();
        }
        if (state === 'failed' || state === 'disconnected') {
          if (!connectedRef.current) handleEnd('failed');
        }
      },
    });

    callService
      .createOffer(callId, callType)
      .then((offer) => {
        if (!mounted) return;
        sendCallSignal('call:invite', {
          callId,
          callerId: myId,
          calleeId: callee._id,
          callType,
          offer,
        });
        updateCallStatus('ringing');
      })
      .catch((error) => {
        console.error('Failed to create outgoing call offer:', error);
        if (mounted) handleEnd('failed');
      });

    return () => {
      mounted = false;
      clearRingTimeout();
    };
  }, [
    callId,
    callee,
    callType,
    myId,
    setCurrentCall,
    setRemoteStream,
    updateCallStatus,
    handleEnd,
    clearRingTimeout,
  ]);

  useEffect(() => {
    const offAnswer = callService.onSignal('call:answer', (payload: unknown) => {
      const p = payload as { callId: string; answer: RTCSessionDescriptionInit };
      if (p.callId === callId) {
        callService.handleAnswer(callId, p.answer).catch(() => {});
      }
    });

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
        handleEnd(p.reason ?? 'ended');
      }
    });

    return () => {
      offAnswer();
      offIce();
      offEnd();
    };
  }, [callId, handleEnd]);

  // ---------------- Handlers ----------------
  const toggleMute = () => {
    setIsMuted((prev) => {
      const next = !prev;
      callService.setMuted(callId, next);
      return next;
    });
  };

  const toggleSpeaker = () => {
    setIsSpeaker((prev) => {
      const next = !prev;
      callService.setSpeaker(callId, next);
      return next;
    });
  };

  // ---------------- Derived ----------------
  const statusLabel =
    callStatus === 'connecting'
      ? 'Connecting…'
      : callStatus === 'active'
        ? 'Connected'
        : 'Ringing…';

  const callTypeLabel = callType === 'video' ? 'Video Call' : 'Voice Call';
  const callIcon = callType === 'video' ? 'video' : 'phone';

  return (
    <View style={styles.root}>
      <StatusBar
        barStyle="light-content"
        backgroundColor="transparent"
        translucent
      />

      <LinearGradient
        colors={['#0F172A', '#1E293B', '#0B1220']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
      />

      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        {/* Header */}
        <View style={styles.header}>
          <IconButton
            icon="chevron-down"
            size={28}
            iconColor="rgba(255,255,255,0.85)"
            onPress={() => handleEnd('ended')}
            accessibilityLabel="Minimize call"
          />
          <View style={styles.headerCenter}>
            <Text style={styles.headerLabel}>{callTypeLabel}</Text>
            <Text style={styles.headerStatus}>{statusLabel}</Text>
          </View>
          <View style={styles.headerSpacer} />
        </View>

        {/* Main */}
        <View style={styles.main}>
          <View style={styles.avatarBlock}>
            {/* Pulse rings */}
            <Animated.View
              style={[styles.pulseRing, makePulseStyle(pulse1)]}
            />
            <Animated.View
              style={[styles.pulseRing, makePulseStyle(pulse2)]}
            />
            <Animated.View
              style={[styles.pulseRing, makePulseStyle(pulse3)]}
            />

            {/* Avatar */}
            <View style={styles.avatarShadow}>
              {callee.avatar ? (
                <Avatar.Image
                  size={148}
                  source={{ uri: callee.avatar }}
                />
              ) : (
                <LinearGradient
                  colors={['#6366F1', '#8B5CF6', '#EC4899']}
                  style={styles.avatarGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Text style={styles.avatarInitials}>
                    {getInitials(callee.name)}
                  </Text>
                </LinearGradient>
              )}
            </View>
          </View>

          <Text style={styles.calleeName} numberOfLines={2}>
            {callee.name}
          </Text>

          <View style={styles.subRow}>
            <MaterialCommunityIcons
              name={callIcon}
              size={16}
              color="rgba(255,255,255,0.7)"
            />
            <Text style={styles.subText}>{callTypeLabel}</Text>
            <View style={styles.dot} />
            <Text style={styles.subText}>{statusLabel}</Text>
          </View>
        </View>

        {/* Pre-call controls */}
        <View style={styles.preControls}>
          <PreCallButton
            icon={isMuted ? 'microphone-off' : 'microphone'}
            label={isMuted ? 'Muted' : 'Mute'}
            active={isMuted}
            onPress={toggleMute}
          />
          <PreCallButton
            icon={isSpeaker ? 'volume-high' : 'volume-medium'}
            label="Speaker"
            active={isSpeaker}
            onPress={toggleSpeaker}
          />
          {callType === 'video' && (
            <PreCallButton
              icon="video"
              label="Camera"
              active
              onPress={() => {}}
            />
          )}
        </View>

        {/* End call */}
        <View style={styles.endWrapper}>
          <Pressable
            onPress={() => handleEnd('ended')}
            style={({ pressed }) => [
              styles.endButton,
              pressed && { transform: [{ scale: 0.94 }] },
            ]}
            accessibilityLabel="End call"
          >
            <LinearGradient
              colors={['#EF4444', '#DC2626']}
              style={styles.endButtonGradient}
            >
              <MaterialCommunityIcons
                name="phone-hangup"
                size={34}
                color="#FFFFFF"
              />
            </LinearGradient>
          </Pressable>
          <Text style={styles.endLabel}>Tap to end</Text>
        </View>
      </SafeAreaView>
    </View>
  );
}

// ---------------- Sub Components ----------------
function PreCallButton({
  icon,
  label,
  active,
  onPress,
}: {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  label: string;
  active?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.preBtn,
        active && styles.preBtnActive,
        pressed && { opacity: 0.7 },
      ]}
    >
      <MaterialCommunityIcons
        name={icon}
        size={24}
        color={active ? '#0F172A' : '#FFFFFF'}
      />
      <Text
        style={[
          styles.preBtnLabel,
          { color: active ? '#0F172A' : 'rgba(255,255,255,0.85)' },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

// ---------------- Utils ----------------
function getInitials(name: string): string {
  return (name || '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p.charAt(0).toUpperCase())
    .join('');
}

// ---------------- Styles ----------------
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0F172A' },
  safeArea: { flex: 1, paddingHorizontal: 20 },

  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  headerStatus: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    marginTop: 2,
  },
  headerSpacer: { width: 48 },

  main: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 30,
  },

  avatarBlock: {
    width: 260,
    height: 260,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
  },
  pulseRing: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 2,
    borderColor: 'rgba(99, 102, 241, 0.7)',
  },
  avatarShadow: {
    borderRadius: 80,
    ...Platform.select({
      ios: {
        shadowColor: '#6366F1',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.5,
        shadowRadius: 20,
      },
      android: { elevation: 14 },
    }),
  },
  avatarGradient: {
    width: 148,
    height: 148,
    borderRadius: 74,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    color: '#FFFFFF',
    fontSize: 52,
    fontWeight: '700',
    letterSpacing: 1,
  },

  calleeName: {
    color: '#FFFFFF',
    fontSize: 30,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: -0.5,
    maxWidth: '90%',
  },
  subRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: 8,
  },
  subText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    fontWeight: '500',
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.4)',
  },

  preControls: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 14,
    marginBottom: 36,
  },
  preBtn: {
    width: 76,
    height: 76,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  preBtnActive: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
  },
  preBtnLabel: {
    fontSize: 11,
    fontWeight: '600',
  },

  endWrapper: {
    alignItems: 'center',
    paddingBottom: 20,
  },
  endButton: {
    width: 78,
    height: 78,
    borderRadius: 39,
    ...Platform.select({
      ios: {
        shadowColor: '#DC2626',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.55,
        shadowRadius: 16,
      },
      android: { elevation: 12 },
    }),
  },
  endButtonGradient: {
    flex: 1,
    borderRadius: 39,
    alignItems: 'center',
    justifyContent: 'center',
  },
  endLabel: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    marginTop: 12,
    letterSpacing: 0.5,
    fontWeight: '500',
  },
});