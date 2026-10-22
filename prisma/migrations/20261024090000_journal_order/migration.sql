-- AlterTable
-- What else the module does with journal notes, from module 0.35.0's bridge.hello: 'orders' where
-- it takes the app's orders of a group's notes.
ALTER TABLE "campaign" ADD COLUMN     "noteFeatures" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
-- The journal's last change that leaves no note to show it, from module 0.35.0: a note deleted, or
-- a group's notes put in order, here or in Foundry; by whom, when, and where.
ALTER TABLE "journal_book" ADD COLUMN     "changedAt" TIMESTAMP(3),
ADD COLUMN     "changedBy" TEXT,
ADD COLUMN     "changedIn" TEXT;

-- AlterTable
-- A note's place in its group as Foundry last sent the journal, from 0.
ALTER TABLE "journal_note" ADD COLUMN     "place" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
-- A new order of one group's notes made here, waiting for the module to make it in Foundry.
CREATE TABLE "journal_order" (
    "id" TEXT NOT NULL,
    "seq" INTEGER NOT NULL DEFAULT 0,
    "campaignId" TEXT NOT NULL,
    "bookId" TEXT NOT NULL,
    "chapterId" TEXT NOT NULL,
    "ids" TEXT[],
    "was" TEXT[],
    "seat" "RollRole" NOT NULL DEFAULT 'player',
    "requestedById" TEXT NOT NULL,
    "writerActorId" TEXT,
    "modifiedAt" TIMESTAMP(3) NOT NULL,
    "modifiedBy" TEXT NOT NULL,
    "status" "NoteWriteStatus" NOT NULL DEFAULT 'pending',
    "reason" TEXT,
    "claimToken" TEXT,
    "claimSession" TEXT,
    "claimedAt" TIMESTAMP(3),
    "queuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "journal_order_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
-- The claim's order: a campaign's waiting orders, oldest first.
CREATE INDEX "journal_order_campaignId_status_queuedAt_idx" ON "journal_order"("campaignId", "status", "queuedAt");

-- CreateIndex
-- A seat's orders in the last minute, by when it made them, for its limit.
CREATE INDEX "journal_order_requestedById_modifiedAt_idx" ON "journal_order"("requestedById", "modifiedAt");

-- CreateIndex
-- At most one order per group.
CREATE UNIQUE INDEX "journal_order_bookId_chapterId_key" ON "journal_order"("bookId", "chapterId");

-- AddForeignKey
-- A book deleted takes its orders with it.
ALTER TABLE "journal_order" ADD CONSTRAINT "journal_order_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "journal_book"("id") ON DELETE CASCADE ON UPDATE CASCADE;
