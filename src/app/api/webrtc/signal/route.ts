import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// In-memory store for signaling data with TTL
interface SignalingData {
  type: string;
  data: any;
  timestamp: number;
  ttl: number;
}

const rooms = new Map<string, Map<string, SignalingData>>();
const ROOM_TTL = 1000 * 60 * 60; // 1 hour
const DATA_TTL = 1000 * 30; // 30 seconds

// Cleanup function to remove stale data
function cleanupStaleData() {
  const now = Date.now();

  for (const [roomId, room] of rooms.entries()) {
    // Clean up stale peer data
    for (const [peerId, data] of room.entries()) {
      if (now - data.timestamp > data.ttl) {
        room.delete(peerId);
      }
    }

    // Remove empty rooms
    if (room.size === 0) {
      rooms.delete(roomId);
    }
  }
}

// Run cleanup every minute
setInterval(cleanupStaleData, 60000);

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { roomId, type, data, from, to } = await req.json();

    if (!roomId || !type || !data || !from) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Get or create room
    if (!rooms.has(roomId)) {
      rooms.set(roomId, new Map());
    }
    const room = rooms.get(roomId)!;

    // Store the signaling data with TTL
    room.set(from, {
      type,
      data,
      timestamp: Date.now(),
      ttl: type === "ice-candidate" ? DATA_TTL : ROOM_TTL,
    });

    // If this is a targeted message, only send to the specific peer
    if (to) {
      const targetData = room.get(to);
      if (targetData) {
        return NextResponse.json({
          type: targetData.type,
          data: targetData.data,
          from: to,
        });
      }
    }

    // For broadcast messages, return only recent peers' data
    const now = Date.now();
    const peers = Array.from(room.entries())
      .filter(
        ([peerId, data]) => peerId !== from && now - data.timestamp <= data.ttl
      )
      .map(([peerId, data]) => ({
        type: data.type,
        data: data.data,
        from: peerId,
      }));

    return NextResponse.json({ peers });
  } catch (error) {
    console.error("Error in signaling:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const roomId = searchParams.get("roomId");
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const lastTimestamp = searchParams.get("lastTimestamp");

    if (!roomId || !from) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const room = rooms.get(roomId);
    if (!room) {
      return NextResponse.json({ peers: [] });
    }

    // If this is a targeted message, only return data for the specific peer
    if (to) {
      const targetData = room.get(to);
      if (targetData) {
        return NextResponse.json({
          type: targetData.type,
          data: targetData.data,
          from: to,
        });
      }
      return NextResponse.json({});
    }

    // For broadcast messages, return only new data since last timestamp
    const now = Date.now();
    const lastTime = lastTimestamp ? parseInt(lastTimestamp) : 0;

    const peers = Array.from(room.entries())
      .filter(
        ([peerId, data]) =>
          peerId !== from &&
          now - data.timestamp <= data.ttl &&
          data.timestamp > lastTime
      )
      .map(([peerId, data]) => ({
        type: data.type,
        data: data.data,
        from: peerId,
      }));

    return NextResponse.json({
      peers,
      timestamp: now,
    });
  } catch (error) {
    console.error("Error in signaling:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
