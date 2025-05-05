"use client";

import { useEffect, useRef, useState } from "react";
import { FiMic, FiMicOff, FiVideo, FiVideoOff, FiCircle } from "react-icons/fi";
import { ConnectionManager } from "@/lib/webrtc/connection-manager";
import { toast } from "sonner";

interface Participant {
  id: string;
  stream: MediaStream;
  isRecording: boolean;
  isMuted: boolean;
  isVideoOff: boolean;
  displayName: string;
  isHost: boolean;
  isLocal: boolean;
}

interface PodcastRoomProps {
  roomId: string;
}

export default function PodcastRoom({ roomId }: PodcastRoomProps) {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const connectionManagerRef = useRef<ConnectionManager | null>(null);
  const videoRefs = useRef<{ [key: string]: HTMLVideoElement }>({});
  const localParticipantId = useRef<string>("");

  useEffect(() => {
    const initializeRoom = async () => {
      try {
        // Get room info
        const roomInfo = localStorage.getItem("roomInfo");
        const guestInfo = localStorage.getItem("guestInfo");

        if (!roomInfo) {
          throw new Error("No room information found");
        }

        const { isHost } = JSON.parse(roomInfo);
        const guestData = guestInfo ? JSON.parse(guestInfo) : null;

        // Generate unique local participant ID
        localParticipantId.current = `local-${Math.random()
          .toString(36)
          .substring(2, 9)}`;

        // Initialize connection manager
        const manager = new ConnectionManager(roomId);
        connectionManagerRef.current = manager;

        // Set up local media stream
        const localStream = await manager.initializeLocalStream();

        // Add local participant
        setParticipants((prev) => {
          // Remove any existing local participant
          const others = prev.filter((p) => !p.isLocal);
          return [
            ...others,
            {
              id: localParticipantId.current,
              stream: localStream,
              isRecording: false,
              isMuted: false,
              isVideoOff: false,
              displayName: isHost ? "Host" : guestData?.displayName || "You",
              isHost,
              isLocal: true,
            },
          ];
        });

        // Set up track handling
        manager.setOnTrack((stream, peerId) => {
          console.log("Received track from peer:", peerId);
          setParticipants((prev) => {
            // Check if participant already exists
            const existing = prev.find((p) => p.id === peerId);
            if (existing) {
              return prev.map((p) => (p.id === peerId ? { ...p, stream } : p));
            }

            // Add new participant
            return [
              ...prev,
              {
                id: peerId,
                stream,
                isRecording: false,
                isMuted: false,
                isVideoOff: false,
                displayName: `Participant ${prev.length}`,
                isHost: false,
                isLocal: false,
              },
            ];
          });
        });

        // Start signaling
        await manager.startSignaling();

        toast.success("Connected to room");
      } catch (error) {
        console.error("Error initializing room:", error);
        toast.error("Failed to initialize room");
      }
    };

    initializeRoom();

    return () => {
      // Cleanup
      if (connectionManagerRef.current) {
        connectionManagerRef.current.cleanup();
      }
    };
  }, [roomId]);

  const toggleRecording = () => {
    if (!connectionManagerRef.current) return;

    if (!isRecording) {
      connectionManagerRef.current.startRecording(localParticipantId.current);
      setIsRecording(true);
      setParticipants((prev) =>
        prev.map((p) =>
          p.id === localParticipantId.current ? { ...p, isRecording: true } : p
        )
      );
      toast.success("Recording started");
    } else {
      connectionManagerRef.current.stopRecording(localParticipantId.current);
      setIsRecording(false);
      setParticipants((prev) =>
        prev.map((p) =>
          p.id === localParticipantId.current ? { ...p, isRecording: false } : p
        )
      );
      toast.success("Recording stopped");
    }
  };

  const toggleMute = () => {
    if (!connectionManagerRef.current) return;

    const localStream = connectionManagerRef.current.getLocalStream();
    if (localStream) {
      localStream.getAudioTracks().forEach((track) => {
        track.enabled = isMuted;
      });
      setIsMuted(!isMuted);
      setParticipants((prev) =>
        prev.map((p) =>
          p.id === localParticipantId.current ? { ...p, isMuted: !isMuted } : p
        )
      );
    }
  };

  const toggleVideo = () => {
    if (!connectionManagerRef.current) return;

    const localStream = connectionManagerRef.current.getLocalStream();
    if (localStream) {
      localStream.getVideoTracks().forEach((track) => {
        track.enabled = isVideoOff;
      });
      setIsVideoOff(!isVideoOff);
      setParticipants((prev) =>
        prev.map((p) =>
          p.id === localParticipantId.current
            ? { ...p, isVideoOff: !isVideoOff }
            : p
        )
      );
    }
  };

  const setVideoRef = (id: string, element: HTMLVideoElement | null) => {
    if (element) {
      videoRefs.current[id] = element;
      const participant = participants.find((p) => p.id === id);
      if (participant) {
        element.srcObject = participant.stream;
      }
    }
  };

  // Sort participants: local first, then hosts, then others
  const sortedParticipants = [...participants].sort((a, b) => {
    if (a.isLocal) return -1;
    if (b.isLocal) return 1;
    if (a.isHost && !b.isHost) return -1;
    if (!a.isHost && b.isHost) return 1;
    return 0;
  });

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sortedParticipants.map((participant) => (
          <div
            key={participant.id}
            className="relative aspect-video bg-gray-900 rounded-lg overflow-hidden"
          >
            <video
              ref={(el) => setVideoRef(participant.id, el)}
              autoPlay
              playsInline
              muted={participant.isLocal}
              className="w-full h-full object-cover"
            />
            <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/50 to-transparent">
              <div className="flex items-center gap-2">
                <p className="text-white text-sm">{participant.displayName}</p>
                {participant.isHost && (
                  <span className="px-2 py-0.5 bg-blue-500 text-white text-xs rounded-full">
                    Host
                  </span>
                )}
                {participant.isMuted && (
                  <span className="px-2 py-0.5 bg-red-500 text-white text-xs rounded-full">
                    Muted
                  </span>
                )}
              </div>
            </div>
            {participant.isRecording && (
              <div className="absolute top-2 right-2">
                <div className="flex items-center gap-1 bg-red-500 text-white px-2 py-1 rounded-full text-xs">
                  <FiCircle className="animate-pulse" />
                  REC
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 flex items-center gap-4 bg-white/90 backdrop-blur-sm px-6 py-3 rounded-full shadow-lg">
        <button
          onClick={toggleMute}
          className={`p-3 rounded-full ${
            isMuted ? "bg-red-500 text-white" : "bg-gray-200"
          }`}
        >
          {isMuted ? <FiMicOff /> : <FiMic />}
        </button>
        <button
          onClick={toggleVideo}
          className={`p-3 rounded-full ${
            isVideoOff ? "bg-red-500 text-white" : "bg-gray-200"
          }`}
        >
          {isVideoOff ? <FiVideoOff /> : <FiVideo />}
        </button>
        <button
          onClick={toggleRecording}
          className={`p-3 rounded-full ${
            isRecording ? "bg-red-500 text-white" : "bg-gray-200"
          }`}
        >
          <FiCircle />
        </button>
      </div>
    </div>
  );
}
