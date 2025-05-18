"use client";

import React, { useState, useEffect, useRef } from "react";
import Peer from "peerjs";

const ClientComponent: React.FC = () => {
  const [peerId, setPeerId] = useState<string | null>(null);
  const [hostIdInput, setHostIdInput] = useState<string>("");
  const [isConnected, setIsConnected] = useState(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const peerInstance = useRef<Peer | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const initializePeer = async () => {
      try {
        // Get local stream
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        setLocalStream(stream);
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }

        // Initialize PeerJS
        const { default: Peer } = await import("peerjs");
        const peer = new Peer();
        peerInstance.current = peer;

        peer.on("open", (id) => {
          console.log("Client ID:", id);
          setPeerId(id);
        });

        peer.on("call", (call) => {
          console.log("Incoming call from host");
          call.answer(localStream);

          call.on("stream", (stream) => {
            console.log("Received host stream");
            setRemoteStream(stream);
            if (remoteVideoRef.current) {
              remoteVideoRef.current.srcObject = stream;
            }
          });

          call.on("close", () => {
            console.log("Call closed");
            setRemoteStream(null);
            setIsConnected(false);
          });

          call.on("error", (err) => {
            console.error("Call error:", err);
            setRemoteStream(null);
            setIsConnected(false);
          });
        });

        peer.on("error", (err) => console.error("Peer error:", err));
      } catch (err) {
        console.error("Failed to initialize:", err);
      }
    };

    initializePeer();

    return () => {
      localStream?.getTracks().forEach((track) => track.stop());
      peerInstance.current?.destroy();
    };
  }, []);

  const connectToHost = () => {
    if (!peerInstance.current || !hostIdInput || isConnected) return;

    console.log("Connecting to host:", hostIdInput);
    const conn = peerInstance.current.connect(hostIdInput);

    conn.on("open", () => {
      console.log("Connected to host");
      setIsConnected(true);
    });

    conn.on("close", () => {
      console.log("Disconnected from host");
      setIsConnected(false);
      setRemoteStream(null);
    });

    conn.on("error", (err) => {
      console.error("Connection error:", err);
      setIsConnected(false);
      setRemoteStream(null);
    });
  };

  return (
    <div className="p-4 border border-blue-500 rounded-lg">
      <h2 className="text-xl font-bold mb-4">Client</h2>
      <div className="mb-4">
        <p>
          Your ID:{" "}
          <span className="font-mono bg-gray-100 px-2 py-1 rounded">
            {peerId || "Connecting..."}
          </span>
        </p>
      </div>

      {!isConnected && (
        <div className="mb-4">
          <input
            type="text"
            placeholder="Enter Host ID"
            value={hostIdInput}
            onChange={(e) => setHostIdInput(e.target.value)}
            className="border rounded px-2 py-1 mr-2"
          />
          <button
            onClick={connectToHost}
            disabled={!hostIdInput || !peerId}
            className="bg-blue-500 text-white px-4 py-1 rounded disabled:opacity-50"
          >
            Connect
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <h3 className="font-semibold mb-2">My Video</h3>
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="w-full border rounded"
          />
        </div>
        <div>
          <h3 className="font-semibold mb-2">Host Video</h3>
          {remoteStream ? (
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="w-full border rounded"
            />
          ) : (
            isConnected && (
              <p className="text-gray-500">Waiting for host video...</p>
            )
          )}
        </div>
      </div>
    </div>
  );
};

export default ClientComponent;
