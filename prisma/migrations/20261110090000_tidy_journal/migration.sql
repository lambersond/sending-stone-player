-- CreateEnum
-- Where a Tidy 5e Sheets journal entry is kept on its character, from module 0.44.0: an entry of Tidy's current sheet's Journal tab, or one of its Classic sheet's five boxes.
CREATE TYPE "TidySource" AS ENUM ('journal', 'classic');

-- AlterTable
-- Whether Tidy 5e Sheets is active in the world, and its version, from module 0.44.0's bridge.hello: both unset where the hello says nothing of Tidy.
ALTER TABLE "campaign" ADD COLUMN     "tidyActive" BOOLEAN,
ADD COLUMN     "tidyVersion" TEXT;

-- AlterTable
-- When the character's Tidy 5e Sheets journal was last sent, unset until the first, whose entries are undated; and why the last was held back.
ALTER TABLE "journal_book" ADD COLUMN     "tidySyncedAt" TIMESTAMP(3),
ADD COLUMN     "tidyWithheld" JSONB;

-- CreateTable
-- An entry of Tidy 5e Sheets' journal on a character, as the module last sent it: read only in the app.
CREATE TABLE "journal_tidy_entry" (
    "bookId" TEXT NOT NULL,
    "source" "TidySource" NOT NULL,
    "entryId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "html" TEXT NOT NULL,
    "sort" INTEGER NOT NULL,
    "cut" BOOLEAN NOT NULL DEFAULT false,
    "secret" BOOLEAN NOT NULL DEFAULT false,
    "revision" TEXT NOT NULL,
    "firstSeenAt" TIMESTAMP(3),
    "changedAt" TIMESTAMP(3),

    CONSTRAINT "journal_tidy_entry_pkey" PRIMARY KEY ("bookId","source","entryId")
);

-- AddForeignKey
-- A book removed takes its Tidy entries with it.
ALTER TABLE "journal_tidy_entry" ADD CONSTRAINT "journal_tidy_entry_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "journal_book"("id") ON DELETE CASCADE ON UPDATE CASCADE;
