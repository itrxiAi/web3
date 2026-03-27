"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAppKitAccount } from "@reown/appkit/react";
import { useWriteContract } from "wagmi";
import bs58 from "bs58";
import { COMMUNITY_TYPE, DEV_ENV, GROUP_TYPE } from "@/constants";
import { triggerWalletConnect } from "@/components/ui/wallet-ref";

export interface NodeDataShape {
  price_display: number;
  price_transfer: number;
  maxNum: number;
  leftNum: number;
  referralReward: number;
  minLevel: number;
  incubationReward: number;
  dynamicRewardCap: number;
  dynamicRewardCapIncrement: number;
  dividendReward: number;
}

export interface NodesDataShape {
  groupNode: NodeDataShape;
  communityNode: NodeDataShape;
}

export interface EnvShape {
  environment: string;
  hotWalletAddress: string;
}

/** 接口失败或仅返回 communityNode 时用于展示与认购金额计算（与 config 默认价对齐） */
const USDT_DECIMAL = Number(process.env.NEXT_PUBLIC_USDT_DECIMAL ?? 6);

export const FALLBACK_NODE_DATA: NodesDataShape = {
  groupNode: {
    price_display: 500,
    price_transfer: 500 * 10 ** USDT_DECIMAL,
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
    price_transfer: 2000 * 10 ** USDT_DECIMAL,
    maxNum: 200,
    leftNum: 200,
    referralReward: 0.1,
    minLevel: 1,
    incubationReward: 0,
    dynamicRewardCap: 4000,
    dynamicRewardCapIncrement: 50,
    dividendReward: 0.01,
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
    price_transfer: coerceNumber(c.price_transfer, FALLBACK_NODE_DATA.communityNode.price_transfer),
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
        price_transfer: coerceNumber(g.price_transfer, FALLBACK_NODE_DATA.groupNode.price_transfer),
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

  return { groupNode, communityNode };
}

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
    async (amount: number): Promise<string> => {
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
    },
    [address, env, writeContractAsync]
  );

  const handleCommunity = useCallback(
    async (isBigNode: boolean, recommender: string) => {
      if (!address) {
        triggerWalletConnect();
        return;
      }
      if (isJoining) return;
      setIsJoining(true);
      try {
        setTxErrorMessage(null);

        if (!nodeData) {
          throw new Error("Node data not found");
        }

        const points = isBigNode
          ? nodeData.communityNode.price_transfer
          : nodeData.groupNode.price_transfer;
        if (isNaN(points) || points <= 0) {
          throw new Error("Please enter a valid positive number");
        }

        const type = isBigNode ? COMMUNITY_TYPE : GROUP_TYPE;

        let txSig: string;
        if (env?.environment === DEV_ENV) {
          console.warn("Using mock transaction hash in development mode");
          const randomBytes = new Uint8Array(32);
          crypto.getRandomValues(randomBytes);
          txSig = bs58.encode(randomBytes);
        } else {
          txSig = await transferTokens(points);
        }

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
export function pickSubscribeNodeKind(nodeData: NodesDataShape): boolean {
  const target = 1000;
  const g = Number(nodeData.groupNode.price_display);
  const c = Number(nodeData.communityNode.price_display);
  const dg = Math.abs(g - target);
  const dc = Math.abs(c - target);
  if (dc < dg) return true;
  if (dg < dc) return false;
  return false;
}
