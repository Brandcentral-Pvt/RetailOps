/**
 * Call store (zustand) — WebRTC call state, history, and signaling actions.
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { CallSession, CallStatus, CallType, CallDirection, IncomingCallData } from '../types';

interface CallState {
  // Current call
  currentCall: CallSession | null;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;

  // Call history
  callHistory: CallSession[];
  maxHistory: number;

  // Incoming call handling
  pendingIncomingCall: IncomingCallData | null;

  // Actions
  setCurrentCall: (call: CallSession | null) => void;
  updateCallStatus: (status: CallStatus, extra?: Partial<CallSession>) => void;
  setLocalStream: (stream: MediaStream | null) => void;
  setRemoteStream: (stream: MediaStream | null) => void;

  // Incoming call
  setPendingIncomingCall: (call: IncomingCallData | null) => void;
  clearPendingIncomingCall: () => void;

  // History
  addCallToHistory: (call: CallSession) => void;
  clearHistory: () => void;

  // Reset
  reset: () => void;
}

const DEFAULT_MAX_HISTORY = 100;

export const useCallStore = create<CallState>()(
  persist(
    (set, get) => ({
      currentCall: null,
      localStream: null,
      remoteStream: null,
      callHistory: [],
      maxHistory: DEFAULT_MAX_HISTORY,
      pendingIncomingCall: null,

      setCurrentCall: (call) => set({ currentCall: call }),

      updateCallStatus: (status, extra) =>
        set((state) => ({
          currentCall: state.currentCall
            ? { ...state.currentCall, status, ...extra }
            : null,
        })),

      setLocalStream: (stream) => set({ localStream: stream }),
      setRemoteStream: (stream) => set({ remoteStream: stream }),

      setPendingIncomingCall: (call) => set({ pendingIncomingCall: call }),
      clearPendingIncomingCall: () => set({ pendingIncomingCall: null }),

      addCallToHistory: (call) =>
        set((state) => {
          const history = [call, ...state.callHistory].slice(0, state.maxHistory);
          return { callHistory: history };
        }),

      clearHistory: () => set({ callHistory: [] }),

      reset: () =>
        set({
          currentCall: null,
          localStream: null,
          remoteStream: null,
          pendingIncomingCall: null,
        }),
    }),
    {
      name: 'retailops-call-storage',
      storage: createJSONStorage(() => ({
        getItem: async (name) => {
          try {
            const { getJson } = await import('../services/storage');
            return getJson(name);
          } catch {
            return null;
          }
        },
        setItem: async (name, value) => {
          try {
            const { setJson } = await import('../services/storage');
            await setJson(name, value);
          } catch { }
        },
        removeItem: async (name) => {
          try {
            const { removeItems } = await import('../services/storage');
            await removeItems([name]);
          } catch { }
        },
      })),
      partialize: (state) => ({
        callHistory: state.callHistory,
        maxHistory: state.maxHistory,
      }),
    }
  )
);

export default useCallStore;