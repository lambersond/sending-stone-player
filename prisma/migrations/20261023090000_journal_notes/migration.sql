-- CreateEnum
-- Whose journal of notes, from module 0.34.0: a character's own, or a party's.
CREATE TYPE "JournalKind" AS ENUM ('personal', 'party');

-- CreateEnum
-- A journal note: a chapter, a level 1 heading in Foundry's journal, or an entry under one.
CREATE TYPE "NoteRole" AS ENUM ('chapter', 'entry');

-- CreateEnum
-- What a change made here asks of Foundry.
CREATE TYPE "NoteOp" AS ENUM ('create', 'update', 'delete');

-- CreateEnum
-- Where a change made here stands, on its way to Foundry or not.
CREATE TYPE "NoteWriteStatus" AS ENUM ('pending', 'claimed', 'conflict', 'failed', 'made');

-- AlterTable
-- Whether the module keeps journal notes for the app, from module 0.34.0's bridge.hello, with
-- no switch.
ALTER TABLE "campaign" ADD COLUMN     "notesEnabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
-- A character's or a party's journal of notes in a campaign: the app's mirror of Foundry's.
CREATE TABLE "journal_book" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "kind" "JournalKind" NOT NULL,
    "actorId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,
    "journalId" TEXT,
    "journalName" TEXT,
    "withheld" JSONB,
    "syncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "journal_book_pkey" PRIMARY KEY ("id")
);

-- CreateTable
-- A note as Foundry last held it.
CREATE TABLE "journal_note" (
    "bookId" TEXT NOT NULL,
    "noteId" TEXT NOT NULL,
    "role" "NoteRole" NOT NULL,
    "chapterId" TEXT,
    "title" TEXT NOT NULL,
    "format" INTEGER NOT NULL,
    "body" TEXT NOT NULL,
    "html" TEXT NOT NULL,
    "cut" BOOLEAN NOT NULL DEFAULT false,
    "secret" BOOLEAN NOT NULL DEFAULT false,
    "authorActorId" TEXT,
    "authorGm" BOOLEAN NOT NULL DEFAULT false,
    "authorName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "modifiedAt" TIMESTAMP(3) NOT NULL,
    "modifiedBy" TEXT NOT NULL,
    "modifiedIn" TEXT NOT NULL,
    "revision" TEXT NOT NULL,

    CONSTRAINT "journal_note_pkey" PRIMARY KEY ("bookId","noteId")
);

-- CreateTable
-- A change made here to a note, waiting for the module to make it in Foundry.
CREATE TABLE "journal_write" (
    "id" TEXT NOT NULL,
    "seq" INTEGER NOT NULL DEFAULT 0,
    "campaignId" TEXT NOT NULL,
    "bookId" TEXT NOT NULL,
    "noteId" TEXT NOT NULL,
    "op" "NoteOp" NOT NULL,
    "role" "NoteRole" NOT NULL,
    "chapterId" TEXT,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "html" TEXT NOT NULL,
    "authorActorId" TEXT,
    "authorGm" BOOLEAN NOT NULL DEFAULT false,
    "authorName" TEXT NOT NULL,
    "noteCreatedAt" TIMESTAMP(3) NOT NULL,
    "seat" "RollRole" NOT NULL DEFAULT 'player',
    "requestedById" TEXT NOT NULL,
    "writerActorId" TEXT,
    "modifiedAt" TIMESTAMP(3) NOT NULL,
    "modifiedBy" TEXT NOT NULL,
    "base" TEXT,
    "status" "NoteWriteStatus" NOT NULL DEFAULT 'pending',
    "reason" TEXT,
    "foundryRev" TEXT,
    "claimToken" TEXT,
    "claimSession" TEXT,
    "claimedAt" TIMESTAMP(3),
    "queuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "journal_write_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
-- One book per campaign, kind and actor.
CREATE UNIQUE INDEX "journal_book_campaignId_kind_actorId_key" ON "journal_book"("campaignId", "kind", "actorId");

-- CreateIndex
-- The claim's order: a campaign's waiting changes, oldest first.
CREATE INDEX "journal_write_campaignId_status_queuedAt_idx" ON "journal_write"("campaignId", "status", "queuedAt");

-- CreateIndex
-- A seat's changes in the last minute, by when it made them, for its limit.
CREATE INDEX "journal_write_requestedById_modifiedAt_idx" ON "journal_write"("requestedById", "modifiedAt");

-- CreateIndex
-- At most one change waiting per note.
CREATE UNIQUE INDEX "journal_write_bookId_noteId_key" ON "journal_write"("bookId", "noteId");

-- AddForeignKey
-- A campaign removed takes its books with it.
ALTER TABLE "journal_book" ADD CONSTRAINT "journal_book_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
-- And a book its notes.
ALTER TABLE "journal_note" ADD CONSTRAINT "journal_note_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "journal_book"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
-- And its changes waiting.
ALTER TABLE "journal_write" ADD CONSTRAINT "journal_write_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "journal_book"("id") ON DELETE CASCADE ON UPDATE CASCADE;

