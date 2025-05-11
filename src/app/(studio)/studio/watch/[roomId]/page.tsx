"use client";
import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";

export default function ParticipantPage() {
  const { roomId } = useParams();
  const [localStream, setLocalStream] = useState<MediaStream>();
  const [remoteStreams, setRemoteStreams] = useState<MediaStream[]>([]);
  const peers = useRef<Map<string, RTCPeerConnection>>(new Map());
  const userId = useRef(crypto.randomUUID()).current;
  const isHost = window.location.pathname.includes("/host/");

  useEffect(() => {
    const init = async () => {
      if (!isHost) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        setLocalStream(stream);
      }

      await fetch("/api/signal", {
        method: "POST",
        body: JSON.stringify({
          action: "join",
          roomId,
          userId,
          userType: isHost ? "host" : "guest",
        }),
      });

      const interval = setInterval(handleSignaling, 2000);
      return () => {
        stream?.getTracks().forEach((track) => track.stop());
        clearInterval(interval);
      };
    };
    init();
  }, []);

  const handleSignaling = async () => {
    const response = await fetch("/api/signal", {
      method: "POST",
      body: JSON.stringify({ action: "list", roomId }),
    });
    const participants = await response.json();

    participants.forEach(async (id: string) => {
      if (id !== userId && !peers.current.has(id)) {
        const pc = new RTCPeerConnection();
        peers.current.set(id, pc);

        if (!isHost) {
          localStream
            ?.getTracks()
            .forEach((track) => pc.addTrack(track, localStream));
        }

        pc.ontrack = (e) => {
          setRemoteStreams((prev) => [...prev, e.streams[0]]);
        };

        pc.onicecandidate = (e) => {
          if (e.candidate) {
            fetch("/api/signal", {
              method: "POST",
              body: JSON.stringify({
                action: "signal",
                roomId,
                userId,
                targetId: id,
                message: { type: "ice", candidate: e.candidate },
              }),
            });
          }
        };

        if (isHost) {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          // Send offer to participant
        } else {
          // Handle offers from host
        }
      }
    });
  };

  return (
    <div className="grid grid-cols-2 gap-4 p-4">
      {!isHost && (
        <video ref={(v) => v && (v.srcObject = localStream)} autoPlay muted />
      )}
      {remoteStreams.map((stream, i) => (
        <video key={i} ref={(v) => v && (v.srcObject = stream)} autoPlay />
      ))}
    </div>
  );
}
