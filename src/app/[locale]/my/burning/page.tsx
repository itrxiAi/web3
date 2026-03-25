"use client";

import { useTranslations } from "next-intl";
import Image from "next/image";
import { useRouter } from "next/navigation";
import React, { Suspense, useState, useEffect } from "react";
import { TxFlowStatus, TxFlowType } from "@prisma/client";
import { formatTime } from "@/utils/dateUtils";
//import { useWallet } from '@solana/wallet-adapter-react'
import { useAppKitAccount } from "@reown/appkit/react";
import { truncateDecimals } from "@/utils/common";

// Staking Record interface
interface StakingRecord {
  time: string;
  amount: number;
  duration: string;
  status: string;
}

interface UserStakeInfo {
  balance: number;
  stakedBalance: number;
  records: StakingRecord[];
}

interface StakeData {
  total: number;
  balance: number;
  duration: number;
}

export default function MyStakePage() {
  const { address } = useAppKitAccount();
  const [userStakeInfo, setUserStakeInfo] = useState<UserStakeInfo | null>(
    null
  );
  const [stakeData, setStakeData] = useState<StakeData | null>({
    total: 0,
    balance: 0,
    duration: 365,
  });
  const t = useTranslations("my");
  const tMining = useTranslations("stake");
  const router = useRouter();

  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  const fetchStakingRecords = async () => {
    try {
      if (!address) {
        return;
      }

      const response = await fetch("/api/user/transactions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          address: address.toString(),
          status: [
            TxFlowStatus.PENDING,
            TxFlowStatus.CONFIRMED,
            TxFlowStatus.FAILED,
          ],
          flowTypeArr: [TxFlowType.DEPOSIT],
          take: 100, // Adjust based on your needs
        }),
      });

      const data = await response.json();
      if (data.data) {
        // Convert the data to match our StakingRecord interface
        const records = data.data.map((record: any) => ({
          time: new Date(record.created_at).toISOString(),
          amount: `${record.amount}`,
          status: record.status,
        }));
        return records;
      }
    } catch (error) {
      console.error("Error fetching staking records:", error);
      setError("Failed to fetch staking records");
    }
  };

  const fetchUserStakeInfo = async () => {
    try {
      if (!address) {
        setUserStakeInfo({ balance: 0, stakedBalance: 0, records: [] });
        return;
      }

      const response = await fetch(
        `/api/user/info?address=${address.toString()}`
      );
      const data = await response.json();
      const records = await fetchStakingRecords();

      setUserStakeInfo({ balance: data.token_points, stakedBalance: data.token_staked_points, records: records });
    } catch (error) {
      console.error("Error fetching user info:", error);
    }
  };

  const handleFetchStakeRecords = async () => {
    try {
      if (!address) {
        setError("Please connect your wallet first");
        return;
      }

      fetchUserStakeInfo();
    } catch (err) {
      console.error("Failed to fetch stake records:", err);
      setError(
        err instanceof Error ? err.message : "Failed to fetch stake records"
      );
    }
  };

  useEffect(() => {
    fetchUserStakeInfo();
  }, [address]);

  return (
    <div className="flex flex-col min-h-screen h-full bg-black text-white">
      {/* Main content area with bottom padding for nav and top padding for header */}
      <div className="flex-1 pb-16 pt-20 bg-black">
        <div className="p-4 pl-0">
          {/* Header with back button */}
          <div className="mb-6 relative z-50">
            <button
              onClick={() => router.back()}
              className="mb-4 p-2"
              aria-label="Go back"
            >
              <Image
                src="/images/icons/arrow-left.svg"
                alt="Back"
                width={24}
                height={24}
              />
            </button>
            <h1 className="text-lg font-semibold mb-2 flex items-center pl-2">
              <div className="w-1 h-5 bg-[#3B82F6] mr-2"></div>
              <span className="text-white">{t("my_stake")}</span>
            </h1>
          </div>

          {/* Table header */}
          <div className="grid grid-cols-3 gap-4 text-[#3B82F6] mb-4 text-xs px-2">
            <div className="text-left">{t("stake_page.time")}</div>
            <div className="text-center">{t("stake_page.amount")}</div>
            <div className="text-right">{t("stake_page.status")}</div>
          </div>

          {/* Table content */}
          <div className="space-y-1">
            {userStakeInfo?.records.map((record, index) => (
              <div
                key={index}
                className="grid grid-cols-3 gap-4 py-2 px-2 text-xs text-white bg-transparent mb-1"
              >
                <div className="text-left">
                  {formatTime(new Date(record.time))}
                </div>
                <div className="text-center">
                  {truncateDecimals(record.amount)} TXT
                </div>
                <div className="text-right">
                  <span
                    className={`${
                      record.status === TxFlowStatus.PENDING
                        ? "text-[#FFC355]"
                        : "text-white"
                    }`}
                  >
                    {record.status === "PENDING"
                      ? tMining("status_staking")
                      : tMining("status_completed")}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
