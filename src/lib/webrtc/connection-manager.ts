import { toast } from "sonner";

interface PeerConnection {
  peerId: string;
  connection: RTCPeerConnection;
  mediaStream: MediaStream | null;
  recorder: MediaRecorder | null;
  recordedChunks: Blob[];
  displayName: string;
  lastActivity: number;
  reconnectAttempts: number;
  isReconnecting: boolean;
}

interface SignalingMessage {
  id: string;
  type: "OFFER" | "ANSWER" | "ICE_CANDIDATE" | "JOIN" | "LEAVE" | "ERROR";
  fromId: string;
  toId: string | null;
  data: {
    offer?: RTCSessionDescriptionInit;
    answer?: RTCSessionDescriptionInit;
    candidate?: RTCIceCandidateInit;
    error?: string;
  };
  from: {
    user: {
      name: string | null;
      image: string | null;
    };
  };
}

interface IceServer {
  urls: string;
  username?: string;
  credential?: string;
}

interface ConnectionState {
  isConnected: boolean;
  isReconnecting: boolean;
  error: string | null;
  stats: {
    bytesReceived: number;
    bytesSent: number;
    packetsLost: number;
    roundTripTime: number;
  };
}

export class ConnectionManager {
  private roomId: string;
  private participantId: string | null = null;
  private localStream: MediaStream | null = null;
  private peers: Map<string, PeerConnection> = new Map();
  private onTrackCallback:
    | ((stream: MediaStream, peerId: string, displayName: string) => void)
    | null = null;
  private onConnectionStateChange:
    | ((peerId: string, state: ConnectionState) => void)
    | null = null;
  private signalingInterval: NodeJS.Timeout | null = null;
  private statsInterval: NodeJS.Timeout | null = null;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 2000;
  private iceServers: IceServer[] = [
    // Public STUN servers
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
    { urls: "stun:stun3.l.google.com:19302" },
    { urls: "stun:stun4.l.google.com:19302" },
    { urls: "stun:stun.ekiga.net" },
    { urls: "stun:stun.ideasip.com" },
    { urls: "stun:stun.schlund.de" },
    { urls: "stun:stun.stunprotocol.org:3478" },
    { urls: "stun:stun.voiparound.com" },
    { urls: "stun:stun.voipbuster.com" },
    { urls: "stun:stun.voipstunt.com" },
    { urls: "stun:stun.voxgratia.org" },
  ];

  constructor(roomId: string) {
    this.roomId = roomId;
  }

  setOnTrack(
    callback: (stream: MediaStream, peerId: string, displayName: string) => void
  ) {
    this.onTrackCallback = callback;
  }

  setOnConnectionStateChange(
    callback: (peerId: string, state: ConnectionState) => void
  ) {
    this.onConnectionStateChange = callback;
  }

  async initializeLocalStream(): Promise<MediaStream> {
    try {
      // Try to get both audio and video
      const stream = await navigator.mediaDevices.getUserMedia({
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
      });
      this.localStream = stream;
      return stream;
    } catch (error) {
      console.log(
        "Failed to get both audio and video, trying audio only:",
        error
      );
      try {
        // Try audio only
        const audioStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
          video: false,
        });
        this.localStream = audioStream;
        return audioStream;
      } catch (audioError) {
        console.log("Failed to get audio, trying video only:", audioError);
        try {
          // Try video only
          const videoStream = await navigator.mediaDevices.getUserMedia({
            video: {
              width: { ideal: 1280 },
              height: { ideal: 720 },
              frameRate: { ideal: 30 },
            },
            audio: false,
          });
          this.localStream = videoStream;
          return videoStream;
        } catch (videoError) {
          console.log("Failed to get any media devices:", videoError);
          // Return an empty stream if no permissions are granted
          this.localStream = new MediaStream();
          return this.localStream;
        }
      }
    }
  }

  getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  private createPeerConnection(peerId: string): RTCPeerConnection {
    const configuration: RTCConfiguration = {
      iceServers: this.iceServers,
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

    // Handle incoming tracks
    connection.ontrack = (event) => {
      console.log("Received track from peer:", peerId);
      if (this.onTrackCallback) {
        const peer = this.peers.get(peerId);
        this.onTrackCallback(
          event.streams[0],
          peerId,
          peer?.displayName || "Unknown"
        );
      }
    };

    // Handle ICE candidates
    connection.onicecandidate = (event) => {
      if (event.candidate) {
        console.log("New ICE candidate:", event.candidate);
        this.sendSignalingMessage({
          type: "ICE_CANDIDATE",
          candidate: event.candidate,
        });
      }
    };

    // Handle ICE connection state changes
    connection.oniceconnectionstatechange = () => {
      console.log(
        `ICE connection state with ${peerId}:`,
        connection.iceConnectionState
      );
      if (connection.iceConnectionState === "failed") {
        console.log("ICE connection failed, attempting to restart...");
        this.restartIce(peerId);
      }
    };

    // Handle connection state changes
    connection.onconnectionstatechange = () => {
      console.log(
        `Connection state with ${peerId}:`,
        connection.connectionState
      );
      const peer = this.peers.get(peerId);
      if (!peer) return;

      if (connection.connectionState === "failed") {
        console.log("Connection failed, attempting to reconnect...");
        this.cleanupPeer(peerId);
        // Try to reconnect after a short delay
        setTimeout(() => {
          this.reconnectPeer(peerId);
        }, this.reconnectDelay);
      }

      // Update connection state
      if (this.onConnectionStateChange) {
        this.onConnectionStateChange(peerId, {
          isConnected: connection.connectionState === "connected",
          isReconnecting: peer.isReconnecting,
          error:
            connection.connectionState === "failed"
              ? "Connection failed"
              : null,
          stats: {
            bytesReceived: 0,
            bytesSent: 0,
            packetsLost: 0,
            roundTripTime: 0,
          },
        });
      }
    };

    // Handle ICE gathering state changes
    connection.onicegatheringstatechange = () => {
      console.log(
        `ICE gathering state with ${peerId}:`,
        connection.iceGatheringState
      );
    };

    // Handle negotiation needed
    connection.onnegotiationneeded = async () => {
      try {
        const offer = await connection.createOffer();
        await connection.setLocalDescription(offer);
        await this.sendSignalingMessage({
          type: "OFFER",
          offer,
          toId: peerId,
        });
      } catch (error) {
        console.error("Error during negotiation:", error);
      }
    };

    return connection;
  }

  private async restartIce(peerId: string) {
    const peer = this.peers.get(peerId);
    if (!peer) return;

    try {
      const offer = await peer.connection.createOffer({ iceRestart: true });
      await peer.connection.setLocalDescription(offer);
      await this.sendSignalingMessage({
        type: "OFFER",
        offer,
        toId: peerId,
      });
    } catch (error) {
      console.error("Error restarting ICE:", error);
    }
  }

  private async reconnectPeer(peerId: string) {
    console.log("Attempting to reconnect peer:", peerId);
    const peer = this.peers.get(peerId);
    if (!peer) return;

    if (peer.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log("Max reconnection attempts reached");
      if (this.onConnectionStateChange) {
        this.onConnectionStateChange(peerId, {
          isConnected: false,
          isReconnecting: false,
          error: "Max reconnection attempts reached",
          stats: {
            bytesReceived: 0,
            bytesSent: 0,
            packetsLost: 0,
            roundTripTime: 0,
          },
        });
      }
      return;
    }

    peer.isReconnecting = true;
    peer.reconnectAttempts++;

    try {
      // Create a new offer
      const offer = await peer.connection.createOffer({
        iceRestart: true,
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
      });

      await peer.connection.setLocalDescription(offer);
      await this.sendSignalingMessage({
        type: "OFFER",
        offer,
        toId: peerId,
      });
    } catch (error) {
      console.error("Error reconnecting peer:", error);
      peer.isReconnecting = false;
    }
  }

  private async handleOffer(
    offer: RTCSessionDescriptionInit,
    fromId: string,
    displayName: string
  ) {
    console.log("Handling offer from:", fromId);
    let peerConnection = this.peers.get(fromId)?.connection;

    if (!peerConnection) {
      peerConnection = this.createPeerConnection(fromId);
      this.peers.set(fromId, {
        peerId: fromId,
        connection: peerConnection,
        mediaStream: null,
        recorder: null,
        recordedChunks: [],
        displayName,
        lastActivity: Date.now(),
        reconnectAttempts: 0,
        isReconnecting: false,
      });
    }

    try {
      await peerConnection.setRemoteDescription(
        new RTCSessionDescription(offer)
      );
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);

      await this.sendSignalingMessage({
        type: "ANSWER",
        answer,
        toId: fromId,
      });
    } catch (error) {
      console.error("Error handling offer:", error);
      this.cleanupPeer(fromId);
    }
  }

  private async handleAnswer(
    answer: RTCSessionDescriptionInit,
    fromId: string
  ) {
    console.log("Handling answer from:", fromId);
    const peerConnection = this.peers.get(fromId)?.connection;
    if (peerConnection) {
      try {
        await peerConnection.setRemoteDescription(
          new RTCSessionDescription(answer)
        );
        const peer = this.peers.get(fromId);
        if (peer) {
          peer.isReconnecting = false;
          peer.reconnectAttempts = 0;
        }
      } catch (error) {
        console.error("Error handling answer:", error);
        this.cleanupPeer(fromId);
      }
    }
  }

  private async handleCandidate(
    candidate: RTCIceCandidateInit,
    fromId: string
  ) {
    console.log("Handling candidate from:", fromId);
    const peerConnection = this.peers.get(fromId)?.connection;
    if (peerConnection) {
      try {
        await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (error) {
        console.error("Error handling candidate:", error);
      }
    }
  }

  private async sendSignalingMessage(message: {
    type: "OFFER" | "ANSWER" | "ICE_CANDIDATE" | "JOIN" | "LEAVE" | "ERROR";
    offer?: RTCSessionDescriptionInit;
    answer?: RTCSessionDescriptionInit;
    candidate?: RTCIceCandidateInit;
    toId?: string;
  }) {
    try {
      const response = await fetch("/api/webrtc/signal", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          roomId: this.roomId,
          ...message,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to send signaling message");
      }

      const data = await response.json();
      console.log("Signaling message response:", data);

      return data;
    } catch (error) {
      console.error("Error sending signaling message:", error);
      throw error;
    }
  }

  private async fetchSignalingMessages() {
    if (!this.participantId) {
      console.log("No participant ID yet, skipping message fetch");
      return;
    }

    try {
      const response = await fetch(`/api/webrtc/signal?roomId=${this.roomId}`);
      if (!response.ok) {
        const errorData = await response.json();
        if (errorData.error === "Participant not found") {
          console.log("Participant not found, retrying JOIN message");
          await this.sendSignalingMessage({ type: "JOIN" });
          return;
        }
        throw new Error(
          errorData.error || "Failed to fetch signaling messages"
        );
      }

      const messages: SignalingMessage[] = await response.json();
      console.log("Received signaling messages:", messages);

      if (!Array.isArray(messages)) {
        console.error("Invalid messages format:", messages);
        return;
      }

      for (const message of messages) {
        // Skip our own messages
        if (message.fromId === this.participantId) {
          console.log("Skipping own message:", message);
          continue;
        }

        console.log("Processing message:", message);

        switch (message.type) {
          case "OFFER":
            if (!message.data.offer) {
              console.error("Missing offer data in message:", message);
              continue;
            }
            await this.handleOffer(
              message.data.offer,
              message.fromId,
              message.from.user.name || "Unknown"
            );
            break;
          case "ANSWER":
            if (!message.data.answer) {
              console.error("Missing answer data in message:", message);
              continue;
            }
            await this.handleAnswer(message.data.answer, message.fromId);
            break;
          case "ICE_CANDIDATE":
            if (!message.data.candidate) {
              console.error("Missing candidate data in message:", message);
              continue;
            }
            await this.handleCandidate(message.data.candidate, message.fromId);
            break;
          case "ERROR":
            console.error("Received error message:", message.data.error);
            if (this.onConnectionStateChange) {
              this.onConnectionStateChange(message.fromId, {
                isConnected: false,
                isReconnecting: false,
                error: message.data.error || "Unknown error",
                stats: {
                  bytesReceived: 0,
                  bytesSent: 0,
                  packetsLost: 0,
                  roundTripTime: 0,
                },
              });
            }
            break;
          default:
            console.warn("Unknown message type:", message.type);
        }
      }
    } catch (error) {
      console.error("Error fetching signaling messages:", error);
    }
  }

  private async updateConnectionStats() {
    for (const [peerId, peer] of this.peers.entries()) {
      try {
        const stats = await peer.connection.getStats();
        let bytesReceived = 0;
        let bytesSent = 0;
        let packetsLost = 0;
        let roundTripTime = 0;

        stats.forEach((report) => {
          if (report.type === "inbound-rtp" && report.kind === "video") {
            bytesReceived += report.bytesReceived || 0;
            packetsLost += report.packetsLost || 0;
          }
          if (report.type === "outbound-rtp" && report.kind === "video") {
            bytesSent += report.bytesSent || 0;
          }
          if (report.type === "candidate-pair" && report.selected) {
            roundTripTime = report.currentRoundTripTime || 0;
          }
        });

        if (this.onConnectionStateChange) {
          this.onConnectionStateChange(peerId, {
            isConnected: peer.connection.connectionState === "connected",
            isReconnecting: peer.isReconnecting,
            error: null,
            stats: {
              bytesReceived,
              bytesSent,
              packetsLost,
              roundTripTime,
            },
          });
        }
      } catch (error) {
        console.error("Error getting connection stats:", error);
      }
    }
  }

  async startSignaling() {
    console.log("Starting signaling for room:", this.roomId);

    try {
      // First, ensure we have a participant ID by sending a JOIN message
      const joinResponse = await this.sendSignalingMessage({
        type: "JOIN",
      });

      if (!joinResponse.success || !joinResponse.message?.fromId) {
        throw new Error("Failed to get participant ID");
      }

      this.participantId = joinResponse.message.fromId;
      console.log("Got participant ID:", this.participantId);

      // Start polling for signaling messages
      this.signalingInterval = setInterval(
        () => this.fetchSignalingMessages(),
        1000
      );

      // Start collecting connection stats
      this.statsInterval = setInterval(
        () => this.updateConnectionStats(),
        2000
      );

      // Only create and send initial offer if we're the host
      if (joinResponse.message.role === "HOST") {
        console.log("Creating initial offer as host");
        const peerConnection = this.createPeerConnection(this.roomId);
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);

        await this.sendSignalingMessage({
          type: "OFFER",
          offer,
        });
      }
    } catch (error) {
      console.error("Error in startSignaling:", error);
      throw error;
    }
  }

  private cleanupPeer(peerId: string) {
    const peer = this.peers.get(peerId);
    if (peer) {
      if (peer.connection) {
        peer.connection.close();
      }
      if (peer.mediaStream) {
        peer.mediaStream.getTracks().forEach((track) => track.stop());
      }
      this.peers.delete(peerId);
    }
  }

  cleanup() {
    if (this.signalingInterval) {
      clearInterval(this.signalingInterval);
    }
    if (this.statsInterval) {
      clearInterval(this.statsInterval);
    }
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
    }
    for (const peerId of this.peers.keys()) {
      this.cleanupPeer(peerId);
    }
  }

  startRecording(peerId: string) {
    const peer = this.peers.get(peerId);
    if (peer && peer.mediaStream) {
      const recorder = new MediaRecorder(peer.mediaStream, {
        mimeType: "video/webm;codecs=vp9,opus",
      });
      peer.recorder = recorder;
      peer.recordedChunks = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          peer.recordedChunks.push(event.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(peer.recordedChunks, { type: "video/webm" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `recording-${peerId}-${Date.now()}.webm`;
        a.click();
        URL.revokeObjectURL(url);
      };

      recorder.start(1000); // Collect data every second
    }
  }

  stopRecording(peerId: string) {
    const peer = this.peers.get(peerId);
    if (peer && peer.recorder) {
      peer.recorder.stop();
      peer.recorder = null;
    }
  }
}
