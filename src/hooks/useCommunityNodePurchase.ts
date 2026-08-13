"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAppKitAccount } from "@reown/appkit/react";
import {
  usePublicClient,
  useWriteContract,
  useSignMessage,
  useSendTransaction,
} from "wagmi";
import { parseUnits } from "viem";
import {
  COMMUNITY_TYPE,
  GROUP_TYPE,
  type MembershipType,
} from "@/constants";
import { triggerWalletConnect } from "@/components/ui/wallet-ref";
import { getTokenAddress } from "@/lib/tokens";

export interface NodeDataShape {
  price_display: number;
  maxNum: number;
  leftNum: number;
  referralReward: number;
  minLevel: number;
  incubationReward: number;
  dynamicRewardCap: number;
  dynamicRewardCapIncrement: number;
  dividendReward: number;
}

export interface VerifierNodeDataShape {
  price_display: number;
  maxNum: number;
  leftNum: number;
  soldCount: number;
  soldAmount: number;
}

export interface DisperseRecipient {
  address: string;
  ratio: number;
}

export interface NodesDataShape {
  groupNode: NodeDataShape;
  communityNode: NodeDataShape;
  verifier1Node?: VerifierNodeDataShape;
  verifier2Node?: VerifierNodeDataShape;
  batchTransferContract?: string;
  disperseRecipients?: DisperseRecipient[];
}

export interface EnvShape {
  environment: string;
  hotWalletAddress: string;
}

/** 接口失败或仅返回 communityNode 时用于展示与认购金额计算（与 config 默认价对齐） */
const USDT_DECIMAL = 18;

export const FALLBACK_NODE_DATA: NodesDataShape = {
  groupNode: {
    price_display: 500,
    maxNum: 2000,
    leftNum: 2000,
    referralReward: 0.1,
    minLevel: 1,
    incubationReward: 0,
    dynamicRewardCap: 1000,
    dynamicRewardCapIncrement: 10,
    dividendReward: 0.01,
  },
  communityNode: {
    price_display: 2000,
    maxNum: 200,
    leftNum: 200,
    referralReward: 0.1,
    minLevel: 1,
    incubationReward: 0,
    dynamicRewardCap: 4000,
    dynamicRewardCapIncrement: 50,
    dividendReward: 0.01,
  },
  verifier1Node: {
    price_display: 500,
    maxNum: 1000,
    leftNum: 1000,
    soldCount: 0,
    soldAmount: 0,
  },
  verifier2Node: {
    price_display: 1000,
    maxNum: 1000,
    leftNum: 1000,
    soldCount: 0,
    soldAmount: 0,
  },
};

function coerceNumber(v: unknown, fallback: number): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = parseFloat(v);
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

/** 将接口 JSON 规范为 NodesDataShape；缺 groupNode 时用本地默认补全 */
function normalizeNodesPayload(raw: unknown): NodesDataShape | null {
  if (!raw || typeof raw !== "object") return null;
  const data = raw as Record<string, unknown>;
  const c = data.communityNode as Record<string, unknown> | undefined;
  if (!c) return null;

  const communityNode: NodeDataShape = {
    price_display: coerceNumber(c.price_display, FALLBACK_NODE_DATA.communityNode.price_display),
    maxNum: coerceNumber(c.maxNum, FALLBACK_NODE_DATA.communityNode.maxNum),
    leftNum: coerceNumber(c.leftNum, FALLBACK_NODE_DATA.communityNode.leftNum),
    referralReward: coerceNumber(c.referralReward, FALLBACK_NODE_DATA.communityNode.referralReward),
    minLevel: coerceNumber(c.minLevel, FALLBACK_NODE_DATA.communityNode.minLevel),
    incubationReward: coerceNumber(c.incubationReward, FALLBACK_NODE_DATA.communityNode.incubationReward),
    dynamicRewardCap: coerceNumber(c.dynamicRewardCap, FALLBACK_NODE_DATA.communityNode.dynamicRewardCap),
    dynamicRewardCapIncrement: coerceNumber(
      c.dynamicRewardCapIncrement,
      FALLBACK_NODE_DATA.communityNode.dynamicRewardCapIncrement
    ),
    dividendReward: coerceNumber(c.dividendReward, FALLBACK_NODE_DATA.communityNode.dividendReward),
  };

  const g = data.groupNode as Record<string, unknown> | undefined;
  const groupNode: NodeDataShape = g
    ? {
      price_display: coerceNumber(g.price_display, FALLBACK_NODE_DATA.groupNode.price_display),
      maxNum: coerceNumber(g.maxNum, FALLBACK_NODE_DATA.groupNode.maxNum),
      leftNum: coerceNumber(g.leftNum, FALLBACK_NODE_DATA.groupNode.leftNum),
      referralReward: coerceNumber(g.referralReward, FALLBACK_NODE_DATA.groupNode.referralReward),
      minLevel: coerceNumber(g.minLevel, FALLBACK_NODE_DATA.groupNode.minLevel),
      incubationReward: coerceNumber(g.incubationReward, FALLBACK_NODE_DATA.groupNode.incubationReward),
      dynamicRewardCap: coerceNumber(g.dynamicRewardCap, FALLBACK_NODE_DATA.groupNode.dynamicRewardCap),
      dynamicRewardCapIncrement: coerceNumber(
        g.dynamicRewardCapIncrement,
        FALLBACK_NODE_DATA.groupNode.dynamicRewardCapIncrement
      ),
      dividendReward: coerceNumber(g.dividendReward, FALLBACK_NODE_DATA.groupNode.dividendReward),
    }
    : { ...FALLBACK_NODE_DATA.groupNode };

  const batchTransferContract = typeof data.batchTransferContract === "string" ? data.batchTransferContract : undefined;
  const disperseRecipients = Array.isArray(data.disperseRecipients)
    ? (data.disperseRecipients as DisperseRecipient[]).filter(r => r.address && Number.isFinite(r.ratio))
    : undefined;

  const v1 = data.verifier1Node as Record<string, unknown> | undefined;
  const verifier1Node: VerifierNodeDataShape | undefined = v1
    ? {
      price_display: coerceNumber(v1.price_display, FALLBACK_NODE_DATA.verifier1Node!.price_display),
      maxNum: coerceNumber(v1.maxNum, FALLBACK_NODE_DATA.verifier1Node!.maxNum),
      leftNum: coerceNumber(v1.leftNum, FALLBACK_NODE_DATA.verifier1Node!.leftNum),
      soldCount: coerceNumber(v1.soldCount, 0),
      soldAmount: coerceNumber(v1.soldAmount, 0),
    }
    : undefined;

  const v2 = data.verifier2Node as Record<string, unknown> | undefined;
  const verifier2Node: VerifierNodeDataShape | undefined = v2
    ? {
      price_display: coerceNumber(v2.price_display, FALLBACK_NODE_DATA.verifier2Node!.price_display),
      maxNum: coerceNumber(v2.maxNum, FALLBACK_NODE_DATA.verifier2Node!.maxNum),
      leftNum: coerceNumber(v2.leftNum, FALLBACK_NODE_DATA.verifier2Node!.leftNum),
      soldCount: coerceNumber(v2.soldCount, 0),
      soldAmount: coerceNumber(v2.soldAmount, 0),
    }
    : undefined;

  return { groupNode, communityNode, verifier1Node, verifier2Node, batchTransferContract, disperseRecipients };
}

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

/** 节点认购报价（与激活 quote 格式对齐，单币种 USDT） */
type NodeQuote = {
  quoteId: string;
  batchTransferContract: string;
  shieldTotal: { token: string; amount: string }[];
  shieldType: 'railgun' | 'disperse';
  amountUsdt: string;
  shieldSignatureMessage?: string;
  railgunProxyContract?: string;
  shieldList?: { recipient: string; amount: string; token: string }[];
};

export type CommunityPurchaseOptions = {
  /** 认购流程结束后回调（与节点页 finally 中 fetchUserInfo 一致） */
  onAfterPurchase?: () => void | Promise<void>;
};

/**
 * 节点认购流程（VIP/SVIP），与激活(equity)流程对齐：
 * 1) 调 /api/points/community/quote 获取报价（shieldList/shieldType）
 * 2) 根据 shieldType：
 *    - railgun：签名 → 调 /api/points/equity/shield 构造 shield calldata → approve → 广播
 *    - disperse：approve + disperseToken 批量转账
 * 3) 调 /api/points/community 确认并校验
 */
export function useCommunityNodePurchase(options?: CommunityPurchaseOptions) {
  const { address } = useAppKitAccount();
  const { writeContractAsync } = useWriteContract();
  const { signMessageAsync } = useSignMessage();
  const { sendTransactionAsync } = useSendTransaction();
  const publicClient = usePublicClient();
  const onAfterRef = useRef(options?.onAfterPurchase);
  onAfterRef.current = options?.onAfterPurchase;

  const [nodeData, setNodeData] = useState<NodesDataShape | null>(null);
  const [env, setEnv] = useState<EnvShape | null>(null);
  const [isJoining, setIsJoining] = useState(false);
  const [txSignature, setTxSignature] = useState<string | null>(null);
  const [showTxModal, setShowTxModal] = useState(false);
  const [showTxErrorModal, setShowTxErrorModal] = useState(false);
  const [txErrorMessage, setTxErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const fetchEnv = async () => {
      try {
        const response = await fetch("/api/info/env", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });
        const data = await response.json();
        if (!cancelled) setEnv(data);
      } catch (e) {
        console.error("Error fetching env:", e);
      }
    };
    const fetchNodeData = async () => {
      try {
        const response = await fetch("/api/info/node", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });
        const data = await response.json();
        if (cancelled) return;
        if (!response.ok) {
          setNodeData(FALLBACK_NODE_DATA);
          return;
        }
        const normalized = normalizeNodesPayload(data);
        setNodeData(normalized ?? FALLBACK_NODE_DATA);
      } catch (e) {
        console.error("Error fetching node data:", e);
        if (!cancelled) setNodeData(FALLBACK_NODE_DATA);
      }
    };
    fetchEnv();
    fetchNodeData();
    return () => {
      cancelled = true;
    };
  }, []);

  /** Disperse 批量转账 */
  const approveAndDisperse = useCallback(
    async (items: { recipient: string; amount: string }[], spender: string, tokenType: "USDT" | "HAKP" = "USDT"): Promise<string> => {
      if (!address) throw new Error("Wallet not connected");
      if (!items.length) throw new Error("Empty transfer list");

      const tokenAddress = getTokenAddress(tokenType);
      if (!tokenAddress) throw new Error(`${tokenType} contract address not found`);

      const recipients = items.map((t) => t.recipient as `0x${string}`);
      const values = items.map((t) => parseUnits(t.amount, USDT_DECIMAL));
      const total = values.reduce((acc, v) => acc + v, BigInt(0));

      // 1. approve
      const approveHash = await writeContractAsync({
        address: tokenAddress as `0x${string}`,
        abi: usdtAbi,
        functionName: "approve",
        args: [spender as `0x${string}`, total],
      });
      if (publicClient && approveHash) {
        await publicClient.waitForTransactionReceipt({ hash: approveHash });
      }

      // 2. disperseToken
      const hash = await writeContractAsync({
        address: spender as `0x${string}`,
        abi: disperseAbi,
        functionName: "disperseToken",
        args: [tokenAddress as `0x${string}`, recipients, values],
      });
      if (!hash) throw new Error("Transaction failed to return a hash");
      return hash;
    },
    [address, publicClient, writeContractAsync]
  );

  /** RAILGUN shield 进私密池（单币种 USDT） */
  const approveAndShield = useCallback(
    async (quote: NodeQuote): Promise<string> => {
      if (!address) throw new Error("Wallet not connected");
      if (!quote.shieldSignatureMessage) throw new Error("Missing shield signature message");

      // 1. 用户钱包签名固定消息
      const signature = await signMessageAsync({ message: quote.shieldSignatureMessage });

      // 2. 后端构造 shield calldata（复用 equity/shield 路由）
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

      // 3. approve USDT 给 RAILGUN 代理合约
      for (const { token, totalWei } of tokens) {
        if (!token) throw new Error("Token address missing from shield response");
        const approveHash = await writeContractAsync({
          address: token as `0x${string}`,
          abi: usdtAbi,
          functionName: "approve",
          args: [proxyContract as `0x${string}`, BigInt(totalWei)],
        });
        if (publicClient && approveHash) {
          await publicClient.waitForTransactionReceipt({ hash: approveHash });
        }
      }

      // 4. 广播 shield 交易
      const hash = await sendTransactionAsync({
        to: to as `0x${string}`,
        data: data as `0x${string}`,
      });
      if (!hash) throw new Error("Shield transaction failed to return a hash");
      return hash;
    },
    [address, publicClient, writeContractAsync, signMessageAsync, sendTransactionAsync]
  );

  const handleCommunity = useCallback(
    async (type: MembershipType, priceInUsd: number, recommender: string, tokenType: "USDT" | "HAKP" = "USDT") => {
      if (!address) {
        triggerWalletConnect();
        return;
      }
      if (isJoining) return;
      setIsJoining(true);
      try {
        setTxErrorMessage(null);

        // VIP/SVIP 节点认购只支持 VERIFIER1/VERIFIER2
        if (type !== 'VERIFIER1' && type !== 'VERIFIER2') {
          throw new Error("Invalid node type");
        }

        // 1. 请求报价（shieldList/shieldType）
        const quoteRes = await fetch("/api/points/community/quote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            dev_address: address.toString(),
            dev_type: type,
          }),
        });
        if (!quoteRes.ok) {
          const errBody = await quoteRes.json().catch(() => ({}));
          throw new Error(errBody.error || "Failed to build node purchase quote");
        }
        const quote = (await quoteRes.json()) as NodeQuote;

        // 2. 链上交易：根据 shieldType 自适应路由
        let shieldTxHash: string;
        if (quote.shieldType === 'disperse') {
          // 0x 公开地址：走 Disperse 批量转账
          const shieldItems = (quote.shieldList ?? []).map((it) => ({
            recipient: it.recipient,
            amount: it.amount,
          }));
          shieldTxHash = await approveAndDisperse(shieldItems, quote.batchTransferContract, tokenType);
        } else {
          // 0zk 私密地址：走 RAILGUN shield
          shieldTxHash = await approveAndShield(quote);
        }

        setTxSignature(shieldTxHash);
        setShowTxModal(true);

        // 3. 回调后端确认与校验
        const response = await fetch("/api/points/community", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            quoteId: quote.quoteId,
            shieldTxHash,
          }),
        });

        if (!response.ok) {
          const errBody = await response.json().catch(() => ({}));
          throw new Error(errBody.error || "Failed to verify transaction");
        }
      } catch (err) {
        setTxErrorMessage(
          err instanceof Error ? err.message : "Failed to verify transaction"
        );
        setShowTxErrorModal(true);
      } finally {
        try {
          await onAfterRef.current?.();
        } catch (e) {
          console.error("onAfterPurchase:", e);
        }
        setIsJoining(false);
      }
    },
    [address, nodeData, env, isJoining, approveAndDisperse, approveAndShield]
  );

  return {
    nodeData,
    env,
    ready: Boolean(nodeData && env),
    isJoining,
    handleCommunity,
    txSignature,
    showTxModal,
    setShowTxModal,
    showTxErrorModal,
    setShowTxErrorModal,
    txErrorMessage,
  };
}

/** 与文案「1,000 USDT」对齐：选价格更接近 1000 的档位；并列时默认定行星（GROUP） */
export function pickSubscribeNodeKind(nodeData: NodesDataShape) {
  const target = 1000;
  const groupPrice = Number(nodeData.groupNode.price_display);
  const communityPrice = Number(nodeData.communityNode.price_display);
  const diffGroup = Math.abs(groupPrice - target);
  const diffCommunity = Math.abs(communityPrice - target);
  if (diffCommunity < diffGroup) {
    return { type: COMMUNITY_TYPE, price: communityPrice } as const;
  }
  if (diffGroup < diffCommunity) {
    return { type: GROUP_TYPE, price: groupPrice } as const;
  }
  return { type: GROUP_TYPE, price: groupPrice } as const;
}
