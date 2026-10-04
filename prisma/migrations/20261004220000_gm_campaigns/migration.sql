-- Gamemasters now set campaigns up here, each with the secret their module sends, and invite
-- players, who choose one of the campaign's characters. Campaigns from before have no owner: they
-- keep their chat and combats, but accept no events until their Gamemaster sets them up again.

-- AlterTable
ALTER TABLE "campaign" ADD COLUMN     "inviteCode" TEXT,
ADD COLUMN     "lastSeenAt" TIMESTAMP(3),
ADD COLUMN     "ownerId" TEXT,
ADD COLUMN     "secretHash" TEXT,
ALTER COLUMN "foundryId" DROP NOT NULL,
ALTER COLUMN "worldId" DROP NOT NULL,
ALTER COLUMN "worldTitle" DROP NOT NULL;

UPDATE "campaign" SET "lastSeenAt" = "lastEventAt";

-- AlterTable
ALTER TABLE "character" ADD COLUMN     "actorId" TEXT,
ADD COLUMN     "campaignId" TEXT;

-- Link each existing character to the campaign it followed, found as before by its game and the
-- campaign title it was given, and to that campaign's character with its name.
UPDATE "character" AS c
SET "campaignId" = (
  SELECT p."id"
  FROM "campaign" AS p
  WHERE p."origin" = c."gameUrl" AND lower(p."title") = lower(btrim(c."campaignTitle"))
  ORDER BY p."lastEventAt" DESC NULLS LAST
  LIMIT 1
)
WHERE btrim(c."campaignTitle") <> '';

UPDATE "character" AS c
SET "actorId" = (
  SELECT entry ->> 'id'
  FROM "campaign" AS p, jsonb_array_elements(p."characters") AS entry
  WHERE p."id" = c."campaignId"
    AND lower(regexp_replace(btrim(entry ->> 'name'), '\s+', ' ', 'g'))
      = lower(regexp_replace(btrim(c."name"), '\s+', ' ', 'g'))
  LIMIT 1
)
WHERE c."campaignId" IS NOT NULL;

-- One player per character: where two followed the same one, the first added keeps it and the
-- other chooses again.
UPDATE "character" SET "actorId" = NULL
WHERE "id" IN (
  SELECT "id" FROM (
    SELECT "id", row_number() OVER (PARTITION BY "campaignId", "actorId" ORDER BY "createdAt", "id") AS n
    FROM "character"
    WHERE "actorId" IS NOT NULL
  ) AS ranked
  WHERE n > 1
);

-- CreateIndex
CREATE UNIQUE INDEX "campaign_inviteCode_key" ON "campaign"("inviteCode");

-- CreateIndex
CREATE INDEX "campaign_ownerId_idx" ON "campaign"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "character_campaignId_actorId_key" ON "character"("campaignId", "actorId");

-- AddForeignKey
ALTER TABLE "character" ADD CONSTRAINT "character_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign" ADD CONSTRAINT "campaign_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
