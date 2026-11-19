-- AlterTable
-- Whether the campaign's module lists companions on every scene, each saying whether it's away, from module 0.51.0's bridge.hello (`features.companions.away`), for Help. Off until the campaign's next hello.
ALTER TABLE "campaign" ADD COLUMN "companionsAway" BOOLEAN NOT NULL DEFAULT false;
