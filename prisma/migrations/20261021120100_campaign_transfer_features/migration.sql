-- AlterTable
-- What else the module does with moves of items and coins, from module 0.32.0's bridge.hello: a
-- party's things sent elsewhere by its Owner, and a party's coin distributed among its characters.
ALTER TABLE "campaign" ADD COLUMN "transferFeatures" TEXT[] DEFAULT ARRAY[]::TEXT[];
