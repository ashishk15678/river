import { v4 as uuidv4 } from "uuid";

interface PeerConnection {
  peerId: string;
  connection: RTCPeerConnection;
  mediaStream: MediaStream | null;
  recorder: MediaRecorder | null;
  recordedChunks: Blob[];
}

export class ConnectionManager {
  private peerId: string;
  private roomId: string;
  private localStream: MediaStream | null = null;
  private peers: Map<string, PeerConnection> = new Map();
  private onTrackCallback:
    | ((stream: MediaStream, peerId: string) => void)
    | null = null;
  private onRecordingCompleteCallback:
    | ((blob: Blob, peerId: string) => void)
    | null = null;
  private signalingInterval: NodeJS.Timeout | null = null;
  private lastTimestamp: number = 0;
  private reconnectAttempts: Map<string, number> = new Map();
  private readonly MAX_RECONNECT_ATTEMPTS = 3;
  private readonly RECONNECT_DELAY = 2000;

  constructor(roomId: string) {
    this.peerId = uuidv4();
    this.roomId = roomId;
  }

  getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  async initializeLocalStream(
    constraints: MediaStreamConstraints = {
      video: {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        frameRate: { ideal: 30 },
      },
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    }
  ): Promise<MediaStream> {
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
      return this.localStream;
    } catch (error) {
      console.error("Error accessing media devices:", error);
      throw error;
    }
  }

  private async createPeerConnection(
    peerId: string
  ): Promise<RTCPeerConnection> {
    const configuration: RTCConfiguration = {
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
      ],
      iceCandidatePoolSize: 10,
      bundlePolicy: "max-bundle",
      rtcpMuxPolicy: "require",
      iceTransportPolicy: "all",
    };

    const connection = new RTCPeerConnection(configuration);

    // Add local tracks to the connection
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        connection.addTrack(track, this.localStream!);
      });
    }

    // Handle ICE candidates
    connection.onicecandidate = (event) => {
      if (event.candidate) {
        this.sendSignalingMessage({
          type: "ice-candidate",
          data: event.candidate,
          to: peerId,
        });
      }
    };

    // Handle connection state changes
    connection.onconnectionstatechange = () => {
      if (
        connection.connectionState === "disconnected" ||
        connection.connectionState === "failed"
      ) {
        this.handleDisconnection(peerId);
      }
    };

    // Handle incoming tracks
    connection.ontrack = (event) => {
      const stream = event.streams[0];
      if (this.onTrackCallback) {
        this.onTrackCallback(stream, peerId);
      }
    };

    return connection;
  }

  private async handleDisconnection(peerId: string) {
    const attempts = this.reconnectAttempts.get(peerId) || 0;
    if (attempts < this.MAX_RECONNECT_ATTEMPTS) {
      this.reconnectAttempts.set(peerId, attempts + 1);
      setTimeout(async () => {
        try {
          const connection = await this.createPeerConnection(peerId);
          const offer = await connection.createOffer();
          await connection.setLocalDescription(offer);
          await this.sendSignalingMessage({
            type: "offer",
            data: offer,
            to: peerId,
          });
        } catch (error) {
          console.error("Reconnection failed:", error);
        }
      }, this.RECONNECT_DELAY * (attempts + 1));
    } else {
      // Remove peer after max attempts
      const peer = this.peers.get(peerId);
      if (peer) {
        peer.connection.close();
        this.peers.delete(peerId);
      }
    }
  }

  private async sendSignalingMessage(message: {
    type: string;
    data: any;
    to?: string;
  }) {
    try {
      const response = await fetch("/api/webrtc/signal", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          roomId: this.roomId,
          from: this.peerId,
          ...message,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to send signaling message");
      }

      const data = await response.json();
      if (data.peers) {
        await this.handleSignalingResponse(data.peers);
      }
    } catch (error) {
      console.error("Error sending signaling message:", error);
    }
  }

  private async handleSignalingResponse(peers: any[]) {
    for (const peer of peers) {
      const { type, data, from } = peer;

      if (!this.peers.has(from)) {
        const connection = await this.createPeerConnection(from);
        this.peers.set(from, {
          peerId: from,
          connection,
          mediaStream: null,
          recorder: null,
          recordedChunks: [],
        });
      }

      const peerConnection = this.peers.get(from)!;

      try {
        switch (type) {
          case "offer":
            await peerConnection.connection.setRemoteDescription(
              new RTCSessionDescription(data)
            );
            const answer = await peerConnection.connection.createAnswer();
            await peerConnection.connection.setLocalDescription(answer);
            await this.sendSignalingMessage({
              type: "answer",
              data: answer,
              to: from,
            });
            break;

          case "answer":
            await peerConnection.connection.setRemoteDescription(
              new RTCSessionDescription(data)
            );
            break;

          case "ice-candidate":
            if (peerConnection.connection.remoteDescription) {
              await peerConnection.connection.addIceCandidate(
                new RTCIceCandidate(data)
              );
            }
            break;
        }
      } catch (error) {
        console.error("Error handling signaling response:", error);
      }
    }
  }

  async startSignaling() {
    // Start polling for signaling messages with exponential backoff
    let pollInterval = 1000;
    const maxInterval = 5000;

    const poll = async () => {
      try {
        const response = await fetch(
          `/api/webrtc/signal?roomId=${this.roomId}&from=${this.peerId}&lastTimestamp=${this.lastTimestamp}`
        );
        if (!response.ok) {
          throw new Error("Failed to fetch signaling messages");
        }

        const data = await response.json();
        if (data.peers && data.peers.length > 0) {
          await this.handleSignalingResponse(data.peers);
          pollInterval = 1000; // Reset interval on successful response
        }
        if (data.timestamp) {
          this.lastTimestamp = data.timestamp;
        }
      } catch (error) {
        console.error("Error polling signaling messages:", error);
        pollInterval = Math.min(pollInterval * 1.5, maxInterval); // Increase interval on error
      }

      this.signalingInterval = setTimeout(poll, pollInterval);
    };

    poll();

    // Create and send offer to all peers
    for (const [peerId, peerConnection] of this.peers.entries()) {
      const offer = await peerConnection.connection.createOffer();
      await peerConnection.connection.setLocalDescription(offer);
      await this.sendSignalingMessage({
        type: "offer",
        data: offer,
        to: peerId,
      });
    }
  }

  stopSignaling() {
    if (this.signalingInterval) {
      clearTimeout(this.signalingInterval);
      this.signalingInterval = null;
    }
  }

  setOnTrack(callback: (stream: MediaStream, peerId: string) => void) {
    this.onTrackCallback = callback;
  }

  setOnRecordingComplete(callback: (blob: Blob, peerId: string) => void) {
    this.onRecordingCompleteCallback = callback;
  }

  async startRecording(peerId: string) {
    const peer = this.peers.get(peerId);
    if (!peer || !peer.mediaStream) return;

    const recorder = new MediaRecorder(peer.mediaStream, {
      mimeType: "video/webm;codecs=vp8,opus",
      videoBitsPerSecond: 2500000, // 2.5 Mbps
      audioBitsPerSecond: 128000, // 128 kbps
    });

    recorder.ondataavailable = (event: BlobEvent) => {
      if (event.data.size > 0) {
        peer.recordedChunks.push(event.data);
      }
    };

    recorder.onstop = () => {
      const blob = new Blob(peer.recordedChunks, {
        type: "video/webm",
      });
      if (this.onRecordingCompleteCallback) {
        this.onRecordingCompleteCallback(blob, peerId);
      }
    };

    peer.recorder = recorder;
    recorder.start(1000); // Record in 1-second chunks
  }

  stopRecording(peerId: string) {
    const peer = this.peers.get(peerId);
    if (peer?.recorder && peer.recorder.state !== "inactive") {
      peer.recorder.stop();
    }
  }

  async cleanup() {
    this.stopSignaling();

    // Stop all tracks in local stream
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
    }

    // Close all peer connections
    for (const peer of this.peers.values()) {
      if (peer.connection) {
        peer.connection.close();
      }
      if (peer.mediaStream) {
        peer.mediaStream.getTracks().forEach((track) => track.stop());
      }
    }

    this.peers.clear();
    this.reconnectAttempts.clear();
  }
}
