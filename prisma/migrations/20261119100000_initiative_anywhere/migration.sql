-- AlterTable
-- Whether the campaign's module takes an initiative from the app into any begun encounter its scene has chosen, wherever the Gamemaster's Foundry is: module 0.51.0 or later, from its latest bridge.hello's version (item 36). Off until the campaign's next hello, so the app offers initiative only where module 0.50.0 takes it.
ALTER TABLE "campaign" ADD COLUMN "initiativeAnywhere" BOOLEAN NOT NULL DEFAULT false;
