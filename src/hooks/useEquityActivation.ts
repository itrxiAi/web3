"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAppKitAccount } from "@reown/appkit/react";
import { useWriteContract } from "wagmi";
import bs58 from "bs58";
import {
  DEV_ENV,
  EQUITY_BASE_TYPE,
  EQUITY_PLUS_TYPE,
  EQUITY_PREMIUM_TYPE,
  type MembershipType,
} from "@/constants";
import { triggerWalletConnect } from "@/components/ui/wallet-ref";

export type EquityTierInfo = {
  dev_type: MembershipType;
  price_display: string;
  price_transfer: string;
};

const usdtAbi = [
  {
    name: "transfer",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "value", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

export type EquityActivationOptions = {
  onAfterActivation?: () => void | Promise<void>;
  /** 推荐码：URL ?ref= 或用户填写 */
  referralCode?: string;
};

export function useEquityActivation(options?: EquityActivationOptions) {
  const { address } = useAppKitAccount();
  const { writeContractAsync } = useWriteContract();
  const onAfterRef = useRef(options?.onAfterActivation);
  onAfterRef.current = options?.onAfterActivation;
  const referralRef = useRef(options?.referralCode ?? "");
  referralRef.current = options?.referralCode ?? "";

  const [tiers, setTiers] = useState<EquityTierInfo[] | null>(null);
  const [env, setEnv] = useState<{ environment: string; hotWalletAddress: string } | null>(null);
  const [isPaying, setIsPaying] = useState(false);
  const [txSignature, setTxSignature] = useState<string | null>(null);
  const [showTxModal, setShowTxModal] = useState(false);
  const [showTxErrorModal, setShowTxErrorModal] = useState(false);
  const [txErrorMessage, setTxErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const [envRes, eqRes] = await Promise.all([
          fetch("/api/info/env", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
          }),
          fetch("/api/info/equity", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
          }),
        ]);
        const envData = await envRes.json();
        const eqData = await eqRes.json();
        if (cancelled) return;
        if (envRes.ok && envData) {
          setEnv({
            environment: envData.environment,
            hotWalletAddress: envData.hotWalletAddress,
          });
        }
        if (eqRes.ok && Array.isArray(eqData.tiers)) {
          setTiers(eqData.tiers as EquityTierInfo[]);
        }
      } catch (e) {
        console.error("useEquityActivation fetch:", e);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const transferTokens = useCallback(
    async (amountWei: string): Promise<string> => {
      if (!address) {
        throw new Error("Wallet not connected");
      }
      if (!env?.hotWalletAddress) {
        throw new Error("Hot wallet address environment variable is not set");
      }
      const tokenAddress = process.env.NEXT_PUBLIC_USDT_ADDRESS;
      if (!tokenAddress) {
        throw new Error("USDT contract address not found in environment variables");
      }

      const hash = await writeContractAsync({
        address: tokenAddress as `0x${string}`,
        abi: usdtAbi,
        functionName: "transfer",
        args: [env.hotWalletAddress as `0x${string}`, BigInt(amountWei)],
      });
      if (!hash) {
        throw new Error("Transaction failed to return a hash");
      }
      setTxSignature(hash);
      setShowTxModal(true);
      return hash;
    },
    [address, env, writeContractAsync]
  );

  const payEquity = useCallback(
    async (dev_type: MembershipType) => {
      if (!address) {
        triggerWalletConnect();
        return;
      }
      if (isPaying) return;
      const tier = tiers?.find((t) => t.dev_type === dev_type);
      if (!tier?.price_transfer) {
        throw new Error("Equity tier not loaded");
      }

      setIsPaying(true);
      try {
        setTxErrorMessage(null);

        let txSig: string;
        if (env?.environment === DEV_ENV) {
          const randomBytes = new Uint8Array(32);
          crypto.getRandomValues(randomBytes);
          txSig = bs58.encode(randomBytes);
        } else {
          txSig = await transferTokens(tier.price_transfer);
        }

        setTxSignature(txSig);
        setShowTxModal(true);

        const response = await fetch("/api/points/equity", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            txHash: txSig,
            dev_address: address.toString(),
            dev_referralCode: referralRef.current ?? "",
            dev_type,
          }),
        });

        if (!response.ok) {
          const errBody = await response.json().catch(() => ({}));
          throw new Error(errBody.error || "Failed to verify transaction");
        }
      } catch (err) {
        setTxErrorMessage(err instanceof Error ? err.message : "Failed to verify transaction");
        setShowTxErrorModal(true);
      } finally {
        try {
          await onAfterRef.current?.();
        } catch (e) {
          console.error("onAfterActivation:", e);
        }
        setIsPaying(false);
      }
    },
    [address, tiers, env, isPaying, transferTokens]
  );

  return {
    tiers,
    env,
    ready: Boolean(tiers?.length && env),
    isPaying,
    payEquity,
    txSignature,
    showTxModal,
    setShowTxModal,
    showTxErrorModal,
    setShowTxErrorModal,
    txErrorMessage,
  };
}

export function isEquityDevType(s: string): s is MembershipType {
  return s === EQUITY_BASE_TYPE || s === EQUITY_PLUS_TYPE || s === EQUITY_PREMIUM_TYPE;
}
