import { apiClient } from '../lib/api-client';
import { type ApiEnvelope, legacyRequest } from './legacyCompat';

/**
 * security API — migrated off the legacy fetch stack in services/api.js
 * (Increment 1). Signature and return shape preserved exactly; requests now
 * flow through apiClient (Bearer auto-inject + silent-refresh on 401).
 *
 * Legacy contract: resolves with the FULL `{ success, data, ... }` envelope
 * (ActivityLog also reads `res.total` / `res.stats`) and rejects with a plain
 * `Error(message)`.
 */

export interface OtpLogItem {
  Id?: string | number;
  Action?: string;
  Email?: string;
  CreatedAt?: string;
  [key: string]: unknown;
}

export interface OtpLogsEnvelope extends ApiEnvelope<OtpLogItem[]> {
  total?: number;
  stats?: Record<string, unknown>;
}

export const securityApi = {
  /** GET /security/otp-logs — paged OTP audit trail with aggregate stats. */
  getOtpLogs: async (params: Record<string, unknown> = {}): Promise<OtpLogsEnvelope> =>
    legacyRequest<OtpLogItem[]>(() =>
      apiClient.get<OtpLogsEnvelope>('/security/otp-logs', { params })
    ),
};
