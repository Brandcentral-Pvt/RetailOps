import chatsIcon from '../../assets/chats.svg';
import callsIcon from '../../assets/calls.svg';
import usersIcon from '../../assets/users.svg';
import groupsIcon from '../../assets/groups.svg';
import '../../styles/CometChatSelector/CometChatTabs.css';
import React, { useState } from 'react';
import { getLocalizedString } from '@cometchat/chat-uikit-react';
import { useCometChatContext } from '../../context/CometChatContext';

export const CometChatTabs = (props: {
  onTabClicked?: (tabItem: { name: string; icon: string; id: string }) => void;
  activeTab?: string;
}) => {
  const { onTabClicked = () => {}, activeTab } = props;
  const [hoverTab, setHoverTab] = useState('');
  const { layoutFeatures } = useCometChatContext();
  const tabItems = [
    {
      name: getLocalizedString('conversation_chat_title'),
      icon: chatsIcon,
      id: 'chats',
    },
    {
      name: getLocalizedString('call_logs_title'),
      icon: callsIcon,
      id: 'calls',
    },
    {
      name: getLocalizedString('user_title'),
      icon: usersIcon,
      id: 'users',
    },
    {
      name: getLocalizedString('group_title'),
      icon: groupsIcon,
      id: 'groups',
    },
  ];

  const isTabActiveOrHovered = (name: string) => {
    return activeTab === name || hoverTab === name;
  };
  return (
    <div
      className="cometchat-tab-component"
      style={layoutFeatures?.tabs?.length > 1 ? { display: 'flex' } : { display: 'none' }}
    >
      {tabItems
        .filter(
          (tabItem) => layoutFeatures?.tabs?.includes(tabItem.id) // Keep only allowed tabs
        )
        .map((tabItem) => (
          <div key={tabItem.id} className="cometchat-tab-component__tab" onClick={() => onTabClicked(tabItem)}>
            <div
              className={`cometchat-tab-component__tab-icon cometchat-tab-component__tab-icon-${tabItem.id} ${
                isTabActiveOrHovered(tabItem.id) ? 'cometchat-tab-component__tab-icon-active' : ''
              }`}
              style={tabItem.icon ? { WebkitMask: `url(${tabItem.icon}), center, center, no-repeat` } : undefined}
              onMouseEnter={() => setHoverTab(tabItem.id)}
              onMouseLeave={() => setHoverTab('')}
            />
            <div
              className={
                activeTab === tabItem.id || hoverTab === tabItem.id
                  ? 'cometchat-tab-component__tab-text cometchat-tab-component__tab-text-active'
                  : 'cometchat-tab-component__tab-text'
              }
              onMouseEnter={() => setHoverTab(tabItem.id)}
              onMouseLeave={() => setHoverTab('')}
            >
              {tabItem.name}
            </div>
          </div>
        ))}
    </div>
  );
};
