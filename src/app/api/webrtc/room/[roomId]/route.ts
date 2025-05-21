import { prisma } from "@/lib/prisma";
export async function GET(
  request: Request,
  { params }: { params: { roomId: string } }
) {
  const { roomId } = params;
  const room = await prisma.room.findUnique({
    where: {
      id: roomId,
    },
    include: {
      participants: {
        include: {
          user: true,
        },
      },
    },
  });
  return new Response(JSON.stringify({ room }));
}

export async function POST(
  request: Request,
  { params }: { params: { roomId: string } }
) {
  const { roomId } = params;
  const { userId } = await request.json();
  const room = await prisma.room.findUnique({
    where: {
      id: roomId,
    },
  });
}
