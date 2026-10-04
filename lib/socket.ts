import type { Server as HTTPServer } from "node:http";
import { Server, type Socket } from "socket.io";
import type { types as ms } from "mediasoup";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { createRouter, createWebRtcTransport } from "@/server/mediasoup";

// ─── Event contract ──────────────────────────────────────────────────────────
// Socket.io = signaling + control plane. Media flows through mediasoup (SFU):
// every client sends ONE copy of each track to the server and receives one
// stream per remote track. Request/response events use socket.io acks.
//
// client -> server (ack)
//   join                { sessionId, name }
//                       → { rtpCapabilities, layout, peers[], producers[] }
//   ms:createTransport  { direction: "send" | "recv" }
//   ms:connectTransport { transportId, dtlsParameters }
//   ms:produce          { transportId, kind, rtpParameters, source }
//   ms:consume          { producerId, rtpCapabilities }
//   ms:resumeConsumer   { consumerId }
//   ms:closeProducer    { producerId }
//
// client -> server (fire & forget)
//   chat:send    { body }
//   host:mute    { targetSocketId }
//   host:remove  { targetSocketId }
//   host:layout  { layout }
//
// server -> client
//   peer:joined / peer:left / ms:newProducer / ms:producerClosed
//   chat:message / host:muted / host:removed / host:layout
// ─────────────────────────────────────────────────────────────────────────────

type Layout = "solo" | "grid" | "spotlight";
type Source = "mic" | "cam" | "screen";
const SOURCES: Source[] = ["mic", "cam", "screen"];

interface MsPeer {
  socketId: string;
  name: string;
  userId: string | null; // internal only, never sent to other clients
  isHost: boolean;
  sendTransport: ms.WebRtcTransport | null;
  recvTransport: ms.WebRtcTransport | null;
  transports: Map<string, ms.WebRtcTransport>;
  producers: Map<string, ms.Producer>;
  consumers: Map<string, ms.Consumer>;
}

interface Room {
  id: string;
  router: ms.Router;
  peers: Map<string, MsPeer>;
  layout: Layout;
}

type Ack = (res: unknown) => void;

// ponytail: in-memory rooms, single process only. Scaling to several Node
// processes needs sticky sessions + one room per process, or mediasoup pipe
// transports between routers.
const rooms = new Map<string, Room>();
const roomsCreating = new Map<string, Promise<Room>>();

async function getOrCreateRoom(id: string): Promise<Room> {
  const existing = rooms.get(id);
  if (existing) return existing;
  const pending = roomsCreating.get(id);
  if (pending) return pending;

  const p = (async () => {
    const router = await createRouter();
    const room: Room = { id, router, peers: new Map(), layout: "grid" };
    rooms.set(id, room);
    return room;
  })().finally(() => roomsCreating.delete(id));

  roomsCreating.set(id, p);
  return p;
}

const producerInfo = (peer: MsPeer, producer: ms.Producer) => ({
  producerId: producer.id,
  socketId: peer.socketId,
  kind: producer.kind,
  source: producer.appData.source as Source,
});

export function attachSocketServer(httpServer: HTTPServer) {
  const io = new Server(httpServer, { path: "/socket.io" });

  io.on("connection", (socket: Socket) => {
    let current: { room: Room; peer: MsPeer } | null = null;
    // Serialises "join" so a quick re-join (React strict mode, reconnect)
    // can never interleave with the previous one.
    let joinQueue: Promise<void> = Promise.resolve();

    // ── helpers ────────────────────────────────────────────────────────────
    const on = <T>(
      event: string,
      fn: (payload: T) => unknown | Promise<unknown>,
    ) =>
      socket.on(event, async (payload: T, ack?: Ack) => {
        try {
          const result = await fn((payload ?? {}) as T);
          if (typeof ack === "function") {
            ack({ ok: true, ...((result as object | undefined) ?? {}) });
          }
        } catch (err) {
          console.error(`[socket] ${event} error`, err);
          if (typeof ack === "function") {
            ack({
              error: err instanceof Error ? err.message : "internal_error",
            });
          }
        }
      });

    const need = () => {
      if (!current) throw new Error("not_joined");
      return current;
    };

    const leave = () => {
      const cur = current;
      if (!cur) return;
      current = null;
      const { room, peer } = cur;

      // Closing a transport closes every producer/consumer on it.
      peer.transports.forEach((t) => t.close());
      room.peers.delete(socket.id);
      socket.to(room.id).emit("peer:left", { socketId: socket.id });
      void socket.leave(room.id);

      if (room.peers.size === 0) {
        room.router.close();
        rooms.delete(room.id);
      }
    };

    // ── join ───────────────────────────────────────────────────────────────
    const doJoin = async (
      { sessionId, name }: { sessionId?: unknown; name?: unknown },
      ack?: Ack,
    ) => {
      try {
        if (typeof sessionId !== "string" || !sessionId.trim())
          throw new Error("bad_session");
        if (typeof name !== "string" || !name.trim())
          throw new Error("bad_name");
        const safeName = name.trim().slice(0, 80);

        const session = await db.studioSession.findUnique({
          where: { id: sessionId },
          select: {
            id: true,
            endedAt: true,
            studio: { select: { ownerId: true } },
          },
        });
        if (!session || session.endedAt !== null) {
          socket.emit("join:error", { reason: "session_not_found" });
          throw new Error("session_not_found");
        }

        // Identity comes from the auth cookie on the handshake, never from
        // anything the client sends.
        const authSession = await auth.api.getSession({
          headers: new Headers(
            socket.handshake.headers as Record<string, string>,
          ),
        });
        const userId = authSession?.user?.id ?? null;
        const isHost = userId !== null && userId === session.studio.ownerId;

        leave(); // re-join: drop previous state first

        const room = await getOrCreateRoom(sessionId);
        const peer: MsPeer = {
          socketId: socket.id,
          name: safeName,
          userId,
          isHost,
          sendTransport: null,
          recvTransport: null,
          transports: new Map(),
          producers: new Map(),
          consumers: new Map(),
        };
        room.peers.set(socket.id, peer);
        await socket.join(sessionId);
        current = { room, peer };

        const others = [...room.peers.values()].filter((p) => p !== peer);

        ack?.({
          ok: true,
          rtpCapabilities: room.router.rtpCapabilities,
          layout: room.layout,
          isHost,
          peers: others.map((p) => ({
            socketId: p.socketId,
            name: p.name,
            isHost: p.isHost,
          })),
          producers: others.flatMap((p) =>
            [...p.producers.values()].map((pr) => producerInfo(p, pr)),
          ),
        });

        socket.to(sessionId).emit("peer:joined", {
          socketId: socket.id,
          name: safeName,
          isHost,
        });
      } catch (err) {
        console.error("[socket] join error", err);
        ack?.({ error: err instanceof Error ? err.message : "internal_error" });
      }
    };

    socket.on(
      "join",
      (payload: { sessionId?: unknown; name?: unknown }, ack?: Ack) => {
        joinQueue = joinQueue.then(() =>
          doJoin(payload ?? {}, typeof ack === "function" ? ack : undefined),
        );
      },
    );

    // ── mediasoup signaling ────────────────────────────────────────────────
    on<{ direction?: unknown }>("ms:createTransport", async ({ direction }) => {
      const { room, peer } = need();
      if (direction !== "send" && direction !== "recv")
        throw new Error("bad_direction");

      // Replace any previous transport of the same direction.
      const old =
        direction === "send" ? peer.sendTransport : peer.recvTransport;
      if (old) {
        old.close();
        peer.transports.delete(old.id);
      }

      const transport = await createWebRtcTransport(room.router);
      peer.transports.set(transport.id, transport);
      if (direction === "send") peer.sendTransport = transport;
      else peer.recvTransport = transport;

      transport.on("dtlsstatechange", (state) => {
        if (state === "failed") transport.close();
      });
      transport.on("@close", () => peer.transports.delete(transport.id));

      return {
        id: transport.id,
        iceParameters: transport.iceParameters,
        iceCandidates: transport.iceCandidates,
        dtlsParameters: transport.dtlsParameters,
      };
    });

    on<{ transportId?: unknown; dtlsParameters?: ms.DtlsParameters }>(
      "ms:connectTransport",
      async ({ transportId, dtlsParameters }) => {
        const { peer } = need();
        const transport =
          typeof transportId === "string"
            ? peer.transports.get(transportId)
            : undefined;
        if (!transport || !dtlsParameters) throw new Error("bad_transport");
        await transport.connect({ dtlsParameters });
      },
    );

    on<{
      transportId?: unknown;
      kind?: unknown;
      rtpParameters?: ms.RtpParameters;
      source?: unknown;
    }>("ms:produce", async ({ transportId, kind, rtpParameters, source }) => {
      const { room, peer } = need();
      if (!peer.sendTransport || transportId !== peer.sendTransport.id)
        throw new Error("bad_transport");
      if (kind !== "audio" && kind !== "video") throw new Error("bad_kind");
      if (!SOURCES.includes(source as Source)) throw new Error("bad_source");
      if (!rtpParameters) throw new Error("bad_rtp");

      // One producer per source: replace the old one.
      for (const [id, old] of peer.producers) {
        if (old.appData.source === source) {
          old.close();
          peer.producers.delete(id);
          socket
            .to(room.id)
            .emit("ms:producerClosed", { producerId: id, socketId: socket.id });
        }
      }

      const producer = await peer.sendTransport.produce({
        kind,
        rtpParameters,
        appData: { source },
      });
      peer.producers.set(producer.id, producer);
      producer.on("transportclose", () => peer.producers.delete(producer.id));

      socket.to(room.id).emit("ms:newProducer", producerInfo(peer, producer));
      return { id: producer.id };
    });

    on<{ producerId?: unknown; rtpCapabilities?: ms.RtpCapabilities }>(
      "ms:consume",
      async ({ producerId, rtpCapabilities }) => {
        const { room, peer } = need();
        if (typeof producerId !== "string" || !rtpCapabilities)
          throw new Error("bad_request");
        if (!peer.recvTransport) throw new Error("no_recv_transport");

        const owner = [...room.peers.values()].find((p) =>
          p.producers.has(producerId),
        );
        if (!owner || owner === peer) throw new Error("producer_not_found");
        if (!room.router.canConsume({ producerId, rtpCapabilities }))
          throw new Error("cannot_consume");

        // Start paused; the client resumes once its Consumer exists. This
        // avoids losing the first video keyframe.
        const consumer = await peer.recvTransport.consume({
          producerId,
          rtpCapabilities,
          paused: true,
        });
        peer.consumers.set(consumer.id, consumer);
        const drop = () => peer.consumers.delete(consumer.id);
        consumer.on("transportclose", drop);
        consumer.on("producerclose", drop);

        return {
          id: consumer.id,
          producerId,
          kind: consumer.kind,
          rtpParameters: consumer.rtpParameters,
          socketId: owner.socketId,
          source: owner.producers.get(producerId)?.appData.source,
        };
      },
    );

    on<{ consumerId?: unknown }>(
      "ms:resumeConsumer",
      async ({ consumerId }) => {
        const { peer } = need();
        const consumer =
          typeof consumerId === "string"
            ? peer.consumers.get(consumerId)
            : null;
        if (!consumer) throw new Error("consumer_not_found");
        await consumer.resume();
      },
    );

    on<{ producerId?: unknown }>("ms:closeProducer", ({ producerId }) => {
      const { room, peer } = need();
      const producer =
        typeof producerId === "string" ? peer.producers.get(producerId) : null;
      if (!producer) return;
      producer.close();
      peer.producers.delete(producer.id);
      socket
        .to(room.id)
        .emit("ms:producerClosed", {
          producerId: producer.id,
          socketId: socket.id,
        });
    });

    // ── chat ───────────────────────────────────────────────────────────────
    on<{ body?: unknown }>("chat:send", async ({ body }) => {
      const { room, peer } = need();
      if (typeof body !== "string" || !body.trim()) return;
      const saved = await db.chatMessage.create({
        data: {
          sessionId: room.id,
          senderId: peer.userId,
          senderName: peer.name,
          body: body.slice(0, 2000),
        },
      });
      io.in(room.id).emit("chat:message", {
        id: saved.id,
        senderName: peer.name,
        body: saved.body,
        createdAt: saved.createdAt,
      });
    });

    // ── host controls ──────────────────────────────────────────────────────
    const needHost = () => {
      const cur = need();
      if (!cur.peer.isHost) throw new Error("host_only");
      return cur;
    };

    on<{ targetSocketId?: unknown }>("host:mute", ({ targetSocketId }) => {
      const { room } = needHost();
      const target =
        typeof targetSocketId === "string"
          ? room.peers.get(targetSocketId)
          : null;
      if (!target) return;
      // Enforced on the server: the mic stops forwarding to everyone.
      target.producers.forEach((p) => {
        if (p.appData.source === "mic") void p.pause();
      });
      io.to(target.socketId).emit("host:muted", { targetSocketId });
    });

    on<{ targetSocketId?: unknown }>("host:remove", ({ targetSocketId }) => {
      const { room } = needHost();
      const target =
        typeof targetSocketId === "string"
          ? room.peers.get(targetSocketId)
          : null;
      if (!target || target.isHost) return;
      io.to(target.socketId).emit("host:removed", { targetSocketId });
      io.sockets.sockets.get(target.socketId)?.disconnect(true);
    });

    on<{ layout?: unknown }>("host:layout", ({ layout }) => {
      const { room } = needHost();
      if (layout !== "solo" && layout !== "grid" && layout !== "spotlight")
        return;
      room.layout = layout;
      io.in(room.id).emit("host:layout", { layout });
    });

    // "disconnecting" (not "disconnect") fires while the socket is still in
    // its rooms, so the peer:left broadcast reaches everyone.
    socket.on("disconnecting", leave);
  });

  return io;
}
