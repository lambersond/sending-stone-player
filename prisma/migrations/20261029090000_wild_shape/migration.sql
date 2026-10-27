-- AlterTable
-- Whether the campaign lets its players use Wild Shape from the app, from module 0.40.0's bridge.hello: by its own switch, under dnd5e.
ALTER TABLE "campaign" ADD COLUMN "wildShapeEnabled" BOOLEAN NOT NULL DEFAULT false;
