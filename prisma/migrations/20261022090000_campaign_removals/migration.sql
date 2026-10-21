-- AlterTable
-- Whether the module removes characters' items for the app, from module 0.33.0's bridge.hello:
-- under dnd5e, with no switch of its own.
ALTER TABLE "campaign" ADD COLUMN "removalsEnabled" BOOLEAN NOT NULL DEFAULT false;
