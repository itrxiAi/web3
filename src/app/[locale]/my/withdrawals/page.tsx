"use client";

import { useTranslations } from "next-intl";
import Image from "next/image";
import { useRouter } from "next/navigation";
import React, { useState, useEffect } from "react";
import { TokenType, TxFlowStatus, TxFlowType } from "@prisma/client";
import { formatDate, formatTime } from "@/utils/dateUtils";
import Link from "next/link";
import { useAppKitAccount } from "@reown/appkit/react";
import { truncateDecimals } from "@/utils/common";

// /api/user/history
interface EarningRecord {
  created_at: string;
  token_type: TokenType;
  amount: string;
  id?: number;
  tx_hash?: string;
  to_address?: string;
  amount_fee?: string;
  tx_fee?: string;
  description?: string;
  status?: TxFlowStatus;
  from_address?: string;
  type?: TxFlowType;
}

export default function MyEarningsPage() {
  const t = useTranslations("my");
  const tStatus = useTranslations("tx_status");

  const tPage = useTranslations("page");
  const router = useRouter();
  const { address } = useAppKitAccount();
  const [earningHistory, setEarningHistory] = useState<EarningRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalRecords, setTotalRecords] = useState(0);
  const [selectedTransaction, setSelectedTransaction] =
    useState<EarningRecord | null>(null);
  const [showModal, setShowModal] = useState(false);

  // Fetch earnings data
  const fetchEarningsData = async () => {
    try {
      setLoading(true);
      if (!address) {
        // Set default empty data when wallet is not connected
        return;
      }

      // Fetch claim history
      const claimHistoryResponse = await fetch("/api/user/transactions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          address: address,
          flowTypeArr: [TxFlowType.WITHDRAW],
          cursor: (currentPage - 1) * pageSize,
          take: pageSize,
        }),
      });

      const claimHistoryData = await claimHistoryResponse.json();

      // Reset to page 1 if we're on the last page and there's no more data
      if (claimHistoryData.data.length === 0 && currentPage > 1) {
        setCurrentPage(1);
        return;
      }

      setEarningHistory(claimHistoryData.data);
      setTotalRecords(claimHistoryData.total || 0);
      const pages = Math.ceil((claimHistoryData.total || 0) / pageSize);
      setTotalPages(pages);
    } catch (error) {
      console.error("Error fetching earnings data:", error);
      setError("Failed to fetch earnings data");
    } finally {
      setLoading(false);
    }
  };

  // Fetch data when page changes
  useEffect(() => {
    if (address) {
      fetchEarningsData();
    }
  }, [address, currentPage]);

  // Handle transaction click to show details
  const handleTransactionClick = (transaction: EarningRecord) => {
    setSelectedTransaction(transaction);
    setShowModal(true);
  };

  // Close the modal
  const closeModal = () => {
    setShowModal(false);
    setSelectedTransaction(null);
  };

  return (
    <div className="flex flex-col min-h-screen h-full bg-black text-white">
      {/* Main content area with bottom padding for nav and top padding for header */}
      <div className="flex-1 pb-16 pt-20 bg-black">
        <div className="p-4">
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
              <span className="text-white">{t("my_withdrawals")}</span>
            </h1>
          </div>

          {/* Table header */}
          <div className="grid grid-cols-4 gap-4 text-[#3B82F6] mb-4 text-xs px-2">
            <div className="text-left">{t("withdrawals_page.time")}</div>
            <div className="text-center">{t("withdrawals_page.type")}</div>
            <div className="text-center">
              {t("withdrawals_page.earning_details.status")}
            </div>
            <div className="text-right">{t("amount")}</div>
          </div>

          {/* Table content */}
          <div className="space-y-1">
            {earningHistory.map((record, index) => (
              <div
                key={index}
                className="grid grid-cols-4 gap-4 py-2 px-2 text-xs text-white bg-transparent mb-1 cursor-pointer hover:bg-gray-800/20 transition-colors"
                onClick={() => handleTransactionClick(record)}
              >
                <div className="text-left">
                  {formatDate(new Date(record.created_at))}
                </div>
                <div className="text-center">{record.token_type}</div>
                <div
                  className={`text-center ${
                    record.status
                      ? record.status === TxFlowStatus.CONFIRMED
                        ? "text-[#FFC355]"
                        : record.status === TxFlowStatus.FAILED ||
                          record.status === TxFlowStatus.REFUSED
                        ? "text-red-500"
                        : record.status === TxFlowStatus.PENDING ||
                          record.status === TxFlowStatus.AUDITING
                        ? "text-yellow-500"
                        : "text-white"
                      : "text-white"
                  }`}
                >
                  {record.status ? tStatus(record.status) : "-"}
                </div>
                <div className="text-right">
                  {truncateDecimals(Number(record.amount))}
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-between items-center mt-2 text-[10px]">
              <div className="flex items-center space-x-1.5">
                <div className="text-gray-400">
                  {tPage("showing")} {(currentPage - 1) * pageSize + 1}-
                  {Math.min(currentPage * pageSize, totalRecords)} {tPage("of")}{" "}
                  {totalRecords}
                </div>
              </div>
              <div className="flex items-center space-x-1">
                <button
                  onClick={() =>
                    setCurrentPage((prev) => Math.max(1, prev - 1))
                  }
                  disabled={currentPage === 1}
                  className="px-2 py-0.5 text-white text-[10px] disabled:opacity-50 hover:bg-white/10"
                >
                  {tPage("previous")}
                </button>
                <button
                  onClick={() =>
                    setCurrentPage((prev) => Math.min(totalPages, prev + 1))
                  }
                  disabled={currentPage === totalPages}
                  className="px-2 py-0.5 text-white text-[10px] disabled:opacity-50 hover:bg-white/10"
                >
                  {tPage("next")}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Transaction Details Modal */}
      {showModal && selectedTransaction && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div
            className="bg-black rounded-xl max-w-md overflow-hidden border-2 border-blue-500"
            style={{ boxShadow: "0 0 30px rgba(255, 127, 0, 0.6)" }}
          >
            {/* Modal Header */}
            <div className="flex justify-between items-center p-4 border-b border-blue-500/30">
              <h3 className="text-lg font-medium text-white">
                {t("withdrawals_page.earning_details.transaction_details")}
              </h3>
              <button
                onClick={closeModal}
                className="text-gray-400 hover:text-blue-400 transition-colors"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            </div>

            {/* Modal Body */}
            <div className="h-[calc(100vh-120px)] overflow-y-auto p-4 space-y-3">
              {/* Time */}
              <div className="flex flex-col">
                <span className="text-sm text-gray-400">
                  {t("time")}
                </span>
                <span className="text-sm text-white">
                  {formatTime(new Date(selectedTransaction.created_at))}
                </span>
              </div>

              {/* Token Type */}
              <div className="flex flex-col">
                <span className="text-sm text-gray-400">
                  {t("type")}
                </span>
                <span className="text-sm text-white">
                  {selectedTransaction.token_type}
                </span>
              </div>

              {/* Amount */}
              <div className="flex flex-col">
                <span className="text-sm text-gray-400">
                  {t("amount")}
                </span>
                <span className="text-sm text-white">
                  {truncateDecimals(Number(selectedTransaction.amount))}
                </span>
              </div>

              {/* Fee */}
              {selectedTransaction.amount_fee && (
                <div className="flex flex-col">
                  <span className="text-sm text-gray-400">
                    {t("withdrawals_page.earning_details.fee")}
                  </span>
                  <span className="text-sm text-white">
                    {truncateDecimals(Number(selectedTransaction.amount_fee))}
                  </span>
                </div>
              )}

              {/* From Address */}
              {selectedTransaction.from_address && (
                <div className="flex flex-col">
                  <span className="text-sm text-gray-400">
                    {t("withdrawals_page.earning_details.from_address")}
                  </span>
                  <span className="text-sm text-white break-all">
                    {selectedTransaction.from_address}
                  </span>
                </div>
              )}

              {/* To Address */}
              {selectedTransaction.to_address && (
                <div className="flex flex-col">
                  <span className="text-sm text-gray-400">
                    {t("withdrawals_page.earning_details.to_address")}
                  </span>
                  <span className="text-sm text-white break-all">
                    {selectedTransaction.to_address}
                  </span>
                </div>
              )}

              {/* Transaction Hash */}
              {selectedTransaction.tx_hash && (
                <div className="flex flex-col">
                  <span className="text-sm text-gray-400">
                    {t("withdrawals_page.earning_details.tx_hash")}
                  </span>
                  <Link
                    href={`https://bscscan.com/tx/${selectedTransaction.tx_hash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-[#3B82F6] hover:text-[#60A5FA] break-all transition-colors underline"
                  >
                    {selectedTransaction.tx_hash}
                  </Link>
                </div>
              )}

              {/* Status */}
              {selectedTransaction.status && (
                <div className="flex flex-col">
                  <span className="text-sm text-gray-400">
                    {t("withdrawals_page.earning_details.status")}
                  </span>
                  <span
                    className={`text-sm ${
                      selectedTransaction.status === TxFlowStatus.CONFIRMED
                        ? "text-[#FFC355]"
                        : selectedTransaction.status === TxFlowStatus.FAILED ||
                          selectedTransaction.status === TxFlowStatus.REFUSED
                        ? "text-red-500"
                        : selectedTransaction.status === TxFlowStatus.PENDING ||
                          selectedTransaction.status === TxFlowStatus.AUDITING
                        ? "text-yellow-500"
                        : "text-white"
                    }`}
                  >
                    {tStatus(selectedTransaction.status)}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
