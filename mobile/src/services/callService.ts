/**
 * CallService — WebRTC peer connection management.
 * Handles: createOffer, createAnswer, ICE candidates, media streams, call lifecycle.
 */
import {
  mediaDevices,
  RTCPeerConnection,
  RTCSessionDescription,
  RTCIceCandidate,
  MediaStream,
  MediaStreamTrack,
  registerGlobals,
} from 'react-native-webrtc';

import { useCallStore } from '../store/callStore';
import { chatApiService } from './chatApiService';
import { setSpeakerphone } from '../native/CallAudio';
import type { CallSession, CallType, CallDirection, CallSignalPayload } from '../types';

// Register WebRTC globals for React Native
registerGlobals();

// TURN/STUN servers - configure with your TURN server
const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  // Add your TURN server here:
  // {
  //   urls: 'turn:your-turn-server.com:3478',
  //   username: 'your-username',
  //   credential: 'your-password',
  // },
];

interface CallServiceInstance {
  peerConnection: RTCPeerConnection | null;
  callId: string | null;
  isInitiator: boolean;
  callType: CallType;
  onLocalStream: (stream: MediaStream) => void;
  onRemoteStream: (stream: MediaStream) => void;
  onCallEnded: (reason: CallSession['endReason']) => void;
  onConnectionStateChange: (state: RTCPeerConnectionState) => void;
}

class CallService {
  private instances: Map<string, CallServiceInstance> = new Map();

  /**
   * Create a new peer connection for a call.
   */
  createPeerConnection(callId: string, config: Partial<CallServiceInstance>): RTCPeerConnection {
    const pc = new RTCPeerConnection({
      iceServers: ICE_SERVERS,
      sdpSemantics: 'unified-plan',
    });

    const instance: CallServiceInstance = {
      peerConnection: pc,
      callId,
      isInitiator: config.isInitiator ?? false,
      callType: config.callType ?? 'audio',
      onLocalStream: config.onLocalStream ?? (() => {}),
      onRemoteStream: config.onRemoteStream ?? (() => {}),
      onCallEnded: config.onCallEnded ?? (() => {}),
      onConnectionStateChange: config.onConnectionStateChange ?? (() => {}),
    };

    this.instances.set(callId, instance);

    // ICE candidate handler
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.sendIceCandidate(callId, event.candidate);
      }
    };

    // Connection state changes
    pc.onconnectionstatechange = () => {
      instance.onConnectionStateChange(pc.connectionState);
      if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        instance.onCallEnded('failed');
        this.cleanup(callId);
      }
    };

    // Track remote stream
    pc.ontrack = (event) => {
      const [remoteStream] = event.streams;
      if (remoteStream) {
        instance.onRemoteStream(remoteStream);
        useCallStore.getState().setRemoteStream(remoteStream);
      }
    };

    return pc;
  }

  /**
   * Get user media (camera/microphone).
   */
  async getUserMedia(callType: CallType): Promise<MediaStream> {
    const constraints = {
      audio: true,
      video: callType === 'video' ? { facingMode: 'user' } : false,
    };

    const stream = await mediaDevices.getUserMedia(constraints);
    useCallStore.getState().setLocalStream(stream);
    return stream;
  }

  /**
   * Create and send offer (outgoing call).
   */
  async createOffer(callId: string, callType: CallType): Promise<RTCSessionDescriptionInit> {
    const instance = this.instances.get(callId);
    if (!instance?.peerConnection) throw new Error('Peer connection not found');

    const stream = await this.getUserMedia(callType);
    stream.getTracks().forEach((track) => {
      instance.peerConnection?.addTrack(track, stream);
    });

    const offer = await instance.peerConnection.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: callType === 'video',
    });

    await instance.peerConnection.setLocalDescription(offer);
    // Offer may resolve as a plain { type, sdp } object (no toJSON method).
    return { type: offer.type, sdp: offer.sdp };
  }

  /**
   * Create and send answer (incoming call).
   */
  async createAnswer(callId: string, callType: CallType, offer: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit> {
    const instance = this.instances.get(callId);
    if (!instance?.peerConnection) throw new Error('Peer connection not found');

    const stream = await this.getUserMedia(callType);
    stream.getTracks().forEach((track) => {
      instance.peerConnection?.addTrack(track, stream);
    });

    await instance.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));

    const answer = await instance.peerConnection.createAnswer();
    await instance.peerConnection.setLocalDescription(answer);
    // Answer may resolve as a plain { type, sdp } object (no toJSON method).
    return { type: answer.type, sdp: answer.sdp };
  }

  /**
   * Handle incoming answer (outgoing call side).
   */
  async handleAnswer(callId: string, answer: RTCSessionDescriptionInit): Promise<void> {
    const instance = this.instances.get(callId);
    if (!instance?.peerConnection) throw new Error('Peer connection not found');

    await instance.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
  }

  /**
   * Add ICE candidate.
   */
  async addIceCandidate(callId: string, candidate: RTCIceCandidateInit): Promise<void> {
    const instance = this.instances.get(callId);
    if (!instance?.peerConnection) return;

    try {
      await instance.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (error) {
      console.warn('ICE candidate error:', error);
    }
  }

  /**
   * Send ICE candidate via signaling.
   */
  private sendIceCandidate(callId: string, candidate: RTCIceCandidate): void {
    const payload: CallSignalPayload = {
      callId,
      candidate: {
        candidate: candidate.candidate,
        sdpMid: candidate.sdpMid,
        sdpMLineIndex: candidate.sdpMLineIndex,
      },
    };
    // This will be called via socket service
    this.emitSignal('call:ice', payload);
  }

  /**
   * Send offer/answer via signaling.
   */
  async sendSignal(type: 'call:invite' | 'call:answer', payload: CallSignalPayload): Promise<void> {
    this.emitSignal(type, payload);
  }

  /**
   * End call and cleanup.
   */
  endCall(callId: string, reason: CallSession['endReason'] = 'ended'): void {
    const instance = this.instances.get(callId);
    if (!instance) return;

    // Stop all tracks
    instance.peerConnection?.getSenders().forEach((sender) => {
      sender.track?.stop();
    });

    instance.peerConnection?.close();
    this.instances.delete(callId);

    useCallStore.getState().setLocalStream(null);
    useCallStore.getState().setRemoteStream(null);
    useCallStore.getState().setCurrentCall(null);

    // Notify via signaling
    this.emitSignal('call:end', { callId, reason });
  }

  /**
   * Mute/unmute audio.
   */
  setAudioEnabled(callId: string, enabled: boolean): void {
    const instance = this.instances.get(callId);
    instance?.peerConnection?.getSenders().forEach((sender) => {
      if (sender.track?.kind === 'audio') {
        sender.track.enabled = enabled;
      }
    });
  }

  /**
   * Mute/unmute the call (outgoing pre-call toggle).
   */
  setMuted(callId: string, muted: boolean): void {
    this.setAudioEnabled(callId, !muted);
  }

  /**
   * Toggle speakerphone (Android native AudioManager via bridge).
   */
  setSpeaker(callId: string, on: boolean): void {
    setSpeakerphone(on);
  }

  /**
   * Enable/disable video.
   */
  setVideoEnabled(callId: string, enabled: boolean): void {
    const instance = this.instances.get(callId);
    instance?.peerConnection?.getSenders().forEach((sender) => {
      if (sender.track?.kind === 'video') {
        sender.track.enabled = enabled;
      }
    });
  }

  /**
   * Switch camera (front/back).
   */
  async switchCamera(callId: string): Promise<void> {
    const instance = this.instances.get(callId);
    if (!instance?.peerConnection) return;

    const senders = instance.peerConnection.getSenders();
    const videoSender = senders.find((s) => s.track?.kind === 'video');
    if (!videoSender) return;

    const stream = useCallStore.getState().localStream;
    if (!stream) return;

    const newTrack = stream.getVideoTracks()[0];
    if (newTrack) {
      await videoSender.replaceTrack(newTrack);
    }
  }

  /**
   * Get connection state.
   */
  getConnectionState(callId: string): RTCPeerConnectionState | null {
    return this.instances.get(callId)?.peerConnection?.connectionState ?? null;
  }

  /**
   * Cleanup specific call.
   */
  cleanup(callId: string): void {
    const instance = this.instances.get(callId);
    if (!instance) return;

    instance.peerConnection?.getSenders().forEach((sender) => sender.track?.stop());
    instance.peerConnection?.close();
    this.instances.delete(callId);
  }

  /**
   * Cleanup all calls.
   */
  cleanupAll(): void {
    this.instances.forEach((instance) => {
      instance.peerConnection?.getSenders().forEach((sender) => sender.track?.stop());
      instance.peerConnection?.close();
    });
    this.instances.clear();
  }

  // Signaling event emitter - to be connected to socket service
  private signalListeners: Map<string, Set<(payload: unknown) => void>> = new Map();

  onSignal(event: string, callback: (payload: unknown) => void): () => void {
    if (!this.signalListeners.has(event)) {
      this.signalListeners.set(event, new Set());
    }
    this.signalListeners.get(event)!.add(callback);
    return () => this.signalListeners.get(event)?.delete(callback);
  }

  emitSignal(event: string, payload: unknown): void {
    this.signalListeners.get(event)?.forEach((cb) => cb(payload));
  }

  // Backend API calls
  async getTurnCredentials(): Promise<{ urls: string; username: string; credential: string }[]> {
    try {
      const { data } = await chatApiService.getTurnCredentials();
      return data.credentials || ICE_SERVERS;
    } catch {
      return ICE_SERVERS;
    }
  }
}

export const callService = new CallService();
export default callService;