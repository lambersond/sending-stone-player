-- AlterTable
ALTER TABLE "campaign" ADD COLUMN     "refusalDetail" TEXT,
ADD COLUMN     "refusalReason" TEXT,
ADD COLUMN     "refusalStatus" INTEGER,
ADD COLUMN     "refusedAt" TIMESTAMP(3);
