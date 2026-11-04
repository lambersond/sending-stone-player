-- AlterTable
-- When the campaign's chat was last cleared (v0.44): by its Gamemaster on its card in the app, or by Foundry's Clear Chat Log. A later change to a message posted before then and no longer held brings nothing back.
ALTER TABLE "campaign" ADD COLUMN "chatClearedAt" TIMESTAMP(3);
