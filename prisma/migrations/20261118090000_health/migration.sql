-- AlterTable
-- Whether the campaign's players see how hurt other creatures in a fight are, from module 0.50.0's bridge.hello: by its own switch, off by default, under dnd5e; and what else they see of them, 'hitPoints' where their hit points show too. Off and empty until the campaign's next hello.
ALTER TABLE "campaign" ADD COLUMN "healthEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "healthFeatures" TEXT[] DEFAULT ARRAY[]::TEXT[];
