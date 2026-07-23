"use client";

import React from "react";
import { useReadContract } from "wagmi";
import { useTranslations } from "next-intl";

const PAIR_ABI = [
  {
    type: "function",
    name: "getReserves",
    inputs: [],
    outputs: [
      { type: "uint112", name: "reserve0" },
      { type: "uint112", name: "reserve1" },
      { type: "uint32", name: "blockTimestampLast" },
    ],
    stateMutability: "view",
  },
] as const;

function formatReserve(value: bigint, decimals = 18): string {
  const divisor = BigInt(10) ** BigInt(decimals);
  const whole = value / divisor;
  const fraction = value % divisor;
  const fractionStr = fraction.toString().padStart(decimals, "0").slice(0, 2);
  return `${whole.toString()}.${fractionStr}`;
}

export const PoolInfo: React.FC = () => {
  const t = useTranslations("node");

  const pairAddress = process.env.NEXT_PUBLIC_PAIR_ADDRESS as `0x${string}` | undefined;

  const { data: reservesData, isLoading } = useReadContract({
    address: pairAddress,
    abi: PAIR_ABI,
    functionName: "getReserves",
  });

  if (!pairAddress) return null;

  if (isLoading || !reservesData) {
    return (
      <div className="mb-5 rounded-[10px] border border-purple-500/20 bg-black/40 p-4">
        <div className="mb-2 text-sm font-bold text-white">
          {t("pool_title")}
        </div>
        <div className="text-xs text-white/50">{t("pool_loading")}</div>
      </div>
    );
  }

  const reserve0 = (reservesData as readonly bigint[])[0];
  const reserve1 = (reservesData as readonly bigint[])[1];

  const r0Float = Number(reserve0) / Math.pow(10, 18);
  const r1Float = Number(reserve1) / Math.pow(10, 18);

  // 价格低的是 HAK，高的是 USDT
  const isHakToken0 = r0Float <= r1Float;
  const hakReserve = isHakToken0 ? reserve0 : reserve1;
  const usdtReserve = isHakToken0 ? reserve1 : reserve0;

  const hakFloat = isHakToken0 ? r0Float : r1Float;
  const usdtFloat = isHakToken0 ? r1Float : r0Float;
  const price = hakFloat > 0 ? usdtFloat / hakFloat : 0;
  const priceStr = price >= 0.01 ? price.toFixed(4) : price.toExponential(2);

  return (
    <div className="mb-5 rounded-[10px] border border-purple-500/20 bg-black/40 p-4">
      <div className="mb-3 flex items-center justify-between text-sm font-bold text-white">
        <span>{t("pool_title")}</span>
        <span className="text-purple-400">1 HAK ≈ {priceStr} USDT</span>
      </div>
      <div className="flex justify-between text-xs">
        <div>
          <div className="text-white/50 mb-1">HAK</div>
          <div className="font-bold text-white">{formatReserve(hakReserve)}</div>
        </div>
        <div className="text-right">
          <div className="text-white/50 mb-1">USDT</div>
          <div className="font-bold text-white">{formatReserve(usdtReserve)}</div>
        </div>
      </div>
    </div>
  );
};
