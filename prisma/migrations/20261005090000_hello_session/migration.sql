-- The module session whose bridge.hello was last applied to each campaign. Unset for every
-- campaign now, so the next event for each asks the module to send its hello again.

-- AlterTable
ALTER TABLE "campaign" ADD COLUMN     "helloSession" TEXT;
