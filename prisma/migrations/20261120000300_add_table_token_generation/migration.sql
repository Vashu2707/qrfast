-- Table QR tokens carry a generation number. Existing printed QR codes keep
-- working (they are treated as generation 1); staff can invalidate a leaked
-- code by regenerating the QR, which increments this counter.

-- AlterTable
ALTER TABLE "Table" ADD COLUMN "tokenGeneration" INTEGER NOT NULL DEFAULT 1;
