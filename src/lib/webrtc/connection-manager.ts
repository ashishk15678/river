import { toast } from "sonner";

interface PeerConnection {
  peerId: string;
  connection: RTCPeerConnection;
  mediaStream: MediaStream | null;
  recorder: MediaRecorder | null;
  recordedChunks: Blob[];
}

export class ConnectionManager {
  private roomId: string;
  private localStream: MediaStream | null = null;
  private peers: Map<string, PeerConnection> = new Map();
  private onTrackCallback:
    | ((stream: MediaStream, peerId: string) => void)
    | null = null;
  private signalingInterval: NodeJS.Timeout | null = null;

  constructor(roomId: string) {
    this.roomId = roomId;
  }

  async initializeLocalStream(): Promise<MediaStream> {
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      return this.localStream;
    } catch (error) {
      console.error("Error accessing media devices:", error);
      throw new Error("Failed to access camera and microphone");
    }
  }

  getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  setOnTrack(callback: (stream: MediaStream, peerId: string) => void) {
    this.onTrackCallback = callback;
  }

  private createPeerConnection(peerId: string): RTCPeerConnection {
    const configuration = {
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
      ],
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
        this.onTrackCallback(event.streams[0], peerId);
      }
    };

    // Handle ICE candidates
    connection.onicecandidate = (event) => {
      if (event.candidate) {
        this.sendSignalingMessage({
          type: "candidate",
          from: this.roomId,
          to: peerId,
          candidate: event.candidate,
        });
      }
    };

    // Handle connection state changes
    connection.onconnectionstatechange = () => {
      console.log(
        `Connection state with ${peerId}:`,
        connection.connectionState
      );
      if (connection.connectionState === "failed") {
        this.cleanupPeer(peerId);
      }
    };

    return connection;
  }

  private async handleOffer(offer: RTCSessionDescriptionInit, from: string) {
    console.log("Handling offer from:", from);
    let peerConnection = this.peers.get(from)?.connection;

    if (!peerConnection) {
      peerConnection = this.createPeerConnection(from);
      this.peers.set(from, {
        peerId: from,
        connection: peerConnection,
        mediaStream: null,
        recorder: null,
        recordedChunks: [],
      });
    }

    try {
      await peerConnection.setRemoteDescription(
        new RTCSessionDescription(offer)
      );
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);

      this.sendSignalingMessage({
        type: "answer",
        from: this.roomId,
        to: from,
        answer,
      });
    } catch (error) {
      console.error("Error handling offer:", error);
      this.cleanupPeer(from);
    }
  }

  private async handleAnswer(answer: RTCSessionDescriptionInit, from: string) {
    console.log("Handling answer from:", from);
    const peerConnection = this.peers.get(from)?.connection;
    if (peerConnection) {
      try {
        await peerConnection.setRemoteDescription(
          new RTCSessionDescription(answer)
        );
      } catch (error) {
        console.error("Error handling answer:", error);
        this.cleanupPeer(from);
      }
    }
  }

  private async handleCandidate(candidate: RTCIceCandidateInit, from: string) {
    console.log("Handling candidate from:", from);
    const peerConnection = this.peers.get(from)?.connection;
    if (peerConnection) {
      try {
        await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (error) {
        console.error("Error handling candidate:", error);
      }
    }
  }

  private async sendSignalingMessage(message: any) {
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
        throw new Error("Failed to send signaling message");
      }
    } catch (error) {
      console.error("Error sending signaling message:", error);
    }
  }

  private async fetchSignalingMessages() {
    try {
      const response = await fetch(`/api/webrtc/signal?roomId=${this.roomId}`);
      if (!response.ok) {
        throw new Error("Failed to fetch signaling messages");
      }

      const messages = await response.json();
      console.log("Received signaling messages:", messages);

      for (const message of messages) {
        switch (message.type) {
          case "offer":
            await this.handleOffer(message.offer, message.from);
            break;
          case "answer":
            await this.handleAnswer(message.answer, message.from);
            break;
          case "candidate":
            await this.handleCandidate(message.candidate, message.from);
            break;
        }
      }
    } catch (error) {
      console.error("Error fetching signaling messages:", error);
    }
  }

  async startSignaling() {
    console.log("Starting signaling for room:", this.roomId);

    // Start polling for signaling messages
    this.signalingInterval = setInterval(
      () => this.fetchSignalingMessages(),
      1000
    );

    // Create and send initial offer
    try {
      const peerConnection = this.createPeerConnection(this.roomId);
      this.peers.set(this.roomId, {
        peerId: this.roomId,
        connection: peerConnection,
        mediaStream: null,
        recorder: null,
        recordedChunks: [],
      });

      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);

      await this.sendSignalingMessage({
        type: "offer",
        from: this.roomId,
        offer,
      });
    } catch (error) {
      console.error("Error creating initial offer:", error);
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
      const recorder = new MediaRecorder(peer.mediaStream);
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

      recorder.start();
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
