"use client";

import React, { useState, useCallback } from "react";
import { useReadContract, useWriteContract } from "wagmi";
import { useAppKitAccount } from "@reown/appkit/react";
import { useTranslations } from "next-intl";
import { TransactionModal } from "./TransactionModal";
import { triggerWalletConnect } from "./ui/wallet-ref";

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

const ERC20_ABI = [
  {
    type: "function",
    name: "balanceOf",
    inputs: [{ type: "address" }],
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "allowance",
    inputs: [
      { type: "address", name: "owner" },
      { type: "address", name: "spender" },
    ],
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "approve",
    inputs: [
      { type: "address", name: "spender" },
      { type: "uint256", name: "amount" },
    ],
    outputs: [{ type: "bool" }],
    stateMutability: "nonpayable",
  },
] as const;

const ROUTER_ABI = [
  {
    type: "function",
    name: "swapExactTokensForTokensSupportingFeeOnTransferTokens",
    inputs: [
      { type: "uint256", name: "amountIn" },
      { type: "uint256", name: "amountOutMin" },
      { type: "address[]", name: "path" },
      { type: "address", name: "to" },
      { type: "uint256", name: "deadline" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "getAmountsOut",
    inputs: [
      { type: "uint256", name: "amountIn" },
      { type: "address[]", name: "path" },
    ],
    outputs: [{ type: "uint256[]", name: "amounts" }],
    stateMutability: "view",
  },
] as const;

const DECIMALS = 18;

function formatReserve(value: bigint, decimals = 18): string {
  const divisor = BigInt(10) ** BigInt(decimals);
  const whole = value / divisor;
  const fraction = value % divisor;
  const fractionStr = fraction.toString().padStart(decimals, "0").slice(0, 2);
  return `${whole.toString()}.${fractionStr}`;
}

export const SwapPanel: React.FC = () => {
  const t = useTranslations("swap");
  const { address } = useAppKitAccount();
  const { writeContractAsync } = useWriteContract();

  const pairAddress = process.env.NEXT_PUBLIC_PAIR_ADDRESS as `0x${string}` | undefined;
  const hakAddress = process.env.NEXT_PUBLIC_TOKEN_ADDRESS as `0x${string}` | undefined;
  const usdtAddress = process.env.NEXT_PUBLIC_USDT_ADDRESS as `0x${string}` | undefined;
  const routerAddress = process.env.NEXT_PUBLIC_ROUTER_ADDRESS as `0x${string}` | undefined;

  const [sellAmount, setSellAmount] = useState("");
  const [sellStatus, setSellStatus] = useState<"idle" | "approving" | "swapping">("idle");
  const [showTxModal, setShowTxModal] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [txError, setTxError] = useState<string | null>(null);

  const { data: reservesData, isLoading: reservesLoading } = useReadContract({
    address: pairAddress,
    abi: PAIR_ABI,
    functionName: "getReserves",
  });

  const { data: hakBalanceData } = useReadContract({
    address: hakAddress,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: address ? [address as `0x${string}`] : undefined,
  });

  const { data: allowanceData } = useReadContract({
    address: hakAddress,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: address && routerAddress
      ? [address as `0x${string}`, routerAddress as `0x${string}`]
      : undefined,
  });

  const sellAmountWei = sellAmount
    ? BigInt(Math.floor(Number(sellAmount) * Math.pow(10, DECIMALS)))
    : BigInt(0);

  const { data: amountsOutData } = useReadContract({
    address: routerAddress,
    abi: ROUTER_ABI,
    functionName: "getAmountsOut",
    args: sellAmountWei > 0 && hakAddress && usdtAddress
      ? [sellAmountWei, [hakAddress as `0x${string}`, usdtAddress as `0x${string}`]]
      : undefined,
  });

  const reserve0 = reservesData ? (reservesData as readonly bigint[])[0] : BigInt(0);
  const reserve1 = reservesData ? (reservesData as readonly bigint[])[1] : BigInt(0);
  const r0Float = Number(reserve0) / Math.pow(10, 18);
  const r1Float = Number(reserve1) / Math.pow(10, 18);
  const isHakToken0 = r0Float <= r1Float;
  const hakReserve = isHakToken0 ? reserve0 : reserve1;
  const usdtReserve = isHakToken0 ? reserve1 : reserve0;
  const hakFloat = isHakToken0 ? r0Float : r1Float;
  const usdtFloat = isHakToken0 ? r1Float : r0Float;
  const price = hakFloat > 0 ? usdtFloat / hakFloat : 0;
  const priceStr = price >= 0.01 ? price.toFixed(4) : price.toExponential(2);

  const hakBalance = hakBalanceData
    ? Number(hakBalanceData as bigint) / Math.pow(10, DECIMALS)
    : 0;

  const currentAllowance = allowanceData ? (allowanceData as bigint) : BigInt(0);

  const expectedUsdt = amountsOutData
    ? Number((amountsOutData as readonly bigint[])[1]) / Math.pow(10, DECIMALS)
    : 0;

  const handleSell = useCallback(async () => {
    if (!address) {
      triggerWalletConnect();
      return;
    }
    if (!hakAddress || !usdtAddress || !routerAddress) return;
    if (sellAmountWei <= 0) return;

    setTxError(null);
    try {
      if (currentAllowance < sellAmountWei) {
        setSellStatus("approving");
        const approveHash = await writeContractAsync({
          address: hakAddress as `0x${string}`,
          abi: ERC20_ABI,
          functionName: "approve",
          args: [routerAddress as `0x${string}`, sellAmountWei],
        });
        if (!approveHash) throw new Error("Approve failed");
      }

      setSellStatus("swapping");
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 1200);
      const amountOutMin = BigInt(0);
      const hash = await writeContractAsync({
        address: routerAddress as `0x${string}`,
        abi: ROUTER_ABI,
        functionName: "swapExactTokensForTokensSupportingFeeOnTransferTokens",
        args: [
          sellAmountWei,
          amountOutMin,
          [hakAddress as `0x${string}`, usdtAddress as `0x${string}`],
          address as `0x${string}`,
          deadline,
        ],
      });
      if (!hash) throw new Error("Swap failed");

      setTxHash(hash);
      setShowTxModal(true);
      setSellAmount("");
    } catch (err) {
      setTxError(err instanceof Error ? err.message : "Swap failed");
      setShowTxModal(true);
    } finally {
      setSellStatus("idle");
    }
  }, [address, hakAddress, usdtAddress, routerAddress, sellAmountWei, currentAllowance, writeContractAsync]);

  const sellDisabled = !address || sellAmountWei <= 0 || sellStatus !== "idle";

  return (
    <div className="mx-auto w-full max-w-md">
      {/* Pool Info Card */}
      <div className="mb-4 rounded-[10px] border border-purple-500/20 bg-black/40 p-4">
        <div className="mb-3 flex items-center justify-between text-sm font-bold text-white">
          <span>{t("pool_title")}</span>
          <span className="text-purple-400">1 HAK ≈ {priceStr} USDT</span>
        </div>
        {reservesLoading ? (
          <div className="text-xs text-white/50">{t("pool_loading")}</div>
        ) : (
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
        )}
      </div>

      {/* Sell HAK Card */}
      <div className="rounded-[10px] border border-purple-500/20 bg-black/40 p-5">
        <h1 className="mb-5 text-center text-lg font-bold text-white">
          {t("title")}
        </h1>

        {address ? (
          <>
            {/* Balance display */}
            <div className="mb-3 flex items-center justify-between text-xs">
              <span className="text-white/50">{t("balance")}</span>
              <span className="font-bold text-white">{hakBalance.toFixed(4)} HAK</span>
            </div>

            {/* Sell input */}
            <div className="mb-2 text-xs text-white/50">{t("sell_amount")}</div>
            <div className="relative mb-3">
              <input
                type="number"
                value={sellAmount}
                onChange={(e) => setSellAmount(e.target.value)}
                placeholder={t("sell_placeholder")}
                step="any"
                min="0"
                className="w-full rounded-lg border border-purple-500/20 bg-black/60 px-3 py-3 pr-20 text-base text-white outline-none focus:border-purple-500/40"
              />
              <div className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSellAmount(hakBalance.toString())}
                  className="rounded bg-purple-500/20 px-2 py-1 text-xs text-purple-300 hover:bg-purple-500/30"
                >
                  {t("max")}
                </button>
                <span className="text-sm font-bold text-purple-300">HAK</span>
              </div>
            </div>

            {/* Arrow down */}
            <div className="mb-3 flex justify-center">
              <div className="flex h-8 w-8 items-center justify-center rounded-full border border-purple-500/20 bg-black/60">
                <svg className="h-4 w-4 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                </svg>
              </div>
            </div>

            {/* Receive display */}
            <div className="mb-2 text-xs text-white/50">{t("receive_amount")}</div>
            <div className="relative mb-4">
              <div className="w-full rounded-lg border border-purple-500/20 bg-black/60 px-3 py-3 pr-20 text-base text-white">
                {expectedUsdt > 0 ? expectedUsdt.toFixed(4) : "0.0000"}
              </div>
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-bold text-purple-300">USDT</span>
            </div>

            {/* Sell button */}
            <button
              type="button"
              onClick={handleSell}
              disabled={sellDisabled}
              className="w-full rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 py-3 text-base font-bold text-white transition-opacity disabled:opacity-40"
            >
              {sellStatus === "approving"
                ? t("approving")
                : sellStatus === "swapping"
                  ? t("swapping")
                  : t("sell_btn")}
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={triggerWalletConnect}
            className="w-full rounded-lg border border-purple-500/20 bg-purple-500/10 py-3 text-base font-bold text-purple-300"
          >
            {t("connect_wallet")}
          </button>
        )}
      </div>

      <TransactionModal
        isOpen={showTxModal}
        onClose={() => {
          setShowTxModal(false);
          setTxError(null);
        }}
        type={txError ? "error" : "success"}
        message={txError ?? undefined}
        txSignature={txHash}
      />
    </div>
  );
};
