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
}

export interface ChatMessage {
  id: string;
  senderName: string;
  body: string;
  createdAt: string | Date;
}

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

// Three simulcast layers: the SFU forwards the best one each receiver's
// network can handle.
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

  const sendTransportRef = useRef<mc.Transport | null>(null);
  const screenRef = useRef<{
    producer: mc.Producer;
    track: MediaStreamTrack;
  } | null>(null);
  const onRemovedRef = useRef(onRemoved);
  useEffect(() => {
    onRemovedRef.current = onRemoved;
  });

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

    // Keep MediaStream identity stable unless the track set really changed,
    // otherwise <video> elements would restart on every update.
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
        next[info.socketId] = {
          ...info,
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
        // Producer may have been closed while we were setting up.
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

    // ── socket events ────────────────────────────────────────────────────────
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

    const onMuted = () =>
      localStream.getAudioTracks().forEach((t) => (t.enabled = false));

    const onKicked = () => onRemovedRef.current?.();

    socket.on("peer:joined", onPeerJoined);
    socket.on("peer:left", onPeerLeft);
    socket.on("ms:newProducer", onNewProducer);
    socket.on("ms:producerClosed", onProducerClosed);
    socket.on("chat:message", onChat);
    socket.on("host:layout", onLayout);
    socket.on("host:muted", onMuted);
    socket.on("host:removed", onKicked);

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

        // Publish the camera / mic that the green room already opened.
        // stopTracks:false → closing the producer must NOT stop the track,
        // the recorder and green room still use it.
        const audio = localStream.getAudioTracks()[0];
        const video = localStream.getVideoTracks()[0];
        if (audio) {
          await sendTransport.produce({
            track: audio,
            stopTracks: false,
            appData: { source: "mic" },
          });
        }
        if (video) {
          await sendTransport.produce({
            track: video,
            stopTracks: false,
            encodings: CAM_ENCODINGS,
            codecOptions: { videoGoogleStartBitrate: 1000 },
            appData: { source: "cam" },
          });
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
      socket.off("host:removed", onKicked);

      screenRef.current?.track.stop();
      screenRef.current = null;
      setLocalScreen(null);

      sendTransport?.close();
      recvTransport?.close();
      sendTransportRef.current = null;
      setPeers({});
    };
  }, [socket, sessionId, localStream, name]);

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
      track.onended = () => stopScreen(); // browser "Stop sharing" bar
      setLocalScreen(new MediaStream([track]));
    } catch (err) {
      console.warn("[studio] screen share cancelled", err);
    }
  }, [stopScreen]);

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
    localScreen,
    screensharing: localScreen !== null,
    error,
    shareScreen,
    sendChat,
    setHostLayout,
    muteTarget,
    removeTarget,
  };
}
