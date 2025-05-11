import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Prisma } from "@prisma/client";

// Define enums to match Prisma schema
enum Role {
  HOST = "HOST",
  GUEST = "GUEST",
  WATCHER = "WATCHER",
}

type MessageType =
  | "OFFER"
  | "ANSWER"
  | "ICE_CANDIDATE"
  | "JOIN"
  | "LEAVE"
  | "MUTE"
  | "UNMUTE"
  | "VIDEO_ON"
  | "VIDEO_OFF";

interface SignalingMessage {
  type: MessageType;
  roomId: string;
  fromId: string;
  toId?: string;
  data: {
    offer?: RTCSessionDescriptionInit;
    answer?: RTCSessionDescriptionInit;
    candidate?: RTCIceCandidateInit;
    error?: string;
  };
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const data = await request.json();
    console.log("Received POST request:", data);

    if (!data.roomId || !data.type) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Verify room exists
    const room = await prisma.room.findUnique({
      where: { id: data.roomId },
      include: {
        participants: true,
      },
    });

    if (!room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    // Determine if this is the first participant (host)
    const isFirstParticipant = room.participants.length === 0;

    // Create or get participant
    const participant = await prisma.participant.upsert({
      where: {
        userId_roomId: {
          userId: session.user.id,
          roomId: data.roomId,
        },
      },
      create: {
        userId: session.user.id,
        roomId: data.roomId,
        role: isFirstParticipant ? Role.HOST : Role.GUEST,
      },
      update: {
        // Update leftAt to null if participant is rejoining
        leftAt: null,
      },
    });

    // For JOIN messages, just return the participant info
    if (data.type === "JOIN") {
      return NextResponse.json({
        success: true,
        message: {
          fromId: participant.id,
          type: "JOIN",
          role: participant.role,
        },
      });
    }

    // Create signaling message
    const message = await prisma.signalingMessage.create({
      data: {
        type: data.type as MessageType,
        roomId: data.roomId,
        fromId: participant.id,
        toId: data.toId || null,
        data: {
          offer: data.offer,
          answer: data.answer,
          candidate: data.candidate,
        },
      },
    });

    console.log("Created signaling message:", message);
    return NextResponse.json({ success: true, message });
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
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const roomId = searchParams.get("roomId");

    if (!roomId) {
      return NextResponse.json(
        { error: "Room ID is required" },
        { status: 400 }
      );
    }

    // Get participant
    const participant = await prisma.participant.findUnique({
      where: {
        userId_roomId: {
          userId: session.user.id,
          roomId,
        },
      },
    });

    if (!participant) {
      return NextResponse.json(
        { error: "Participant not found" },
        { status: 404 }
      );
    }

    // Get unprocessed messages
    const messages = await prisma.signalingMessage.findMany({
      where: {
        roomId,
        processed: false,
        OR: [
          { toId: null }, // Broadcast messages
          { toId: participant.id }, // Messages targeted to this participant
        ],
      },
      orderBy: {
        createdAt: "asc",
      },
      include: {
        from: {
          include: {
            user: {
              select: {
                name: true,
                image: true,
              },
            },
          },
        },
      },
    });

    // Mark messages as processed
    if (messages.length > 0) {
      await prisma.signalingMessage.updateMany({
        where: {
          id: {
            in: messages.map((m) => m.id),
          },
        },
        data: {
          processed: true,
        },
      });
    }

    console.log("Returning messages:", messages);
    return NextResponse.json(messages);
  } catch (error) {
    console.error("Error in GET /api/webrtc/signal:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
