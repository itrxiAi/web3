-- AlterTable
ALTER TABLE "user" ADD COLUMN     "depth" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "user_referral_code_idx" ON "user"("referral_code");

-- CreateIndex
CREATE INDEX "user_path_idx" ON "user"("path");

-- CreateIndex
CREATE INDEX "user_depth_idx" ON "user"("depth");
