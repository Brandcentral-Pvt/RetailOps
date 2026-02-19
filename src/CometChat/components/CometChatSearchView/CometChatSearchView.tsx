import { CometChatButton, CometChatSearch, getLocalizedString } from '@cometchat/chat-uikit-react';
import '../../styles/CometChatSearchView/CometChatSearchView.css';
import { useEffect, useState } from 'react';
import { CometChat } from '@cometchat/chat-sdk-javascript';

import closeIcon from '../../assets/close2x.svg';

interface MessagesViewProps {
  /** The user to search messages for (used in one-on-one conversations) */
  user?: CometChat.User;
  /** The group to search messages in (used in group conversations) */
  group?: CometChat.Group;
  /** Callback function triggered when the search view is closed */
  onClose?: () => void;
  /** Callback function triggered when a message is clicked in search results */
  onMessageClicked?: (message: CometChat.BaseMessage) => void;
}

/**
 * CometChatSearchView component renders a search interface for messages.
 *
 * @param {MessagesViewProps} props - The props for the component.
 * @returns {JSX.Element} The rendered search view.
 */

const CometChatSearchView = (props: MessagesViewProps) => {
  const { user, group, onClose, onMessageClicked } = props;

  return (
    <div className="cometchat-search-view">
      <div className="cometchat-search-view__header">
        <div className="cometchat-search-view__title">{getLocalizedString('messages_search_title')}</div>
        <div className="cometchat-search-view__close-button">
          <CometChatButton iconURL={closeIcon} onClick={onClose} />
        </div>
      </div>
      <div className="cometchat-search-view__content">
        <CometChatSearch
          hideBackButton={true}
          uid={user?.getUid()}
          guid={group?.getGuid()}
          onBack={onClose}
          onMessageClicked={onMessageClicked}
          messagesRequestBuilder={new CometChat.MessagesRequestBuilder().setLimit(30)}
        />
      </div>
    </div>
  );
};

export default CometChatSearchView;
