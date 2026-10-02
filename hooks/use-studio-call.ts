import { useEffect, useRef, useState, useCallback } from "react";
import type { Socket } from "socket.io-client";

// STUN only by default — see PRD §7. Set NEXT_PUBLIC_TURN_URL/_USERNAME/
// _CREDENTIAL to add a TURN server for guests behind strict NATs.
const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  ...(process.env.NEXT_PUBLIC_TURN_URL
    ? [
        {
          urls: process.env.NEXT_PUBLIC_TURN_URL,
          username: process.env.NEXT_PUBLIC_TURN_USERNAME,
          credential: process.env.NEXT_PUBLIC_TURN_CREDENTIAL,
        },
      ]
    : []),
];

export interface RemotePeer {
  socketId: string;
  name: string;
  isHost: boolean;
  stream?: MediaStream;
  muted?: boolean;
}

export interface ChatMsg {
  id: string;
  senderName: string;
  body: string;
  createdAt: string;
}

// ponytail: mesh topology — every peer connects to every other peer
// directly. Fine up to ~6 participants (PRD §7); past that, swap this hook
// for one that talks to an SFU instead of RTCPeerConnection-per-peer.
export function useStudioCall({
  socket,
  sessionId,
  localStream,
  name,
  userId,
  isHost,
}: {
  socket: Socket;
  sessionId: string;
  localStream: MediaStream | null;
  name: string;
  userId: string | null;
  isHost: boolean;
}) {
  const [peers, setPeers] = useState<Record<string, RemotePeer>>({});
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [layout, setLayout] = useState<"solo" | "grid" | "spotlight">("grid");
  const pcs = useRef<Record<string, RTCPeerConnection>>({});

  const makePeerConnection = useCallback(
    (socketId: string) => {
      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      pcs.current[socketId] = pc;

      localStream
        ?.getTracks()
        .forEach((track) => pc.addTrack(track, localStream));

      pc.onicecandidate = (e) => {
        if (e.candidate)
          socket.emit("signal", {
            to: socketId,
            data: { candidate: e.candidate },
          });
      };

      pc.ontrack = (e) => {
        setPeers((prev) => ({
          ...prev,
          [socketId]: { ...prev[socketId], stream: e.streams[0] },
        }));
      };

      return pc;
    },
    [localStream, socket],
  );

  useEffect(() => {
    if (!localStream) return;

    socket.emit("join", { sessionId, name, userId, isHost });

    socket.on(
      "peers",
      async ({
        peers: existing,
      }: {
        peers: (RemotePeer & { socketId: string })[];
      }) => {
        for (const p of existing) {
          setPeers((prev) => ({ ...prev, [p.socketId]: { ...p } }));
          const pc = makePeerConnection(p.socketId);
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          socket.emit("signal", { to: p.socketId, data: offer });
        }
      },
    );

    socket.on("peer:joined", ({ socketId, name, isHost }: RemotePeer) => {
      setPeers((prev) => ({ ...prev, [socketId]: { socketId, name, isHost } }));
      // Wait for their offer — the newer joiner initiates (see "peers" above).
    });

    socket.on("signal", async ({ from, data }: { from: string; data: any }) => {
      let pc = pcs.current[from];
      if (!pc) pc = makePeerConnection(from);

      if (data.type === "offer") {
        await pc.setRemoteDescription(new RTCSessionDescription(data));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit("signal", { to: from, data: answer });
      } else if (data.type === "answer") {
        await pc.setRemoteDescription(new RTCSessionDescription(data));
      } else if (data.candidate) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
        } catch {
          // benign — candidate can arrive before remote description in rare races
        }
      }
    });

    socket.on("peer:left", ({ socketId }: { socketId: string }) => {
      pcs.current[socketId]?.close();
      delete pcs.current[socketId];
      setPeers((prev) => {
        const next = { ...prev };
        delete next[socketId];
        return next;
      });
    });

    socket.on("chat:message", (msg: ChatMsg) =>
      setMessages((prev) => [...prev, msg]),
    );
    socket.on(
      "host:layout",
      ({ layout }: { layout: "solo" | "grid" | "spotlight" }) =>
        setLayout(layout),
    );
    socket.on(
      "host:muted",
      ({ targetSocketId }: { targetSocketId: string }) => {
        if (targetSocketId === socket.id) {
          localStream.getAudioTracks().forEach((t) => (t.enabled = false));
        }
      },
    );
    socket.on(
      "host:removed",
      ({ targetSocketId }: { targetSocketId: string }) => {
        if (targetSocketId === socket.id) window.location.assign("/dashboard");
      },
    );

    return () => {
      socket.removeAllListeners();
      Object.values(pcs.current).forEach((pc) => pc.close());
      pcs.current = {};
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localStream, sessionId]);

  const sendChat = useCallback(
    (body: string) => socket.emit("chat:send", { body }),
    [socket],
  );
  const setHostLayout = useCallback(
    (l: typeof layout) => socket.emit("host:layout", { layout: l }),
    [socket],
  );
  const muteTarget = useCallback(
    (targetSocketId: string) => socket.emit("host:mute", { targetSocketId }),
    [socket],
  );
  const removeTarget = useCallback(
    (targetSocketId: string) => socket.emit("host:remove", { targetSocketId }),
    [socket],
  );

  return {
    peers,
    messages,
    layout,
    sendChat,
    setHostLayout,
    muteTarget,
    removeTarget,
  };
}
