-- CreateEnum
CREATE TYPE "RollRequestStatus" AS ENUM ('pending', 'claimed', 'done', 'failed');

-- AlterTable
ALTER TABLE "campaign" ADD COLUMN     "bridgePolledAt" TIMESTAMP(3),
ADD COLUMN     "playersSeenAt" TIMESTAMP(3),
ADD COLUMN     "rollKinds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "rollsEnabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "roll_request" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "RollRequestStatus" NOT NULL DEFAULT 'pending',
    "claimToken" TEXT,
    "claimSession" TEXT,
    "claimedAt" TIMESTAMP(3),
    "result" JSONB,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roll_request_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "roll_request_campaignId_status_createdAt_idx" ON "roll_request"("campaignId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "roll_request_characterId_createdAt_idx" ON "roll_request"("characterId", "createdAt");

-- AddForeignKey
ALTER TABLE "roll_request" ADD CONSTRAINT "roll_request_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roll_request" ADD CONSTRAINT "roll_request_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "character"("id") ON DELETE CASCADE ON UPDATE CASCADE;

