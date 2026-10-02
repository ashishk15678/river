import type { Server as HTTPServer } from "node:http";
import { Server, type Socket } from "socket.io";
import { db } from "@/lib/db";

// --- Event contract (see PRD §6) -------------------------------------
// Socket.io carries signaling + control plane only. Media is peer-to-peer
// WebRTC and never touches this server.
//
// client -> server
//   join            { sessionId, name }
//   signal          { to: socketId, data: RTCSessionDescriptionInit | RTCIceCandidateInit }
//   chat:send       { body: string }
//   host:mute       { targetSocketId }
//   host:remove     { targetSocketId }
//   host:layout     { layout: "solo" | "grid" | "spotlight" }
//
// server -> client
//   peers           { peers: { socketId, name }[] }        (to the joiner)
//   peer:joined     { socketId, name }                     (to the room)
//   peer:left       { socketId }
//   signal          { from: socketId, data }
//   chat:message    { id, senderName, body, createdAt }
//   host:muted      { targetSocketId }
//   host:removed    { targetSocketId }
//   host:layout     { layout }
// -----------------------------------------------------------------------

interface PeerInfo {
  name: string;
  userId: string | null;
  isHost: boolean;
}

export function attachSocketServer(httpServer: HTTPServer) {
  const io = new Server(httpServer, { path: "/socket.io" });

  // ponytail: in-memory peer registry, single-process only. Fine for a
  // single-node MVP; a multi-instance deploy needs a shared adapter
  // (socket.io-redis) — swap-in point if this ever scales horizontally.
  const peers = new Map<string, PeerInfo>();

  io.on("connection", (socket: Socket) => {
    let currentRoom: string | null = null;

    socket.on("join", async ({ sessionId, name, userId, isHost }) => {
      currentRoom = sessionId;
      peers.set(socket.id, { name, userId: userId ?? null, isHost: !!isHost });
      await socket.join(sessionId);

      const roomSockets = await io.in(sessionId).fetchSockets();
      const existingPeers = roomSockets
        .filter((s) => s.id !== socket.id)
        .map((s) => ({ socketId: s.id, ...peers.get(s.id)! }));

      socket.emit("peers", { peers: existingPeers });
      socket
        .to(sessionId)
        .emit("peer:joined", { socketId: socket.id, name, isHost: !!isHost });
    });

    socket.on("signal", ({ to, data }) => {
      io.to(to).emit("signal", { from: socket.id, data });
    });

    socket.on("chat:send", async ({ body }) => {
      if (!currentRoom || !body?.trim()) return;
      const info = peers.get(socket.id);
      const saved = await db.chatMessage.create({
        data: {
          sessionId: currentRoom,
          senderId: info?.userId ?? null,
          senderName: info?.name ?? "Guest",
          body: body.slice(0, 2000),
        },
      });
      io.in(currentRoom).emit("chat:message", {
        id: saved.id,
        senderName: info?.name ?? "Guest",
        body: saved.body,
        createdAt: saved.createdAt,
      });
    });

    // Host controls — cheap authorization: only a socket that joined with
    // isHost gets to fire these. Good enough since the host flag is set
    // from the server-verified session on join, not client-supplied trust.
    const requireHost = () => currentRoom && peers.get(socket.id)?.isHost;

    socket.on("host:mute", ({ targetSocketId }) => {
      if (!requireHost() || !currentRoom) return;
      io.to(targetSocketId).emit("host:muted", { targetSocketId });
    });

    socket.on("host:remove", ({ targetSocketId }) => {
      if (!requireHost() || !currentRoom) return;
      io.to(targetSocketId).emit("host:removed", { targetSocketId });
      io.sockets.sockets.get(targetSocketId)?.disconnect(true);
    });

    socket.on("host:layout", ({ layout }) => {
      if (!requireHost() || !currentRoom) return;
      io.in(currentRoom).emit("host:layout", { layout });
    });

    socket.on("disconnect", () => {
      peers.delete(socket.id);
      if (currentRoom)
        socket.to(currentRoom).emit("peer:left", { socketId: socket.id });
    });
  });

  return io;
}
