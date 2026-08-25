import React from 'react';
import { CometChatProvider } from "../../CometChat/context/CometChatContext";

/**
 * App-shell wrapper that keeps the vendored chat UI context available.
 *
 * CometChat is NOT initialized here anymore: appId/region/authToken are minted
 * per-user by the backend (GET /api/chat/token) and consumed lazily via
 * ensureCometChatReady() (see ./cometChatBootstrap.js) when the chat page
 * mounts. No CometChat app id / auth-key literals live in client source.
 */
const CometChatInitializer = ({ children }) => (
  <CometChatProvider>{children}</CometChatProvider>
);

export default CometChatInitializer;
