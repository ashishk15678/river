import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { v4 as uuidv4 } from "uuid";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    // Get active rooms
    const rooms = await prisma.room.findMany({
      where: {
        status: "ACTIVE",
      },
      include: {
        user: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 10, // Limit to 10 most recent rooms
    });

    return NextResponse.json(rooms);
  } catch (error) {
    console.error("Error fetching rooms:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}

export async function POST() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const roomId = uuidv4();
    const userId = session.user.id;

    // Create room in database
    const room = await prisma.room.create({
      data: {
        id: roomId,
        userId: userId,
        title: `Room ${roomId.slice(0, 8)}`,
        status: "ACTIVE",
      },
    });

    return NextResponse.json({ roomId: room.id });
  } catch (error) {
    console.error("Error creating room:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
