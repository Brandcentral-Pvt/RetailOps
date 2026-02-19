import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { CometChatUIKit } from '@cometchat/chat-uikit-react';
import { CometChat } from '@cometchat/chat-sdk-javascript';
import { CometChatHome } from '../../CometChat/components/CometChatHome/CometChatHome';
import { AppContextProvider } from '../../CometChat/context/AppContext';
import '../../CometChat/styles/CometChatApp.css';

const ChatContainer = () => {
    const { user: currentUser } = useAuth();
    const [ccUser, setCCUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const initChat = async () => {
            if (!currentUser) return;

            try {
                const loggedInUser = await CometChatUIKit.getLoggedinUser();
                const targetUid = currentUser.email.replace(/[@.]/g, '_').toLowerCase();

                if (loggedInUser && loggedInUser.getUid() === targetUid) {
                    setCCUser(loggedInUser);
                    setLoading(false);
                } else {
                    if (loggedInUser) await CometChatUIKit.logout();

                    try {
                        const user = await CometChatUIKit.login(targetUid);
                        setCCUser(user);
                    } catch (loginError) {
                        console.warn('CometChat login failed, attempting creation...', loginError);
                        const authKey = "e9b80ec532f553e701de51613d81ca4c81c726cc";
                        const newUser = new CometChat.User(targetUid);
                        newUser.setName(`${currentUser.firstName} ${currentUser.lastName}`.trim());
                        const defaultAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.firstName)}+${encodeURIComponent(currentUser.lastName)}&background=0D8ABC&color=fff&size=128`;
                        newUser.setAvatar(currentUser.avatar || defaultAvatar);
                        newUser.setTags(['gms-user']);

                        await CometChat.createUser(newUser, authKey);
                        const userAfterCreation = await CometChatUIKit.login(targetUid);
                        setCCUser(userAfterCreation);
                    }
                    setLoading(false);
                }
            } catch (error) {
                console.error('CometChat initialization error:', error);
                setLoading(false);
            }
        };

        initChat();
    }, [currentUser]);

    if (loading) return <div className="p-5 text-center">Loading Chat...</div>;

    return (
        <div style={{ height: '100vh', width: '100%' }}>
            <AppContextProvider>
                {ccUser ? <CometChatHome /> : <div className="p-5 text-center">Initializing...</div>}
            </AppContextProvider>
        </div>
    );
};

export default ChatContainer;
