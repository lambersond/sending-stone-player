-- AlterTable
-- Whether the campaign's module is one that asks a player typing in their dice for the dice an item rolls later, module 0.44.0 or later under dnd5e 5, from its latest bridge.hello's versions, whatever the switches: for Help at either seat.
ALTER TABLE "campaign" ADD COLUMN     "laterDice" BOOLEAN NOT NULL DEFAULT false;

-- Until a campaign's next hello sets it from its versions: on where its last hello said it asks for those dice now, which only such a module says.
UPDATE "campaign" SET "laterDice" = true WHERE 'diceAsks' = ANY("rollFeatures");
