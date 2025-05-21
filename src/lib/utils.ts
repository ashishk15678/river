import { Room } from "@/generated/prisma";
import { clsx, type ClassValue } from "clsx";
import { NextResponse } from "next/server";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export async function checkActiveRoom(room: Room) {
  if (room?.status !== "ACTIVE") {
    return NextResponse.json({ success: false, msg: "Room is not active" });
  }
}
