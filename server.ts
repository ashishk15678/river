import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import next from "next";
import { PrismaClient } from "@/generated/prisma";
import type { Role, MessageType } from "@/generated/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "./src/lib/auth";
import { ExpressPeerServer } from "peer";

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
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// PeerJS server configuration
const peerServer = ExpressPeerServer(httpServer, {
  debug: dev ? 3 : 0,
  path: '/myapp',
  proxied: true,
  allow_discovery: true,
  generateSystemUUID: () => {
    return crypto.randomUUID();
  }
});

server.use('/peerjs', peerServer);

// Socket.IO room management
const prisma = new PrismaClient();

io.use(async (socket, next) => {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return next(new Error('Authentication error'));
    
    socket.data.user = {
      id: session.user.id,
      name: session.user.name || '',
      email: session.user.email || ''
    };
    next();
  } catch (error) {
    next(new Error('Authentication error'));
  }
});

io.on('connection', (socket) => {
  socket.on('join-room', async ({ roomId, role }) => {
    try {
      // Validate room and user
      const room = await prisma.room.findUnique({ 
        where: { id: roomId } 
      });
      
      if (!room) {
        socket.emit('error', { message: 'Room not found' });
        return;
      }

      // Join the room
      socket.join(roomId);
      
      // Broadcast user joined
      socket.to(roomId).emit('user-joined', { 
        userId: socket.data.user.id, 
        role 
      });
    } catch (error) {
      socket.emit('error', { message: 'Error joining room' });
    }
  });

  socket.on('leave-room', async ({ roomId }) => {
    socket.leave(roomId);
    socket.to(roomId).emit('user-left', { 
      userId: socket.data.user.id 
    });
  });

  socket.on('signal', ({ roomId, targetUserId, signal }) => {
    // Relay WebRTC signaling messages
    socket.to(targetUserId).emit('signal', { 
      senderId: socket.data.user.id, 
      signal 
    });
  });
});

// Next.js request handler
server.all('*', (req, res) => {
  return handle(req, res);
});

const PORT = process.env.PORT || 3000;

app.prepare().then(() => {
  httpServer.listen(PORT, () => {
    console.log(`> Ready on http://localhost:${PORT}`);
  });
});
