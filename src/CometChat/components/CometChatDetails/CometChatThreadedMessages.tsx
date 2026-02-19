import '../../styles/CometChatDetails/CometChatThreadedMessages.css';
import {
  CometChatMessageComposer,
  CometChatMessageList,
  CometChatTextHighlightFormatter,
  CometChatThreadHeader,
  CometChatUIKit,
  CometChatUserEvents,
  getLocalizedString,
} from '@cometchat/chat-uikit-react';
import { CometChat } from '@cometchat/chat-sdk-javascript';
import React from 'react';
import { CallLog } from '@cometchat/calls-sdk-javascript';
import { useCometChatContext } from '../../context/CometChatContext';
import { CometChatSettings } from '../../CometChatSettings';
import { TaskMentionFormatter } from '../../util/TaskMentionFormatter';

interface ThreadProps {
  message: CometChat.BaseMessage;
  requestBuilderState?: CometChat.MessagesRequestBuilder;
  selectedItem: CometChat.User | CometChat.Group | CometChat.Conversation | CometChat.Call | CallLog | undefined;
  onClose?: () => void;
  showComposer?: boolean;
  onSubtitleClicked?: () => void;
  goToMessageId?: string;
  searchKeyword?: string;
}

export const CometChatThreadedMessages = (props: ThreadProps) => {
  const {
    message,
    requestBuilderState,
    selectedItem,
    onClose = () => { },
    showComposer = false,
    onSubtitleClicked,
    goToMessageId,
    searchKeyword,
  } = props;
  const { chatFeatures } = useCometChatContext();
  // Memoize mentionsUsersRequestBuilder to respect friendsOnly toggle
  const mentionsUsersRequestBuilder = React.useMemo(() => {
    let builder = new CometChat.UsersRequestBuilder().setLimit(15);
    if (chatFeatures?.userManagement?.friendsOnly) {
      builder = builder.friendsOnly(true);
    }
    return builder;
  }, [chatFeatures?.userManagement?.friendsOnly]);

  function getFormatters() {
    const formatters = CometChatUIKit.getDataSource().getAllTextFormatters({});
    // Add Task Mention Formatter
    formatters.push(new TaskMentionFormatter());

    if (searchKeyword) {
      formatters.push(new CometChatTextHighlightFormatter(searchKeyword));
    }
    return formatters;
  }
  return (
    <div className="cometchat-threaded-message">
      <div className="cometchat-threaded-message-header">
        <CometChatThreadHeader
          onSubtitleClicked={onSubtitleClicked}
          parentMessage={message}
          onClose={onClose}
          hideReceipts={
            (chatFeatures && !chatFeatures?.coreMessagingExperience?.messageDeliveryAndReadReceipts) ??
            CometChatSettings.chatFeatures.coreMessagingExperience.messageDeliveryAndReadReceipts
          }
        />
      </div>
      {requestBuilderState?.parentMessageId === message.getId() && (
        <>
          <div className="cometchat-threaded-message-list" key="threaded-message-list-wrapper">
            <CometChatMessageList
              textFormatters={searchKeyword && searchKeyword.trim() !== '' ? getFormatters() : undefined}
              goToMessageId={goToMessageId}
              key="threaded-message-list-content"
              parentMessageId={message.getId()}
              user={
                (selectedItem as CometChat.Conversation)?.getConversationType?.() === 'user'
                  ? ((selectedItem as CometChat.Conversation)?.getConversationWith() as CometChat.User)
                  : (selectedItem as CometChat.User).getUid?.()
                    ? (selectedItem as CometChat.User)
                    : undefined
              }
              group={
                (selectedItem as CometChat.Conversation)?.getConversationType?.() === 'group'
                  ? ((selectedItem as CometChat.Conversation)?.getConversationWith() as CometChat.Group)
                  : (selectedItem as CometChat.Group).getGuid?.()
                    ? (selectedItem as CometChat.Group)
                    : undefined
              }
              messagesRequestBuilder={requestBuilderState}
              hideReplyInThreadOption={
                (chatFeatures && !chatFeatures?.coreMessagingExperience?.threadConversationAndReplies) ??
                !CometChatSettings.chatFeatures.coreMessagingExperience.threadConversationAndReplies
              }
              hideTranslateMessageOption={
                (chatFeatures && !chatFeatures?.deeperUserEngagement?.messageTranslation) ??
                !CometChatSettings.chatFeatures.deeperUserEngagement.messageTranslation
              }
              hideEditMessageOption={
                (chatFeatures && !chatFeatures?.coreMessagingExperience?.editMessage) ??
                !CometChatSettings.chatFeatures.coreMessagingExperience.editMessage
              }
              hideDeleteMessageOption={
                (chatFeatures && !chatFeatures?.coreMessagingExperience?.deleteMessage) ??
                !CometChatSettings.chatFeatures.coreMessagingExperience.deleteMessage
              }
              hideReactionOption={
                (chatFeatures && !chatFeatures?.deeperUserEngagement?.reactions) ??
                !CometChatSettings.chatFeatures.deeperUserEngagement.reactions
              }
              hideMessagePrivatelyOption={
                (chatFeatures && !chatFeatures?.privateMessagingWithinGroups?.sendPrivateMessageToGroupMembers) ??
                !CometChatSettings.chatFeatures.privateMessagingWithinGroups.sendPrivateMessageToGroupMembers
              }
              hideReceipts={
                (chatFeatures && !chatFeatures?.coreMessagingExperience?.messageDeliveryAndReadReceipts) ??
                !CometChatSettings.chatFeatures.coreMessagingExperience.messageDeliveryAndReadReceipts
              }
              hideMessageInfoOption={
                (chatFeatures && !chatFeatures?.coreMessagingExperience?.messageDeliveryAndReadReceipts) ??
                !CometChatSettings.chatFeatures.coreMessagingExperience.messageDeliveryAndReadReceipts
              }
              hideModerationView={chatFeatures?.coreMessagingExperience?.moderation === false ? true : false}
              hideReplyOption={
                chatFeatures?.coreMessagingExperience?.quotedReplies === undefined
                  ? true
                  : !chatFeatures?.coreMessagingExperience?.quotedReplies
              }
              hideFlagMessageOption={
                chatFeatures?.moderatorControls.reportMessage === undefined
                  ? false
                  : !chatFeatures?.moderatorControls?.reportMessage
              }
            />
          </div>
          {showComposer ? (
            <div className="cometchat-threaded-message-composer">
              <CometChatMessageComposer
                parentMessageId={message.getId()}
                mentionsUsersRequestBuilder={mentionsUsersRequestBuilder}
                user={
                  (selectedItem as CometChat.Conversation)?.getConversationType?.() === 'user'
                    ? ((selectedItem as CometChat.Conversation)?.getConversationWith() as CometChat.User)
                    : (selectedItem as CometChat.User).getUid?.()
                      ? (selectedItem as CometChat.User)
                      : undefined
                }
                group={
                  (selectedItem as CometChat.Conversation)?.getConversationType?.() === 'group'
                    ? ((selectedItem as CometChat.Conversation)?.getConversationWith() as CometChat.Group)
                    : (selectedItem as CometChat.Group).getGuid?.()
                      ? (selectedItem as CometChat.Group)
                      : undefined
                }
                disableMentions={
                  (chatFeatures && !chatFeatures?.deeperUserEngagement?.mentions) ??
                  !CometChatSettings.chatFeatures.deeperUserEngagement.mentions
                }
                disableMentionAll={
                  chatFeatures?.deeperUserEngagement.mentionAll === undefined
                    ? false
                    : !chatFeatures?.deeperUserEngagement?.mentionAll
                }
                disableTypingEvents={
                  (chatFeatures && !chatFeatures?.coreMessagingExperience?.typingIndicator) ??
                  !CometChatSettings.chatFeatures.coreMessagingExperience.typingIndicator
                }
                hidePollsOption={
                  (chatFeatures && !chatFeatures?.deeperUserEngagement?.polls) ??
                  !CometChatSettings.chatFeatures.deeperUserEngagement.polls
                }
                hideCollaborativeDocumentOption={
                  (chatFeatures && !chatFeatures?.deeperUserEngagement?.collaborativeDocument) ??
                  !CometChatSettings.chatFeatures.deeperUserEngagement.collaborativeDocument
                }
                hideStickersButton={
                  (chatFeatures && !chatFeatures?.deeperUserEngagement?.stickers) ??
                  !CometChatSettings.chatFeatures.deeperUserEngagement.stickers
                }
                hideEmojiKeyboardButton={
                  (chatFeatures && !chatFeatures?.deeperUserEngagement?.emojis) ??
                  !CometChatSettings.chatFeatures.deeperUserEngagement.emojis
                }
                hideVoiceRecordingButton={
                  (chatFeatures && !chatFeatures?.deeperUserEngagement?.voiceNotes) ??
                  !CometChatSettings.chatFeatures.deeperUserEngagement.voiceNotes
                }
                hideCollaborativeWhiteboardOption={
                  (chatFeatures && !chatFeatures?.deeperUserEngagement?.collaborativeWhiteboard) ??
                  !CometChatSettings.chatFeatures.deeperUserEngagement.collaborativeWhiteboard
                }
                hideVideoAttachmentOption={
                  (chatFeatures && !chatFeatures?.coreMessagingExperience?.videoSharing) ??
                  !CometChatSettings.chatFeatures.coreMessagingExperience.videoSharing
                }
                hideFileAttachmentOption={
                  (chatFeatures && !chatFeatures?.coreMessagingExperience?.fileSharing) ??
                  !CometChatSettings.chatFeatures.coreMessagingExperience.fileSharing
                }
                hideAudioAttachmentOption={
                  (chatFeatures && !chatFeatures?.coreMessagingExperience?.audioSharing) ??
                  !CometChatSettings.chatFeatures.coreMessagingExperience.audioSharing
                }
                hideImageAttachmentOption={
                  (chatFeatures && !chatFeatures?.coreMessagingExperience?.photosSharing) ??
                  !CometChatSettings.chatFeatures.coreMessagingExperience.photosSharing
                }
              />
            </div>
          ) : (
            <div className="message-composer-blocked">
              <div className="message-composer-blocked__text">
                {getLocalizedString('cannot_send_to_blocked_user')}{' '}
                <a
                  onClick={() => {
                    let user: CometChat.User | null = null;

                    if (selectedItem instanceof CometChat.User) {
                      user = selectedItem;
                    } else if (
                      selectedItem instanceof CometChat.Conversation &&
                      selectedItem.getConversationType() === CometChat.RECEIVER_TYPE.USER &&
                      selectedItem.getConversationWith() instanceof CometChat.User
                    ) {
                      user = selectedItem.getConversationWith() as CometChat.User;
                    }
                    if (user) {
                      CometChat.unblockUsers([user.getUid()]).then(() => {
                        user?.setBlockedByMe(false);
                        CometChatUserEvents.ccUserUnblocked.next(user as CometChat.User);
                      });
                    }
                  }}
                >
                  {getLocalizedString('click_to_unblock')}
                </a>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
