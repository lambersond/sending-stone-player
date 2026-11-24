-- AlterTable
-- Whether the campaign's module lists the Gamemaster's constant companions, from module 0.54.0's bridge.hello (`features.companions.constant`), for Help. Off until the campaign's next hello.
ALTER TABLE "campaign" ADD COLUMN "companionsConstant" BOOLEAN NOT NULL DEFAULT false;
