"use client";

import React, { useState, useEffect, useRef } from "react";
import Peer from "peerjs";

const HostComponent: React.FC = () => {
  const [peerId, setPeerId] = useState<string | null>(null);
  const [connections, setConnections] = useState<string[]>([]);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const peerInstance = useRef<Peer | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const initializePeer = async () => {
      try {
        // Get local stream
        console.log("Host: Requesting user media...");
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        console.log(
          "Host: Got local stream with tracks:",
          stream.getTracks().map((t) => t.kind)
        );
        setLocalStream(stream);
        if (localVideoRef.current) {
          console.log("Host: Setting local video stream");
          localVideoRef.current.srcObject = stream;
          // Force video to play
          localVideoRef.current.play().catch((err) => {
            console.error("Host: Error playing local video:", err);
          });
        }

        // Initialize PeerJS
        console.log("Host: Initializing PeerJS...");
        const { default: Peer } = await import("peerjs");
        const peer = new Peer();
        peerInstance.current = peer;

        peer.on("open", (id) => {
          console.log("Host: PeerJS opened with ID:", id);
          setPeerId(id);
        });

        peer.on("connection", (conn) => {
          console.log("Host: New connection from:", conn.peer);
          setConnections((prev) => [...prev, conn.peer]);

          // Send video stream to new connection
          if (localStream && peerInstance.current) {
            console.log("Host: Initiating call to", conn.peer);
            const call = peer.call(conn.peer, localStream);

            call.on("stream", (stream) => {
              console.log(
                "Host: Received stream from peer (unexpected):",
                conn.peer
              );
            });

            call.on("close", () => {
              console.log("Host: Call closed with", conn.peer);
            });

            call.on("error", (err) => {
              console.error("Host: Call error with", conn.peer, ":", err);
            });
          } else {
            console.error(
              "Host: Cannot initiate call - no local stream or peer instance"
            );
          }

          conn.on("close", () => {
            console.log("Host: Connection closed:", conn.peer);
            setConnections((prev) => prev.filter((id) => id !== conn.peer));
          });

          conn.on("error", (err) => {
            console.error("Host: Connection error with", conn.peer, ":", err);
          });
        });

        peer.on("error", (err) => console.error("Host: Peer error:", err));
      } catch (err) {
        console.error("Host: Failed to initialize:", err);
      }
    };

    initializePeer();

    return () => {
      console.log("Host: Cleaning up...");
      localStream?.getTracks().forEach((track) => {
        console.log("Host: Stopping track:", track.kind);
        track.stop();
      });
      peerInstance.current?.destroy();
    };
  }, []);

  return (
    <div className="p-4 border border-green-500 rounded-lg">
      <h2 className="text-xl font-bold mb-4">Host</h2>
      <div className="mb-4">
        <p>
          Your ID:{" "}
          <span className="font-mono bg-gray-100 px-2 py-1 rounded">
            {peerId || "Connecting..."}
          </span>
        </p>
      </div>

      <div className="mb-4">
        <video
          ref={localVideoRef}
          autoPlay
          playsInline
          muted
          className="w-64 border rounded"
        />
      </div>

      <div>
        <h3 className="font-semibold mb-2">
          Connected Peers ({connections.length}):
        </h3>
        <ul className="list-disc list-inside">
          {connections.map((id) => (
            <li key={id} className="font-mono">
              {id}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default HostComponent;
