import React, { useEffect, useState } from 'react';
import { CometChat } from '@cometchat/chat-sdk-javascript';
import { CometChatIncomingCall } from '@cometchat/chat-uikit-react';

export const GlobalCallListener = () => {
    const [incomingCall, setIncomingCall] = useState(null);
    const [activeCall, setActiveCall] = useState(null);

    useEffect(() => {
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
                    showNotification('Incoming Call', `Call from ${call.getSender().getName()}`);
                },
                onOutgoingCallAccepted: (call) => {
                    console.log("[GlobalCallListener] Outgoing call accepted:", call);
                    setIncomingCall(null);
                    setActiveCall(call);
                },
                onOutgoingCallRejected: (call) => {
                    console.log("[GlobalCallListener] Outgoing call rejected:", call);
                    setIncomingCall(null);
                    setActiveCall(null);
                },
                onIncomingCallCancelled: (call) => {
                    console.log("[GlobalCallListener] Incoming call cancelled:", call);
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
        };
    }, []);

    const showNotification = (title, body) => {
        if (Notification.permission === 'granted') {
            new Notification(title, {
                body,
                icon: '/vite.svg'
            });
        }
    };

    const onDecline = (call) => {
        console.log("[GlobalCallListener] User declined call:", call);
        setIncomingCall(null);

        CometChat.rejectCall(call.getSessionId(), CometChat.CALL_STATUS.REJECTED).then(
            rejectedCall => {
                console.log("Call rejected successfully", rejectedCall);
            },
            error => {
                console.log("Call rejection failed with error:", error);
            }
        );
    };

    const onAccept = (call) => {
        console.log("[GlobalCallListener] User accepted call:", call);

        CometChat.acceptCall(call.getSessionId()).then(
            (acceptedCall) => {
                console.log("Call accepted successfully:", acceptedCall);
                setIncomingCall(null);
                setActiveCall(acceptedCall);
            },
            (error) => {
                console.log("Call acceptance failed:", error);
                setIncomingCall(null);
            }
        );
    };

    useEffect(() => {
        if (activeCall) {
            console.log("Starting active call session...", activeCall.getSessionId());
            CometChat.startCall(
                activeCall.getSessionId(),
                document.getElementById("call-screen-container"),
                new CometChat.OngoingCallListener({
                    onUserJoined: user => {
                        console.log("User joined call:", user);
                    },
                    onUserLeft: user => {
                        console.log("User left call:", user);
                    },
                    onUserListUpdated: userList => {
                        console.log("User list updated:", userList);
                    },
                    onCallEnded: call => {
                        console.log("Call ended:", call);
                        setActiveCall(null);
                    },
                    onError: error => {
                        console.log("Call error:", error);
                        setActiveCall(null);
                    },
                    onAudioModesUpdated: (audioModes) => {
                        console.log("Audio modes updated:", audioModes);
                    }
                })
            );
        }
    }, [activeCall]);

    return (
        <>
            {incomingCall && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    zIndex: 99999,
                    background: 'rgba(0,0,0,0.5)',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center'
                }}>
                    <CometChatIncomingCall
                        call={incomingCall}
                        onDecline={onDecline}
                        onAccept={onAccept}
                    />
                </div>
            )}

            {activeCall && (
                <div id="call-screen-container" style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    zIndex: 99999,
                    background: '#000'
                }}>
                    {/* The startCall method injects the video UI into this container */}
                </div>
            )}
        </>
    );
};
