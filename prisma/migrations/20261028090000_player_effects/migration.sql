-- AlterTable
-- Whether the campaign lets its players turn off, turn on and delete their own characters' effects from the app, from module 0.39.0's bridge.hello: by its own switch, under dnd5e.
ALTER TABLE "campaign" ADD COLUMN "effectsEnabled" BOOLEAN NOT NULL DEFAULT false;
