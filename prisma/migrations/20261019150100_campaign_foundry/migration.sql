-- AlterTable
-- What Foundry last said of itself for a campaign, from its next bridge.hello: its versions, and
-- from module 0.30.0 its settings. Only the Gamemaster's campaign card reads it.
ALTER TABLE "campaign" ADD COLUMN     "foundry" JSONB;
