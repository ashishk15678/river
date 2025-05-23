const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const { v4: uuidv4 } = require("uuid");
const { webService } = require("./src/services/webrtcService");
const cors = require("cors");

const app = express();
app.use(
  cors({
    origin: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
    methods: ["GET", "POST"],
    credentials: true,
  })
);

const server = http.createServer(app);
const wss = new WebSocket.Server({
  server,
  path: "/ws",
  cors: {
    origin: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
    methods: ["GET", "POST"],
    credentials: true,
  },
  // Add connection tracking
  clientTracking: true,
  // Add heartbeat to detect stale connections
  perMessageDeflate: {
    zlibDeflateOptions: {
      chunkSize: 1024,
      memLevel: 7,
      level: 3,
    },
    zlibInflateOptions: {
      chunkSize: 10 * 1024,
    },
    clientNoContextTakeover: true,
    serverNoContextTakeover: true,
    serverMaxWindowBits: 10,
    concurrencyLimit: 10,
    threshold: 1024,
  },
});

// Add server status route
app.get("/status", (req, res) => {
  res.status(200).json({
    status: "ok",
    ready: true,
    connections: wss.clients.size,
    rooms: rooms.size,
  });
});

// Room management
const rooms = new Map(); // roomId => { host: socket, participants: Map<participantId, socket> }
const socketToRoom = new Map(); // socket.id => roomId
const activeConnections = new Map(); // socket.id => { lastPing: timestamp, roomId: string }

// Heartbeat interval to clean up stale connections
const HEARTBEAT_INTERVAL = 30000; // 30 seconds
const CONNECTION_TIMEOUT = 60000; // 60 seconds

setInterval(() => {
  const now = Date.now();
  wss.clients.forEach((socket) => {
    const connection = activeConnections.get(socket.id);
    if (connection && now - connection.lastPing > CONNECTION_TIMEOUT) {
      console.log(`Cleaning up stale connection: ${socket.id}`);
      socket.terminate();
      activeConnections.delete(socket.id);
    }
  });
}, HEARTBEAT_INTERVAL);

// Utility function to broadcast room updates
function broadcastRoomUpdate(roomId, type, data, excludeSocket = null) {
  const room = rooms.get(roomId);
  if (!room) return;

  const message = JSON.stringify({ type, ...data });

  // Send to host if exists
  if (
    room.host &&
    room.host.readyState === WebSocket.OPEN &&
    room.host !== excludeSocket
  ) {
    room.host.send(message);
  }

  // Send to all participants
  room.participants.forEach((socket) => {
    if (socket.readyState === WebSocket.OPEN && socket !== excludeSocket) {
      socket.send(message);
    }
  });
}

wss.on("connection", (socket) => {
  socket.id = uuidv4();
  console.log(`Client connected: ${socket.id}`);
  activeConnections.set(socket.id, { lastPing: Date.now() });

  // Send client their ID immediately
  socket.send(JSON.stringify({ type: "your-id", id: socket.id }));

  // Handle pings from client
  socket.isAlive = true;
  socket.on("pong", () => {
    socket.isAlive = true;
    const connection = activeConnections.get(socket.id);
    if (connection) {
      connection.lastPing = Date.now();
    }
  });

  socket.on("join-room", async (data) => {
    try {
      const { roomId, role } = data;

      // Leave any existing room
      const currentRoomId = socketToRoom.get(socket.id);
      if (currentRoomId) {
        const currentRoom = rooms.get(currentRoomId);
        if (currentRoom) {
          if (currentRoom.host?.id === socket.id) {
            currentRoom.host = null;
          } else {
            currentRoom.participants.delete(socket.id);
          }
          // Notify others that user left
          broadcastToRoom(currentRoomId, {
            type: "participant-left",
            userId: socket.id,
          });
        }
        socketToRoom.delete(socket.id);
      }

      // Join new room
      let room = rooms.get(roomId);
      if (!room) {
        room = {
          id: roomId,
          host: null,
          participants: new Map(),
          createdAt: new Date(),
        };
        rooms.set(roomId, room);
      }

      // Add user to room
      socketToRoom.set(socket.id, roomId);
      if (role === "host") {
        room.host = socket;
      } else {
        room.participants.set(socket.id, socket);
      }

      // Notify others that new user joined
      broadcastToRoom(roomId, {
        type: "participant-joined",
        userId: socket.id,
        role,
      });

      // Send current room state to the new user
      socket.send(
        JSON.stringify({
          type: "room-state",
          roomId,
          participants: Array.from(room.participants.keys()),
          hostId: room.host?.id,
        })
      );
    } catch (error) {
      console.error("Error joining room:", error);
      socket.send(
        JSON.stringify({
          type: "error",
          message: "Failed to join room",
        })
      );
    }
  });

  socket.on("message", async (message) => {
    try {
      const data = JSON.parse(message);
      const roomId = socketToRoom.get(socket.id);

      // Update last ping time for any message
      const connection = activeConnections.get(socket.id);
      if (connection) {
        connection.lastPing = Date.now();
      }

      // Handle ping messages separately
      if (data.type === "ping") {
        socket.send(JSON.stringify({ type: "pong" }));
        return;
      }

      console.log(`Received ${data.type} message from ${socket.id}`);

      switch (data.type) {
        case "offer":
        case "answer":
        case "candidate": {
          if (!roomId) {
            // If not in a room, this might be a new connection attempt
            // We should handle this case differently
            socket.send(
              JSON.stringify({
                type: "error",
                message: "Must join a room before establishing connection",
              })
            );
            return;
          }

          const room = rooms.get(roomId);
          if (!room) {
            socket.send(
              JSON.stringify({
                type: "error",
                message: "Room not found",
              })
            );
            return;
          }

          const targetId = data.target;
          const target =
            room.host?.id === targetId
              ? room.host
              : room.participants.get(targetId);

          if (target && target.readyState === WebSocket.OPEN) {
            target.send(
              JSON.stringify({
                type: data.type,
                [data.type]: data[data.type],
                from: socket.id,
              })
            );
          } else {
            socket.send(
              JSON.stringify({
                type: "error",
                message: "Target peer not found or not connected",
              })
            );
          }
          break;
        }

        case "mute":
        case "unmute":
        case "video-on":
        case "video-off": {
          broadcastRoomUpdate(roomId, data.type, {
            participantId: socket.id,
            state: data.state,
          });
          break;
        }

        default:
          console.log(`Unknown message type: ${data.type}`);
      }
    } catch (error) {
      console.error("Error handling message:", error);
      socket.send(
        JSON.stringify({
          type: "error",
          message: "Failed to process message",
        })
      );
    }
  });

  socket.on("close", () => {
    console.log(`Client disconnected: ${socket.id}`);
    const roomId = socketToRoom.get(socket.id);
    if (roomId) {
      // Handle as leave-room
      const data = { type: "leave-room" };
      handleLeaveRoom(socket, data);
    }
    activeConnections.delete(socket.id);
  });
});

// Extract leave room logic to a separate function
async function handleLeaveRoom(socket, data) {
  const roomId = socketToRoom.get(socket.id);
  if (!roomId) return;

  const room = rooms.get(roomId);
  if (!room) return;

  // Remove from room
  if (socket === room.host) {
    room.host = null;
    // Notify all participants that host left
    broadcastRoomUpdate(roomId, "host-left", { hostId: socket.id });
  } else {
    room.participants.delete(socket.id);
  }

  socketToRoom.delete(socket.id);
  const connection = activeConnections.get(socket.id);
  if (connection) {
    delete connection.roomId;
  }

  // Clean up empty rooms
  if (!room.host && room.participants.size === 0) {
    rooms.delete(roomId);
    await webService.cleanupRooms();
  } else {
    // Notify remaining participants
    broadcastRoomUpdate(roomId, "participant-left", {
      participantId: socket.id,
      participantCount: room.participants.size + (room.host ? 1 : 0),
    });
  }
}

// Helper function to broadcast to room
function broadcastToRoom(roomId, message) {
  const room = rooms.get(roomId);
  if (!room) return;

  const messageStr = JSON.stringify(message);
  if (room.host) {
    room.host.send(messageStr);
  }
  room.participants.forEach((participant) => {
    if (participant.readyState === WebSocket.OPEN) {
      participant.send(messageStr);
    }
  });
}

const PORT = process.env.WS_PORT || 3001;
const HOST = process.env.WS_HOST || "localhost";

server.listen(PORT, HOST, () => {
  console.log(`WebSocket server is running on ws://${HOST}:${PORT}/ws`);
});
