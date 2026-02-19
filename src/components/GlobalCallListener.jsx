import React, { useEffect, useRef, useState } from 'react';
import { CometChat } from '@cometchat/chat-sdk-javascript';
import { CometChatIncomingCall } from '@cometchat/chat-uikit-react';

export const GlobalCallListener = () => {
    const [incomingCall, setIncomingCall] = useState(null);
    const audioRef = useRef(null);

    // Default ringtone URL (can be replaced with local asset)
    const ringtoneUrl = "https://assets.mixkit.co/active_storage/sfx/1359/1359-preview.mp3";

    useEffect(() => {
        // Request Notification Permission on mount
        if (Notification.permission !== 'granted') {
            Notification.requestPermission();
        }

        const listId = 'GLOBAL_LISTENER_' + Date.now();
        const msgListId = 'GLOBAL_MSG_LISTENER_' + Date.now();

        CometChat.addCallListener(
            listId,
            new CometChat.CallListener({
                onIncomingCallReceived: (call) => {
                    console.log("[GlobalCallListener] Incoming call:", call);
                    setIncomingCall(call);
                    playRing();
                    showNotification('Incoming Call', `Call from ${call.getSender().getName()}`);
                },
                onOutgoingCallAccepted: (call) => {
                    console.log("[GlobalCallListener] Outgoing call accepted:", call);
                    stopRing();
                    setIncomingCall(null);
                },
                onOutgoingCallRejected: (call) => {
                    console.log("[GlobalCallListener] Outgoing call rejected:", call);
                    stopRing();
                    setIncomingCall(null);
                },
                onIncomingCallCancelled: (call) => {
                    console.log("[GlobalCallListener] Incoming call cancelled:", call);
                    stopRing();
                    setIncomingCall(null);
                }
            })
        );

        CometChat.addMessageListener(
            msgListId,
            new CometChat.MessageListener({
                onTextMessageReceived: (textMessage) => {
                    if (document.hidden) {
                        showNotification(`Message from ${textMessage.getSender().getName()}`, textMessage.getText());
                    }
                },
                onMediaMessageReceived: (mediaMessage) => {
                    if (document.hidden) {
                        showNotification(`File from ${mediaMessage.getSender().getName()}`, "Sent a file");
                    }
                },
                onCustomMessageReceived: (customMessage) => {
                    if (document.hidden) {
                        showNotification(`New Interaction`, "Check your dashboard");
                    }
                }
            })
        );


        return () => {
            CometChat.removeCallListener(listId);
            CometChat.removeMessageListener(msgListId);
            stopRing();
        };
    }, []);

    const playRing = () => {
        if (!audioRef.current) {
            audioRef.current = new Audio(ringtoneUrl);
            audioRef.current.loop = true;
        }
        audioRef.current.play().catch(e => console.error("Error playing ringtone:", e));
    };

    const stopRing = () => {
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
        }
    };

    const showNotification = (title, body) => {
        if (Notification.permission === 'granted') {
            new Notification(title, {
                body,
                icon: '/vite.svg' // Ensure this exists or use valid path
            });
        }
    };

    const onDecline = (call) => {
        console.log("[GlobalCallListener] User declined call:", call);
        stopRing();
        setIncomingCall(null);
    };

    const onAccept = (call) => {
        console.log("[GlobalCallListener] User accepted call:", call);
        stopRing();
        setIncomingCall(null);
    };

    // Robust stopRing function
    const stopRing = () => {
        try {
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current.currentTime = 0;
            }
        } catch (error) {
            console.error("[GlobalCallListener] Error stopping ringtone:", error);
        }
    };


    return (
        <>
            {incomingCall && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    zIndex: 99999, // Ensure it's on top of everything
                    pointerEvents: 'none' // Allow clicks to pass through wrapper, but component inside should handle pointer events
                }}>
                    <div style={{ pointerEvents: 'auto' }}>
                        <CometChatIncomingCall
                            call={incomingCall}
                            onDecline={onDecline}
                            onAccept={onAccept}
                        />
                    </div>
                </div>
            )}
        </>
    );
};
