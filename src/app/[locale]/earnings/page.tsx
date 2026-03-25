"use client";

import React, { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { TokenType, TxFlowStatus, TxFlowType, UserType } from "@prisma/client";
import LoadingSpinner from "@/components/LoadingSpinner";
import { generateOperationHash } from "@/utils/auth";
import bs58 from "bs58";
import { formatTime } from "@/utils/dateUtils";
import { triggerWalletConnect } from "@/components/ui/wallet-ref";
import { ErrorCode } from "@/lib/errors";
import { useAppKitAccount } from "@reown/appkit/react";
import { useSignMessage } from "wagmi";
import { useRouter } from "next/navigation";
import { truncateDecimals } from "@/utils/common";
import BorderCustom from "@/components/ui/border-custom";
import Image from "next/image";
// Earnings Record interface
interface EarningRecord {
  created_at: string;
  token_type: TokenType;
  type: TxFlowType;
  amount: number;
}

// Earnings data interface
interface EarningsData {
  nodeEarningsUsdt: {
    toClaim: number;
    claimed: number;
    total: number;
  };
  nodeDiffEarningsUsdt: {
    toClaim: number;
    claimed: number;
    total: number;
  };
  dividendEarningsUsdt: {
    toClaim: number;
    claimed: number;
    total: number;
  };
  dividendEarningsToken: {
    toClaim: number;
    claimed: number;
    total: number;
  };
  miningEarnings: {
    toClaim: number;
    claimed: number;
    total: number;
  };
  directMiningEarnings: {
    toClaim: number;
    claimed: number;
    total: number;
  };
  airdropEarnings: {
    toClaim: number;
    claimed: number;
    total: number;
  };
  communityEarnings: {
    toClaim: number;
    claimed: number;
    total: number;
  };
  incubationEarnings: {
    toClaim: number;
    claimed: number;
    total: number;
  };
  marketExpenses: {
    toClaim: number;
    claimed: number;
    total: number;
  };
  securityFund: {
    toClaim: number;
    claimed: number;
    total: number;
  };
}

// Earnings Card Component
interface EarningsCardProps {
  title: string;
  amount: string;
  toClaim: string;
  claimed: string;
  type: TokenType;
  isSpecial?: boolean;
}

const EarningsCard: React.FC<EarningsCardProps> = ({
  title,
  amount,
  toClaim,
  claimed,
  type,
  isSpecial = false,
}) => {
  const t = useTranslations("earnings");
  // Convert toClaim string to number for comparison
  const toClaimValue = parseFloat(toClaim);

  return (
    <BorderCustom
      className="mb-2 p-4 bg-black "
      style={{
        border: "1px solid rgba(59, 130, 246, 0.3)",
      }}
    >
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-white text-xs font-medium">{title}</h3>
        <div className="flex items-center">
          {toClaimValue > 0 && (
            <div className="w-2 h-2 rounded-full bg-[#3B82F6] mr-2"></div>
          )}
          <span className="text-white text-xs">
            {t("to_claim")} : {toClaim}{" "}
            {type === TokenType.USDT ? TokenType.USDT : TokenType.HAK}
          </span>
        </div>
      </div>
      <div
        className="flex justify-between items-center"
        style={{ color: "rgba(255, 255, 255, 0.7)" }}
      >
        <span className="text-xs">
          {t("total")} : {amount}{" "}
          {type === TokenType.USDT ? TokenType.USDT : TokenType.HAK}
        </span>
        <span className="text-xs ">
          {t("claimed")} : {claimed}{" "}
          {type === TokenType.USDT ? TokenType.USDT : TokenType.HAK}
        </span>
      </div>
    </BorderCustom>
  );
};

function EarningsContent() {
  const { address } = useAppKitAccount();
  const { signMessageAsync } = useSignMessage();
  const router = useRouter();
  const t = useTranslations("earnings");
  const tError = useTranslations("errors");
  const tPage = useTranslations("page");
  const tTxType = useTranslations("tx_type");

  const [earningsData, setEarningsData] = useState<EarningsData | null>(null);
  const [claimHistory, setClaimHistory] = useState<EarningRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [claimError, setClaimError] = useState("");
  const [claiming, setClaiming] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [feedbackIsError, setFeedbackIsError] = useState(false);
  const [claimType, setClaimType] = useState<TokenType>(TokenType.USDT);
  const [availableAmount, setAvailableAmount] = useState("0");
  const [showTypeDropdown, setShowTypeDropdown] = useState(false);
  const [userType, setUserType] = useState<UserType | null>(null);
  const [isSpecial, setIsSpecial] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalRecords, setTotalRecords] = useState(0);

  const encoder = new TextEncoder();

  const fetchUserInfo = async () => {
    try {
      if (!address) {
        setUserType(null);
        return;
      }

      const response = await fetch(`/api/user/info?address=${address}`);
      const data = await response.json();
      setUserType(data.type);
      setIsSpecial(data.is_special);
    } catch (error) {
      console.error("Error fetching user info:", error);
    }
  };

  // Fetch earnings data
  const fetchEarningsData = async (page?: number, size?: number) => {
    try {
      if (!address) {
        return;
      }

      setLoading(true);

      // Use the provided values or fallback to current state
      const pageToUse = page !== undefined ? page : currentPage;
      const sizeToUse = size !== undefined ? size : pageSize;

      // If a page is specified, update the current page
      if (page !== undefined) {
        setCurrentPage(page);
      }

      // If a size is specified, update the page size
      if (size !== undefined) {
        setPageSize(size);
      }

      // Fetch claim history
      const claimHistoryResponse = await fetch("/api/user/flows", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          address: address,
          status: [TxFlowStatus.CONFIRMED, TxFlowStatus.PENDING],
          flowTypeArr: [
            // TxFlowType.NODE_REWARD,
            // TxFlowType.NODE_DIFF_REWARD,
            // TxFlowType.FEE_DIVIDEND,
            // TxFlowType.STAKE_STATIC_REWARD,
            // TxFlowType.STAKE_STATIC_DIRECT_REWARD,
            // TxFlowType.STAKE_DYNAMIC_REWARD,
            // TxFlowType.STAKE_DYNAMIC_NODE_REWARD,
            // TxFlowType.STAKE_DYNAMIC_INCUBATION_REWARD,
            // TxFlowType.STAKE_DYNAMIC_NODE_INCUBATION_REWARD,
          ],
          cursor: (pageToUse - 1) * sizeToUse,
          take: sizeToUse,
        }),
      });

      const claimHistoryData = await claimHistoryResponse.json();
      setClaimHistory(claimHistoryData.data);

      const total = claimHistoryData.total || 0;
      setTotalRecords(total);

      const pages = Math.ceil(total / sizeToUse);
      setTotalPages(pages);

      // Fetch earnings history
      const earningsResponse = await fetch("/api/user/earnings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          address: address,
        }),
      });

      const earningsData = (await earningsResponse.json()).data;

      // For now, we're using mock data for the earnings
      // In a real implementation, this would come from the API
      setEarningsData({
        nodeEarningsUsdt: {
          toClaim: earningsData.NODE_REWARD?.[TxFlowStatus.PENDING] || 0,
          claimed: earningsData.NODE_REWARD?.[TxFlowStatus.CONFIRMED] || 0,
          total:
            (earningsData.NODE_REWARD?.[TxFlowStatus.PENDING] || 0) +
            (earningsData.NODE_REWARD?.[TxFlowStatus.CONFIRMED] || 0),
        },
        nodeDiffEarningsUsdt: {
          toClaim: earningsData.NODE_DIFF_REWARD?.[TxFlowStatus.PENDING] || 0,
          claimed: earningsData.NODE_DIFF_REWARD?.[TxFlowStatus.CONFIRMED] || 0,
          total:
            (earningsData.NODE_DIFF_REWARD?.[TxFlowStatus.PENDING] || 0) +
            (earningsData.NODE_DIFF_REWARD?.[TxFlowStatus.CONFIRMED] || 0),
        },
        dividendEarningsUsdt: {
          toClaim: earningsData.FEE_DIVIDEND?.[TxFlowStatus.PENDING] || 0,
          claimed: earningsData.FEE_DIVIDEND?.[TxFlowStatus.CONFIRMED] || 0,
          total:
            (earningsData.FEE_DIVIDEND?.[TxFlowStatus.PENDING] || 0) +
            (earningsData.FEE_DIVIDEND?.[TxFlowStatus.CONFIRMED] || 0),
        },
        dividendEarningsToken: {
          toClaim: earningsData.FEE_DIVIDEND_TOKEN?.[TxFlowStatus.PENDING] || 0,
          claimed: earningsData.FEE_DIVIDEND_TOKEN?.[TxFlowStatus.CONFIRMED] || 0,
          total:
            (earningsData.FEE_DIVIDEND_TOKEN?.[TxFlowStatus.PENDING] || 0) +
            (earningsData.FEE_DIVIDEND_TOKEN?.[TxFlowStatus.CONFIRMED] || 0),
        },
        miningEarnings: {
          toClaim:
            earningsData.STAKE_STATIC_REWARD?.[TxFlowStatus.PENDING] || 0,
          claimed:
            earningsData.STAKE_STATIC_REWARD?.[TxFlowStatus.CONFIRMED] || 0,
          total:
            (earningsData.STAKE_STATIC_REWARD?.[TxFlowStatus.PENDING] || 0) +
            (earningsData.STAKE_STATIC_REWARD?.[TxFlowStatus.CONFIRMED] || 0),
        },
        directMiningEarnings: {
          toClaim:
            earningsData.STAKE_STATIC_DIRECT_REWARD?.[TxFlowStatus.PENDING] ||
            0,
          claimed:
            earningsData.STAKE_STATIC_DIRECT_REWARD?.[TxFlowStatus.CONFIRMED] ||
            0,
          total:
            (earningsData.STAKE_STATIC_DIRECT_REWARD?.[TxFlowStatus.PENDING] ||
              0) +
            (earningsData.STAKE_STATIC_DIRECT_REWARD?.[
              TxFlowStatus.CONFIRMED
            ] || 0),
        },
        airdropEarnings: {
          toClaim: earningsData.AIRDROP?.[TxFlowStatus.PENDING] || 0,
          claimed: earningsData.AIRDROP?.[TxFlowStatus.CONFIRMED] || 0,
          total:
            (earningsData.AIRDROP?.[TxFlowStatus.PENDING] || 0) +
            (earningsData.AIRDROP?.[TxFlowStatus.CONFIRMED] || 0),
        },
        communityEarnings: {
          toClaim:
            earningsData.STAKE_DYNAMIC_REWARD?.[TxFlowStatus.PENDING] || 0,
          claimed:
            earningsData.STAKE_DYNAMIC_REWARD?.[TxFlowStatus.CONFIRMED] || 0,
          total:
            (earningsData.STAKE_DYNAMIC_REWARD?.[TxFlowStatus.PENDING] || 0) +
            (earningsData.STAKE_DYNAMIC_REWARD?.[TxFlowStatus.CONFIRMED] || 0),
        },
        incubationEarnings: {
          toClaim:
            earningsData.STAKE_DYNAMIC_INCUBATION_REWARD?.[
              TxFlowStatus.PENDING
            ] || 0,
          claimed:
            earningsData.STAKE_DYNAMIC_INCUBATION_REWARD?.[
              TxFlowStatus.CONFIRMED
            ] || 0,
          total:
            (earningsData.STAKE_DYNAMIC_INCUBATION_REWARD?.[
              TxFlowStatus.PENDING
            ] || 0) +
            (earningsData.STAKE_DYNAMIC_INCUBATION_REWARD?.[
              TxFlowStatus.CONFIRMED
            ] || 0),
        },
        marketExpenses: {
          toClaim: earningsData.MARKET_EXPENSE?.[TxFlowStatus.PENDING] || 0,
          claimed: earningsData.MARKET_EXPENSE?.[TxFlowStatus.CONFIRMED] || 0,
          total:
            (earningsData.MARKET_EXPENSE?.[TxFlowStatus.PENDING] || 0) +
            (earningsData.MARKET_EXPENSE?.[TxFlowStatus.CONFIRMED] || 0),
        },
        securityFund: {
          toClaim: earningsData.SECURITY_FUND?.[TxFlowStatus.PENDING] || 0,
          claimed: earningsData.SECURITY_FUND?.[TxFlowStatus.CONFIRMED] || 0,
          total:
            (earningsData.SECURITY_FUND?.[TxFlowStatus.PENDING] || 0) +
            (earningsData.SECURITY_FUND?.[TxFlowStatus.CONFIRMED] || 0),
        },
      });
    } catch (error) {
      console.error("Error fetching earnings data:", error);
    } finally {
      setLoading(false);
    }
  };

  // Calculate available amount based on claim type
  const calculateAvailableAmount = (type: TokenType) => {
    if (type === TokenType.USDT) {
      const total = earningsData ? earningsData.nodeEarningsUsdt.toClaim +
      earningsData.nodeDiffEarningsUsdt.toClaim +
      earningsData.dividendEarningsUsdt.toClaim : 0;
      return truncateDecimals(total);
    } else {
      const total = earningsData
        ? earningsData.miningEarnings.toClaim +
          earningsData.directMiningEarnings.toClaim +
          earningsData.dividendEarningsToken.toClaim +
          earningsData.communityEarnings.toClaim +
          earningsData.incubationEarnings.toClaim +
          earningsData.marketExpenses.toClaim +
          earningsData.securityFund.toClaim
        : 0;
      return truncateDecimals(total);
    }
  };

  // Handle claim type change
  const handleClaimTypeChange = (type: TokenType) => {
    setClaimType(type);
    setAvailableAmount(calculateAvailableAmount(type));
    setShowTypeDropdown(false);
  };

  // This function was removed as we're directly calling claimRewards now

  // Claim rewards
  const claimRewards = async () => {
    try {
      if (!address) {
        triggerWalletConnect();
        return;
      }
      setClaimError("");

      if (!address || !signMessageAsync) {
        setClaimError(tError(ErrorCode.MISSING_WALLET_ADDRESS));
        return;
      }

      // Prepare claim info
      const info = {
        operationType: TxFlowType.EQUITY,
        amount: 0, // The backend will determine the actual amount
        walletAddress: address,
        timestamp: Date.now(),
        //tokenType: "all"
          //claimType === TokenType.USDT ? TokenType.USDT : TokenType.TXT,
      };

      // Generate and sign operation hash
      const hash = await generateOperationHash(info);
      const signature = await signMessageAsync({ message: hash });

      // Send claim request
      const response = await fetch("/api/points/claim", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...info,
          signature: signature,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to claim rewards");
      }

      // Refresh the data
      await fetchEarningsData();
      
      return true;
    } catch (err) {
      console.error("Claim rewards failed:", err);
      setClaimError(tError(ErrorCode.OPERATION_FAILED));
      throw err; // Rethrow the error so it can be caught by the caller
    }
  };

  // Fetch data on component mount and when wallet changes
  useEffect(() => {
    fetchEarningsData();
    fetchUserInfo();
  }, [address]);

  if (loading && !earningsData) {
    return <LoadingSpinner />;
  }

  return (
    <div className="flex flex-col h-full">
      {/* Main content area with bottom padding for nav and top padding for header */}
      <div className="flex-1 pb-16 pt-24">
        <div className="p-4 bg-black text-white">
          {/* Earnings Header */}
          <div className="flex items-center mb-4">
            <div className="w-1 h-5 bg-[#3B82F6] mr-2" />
            <h1 className="text-xl font-bold text-white">{t("earnings")}</h1>
          </div>

          {/* Earnings Cards */}
          {earningsData && (
            <>
              <div className=" overflow-hidden mb-2 text-12px">
                {(userType === UserType.COMMUNITY) && (
                  <>
                    <EarningsCard
                      title={tTxType("NODE_REWARD")}
                      amount={truncateDecimals(
                        earningsData.nodeEarningsUsdt.total
                      )}
                      toClaim={truncateDecimals(
                        earningsData.nodeEarningsUsdt.toClaim
                      )}
                      claimed={truncateDecimals(
                        earningsData.nodeEarningsUsdt.claimed
                      )}
                      type={TokenType.USDT}
                    />
                    <EarningsCard
                      title={tTxType("NODE_DIFF_REWARD")}
                      amount={truncateDecimals(
                        earningsData.nodeDiffEarningsUsdt.total
                      )}
                      toClaim={truncateDecimals(
                        earningsData.nodeDiffEarningsUsdt.toClaim
                      )}
                      claimed={truncateDecimals(
                        earningsData.nodeDiffEarningsUsdt.claimed
                      )}
                      type={TokenType.USDT}
                    />
                    <EarningsCard
                      title={tTxType("FEE_DIVIDEND")}
                      amount={truncateDecimals(
                        earningsData.dividendEarningsUsdt.total
                      )}
                      toClaim={truncateDecimals(
                        earningsData.dividendEarningsUsdt.toClaim
                      )}
                      claimed={truncateDecimals(
                        earningsData.dividendEarningsUsdt.claimed
                      )}
                      type={TokenType.USDT}
                    />
                    <EarningsCard
                      title={tTxType("FEE_DIVIDEND_TOKEN")}
                      amount={truncateDecimals(
                        earningsData.dividendEarningsToken.total
                      )}
                      toClaim={truncateDecimals(
                        earningsData.dividendEarningsToken.toClaim
                      )}
                      claimed={truncateDecimals(
                        earningsData.dividendEarningsToken.claimed
                      )}
                      type={TokenType.HAK}
                    />
                  </>
                )}

                <EarningsCard
                  title={tTxType("STAKE_STATIC_REWARD")}
                  amount={truncateDecimals(earningsData.miningEarnings.total)}
                  toClaim={truncateDecimals(
                    earningsData.miningEarnings.toClaim
                  )}
                  claimed={truncateDecimals(
                    earningsData.miningEarnings.claimed
                  )}
                  type={TokenType.HAK}
                />

                <EarningsCard
                  title={tTxType("STAKE_DYNAMIC_REWARD")}
                  amount={truncateDecimals(
                    earningsData.communityEarnings.total
                  )}
                  toClaim={truncateDecimals(
                    earningsData.communityEarnings.toClaim
                  )}
                  claimed={truncateDecimals(
                    earningsData.communityEarnings.claimed
                  )}
                  type={TokenType.HAK}
                />

                <EarningsCard
                  title={tTxType("STAKE_DYNAMIC_INCUBATION_REWARD")}
                  amount={truncateDecimals(
                    earningsData.incubationEarnings.total
                  )}
                  toClaim={truncateDecimals(
                    earningsData.incubationEarnings.toClaim
                  )}
                  claimed={truncateDecimals(
                    earningsData.incubationEarnings.claimed
                  )}
                  type={TokenType.HAK}
                />

                {/* {isSpecial && (
                  <>
                    <EarningsCard
                      title={t("market_expenses")}
                      amount={truncateDecimals(
                        earningsData.marketExpenses.total
                      )}
                      toClaim={truncateDecimals(
                        earningsData.marketExpenses.toClaim
                      )}
                      claimed={truncateDecimals(
                        earningsData.marketExpenses.claimed
                      )}
                      type={TokenType.TXT}
                      isSpecial={true}
                    />

                    <EarningsCard
                      title={t("security_fund")}
                      amount={truncateDecimals(earningsData.securityFund.total)}
                      toClaim={truncateDecimals(
                        earningsData.securityFund.toClaim
                      )}
                      claimed={truncateDecimals(
                        earningsData.securityFund.claimed
                      )}
                      type={TokenType.TXT}
                      isSpecial={true}
                    />
                  </>
                )} */}
              </div>

              {/* Claim Rewards Button */}
              <button
                onClick={async () => {
                  if (!address) {
                    triggerWalletConnect();
                    return;
                  }
                  setClaimError("");
                  
                  try {
                    setLoading(true);
                    setClaimType("USDT");
                    await claimRewards();
                    // Show success feedback
                    setFeedbackMessage("SUCCESS");
                    setFeedbackIsError(false);
                    setShowFeedbackModal(true);
                  } catch (error) {
                    // Show error feedback
                    console.error("Claim error:", error);
                    // Use the same error message that was set in claimRewards
                    setFeedbackMessage(claimError || "Failed to claim rewards. Please try again.");
                    setFeedbackIsError(true);
                    setShowFeedbackModal(true);
                  } finally {
                    setLoading(false);
                  }
                }}
                disabled={loading}
                className="w-full py-4 text-center text-lg text-black font-bold mb-4 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
                style={{
                  WebkitTapHighlightColor: "transparent",
                  background:
                    "linear-gradient(270deg, #2563EB 0%, #60A5FA 100%)",
                }}
              >
                {loading ? (
                  <div className="flex justify-center">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-black"></div>
                  </div>
                ) : (
                  t("claim_rewards")
                )}
              </button>

              {/* Earnings History */}
              <div className="mt-1">
                <div className="flex items-center mb-4">
                  <div className="w-1 h-5 bg-[#3B82F6] mr-2" />
                  <h2 className="text-xl font-bold text-white">
                    {t("history")}
                  </h2>
                </div>

                {/* History Table */}
                <div className="bg-black ">
                  <div className="grid grid-cols-3 text-[#3B82F6] text-sm mb-3">
                    <div>{t("time")}</div>
                    <div className="text-center">{t("type")}</div>
                    <div className="text-right">{t("amount")}</div>
                  </div>

                  {claimHistory.length > 0 ? (
                    claimHistory.map((record, index) => (
                      <div
                        key={index}
                        className="grid grid-cols-3 py-3 border-b border-gray-800 text-white text-sm last:border-b-0"
                      >
                        <div>{formatTime(new Date(record.created_at))}</div>
                        <div className="text-center">
                          {tTxType(record.type)}
                        </div>
                        <div className="text-right">
                          {truncateDecimals(record.amount)} {record.token_type}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center text-gray-400 py-8 text-sm">
                      {t("no_records")}
                    </div>
                  )}
                </div>

                {/* Pagination Controls */}
                {true && (
                  <div className="flex justify-between items-center mt-2 text-[10px]">
                    <div className="flex items-center space-x-1.5">
                      <div className="text-gray-400">
                        {tPage("showing")} {(currentPage - 1) * pageSize + 1}-
                        {Math.min(currentPage * pageSize, totalRecords)}{" "}
                        {tPage("of")} {totalRecords}
                      </div>

                      {/* Page Size Selector */}
                      <div className="flex items-center space-x-1">
                        <span className="text-gray-400">
                          {tPage("rows_per_page")}:
                        </span>
                        <select
                          value={pageSize}
                          onChange={(e) => {
                            const newSize = parseInt(e.target.value);
                            setPageSize(newSize);
                            // Reset to page 1 when changing page size
                            fetchEarningsData(1, newSize);
                          }}
                          className="bg-gray-800 text-white border border-gray-700 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-500 text-[10px]"
                        >
                          <option value="5">5</option>
                          <option value="10">10</option>
                          <option value="20">20</option>
                          <option value="50">50</option>
                        </select>
                      </div>
                    </div>
                    <div className="flex space-x-0.5">
                      <button
                        onClick={() => {
                          if (currentPage > 1) {
                            const newPage = currentPage - 1;
                            fetchEarningsData(newPage);
                          }
                        }}
                        disabled={currentPage === 1}
                        className={`px-1.5 py-0.5 rounded text-[10px] ${
                          currentPage === 1
                            ? "bg-gray-800 text-gray-500 cursor-not-allowed"
                            : "bg-[#34C759] text-white hover:bg-green-700"
                        }`}
                      >
                        {tPage("previous")}
                      </button>
                      <div className="flex items-center space-x-0.5">
                        {Array.from(
                          { length: Math.min(5, totalPages) },
                          (_, i) => {
                            // Show pages around current page
                            let pageToShow;
                            if (totalPages <= 5) {
                              pageToShow = i + 1;
                            } else if (currentPage <= 3) {
                              pageToShow = i + 1;
                            } else if (currentPage >= totalPages - 2) {
                              pageToShow = totalPages - 4 + i;
                            } else {
                              pageToShow = currentPage - 2 + i;
                            }

                            return (
                              <button
                                key={i}
                                onClick={() => {
                                  fetchEarningsData(pageToShow);
                                }}
                                className={`w-5 h-5 flex items-center justify-center rounded text-[10px] ${
                                  currentPage === pageToShow
                                    ? "bg-[#0066CC] text-white"
                                    : "bg-gray-800 text-white hover:bg-gray-700"
                                }`}
                              >
                                {pageToShow}
                              </button>
                            );
                          }
                        )}
                      </div>
                      <button
                        onClick={() => {
                          if (currentPage < totalPages) {
                            const newPage = currentPage + 1;
                            fetchEarningsData(newPage);
                          }
                        }}
                        disabled={currentPage === totalPages}
                        className={`px-1.5 py-0.5 rounded text-[10px] ${
                          currentPage === totalPages
                            ? "bg-gray-800 text-gray-500 cursor-not-allowed"
                            : "bg-[#0066CC] text-white hover:bg-blue-700"
                        }`}
                      >
                        {tPage("next")}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Feedback Modal */}
      {showFeedbackModal && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50"
          onClick={(e) => {
            // Close if clicking outside the modal content
            if (e.target === e.currentTarget) {
              setShowFeedbackModal(false);
            }
          }}
        >
          <div
            className={`bg-black p-6 rounded-xl w-[90%] max-w-md relative border-2 ${feedbackIsError ? 'border-red-500' : 'border-blue-500'}`}
            style={{
              boxShadow: `0 0 30px ${feedbackIsError ? 'rgba(239, 68, 68, 0.6)' : 'rgba(59, 130, 246, 0.6)'}`,
            }}
          >
            <div className="flex justify-center items-center mb-6">
              {feedbackIsError ? (
                <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center mb-4">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
              ) : (
                <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center mb-4">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              )}
            </div>
            
            {/* <h2 className={`text-lg font-bold ${feedbackIsError ? 'text-red-500' : 'text-blue-500'} text-center mb-4`}>
              {feedbackIsError ? t("claim_error_title") || "Error" : t("claim_success_title") || "Success"}
            </h2> */}
            
            <p className="text-white text-center mb-6">
              {feedbackMessage}
            </p>

            <div className="flex justify-center">
              <button
                onClick={() => setShowFeedbackModal(false)}
                className={`px-6 py-2 rounded-lg ${feedbackIsError ? 'bg-red-500' : 'bg-blue-500'} text-white font-medium`}
              >
                {"OK"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function EarningsPage() {
  return (
    <div className="min-h-screen bg-black text-white">
      <EarningsContent />
    </div>
  );
}
