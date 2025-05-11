import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import type { Participant, User } from "@/generated/prisma";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { displayName, role = "host" } = await request.json();

    if (!displayName) {
      return NextResponse.json(
        { error: "Display name is required" },
        { status: 400 }
      );
    }

    // First check if user exists
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Create new room
    const room = await prisma.room.create({
      data: {
        title: `Room ${nanoid(6)}`,
        userId: user.id,
        participants: {
          create: {
            userId: user.id,
            role: role.toUpperCase() as "HOST" | "GUEST" | "WATCHER",
          },
        },
      },
      include: {
        participants: {
          include: {
            user: true,
          },
        },
      },
    });

    return NextResponse.json({
      roomId: room.id,
      participantId: room.participants[0].id,
      role: role,
    });
  } catch (error) {
    console.error("Error in room API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const roomId = request.nextUrl.searchParams.get("roomId");

    if (!roomId) {
      return NextResponse.json(
        { error: "Room ID is required" },
        { status: 400 }
      );
    }

    const room = await prisma.room.findUnique({
      where: { id: roomId },
      include: {
        participants: {
          include: {
            user: true,
          },
        },
      },
    });

    if (!room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    return NextResponse.json({
      roomId: room.id,
      title: room.title,
      status: room.status,
      participants: room.participants.map(
        (p: Participant & { user: User }) => ({
          id: p.id,
          displayName: p.user.name || p.user.username || "Anonymous",
          role: p.role.toLowerCase(),
          joinedAt: p.joinedAt,
          leftAt: p.leftAt,
        })
      ),
    });
  } catch (error) {
    console.error("Error in room API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const roomId = request.nextUrl.searchParams.get("roomId");
    const { action, role = "guest" } = await request.json();

    if (!roomId) {
      return NextResponse.json(
        { error: "Room ID is required" },
        { status: 400 }
      );
    }

    // First check if user exists
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    switch (action) {
      case "join": {
        // Check if room exists
        const room = await prisma.room.findUnique({
          where: { id: roomId },
        });

        if (!room) {
          return NextResponse.json(
            { error: "Room not found" },
            { status: 404 }
          );
        }

        const participant = await prisma.participant.create({
          data: {
            userId: user.id,
            roomId,
            role: role.toUpperCase() as "HOST" | "GUEST" | "WATCHER",
          },
          include: {
            user: true,
          },
        });

        return NextResponse.json({
          participantId: participant.id,
          role: participant.role.toLowerCase(),
        });
      }

      case "leave": {
        await prisma.participant.updateMany({
          where: {
            roomId,
            userId: user.id,
            leftAt: null,
          },
          data: {
            leftAt: new Date(),
          },
        });

        return NextResponse.json({ success: true });
      }

      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }
  } catch (error) {
    console.error("Error in room API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const roomId = request.nextUrl.searchParams.get("roomId");

    if (!roomId) {
      return NextResponse.json(
        { error: "Room ID is required" },
        { status: 400 }
      );
    }

    // First check if user exists
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Check if user is the room owner
    const room = await prisma.room.findUnique({
      where: { id: roomId },
      select: { userId: true },
    });

    if (!room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    if (room.userId !== user.id) {
      return NextResponse.json(
        { error: "Only room owner can delete the room" },
        { status: 403 }
      );
    }

    await prisma.room.delete({
      where: { id: roomId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in room API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
