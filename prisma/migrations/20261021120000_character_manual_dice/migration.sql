-- AlterTable
-- Whether the character's player types in what their own dice show, on every device (module 0.32.0).
ALTER TABLE "character" ADD COLUMN "manualDice" BOOLEAN NOT NULL DEFAULT false;
