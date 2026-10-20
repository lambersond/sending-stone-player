-- AlterTable
-- Whether the Gamemaster lets the campaign's players move items and coins from here, from module
-- 0.31.0's bridge.hello.
ALTER TABLE "campaign" ADD COLUMN "transfersEnabled" BOOLEAN NOT NULL DEFAULT false;
