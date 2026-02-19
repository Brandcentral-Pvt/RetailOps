import React, { useEffect, useRef, useState } from 'react';
import { CometChat } from '@cometchat/chat-sdk-javascript';
import { CometChatIncomingCall, CometChatOutgoingCall } from '@cometchat/chat-uikit-react';

export const GlobalCallListener = () => {
    const [incomingCall, setIncomingCall] = useState(null);
    const [activeCall, setActiveCall] = useState(null);
    const audioRef = useRef(null);
    const ringtoneUrl = "https://assets.mixkit.co/active_storage/sfx/1359/1359-preview.mp3";

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
                    playRing();
                    showNotification('Incoming Call', `Call from ${call.getSender().getName()}`);
                },
                onOutgoingCallAccepted: (call) => {
                    console.log("[GlobalCallListener] Outgoing call accepted:", call);
                    stopRing();
                    setIncomingCall(null);
                    setActiveCall(call);
                },
                onOutgoingCallRejected: (call) => {
                    console.log("[GlobalCallListener] Outgoing call rejected:", call);
                    stopRing();
                    setIncomingCall(null);
                    setActiveCall(null);
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
        try {
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current.currentTime = 0;
            }
        } catch (error) {
            console.error("[GlobalCallListener] Error stopping ringtone:", error);
        }
    };

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
        stopRing();
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
        stopRing();

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

    // Attempting to use CometChatOutgoingCall as a generic Call Screen 
    // or look for CometChatCallController in user's library if available manually
    // But standard way is sending startCall on accepted call object
    // Wait, once accepted, you need to start the call session in the view?
    // Actually, for incoming calls, once accepted, we just need to render the call screen.
    // If we use CometChatOutgoingCall it might be for *outgoing* calls. 
    // We might need to start the call session.

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
                    <button
                        onClick={() => {
                            // Manually end call if UI doesn't provide it (it usually does)
                            CometChat.endCall(activeCall.getSessionId()).then(
                                call => {
                                    console.log("Call ended successfully", call);
                                    setActiveCall(null);
                                },
                                error => {
                                    console.log("Call ending failed with error:", error);
                                }
                            );
                        }}
                        style={{ position: 'absolute', top: 20, right: 20, zIndex: 100000, padding: '10px', background: 'red', color: 'white', border: 'none', borderRadius: '5px' }}
                    >
                        End Call
                    </button>
                    {/* The startCall method injects the video UI into this container */}
                </div>
            )}
        </>
    );
};
