/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useCallback, useEffect, useState } from 'react';
import '../../styles/CometChatCallLog/CometChatCallLogDetails.css';
import { CometChat } from '@cometchat/chat-sdk-javascript';
import { CometChatCallDetailsInfo } from './CometChatCallLogInfo';
import { CometChatCallDetailsParticipants } from './CometChatCallLogParticipants';
import { CometChatCallDetailsRecording } from './CometChatCallLogRecordings';
import { CometChatCallDetailsHistory } from './CometChatCallLogHistory';
import {
  CometChatCallButtons,
  CometChatListItem,
  CometChatUIKitConstants,
  CometChatUIKitLoginListener,
  getLocalizedString,
  MessageUtils,
} from '@cometchat/chat-uikit-react';
import { useCometChatContext } from '../../context/CometChatContext';

export const CometChatCallDetails = (props: { selectedItem: any; onBack?: () => void }) => {
  const { selectedItem, onBack } = props;
  const callDetailTabItems = [
    {
      id: 'participants',
      name: getLocalizedString('participants'),
    },
    {
      id: 'recording',
      name: getLocalizedString('recording'),
    },
    {
      id: 'history',
      name: getLocalizedString('history'),
    },
  ];
  const [activeTab, setActiveTab] = useState('participants');
  const [user, setUser] = useState<CometChat.User>();
  const [subtitleText, setSubtitleText] = useState<string>();
  const { callFeatures, chatFeatures } = useCometChatContext();

  function verifyCallUser(call: any, loggedInUser: CometChat.User) {
    if (call.getInitiator().getUid() === loggedInUser.getUid()) {
      return call.getReceiver();
    } else {
      return call.getInitiator();
    }
  }
  useEffect(() => {
    const isBlocked = new MessageUtils().getUserStatusVisible(user);
    const userListenerId = 'users_custom' + Date.now();
    if (isBlocked) {
      setSubtitleText('');
      return;
    }
    setSubtitleText(getLocalizedString(`call_logs_user_status_${user?.getStatus().toLowerCase()}`));
    CometChat.addUserListener(
      userListenerId,
      new CometChat.UserListener({
        onUserOnline: (onlineUser: CometChat.User) => {
          if (user?.getUid() === onlineUser.getUid()) {
            setSubtitleText(getLocalizedString(`call_logs_user_status_online`));
          }
        },
        onUserOffline: (offlineUser: CometChat.User) => {
          if (user?.getUid() === offlineUser?.getUid()) {
            setSubtitleText(getLocalizedString(`call_logs_user_status_offline`));
          }
        },
      })
    );
    return () => {
      CometChat.removeUserListener(userListenerId);
    };
  }, [user]);

  useEffect(() => {
    const loggedInUser = CometChatUIKitLoginListener.getLoggedInUser();
    const callUser = verifyCallUser(selectedItem, loggedInUser!);
    if (selectedItem.receiverType === CometChatUIKitConstants.MessageReceiverType.user) {
      CometChat.getUser(callUser.uid).then((response: CometChat.User) => {
        setUser(response);
      });
    }
  }, [selectedItem]);

  const getSubtitleView = useCallback(() => {
    return (
      <div className={`cometchat-call-log-details__subtitle`}>
        {chatFeatures && chatFeatures?.coreMessagingExperience?.userAndFriendsPresence ? subtitleText : ''}
      </div>
    );
  }, [subtitleText, chatFeatures]);

  function getTrailingView() {
    return (
      <div className={`cometchat-call-log-details__trailing-view`}>
        <CometChatCallButtons
          user={user!}
          key={'callbuttonsVCBSampleApp'}
          hideVideoCallButton={!callFeatures?.voiceAndVideoCalling?.oneOnOneVideoCalling}
          hideVoiceCallButton={!callFeatures?.voiceAndVideoCalling?.oneOnOneVoiceCalling}
        />
      </div>
    );
  }

  return (
    <div className="cometchat-call-log-details">
      <div className="cometchat-call-log-details__header">
        <div className="cometchat-call-log-details__header-back" onClick={onBack} />
        {getLocalizedString('call_details')}
      </div>
      <div className="cometchat-call-log-details__call-log-item">
        <CometChatListItem
          avatarName={user?.getName()}
          avatarURL={user?.getAvatar()}
          title={user?.getName() || ''}
          subtitleView={getSubtitleView()}
          trailingView={getTrailingView()}
        />
      </div>
      <CometChatCallDetailsInfo call={selectedItem} />
      <div className="cometchat-call-log-details__tabs">
        {callDetailTabItems.map((tabItem) => (
          <div
            key={tabItem.id}
            onClick={() => setActiveTab(tabItem.id)}
            className={
              activeTab === tabItem.id
                ? 'cometchat-call-log-details__tabs-tab-item-active'
                : 'cometchat-call-log-details__tabs-tab-item'
            }
          >
            {tabItem.name}
          </div>
        ))}
      </div>

      <>
        {activeTab === 'participants' ? (
          <CometChatCallDetailsParticipants call={selectedItem} />
        ) : activeTab === 'recording' ? (
          <CometChatCallDetailsRecording call={selectedItem} />
        ) : activeTab === 'history' ? (
          <CometChatCallDetailsHistory call={selectedItem} />
        ) : null}
      </>
    </div>
  );
};
