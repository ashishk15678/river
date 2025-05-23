// /server/signaling-server.ts

import { WebSocket, WebSocketServer } from "ws";
import { v4 as uuidv4 } from "uuid";

interface CustomWebSocket extends WebSocket {
  id: string;
}

interface Room {
  id: string;
  participants: Map<string, CustomWebSocket>;
}

const rooms = new Map<string, Room>();
const socketToRoom = new Map<string, string>();

const wss = new WebSocketServer({ port: 8080 });
console.log("🚀 Signaling server started on ws://localhost:8080");

wss.on("connection", (socket: CustomWebSocket) => {
  socket.id = uuidv4();
  console.log(
    `📱 [${new Date().toISOString()}] New connection established - Socket ID: ${
      socket.id
    }`
  );

  socket.on("message", (message) => {
    let data;
    try {
      data = JSON.parse(message.toString());
    } catch (error) {
      console.error(
        `❌ [${new Date().toISOString()}] Invalid JSON received from ${
          socket.id
        }:`,
        message.toString()
      );
      return;
    }

    console.log(`📨 [${new Date().toISOString()}] Message from ${socket.id}:`, {
      type: data.type,
      payload: data.payload,
    });

    switch (data.type) {
      // User wants to join a room
      case "JOIN_ROOM": {
        const { roomId } = data;
        let room = rooms.get(roomId);

        // If room doesn't exist, create it
        if (!room) {
          room = { id: roomId, participants: new Map() };
          rooms.set(roomId, room);
          console.log(
            `🏠 [${new Date().toISOString()}] Created new room: ${roomId} by user: ${
              socket.id
            }`
          );
        }

        // Add user to the room
        room.participants.set(socket.id, socket);
        socketToRoom.set(socket.id, roomId);

        // Notify the new user of all existing participants
        const allParticipantIds = Array.from(room.participants.keys()).filter(
          (id) => id !== socket.id
        );

        console.log(`👥 [${new Date().toISOString()}] Room ${roomId} state:`, {
          totalParticipants: room.participants.size,
          newParticipant: socket.id,
          existingParticipants: allParticipantIds,
        });

        socket.send(
          JSON.stringify({
            type: "ALL_PARTICIPANTS",
            payload: { participantIds: allParticipantIds },
          })
        );

        // Notify all other participants that a new user has joined
        room.participants.forEach((participant, id) => {
          if (id !== socket.id) {
            participant.send(
              JSON.stringify({
                type: "USER_JOINED",
                payload: { remoteId: socket.id },
              })
            );
          }
        });

        console.log(`[Room] User ${socket.id} joined room ${roomId}`);
        break;
      }

      // Relaying WebRTC signaling messages
      case "offer":
      case "answer":
      case "candidate": {
        const roomId = socketToRoom.get(socket.id);
        if (!roomId) {
          console.warn(
            `⚠️ [${new Date().toISOString()}] Received ${data.type} from user ${
              socket.id
            } not in any room`
          );
          return;
        }

        const room = rooms.get(roomId);
        if (!room) {
          console.error(
            `❌ [${new Date().toISOString()}] Room ${roomId} not found for signal from ${
              socket.id
            }`
          );
          return;
        }

        // Find the target recipient for the message
        const targetId = data.payload.target;
        const targetSocket = room.participants.get(targetId);

        if (targetSocket && targetSocket.readyState === WebSocket.OPEN) {
          // Forward the message and add the sender's ID
          targetSocket.send(
            JSON.stringify({
              type: data.type,
              payload: {
                ...data.payload,
                from: socket.id,
              },
            })
          );
          console.log(
            `📡 [${new Date().toISOString()}] Relayed ${data.type}:`,
            {
              from: socket.id,
              to: targetId,
              roomId,
            }
          );
        } else {
          console.warn(
            `⚠️ [${new Date().toISOString()}] Target ${targetId} not found or not open in room ${roomId}`
          );
        }
        break;
      }

      default:
        console.warn(
          `⚠️ [${new Date().toISOString()}] Unknown message type from ${
            socket.id
          }:`,
          data.type
        );
    }
  });

  socket.on("close", () => {
    const roomId = socketToRoom.get(socket.id);
    console.log(`👋 [${new Date().toISOString()}] User disconnected:`, {
      socketId: socket.id,
      roomId,
    });

    if (roomId) {
      const room = rooms.get(roomId);
      if (room) {
        room.participants.delete(socket.id);
        socketToRoom.delete(socket.id);

        if (room.participants.size === 0) {
          rooms.delete(roomId);
          console.log(
            `🗑️ [${new Date().toISOString()}] Deleted empty room ${roomId}`
          );
        } else {
          console.log(
            `👥 [${new Date().toISOString()}] Room ${roomId} updated:`,
            {
              departedUser: socket.id,
              remainingParticipants: room.participants.size,
            }
          );
        }
      }
    }
  });

  socket.on("error", (error) => {
    console.error(
      `❌ [${new Date().toISOString()}] Socket error for ${socket.id}:`,
      error.message
    );
  });
});

// Add basic error handlers
process.on("uncaughtException", (error) => {
  console.error(`💥 [${new Date().toISOString()}] Uncaught exception:`, error);
});

process.on("unhandledRejection", (reason) => {
  console.error(
    `💥 [${new Date().toISOString()}] Unhandled promise rejection:`,
    reason
  );
});
