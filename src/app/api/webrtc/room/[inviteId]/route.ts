import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// In-memory store for rooms
const rooms = new Map<
  string,
  {
    roomId: string;
    inviteId: string;
    hostId: string;
    participants: Map<
      string,
      {
        id: string;
        displayName: string;
        isHost: boolean;
      }
    >;
    createdAt: number;
  }
>();

// Cleanup function to remove stale rooms (older than 24 hours)
const cleanupStaleRooms = () => {
  const now = Date.now();
  for (const [inviteId, room] of rooms.entries()) {
    if (now - room.createdAt > 24 * 60 * 60 * 1000) {
      rooms.delete(inviteId);
    }
  }
};

// Run cleanup every hour
setInterval(cleanupStaleRooms, 60 * 60 * 1000);

export async function POST(
  request: Request,
  { params }: { params: { inviteId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { inviteId } = params;
    const { displayName } = await request.json();

    // Check if room exists
    let room = rooms.get(inviteId);

    if (!room) {
      // Create new room if it doesn't exist
      const roomId = inviteId; // Use inviteId as roomId for consistency
      room = {
        roomId,
        inviteId,
        hostId: session.user.id,
        participants: new Map(),
        createdAt: Date.now(),
      };
      rooms.set(inviteId, room);
      console.log("Created new room:", { roomId, inviteId });
    }

    // Add participant
    const participantId = Math.random().toString(36).substring(2, 9);
    room.participants.set(participantId, {
      id: participantId,
      displayName: displayName || "Guest",
      isHost: room.hostId === session.user.id,
    });

    console.log("Participant joined:", {
      roomId: room.roomId,
      participantId,
      isHost: room.hostId === session.user.id,
    });

    return NextResponse.json({
      roomId: room.roomId,
      participantId,
      isHost: room.hostId === session.user.id,
    });
  } catch (error) {
    console.error("Error in room POST:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}

export async function GET(
  request: Request,
  { params }: { params: { inviteId: string } }
) {
  try {
    const { inviteId } = params;
    console.log("Checking room:", inviteId);
    console.log("Available rooms:", Array.from(rooms.keys()));

    const room = rooms.get(inviteId);
    if (!room) {
      console.log("Room not found:", inviteId);
      return new NextResponse("Room not found", { status: 404 });
    }

    console.log("Room found:", {
      roomId: room.roomId,
      inviteId: room.inviteId,
      participantCount: room.participants.size,
    });

    return NextResponse.json({
      roomId: room.roomId,
      participants: Array.from(room.participants.values()),
    });
  } catch (error) {
    console.error("Error in room GET:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
