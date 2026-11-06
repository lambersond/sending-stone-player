-- AlterTable
-- Whether the campaign lets its players set hit points and temporary hit points from the app, of their characters, their Wild Shape forms and their companions, from module 0.44.0's bridge.hello: by its own switch, on by default, under dnd5e.
ALTER TABLE "campaign" ADD COLUMN "hitPointsEnabled" BOOLEAN NOT NULL DEFAULT false;
