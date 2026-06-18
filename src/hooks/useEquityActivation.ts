"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAppKitAccount } from "@reown/appkit/react";
import { usePublicClient, useWriteContract } from "wagmi";
import { parseUnits } from "viem";
import bs58 from "bs58";
import {
  DEV_ENV,
  EQUITY_BASE_TYPE,
  EQUITY_PLUS_TYPE,
  EQUITY_PREMIUM_TYPE,
  EQUITY_EXPERT_TYPE,
  EQUITY_VIP_TYPE,
  type MembershipType,
} from "@/constants";
import { triggerWalletConnect } from "@/components/ui/wallet-ref";

export type EquityTierInfo = {
  dev_type: MembershipType;
  price_display: string;
  price_transfer: string;
};

type TransferItem = { address: string; amount: string };
type ActivationQuote = {
  quoteId: string;
  transferList: TransferItem[];
  amountUsdt: string;
  batchTransferContract: string;
};

const USDT_DECIMALS = Number(process.env.NEXT_PUBLIC_USDT_DECIMAL ?? 18);

const usdtAbi = [
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "value", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

// Disperse.app: disperseToken(token, recipients[], values[])
const disperseAbi = [
  {
    name: "disperseToken",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "token", type: "address" },
      { name: "recipients", type: "address[]" },
      { name: "values", type: "uint256[]" },
    ],
    outputs: [],
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
  const [canActivate, setCanActivate] = useState<boolean | null>(null);
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

  // 检查用户是否可以激活
  useEffect(() => {
    let cancelled = false;
    const checkUser = async () => {
      if (!address) {
        setCanActivate(null);
        return;
      }
      try {
        const response = await fetch(`/api/user/exists?address=${encodeURIComponent(address)}`);
        const data = await response.json();
        if (cancelled) return;
        setCanActivate(data.canActivate);
      } catch (e) {
        console.error("Failed to check if user can activate:", e);
        if (!cancelled) {
          setCanActivate(true); // 出错时默认为可以激活，不阻止激活
        }
      }
    };
    void checkUser();
    return () => {
      cancelled = true;
    };
  }, [address]);

  const publicClient = usePublicClient();

  /** 发起 USDT 授权 + Disperse 批量转账，返回 disperse 交易哈希 */
  const approveAndDisperse = useCallback(
    async (quote: ActivationQuote): Promise<string> => {
      if (!address) {
        throw new Error("Wallet not connected");
      }
      const tokenAddress = process.env.NEXT_PUBLIC_USDT_ADDRESS;
      if (!tokenAddress) {
        throw new Error("USDT contract address not found in environment variables");
      }
      if (!quote.transferList.length) {
        throw new Error("Empty transfer list");
      }

      const recipients = quote.transferList.map((t) => t.address as `0x${string}`);
      const values = quote.transferList.map((t) => parseUnits(t.amount, USDT_DECIMALS));
      const total = values.reduce((acc, v) => acc + v, BigInt(0));
      const spender = quote.batchTransferContract as `0x${string}`;

      // 1. 授权批量转账合约支配 USDT
      const approveHash = await writeContractAsync({
        address: tokenAddress as `0x${string}`,
        abi: usdtAbi,
        functionName: "approve",
        args: [spender, total],
      });
      if (publicClient && approveHash) {
        await publicClient.waitForTransactionReceipt({ hash: approveHash });
      }

      // 2. 调用 disperseToken 一笔拆分给所有接收者
      const hash = await writeContractAsync({
        address: spender,
        abi: disperseAbi,
        functionName: "disperseToken",
        args: [tokenAddress as `0x${string}`, recipients, values],
      });
      if (!hash) {
        throw new Error("Transaction failed to return a hash");
      }
      setTxSignature(hash);
      setShowTxModal(true);
      return hash;
    },
    [address, publicClient, writeContractAsync]
  );

  const payEquity = useCallback(
    async (dev_type: MembershipType) => {
      if (!address) {
        triggerWalletConnect();
        return;
      }
      if (isPaying) return;

      setIsPaying(true);
      try {
        setTxErrorMessage(null);

        // 1. 向后端请求拼接好的转账列表（直推/间推/系统钱包）
        const quoteRes = await fetch("/api/points/equity/quote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            dev_address: address.toString(),
            dev_type,
            dev_referralCode: referralRef.current ?? "",
          }),
        });
        if (!quoteRes.ok) {
          const errBody = await quoteRes.json().catch(() => ({}));
          throw new Error(errBody.error || "Failed to build activation quote");
        }
        const quote = (await quoteRes.json()) as ActivationQuote;

        // 2. 链上批量转账。
        //    USE_DEV_MOCK_TX=false：dev/prod 均真实发起交易；
        //    如需恢复 dev 用随机哈希（不真正上链），将其置为 true 即可。
        const USE_DEV_MOCK_TX = false;
        let txSig: string;
        if (USE_DEV_MOCK_TX && env?.environment === DEV_ENV) {
          const randomBytes = new Uint8Array(32);
          crypto.getRandomValues(randomBytes);
          txSig = bs58.encode(randomBytes);
        } else {
          txSig = await approveAndDisperse(quote);
        }

        setTxSignature(txSig);
        setShowTxModal(true);

        // 3. 回调后端确认与校验
        const response = await fetch("/api/points/equity", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            quoteId: quote.quoteId,
            txHash: txSig,
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
    [address, env, isPaying, approveAndDisperse]
  );

  return {
    tiers,
    env,
    canActivate,
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

const EQUITY_TYPES = [
  EQUITY_BASE_TYPE,
  EQUITY_PLUS_TYPE,
  EQUITY_PREMIUM_TYPE,
  EQUITY_EXPERT_TYPE,
  EQUITY_VIP_TYPE,
] as const;

export function isEquityDevType(s: string): s is MembershipType {
  return (EQUITY_TYPES as readonly string[]).includes(s);
}
