-- CreateTable
CREATE TABLE "roll_prompt" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "promptId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "openedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "closedAt" TIMESTAMP(3),
    "closedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roll_prompt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "roll_prompt_campaignId_actorId_closedAt_idx" ON "roll_prompt"("campaignId", "actorId", "closedAt");

-- CreateIndex
CREATE UNIQUE INDEX "roll_prompt_campaignId_promptId_key" ON "roll_prompt"("campaignId", "promptId");

-- AddForeignKey
ALTER TABLE "roll_prompt" ADD CONSTRAINT "roll_prompt_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
