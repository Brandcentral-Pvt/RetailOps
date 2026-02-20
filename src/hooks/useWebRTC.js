import { useEffect, useRef, useState } from 'react';

const ICE_SERVERS = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
    ]
};

export const useWebRTC = (socket, call, isCaller) => {
    const [localStream, setLocalStream] = useState(null);
    const [remoteStream, setRemoteStream] = useState(null);
    const peerConnection = useRef(null);

    useEffect(() => {
        if (!socket || !call) return;

        const initializeMedia = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    audio: true,
                    video: call.type === 'VIDEO'
                });
                setLocalStream(stream);

                const pc = new RTCPeerConnection(ICE_SERVERS);
                peerConnection.current = pc;

                // Add local tracks to peer connection
                stream.getTracks().forEach(track => pc.addTrack(track, stream));

                // Handle remote tracks
                pc.ontrack = (event) => {
                    setRemoteStream(event.streams[0]);
                };

                // Handle ICE candidates
                pc.onicecandidate = (event) => {
                    if (event.candidate) {
                        socket.emit('webrtc_signal', {
                            targetId: isCaller ? call.receiverId._id || call.receiverId : call.callerId._id || call.callerId,
                            signal: { type: 'candidate', candidate: event.candidate }
                        });
                    }
                };

                // Signaling listeners
                socket.on('webrtc_signal', async ({ signal }) => {
                    if (signal.type === 'offer') {
                        await pc.setRemoteDescription(new RTCSessionDescription(signal));
                        const answer = await pc.createAnswer();
                        await pc.setLocalDescription(answer);
                        socket.emit('webrtc_signal', {
                            targetId: call.callerId._id || call.callerId,
                            signal: answer
                        });
                    } else if (signal.type === 'answer') {
                        await pc.setRemoteDescription(new RTCSessionDescription(signal));
                    } else if (signal.type === 'candidate') {
                        try {
                            await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
                        } catch (e) {
                            console.error('Error adding received ice candidate', e);
                        }
                    }
                });

                if (isCaller) {
                    const offer = await pc.createOffer();
                    await pc.setLocalDescription(offer);
                    socket.emit('webrtc_signal', {
                        targetId: call.receiverId._id || call.receiverId,
                        signal: offer
                    });
                }

            } catch (err) {
                console.error('WebRTC initialization error:', err);
            }
        };

        initializeMedia();

        return () => {
            if (peerConnection.current) {
                peerConnection.current.close();
            }
            if (localStream) {
                localStream.getTracks().forEach(track => track.stop());
            }
            socket.off('webrtc_signal');
        };
    }, [socket, call?._id, isCaller]);

    return { localStream, remoteStream };
};
