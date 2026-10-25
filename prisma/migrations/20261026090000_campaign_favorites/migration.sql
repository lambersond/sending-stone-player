-- AlterTable
-- Whether the module adds and removes characters' favorites for the app, from module 0.37.0's
-- bridge.hello: under dnd5e, with no switch of its own.
ALTER TABLE "campaign" ADD COLUMN "favoritesEnabled" BOOLEAN NOT NULL DEFAULT false;
