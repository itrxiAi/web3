"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAppKitAccount } from "@reown/appkit/react";
import {
  usePublicClient,
  useWalletClient,
  useWriteContract,
  useSignMessage,
  useSendTransaction,
} from "wagmi";
import { parseUnits, publicActions } from "viem";
import bs58 from "bs58";
import {
  DEV_ENV,
  EQUITY_BASE_TYPE,
  EQUITY_PLUS_TYPE,
  EQUITY_PREMIUM_TYPE,
  type MembershipType,
} from "@/constants";
import { triggerWalletConnect } from "@/components/ui/wallet-ref";
import { getTokenAddress } from "@/lib/tokens";

export type EquityTierInfo = {
  dev_type: MembershipType;
  price_display: string;
};

type TransferItem = { address: string; amount: string; token: string };
type ShieldListItem = { recipient: string; amount: string; token: string };
type TokenTotal = { token: string; amount: string };
type ShieldType = 'railgun' | 'disperse';
type ActivationQuote = {
  quoteId: string;
  /** 推荐奖励（0x），走 Disperse 批量转账。可能为空（无上级）。 */
  referralList: TransferItem[];
  batchTransferContract: string;
  /** 按币种汇总的 shield 金额。 */
  shieldTotal: TokenTotal[];
  /** shieldType === 'railgun' 时：需用户钱包签名的固定消息。 */
  shieldSignatureMessage?: string;
  /** shieldType === 'railgun' 时：RAILGUN 代理合约。 */
  railgunProxyContract?: string;
  /** shieldType === 'disperse' 时：0x 地址转账列表。 */
  shieldList?: ShieldListItem[];
  /** 系统份额转账类型：railgun（混币器）或 disperse（批量转账）。 */
  shieldType: ShieldType;
  amountUsdt: string;
};

const USDT_DECIMALS = 18;

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

// DualDisperse: multiDisperse(tokens[], recipients[][], values[][])
const multiDisperseAbi = [
  {
    name: "multiDisperse",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "tokens", type: "address[]" },
      { name: "recipients", type: "address[][]" },
      { name: "values", type: "uint256[][]" },
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
  const { data: walletClient } = useWalletClient();
  // 用钱包内置 RPC 的 client，使 waitForTransactionReceipt 与发交易走同一节点
  const walletPublicClient = useMemo(() => {
    if (!walletClient) return null;
    return walletClient.extend(publicActions);
  }, [walletClient]);
  const { signMessageAsync } = useSignMessage();
  const { sendTransactionAsync } = useSendTransaction();

  /** Disperse 批量转账：按币种分组，每种币 approve，然后一笔 multiDisperse 搞定。返回交易哈希。 */
  const approveAndDisperse = useCallback(
    async (items: TransferItem[], spender: string): Promise<string> => {
      if (!address) {
        throw new Error("Wallet not connected");
      }
      if (!items.length) {
        throw new Error("Empty transfer list");
      }

      // 按 token 分组
      const groups = new Map<string, TransferItem[]>();
      for (const it of items) {
        const arr = groups.get(it.token) ?? [];
        arr.push(it);
        groups.set(it.token, arr);
      }

      // 1. 每种币各 approve 给聚合合约
      const tokenAddresses: `0x${string}`[] = [];
      const recipientsGroups: `0x${string}`[][] = [];
      const valuesGroups: bigint[][] = [];
      const confirmClient = walletPublicClient ?? publicClient;

      for (const [token, groupItems] of groups) {
        const tokenAddress = getTokenAddress(token);
        if (!tokenAddress) {
          throw new Error(`${token} contract address not found in environment variables`);
        }

        const recipients = groupItems.map((t) => t.address as `0x${string}`);
        const values = groupItems.map((t) => parseUnits(t.amount, USDT_DECIMALS));
        const total = values.reduce((acc, v) => acc + v, BigInt(0));

        const approveHash = await writeContractAsync({
          address: tokenAddress as `0x${string}`,
          abi: usdtAbi,
          functionName: "approve",
          args: [spender as `0x${string}`, total],
        });
        if (confirmClient && approveHash) {
          await confirmClient.waitForTransactionReceipt({ hash: approveHash });
        }

        tokenAddresses.push(tokenAddress as `0x${string}`);
        recipientsGroups.push(recipients);
        valuesGroups.push(values);
      }

      // 2. 一笔 multiDisperse 搞定所有币种
      const hash = await writeContractAsync({
        address: spender as `0x${string}`,
        abi: multiDisperseAbi,
        functionName: "multiDisperse",
        args: [tokenAddresses, recipientsGroups, valuesGroups],
      });
      if (!hash) {
        throw new Error("Transaction failed to return a hash");
      }
      // 等区块确认，revert 则抛错（避免前端误报 "Submitted"）
      if (!confirmClient) throw new Error("publicClient unavailable, cannot confirm tx");
      const receipt = await confirmClient.waitForTransactionReceipt({ hash });
      if (receipt.status !== 'success') {
        throw new Error(`MultiDisperse transaction reverted (hash=${hash})`);
      }
      return hash;
    },
    [address, publicClient, walletPublicClient, writeContractAsync]
  );

  /**
   * 系统份额：RAILGUN shield 进私密池（多币种）。
   * 1) 用户签名 shield 消息；2) 后端用签名+0zk 地址构造 shield calldata；
   * 3) 每种币各 approve 给代理合约；4) 广播 shield 交易。返回 shield 交易哈希。
   */
  const approveAndShield = useCallback(
    async (quote: ActivationQuote): Promise<string> => {
      if (!address) {
        throw new Error("Wallet not connected");
      }

      // 1. 用户钱包签名固定消息（派生 shieldPrivateKey）
      if (!quote.shieldSignatureMessage) {
        throw new Error("Missing shield signature message");
      }
      const signature = await signMessageAsync({ message: quote.shieldSignatureMessage });

      // 2. 后端构造 shield calldata（0zk 地址不下发浏览器）
      const buildRes = await fetch("/api/points/equity/shield", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quoteId: quote.quoteId, signature }),
      });
      if (!buildRes.ok) {
        const errBody = await buildRes.json().catch(() => ({}));
        throw new Error(errBody.error || "Failed to build shield transaction");
      }
      const { to, data, proxyContract, tokens } = (await buildRes.json()) as {
        to: string;
        data: string;
        proxyContract: string;
        tokens: { token: string; totalWei: string }[];
      };

      // 3. 每种币各 approve 给 RAILGUN 代理合约
      //    tokens 来自 buildShieldTransaction，token 字段已经是合约地址
      const confirmClient = walletPublicClient ?? publicClient;
      for (const { token, totalWei } of tokens) {
        if (!token) {
          throw new Error("Token address missing from shield response");
        }
        const approveHash = await writeContractAsync({
          address: token as `0x${string}`,
          abi: usdtAbi,
          functionName: "approve",
          args: [proxyContract as `0x${string}`, BigInt(totalWei)],
        });
        if (confirmClient && approveHash) {
          await confirmClient.waitForTransactionReceipt({ hash: approveHash });
        }
      }

      // 4. 广播 shield 交易（一笔包含所有币种）
      const hash = await sendTransactionAsync({
        to: to as `0x${string}`,
        data: data as `0x${string}`,
      });
      if (!hash) {
        throw new Error("Shield transaction failed to return a hash");
      }
      // 等区块确认，revert 则抛错（避免前端误报 "Submitted"）
      if (!confirmClient) throw new Error("publicClient unavailable, cannot confirm tx");
      const receipt = await confirmClient.waitForTransactionReceipt({ hash });
      if (receipt.status !== 'success') {
        throw new Error(`Shield transaction reverted (hash=${hash})`);
      }
      return hash;
    },
    [address, publicClient, walletPublicClient, writeContractAsync, signMessageAsync, sendTransactionAsync]
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

        // 2. 链上交易：根据 shieldType 自适应路由
        //    shieldType === 'railgun'：系统份额走 RAILGUN shield 进私密池
        //    shieldType === 'disperse'：系统份额走 Disperse 批量转账给 0x 地址
        //    referralList（推荐奖励）当前恒为空，保留兼容。
        const USE_DEV_MOCK_TX = false;
        let referralTxHash: string | null = null;
        let shieldTxHash: string;
        if (USE_DEV_MOCK_TX && env?.environment === DEV_ENV) {
          const randomBytes = new Uint8Array(32);
          crypto.getRandomValues(randomBytes);
          shieldTxHash = bs58.encode(randomBytes);
        } else if (quote.shieldType === 'disperse') {
          // 0x 公开地址：走 Disperse 批量转账（多币种分组）
          const shieldItems = (quote.shieldList ?? []).map((it) => ({ address: it.recipient, amount: it.amount, token: it.token }));
          shieldTxHash = await approveAndDisperse(shieldItems, quote.batchTransferContract);
          if (quote.referralList.length > 0) {
            referralTxHash = await approveAndDisperse(quote.referralList, quote.batchTransferContract);
          }
        } else {
          // 0zk 私密地址：走 RAILGUN shield
          shieldTxHash = await approveAndShield(quote);
          if (quote.referralList.length > 0) {
            referralTxHash = await approveAndDisperse(quote.referralList, quote.batchTransferContract);
          }
        }

        setTxSignature(shieldTxHash);
        setShowTxModal(true);

        // 3. 回调后端确认与校验（两笔交易：推荐 Disperse + 系统份额 shield）
        const response = await fetch("/api/points/equity", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            quoteId: quote.quoteId,
            referralTxHash,
            shieldTxHash,
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
    [address, env, isPaying, approveAndDisperse, approveAndShield]
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
] as const;

export function isEquityDevType(s: string): s is MembershipType {
  return (EQUITY_TYPES as readonly string[]).includes(s);
}
