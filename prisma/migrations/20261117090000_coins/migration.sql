-- AlterTable
-- Whether the campaign lets its players add coins to their characters and take them away from the app, from module 0.48.0's bridge.hello: by its own switch, on by default, under dnd5e; and what else its module does with them, 'change' where a character short of a coin pays with its other coins. Off and empty until the campaign's next hello.
ALTER TABLE "campaign" ADD COLUMN "coinsEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "coinFeatures" TEXT[] DEFAULT ARRAY[]::TEXT[];
