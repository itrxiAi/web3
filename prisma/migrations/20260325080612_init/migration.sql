/*
  Warnings:

  - You are about to drop the column `referral_code` on the `user` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[referralCode]` on the table `user` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "user_referral_code_key";

-- AlterTable
ALTER TABLE "user" DROP COLUMN "referral_code",
ADD COLUMN     "path" TEXT,
ADD COLUMN     "referralCode" VARCHAR(255);

-- CreateIndex
CREATE UNIQUE INDEX "user_referralCode_key" ON "user"("referralCode");
