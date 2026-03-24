-- CreateEnum
CREATE TYPE "EquityType" AS ENUM ('BASE', 'PLUS', 'PREMIUM');

-- AlterTable
ALTER TABLE "user_info" ADD COLUMN     "equity_type" "EquityType";
