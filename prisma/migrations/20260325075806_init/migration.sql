-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "Language" AS ENUM ('EN', 'ZH', 'JP', 'KR');

-- CreateEnum
CREATE TYPE "TxFlowType" AS ENUM ('DEPOSIT', 'WITHDRAW', 'PURCHASE', 'EQUITY');

-- CreateEnum
CREATE TYPE "TxFlowStatus" AS ENUM ('PENDING', 'CONFIRMED', 'FAILED', 'ABORT', 'AUDITING', 'REFUSED');

-- CreateEnum
CREATE TYPE "TokenType" AS ENUM ('USDT', 'HAK');

-- CreateEnum
CREATE TYPE "UserType" AS ENUM ('NORMAL', 'COMMUNITY');

-- CreateEnum
CREATE TYPE "EquityType" AS ENUM ('BASE', 'PLUS', 'PREMIUM');

-- CreateEnum
CREATE TYPE "LinkedPlatform" AS ENUM ('DISCORD', 'X', 'TELEGRAM', 'INSTAGRAM');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('MENTIONED', 'COMMENT', 'FOLLOW');

-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL,
    "wallet_address" VARCHAR(255) NOT NULL,
    "username" VARCHAR(255) NOT NULL,
    "display_name" VARCHAR(255) NOT NULL,
    "gender" "Gender" NOT NULL,
    "bio" VARCHAR(255),
    "email" VARCHAR(255),
    "phone_number" VARCHAR(255),
    "dark_mode" BOOLEAN NOT NULL DEFAULT false,
    "language" "Language" NOT NULL,
    "portrait_url" VARCHAR(255),
    "avatar_url" VARCHAR(255),
    "background_url" VARCHAR(255),
    "type" "UserType",
    "equity_type" "EquityType",
    "superior" VARCHAR(255),
    "referral_code" VARCHAR(255),
    "purchaseAt" TIMESTAMP(3),
    "equityActivedAt" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_statistic" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "post_count" INTEGER NOT NULL DEFAULT 0,
    "follower_count" INTEGER NOT NULL DEFAULT 0,
    "following_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_statistic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_linked_account" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "linked_platform" "LinkedPlatform" NOT NULL,
    "account" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_linked_account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "post" (
    "id" TEXT NOT NULL,
    "re_post_id" TEXT,
    "user_id" TEXT NOT NULL,
    "title" VARCHAR(255),
    "content" VARCHAR(10000),
    "published" BOOLEAN NOT NULL DEFAULT false,
    "media_urls" TEXT[],
    "mentioned_user_ids" TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "post_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "post_statistic" (
    "post_id" TEXT NOT NULL,
    "view_count" INTEGER NOT NULL DEFAULT 0,
    "like_count" INTEGER NOT NULL DEFAULT 0,
    "comment_count" INTEGER NOT NULL DEFAULT 0,
    "repost_count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "post_statistic_pkey" PRIMARY KEY ("post_id")
);

-- CreateTable
CREATE TABLE "comment" (
    "id" TEXT NOT NULL,
    "post_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "reply_user_id" TEXT,
    "content" VARCHAR(10000) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "comment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comment_statistic" (
    "comment_id" TEXT NOT NULL,
    "view_count" INTEGER NOT NULL DEFAULT 0,
    "like_count" INTEGER NOT NULL DEFAULT 0,
    "repost_count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "comment_statistic_pkey" PRIMARY KEY ("comment_id")
);

-- CreateTable
CREATE TABLE "post_like" (
    "id" TEXT NOT NULL,
    "post_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "post_like_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comment_like" (
    "id" TEXT NOT NULL,
    "comment_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "comment_like_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "follow" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "following_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "follow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "resource_id" TEXT NOT NULL,
    "notification_type" "NotificationType" NOT NULL,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message" (
    "id" TEXT NOT NULL,
    "send_user_id" TEXT NOT NULL,
    "receive_user_id" TEXT NOT NULL,
    "content" VARCHAR(10000) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "tx_hash" TEXT,
    "from_address" TEXT NOT NULL,
    "to_address" TEXT NOT NULL,
    "type" "TxFlowType" NOT NULL,
    "token_type" "TokenType" NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "amount_fee" DECIMAL(65,30),
    "tx_fee" DECIMAL(65,30),
    "status" "TxFlowStatus" NOT NULL DEFAULT 'PENDING',
    "description" TEXT,
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_wallet_address_key" ON "user"("wallet_address");

-- CreateIndex
CREATE UNIQUE INDEX "user_username_key" ON "user"("username");

-- CreateIndex
CREATE UNIQUE INDEX "user_referral_code_key" ON "user"("referral_code");

-- CreateIndex
CREATE INDEX "user_wallet_address_idx" ON "user"("wallet_address");

-- CreateIndex
CREATE INDEX "user_username_idx" ON "user"("username");

-- CreateIndex
CREATE INDEX "user_email_idx" ON "user"("email");

-- CreateIndex
CREATE INDEX "user_phone_number_idx" ON "user"("phone_number");

-- CreateIndex
CREATE INDEX "user_statistic_user_id_idx" ON "user_statistic"("user_id");

-- CreateIndex
CREATE INDEX "user_linked_account_user_id_idx" ON "user_linked_account"("user_id");

-- CreateIndex
CREATE INDEX "post_user_id_idx" ON "post"("user_id");

-- CreateIndex
CREATE INDEX "post_statistic_post_id_idx" ON "post_statistic"("post_id");

-- CreateIndex
CREATE INDEX "comment_post_id_idx" ON "comment"("post_id");

-- CreateIndex
CREATE INDEX "comment_user_id_idx" ON "comment"("user_id");

-- CreateIndex
CREATE INDEX "comment_reply_user_id_idx" ON "comment"("reply_user_id");

-- CreateIndex
CREATE INDEX "comment_statistic_comment_id_idx" ON "comment_statistic"("comment_id");

-- CreateIndex
CREATE INDEX "post_like_user_id_idx" ON "post_like"("user_id");

-- CreateIndex
CREATE INDEX "post_like_post_id_idx" ON "post_like"("post_id");

-- CreateIndex
CREATE INDEX "comment_like_user_id_idx" ON "comment_like"("user_id");

-- CreateIndex
CREATE INDEX "comment_like_comment_id_idx" ON "comment_like"("comment_id");

-- CreateIndex
CREATE INDEX "follow_user_id_idx" ON "follow"("user_id");

-- CreateIndex
CREATE INDEX "follow_following_user_id_idx" ON "follow"("following_user_id");

-- CreateIndex
CREATE INDEX "notification_user_id_idx" ON "notification"("user_id");

-- CreateIndex
CREATE INDEX "message_send_user_id_idx" ON "message"("send_user_id");

-- CreateIndex
CREATE INDEX "message_receive_user_id_idx" ON "message"("receive_user_id");
