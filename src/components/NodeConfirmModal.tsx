"use client";

import React, { useState } from "react";
import { useAppKitAccount } from "@reown/appkit/react";
import { useReadContract } from "wagmi";
import { useTranslations } from "next-intl";

export type PaymentToken = "USDT" | "HAKP";

interface NodeConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (token: PaymentToken) => void;
  isBigNode: boolean;
  price: string;
}

const erc20Abi = [
  {
    type: "function",
    name: "balanceOf",
    inputs: [{ type: "address" }],
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "decimals",
    inputs: [],
    outputs: [{ type: "uint8" }],
    stateMutability: "view",
  },
] as const;

export const NodeConfirmModal: React.FC<NodeConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  isBigNode,
  price,
}) => {
  const t = useTranslations("node");
  const { address } = useAppKitAccount();
  const [selectedToken, setSelectedToken] = useState<PaymentToken>("USDT");

  // Token addresses on BSC
  const usdtAddress = "0x55d398326f99059fF775485246999027B3197955" as `0x${string}`;
  const hakpAddress = (process.env.NEXT_PUBLIC_HAKP_ADDRESS || "") as `0x${string}`;

  const currentTokenAddress = selectedToken === "HAKP" ? hakpAddress : usdtAddress;

  // Get selected token balance
  const { data: balanceData, isLoading } = useReadContract({
    address: currentTokenAddress,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address as `0x${string}`] : undefined,
  });

  // Get decimals
  const { data: decimalsData } = useReadContract({
    address: currentTokenAddress,
    abi: erc20Abi,
    functionName: "decimals",
  });

  // Format balance
  const decimals = decimalsData ? Number(decimalsData) : 18;
  const balance = balanceData ? Number(balanceData) / Math.pow(10, decimals) : 0;
  const formattedBalance = balance.toFixed(2);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 backdrop-blur-[2px]">
      {/* Click-outside overlay */}
      <button
        type="button"
        className="absolute inset-0"
        onClick={onClose}
        aria-label={t("modal_close")}
      />

      {/* Modal Card — slides up from bottom */}
      <div
        className="relative w-full rounded-t-2xl px-6 pb-10 pt-6"
        style={{
          background:
            "linear-gradient(180deg, rgba(30,8,40,0.98) 0%, rgba(15,4,22,1) 100%)",
          border: "1px solid rgba(180,30,80,0.25)",
          boxShadow: "0 -8px 40px rgba(180,20,80,0.25)",
          maxWidth: 480,
        }}
      >
        {/* Title */}
        <h2 className="mb-5 text-center text-lg font-bold text-white">
          {t("confirm_purchase_title")}
        </h2>

        {/* Description */}
        <p
          className="mb-4 text-sm leading-relaxed"
          style={{ color: "rgba(255,255,255,0.88)" }}
        >
          {t("confirm_purchase_spend_prefix")}
          <span className="font-bold text-white"> {price} {selectedToken} </span>
          {t("confirm_purchase_spend_suffix")}
        </p>

        {/* Token Selector */}
        <div className="mb-4 flex gap-2">
          {(["USDT", "HAKP"] as PaymentToken[]).map((token) => (
            <button
              key={token}
              type="button"
              onClick={() => setSelectedToken(token)}
              className="flex-1 py-2 text-center text-sm font-bold rounded-lg transition-all"
              style={
                selectedToken === token
                  ? {
                      background: "linear-gradient(0deg, #e50e0f 0%, #680a71 100%)",
                      color: "#fff",
                      border: "1px solid rgba(255,255,255,0.3)",
                    }
                  : {
                      background: "rgba(255,255,255,0.05)",
                      color: "rgba(255,255,255,0.5)",
                      border: "1px solid rgba(255,255,255,0.1)",
                    }
              }
            >
              {token}
            </button>
          ))}
        </div>

        {/* Balance */}
        <p className="mb-6 text-xs" style={{ color: "rgba(255,255,255,0.45)" }}>
          {t("confirm_purchase_balance", { balance: isLoading ? "…" : formattedBalance })} {selectedToken}
        </p>

        {/* Confirm Button */}
        <button
          type="button"
          onClick={() => onConfirm(selectedToken)}
          className="mb-4 w-full py-4 text-center text-lg font-bold text-white"
          style={{
            borderRadius: "10px",
            backgroundImage: "linear-gradient(0deg, #e50e0f 0%, #680a71 100%)",
            boxShadow: "0 4px 24px rgba(229, 14, 15, 0.35)",
          }}
        >
          {t("confirm_purchase_pay_now")}
        </button>

        {/* Cancel */}
        <button
          type="button"
          onClick={onClose}
          className="w-full py-2 text-center text-sm"
          style={{ color: "rgba(255,255,255,0.45)" }}
        >
          {t("confirm_purchase_cancel")}
        </button>
      </div>
    </div>
  );
};
