-- AlterTable
-- Whether the campaign's module is one that asks a player typing in their dice for the dice an item rolls later, module 0.44.0 or later under dnd5e 5, from its latest bridge.hello's versions, whatever the switches: for Help at either seat.
ALTER TABLE "campaign" ADD COLUMN     "laterDice" BOOLEAN NOT NULL DEFAULT false;

-- Until a campaign's next hello sets it: from the versions its last hello gave, which its "foundry" keeps, by `asksLaterDice`'s rule (src/utils/dice-asks.ts), whatever its switches. Under dnd5e 5, by the first number of the system's version; and the module's version 0.44.0 or later, compared number by number, a number it lacks taken as 0, a part that isn't a number never later, so a version that can't be read leaves it off and never fails the migration.
UPDATE "campaign" SET "laterDice" = true
WHERE "id" IN (
  SELECT "id" FROM (
    SELECT
      "id",
      "foundry" -> 'system' ->> 'id' AS "system",
      substring("foundry" -> 'system' ->> 'version' FROM '^\s*[+-]?[0-9]+')::numeric AS "major",
      string_to_array("foundry" -> 'module' ->> 'version', '.') AS "parts"
    FROM "campaign"
  ) AS "hello"
  WHERE "system" = 'dnd5e' AND "major" = 5 AND (
    CASE WHEN "parts"[1] IS NULL THEN 0 ELSE substring("parts"[1] FROM '^\s*[+-]?[0-9]+')::numeric END,
    CASE WHEN "parts"[2] IS NULL THEN 0 ELSE substring("parts"[2] FROM '^\s*[+-]?[0-9]+')::numeric END,
    CASE WHEN "parts"[3] IS NULL THEN 0 ELSE substring("parts"[3] FROM '^\s*[+-]?[0-9]+')::numeric END
  ) >= (0, 44, 0)
);
