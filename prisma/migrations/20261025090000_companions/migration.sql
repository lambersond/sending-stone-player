-- AlterTable
-- The campaign's characters' companions, from module 0.36.0's bridge.hello and each
-- companions.listed since, each without its sheet; the kinds a companion's rolls may be; and how
-- its characters' companions enter initiative, "own" until the module says otherwise.
ALTER TABLE "campaign" ADD COLUMN     "companionInitiative" TEXT NOT NULL DEFAULT 'own',
ADD COLUMN     "companionKinds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "companions" JSONB NOT NULL DEFAULT '[]';

-- AlterTable
-- For a companion's roll, from module 0.36.0: the campaign character whose companion it is.
ALTER TABLE "roll_request" ADD COLUMN     "ofActorId" TEXT;

-- CreateTable
-- One of a campaign's characters' companions' sheets, kept apart from the characters' sheets.
CREATE TABLE "companion_sheet" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "companion_sheet_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
-- One sheet per companion of a campaign, by its key.
CREATE UNIQUE INDEX "companion_sheet_campaignId_key_key" ON "companion_sheet"("campaignId", "key");

-- AddForeignKey
-- A campaign removed takes its companions' sheets with it.
ALTER TABLE "companion_sheet" ADD CONSTRAINT "companion_sheet_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
