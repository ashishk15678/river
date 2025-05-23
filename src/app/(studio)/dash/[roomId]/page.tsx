"use client";
// /pages/room/[roomId].tsx
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { v4 as uuidv4 } from "uuid";

const ICE_SERVERS = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

export default function Room() {
  const roomId = useSearchParams().get("roomId");
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);

  // Use state to manage remote streams and trigger re-renders
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(
    new Map()
  );

  useEffect(() => {
    if (!roomId) return;

    const connect = async () => {
      // 1. Get User Media
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        localStreamRef.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
      } catch (error) {
        console.error("Error accessing media devices.", error);
        return;
      }

      // 2. Connect to Signaling Server
      const socket = new WebSocket("ws://localhost:3001");
      socketRef.current = socket;

      socket.onopen = () => {
        console.log("✅ Connected to signaling server");
        socket.send(JSON.stringify({ type: "JOIN_ROOM", roomId }));
      };

      socket.onmessage = (event) => {
        const message = JSON.parse(event.data);
        console.log("Received message:", message.type);

        switch (message.type) {
          // When you first join, get a list of all participants
          case "ALL_PARTICIPANTS": {
            const { participantIds } = message.payload;
            participantIds.forEach((remoteId: string) => {
              createPeerConnection(remoteId, true);
            });
            break;
          }

          // When a new user joins the room
          case "USER_JOINED": {
            const { remoteId } = message.payload;
            createPeerConnection(remoteId, false);
            break;
          }

          // When you receive an offer from a peer
          case "offer": {
            const { from, offer } = message.payload;
            handleOffer(from, offer);
            break;
          }

          // When you receive an answer from a peer
          case "answer": {
            const { from, answer } = message.payload;
            handleAnswer(from, answer);
            break;
          }

          // When you receive an ICE candidate from a peer
          case "candidate": {
            const { from, candidate } = message.payload;
            handleIceCandidate(from, candidate);
            break;
          }

          // When a user leaves the room
          case "USER_LEFT": {
            const { remoteId } = message.payload;
            closePeerConnection(remoteId);
            break;
          }
        }
      };
    };

    connect();

    // Cleanup on component unmount
    return () => {
      socketRef.current?.close();
      localStreamRef.current?.getTracks().forEach((track) => track.stop());
      peerConnectionsRef.current.forEach((pc) => pc.close());
    };
  }, [roomId]);

  const createPeerConnection = (remoteId: string, isInitiator: boolean) => {
    if (peerConnectionsRef.current.has(remoteId)) return;

    const pc = new RTCPeerConnection(ICE_SERVERS);
    peerConnectionsRef.current.set(remoteId, pc);

    // Add local stream tracks to the peer connection
    localStreamRef.current?.getTracks().forEach((track) => {
      pc.addTrack(track, localStreamRef.current!);
    });

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socketRef.current?.send(
          JSON.stringify({
            type: "candidate",
            payload: { target: remoteId, candidate: event.candidate },
          })
        );
      }
    };

    pc.ontrack = (event) => {
      setRemoteStreams((prev) => new Map(prev).set(remoteId, event.streams[0]));
    };

    if (isInitiator) {
      pc.createOffer()
        .then((offer) => pc.setLocalDescription(offer))
        .then(() => {
          socketRef.current?.send(
            JSON.stringify({
              type: "offer",
              payload: { target: remoteId, offer: pc.localDescription },
            })
          );
        });
    }
  };

  const handleOffer = async (
    from: string,
    offer: RTCSessionDescriptionInit
  ) => {
    createPeerConnection(from, false);
    const pc = peerConnectionsRef.current.get(from);
    if (pc) {
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socketRef.current?.send(
        JSON.stringify({
          type: "answer",
          payload: { target: from, answer: pc.localDescription },
        })
      );
    }
  };

  const handleAnswer = (from: string, answer: RTCSessionDescriptionInit) => {
    const pc = peerConnectionsRef.current.get(from);
    if (pc) {
      pc.setRemoteDescription(new RTCSessionDescription(answer));
    }
  };

  const handleIceCandidate = (from: string, candidate: RTCIceCandidateInit) => {
    const pc = peerConnectionsRef.current.get(from);
    if (pc) {
      pc.addIceCandidate(new RTCIceCandidate(candidate));
    }
  };

  const closePeerConnection = (remoteId: string) => {
    const pc = peerConnectionsRef.current.get(remoteId);
    if (pc) {
      pc.close();
      peerConnectionsRef.current.delete(remoteId);
      setRemoteStreams((prev) => {
        const newStreams = new Map(prev);
        newStreams.delete(remoteId);
        return newStreams;
      });
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", padding: "10px" }}>
      <h1>Room: {roomId}</h1>
      <div style={{ display: "flex", flexWrap: "wrap" }}>
        <div style={{ border: "1px solid black", margin: "5px" }}>
          <h3>You</h3>
          <video
            ref={localVideoRef}
            autoPlay
            muted
            playsInline
            style={{ width: "300px" }}
          />
        </div>
        {Array.from(remoteStreams.entries()).map(([id, stream]) => (
          <div key={id} style={{ border: "1px solid black", margin: "5px" }}>
            <h3>User: {id.substring(0, 6)}</h3>
            <video
              autoPlay
              playsInline
              style={{ width: "300px" }}
              ref={(video) => {
                if (video) video.srcObject = stream;
              }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
