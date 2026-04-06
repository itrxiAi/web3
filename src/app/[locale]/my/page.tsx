//个人中心
"use client";

import React, { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import Link from "next/link";
import LoadingSpinner from "@/components/LoadingSpinner";
import { TokenType, TxFlowType, UserType } from "@prisma/client";
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
  superior_referral_code?: string;
  interest_active: boolean;
}

function MyContent() {
  const { address } = useAppKitAccount();
  const { signMessageAsync } = useSignMessage();
  const t = useTranslations("my");
  const tUserType = useTranslations("user_type");
  const tErrors = useTranslations("errors");
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
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
    TokenType.USDT
  );

  useEffect(() => {
    if (address) {
      setToAddress(address);
    }
  }, [address]);

  const roleTypes = [
    {
      type: UserType.COMMUNITY,
      label: tUserType("COMMUNITY"),
      icon: "/images/v2/my/COMMUNITY-node.png",
    },
    {
      type: UserType.COMMUNITY,
      label: tUserType("GALAXY"),
      icon: "/images/v2/my/GALAXY-node.png",
    },
    {
      type: UserType.COMMUNITY,
      label: tUserType("GROUP"),
      icon: "/images/v2/my/GROUP-node.png",
    },
    {
      type: UserType.NORMAL,
      label: tUserType("NORMAL"),
      icon: "/images/v2/my/NORMAL-node.png",
    }
  ];
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

  // Invitation link URL used for copy action
  const inviteUrl = address ? `www.harmony.Link${address}` : "";

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
          interest_active: data.interest_active,
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

  const withdrawPoints = async (
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

      const response = await fetch("/api/points/withdraw", {
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
        operationType:
          transferMode === "cashout" ? TxFlowType.WITHDRAW : TxFlowType.WITHDRAW,
        amount: points,
        tokenType: cashOutTokenType,
        walletAddress: address,
        description: toAddress,
        timestamp: Date.now(),
      };
      const hash = await generateOperationHash(info);
      const signature = await signMessageAsync({ message: hash });
      if (transferMode === "cashout") {
        await withdrawPoints(info, signature);
      } else {
        await transferPoints(info, signature);
      }
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

  // Benefits data for the grid
  const benefitsData = [
    {
      key: "activate_tier",
      label: t("activate_tier"),
      icon: "☆",
    },
    {
      key: "verifier_identity",
      label: t("verifier_identity"),
      icon: "◉",
    },
    {
      key: "trading_dividends",
      label: t("trading_dividends"),
      icon: "$",
    },
    {
      key: "team_level_t2",
      label: t("team_level_t2"),
      icon: "T2",
    },
    {
      key: "ad_revenue",
      label: t("ad_revenue"),
      icon: "◈",
    },
  ];

  function BenefitCircleIcon({ iconKey, label }: { iconKey: string; label: string }) {
    let iconSrc = "";
    if (iconKey === "activate_tier") iconSrc = "/imgs/my/1.png";
    else if (iconKey === "verifier_identity") iconSrc = "/imgs/my/2.png";
    else if (iconKey === "trading_dividends") iconSrc = "/imgs/my/3.png";
    else if (iconKey === "team_level_t2") iconSrc = "/imgs/my/4.png";
    else if (iconKey === "ad_revenue") iconSrc = "/imgs/my/5.png";

    return (
      <div className="flex flex-col items-center gap-2">
        <div
          style={{
            width: 56,
            height: 56,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {iconSrc && (
            <Image src={iconSrc} alt={label} width={26} height={26} className=" object-contain" />
          )}
        </div>
        <p className="text-xs text-white text-center leading-tight">{label}</p>
      </div>
    );
  }

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

              <div className="relative flex gap-6">
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
                      {userInfo?.type === UserType.COMMUNITY
                        ? (userInfo?.interest_active ? t("activated") : t("unactivated")) + "/"
                        : ""}
                      {roleTypes.find((item) => item.type === userInfo?.type)?.label || tUserType(UserType.NORMAL)}
                    </>
                  ) : ( 
                    "--"
                  )}
                </p>

                {/* Invite Link inline (copy only) */}
                <div className="flex items-center gap-1 min-w-0">
                  {/* <span
                    className="text-xs shrink-0"
                    style={{ color: "rgba(255, 255, 255, 0.6)" }}
                  >
                    {t("my_recommender")}：
                  </span> */}
                  {/* <span className="text-xs text-white truncate min-w-0 flex-1">
                    {address ? `www.harmony.Link${formatAddress(address)}` : "--"}
                  </span> */}
                  {/* <button
                    type="button"
                    onClick={() => {
                      if (!address) {
                        triggerWalletConnect();
                        return;
                      }
                      handleCopy();
                    }}
                    className="p-1 rounded shrink-0 ml-1"
                    aria-label="Copy invitation link"
                  
                  >
                  <Image
                  src="/imgs/my/copy.png"
                  alt="Logo"
                  width={20}
                  height={20}
                  className="object-contain"
                />
                  </button> */}
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
              <div className="flex items-center mb-5">

                <h2 className="text-sm font-bold text-white">
                  {t("my_benefits")}
                </h2>
              </div>

              {/* Row 1: 3 items */}
              <div className="flex justify-around mb-5">
                {benefitsData.slice(0, 3).map((benefit) => (
                  <BenefitCircleIcon key={benefit.key} iconKey={benefit.key} label={benefit.label} />
                ))}
              </div>

              {/* Row 2: 2 items centered */}
              <div className="flex justify-around mx-auto" style={{ width: "66%" }}>
                {benefitsData.slice(3).map((benefit) => (
                  <BenefitCircleIcon key={benefit.key} iconKey={benefit.key} label={benefit.label} />
                ))}
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
                    className=" rounded-lg p-1"
                  >
                    <textarea
                      value={toAddress}
                      onChange={(e) => setToAddress(e.target.value)}
                      placeholder="Enter wallet address"
                      className="w-full bg-transparent  outline-none border-none focus:ring-0 text-sm resize-none"
                      rows={2}
                      style={{
                        whiteSpace: "pre-wrap",
                        color: "rgba(255, 255, 255, 0.6)",
                      }}
                    />
                  </div>
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
                        TXT
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

                          const maxAmount =
                            transferMode === "internal"
                              ? cashOutTokenType === TokenType.USDT
                                ? userInfo?.usdt_points
                                : userInfo?.token_points
                              : cashOutTokenType === TokenType.USDT
                                ? userInfo?.usdt_points
                                : userInfo?.token_points;
                          if (maxAmount !== undefined && value !== "") {
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
                          if (!userInfo) return;
                          let maxAmount =
                            (cashOutTokenType === TokenType.USDT
                              ? userInfo?.usdt_points
                              : userInfo?.token_points) || 0;
                          if (transferMode === "internal") {
                            maxAmount =
                              (cashOutTokenType === TokenType.USDT
                                ? userInfo?.usdt_points
                                : userInfo?.token_points) || 0;
                          }
                          if (maxAmount !== undefined && maxAmount > 0) {
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
                        {transferMode === "cashout"
                          ? cashOutTokenType === TokenType.USDT
                            ? userInfo
                              ? `${truncateDecimals(
                                Number(userInfo.usdt_points || 0)
                              )} USDT`
                              : "0.00 USDT"
                            : userInfo
                              ? `${truncateDecimals(
                                Number(userInfo.token_points || 0)
                              )} TXT`
                              : "0.00 TXT"
                          : cashOutTokenType === TokenType.USDT
                            ? userInfo
                              ? `${truncateDecimals(
                                Number(userInfo.usdt_points || 0)
                              )} USDT`
                              : "0.00 USDT"
                            : userInfo
                              ? `${truncateDecimals(
                                Number(userInfo.token_points || 0)
                              )} TXT`
                              : "0.00 TXT"}
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
                          {cashOutTokenType === TokenType.HAK
                            ? `${minCashOutAmountToken} TXT(Fee: ~${withdrawTokenFeeRatio * 100
                            }%)`
                            : `${minCashOutAmountUsdt} USDT(Fee: ~${withdrawTokenFeeRatio * 100
                            }%)`}
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

                      let minAmount =
                        cashOutTokenType === TokenType.HAK
                          ? minCashOutAmountToken
                          : minCashOutAmountUsdt;
                      if (transferMode === "internal") {
                        minAmount = 0;
                      }

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
