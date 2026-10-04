-- Events are now filed by campaign. What was stored per game came from protocol 1 and cannot be
-- assigned to a campaign, so it is cleared; each campaign's next bridge.hello rebuilds its state.
DELETE FROM "chat_message";
DELETE FROM "combat";

-- DropForeignKey
ALTER TABLE "chat_message" DROP CONSTRAINT "chat_message_gameId_fkey";

-- DropForeignKey
ALTER TABLE "combat" DROP CONSTRAINT "combat_gameId_fkey";

-- DropIndex
DROP INDEX "chat_message_gameId_sentAt_idx";

-- DropIndex
DROP INDEX "chat_message_gameId_messageId_key";

-- DropIndex
DROP INDEX "combat_gameId_combatId_key";

-- AlterTable
-- Characters made before campaigns have none yet; the app asks for one.
ALTER TABLE "character" ADD COLUMN     "campaignTitle" TEXT NOT NULL DEFAULT '';
ALTER TABLE "character" ALTER COLUMN "campaignTitle" DROP DEFAULT;

-- AlterTable
ALTER TABLE "chat_message" DROP COLUMN "gameId",
ADD COLUMN     "campaignId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "combat" DROP COLUMN "gameId",
ADD COLUMN     "campaignId" TEXT NOT NULL;

-- DropTable
DROP TABLE "game";

-- CreateTable
CREATE TABLE "campaign" (
    "id" TEXT NOT NULL,
    "origin" TEXT NOT NULL,
    "foundryId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "worldId" TEXT NOT NULL,
    "worldTitle" TEXT NOT NULL,
    "characters" JSONB NOT NULL DEFAULT '[]',
    "version" INTEGER NOT NULL DEFAULT 0,
    "lastEventAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "campaign_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "campaign_origin_foundryId_key" ON "campaign"("origin", "foundryId");

-- CreateIndex
CREATE INDEX "chat_message_campaignId_sentAt_idx" ON "chat_message"("campaignId", "sentAt");

-- CreateIndex
CREATE UNIQUE INDEX "chat_message_campaignId_messageId_key" ON "chat_message"("campaignId", "messageId");

-- CreateIndex
CREATE UNIQUE INDEX "combat_campaignId_combatId_key" ON "combat"("campaignId", "combatId");

-- AddForeignKey
ALTER TABLE "chat_message" ADD CONSTRAINT "chat_message_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "combat" ADD CONSTRAINT "combat_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

