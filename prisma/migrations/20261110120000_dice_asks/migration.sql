-- CreateTable
-- The dice of a later roll in a typed roll's run, asked of its player, from module 0.44.0: until the module closes it or its wait runs out; deleted a day after.
CREATE TABLE "dice_ask" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "askId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "ofActorId" TEXT,
    "commandId" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "askedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "closedAt" TIMESTAMP(3),
    "closedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dice_ask_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
-- A character's or companion's asks still open, as its view lists them.
CREATE INDEX "dice_ask_campaignId_actorId_closedAt_idx" ON "dice_ask"("campaignId", "actorId", "closedAt");

-- CreateIndex
-- The asks of one typed roll, as its player's page asks after it.
CREATE INDEX "dice_ask_campaignId_commandId_idx" ON "dice_ask"("campaignId", "commandId");

-- CreateIndex
CREATE UNIQUE INDEX "dice_ask_campaignId_askId_key" ON "dice_ask"("campaignId", "askId");

-- AddForeignKey
-- A campaign deleted takes its asks with it.
ALTER TABLE "dice_ask" ADD CONSTRAINT "dice_ask_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
