-- AlterTable
-- A campaign's Group actors, from module 0.30.0. Each campaign's next bridge.hello lists them.
ALTER TABLE "campaign" ADD COLUMN     "groups" JSONB NOT NULL DEFAULT '[]';

-- CreateTable
CREATE TABLE "group_sheet" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "group_sheet_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "group_sheet_campaignId_actorId_key" ON "group_sheet"("campaignId", "actorId");

-- AddForeignKey
ALTER TABLE "group_sheet" ADD CONSTRAINT "group_sheet_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
