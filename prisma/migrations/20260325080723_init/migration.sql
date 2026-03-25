/*
  Warnings:

  - You are about to drop the column `referralCode` on the `user` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[referral_code]` on the table `user` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "user_referralCode_key";

-- AlterTable
ALTER TABLE "user" DROP COLUMN "referralCode",
ADD COLUMN     "referral_code" VARCHAR(255);

-- CreateIndex
CREATE UNIQUE INDEX "user_referral_code_key" ON "user"("referral_code");
