/* eslint-disable react/no-unescaped-entities */
import './styles/CometChatApp.css';
import { AppContextProvider } from './context/AppContext';
import { CometChatHome } from './components/CometChatHome/CometChatHome';
import React, { useEffect, useState } from 'react';
import { useCometChatContext } from './context/CometChatContext';
import { CometChat } from '@cometchat/chat-sdk-javascript';
import useSystemColorScheme from './customHooks';
import { CometChatUIKit } from '@cometchat/chat-uikit-react';
import '@cometchat/chat-uikit-react/css-variables.css';
import useThemeStyles from './customHook/useThemeStyles';

interface CometChatAppProps {
  /** Default user for the chat application (optional). */
  user?: CometChat.User;
  /** Default group for the chat application (optional). */
  group?: CometChat.Group;
  /** Show or hide group action messages (optional). */
  showGroupActionMessages?: boolean;
  autoOpenFirstItem?: boolean;
  defaultActiveTab?: 'chats' | 'calls' | 'users' | 'groups';
}

/**
 * Main application component for the CometChat Builder.
 *
 * @param {CometChatAppProps} props - The component props.
 * @returns {JSX.Element} The rendered CometChatApp component.
 */
function CometChatApp({
  user,
  group,
  showGroupActionMessages,
  autoOpenFirstItem,
  defaultActiveTab,
}: CometChatAppProps) {
  const [loggedInUser, setLoggedInUser] = useState<CometChat.User | null>(null);
  const { styleFeatures, setStyleFeatures } = useCometChatContext();

  const systemTheme = useSystemColorScheme();
  useThemeStyles(styleFeatures, systemTheme, setStyleFeatures, loggedInUser);

  /**
   * Effect to handle login and logout listeners
   */
  useEffect(() => {
    CometChat.addLoginListener(
      'runnable-sample-app',
      new CometChat.LoginListener({
        loginSuccess: (user: CometChat.User) => {
          setLoggedInUser(user);
        },
        logoutSuccess: () => {
          setLoggedInUser(null);
        },
      })
    );

    return () => CometChat.removeLoginListener('runnable-sample-app');
  }, []);

  /**
   * Fetches the currently logged-in CometChat user and updates the state.
   * Runs once on component mount.
   */
  useEffect(() => {
    CometChatUIKit.getLoggedinUser().then((user: CometChat.User | null) => {
      if (user) {
        setLoggedInUser(user);
      } else {
        setLoggedInUser(null);
      }
    });
  }, []);

  return (
    <div className="CometChatApp">
      <AppContextProvider>
        {loggedInUser ? (
          <CometChatHome
            defaultGroup={group}
            defaultUser={user}
            showGroupActionMessages={showGroupActionMessages}
            autoOpenFirstItem={autoOpenFirstItem}
            defaultActiveTab={defaultActiveTab}
          />
        ) : (
          <LoginPlaceholder />
        )}
      </AppContextProvider>
    </div>
  );
}

export default CometChatApp;

const LoginPlaceholder = () => {
  return (
    <div className="login-placeholder">
      <div className="cometchat-logo" />
      <h3>This is where your website&apos;s login screen should appear.</h3>
    </div>
  );
};
