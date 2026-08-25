import { CometChatUIKit, UIKitSettingsBuilder } from "@cometchat/chat-uikit-react";
import { apiClient } from "../../lib/api-client";
import { setupLocalization } from "../../CometChat/utils/utils";

/**
 * CONTRACT A: all CometChat credentials are minted server-side.
 *
 * GET /api/chat/token -> { success: true, data: { uid, authToken, appId, region } }
 *   - 200: session for the authenticated dashboard user (uid derived from their email)
 *   - 501: chat not configured on this server (handled gracefully by callers)
 *
 * No CometChat app id / auth-key literals may live anywhere in src/ - the UIKit
 * is initialized exclusively with the values returned here.
 */

// Memoized boot promise: fetch token -> UIKit.init -> resolve { uid, authToken }.
let readyPromise = null;

// Tracks "<appId>:<region>" already handed to CometChatUIKit.init() so retries
// never re-initialize the SDK with equivalent settings.
let initializedAppKey = null;

const getChatUnavailableMessage = (status) =>
  `Chat is not available (${status}). The messaging service may not be configured on this server yet.`;

async function fetchChatSession() {
  let payload;
  try {
    const res = await apiClient.get('/chat/token');
    payload = res?.data;
  } catch (err) {
    const status = err?.response?.status;
    const detail = err?.response?.data?.error || err?.response?.data?.message;
    if (status === 501) {
      // Backend explicitly reports chat is not configured - explain, don't crash.
      throw new Error(
        detail ||
          'Chat is not configured on this server yet. Please contact your administrator.',
        { cause: err }
      );
    }
    throw new Error(detail || getChatUnavailableMessage(status ?? 'network error'), {
      cause: err,
    });
  }

  if (!payload?.success || !payload?.data) {
    throw new Error(payload?.message || getChatUnavailableMessage('invalid response'));
  }

  const { uid, authToken, appId, region } = payload.data;
  if (!appId || !region || !authToken) {
    throw new Error('Chat service returned incomplete configuration.');
  }
  return { uid, authToken, appId, region };
}

async function bootstrap() {
  const session = await fetchChatSession();

  const appKey = `${session.appId}:${session.region}`;
  if (initializedAppKey !== appKey) {
    // Server-provided values only - never a locally stored secret.
    const uiKitSettings = new UIKitSettingsBuilder()
      .setAppId(session.appId)
      .setRegion(session.region)
      .subscribePresenceForAllUsers()
      .build();

    await CometChatUIKit.init(uiKitSettings);
    setupLocalization();
    initializedAppKey = appKey;
  }

  return session;
}

/**
 * Ensures the CometChat UIKit is initialized with server-provided config.
 * Resolves with the session ({ uid, authToken }) once ready; rejects with an
 * explanatory Error (e.g. 501 not-configured) that callers can render safely.
 */
export const ensureCometChatReady = () => {
  if (!readyPromise) {
    readyPromise = bootstrap().catch((err) => {
      // Allow a later retry after any failure.
      readyPromise = null;
      throw err;
    });
  }
  return readyPromise;
};

/** Clears the memoized boot result so the next call re-fetches everything. */
export const resetCometChatInit = () => {
  readyPromise = null;
};
