"use client";

import React, { useState, useEffect } from "react";
import { useAppKitAccount } from "@reown/appkit/react";

interface NodeConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isBigNode: boolean;
  price: string;
}

export const NodeConfirmModal: React.FC<NodeConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  isBigNode,
  price,
}) => {
  const { address } = useAppKitAccount();
  const [usdtBalance, setUsdtBalance] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !address) return;
    fetch(`/api/user/info?address=${address}`)
      .then((r) => r.json())
      .then((data) => {
        const raw = Number(data?.usdt_points ?? 0);
        setUsdtBalance(isNaN(raw) ? "0.00" : raw.toFixed(2));
      })
      .catch(() => setUsdtBalance("0.00"));
  }, [isOpen, address]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 backdrop-blur-[2px]">
      {/* Click-outside overlay */}
      <button
        type="button"
        className="absolute inset-0"
        onClick={onClose}
        aria-label="关闭"
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
          确认认购
        </h2>

        {/* Description */}
        <p
          className="mb-4 text-sm leading-relaxed"
          style={{ color: "rgba(255,255,255,0.88)" }}
        >
          您将消耗
          <span className="font-bold text-white"> {price} USDT </span>
          购买HarmonyLink早期共识者权益包，购买后将无法退回，若想继续购买请点击立即支付完成购买！
        </p>

        {/* Balance */}
        <p className="mb-6 text-xs" style={{ color: "rgba(255,255,255,0.45)" }}>
          *您的钱包可用余额为：{usdtBalance ?? "…"} USDT
        </p>

        {/* Confirm Button */}
        <button
          type="button"
          onClick={onConfirm}
          className="mb-4 w-full py-4 text-center text-lg font-bold text-white"
          style={{
            borderRadius: "10px",
            backgroundImage: "linear-gradient(0deg, #e50e0f 0%, #680a71 100%)",
            boxShadow: "0 4px 24px rgba(229, 14, 15, 0.35)",
          }}
        >
          立即支付
        </button>

        {/* Cancel */}
        <button
          type="button"
          onClick={onClose}
          className="w-full py-2 text-center text-sm"
          style={{ color: "rgba(255,255,255,0.45)" }}
        >
          取消认购
        </button>
      </div>
    </div>
  );
};
