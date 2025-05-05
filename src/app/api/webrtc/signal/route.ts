import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// In-memory store for signaling data
const signalingData = new Map<string, any[]>();

// Cleanup function to remove stale data
const cleanupStaleData = () => {
  const now = Date.now();
  for (const [roomId, messages] of signalingData.entries()) {
    const filteredMessages = messages.filter(
      (msg) => now - msg.timestamp < 30000 // 30 seconds TTL
    );
    if (filteredMessages.length === 0) {
      signalingData.delete(roomId);
    } else {
      signalingData.set(roomId, filteredMessages);
    }
  }
};

// Run cleanup every minute
setInterval(cleanupStaleData, 60000);

export async function POST(request: Request) {
  try {
    const data = await request.json();
    console.log("Received POST request:", data);

    if (!data.roomId || !data.type || !data.from) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const message = {
      ...data,
      timestamp: Date.now(),
    };

    // Store the message
    const roomMessages = signalingData.get(data.roomId) || [];
    roomMessages.push(message);
    signalingData.set(data.roomId, roomMessages);

    console.log("Stored message for room:", data.roomId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in POST /api/webrtc/signal:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const roomId = searchParams.get("roomId");

    console.log("Received GET request for room:", roomId);

    if (!roomId) {
      return NextResponse.json(
        { error: "Room ID is required" },
        { status: 400 }
      );
    }

    const messages = signalingData.get(roomId) || [];
    console.log("Found messages for room:", roomId, messages.length);

    // Clear messages after sending them
    signalingData.set(roomId, []);

    return NextResponse.json(messages);
  } catch (error) {
    console.error("Error in GET /api/webrtc/signal:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
