import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { CometChatUIKit } from '@cometchat/chat-uikit-react';
import { CometChat } from '@cometchat/chat-sdk-javascript';
import { AppContextProvider } from '../../CometChat/context/AppContext';
import { CometChatHome } from '../../CometChat/components/CometChatHome/CometChatHome';
import '../../CometChat/styles/CometChatApp.css';

const ChatContainer = () => {
    const { user: currentUser } = useAuth();
    const [ccUser, setCCUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const initChat = async () => {
            if (!currentUser) return;

            try {
                // Check if already logged in to CometChat
                const loggedInUser = await CometChatUIKit.getLoggedinUser();

                // CometChat SDK 4.0 UIDs must be alphanumeric (underscores/hyphens allowed)
                // Sanitizing email to be a valid UID (replacing @ and . with _)
                const targetUid = currentUser.email.replace(/[@.]/g, '_').toLowerCase();

                console.log(`🔍 Chat Initialization: Target UID is ${targetUid}`);

                if (loggedInUser && loggedInUser.getUid() === targetUid) {
                    console.log('✅ Already logged in to CometChat:', loggedInUser.getUid());
                    setCCUser(loggedInUser);
                } else {
                    // Force logout if wrong user is logged in
                    if (loggedInUser) {
                        console.log('🔄 Logging out stale user:', loggedInUser.getUid());
                        await CometChatUIKit.logout();
                    }

                    try {
                        console.log(`🔑 Attempting CometChat login for: ${targetUid}`);
                        const user = await CometChatUIKit.login(targetUid);
                        console.log('✅ CometChat login success:', user);
                        setCCUser(user);
                    } catch (loginError) {
                        console.warn('⚠️ CometChat login failed, attempting auto-registration...', loginError);

                        // If login fails (user not found), try to create user
                        const authKey = "e9b80ec532f553e701de51613d81ca4c81c726cc";

                        const newUser = new CometChat.User(targetUid);
                        newUser.setName(`${currentUser.firstName} ${currentUser.lastName}`.trim());

                        // CometChat requires a non-empty avatar URL
                        const defaultAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.firstName)}+${encodeURIComponent(currentUser.lastName)}&background=0D8ABC&color=fff&size=128`;
                        const avatarUrl = currentUser.avatar || defaultAvatar;
                        newUser.setAvatar(avatarUrl);
                        newUser.setTags(['gms-user']);

                        try {
                            console.log(`🆕 Creating new CometChat user: ${targetUid} with name: ${newUser.getName()}`);
                            const createdUser = await CometChat.createUser(newUser, authKey);
                            console.log('✅ CometChat user created successfully:', createdUser);

                            // Try logging in again after creation
                            console.log(`🔑 Re-attempting login for: ${targetUid}`);
                            const userAfterCreation = await CometChatUIKit.login(targetUid);
                            setCCUser(userAfterCreation);
                        } catch (createError) {
                            console.error('❌ CometChat auto-registration failed:', createError);
                            // Even if creation fails, we don't want to show the "Restricted" screen if possible
                            // But without a CC user, CometChatHome won't work.
                            throw createError;
                        }
                    }
                }
            } catch (error) {
                console.error('❌ CometChat fatal error:', error);
            } finally {
                setLoading(false);
            }
        };

        initChat();
    }, [currentUser]);

    // Toggle chat-page-active class for full page layout
    useEffect(() => {
        document.body.classList.add('chat-page-active');
        return () => {
            document.body.classList.remove('chat-page-active');
        };
    }, []);

    // Use specific height to avoid layout issues with the glassmorphic sidebar/header
    const chatContainerStyle = {
        height: '100%',
        width: '100%',
        position: 'relative',
        overflow: 'hidden'
    };

    if (loading) {
        return (
            <div className="d-flex align-items-center justify-content-center w-100" style={{ height: '80vh' }}>
                <div className="text-center">
                    <div className="spinner-border text-primary mb-3" role="status">
                        <span className="visually-hidden">Loading...</span>
                    </div>
                    <h5 className="fw-bold">Initializing Secure Chat...</h5>
                    <p className="text-muted small">Synchronizing your messaging workspace</p>
                </div>
            </div>
        );
    }

    return (
        <div className="CometChatApp-wrapper" style={chatContainerStyle}>
            <AppContextProvider>
                {ccUser ? (
                    <CometChatHome />
                ) : (
                    <div className="d-flex align-items-center justify-content-center h-100">
                        <div className="glass-card p-5 text-center" style={{ maxWidth: '400px' }}>
                            <div className="text-warning h1 mb-3">
                                <i className="bi bi-person-plus-fill"></i>
                            </div>
                            <h4 className="fw-bold mb-2">Setting Up Your Account</h4>
                            <p className="text-muted mb-4">
                                We're almost ready! Your chat workspace is being provisioned for <strong>{currentUser?.email}</strong>.
                            </p>
                            <button className="btn btn-dark rounded-pill px-4" onClick={() => window.location.reload()}>
                                REFRESH CHAT
                            </button>
                            <p className="mt-3 smallest text-muted">If this persists, please contact support.</p>
                        </div>
                    </div>
                )}
            </AppContextProvider>
        </div>
    );
};

export default ChatContainer;
