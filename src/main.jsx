import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom';
import 'bootstrap/dist/css/bootstrap.min.css';
import './index.css'
import App from './App.jsx'
import "@cometchat/chat-uikit-react/css-variables.css";
import { CometChatUIKit, UIKitSettingsBuilder } from "@cometchat/chat-uikit-react";
import { setupLocalization } from "./CometChat/utils/utils";
import { CometChatProvider } from "./CometChat/context/CometChatContext";

export const COMETCHAT_CONSTANTS = {
  APP_ID: "1675623ba4da04e9e",
  REGION: "in",
  AUTH_KEY: "6a2c1e0c3a6a367dc9ed2056631ad2523ba69622",
};

const uiKitSettings = new UIKitSettingsBuilder()
  .setAppId(COMETCHAT_CONSTANTS.APP_ID)
  .setRegion(COMETCHAT_CONSTANTS.REGION)
  .setAuthKey(COMETCHAT_CONSTANTS.AUTH_KEY)
  .subscribePresenceForAllUsers()
  .build();

CometChatUIKit.init(uiKitSettings)?.then(() => {
  setupLocalization();
  createRoot(document.getElementById('root')).render(
    <BrowserRouter>
      <CometChatProvider>
        <App />
      </CometChatProvider>
    </BrowserRouter>,
  )
}).catch(err => {
  console.error("CometChat initialization failed:", err);
  // Fallback to normal render if initialization fails
  createRoot(document.getElementById('root')).render(
    <BrowserRouter>
      <App />
    </BrowserRouter>,
  )
});
