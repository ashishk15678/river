-- CreateTable
CREATE TABLE "Offer" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "sdp" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Offer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IceCandidate" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "candidate" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IceCandidate_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IceCandidate" ADD CONSTRAINT "IceCandidate_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IceCandidate" ADD CONSTRAINT "IceCandidate_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Participant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
