"use client";

import { useEffect, useRef, useState } from "react";
import { FiMic, FiMicOff, FiVideo, FiVideoOff, FiCircle } from "react-icons/fi";
import { ConnectionManager } from "@/lib/webrtc/connection-manager";
import { useSearchParams } from "next/navigation";

interface Participant {
  id: string;
  stream: MediaStream;
  isRecording: boolean;
  isMuted: boolean;
  isVideoOff: boolean;
}

export default function PodcastRoom() {
  const searchParams = useSearchParams();
  const roomId = searchParams.get("roomId") || "default-room";
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const connectionManagerRef = useRef<ConnectionManager | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const videoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());

  useEffect(() => {
    const initializeRoom = async () => {
      try {
        // Initialize connection manager
        const connectionManager = new ConnectionManager(roomId);
        connectionManagerRef.current = connectionManager;

        // Set up callbacks
        connectionManager.setOnTrack((stream, peerId) => {
          console.log("Received track from peer:", peerId);
          setParticipants((prev) => {
            const existing = prev.find((p) => p.id === peerId);
            if (existing) {
              return prev.map((p) => (p.id === peerId ? { ...p, stream } : p));
            }
            return [
              ...prev,
              {
                id: peerId,
                stream,
                isRecording: false,
                isMuted: false,
                isVideoOff: false,
              },
            ];
          });

          // Set up video element for the new stream
          const videoElement = videoRefs.current.get(peerId);
          if (videoElement) {
            videoElement.srcObject = stream;
          }
        });

        connectionManager.setOnRecordingComplete((blob, peerId) => {
          // Handle recording completion
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `recording-${peerId}-${Date.now()}.webm`;
          a.click();
          URL.revokeObjectURL(url);
        });

        // Initialize local stream
        const localStream = await connectionManager.initializeLocalStream();
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = localStream;
        }

        // Start signaling
        await connectionManager.startSignaling();
      } catch (error) {
        console.error("Error initializing room:", error);
      }
    };

    initializeRoom();

    return () => {
      if (connectionManagerRef.current) {
        connectionManagerRef.current.cleanup();
      }
    };
  }, [roomId]);

  // Update video elements when participants change
  useEffect(() => {
    participants.forEach((participant) => {
      const videoElement = videoRefs.current.get(participant.id);
      if (videoElement && videoElement.srcObject !== participant.stream) {
        videoElement.srcObject = participant.stream;
      }
    });
  }, [participants]);

  const toggleRecording = async () => {
    if (!connectionManagerRef.current) return;

    if (!isRecording) {
      // Start recording for all participants
      participants.forEach((participant) => {
        connectionManagerRef.current?.startRecording(participant.id);
      });
    } else {
      // Stop recording for all participants
      participants.forEach((participant) => {
        connectionManagerRef.current?.stopRecording(participant.id);
      });
    }

    setIsRecording(!isRecording);
  };

  const toggleMute = () => {
    if (!connectionManagerRef.current) return;

    const localStream = connectionManagerRef.current.getLocalStream();
    if (!localStream) return;

    const audioTrack = localStream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      setIsMuted(!isMuted);
    }
  };

  const toggleVideo = () => {
    if (!connectionManagerRef.current) return;

    const localStream = connectionManagerRef.current.getLocalStream();
    if (!localStream) return;

    const videoTrack = localStream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      setIsVideoOff(!isVideoOff);
    }
  };

  const setVideoRef = (
    element: HTMLVideoElement | null,
    participantId: string
  ) => {
    if (element) {
      videoRefs.current.set(participantId, element);
      // Set the stream if it exists
      const participant = participants.find((p) => p.id === participantId);
      if (participant) {
        element.srcObject = participant.stream;
      }
    } else {
      videoRefs.current.delete(participantId);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4 flex-grow">
        {/* Local video */}
        <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />
          <div className="absolute bottom-2 left-2 text-white text-sm">
            You {isMuted && "(Muted)"} {isVideoOff && "(Camera Off)"}
          </div>
        </div>

        {/* Remote videos */}
        {participants.map((participant) => (
          <div
            key={participant.id}
            className="relative aspect-video bg-black rounded-lg overflow-hidden"
          >
            <video
              ref={(el) => setVideoRef(el, participant.id)}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
            />
            <div className="absolute bottom-2 left-2 text-white text-sm">
              Participant {participant.id.slice(0, 4)}{" "}
              {participant.isMuted && "(Muted)"}{" "}
              {participant.isVideoOff && "(Camera Off)"}
            </div>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div className="flex justify-center items-center gap-4 p-4 bg-gray-900">
        <button
          onClick={toggleMute}
          className={`p-3 rounded-full ${
            isMuted ? "bg-red-500" : "bg-gray-700"
          } text-white hover:bg-opacity-80 transition-colors`}
        >
          {isMuted ? <FiMicOff size={24} /> : <FiMic size={24} />}
        </button>
        <button
          onClick={toggleVideo}
          className={`p-3 rounded-full ${
            isVideoOff ? "bg-red-500" : "bg-gray-700"
          } text-white hover:bg-opacity-80 transition-colors`}
        >
          {isVideoOff ? <FiVideoOff size={24} /> : <FiVideo size={24} />}
        </button>
        <button
          onClick={toggleRecording}
          className={`p-3 rounded-full ${
            isRecording ? "bg-red-500" : "bg-gray-700"
          } text-white hover:bg-opacity-80 transition-colors`}
        >
          <FiCircle size={24} />
        </button>
      </div>
    </div>
  );
}
