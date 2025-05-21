// TODO: Implement Socket.IO connection handling

import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import next from "next";
import { PrismaClient } from "@/generated/prisma";
import type { Role, MessageType } from "@/generated/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "./src/lib/auth";

interface ServerToClientEvents {
  "user-joined": (data: { userId: string; role: Role }) => void;
  "user-left": (data: { userId: string }) => void;
  "room-participants": (participants: any[]) => void;
  signal: (data: {
    senderId: string;
    signal: { type: MessageType; content: string };
  }) => void;
  error: (data: { message: string }) => void;
}

interface ClientToServerEvents {
  "join-room": (data: { roomId: string; role: Role }) => void;
  "leave-room": (data: { roomId: string }) => void;
  signal: (data: {
    roomId: string;
    targetUserId: string;
    signal: { type: MessageType; content: string };
  }) => void;
}

interface InterServerEvents {
  ping: () => void;
}

interface SocketData {
  user: {
    id: string;
    name: string;
    email: string;
  };
}

const dev = process.env.NODE_ENV !== "production";
const app = next({ dev });
const handle = app.getRequestHandler();

const server = express();
const httpServer = createServer(server);
const io = new Server<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>(httpServer, {
  cors: {
    origin: process.env.NEXTAUTH_URL || "http://localhost:3000",
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// Socket.IO middleware to authenticate users
// io.use(
//   async (
//     socket: Socket<
//       ClientToServerEvents,
//       ServerToClientEvents,
//       InterServerEvents,
//       SocketData
//     >,
//     next
//   ) => {
//     try {
//       const session = await getServerSession(authOptions);
//       if (!session?.user) {
//         return next(new Error("Unauthorized"));
//       }
//       socket.data.user = {
//         id: session.user.id,
//         name: session.user.name || "",
//         email: session.user.email || "",
//       };
//       next();
//     } catch (error) {
//       next(new Error("Authentication failed"));
//     }
//   }
// );

// // Socket.IO connection handling
// io.on(
//   "connection",
//   (
//     socket: Socket<
//       ClientToServerEvents,
//       ServerToClientEvents,
//       InterServerEvents,
//       SocketData
//     >
//   ) => {
//     console.log("Client connected:", socket.id);

//     // Join a room
//     socket.on("join-room", async ({ roomId, role }) => {
//       try {
//         // Verify room exists and user has access
//         const room = await prisma.room.findUnique({
//           where: { id: roomId },
//           include: { participants: true },
//         });

//         if (!room) {
//           socket.emit("error", { message: "Room not found" });
//           return;
//         }

//         // Join socket room
//         socket.join(roomId);

//         // Add participant to room in database
//         await prisma.participant.create({
//           data: {
//             roomId,
//             userId: socket.data.user.id,
//             role: role,
//           },
//         });

//         // Notify others in the room
//         socket.to(roomId).emit("user-joined", {
//           userId: socket.data.user.id,
//           role: role,
//         });

//         // Send current participants to the new user
//         const participants = await prisma.participant.findMany({
//           where: { roomId },
//           include: { user: true },
//         });
//         socket.emit("room-participants", participants);
//       } catch (error) {
//         console.error("Error joining room:", error);
//         socket.emit("error", { message: "Failed to join room" });
//       }
//     });

//     // Handle WebRTC signaling
//     socket.on("signal", async ({ roomId, targetUserId, signal }) => {
//       try {
//         // Verify both users are in the room
//         const [sender, receiver] = await Promise.all([
//           prisma.participant.findFirst({
//             where: {
//               roomId,
//               userId: socket.data.user.id,
//             },
//           }),
//           prisma.participant.findFirst({
//             where: {
//               roomId,
//               userId: targetUserId,
//             },
//           }),
//         ]);

//         if (!sender || !receiver) {
//           socket.emit("error", { message: "Invalid room or user" });
//           return;
//         }

//         // Store signaling message in database
//         await prisma.signalingMessage.create({
//           data: {
//             roomId,
//             senderId: socket.data.user.id,
//             receiverId: targetUserId,
//             type: signal.type,
//             content: signal.content,
//           },
//         });

//         // Forward signal to target user
//         socket.to(roomId).emit("signal", {
//           senderId: socket.data.user.id,
//           signal,
//         });
//       } catch (error) {
//         console.error("Error handling signal:", error);
//         socket.emit("error", { message: "Failed to send signal" });
//       }
//     });

//     // Handle user leaving
//     socket.on("leave-room", async ({ roomId }) => {
//       try {
//         // Remove participant from room in database
//         await prisma.roomParticipant.deleteMany({
//           where: {
//             roomId,
//             userId: socket.data.user.id,
//           },
//         });

//         // Notify others in the room
//         socket.to(roomId).emit("user-left", {
//           userId: socket.data.user.id,
//         });

//         // Leave socket room
//         socket.leave(roomId);
//       } catch (error) {
//         console.error("Error leaving room:", error);
//         socket.emit("error", { message: "Failed to leave room" });
//       }
//     });

//     // Handle disconnection
//     socket.on("disconnect", async () => {
//       try {
//         // Get all rooms the user is in
//         const rooms = await prisma.roomParticipant.findMany({
//           where: { userId: socket.data.user.id },
//           select: { roomId: true },
//         });

//         // Remove user from all rooms
//         await prisma.roomParticipant.deleteMany({
//           where: { userId: socket.data.user.id },
//         });

//         // Notify all rooms
//         rooms.forEach(({ roomId }) => {
//           socket.to(roomId).emit("user-left", {
//             userId: socket.data.user.id,
//           });
//         });
//       } catch (error) {
//         console.error("Error handling disconnect:", error);
//       }
//     });
//   }
// );

app.prepare();

// Basic Socket.IO connection handling
io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);

  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
  });
});

// Handle all other routes with Next.js
server.all("/(.*)/", (req, res) => {
  console.log("Request received:", req.url);
  return handle(req, res).catch((err) => {
    console.error("Error handling request:", err);
    res.status(500).send("Internal Server Error");
  });
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`[INFO] : Ready on http://localhost:${PORT}`);
});
