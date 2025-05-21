"use client"

import { useEffect, useRef } from "react";

export const Participant = ({ roomId, userId }: { roomId: string; userId: string }) => {
  const peer = useRef<RTCPeerConnection>();
  const controlChannel = useRef<RTCDataChannel>();



  useEffect(() => {
    const joinRoom = async () => {
      // Get host's peer ID from server
      const { hostPeerId } = await fetch(`/api/host-peer-id/${roomId}`).then(res => res.json());
      
      // Connect to host
      peer.current = new RTCPeerConnection({ iceServers: [...] });
      
      // Setup data channel
      peer.current.ondatachannel = ({ channel }) => {
        if (channel.label === 'control') {
          controlChannel.current = channel;
          channel.onmessage = handleControlMessage;
        }
      };

      // Send offer to host
      const offer = await peer.current.createOffer();
      await peer.current.setLocalDescription(offer);
      
      // Send offer to host (via server or direct signaling)
      await fetch('/api/signal', {
        method: 'POST',
        body: JSON.stringify({
          roomId,
          from: userId,
          payload: offer
        })
      });

      // Handle media tracks
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      stream.getTracks().forEach(track => peer.current?.addTrack(track, stream));
    };

    joinRoom();

    return () => peer.current?.close();
  }, [roomId, userId]);

  const handleControlMessage = (event: MessageEvent) => {
    const message = JSON.parse(event.data);
    if (message.type === 'mute') {
      // Mute local audio track
      const sender = peer.current?.getSenders().find(s => s.track?.kind === 'audio');
      sender?.track.enabled = !message.muted;
    }
  };
  
  return (
    <video ref={localVideoRef} autoPlay muted />
    // Remote videos would be handled via ontrack event
  );
};