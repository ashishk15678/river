import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { MessageType } from "@/generated/prisma";
export async function POST(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get("action");

    if (!action) {
      return NextResponse.json(
        { error: "Missing action parameter" },
        { status: 400 }
      );
    }

    const body = await req.json();

    // Common validation
    if (!body.roomId || !body.userId || !body.userType) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const { roomId, userId, userType, targetId, message } = body;

    const room = await prisma.room.findUnique({
      where: { id: roomId },
      include: {
        participants: true,
        messages: true,
      },
    });

    if (!room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    switch (action) {
      case "join":
        //transaction
        await prisma.$transaction(async (tx) => {
          // Add participant
          await tx.participant.create({
            data: {
              roomId,
              userId,
              role: userType,
            },
          });

          // Initialize messages queue
          await tx.signalingMessage.create({
            data: {
              roomId,
              fromId: userId,
              toId: null,
              data: message,
              type: MessageType.JOIN,
            },
          });
        });
        return NextResponse.json({ success: true });

      case "signal":
        // Validate target
        if (!targetId || !message) {
          return NextResponse.json(
            { error: "Missing targetId or message" },
            { status: 400 }
          );
        }

        // Store message for target
        if (room.messages.find((m) => m.toId === targetId)) {
          room.messages.push({
            id: userId,
            createdAt: new Date(),
            type: MessageType.ICE_CANDIDATE,
            fromId: userId,
            toId: targetId,
            data: message,
            processed: false,
            roomId,
          });
        }
        return NextResponse.json({ success: true });

      case "poll":
        // Get messages for user
        const messages = room.messages.get(userId) || [];
        room.messages.set(userId, []); // Clear after polling
        return NextResponse.json(messages);

      case "list":
        // Return participant list
        return NextResponse.json({
          participants: Array.from(room.participants.values()),
        });

      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }
  } catch (error) {
    console.error("API Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
