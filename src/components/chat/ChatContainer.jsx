import React, { useEffect, useRef, useState } from 'react';
import { CometChat } from "@cometchat/chat-sdk-javascript";
import { CometChatUIKitLoginListener, CometChatUIKit } from "@cometchat/chat-uikit-react";
import { MessageSquareOff } from 'lucide-react';
import { CometChatHome } from "CometChat/components/CometChatHome/CometChatHome";
import { AppContextProvider } from "CometChat/context/AppContext";
import { useCometChatContext } from "CometChat/context/CometChatContext";
import useSystemColorScheme from "CometChat/customHooks";
import useThemeStyles from "CometChat/customHook/useThemeStyles";
import "@cometchat/chat-uikit-react/css-variables.css";

import { ensureCometChatReady, resetCometChatInit } from "./cometChatBootstrap";

const ChatContainer = () => {
    const [session, setSession] = useState(null);
    const [initState, setInitState] = useState('loading'); // 'loading' | 'ready' | 'unavailable'
    const [initError, setInitError] = useState('');
    const [retryCount, setRetryCount] = useState(0);
    const [loggedInUser, setLoggedInUser] = useState(null);
    const loginInFlightRef = useRef(false);
    const { styleFeatures, setStyleFeatures } = useCometChatContext();
    const systemTheme = useSystemColorScheme();
    const getLoggedInUser = CometChatUIKitLoginListener?.getLoggedInUser();

    useEffect(() => {
        setLoggedInUser(getLoggedInUser);
    }, [getLoggedInUser]);

    // CONTRACT A: fetch the server-minted session (GET /api/chat/token) and
    // initialize the UIKit exclusively with the returned appId/region.
    // (initState starts as 'loading'; handleRetry resets it from the event handler.)
    useEffect(() => {
        let cancelled = false;

        ensureCometChatReady()
            .then((chatSession) => {
                if (!cancelled) {
                    setSession(chatSession);
                    setInitState('ready');
                }
            })
            .catch((error) => {
                console.error("Chat initialization failed:", error?.message || error);
                if (!cancelled) {
                    setInitError(error?.message || 'Chat is temporarily unavailable.');
                    setInitState('unavailable');
                }
            });

        return () => {
            cancelled = true;
        };
    }, [retryCount]);

    // Login with the auth token minted by the backend - no client-side secrets.
    useEffect(() => {
        if (initState !== 'ready' || !session?.authToken || loggedInUser) return;
        if (loginInFlightRef.current) return;

        loginInFlightRef.current = true;
        CometChatUIKit.loginWithAuthToken(session.authToken)
            .then((ccUser) => setLoggedInUser(ccUser))
            .catch((error) => {
                console.error("CometChat auto-login failed:", error);
            })
            .finally(() => {
                loginInFlightRef.current = false;
            });
    }, [initState, session, loggedInUser]);

    useEffect(() => {
        document.body.classList.add('chat-page-active');

        CometChat.addLoginListener(
            "gms-dashboard-chat",
            new CometChat.LoginListener({
                loginSuccess: (user) => {
                    setLoggedInUser(user);
                },
                logoutSuccess: () => {
                    setLoggedInUser(null);
                },
            })
        );

        return () => {
            document.body.classList.remove('chat-page-active');
            CometChat.removeLoginListener("gms-dashboard-chat");
        };
    }, []);

    // Apply theme styles based on CometChat settings
    useThemeStyles(styleFeatures, systemTheme, setStyleFeatures, loggedInUser);

    const handleRetry = () => {
        resetCometChatInit();
        setSession(null);
        setInitState('loading');
        setInitError('');
        setRetryCount(count => count + 1);
    };

    let content;
    if (loggedInUser) {
        content = <CometChatHome />;
    } else if (initState === 'unavailable') {
        content = (
            <div className="h-100 d-flex flex-column align-items-center justify-content-center bg-light">
                <MessageSquareOff size={40} strokeWidth={1.5} className="text-secondary mb-3" aria-hidden="true" />
                <h4 className="text-dark mb-1">Chat is unavailable</h4>
                <p className="text-muted text-center px-4 mb-3" style={{ maxWidth: 420 }}>
                    {initError ||
                        'We could not start chat because the messaging service is not configured on this server.'}
                </p>
                <button type="button" className="btn btn-outline-secondary" onClick={handleRetry}>
                    Try Again
                </button>
            </div>
        );
    } else {
        content = (
            <div className="h-100 d-flex flex-column align-items-center justify-content-center bg-light">
                <span className="icon-[svg-spinners--eclipse] text-primary mb-3" role="status" style={{ fontSize: '3rem' }} aria-label="Loading"></span>
                <h4 className="text-dark mb-1">Initializing Chat</h4>
                <p className="text-muted">Please wait while we connect you...</p>
            </div>
        );
    }

    return (
        <div className="h-100 w-100 overflow-hidden">
            <AppContextProvider>{content}</AppContextProvider>
        </div>
    );
};

export default ChatContainer;
