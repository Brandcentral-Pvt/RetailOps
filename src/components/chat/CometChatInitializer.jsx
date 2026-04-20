import React, { useEffect, useState } from 'react';
import { CometChatUIKit, UIKitSettingsBuilder } from "@cometchat/chat-uikit-react";
import { setupLocalization } from "../../CometChat/utils/utils";
import { CometChatProvider } from "../../CometChat/context/CometChatContext";

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

const CometChatInitializer = ({ children }) => {
  useEffect(() => {
    CometChatUIKit.init(uiKitSettings)
      .then(() => {
        setupLocalization();
        console.log("CometChat initialized successfully asychronously");
      })
      .catch(err => {
        console.error("CometChat initialization failed:", err);
      });
  }, []);

  return <>{children}</>;
};

export default CometChatInitializer;
