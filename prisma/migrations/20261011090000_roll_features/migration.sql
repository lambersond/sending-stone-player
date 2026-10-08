-- AlterTable
ALTER TABLE "campaign" ADD COLUMN     "rollFeatures" TEXT[] DEFAULT ARRAY[]::TEXT[];
