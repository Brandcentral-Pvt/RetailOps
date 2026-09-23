/**
 * Call history recording helper.
 *
 * Builds a CallSession for a completed call and adds it to the
 * persisted call history (deduped by call id so a call that ends
 * through multiple code paths is only recorded once).
 */
import { useCallStore } from '../store/callStore';
import type {
  CallDirection,
  CallParticipant,
  CallSession,
  CallType,
} from '../types';

interface RecordCallInput {
  callId: string;
  conversationId?: string;
  caller: CallParticipant;
  callee: CallParticipant;
  type: CallType;
  direction: CallDirection;
  startedAt: string;
  duration?: number;
  endReason?: CallSession['endReason'];
}

export function recordCallInHistory(input: RecordCallInput): void {
  const { callHistory, addCallToHistory } = useCallStore.getState();

  if (callHistory.some((call) => call.id === input.callId)) {
    return;
  }

  addCallToHistory({
    id: input.callId,
    conversationId: input.conversationId,
    caller: input.caller,
    callee: input.callee,
    type: input.type,
    direction: input.direction,
    status: 'ended',
    startedAt: input.startedAt,
    endedAt: new Date().toISOString(),
    duration: input.duration,
    endReason: input.endReason,
  });
}