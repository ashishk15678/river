import { prisma } from "@/lib/prisma";
import { checkActiveRoom } from "@/lib/utils";
import { useSession } from "next-auth/react";
import { NextResponse } from "next/server";

export default async function POST(req: Request) {
  const { type, roomId, payload } = await req.json();
  const { data } = await useSession();

  if (!data?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (type == "create") {
    const room = await prisma.room.create({
      data: {
        id: roomId,
        title: "",
        userId: data.user.id,
        participants: {
          create: {
            userId: data.user.id,
            role: "HOST",
          },
        },
      },
    });
    return NextResponse.json({ success: true, room });
  }

  if (type == "join") {
    const room = await prisma.room.findUnique({
      where: { id: roomId },
    });

    if (!room) {
      return NextResponse.json({ success: false, msg: "No such room" });
    }

    checkActiveRoom(room);

    const updateRoom = await prisma.room.update({
      where: { id: roomId },

      data: {
        participants: {
          create: {
            userId: data.user.id,
            role: "GUEST",
          },
        },
      },
    });

    return NextResponse.json({ success: true, room: updateRoom });
  }

  if (type == "SIGNAL") {
  }
}
