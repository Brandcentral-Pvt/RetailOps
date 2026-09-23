/**
 * Active Call Screen — in-call controls (mute, speaker, flip camera, end).
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  Platform,
} from 'react-native';
import {
  Avatar,
  Button,
  Text,
  useTheme,
  IconButton,
} from 'react-native-paper';
import { RTCView } from 'react-native-webrtc';
import { useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { callService } from '../../services/callService';
import { useCallStore } from '../../store/callStore';
import { useAuthStore } from '../../store/authStore';
import { sendCallSignal } from '../../services/socketService';
import { recordCallInHistory } from '../../utils/callHistory';
import type { CallsStackParamList } from '../../types';

type Props = NativeStackScreenProps<CallsStackParamList, 'ActiveCall'>;

export default function ActiveCallScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const route = useRoute<Props['route']>();
  const { callId, otherParticipant, callType, isIncoming } = route.params;

  const myId = useAuthStore((s) => s.user?.id ?? s.user?._id ?? '');
  const {
    currentCall,
    localStream,
    remoteStream,
    setCurrentCall,
    updateCallStatus,
    setLocalStream,
    setRemoteStream,
  } = useCallStore();

  const [muted, setMuted] = useState(false);
  const [speakerOn, setSpeakerOn] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(callType === 'video');
  const [frontCamera, setFrontCamera] = useState(true);
  const [callDuration, setCallDuration] = useState(0);

  const durationRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(Date.now());

  useEffect(() => {
    // Start call timer
    startTimeRef.current = Date.now();
    durationRef.current = setInterval(() => {
      setCallDuration(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);

    // Ensure peer connection is set up
    const pc = callService.createPeerConnection(callId, {
      isInitiator: !isIncoming,
      callType,
      onLocalStream: setLocalStream,
      onRemoteStream: setRemoteStream,
      onCallEnded: (reason) => handleEnd(reason),
    });

    return () => {
      clearInterval(durationRef.current!);
    };
  }, [callId, callType, isIncoming]);

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleMuteToggle = () => {
    const newMuted = !muted;
    setMuted(newMuted);
    callService.setAudioEnabled(callId, !newMuted);
  };

  const handleSpeakerToggle = () => {
    const newSpeaker = !speakerOn;
    setSpeakerOn(newSpeaker);
    callService.setSpeaker(callId, newSpeaker);
  };

  const handleVideoToggle = () => {
    const newVideoEnabled = !videoEnabled;
    setVideoEnabled(newVideoEnabled);
    callService.setVideoEnabled(callId, newVideoEnabled);
  };

  const handleFlipCamera = async () => {
    const newFront = !frontCamera;
    setFrontCamera(newFront);
    await callService.switchCamera(callId);
  };

  const handleEnd = (reason: 'ended' | 'rejected' | 'missed' | 'failed' | 'busy' = 'ended') => {
    clearInterval(durationRef.current!);
    callService.endCall(callId, reason);
    sendCallSignal('call:end', { callId, reason });

    const me = { _id: myId, name: 'You', avatar: undefined };
    recordCallInHistory({
      callId,
      conversationId: currentCall?.conversationId,
      caller: isIncoming ? otherParticipant : me,
      callee: isIncoming ? me : otherParticipant,
      type: callType,
      direction: isIncoming ? 'incoming' : 'outgoing',
      startedAt: currentCall?.startedAt ?? new Date(startTimeRef.current).toISOString(),
      duration: callDuration,
      endReason: reason,
    });

    navigation.goBack();
  };

  return (
    <View style={[styles.screen, { backgroundColor: '#000' }]}>
      {/* Remote Video / Avatar */}
      <View style={styles.remoteContainer}>
        {callType === 'video' && remoteStream ? (
          <RTCView
            style={styles.remoteVideo}
            streamURL={remoteStream.toURL()}
            objectFit="cover"
          />
        ) : (
          <View style={styles.remotePlaceholder}>
            <Avatar.Image
              size={100}
              source={otherParticipant.avatar ? { uri: otherParticipant.avatar } : undefined}
            >
              {otherParticipant.name.charAt(0).toUpperCase()}
            </Avatar.Image>
            <Text style={styles.remoteName} variant="headlineMedium">
              {otherParticipant.name}
            </Text>
          </View>
        )}
      </View>

      {/* Local Preview (PiP) */}
      {callType === 'video' && localStream && (
        <View style={styles.localPreview}>
          <RTCView
            style={styles.localVideo}
            streamURL={localStream.toURL()}
            objectFit="cover"
          />
        </View>
      )}

      {/* Call Info */}
      <View style={styles.infoOverlay}>
        <Text style={styles.callStatus} variant="titleMedium">
          {callType === 'video' ? '📹 Video' : '📞 Voice'}
        </Text>
        <Text style={styles.callDuration} variant="headlineLarge">
          {formatDuration(callDuration)}
        </Text>
      </View>

      {/* Controls */}
      <View style={styles.controlsContainer}>
        <View style={styles.controlRow}>
          <IconButton
            icon={muted ? 'microphone-off' : 'microphone'}
            size={28}
            onPress={handleMuteToggle}
            iconColor={colors.onSurface}
            style={[
              styles.controlButton,
              muted && styles.controlButtonActive,
            ]}
            rippleColor={colors.primary}
          />

          <IconButton
            icon={speakerOn ? 'volume-high' : 'volume-off'}
            size={28}
            onPress={handleSpeakerToggle}
            iconColor={colors.onSurface}
            style={[
              styles.controlButton,
              speakerOn && styles.controlButtonActive,
            ]}
            rippleColor={colors.primary}
          />

          {callType === 'video' && (
            <IconButton
              icon={videoEnabled ? 'videocam' : 'videocam-off'}
              size={28}
              onPress={handleVideoToggle}
              iconColor={colors.onSurface}
              style={[
                styles.controlButton,
                !videoEnabled && styles.controlButtonActive,
              ]}
              rippleColor={colors.primary}
            />
          )}

          {callType === 'video' && (
            <IconButton
              icon="camera-flip"
              size={28}
              onPress={handleFlipCamera}
              iconColor={colors.onSurface}
              style={styles.controlButton}
              rippleColor={colors.primary}
            />
          )}

          <IconButton
            icon="phone-hangup"
            size={32}
            onPress={() => handleEnd('ended')}
            iconColor="#FFFFFF"
            style={styles.endButton}
            color="#FFFFFF"
            rippleColor="#FF3B30"
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  remoteContainer: {
    flex: 1,
    position: 'relative',
  },
  remoteVideo: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  remotePlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
  },
  remoteName: {
    color: '#FFFFFF',
    marginTop: 16,
    fontWeight: '500',
  },
  localPreview: {
    position: 'absolute',
    top: 60,
    right: 16,
    width: 120,
    height: 160,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#333',
  },
  localVideo: {
    width: '100%',
    height: '100%',
  },
  infoOverlay: {
    position: 'absolute',
    bottom: 200,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  callStatus: {
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 4,
  },
  callDuration: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 32,
  },
  controlsContainer: {
    paddingBottom: 40,
    paddingHorizontal: 24,
  },
  controlRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 24,
  },
  controlButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  controlButtonActive: {
    backgroundColor: '#2563EB',
  },
  endButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FF3B30',
  },
});