import Redis from "ioredis";

export const pub = new Redis(); // Publisher for messages
export const sub = new Redis(); // Subscriber for polling

export function getRoomChannel(roomId) {
  return `room:${roomId}`;
}
