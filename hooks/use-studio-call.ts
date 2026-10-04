"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import { Device } from "mediasoup-client";
import type { types as mc } from "mediasoup-client";

export type Layout = "solo" | "grid" | "spotlight";
type Source = "mic" | "cam" | "screen";

export interface RemotePeer {
  socketId: string;
  name: string;
  isHost: boolean;
  /** camera + microphone */
  stream: MediaStream | null;
  /** screen share (video only) */
  screen: MediaStream | null;
  /** true when the peer's mic producer is paused */
  audioMuted: boolean;
}

export interface ChatMessage {
  id: string;
  senderName: string;
  body: string;
  createdAt: string | Date;
}

export interface Reaction {
  id: string;
  socketId: string;
  name: string;
  emoji: string;
}

// ── Overlay types ─────────────────────────────────────────────────────────────

export type OverlayKind = "lower-third" | "banner" | "onair" | "logo";

export interface LowerThirdOverlay {
  id: string;
  kind: "lower-third";
  socketId: string;
  title: string;
  subtitle: string;
}
export interface BannerOverlay {
  id: string;
  kind: "banner";
  text: string;
}
export interface OnAirOverlay {
  id: string;
  kind: "onair";
}
export interface LogoOverlay {
  id: string;
  kind: "logo";
  dataUrl: string;
  position: "tl" | "tr" | "bl" | "br";
}

export type Overlay =
  LowerThirdOverlay | BannerOverlay | OnAirOverlay | LogoOverlay;

interface PeerInfo {
  socketId: string;
  name: string;
  isHost: boolean;
}

interface ProducerInfo {
  producerId: string;
  socketId: string;
  kind: "audio" | "video";
  source: Source;
}

interface ConsumerEntry {
  consumer: mc.Consumer;
  socketId: string;
  source: Source;
}

const CAM_ENCODINGS: mc.RtpEncodingParameters[] = [
  {
    rid: "r0",
    maxBitrate: 150_000,
    scaleResolutionDownBy: 4,
    scalabilityMode: "L1T3",
  },
  {
    rid: "r1",
    maxBitrate: 500_000,
    scaleResolutionDownBy: 2,
    scalabilityMode: "L1T3",
  },
  { rid: "r2", maxBitrate: 1_500_000, scalabilityMode: "L1T3" },
];

async function request<T = Record<string, unknown>>(
  socket: Socket,
  event: string,
  payload: unknown = {},
): Promise<T> {
  const res = await socket.timeout(15_000).emitWithAck(event, payload);
  if (res?.error) throw new Error(res.error);
  return res as T;
}

export function useStudioCall({
  socket,
  sessionId,
  localStream,
  name,
  onRemoved,
}: {
  socket: Socket;
  sessionId: string;
  localStream: MediaStream;
  name: string;
  onRemoved?: () => void;
}) {
  const [peers, setPeers] = useState<Record<string, RemotePeer>>({});
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [layout, setLayout] = useState<Layout>("grid");
  const [localScreen, setLocalScreen] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [spotlight, setSpotlight] = useState<string | null>(null);
  const [raisedHands, setRaisedHands] = useState<Set<string>>(new Set());
  const [overlays, setOverlaysState] = useState<Overlay[]>([]);
  const [reactions, setReactions] = useState<Reaction[]>([]);
  // Local mic / cam enabled state — toggled by the user or forced off by host
  const [micEnabled, setMicEnabled] = useState(true);
  const [camEnabled, setCamEnabled] = useState(true);

  const sendTransportRef = useRef<mc.Transport | null>(null);
  const micProducerRef = useRef<mc.Producer | null>(null);
  const camProducerRef = useRef<mc.Producer | null>(null);
  const screenRef = useRef<{
    producer: mc.Producer;
    track: MediaStreamTrack;
  } | null>(null);
  const onRemovedRef = useRef(onRemoved);
  useEffect(() => {
    onRemovedRef.current = onRemoved;
  });

  // ── Self-toggle mic ────────────────────────────────────────────────────────
  const toggleMic = useCallback(() => {
    const enabled = !micEnabled;
    localStream.getAudioTracks().forEach((t) => (t.enabled = enabled));
    // Pause / resume at the SFU so bandwidth isn't wasted while muted.
    const producer = micProducerRef.current;
    if (producer) enabled ? void producer.resume() : void producer.pause();
    setMicEnabled(enabled);
  }, [micEnabled, localStream]);

  // ── Self-toggle cam ────────────────────────────────────────────────────────
  const toggleCam = useCallback(() => {
    const enabled = !camEnabled;
    localStream.getVideoTracks().forEach((t) => (t.enabled = enabled));
    const producer = camProducerRef.current;
    if (producer) enabled ? void producer.resume() : void producer.pause();
    setCamEnabled(enabled);
  }, [camEnabled, localStream]);

  // ── connect, produce, consume ──────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    let ready = false;
    let device: Device;
    let sendTransport: mc.Transport | undefined;
    let recvTransport: mc.Transport | undefined;

    const infos = new Map<string, PeerInfo>();
    const consumers = new Map<string, ConsumerEntry>();
    const consumedProducers = new Set<string>();
    const pending: ProducerInfo[] = [];
    const streamCache = new Map<string, { sig: string; stream: MediaStream }>();

    const streamFor = (key: string, tracks: MediaStreamTrack[]) => {
      if (!tracks.length) {
        streamCache.delete(key);
        return null;
      }
      const sig = tracks
        .map((t) => t.id)
        .sort()
        .join(",");
      const cached = streamCache.get(key);
      if (cached?.sig === sig) return cached.stream;
      const stream = new MediaStream(tracks);
      streamCache.set(key, { sig, stream });
      return stream;
    };

    const publish = () => {
      if (cancelled) return;
      const next: Record<string, RemotePeer> = {};
      for (const info of infos.values()) {
        const entries = [...consumers.values()].filter(
          (c) => c.socketId === info.socketId,
        );
        // audioMuted: no audio consumer → peer's mic is off
        const hasAudio = entries.some(
          (e) => e.source !== "screen" && e.consumer.kind === "audio",
        );
        next[info.socketId] = {
          ...info,
          audioMuted: !hasAudio,
          stream: streamFor(
            `${info.socketId}:cam`,
            entries
              .filter((e) => e.source !== "screen")
              .map((e) => e.consumer.track),
          ),
          screen: streamFor(
            `${info.socketId}:screen`,
            entries
              .filter((e) => e.source === "screen")
              .map((e) => e.consumer.track),
          ),
        };
      }
      setPeers(next);
    };

    const createTransport = async (direction: "send" | "recv") => {
      const params = await request<{
        id: string;
        iceParameters: mc.IceParameters;
        iceCandidates: mc.IceCandidate[];
        dtlsParameters: mc.DtlsParameters;
      }>(socket, "ms:createTransport", { direction });

      const transport =
        direction === "send"
          ? device.createSendTransport(params)
          : device.createRecvTransport(params);

      transport.on("connect", ({ dtlsParameters }, callback, errback) => {
        request(socket, "ms:connectTransport", {
          transportId: transport.id,
          dtlsParameters,
        })
          .then(() => callback())
          .catch(errback);
      });
      if (direction === "send") {
        transport.on(
          "produce",
          ({ kind, rtpParameters, appData }, callback, errback) => {
            request<{ id: string }>(socket, "ms:produce", {
              transportId: transport.id,
              kind,
              rtpParameters,
              source: appData.source,
            })
              .then(({ id }) => callback({ id }))
              .catch(errback);
          },
        );
      }
      return transport;
    };

    const consume = async (info: ProducerInfo) => {
      if (consumedProducers.has(info.producerId)) return;
      consumedProducers.add(info.producerId);
      let consumer: mc.Consumer | undefined;
      try {
        const data = await request<{
          id: string;
          producerId: string;
          kind: "audio" | "video";
          rtpParameters: mc.RtpParameters;
          socketId: string;
          source: Source;
        }>(socket, "ms:consume", {
          producerId: info.producerId,
          rtpCapabilities: device.rtpCapabilities,
        });
        if (cancelled || !recvTransport) return;

        consumer = await recvTransport.consume({
          id: data.id,
          producerId: data.producerId,
          kind: data.kind,
          rtpParameters: data.rtpParameters,
        });
        if (cancelled) {
          consumer.close();
          return;
        }
        if (!consumedProducers.has(info.producerId)) {
          consumer.close();
          return;
        }

        const c = consumer;
        c.on("transportclose", () => {
          consumers.delete(c.id);
        });
        consumers.set(c.id, {
          consumer: c,
          socketId: data.socketId,
          source: data.source,
        });
        await request(socket, "ms:resumeConsumer", { consumerId: c.id });
        publish();
      } catch (err) {
        consumer?.close();
        if (consumer) consumers.delete(consumer.id);
        consumedProducers.delete(info.producerId);
        if (!cancelled) console.error("[studio] consume failed", err);
      }
    };

    // ── socket events ──────────────────────────────────────────────────────
    const onPeerJoined = (p: PeerInfo) => {
      infos.set(p.socketId, p);
      publish();
    };

    const onPeerLeft = ({ socketId }: { socketId: string }) => {
      infos.delete(socketId);
      for (const [id, e] of consumers) {
        if (e.socketId === socketId) {
          consumedProducers.delete(e.consumer.producerId);
          e.consumer.close();
          consumers.delete(id);
        }
      }
      publish();
    };

    const onNewProducer = (info: ProducerInfo) => {
      if (ready) void consume(info);
      else pending.push(info);
    };

    const onProducerClosed = ({ producerId }: { producerId: string }) => {
      consumedProducers.delete(producerId);
      for (const [id, e] of consumers) {
        if (e.consumer.producerId === producerId) {
          e.consumer.close();
          consumers.delete(id);
        }
      }
      publish();
    };

    const onChat = (m: ChatMessage) =>
      setMessages((prev) =>
        prev.some((x) => x.id === m.id) ? prev : [...prev, m],
      );

    const onLayout = ({ layout }: { layout: Layout }) => setLayout(layout);

    const onMuted = () => {
      localStream.getAudioTracks().forEach((t) => (t.enabled = false));
      setMicEnabled(false); // reflect host-mute in local toggle button
    };

    const onCamStopped = ({ targetSocketId }: { targetSocketId: string }) => {
      if (targetSocketId === socket.id) {
        localStream.getVideoTracks().forEach((t) => (t.enabled = false));
        setCamEnabled(false);
      }
    };

    const onKicked = () => onRemovedRef.current?.();
    const onSpotlight = ({ socketId }: { socketId: string | null }) =>
      setSpotlight(socketId);
    const onOverlays = ({ overlays }: { overlays: Overlay[] }) =>
      setOverlaysState(overlays);

    const onRaiseHand = ({ socketId }: { socketId: string }) =>
      setRaisedHands((prev) => new Set(prev).add(socketId));
    const onLowerHand = ({ socketId }: { socketId: string }) =>
      setRaisedHands((prev) => {
        const n = new Set(prev);
        n.delete(socketId);
        return n;
      });

    // Emoji reactions — visible for 4 s then removed.
    const onReaction = ({
      socketId,
      name: senderName,
      emoji,
    }: {
      socketId: string;
      name: string;
      emoji: string;
    }) => {
      const id = `${socketId}-${Date.now()}`;
      const r: Reaction = { id, socketId, name: senderName, emoji };
      setReactions((prev) => [...prev, r]);
      setTimeout(
        () => setReactions((prev) => prev.filter((x) => x.id !== id)),
        4000,
      );
    };

    socket.on("peer:joined", onPeerJoined);
    socket.on("peer:left", onPeerLeft);
    socket.on("ms:newProducer", onNewProducer);
    socket.on("ms:producerClosed", onProducerClosed);
    socket.on("chat:message", onChat);
    socket.on("host:layout", onLayout);
    socket.on("host:muted", onMuted);
    socket.on("host:camStopped", onCamStopped);
    socket.on("host:removed", onKicked);
    socket.on("host:spotlight", onSpotlight);
    socket.on("host:overlays", onOverlays);
    socket.on("peer:raiseHand", onRaiseHand);
    socket.on("peer:lowerHand", onLowerHand);
    socket.on("peer:reaction", onReaction);

    (async () => {
      try {
        const joined = await request<{
          rtpCapabilities: mc.RtpCapabilities;
          layout: Layout;
          peers: PeerInfo[];
          producers: ProducerInfo[];
        }>(socket, "join", { sessionId, name });
        if (cancelled) return;

        setLayout(joined.layout);
        joined.peers.forEach((p) => infos.set(p.socketId, p));

        device = new Device();
        await device.load({ routerRtpCapabilities: joined.rtpCapabilities });
        if (cancelled) return;

        sendTransport = await createTransport("send");
        if (cancelled) return sendTransport.close();
        recvTransport = await createTransport("recv");
        if (cancelled) return recvTransport.close();
        sendTransportRef.current = sendTransport;

        const audio = localStream.getAudioTracks()[0];
        const video = localStream.getVideoTracks()[0];
        if (audio) {
          const micProd = await sendTransport.produce({
            track: audio,
            stopTracks: false,
            appData: { source: "mic" },
          });
          micProducerRef.current = micProd;
        }
        if (video) {
          const camProd = await sendTransport.produce({
            track: video,
            stopTracks: false,
            encodings: CAM_ENCODINGS,
            codecOptions: { videoGoogleStartBitrate: 1000 },
            appData: { source: "cam" },
          });
          camProducerRef.current = camProd;
        }
        if (cancelled) return;

        ready = true;
        await Promise.all([...joined.producers, ...pending].map(consume));
        publish();
      } catch (err) {
        if (cancelled) return;
        console.error("[studio] setup failed", err);
        setError(
          err instanceof Error ? err.message : "Could not connect to studio",
        );
      }
    })();

    return () => {
      cancelled = true;
      socket.off("peer:joined", onPeerJoined);
      socket.off("peer:left", onPeerLeft);
      socket.off("ms:newProducer", onNewProducer);
      socket.off("ms:producerClosed", onProducerClosed);
      socket.off("chat:message", onChat);
      socket.off("host:layout", onLayout);
      socket.off("host:muted", onMuted);
      socket.off("host:camStopped", onCamStopped);
      socket.off("host:removed", onKicked);
      socket.off("host:spotlight", onSpotlight);
      socket.off("host:overlays", onOverlays);
      socket.off("peer:raiseHand", onRaiseHand);
      socket.off("peer:lowerHand", onLowerHand);
      socket.off("peer:reaction", onReaction);

      screenRef.current?.track.stop();
      screenRef.current = null;
      setLocalScreen(null);
      micProducerRef.current = null;
      camProducerRef.current = null;

      sendTransport?.close();
      recvTransport?.close();
      sendTransportRef.current = null;
      setPeers({});
    };
  }, [socket, sessionId, localStream, name]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── screen share ───────────────────────────────────────────────────────────
  const stopScreen = useCallback(() => {
    const cur = screenRef.current;
    if (!cur) return;
    screenRef.current = null;
    cur.track.onended = null;
    cur.track.stop();
    cur.producer.close();
    socket.emit("ms:closeProducer", { producerId: cur.producer.id });
    setLocalScreen(null);
  }, [socket]);

  const shareScreen = useCallback(async () => {
    if (screenRef.current) return stopScreen();
    const transport = sendTransportRef.current;
    if (!transport) return;
    try {
      const display = await navigator.mediaDevices.getDisplayMedia({
        video: true,
      });
      const track = display.getVideoTracks()[0];
      const producer = await transport.produce({
        track,
        stopTracks: false,
        appData: { source: "screen" },
      });
      screenRef.current = { producer, track };
      track.onended = () => stopScreen();
      setLocalScreen(new MediaStream([track]));
    } catch {
      /* user cancelled */
    }
  }, [stopScreen]);

  // ── send reaction ──────────────────────────────────────────────────────────
  const sendReaction = useCallback(
    (emoji: string) => socket.emit("peer:sendReaction", { emoji }),
    [socket],
  );

  // ── chat + host controls ───────────────────────────────────────────────────
  const sendChat = useCallback(
    (body: string) => socket.emit("chat:send", { body }),
    [socket],
  );
  const setHostLayout = useCallback(
    (l: Layout) => socket.emit("host:layout", { layout: l }),
    [socket],
  );
  const muteTarget = useCallback(
    (id: string) => socket.emit("host:mute", { targetSocketId: id }),
    [socket],
  );
  const removeTarget = useCallback(
    (id: string) => socket.emit("host:remove", { targetSocketId: id }),
    [socket],
  );
  const stopCamTarget = useCallback(
    (id: string) => socket.emit("host:stopCam", { targetSocketId: id }),
    [socket],
  );
  const setSpotlightTarget = useCallback(
    (id: string | null) => socket.emit("host:spotlight", { socketId: id }),
    [socket],
  );
  const setOverlays = useCallback(
    (ovs: Overlay[]) => socket.emit("host:overlays", { overlays: ovs }),
    [socket],
  );
  const raiseHand = useCallback(() => socket.emit("peer:raiseHand"), [socket]);
  const lowerHand = useCallback(() => socket.emit("peer:lowerHand"), [socket]);

  return {
    peers,
    messages,
    layout,
    localScreen,
    screensharing: localScreen !== null,
    spotlight,
    raisedHands,
    overlays,
    reactions,
    error,
    micEnabled,
    camEnabled,
    toggleMic,
    toggleCam,
    shareScreen,
    sendReaction,
    sendChat,
    setHostLayout,
    muteTarget,
    removeTarget,
    stopCamTarget,
    setSpotlightTarget,
    setOverlays,
    raiseHand,
    lowerHand,
  };
}
