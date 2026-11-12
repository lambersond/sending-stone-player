-- AlterTable
-- What else the module does with favorites, from module 0.47.0's bridge.hello: 'orders' where it
-- puts a character's favorites in the order the app sends. Empty until the campaign's next hello.
ALTER TABLE "campaign" ADD COLUMN     "favoriteFeatures" TEXT[] DEFAULT ARRAY[]::TEXT[];
