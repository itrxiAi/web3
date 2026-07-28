"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAppKitAccount } from "@reown/appkit/react";
import { useWriteContract } from "wagmi";
import {
  COMMUNITY_TYPE,
  GROUP_TYPE,
  type MembershipType,
} from "@/constants";
import { triggerWalletConnect } from "@/components/ui/wallet-ref";

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

export type CommunityPurchaseOptions = {
  /** 认购流程结束后回调（与节点页 finally 中 fetchUserInfo 一致） */
  onAfterPurchase?: () => void | Promise<void>;
};

/**
 * 与节点页相同的认购流程：环境变量、链上 USDT 转账、/api/points/community
 */
export function useCommunityNodePurchase(options?: CommunityPurchaseOptions) {
  const { address } = useAppKitAccount();
  const { writeContractAsync } = useWriteContract();
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

  const transferTokens = useCallback(
    async (amount: number, tokenType: "USDT" | "HAKP" = "USDT"): Promise<string> => {
      if (!address) {
        throw new Error("Wallet not connected");
      }
      const tokenAddress = tokenType === "HAKP"
        ? process.env.NEXT_PUBLIC_HAKP_ADDRESS
        : process.env.NEXT_PUBLIC_USDT_ADDRESS;
      if (!tokenAddress) {
        throw new Error(`${tokenType} contract address not found in environment variables`);
      }

      const recipients = nodeData?.disperseRecipients;
      const batchContract = nodeData?.batchTransferContract;

      // 如果没有配置批量转账接收列表，回退到单笔转账到 hotWallet
      if (!recipients || !recipients.length || !batchContract) {
        if (!env?.hotWalletAddress) {
          throw new Error("Hot wallet address environment variable is not set");
        }
        const amountInWei = BigInt(amount);
        const hash = await writeContractAsync({
          address: tokenAddress as `0x${string}`,
          abi: usdtAbi,
          functionName: "transfer",
          args: [env.hotWalletAddress as `0x${string}`, amountInWei],
        });
        if (!hash) {
          throw new Error("Transaction failed to return a hash");
        }
        setTxSignature(hash);
        setShowTxModal(true);
        return hash;
      }

      // 批量转账：approve + disperseToken
      const total = BigInt(amount);
      const recipientAddrs = recipients.map(r => r.address as `0x${string}`);
      const values = recipients.map(r => BigInt(Math.floor(amount * r.ratio)));

      // 修正尾差：确保 values 之和等于 total
      const sumValues = values.reduce((acc, v) => acc + v, BigInt(0));
      const diff = total - sumValues;
      if (diff !== BigInt(0)) {
        values[0] += diff;
      }

      // 1. 授权批量转账合约支配 USDT
      const approveHash = await writeContractAsync({
        address: tokenAddress as `0x${string}`,
        abi: usdtAbi,
        functionName: "approve",
        args: [batchContract as `0x${string}`, total],
      });
      if (!approveHash) {
        throw new Error("Approve transaction failed to return a hash");
      }

      // 2. 调用 disperseToken 拆分给所有接收者
      const hash = await writeContractAsync({
        address: batchContract as `0x${string}`,
        abi: disperseAbi,
        functionName: "disperseToken",
        args: [tokenAddress as `0x${string}`, recipientAddrs, values],
      });
      if (!hash) {
        throw new Error("Transaction failed to return a hash");
      }
      setTxSignature(hash);
      setShowTxModal(true);
      return hash;
    },
    [address, env, nodeData, writeContractAsync]
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

        let normalizedPrice = Number(priceInUsd);

        if (!Number.isFinite(normalizedPrice) || normalizedPrice <= 0) {
          if (!nodeData) {
            throw new Error("Please enter a valid positive number");
          }

          if (type === COMMUNITY_TYPE) {
            normalizedPrice = nodeData.communityNode.price_display;
          } else if (type === GROUP_TYPE) {
            normalizedPrice = nodeData.groupNode.price_display;
          }
        }

        if (!Number.isFinite(normalizedPrice) || normalizedPrice <= 0) {
          throw new Error("Please enter a valid positive number");
        }

        const amountToTransfer = Math.round(
          normalizedPrice * 10 ** USDT_DECIMAL
        );

        if (!Number.isFinite(amountToTransfer) || amountToTransfer <= 0) {
          throw new Error("Please enter a valid positive number");
        }

        let txSig: string;
        txSig = await transferTokens(amountToTransfer, tokenType);

        setTxSignature(txSig);
        setShowTxModal(true);

        const response = await fetch("/api/points/community", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            txHash: txSig,
            dev_address: address.toString(),
            dev_referralCode: recommender,
            dev_type: type,
            dev_tokenType: tokenType,
          }),
        });

        if (!response.ok) {
          const errBody = await response.json();
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
    [address, nodeData, env, isJoining, transferTokens]
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
