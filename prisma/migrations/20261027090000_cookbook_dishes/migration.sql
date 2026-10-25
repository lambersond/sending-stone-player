-- CreateEnum
-- Where a dish from the Magical Recipe Book stands, on its way to Foundry and after.
CREATE TYPE "CookbookDishStatus" AS ENUM ('queued', 'claimed', 'delivered', 'applied', 'dismissed', 'failed');

-- AlterTable
-- Whether the module takes dishes from the Magical Recipe Book, and which body versions, from
-- module 0.38.0's bridge.hello.
ALTER TABLE "campaign" ADD COLUMN     "dishesEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "dishVersions" INTEGER[] DEFAULT ARRAY[]::INTEGER[];

-- CreateTable
-- A player's link from the Magical Recipe Book to their seat, kept as a hash.
CREATE TABLE "cookbook_link" (
    "id" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "hint" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3),

    CONSTRAINT "cookbook_link_pkey" PRIMARY KEY ("id")
);

-- CreateTable
-- A dish from the Magical Recipe Book, queued for its campaign's Foundry.
CREATE TABLE "cookbook_dish" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "characterId" TEXT,
    "linkId" TEXT,
    "actorId" TEXT NOT NULL,
    "dishId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "recipe" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "CookbookDishStatus" NOT NULL DEFAULT 'queued',
    "reason" TEXT,
    "error" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "claimToken" TEXT,
    "claimSession" TEXT,
    "claimedAt" TIMESTAMP(3),
    "messageId" TEXT,
    "appliedTo" JSONB,
    "rolled" JSONB,
    "decidedAt" TIMESTAMP(3),
    "queuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cookbook_dish_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cookbook_link_codeHash_key" ON "cookbook_link"("codeHash");
CREATE UNIQUE INDEX "cookbook_link_characterId_key" ON "cookbook_link"("characterId");
CREATE INDEX "cookbook_link_campaignId_idx" ON "cookbook_link"("campaignId");
-- The claim's order: a campaign's waiting dishes, oldest first.
CREATE INDEX "cookbook_dish_campaignId_status_queuedAt_idx" ON "cookbook_dish"("campaignId", "status", "queuedAt");
CREATE INDEX "cookbook_dish_characterId_createdAt_idx" ON "cookbook_dish"("characterId", "createdAt");
CREATE INDEX "cookbook_dish_linkId_createdAt_idx" ON "cookbook_dish"("linkId", "createdAt");
-- One row per cookbook dish per campaign: a repeat is the same dish.
CREATE UNIQUE INDEX "cookbook_dish_campaignId_dishId_key" ON "cookbook_dish"("campaignId", "dishId");

-- AddForeignKey
ALTER TABLE "cookbook_link" ADD CONSTRAINT "cookbook_link_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "character"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cookbook_link" ADD CONSTRAINT "cookbook_link_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cookbook_dish" ADD CONSTRAINT "cookbook_dish_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cookbook_dish" ADD CONSTRAINT "cookbook_dish_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "character"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "cookbook_dish" ADD CONSTRAINT "cookbook_dish_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES "cookbook_link"("id") ON DELETE SET NULL ON UPDATE CASCADE;
