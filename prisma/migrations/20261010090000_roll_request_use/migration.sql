-- AlterTable
ALTER TABLE "roll_request" ADD COLUMN     "useId" TEXT;

-- CreateIndex
CREATE INDEX "roll_request_useId_idx" ON "roll_request"("useId");
