//个人中心
"use client";

import React, { useState, useEffect } from "react";
import { useTranslations, useLocale } from "next-intl";
import Image from "next/image";
import Link from "next/link";
import LoadingSpinner from "@/components/LoadingSpinner";
import { EquityType, TokenType, TxFlowType } from "@prisma/client";
import { VERIFIER_1, VERIFIER_2 } from "@/constants";
import { generateOperationHash } from "@/utils/auth";
import bs58 from "bs58";
import { triggerWalletConnect } from "@/components/ui/wallet-ref";
import { QRCodeModal } from "@/components/ui/qr-code-modal"; // 引入 QRCodeModal 组件
import { ErrorCode } from "@/lib/errors";
import { useAppKitAccount } from "@reown/appkit/react";
import { useSignMessage } from "wagmi";
import { RecommenderModal } from "@/components/ui/recommender-modal";
import { truncateDecimals, truncateDecimalsStr } from "@/utils/common";
import decimal from "decimal.js";
import BorderCustom from "@/components/ui/border-custom";

interface QuotaInfo {
  quotaVideoPost?: number;
  quotaVideoLike?: number;
  quotaCommentPost?: number;
  quotaCommentLike?: number;
  quotaLiveLike?: number;
  quotaLiveInteract?: number;
}

interface ZeroQuotaInfo {
  taskVideoPost?: number;
  taskVideoLike?: number;
  taskCommentPost?: number;
  taskCommentLike?: number;
  taskLiveLike?: number;
  taskLiveInteract?: number;
}

interface UserInfo {
  type: string | null;
  level: number;
  usdt_points: number;
  token_points: number;
  usdt_withdrawable: number;
  token_withdrawable: number;
  token_locked_points: number;
  token_staked_points: number;
  referral_code?: string;
  superior?: string | null;
  superior_referral_code?: string;
  path?: string | null;
  equityType: EquityType | null;
  cards: number;
  points: number;
  directVipCount?: number;
  directSvipCount?: number;
  allVipCount?: number;
  allSvipCount?: number;
  activation?: QuotaInfo | null;
  zeroQuota?: ZeroQuotaInfo | null;
  performance?: number;
  teamLevel?: string;
  teamSize?: number;
  directCount?: number;
}

interface DirectReferral {
  sequence: number;
  address: string;
  equityType: string;
  consensusAmount: number;
  performance: number;
  activatedAt: string | null;
}

function MyContent() {
  const { address } = useAppKitAccount();
  const { signMessageAsync } = useSignMessage();
  const t = useTranslations("my");
  const locale = useLocale();
  const tUserType = useTranslations("user_type");
  const tErrors = useTranslations("errors");
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [directs, setDirects] = useState<DirectReferral[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCashOutModal, setShowCashOutModal] = useState(false);
  const [showInternalTransferModal, setShowInternalTransferModal] =
    useState(false);
  const [showFlashSwapModal, setShowFlashSwapModal] = useState(false);
  const [transferMode, setTransferMode] = useState<"cashout" | "internal">(
    "cashout"
  );
  const [showRecommenderModal, setShowRecommenderModal] = useState(false);
  const [showRecommenderConfirmModal, setShowRecommenderConfirmModal] =
    useState(false);

  const [showCopiedNotification, setShowCopiedNotification] = useState(false); // Add state for copy notification

  const [cashOutAmount, setCashOutAmount] = useState("0.00");
  const [toAddress, setToAddress] = useState<string>("");
  const [cashOutTokenType, setCashOutTokenType] = useState<TokenType>(
    TokenType.HAK
  );
  // app backend 余额（HAK / USDT）
  const [balance, setBalance] = useState<{ HAK: string; USDT: string }>({
    HAK: "0",
    USDT: "0",
  });

  // 当前所选提现资产的可用余额
  const currentBalance =
    cashOutTokenType === TokenType.HAK ? balance.HAK : balance.USDT;
  const currentAsset = cashOutTokenType === TokenType.HAK ? "HAK" : "USDT";
  // 与 app backend 提现规则保持一致的最低提现金额
  const minWithdrawAmount = cashOutTokenType === TokenType.HAK ? 10 : 5;

  const fetchBalance = async () => {
    if (!address) return;
    try {
      const response = await fetch(`/api/user/balance?address=${address}`);
      if (response.ok) {
        const data = await response.json();
        setBalance({
          HAK: String(data?.HAK?.amount ?? "0"),
          USDT: String(data?.USDT?.amount ?? "0"),
        });
      }
    } catch (error) {
      console.error("Error fetching balance:", error);
    }
  };

  // 每日收益（今日，按资产分别累计，排除提现及提现手续费）
  const [earningsSummary, setEarningsSummary] = useState<{
    hak: string;
    usdt: string;
  }>({ hak: "0.00", usdt: "0.00" });
  const [showEarningsModal, setShowEarningsModal] = useState(false);
  const [earningsEntries, setEarningsEntries] = useState<
    Array<{
      id: string;
      bizType: string;
      asset: string;
      amount: string;
      note?: string | null;
      createdAt: string;
    }>
  >([]);
  const [earningsCursor, setEarningsCursor] = useState<string | null>(null);
  const [earningsLoading, setEarningsLoading] = useState(false);

  const fetchEarningsSummary = async () => {
    if (!address) return;
    try {
      const response = await fetch(
        `/api/user/earnings/summary?address=${address}&range=today`
      );
      if (!response.ok) return;
      const data = await response.json();
      const items: Array<{ bizType: string; asset: string; amount: string }> =
        Array.isArray(data) ? data : [];
      const sumByAsset = (asset: string) =>
        items
          .filter(
            (i) =>
              i.asset === asset &&
              i.bizType !== "WITHDRAW" &&
              i.bizType !== "WITHDRAW_FEE"
          )
          .reduce((acc, i) => acc + Number(i.amount || 0), 0)
          .toFixed(2);
      setEarningsSummary({ hak: sumByAsset("HAK"), usdt: sumByAsset("USDT") });
    } catch (error) {
      console.error("Error fetching earnings summary:", error);
    }
  };

  const fetchEarningsEntries = async (cursor?: string | null) => {
    if (!address) return;
    try {
      setEarningsLoading(true);
      const qs = new URLSearchParams({ address, limit: "50" });
      if (cursor) qs.set("cursor", cursor);
      const response = await fetch(`/api/user/earnings/entries?${qs.toString()}`);
      if (response.ok) {
        const data = await response.json();
        const items = data?.items ?? [];
        setEarningsEntries((prev) => (cursor ? [...prev, ...items] : items));
        setEarningsCursor(data?.nextCursor ?? null);
      }
    } catch (error) {
      console.error("Error fetching earnings entries:", error);
    } finally {
      setEarningsLoading(false);
    }
  };

  // Fetch direct referrals
  const fetchDirects = async () => {
    if (!address) return;
    try {
      const response = await fetch(`/api/user/directs?address=${address}`);
      if (response.ok) {
        const data = await response.json();
        setDirects(data.directs || []);
      }
    } catch (error) {
      console.error('Error fetching directs:', error);
    }
  };

  useEffect(() => {
    if (address) {
      setToAddress(address);
      fetchDirects();
      fetchBalance();
      fetchEarningsSummary();
    }
  }, [address]);

  const getRoleLabel = () => {
    if (userInfo?.type === VERIFIER_1) return tUserType(VERIFIER_1);
    if (userInfo?.type === VERIFIER_2) return tUserType(VERIFIER_2);
    return tUserType("NORMAL");
  };
  const [showTokenTypeDropdown, setShowTokenTypeDropdown] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recommenderError, setRecommenderError] = useState<string | null>(null);
  const [withdrawError, setWithdrawError] = useState<string | null>(null);
  const [superiorReferralCode, setSuperiorReferralCode] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [version, setVersion] = useState("1.0"); // Default version until fetched
  const [showQRModal, setShowQRModal] = useState(false); // 新增二维码弹窗状态
  const [minCashOutAmountToken, setMinCashOutAmountToken] = useState(0);
  const [constantFee, setConstantFee] = useState(0.1);
  const [withdrawTokenFeeRatio, setWithdrawTokenFeeRatio] = useState(0.02);
  const [minCashOutAmountUsdt, setMinCashOutAmountUsdt] = useState(0);
  const [withdrawResult, setWithdrawResult] = useState("");
  const [tokenPrice, setTokenPrice] = useState(0.1); // Default token price in USDT

  const encoder = new TextEncoder();

  const formatAddress = (address: string | undefined) => {
    if (!address) return "";
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  // Invitation link uses referralCode; host comes from the current origin.
  const code = userInfo?.referral_code;
  const inviteUrl =
    code && typeof window !== "undefined"
      ? `${window.location.origin}/${locale}?ref=${code}`
      : "";
  const inviteUrlDisplay =
    code && typeof window !== "undefined"
      ? `${window.location.origin}/${locale}?ref=${code}`
      : "--";

  // Referrer's referralCode is the second-to-last segment of the path
  // (path layout: "rootCode.…parentCode.myCode"). When the user is a root
  // (length 1) or has no path, there is no referrer.
  const referrerCode = (() => {
    const segs = userInfo?.path?.split(".") ?? [];
    return segs.length >= 2 ? segs[segs.length - 2] : null;
  })();

  const handleCopy = () => {
    if (!inviteUrl) return;
    navigator.clipboard
      .writeText(inviteUrl)
      .then(() => {
        setShowCopiedNotification(true);
        // Auto-hide notification after 2 seconds
        setTimeout(() => {
          setShowCopiedNotification(false);
        }, 2000);
      })
      .catch((err) => {
        console.error("Failed to copy: ", err);
      });
  };

  const fetchUserInfo = async () => {
    if (!address) return;

    try {
      setLoading(true);
      const response = await fetch(`/api/user/info?address=${address}`);
      if (response.ok) {
        const data = await response.json();

        // Convert string values to numbers
        const parsedData = {
          ...data,
          usdt_points: Number(data.usdt_points),
          token_points: Number(data.token_points),
          usdt_withdrawable: Number(data.usdt_withdrawable),
          superior_referral_code: data.superior_referral_code,
          token_withdrawable: Number(data.token_withdrawable),
          token_locked_points: Number(data.token_locked_points),
          token_staked_points: Number(data.token_staked_points),
          referral_code: data.referral_code,
          path: data.path ?? null,
          equityType: (data.equityType as EquityType | null) ?? null,
          cards: Number(data.cards ?? 0),
          points: Number(data.points ?? 0),
          performance: Number(data.performance ?? 0),
          teamLevel: data.teamLevel ?? 'NONE',
          teamSize: Number(data.teamSize ?? 0),
          directCount: Number(data.directCount ?? 0),
          superior: data.superior ?? null,
        };

        setUserInfo(parsedData);
      }
    } catch (error) {
      console.error("Error fetching user info:", error);
    } finally {
      setLoading(false);
    }
  };

  const flashSwapPoints = async (
    info: {
      operationType: TxFlowType;
      amount: number;
      walletAddress: string;
      timestamp: number;
      tokenType: string;
    },
    signature: string
  ) => {
    if (!address) {
      setError("Wallet not connected");
      return;
    }

    try {
      setLoading(true);
      setWithdrawError(null);

      const response = await fetch("/api/points/flash-swap", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ...info, signature }),
      });

      if (!response.ok) {
        const error = await response.json();
        setWithdrawError(tErrors(error.error));
        return;
      }

      const { success } = await response.json();
      setWithdrawResult("success");
      // Refresh points after withdrawing
      fetchUserInfo();
    } catch (err) {
      setError(err instanceof Error ? err.message : ErrorCode.SERVER_ERROR);
    } finally {
      setLoading(false);
    }
  };

  const withdrawPoints = async (info: {
    amount: number;
    tokenType: TokenType;
  }) => {
    if (!address) {
      setError("Wallet not connected");
      return;
    }

    try {
      setLoading(true);
      setWithdrawError(null);

      const response = await fetch("/api/user/withdraw", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          address,
          asset: info.tokenType === TokenType.HAK ? "HAK" : "USDT",
          amount: String(info.amount),
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setWithdrawError(
          data?.message ||
            tErrors(data?.code || data?.error || ErrorCode.OPERATION_FAILED)
        );
        return;
      }

      setWithdrawResult("success");
      // Refresh balance and user info after withdrawing
      fetchBalance();
      fetchUserInfo();
    } catch (err) {
      setError(err instanceof Error ? err.message : ErrorCode.SERVER_ERROR);
    } finally {
      setLoading(false);
    }
  };

  const transferPoints = async (
    info: {
      operationType: TxFlowType;
      amount: number;
      walletAddress: string;
      timestamp: number;
      tokenType: string;
    },
    signature: string
  ) => {
    if (!address) {
      setError("Wallet not connected");
      return;
    }

    try {
      setLoading(true);
      setWithdrawError(null);

      const response = await fetch("/api/points/inner-transfer", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ...info, signature }),
      });

      if (!response.ok) {
        const error = await response.json();
        setWithdrawError(tErrors(error.error));
        return;
      }

      const { success } = await response.json();
      setWithdrawResult("success");
      // Refresh points after withdrawing
      fetchUserInfo();
    } catch (err) {
      setError(err instanceof Error ? err.message : ErrorCode.SERVER_ERROR);
    } finally {
      setLoading(false);
    }
  };

  const handleFlashSwap = async () => {
    try {
      setError(null);

      if (!address || !signMessageAsync) {
        setError("Please connect your wallet first");
        return;
      }

      const points = parseFloat(cashOutAmount);
      if (isNaN(points)) {
        setError("Please enter a valid positive number");
        return;
      }

      if (!address) {
        setError("Please connect your wallet first");
        return;
      }

      const info = {
        operationType: TxFlowType.DEPOSIT,
        amount: points,
        tokenType: TokenType.HAK,
        walletAddress: address,
        description: "",
        timestamp: Date.now(),
      };
      const hash = await generateOperationHash(info);
      const signature = await signMessageAsync({ message: hash });
      await flashSwapPoints(info, signature);
      //setShowCashOutModal(false);
    } catch (err) {
      console.log(
        `Error ${transferMode === "cashout" ? "withdrawing" : "transferring"
        } points: ${err}`
      );
      setWithdrawError(tErrors(ErrorCode.OPERATION_FAILED));
    }
  };

  const handleWithdrawPoints = async () => {
    try {
      setError(null);

      if (!address) {
        setError("Please connect your wallet first");
        return;
      }

      const points = parseFloat(cashOutAmount);
      if (isNaN(points) || points <= 0) {
        setWithdrawError(tErrors(ErrorCode.INVALID_AMOUNT));
        return;
      }

      // 提现只能提到本人地址，目标地址由服务端固定为当前钱包地址
      await withdrawPoints({ amount: points, tokenType: cashOutTokenType });
      //setShowCashOutModal(false);
    } catch (err) {
      console.log(
        `Error ${transferMode === "cashout" ? "withdrawing" : "transferring"
        } points: ${err}`
      );
      setWithdrawError(tErrors(ErrorCode.OPERATION_FAILED));
    }
  };

  // Function to update the superior referral code

  const fetchVersion = async () => {
    try {
      const response = await fetch("/api/info/env", {
        method: "POST",
      });
      if (response.ok) {
        const data = await response.json();
        setVersion(data.version);
        setMinCashOutAmountToken(data.minCashOutAmountToken);
        setMinCashOutAmountUsdt(data.minCashOutAmountUsdt);
        setConstantFee(data.constantFee);
        setWithdrawTokenFeeRatio(data.withdrawTokenFeeRatio);
      }
    } catch (error) {
      console.error("Error fetching version:", error);
    }
  };

  const fetchTokenPrice = async () => {
    try {
      const response = await fetch("/api/info/token-price");
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data && data.data.tokenPrice) {
          setTokenPrice(
            new decimal(data.data.tokenPrice).toNumber()
          );
        }
      }
    } catch (error) {
      console.error("Error fetching token price:", error);
    }
  };

  // Fetch user info when wallet is connected
  useEffect(() => {
    if (address) {
      fetchUserInfo();
    }
  }, [address]);

  // Fetch version info on component mount
  useEffect(() => {
    fetchVersion();
  }, []);

  // Fetch token price when flash swap modal opens
  useEffect(() => {
    if (showFlashSwapModal) {
      fetchTokenPrice();
    }
  }, [showFlashSwapModal]);

  const menuItems = [
    //{ key: 'invite', label: t('invite'), href: '/my/community' },
    { key: "my_invites", label: t("my_invites"), href: "/my/invites" },
    // { key: 'my_community', label: t('my_community'), href: '/my/community' },
    // { key: 'my_stake', label: t('my_stake'), href: '/my/burning' },
    {
      key: "my_withdrawals",
      label: t("my_withdrawals"),
      href: "/my/withdrawals",
    },
    { key: "my_proclaim", label: t("my_proclaim"), href: "/my/proclaim" },
  ];

  const socialLinks = [
    //{ key: 'official_site', label: t('official_site'), icon: '/images/social/ait.svg', href: 'https://ait.ai/' },
    {
      key: "twitter",
      label: t("twitter"),
      icon: "/images/social/x.svg",
      href: "https://x.com/ai_ait",
    },
    {
      key: "telegram",
      label: t("telegram"),
      icon: "/images/social/telegram.svg",
      href: "https://t.me/aitglobal",
    },
  ];

  // 配额：激活配额优先，未激活时回退到零撸任务配额
  const quotaItems = [
    {
      key: "video",
      label: t("quota_video"),
      value:
        userInfo?.activation?.quotaVideoPost ??
        userInfo?.zeroQuota?.taskVideoPost ??
        0,
    },
    {
      key: "like",
      label: t("quota_like"),
      value:
        userInfo?.activation?.quotaVideoLike ??
        userInfo?.zeroQuota?.taskVideoLike ??
        0,
    },
    {
      key: "comment",
      label: t("quota_comment"),
      value:
        userInfo?.activation?.quotaCommentPost ??
        userInfo?.zeroQuota?.taskCommentPost ??
        0,
    },
    {
      key: "comment_like",
      label: t("quota_comment_like"),
      value:
        userInfo?.activation?.quotaCommentLike ??
        userInfo?.zeroQuota?.taskCommentLike ??
        0,
    },
    {
      key: "live_like",
      label: t("quota_live_like"),
      value:
        userInfo?.activation?.quotaLiveLike ??
        userInfo?.zeroQuota?.taskLiveLike ??
        0,
    },
    {
      key: "live_interact",
      label: t("quota_live_interact"),
      value:
        userInfo?.activation?.quotaLiveInteract ??
        userInfo?.zeroQuota?.taskLiveInteract ??
        0,
    },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Main content area */}
      <div className="flex-1 pt-4">
        <div className="p-4 text-white">
          {/* Page Title */}
          <div className="text-center mb-6">
            <h1 className="text-xl font-bold" style={{ color: "rgba(255, 255, 255, 0.9)" }}>
              {t("personal_center")}
            </h1>
          </div>

          {/* User Info Section with Purple Gradient Background */}
          <div
            className="relative rounded-2xl mb-8 p-6"
          >
            {/* Decorative circles background */}
            <div
              className="absolute inset-0 rounded-2xl pointer-events-none"
              style={{
                background: "radial-gradient(circle at 20% 50%, rgba(100, 50, 150, 0.15) 0%, transparent 50%)",
              }}
            />

              <div className="relative flex flex-col gap-4">
                <div className="flex gap-6">
              {/* Left: Avatar */}
              <div className="flex-shrink-0 flex items-center justify-center">
                <Image
                  src="/imgs/my/logo.png"
                  alt="Logo"
                  width={120}
                  height={120}
                  className="object-contain"
                />
              </div>

              {/* Right: User Info */}
              <div className="flex-1 min-w-0 flex flex-col justify-center space-y-3">
                {/* Wallet Address */}
                <span className="text-xs font-mono text-white font-bold tracking-wider break-all overflow-wrap:anywhere leading-relaxed w-full">
                  {address ? address.toUpperCase() : "--"}
                </span>

                {/* Identity inline */}
                <p className="text-sm text-white">
                  <span style={{ color: "rgba(255, 255, 255, 0.6)" }}>
                    {t("identity")}：
                  </span>
                  {address ? (
                    <>
                      {getRoleLabel()}
                    </>
                  ) : ( 
                    "--"
                  )}
                </p>


              </div>
                </div>

                {/* Invite link row with full width */}
                <div className="flex items-center gap-2 w-full">
                  <span
                    className="text-xs shrink-0"
                    style={{ color: "rgba(255,255,255,0.7)" }}
                  >
                    {t("my_recommender")}：
                  </span>
                  <span className="text-xs text-white min-w-0 flex-1 break-all">
                    {inviteUrlDisplay}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      if (!address) {
                        triggerWalletConnect();
                        return;
                      }
                      handleCopy();
                    }}
                    className="p-1 rounded shrink-0"
                    aria-label="Copy invitation link"
                  >
                    <Image
                      src="/imgs/my/copy.png"
                      alt="Copy"
                      width={20}
                      height={20}
                      className="object-contain"
                    />
                  </button>
                </div>

                {/* Superior (referrer) row - read-only display */}
                {userInfo?.superior && (
                  <div className="flex items-center gap-2 w-full">
                    <span
                      className="text-xs shrink-0"
                      style={{ color: "rgba(255,255,255,0.7)" }}
                    >
                      {t("referrer")}：
                    </span>
                    <span className="text-xs text-white truncate min-w-0 flex-1">
                      {userInfo.superior}
                    </span>
                  </div>
                )}
              </div>
          </div>

          {/* My Directs Section */}
          {directs.length > 0 && (
            <div className="mb-8">
              <div
                className="p-5"
                style={{
                  opacity: 0.78,
                  borderRadius: "15px",
                  backgroundImage: "linear-gradient(0deg, #e30e10 0%, #690a71 100%)",
                }}
              >
                <h2 className="text-sm font-bold text-white mb-4">{t("my_directs")}</h2>
                <div className="space-y-2">
                  {/* Table Header */}
                  <div className="grid grid-cols-[60px_1fr_120px] gap-2 text-xs text-white/70 pb-2 border-b border-white/20">
                    <div>{t("direct_sequence")}</div>
                    <div>{t("direct_address")}</div>
                    <div className="text-right">{t("performance")}</div>
                  </div>
                  {/* Table Rows - Real data from API */}
                  {directs.map((direct) => {
                    // 格式化地址为中间省略号格式：0x1234...5678
                    const formatAddress = (addr: string) => {
                      if (!addr || addr.length < 12) return addr;
                      return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
                    };
                    
                    return (
                      <div key={direct.sequence} className="grid grid-cols-[60px_1fr_120px] gap-2 text-xs text-white py-2">
                        <div>{direct.sequence}</div>
                        <div>{formatAddress(direct.address)}</div>
                        <div className="text-right">
                          {truncateDecimals(Number(direct.performance ?? 0))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Balance & Withdraw Section */}
          <div className="mb-8">
            <div
              className="p-5"
              style={{
                opacity: 0.78,
                borderRadius: "15px",
                backgroundImage: "linear-gradient(0deg, #e30e10 0%, #690a71 100%)",
              }}
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-bold text-white">
                  {t("balance")}
                </h2>
                <button
                  type="button"
                  onClick={() => {
                    if (!address) {
                      triggerWalletConnect();
                      return;
                    }
                    setCashOutTokenType(TokenType.HAK);
                    setCashOutAmount("0.00");
                    setWithdrawError("");
                    setWithdrawResult("");
                    setShowCashOutModal(true);
                  }}
                  className="text-xs font-medium text-white px-3 py-1 rounded-md"
                  style={{
                    background: "rgba(255, 255, 255, 0.2)",
                  }}
                >
                  {t("cash_out")}
                </button>
              </div>
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-white/80">USDT</p>
                  <p className="text-2xl font-bold text-white">
                    {truncateDecimals(Number(balance.USDT || 0))}
                  </p>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-white/80">HAK</p>
                  <p className="text-2xl font-bold text-white">
                    {truncateDecimals(Number(balance.HAK || 0))}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* My Benefits Section */}
          <div className="mb-8">
            <div
              className="p-5"
              style={{
                opacity: 0.78,
                borderRadius: "15px",
                backgroundImage: "linear-gradient(0deg, #e30e10 0%, #690a71 100%)",
              }}
            >
              {/* Section header */}
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-sm font-bold text-white">
                  {t("my_benefits")}
                </h2>
                <button
                  type="button"
                  onClick={() => {
                    setEarningsEntries([]);
                    setEarningsCursor(null);
                    setShowEarningsModal(true);
                    fetchEarningsEntries(null);
                  }}
                  className="text-xs font-medium text-white px-3 py-1 rounded-md"
                  style={{ background: "rgba(255, 255, 255, 0.2)" }}
                >
                  {t("details")}
                </button>
              </div>

              {/* Daily earnings */}
              <div className="flex items-center justify-between mb-5">
                <p className="text-xs text-white/80">{t("daily_earnings")}</p>
                <div className="flex items-center gap-4">
                  <span className="text-sm font-bold text-white">
                    {earningsSummary.usdt} USDT
                  </span>
                  <span className="text-sm font-bold text-white">
                    {earningsSummary.hak} HAK
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Quota Section */}
          <div className="mb-8">
            <div
              className="p-5"
              style={{
                opacity: 0.78,
                borderRadius: "15px",
                backgroundImage: "linear-gradient(0deg, #e30e10 0%, #690a71 100%)",
              }}
            >
              <h2 className="text-sm font-bold text-white mb-4">
                {t("my_quota")}
              </h2>
              <div className="grid grid-cols-3 gap-4">
                {quotaItems.map((item) => (
                  <div
                    key={item.key}
                    className="flex flex-col items-center gap-1"
                  >
                    <span className="text-xl font-bold text-white">
                      {item.value}
                    </span>
                    <span className="text-xs text-white/70 text-center">
                      {item.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* My Team Section */}
          <div className="mb-8">
            <div
              className="p-5"
              style={{
                opacity: 0.78,
                borderRadius: "15px",
                backgroundImage: "linear-gradient(0deg, #e30e10 0%, #690a71 100%)",
              }}
            >
              <h2 className="text-sm font-bold text-white mb-4">
                {t("my_team")}
              </h2>
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-white/70">{t("my_package")}</span>
                  <span className="text-sm font-bold text-white">
                    {userInfo?.equityType ?? t("unactivated")}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-white/70">{t("team_level")}</span>
                  <span className="text-sm font-bold text-white">
                    {userInfo?.teamLevel && userInfo.teamLevel !== "NONE"
                      ? userInfo.teamLevel
                      : "--"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-white/70">{t("referrer")}</span>
                  <span className="text-sm font-bold text-white">
                    {userInfo?.superior_referral_code ??
                      (userInfo?.superior && userInfo.superior.length > 12
                        ? `${userInfo.superior.slice(0, 6)}...${userInfo.superior.slice(-4)}`
                        : userInfo?.superior) ??
                      "--"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-white/70">{t("direct_count")}</span>
                  <span className="text-sm font-bold text-white">
                    {userInfo?.directCount ?? 0}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-white/70">{t("team_size")}</span>
                  <span className="text-sm font-bold text-white">
                    {userInfo?.teamSize ?? 0}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-white/70">{t("my_performance")}</span>
                  <span className="text-sm font-bold text-white">
                    {truncateDecimals(Number(userInfo?.performance ?? 0))} USDT
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Tips Section */}
          <div className="mb-8 p-6 rounded-xl" style={{ background: "rgba(0, 0, 0, 0.5)" }}>
            <h3 className="text-center text-sm font-semibold mb-3 text-white">
              {t("tips")}
            </h3>
            <p className="text-xs leading-relaxed" style={{ color: "white" }}>
              {t("tips_line1")}
            </p>
            <br />
            <p className="text-xs leading-relaxed" style={{ color: "white" }}>
              {t("tips_line2")}
            </p>
          </div>

          {/* Copied Notification Modal */}
          {showCopiedNotification && (
            <div className="fixed inset-0 flex items-center justify-center z-[60]">
              <div className="bg-[#1A1A1A] py-3 px-6 rounded-xl border border-[#0066CC] shadow-lg">
                <p className="text-[#50C8FF] text-center font-bold">
                  {t("copy_success")}
                </p>
              </div>
            </div>
          )}

          {/* Cash Out Modal */}
          
          {showCopiedNotification && (
            <div className="fixed inset-0 flex items-center justify-center z-[60]">
              <div className="bg-[#1A1A1A] py-3 px-6 rounded-xl border border-[#0066CC] shadow-lg">
                <p className="text-[#50C8FF] text-center font-bold">
                  {t("copy_success")}
                </p>
              </div>
            </div>
          )}

          {/* Cash Out Modal */}
          {showCashOutModal && (
            <div
              style={{
                background: "rgba(0, 0, 0, 0.95)",
              }}
              className="fixed inset-0  flex items-center justify-center z-50"
              onClick={(e) => {
                // Close if clicking outside the modal content
                if (e.target === e.currentTarget) {
                  setShowCashOutModal(false);
                }
              }}
            >
              <div
                style={{
                  background: "rgba(59, 130, 246, 0.4)",
                }}
                className="p-2 rounded-xl w-[95%] relative border-2 border-blue-500"
              >
                {/* Withdrawal Address Section */}
                <div className="text-center text-white font-bold mb-2 text-lg">
                  {t("withdrawal")}
                </div>
                <div className="mb-6">
                  <h3
                    className=" text-sm font-medium mb-2"
                    style={{ color: "rgba(255, 255, 255, 0.6)" }}
                  >
                    {t("destination")}
                  </h3>
                  <div
                    style={{ background: "rgba(255, 255, 255, 0.4)" }}
                    className=" rounded-lg p-3 text-sm break-all"
                  >
                    <span style={{ color: "rgba(255, 255, 255, 0.85)" }}>
                      {toAddress || address || "--"}
                    </span>
                  </div>
                  <p
                    className="text-xs mt-1"
                    style={{ color: "rgba(255, 255, 255, 0.6)" }}
                  >
                    {t("withdraw_self_only")}
                  </p>
                </div>

                {/* Transfer Amount Section */}
                <div className="mb-6">
                  <div className="flex justify-between items-center mb-2">
                    <h3
                      className=" text-sm font-medium"
                      style={{ color: "rgba(255, 255, 255, 0.6)" }}
                    >
                      {t("amount")}
                    </h3>
                    <div
                      className="flex items-center cursor-pointer"
                      onClick={() =>
                        setShowTokenTypeDropdown(!showTokenTypeDropdown)
                      }
                    >
                      <span className="mr-2 text-white">
                        {cashOutTokenType}
                      </span>
                      <svg
                        className="h-5 w-5 text-white"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path
                          fillRule="evenodd"
                          d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </div>
                  </div>

                  {/* Dropdown menu */}
                  {showTokenTypeDropdown && (
                    <div className="absolute z-10 right-10 mt-1 bg-black border border-blue-500/30 rounded-lg shadow-lg overflow-hidden w-36">
                      <div
                        className={`p-3 cursor-pointer hover:bg-blue-500/20 text-white ${cashOutTokenType === TokenType.USDT
                            ? "bg-blue-500/20"
                            : ""
                          }`}
                        onClick={() => {
                          setCashOutTokenType(TokenType.USDT);
                          setCashOutAmount("0.00");
                          setShowTokenTypeDropdown(false);
                        }}
                      >
                        USDT
                      </div>
                      <div
                        className={`p-3 cursor-pointer hover:bg-blue-500/20 text-white ${cashOutTokenType === TokenType.HAK
                            ? "bg-blue-500/20"
                            : ""
                          }`}
                        onClick={() => {
                          setCashOutTokenType(TokenType.HAK);
                          setCashOutAmount("0.00");
                          setShowTokenTypeDropdown(false);
                        }}
                      >
                        HAK
                      </div>
                    </div>
                  )}
                  <div
                    style={{ background: "rgba(255, 255, 255, 0.4)" }}
                    className="rounded-lg px-1 py-3"
                  >
                    <div
                      className="relative pb-2"
                      style={{
                        borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
                      }}
                    >
                      <input
                        value={cashOutAmount}
                        onChange={(e) => {
                          const value = e.target.value;
                          // 只允许输入数字和一个小数点
                          if (!/^\d*\.?\d*$/.test(value) && value !== "")
                            return;

                          const maxAmount = Number(currentBalance || 0);
                          if (value !== "") {
                            const numValue = parseFloat(value);
                            if (isNaN(numValue)) {
                              setCashOutAmount("");
                            } else if (numValue > maxAmount) {
                              setCashOutAmount(truncateDecimals(maxAmount));
                            } else {
                              // 限制小数点后最多2位
                              const parts = value.split(".");
                              if (parts[1] && parts[1].length > 2) {
                                setCashOutAmount(
                                  `${parts[0]}.${parts[1].slice(0, 2)}`
                                );
                              } else {
                                setCashOutAmount(value);
                              }
                            }
                          } else {
                            setCashOutAmount(value);
                          }
                        }}
                        placeholder="0.00"
                        className="w-full bg-transparent text-white outline-none text-left border-none focus:ring-0 h-8 text-2xl"
                      />
                      <button
                        onClick={() => {
                          const maxAmount = Number(currentBalance || 0);
                          if (maxAmount > 0) {
                            setCashOutAmount(truncateDecimalsStr(maxAmount));
                          }
                        }}
                        className="absolute right-2 top-[2px] rounded-[20px]  bg-[#60A5FA] text-[#050505] w-[52px] h-[28px] rounded-md text-sm"
                      >
                        {t("token_all")}
                      </button>
                    </div>
                    <div className="flex justify-between items-center mt-2 text-sm text-white px-2">
                      <span>{t("token_withdrawable")}</span>
                      <span>
                        {`${truncateDecimals(Number(currentBalance || 0))} ${currentAsset}`}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Fees Section - Only shown in cash out mode */}
                {transferMode === "cashout" && (
                  <div className="mb-6">
                    <h3
                      className="text-white text-sm font-medium mb-2"
                      style={{ color: "rgba(255, 255, 255, 0.6)" }}
                    >
                      {t("token_fees")}
                    </h3>
                    <div
                      style={{ background: "rgba(255, 255, 255, 0.4)" }}
                      className="rounded-lg p-1"
                    >
                      <div className="flex justify-between items-center">
                        <span
                          className="text-white text-sm"
                          style={{ color: "rgba(255, 255, 255, 0.6)" }}
                        >
                          {t("minimum_withdrawal")}
                        </span>
                        <span
                          className="text-white text-xs"
                          style={{ color: "rgba(255, 255, 255, 0.6)" }}
                        >
                          {`${minWithdrawAmount} ${currentAsset}`}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {withdrawError && (
                  <p className="text-red-500 mt-2">{withdrawError}</p>
                )}
                {withdrawResult && (
                  <p className="text-green-500 text-center mt-2">
                    {withdrawResult}
                  </p>
                )}

                {/* Buttons */}
                <div
                  className="flex flex-col justify-center items-center text-xs text-white"
                  style={{ color: "rgba(255, 255, 255, 0.6)" }}
                >
                  <span>{t("network_fee_note")}</span>
                  <span>{t("deposit_time_note")}</span>
                </div>
                <div className="flex w-full gap-4">
                  {/* <button
                    onClick={() => {
                      setShowCashOutModal(false);
                      setWithdrawResult("");
                      setWithdrawError("");
                    }}
                    className="flex-1 bg-gray-800 text-white py-3 px-4 rounded-lg font-medium hover:bg-gray-700 transition-colors"
                  >
                    {t("cancel")}
                  </button> */}
                  <button
                    onClick={async () => {
                      if (isWithdrawing) return;

                      const minAmount = minWithdrawAmount;

                      if (
                        parseFloat(cashOutAmount) < minAmount ||
                        parseFloat(cashOutAmount) <= 0
                      ) {
                        setWithdrawError(tErrors(ErrorCode.INVALID_AMOUNT));
                        return;
                      }
                      setWithdrawResult("");
                      setWithdrawError("");
                      setIsWithdrawing(true);
                      try {
                        // Handle cash out logic here
                        //setShowCashOutModal(false);
                        await handleWithdrawPoints();
                      } finally {
                        setCashOutAmount("0.00");
                        setIsWithdrawing(false);
                        setTimeout(() => {
                          setShowCashOutModal(false);
                          setWithdrawResult("");
                          setWithdrawError("");
                        }, 1000);
                      }
                    }}
                    className={`flex-1 text-black py-3 px-4 rounded-lg font-medium transition-colors mt-10 ${isWithdrawing ? "opacity-50 cursor-not-allowed" : ""
                      }`}
                    style={{
                      background:
                        "linear-gradient(270deg, #2563EB 0%, #60A5FA 100%)",
                    }}
                    disabled={isWithdrawing}
                  >
                    {t("confirm")}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Earnings Details Modal */}
          {showEarningsModal && (
            <div
              className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
              onClick={(e) => {
                if (e.target === e.currentTarget) setShowEarningsModal(false);
              }}
            >
              <div className="bg-black p-4 rounded-xl w-[95%] max-w-md border-2 border-blue-500 max-h-[80vh] flex flex-col">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-white">
                    {t("earnings_details")}
                  </h3>
                  <button
                    onClick={() => setShowEarningsModal(false)}
                    className="text-gray-400 hover:text-white"
                    aria-label="Close"
                  >
                    ✕
                  </button>
                </div>

                <div className="grid grid-cols-[1fr_80px_90px] gap-2 text-xs text-white/60 pb-2 border-b border-white/20">
                  <div>{t("time")}</div>
                  <div className="text-center">{t("type")}</div>
                  <div className="text-right">{t("amount")}</div>
                </div>

                <div className="flex-1 overflow-y-auto">
                  {earningsEntries.length === 0 && !earningsLoading && (
                    <p className="text-center text-xs text-white/60 py-6">
                      {t("no_data")}
                    </p>
                  )}
                  {earningsEntries.map((entry) => (
                    <div
                      key={entry.id}
                      className="grid grid-cols-[1fr_80px_90px] gap-2 py-2 text-xs text-white border-b border-white/10"
                    >
                      <div className="truncate">
                        {new Date(entry.createdAt).toLocaleString()}
                      </div>
                      <div className="text-center truncate" title={entry.bizType}>
                        {entry.bizType}
                      </div>
                      <div className="text-right">
                        {truncateDecimals(Number(entry.amount))} {entry.asset}
                      </div>
                    </div>
                  ))}
                  {earningsLoading && (
                    <p className="text-center text-xs text-white/60 py-3">
                      {t("loading")}
                    </p>
                  )}
                </div>

                {earningsCursor && !earningsLoading && (
                  <button
                    onClick={() => fetchEarningsEntries(earningsCursor)}
                    className="mt-3 text-xs text-white py-2 rounded-md"
                    style={{ background: "rgba(255, 255, 255, 0.2)" }}
                  >
                    {t("load_more")}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Recommender Modal */}
          {showRecommenderModal && (
            <div
              className="fixed inset-0 bg-black/80 flex items-center justify-center z-50"
              onClick={(e) => {
                // Close if clicking outside the modal content
                if (e.target === e.currentTarget) {
                  setShowRecommenderModal(false);
                }
              }}
            >
              <div
                className="bg-black p-2 rounded-xl w-[90%] max-w-md border-2 border-blue-500"
                style={{ boxShadow: "0 0 30px rgba(59, 130, 246, 0.6)" }}
              >
                <h3 className="text-lg font-bold mb-2 text-[#3B82F6] text-center">
                  {t("enter_invite_code")}
                </h3>

                <div className="flex flex-col gap-2">
                  <input
                    type="text"
                    value={superiorReferralCode || ""}
                    onChange={(e) => setSuperiorReferralCode(e.target.value)}
                    placeholder={t("please_enter_invite_code")}
                    className="w-full bg-gray-800 text-white rounded-lg p-3 text-center text-2xl font-bold "
                  />
                  <p className="text-red-500 text-sm mt-1 text-center">
                    {t("please_enter_invite_code")}
                  </p>

                  <div className="flex w-full gap-4">
                    <button
                      onClick={() => {
                        setShowRecommenderModal(false);
                        setSuperiorReferralCode("");
                        setRecommenderError(null);
                      }}
                      className="flex-1 bg-gray-800 text-white py-3 px-4 rounded-lg font-medium hover:bg-gray-700 transition-colors"
                    >
                      {t("cancel")}
                    </button>
                    <button
                      onClick={() => {
                        setShowRecommenderModal(false);
                        setShowRecommenderConfirmModal(true);
                      }}
                      style={{
                        background:
                          "linear-gradient(270deg, #2563EB 0%, #60A5FA 100%)",
                      }}
                      className="flex-1 text-black py-3 px-4 rounded-lg font-medium hover:bg-blue-600 transition-colors"
                    >
                      {t("ok")}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Recommender Confirm Modal */}
          <RecommenderModal
            isOpen={showRecommenderConfirmModal}
            onClose={() => setShowRecommenderConfirmModal(false)}
            initialReferralCode={superiorReferralCode}
          />

          {/* Flash Swap Modal */}
          {showFlashSwapModal && (
            <div
              className="fixed inset-0 bg-black/80 flex items-center justify-center z-50"
              onClick={(e) => {
                // Close if clicking outside the modal content
                if (e.target === e.currentTarget) {
                  setShowFlashSwapModal(false);
                }
              }}
            >
              <div
                className="bg-black p-6 rounded-xl w-[95%] relative border-2 border-blue-500"
                style={{
                  boxShadow: "0 0 30px rgba(59, 130, 246, 0.6)",
                }}
              >
                <div className="text-center text-white font-bold mb-2 text-lg">
                  {t("flash_swap")}
                </div>

                {/* TXT Input Section */}
                <div className="mb-6">
                  <h3
                    className=" text-sm font-medium mb-2"
                    style={{ color: "rgba(255, 255, 255, 0.6)" }}
                  >
                    {t("token_amount")}
                  </h3>
                  <div
                    style={{ background: "rgba(255, 255, 255, 0.4)" }}
                    className=" rounded-lg p-1"
                  >
                    <textarea
                      value={cashOutAmount}
                      onChange={(e) => {
                        const value = e.target.value;
                        // Only allow numbers and one decimal point
                        if (!/^\d*\.?\d*$/.test(value) && value !== "") return;

                        // Limit to 2 decimal places
                        const parts = value.split(".");
                        if (parts[1] && parts[1].length > 2) {
                          setCashOutAmount(
                            `${parts[0]}.${parts[1].slice(0, 2)}`
                          );
                        } else {
                          setCashOutAmount(value);
                        }

                        // Clear any previous errors when input changes
                        setWithdrawError("");
                      }}
                      placeholder="0.00"
                      className="w-full bg-transparent  outline-none border-none focus:ring-0 text-sm resize-none"
                      rows={1}
                      style={{
                        whiteSpace: "pre-wrap",
                        color: "rgba(255, 255, 255, 0.6)",
                      }}
                    />
                  </div>
                  <div className="flex justify-between items-center mt-2 text-sm text-white px-2">
                    <span>{t("token_withdrawable")}</span>
                    <span>
                      {userInfo
                        ? `${truncateDecimals(
                          Number(userInfo.token_points || 0)
                        )} TXT`
                        : "0.00 TXT"}
                    </span>
                  </div>
                </div>

                {/* USDT Output Section */}
                <div className="mb-6">
                  <h3
                    className=" text-sm font-medium mb-2"
                    style={{ color: "rgba(255, 255, 255, 0.6)" }}
                  >
                    {t("usdt_amount")}
                  </h3>
                  <div
                    style={{ background: "rgba(255, 255, 255, 0.4)" }}
                    className=" rounded-lg p-1"
                  >
                    <textarea
                      value={
                        parseFloat(cashOutAmount) > 0
                          ? truncateDecimals(
                            parseFloat(cashOutAmount) * tokenPrice
                          )
                          : "0.00"
                      }
                      readOnly
                      className="w-full bg-transparent  outline-none border-none focus:ring-0 text-sm resize-none"
                      rows={1}
                      style={{
                        whiteSpace: "pre-wrap",
                        color: "rgba(255, 255, 255, 0.6)",
                      }}
                    />
                  </div>
                  <div className="flex justify-between items-center mt-2 text-sm text-white px-2">
                    <span>{t("current_price")}</span>
                    <span>1 TXT = {truncateDecimals(tokenPrice)} USDT</span>
                  </div>
                </div>

                {withdrawError && (
                  <p className="text-red-500 mt-2">{withdrawError}</p>
                )}
                {withdrawResult && (
                  <p className="text-green-500 text-center mt-2">
                    {withdrawResult}
                  </p>
                )}

                {/* Buttons */}
                <div className="flex w-full gap-4">
                  <button
                    onClick={() => {
                      setShowFlashSwapModal(false);
                      setWithdrawResult("");
                      setWithdrawError("");
                      setCashOutAmount("0.00");
                    }}
                    className="flex-1 bg-gray-800 text-white py-3 px-4 rounded-lg font-medium hover:bg-gray-700 transition-colors"
                  >
                    {t("cancel")}
                  </button>
                  <button
                    onClick={handleFlashSwap}
                    className={`flex-1 text-white py-3 px-4 rounded-lg font-medium transition-colors ${isWithdrawing ? "opacity-50 cursor-not-allowed" : ""
                      }`}
                    style={{
                      background:
                        "linear-gradient(270deg, #2563EB 0%, #60A5FA 100%)",
                    }}
                    disabled={isWithdrawing}
                  >
                    {t("confirm")}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      {/* QR Code Modal */}
      {showQRModal && address && (
        <QRCodeModal
          isOpen={showQRModal}
          onClose={() => setShowQRModal(false)}
          publicKey={address?.toString()}
          userType={userInfo?.type}
        />
      )}
    </div>
  );
}

export default function MyPage() {
  return (
    <div className="min-h-screen bg-black text-white relative">
      <div 
        className="absolute inset-0 z-0 pointer-events-none bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url('/imgs/my/my.png')" }}
      />
      <div className="relative z-10">
        <style>{`
          @keyframes spin {
            from {
              transform: rotate(0deg);
            }
            to {
              transform: rotate(360deg);
            }
          }
        `}</style>
        <MyContent />
      </div>
    </div>
  );
}
