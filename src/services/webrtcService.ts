// webservice.ts - Minimal Server Implementation
import { PrismaClient } from "@/generated/prisma";
import { v4 as uuidv4 } from "uuid";

const prisma = new PrismaClient();
const activeRooms = new Map<string, string>(); // roomId -> hostPeerId

class WebService {
  // Create room (only stores host peer ID)
  async createRoom(hostPeerId: string): Promise<{ roomId: string }> {
    "use server";
    const roomId = uuidv4();
    activeRooms.set(roomId, hostPeerId);

    await prisma.room.create({
      data: {
        id: roomId,
        hostPeerId: hostPeerId,
        createdAt: new Date(),
      },
    });

    return { roomId };
  }

  // Get host's peer ID for room
  async getHostPeerId(roomId: string): Promise<string> {
    "use server";
    const hostPeerId = activeRooms.get(roomId);
    if (!hostPeerId) throw new Error("Room not found");
    return hostPeerId;
  }

  // Cleanup expired rooms
  async cleanupRooms() {
    "use server";
    const expired = await prisma.room.findMany({
      where: { createdAt: { lt: new Date(Date.now() - 3600000) } },
    });
    expired.forEach((room) => activeRooms.delete(room.id));
  }
}

export const webService = new WebService();
setInterval(() => webService.cleanupRooms(), 600000);
