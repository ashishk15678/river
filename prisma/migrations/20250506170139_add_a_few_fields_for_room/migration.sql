/*
  Warnings:

  - You are about to drop the `Podcast` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "RoomStatus" AS ENUM ('ACTIVE', 'ENDED');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('HOST', 'GUEST', 'WATCHER');

-- CreateEnum
CREATE TYPE "MessageType" AS ENUM ('OFFER', 'ANSWER', 'ICE_CANDIDATE', 'JOIN', 'LEAVE', 'MUTE', 'UNMUTE', 'VIDEO_ON', 'VIDEO_OFF');

-- DropForeignKey
ALTER TABLE "Podcast" DROP CONSTRAINT "Podcast_userId_fkey";

-- DropTable
DROP TABLE "Podcast";

-- CreateTable
CREATE TABLE "Room" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "status" "RoomStatus" NOT NULL DEFAULT 'ACTIVE',
    "userId" TEXT NOT NULL,

    CONSTRAINT "Room_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Participant" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'GUEST',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMP(3),

    CONSTRAINT "Participant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SignalingMessage" (
    "id" TEXT NOT NULL,
    "type" "MessageType" NOT NULL,
    "roomId" TEXT NOT NULL,
    "fromId" TEXT NOT NULL,
    "toId" TEXT,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "SignalingMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Participant_userId_roomId_key" ON "Participant"("userId", "roomId");

-- AddForeignKey
ALTER TABLE "Room" ADD CONSTRAINT "Room_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Participant" ADD CONSTRAINT "Participant_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Participant" ADD CONSTRAINT "Participant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignalingMessage" ADD CONSTRAINT "SignalingMessage_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignalingMessage" ADD CONSTRAINT "SignalingMessage_fromId_fkey" FOREIGN KEY ("fromId") REFERENCES "Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignalingMessage" ADD CONSTRAINT "SignalingMessage_toId_fkey" FOREIGN KEY ("toId") REFERENCES "Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
