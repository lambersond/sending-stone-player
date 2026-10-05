-- CreateTable
CREATE TABLE "sheet_text" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "html" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sheet_text_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sheet_text_campaignId_hash_key" ON "sheet_text"("campaignId", "hash");

-- AddForeignKey
ALTER TABLE "sheet_text" ADD CONSTRAINT "sheet_text_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

