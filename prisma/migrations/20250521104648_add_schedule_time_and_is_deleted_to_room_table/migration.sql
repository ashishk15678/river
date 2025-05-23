/*
  Warnings:

  - You are about to drop the `IceCandidate` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Offer` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "IceCandidate" DROP CONSTRAINT "IceCandidate_clientId_fkey";

-- DropForeignKey
ALTER TABLE "IceCandidate" DROP CONSTRAINT "IceCandidate_roomId_fkey";

-- DropForeignKey
ALTER TABLE "Offer" DROP CONSTRAINT "Offer_roomId_fkey";

-- AlterTable
ALTER TABLE "Room" ADD COLUMN     "isDeleted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "scheduleTime" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;

-- DropTable
DROP TABLE "IceCandidate";

-- DropTable
DROP TABLE "Offer";
