-- CreateEnum
CREATE TYPE "RollRole" AS ENUM ('player', 'gm');

-- AlterTable
ALTER TABLE "chat_message" ADD COLUMN     "byGm" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "roll_request" ADD COLUMN     "requestedById" TEXT,
ADD COLUMN     "role" "RollRole" NOT NULL DEFAULT 'player',
ALTER COLUMN "characterId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "roll_request_campaignId_actorId_role_createdAt_idx" ON "roll_request"("campaignId", "actorId", "role", "createdAt");

-- AddForeignKey
ALTER TABLE "roll_request" ADD CONSTRAINT "roll_request_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
