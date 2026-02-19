import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import { CometChatSettings } from '../CometChatSettings';
import { mergeBuilderSettings } from '../utils/settingsUtils';

interface CometChatContextInterface {
  chatFeatures: CometChatSettingsInterface['chatFeatures'];
  callFeatures: CometChatSettingsInterface['callFeatures'];
  styleFeatures: CometChatSettingsInterface['style'];
  layoutFeatures: CometChatSettingsInterface['layout'];
  noCodeFeatures: CometChatSettingsInterface['noCode'];
  aiAgentFeatures: CometChatSettingsInterface['agent'];
  setChatFeatures: React.Dispatch<React.SetStateAction<CometChatSettingsInterface['chatFeatures']>>;
  setCallFeatures: React.Dispatch<React.SetStateAction<CometChatSettingsInterface['callFeatures']>>;
  setStyleFeatures: React.Dispatch<React.SetStateAction<CometChatSettingsInterface['style']>>;
  setLayoutFeatures: React.Dispatch<React.SetStateAction<CometChatSettingsInterface['layout']>>;
  setNoCodeFeatures: React.Dispatch<React.SetStateAction<CometChatSettingsInterface['noCode']>>;
  setAiAgentFeatures: React.Dispatch<React.SetStateAction<CometChatSettingsInterface['agent']>>;
}

interface CometChatProviderProps {
  children: ReactNode;
  authBuilderSetting?: CometChatSettingsInterface;
}
const CometChatContext = createContext<CometChatContextInterface | undefined>(undefined);
const defaultAgentFeatures: CometChatSettingsInterface['agent'] = {
  chatHistory: true,
  newChat: true,
  agentIcon: '',
  showAgentIcon: true,
};

export const CometChatProvider: React.FC<CometChatProviderProps> = ({ children, authBuilderSetting }) => {
  const [chatFeatures, setChatFeatures] = useState<CometChatSettingsInterface['chatFeatures']>(
    CometChatSettings.chatFeatures
  );
  const [callFeatures, setCallFeatures] = useState<CometChatSettingsInterface['callFeatures']>(
    CometChatSettings.callFeatures
  );
  const [styleFeatures, setStyleFeatures] = useState<CometChatSettingsInterface['style']>(CometChatSettings.style);
  const [layoutFeatures, setLayoutFeatures] = useState<CometChatSettingsInterface['layout']>(CometChatSettings.layout);
  const [noCodeFeatures, setNoCodeFeatures] = useState<CometChatSettingsInterface['noCode']>(CometChatSettings.noCode);
  const [aiAgentFeatures, setAiAgentFeatures] = useState<CometChatSettingsInterface['agent']>(
    (CometChatSettings as CometChatSettingsInterface)?.agent ?? defaultAgentFeatures
  );
  useEffect(() => {
    if (authBuilderSetting) {
      // Merge API settings with defaults to ensure all required keys are present
      const mergedSettings = mergeBuilderSettings(authBuilderSetting, CometChatSettings);
      const { chatFeatures, callFeatures, layout, style, noCode, agent } = mergedSettings;
      setChatFeatures(chatFeatures);
      setCallFeatures(callFeatures);
      setStyleFeatures(style);
      setLayoutFeatures(layout);
      setNoCodeFeatures(noCode);
      setAiAgentFeatures(agent);
    }
  }, [authBuilderSetting]);

  return (
    <CometChatContext.Provider
      value={{
        chatFeatures,
        callFeatures,
        styleFeatures,
        layoutFeatures,
        noCodeFeatures,
        aiAgentFeatures,
        setChatFeatures,
        setCallFeatures,
        setStyleFeatures,
        setLayoutFeatures,
        setNoCodeFeatures,
        setAiAgentFeatures,
      }}
    >
      {children}
    </CometChatContext.Provider>
  );
};

export const useCometChatContext = () => {
  const context = useContext(CometChatContext);
  if (!context) throw new Error('useCometChatContext must be used within a CometChatProvider');
  return context;
};

export interface CometChatSettingsInterface {
  chatFeatures: {
    coreMessagingExperience: {
      typingIndicator: boolean;
      threadConversationAndReplies: boolean;
      photosSharing: boolean;
      videoSharing: boolean;
      audioSharing: boolean;
      fileSharing: boolean;
      editMessage: boolean;
      deleteMessage: boolean;
      messageDeliveryAndReadReceipts: boolean;
      userAndFriendsPresence: boolean;
      conversationAndAdvancedSearch?: boolean;
      moderation?: boolean;
      quotedReplies?: boolean;
      markAsUnread?: boolean;
    };
    deeperUserEngagement: {
      mentions: boolean;
      mentionAll?: boolean;
      reactions: boolean;
      messageTranslation: boolean;
      polls: boolean;
      collaborativeWhiteboard: boolean;
      collaborativeDocument: boolean;
      voiceNotes: boolean;
      emojis: boolean;
      stickers: boolean;
      userInfo: boolean;
      groupInfo: boolean;
    };
    aiUserCopilot: {
      conversationStarter: boolean;
      conversationSummary: boolean;
      smartReply: boolean;
    };
    userManagement?: {
      friendsOnly?: boolean;
    };
    groupManagement: {
      createGroup: boolean;
      addMembersToGroups: boolean;
      joinLeaveGroup: boolean;
      deleteGroup: boolean;
      viewGroupMembers: boolean;
    };
    moderatorControls: {
      kickUsers: boolean;
      banUsers: boolean;
      promoteDemoteMembers: boolean;
      reportMessage?: boolean;
    };
    privateMessagingWithinGroups: {
      sendPrivateMessageToGroupMembers: boolean;
    };
  };
  callFeatures: {
    voiceAndVideoCalling: {
      oneOnOneVoiceCalling: boolean;
      oneOnOneVideoCalling: boolean;
      groupVideoConference: boolean;
      groupVoiceConference: boolean;
    };
  };
  layout: {
    withSideBar: boolean;
    tabs: string[];
    chatType: string;
  };
  style: {
    theme: string;
    color: {
      brandColor: string;
      primaryTextLight: string;
      primaryTextDark: string;
      secondaryTextLight: string;
      secondaryTextDark: string;
    };
    typography: {
      font: string;
      size: string;
    };
  };
  noCode?: {
    docked: boolean;
    styles: {
      buttonBackGround: string;
      buttonShape: string;
      openIcon: string;
      closeIcon: string;
      customJs: string;
      customCss: string;
      dockedAlignment?: string;
    };
  };
  agent?: {
    chatHistory: boolean;
    newChat: boolean;
    agentIcon: string;
    showAgentIcon: boolean;
  };
}

// THIS IS FOR THE USER & PRODUCT IDENTIFICATION FOR RUNNABLE APP, DO NOT DELETE

interface CometChatVisualBuilderReact {
  name: string;
  version: string;
}

declare global {
  interface Window {
    CometChatVisualBuilderReact: CometChatVisualBuilderReact;
  }
}

let chatBuilderName = 'cometchat-visual-builder-react';
let chatBuilderVersion = '1.0.22';

(async () => {
  try {
    const pkg = await import('../../../package.json');
    chatBuilderName = pkg?.default?.cometChatCustomConfig.name ?? chatBuilderName;
    chatBuilderVersion = pkg?.default?.cometChatCustomConfig.version ?? chatBuilderVersion;
  } catch (e) {
    // fallback silently
  }

  if (typeof window !== 'undefined') {
    window.CometChatVisualBuilderReact = {
      name: chatBuilderName,
      version: chatBuilderVersion,
    };
  }
})();
