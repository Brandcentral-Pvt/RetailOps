
/**
 * Active Call Screen — in-call controls (mute, speaker, flip camera, end).
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
} from 'react-native';
import {
  Avatar,
  Text,
  useTheme,
  IconButton,
} from 'react-native-paper';
import { RTCView } from 'react-native-webrtc';
import { useRoute } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { callService } from '../../services/callService';
import { useCallStore } from '../../store/callStore';
import { useAuthStore } from '../../store/authStore';
import { sendCallSignal } from '../../services/socketService';
import { recordCallInHistory } from '../../utils/callHistory';
import type { CallsStackParamList } from '../../types';

type Props = NativeStackScreenProps<CallsStackParamList, 'ActiveCall'>;

type EndReason =
  | 'ended'
  | 'rejected'
  | 'missed'
  | 'failed'
  | 'busy';

export default function ActiveCallScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const route = useRoute<Props['route']>();

  const {
    callId,
    otherParticipant,
    callType,
    isIncoming,
  } = route.params;

  const myId = useAuthStore(
    (s) => s.user?.id ?? s.user?._id ?? '',
  );

  const {
    currentCall,
    localStream,
    remoteStream,
    setLocalStream,
    setRemoteStream,
  } = useCallStore();

  const [muted, setMuted] = useState(false);
  const [speakerOn, setSpeakerOn] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(
    callType === 'video',
  );
  const [frontCamera, setFrontCamera] = useState(true);
  const [callDuration, setCallDuration] = useState(0);

  const durationRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(Date.now());
  const endingRef = useRef(false);

  /**
   * Start timer and initialise WebRTC connection.
   */
  useEffect(() => {
    startTimeRef.current = Date.now();
    setCallDuration(0);

    durationRef.current = setInterval(() => {
      setCallDuration(
        Math.floor(
          (Date.now() - startTimeRef.current) / 1000,
        ),
      );
    }, 1000);

    const pc = callService.createPeerConnection(callId, {
      isInitiator: !isIncoming,
      callType,
      onLocalStream: setLocalStream,
      onRemoteStream: setRemoteStream,
      onCallEnded: (reason: EndReason) => {
        handleEnd(reason);
      },
    });

    return () => {
      if (durationRef.current) {
        clearInterval(durationRef.current);
        durationRef.current = null;
      }

      // Prevent an old peer connection from affecting a new call.
      if (pc && typeof pc.close === 'function') {
        try {
          pc.close();
        } catch {
          // Ignore already-closed peer connection.
        }
      }
    };
  }, [
    callId,
    callType,
    isIncoming,
    setLocalStream,
    setRemoteStream,
  ]);

  /**
   * Format call duration as MM:SS.
   */
  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;

    return `${mins}:${secs
      .toString()
      .padStart(2, '0')}`;
  };

  /**
   * Mute / unmute microphone.
   */
  const handleMuteToggle = () => {
    const newMuted = !muted;

    setMuted(newMuted);
    callService.setAudioEnabled(callId, !newMuted);
  };

  /**
   * Toggle speaker output.
   */
  const handleSpeakerToggle = () => {
    const newSpeaker = !speakerOn;

    setSpeakerOn(newSpeaker);
    callService.setSpeaker(callId, newSpeaker);
  };

  /**
   * Enable / disable local video.
   */
  const handleVideoToggle = () => {
    const newVideoEnabled = !videoEnabled;

    setVideoEnabled(newVideoEnabled);
    callService.setVideoEnabled(
      callId,
      newVideoEnabled,
    );
  };

  /**
   * Switch front / rear camera.
   */
  const handleFlipCamera = async () => {
    try {
      await callService.switchCamera(callId);
      setFrontCamera((current) => !current);
    } catch (error) {
      console.error(
        '[ActiveCall] Failed to switch camera:',
        error,
      );
    }
  };

  /**
   * End the call and save it to call history.
   */
  const handleEnd = (
    reason: EndReason = 'ended',
  ) => {
    // Prevent duplicate end events.
    if (endingRef.current) {
      return;
    }

    endingRef.current = true;

    if (durationRef.current) {
      clearInterval(durationRef.current);
      durationRef.current = null;
    }

    try {
      callService.endCall(callId, reason);
    } catch (error) {
      console.error(
        '[ActiveCall] Failed to end call:',
        error,
      );
    }

    try {
      sendCallSignal('call:end', {
        callId,
        reason,
      });
    } catch (error) {
      console.error(
        '[ActiveCall] Failed to send end signal:',
        error,
      );
    }

    /**
     * Current user representation.
     */
    const me = {
      _id: myId,
      name: 'You',
      avatar: undefined,
    };

    /**
     * Record call history.
     */
    try {
      recordCallInHistory({
        callId,
        conversationId: currentCall?.conversationId,
        caller: isIncoming
          ? otherParticipant
          : me,
        callee: isIncoming
          ? me
          : otherParticipant,
        type: callType,
        direction: isIncoming
          ? 'incoming'
          : 'outgoing',
        startedAt:
          currentCall?.startedAt ??
          new Date(
            startTimeRef.current,
          ).toISOString(),
        duration: callDuration,
        endReason: reason,
      });
    } catch (error) {
      console.error(
        '[ActiveCall] Failed to record call history:',
        error,
      );
    }

    navigation.goBack();
  };

  return (
    <View style={styles.screen}>
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
              source={
                otherParticipant.avatar
                  ? { uri: otherParticipant.avatar }
                  : undefined
              }
            />

            {!otherParticipant.avatar && (
              <View style={styles.avatarFallback}>
                <Text style={styles.avatarFallbackText}>
                  {otherParticipant.name
                    .charAt(0)
                    .toUpperCase()}
                </Text>
              </View>
            )}

            <Text
              style={styles.remoteName}
              variant="headlineMedium"
            >
              {otherParticipant.name}
            </Text>
          </View>
        )}
      </View>

      {/* Local Video Preview */}
      {callType === 'video' && localStream && (
        <View style={styles.localPreview}>
          <RTCView
            style={styles.localVideo}
            streamURL={localStream.toURL()}
            objectFit="cover"
          />
        </View>
      )}

      {/* Call Information */}
      <View style={styles.infoOverlay}>
        <Text
          style={styles.callStatus}
          variant="titleMedium"
        >
          {callType === 'video'
            ? '📹 Video'
            : '📞 Voice'}
        </Text>

        <Text
          style={styles.callDuration}
          variant="headlineLarge"
        >
          {formatDuration(callDuration)}
        </Text>
      </View>

      {/* Controls */}
      <View style={styles.controlsContainer}>
        <View style={styles.controlRow}>
          {/* Mute */}
          <IconButton
            icon={
              muted
                ? 'microphone-off'
                : 'microphone'
            }
            size={28}
            onPress={handleMuteToggle}
            iconColor="#FFFFFF"
            style={[
              styles.controlButton,
              muted && styles.controlButtonActive,
            ]}
            rippleColor="rgba(255,255,255,0.2)"
          />

          {/* Speaker */}
          <IconButton
            icon={
              speakerOn
                ? 'volume-high'
                : 'volume-off'
            }
            size={28}
            onPress={handleSpeakerToggle}
            iconColor="#FFFFFF"
            style={[
              styles.controlButton,
              speakerOn && styles.controlButtonActive,
            ]}
            rippleColor="rgba(255,255,255,0.2)"
          />

          {/* Video */}
          {callType === 'video' && (
            <IconButton
              icon={
                videoEnabled
                  ? 'video'
                  : 'video-off'
              }
              size={28}
              onPress={handleVideoToggle}
              iconColor="#FFFFFF"
              style={[
                styles.controlButton,
                !videoEnabled &&
                  styles.controlButtonActive,
              ]}
              rippleColor="rgba(255,255,255,0.2)"
            />
          )}

          {/* Flip Camera */}
          {callType === 'video' && (
            <IconButton
              icon="camera-flip"
              size={28}
              onPress={handleFlipCamera}
              iconColor="#FFFFFF"
              style={styles.controlButton}
              rippleColor="rgba(255,255,255,0.2)"
            />
          )}

          {/* End Call */}
          <IconButton
            icon="phone-hangup"
            size={32}
            onPress={() => handleEnd('ended')}
            iconColor="#FFFFFF"
            style={styles.endButton}
            rippleColor="rgba(255,255,255,0.3)"
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#000000',
  },

  remoteContainer: {
    flex: 1,
    position: 'relative',
    backgroundColor: '#000000',
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

  avatarFallback: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#2563EB',
  },

  avatarFallbackText: {
    color: '#FFFFFF',
    fontSize: 42,
    fontWeight: '600',
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
    borderColor: '#333333',
    backgroundColor: '#111111',
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
    backgroundColor: '#000000',
  },

  controlRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },

  controlButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.20)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  controlButtonActive: {
    backgroundColor: '#2563EB',
  },

  endButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#FF3B30',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
