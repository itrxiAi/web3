"use client";

import React, { Suspense, useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import { TokenType, TxFlowStatus, TxFlowType, UserType } from "@prisma/client";
import bs58 from "bs58";
import { formatTime, getYearLaterUnix } from "@/utils/dateUtils";
import LoadingSpinnerItem from "@/components/LoadingSpinnerItem";
import LoadingSpinner from "@/components/LoadingSpinner";
import { triggerWalletConnect } from "@/components/ui/wallet-ref";
//import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import { useAppKitAccount } from "@reown/appkit/react";

//import { PublicKey, Transaction } from '@solana/web3.js'
import { DEV_ENV, MEMO_PROGRAM_ID, TOKEN_DECIMAL } from "@/constants";
import { TransactionModal } from "@/components/TransactionModal";
import decimal from "decimal.js";
import { truncateDecimals } from "@/utils/common";
import { getBalance } from "@wagmi/core";
import { config } from "@/config/wagmi"; // Import wagmi config
import { useWriteContract } from "wagmi";

// Staking Record interface
interface StakingRecord {
  time: string;
  amount: number;
  duration: string;
  status: string;
}

// Stake data interface
interface StakeData {
  total: number;
  balance: number;
  ratio: number;
}

interface UserStakeInfo {
  balance: number;
  stakedBalance: number;
  performance: number;
  tokenRewardCap: number;
  records: StakingRecord[];
}

interface SubordinatePerformance {
  address: string;
  performance: number;
  amount: number;
  type: UserType | null;
  level: number;
}

interface Env {
  environment: string;
  hotWalletAddress: string;
  burningAddress: string;
  miningTokenMinimalThreshold: number;
}

interface UpgradeCondition {
  address: string;
  process: number;
  presentLevel: number;
  targetLevel: number;
  conditions: {
    stakeAmount: {
      present: number;
      target: number;
      achieved: boolean;
    };
    referrals: {
      present: number;
      target: number;
      achieved: boolean;
    };
  };
}

function powDecimal(amount: number): number {
  return new decimal(amount).mul(new decimal(10).pow(TOKEN_DECIMAL)).toNumber();
}

// StakingContent component
function StakingContent(): React.ReactElement {
  const { address } = useAppKitAccount();

  const t = useTranslations("stake");
  const tMy = useTranslations("my");
  const tNode = useTranslations("node");
  const tUserType = useTranslations("user_type");
  const tError = useTranslations("errors");
  const [stakingAmount, setStakingAmount] = useState("");
  const [userStakeInfo, setUserStakeInfo] = useState<UserStakeInfo | null>(
    null
  );
  const [stakeData, setStakeData] = useState<StakeData>({
    total: 0,
    balance: 0,
    ratio: 0.006,
  });
  const [txSignature, setTxSignature] = useState<string | null>(null);
  const [showTxModal, setShowTxModal] = useState(false);
  const [showTxErrorModal, setShowTxErrorModal] = useState(false);
  const [isStaking, setIsStaking] = useState(false);
  const [txErrorMessage, setTxErrorMessage] = useState<string | null>(null);
  const [showLiquidationModal, setShowLiquidationModal] = useState(false);

  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [env, setEnv] = useState<Env | null>(null);
  const [upgradeData, setUpgradeData] = useState<UpgradeCondition | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"personal" | "subordinates">(
    "personal"
  );
  const [subordinates, setSubordinates] = useState<SubordinatePerformance[]>(
    []
  );
  const [loadingSubordinates, setLoadingSubordinates] = useState(false);

  const encoder = new TextEncoder();

  // Check if amount meets minimum threshold requirement
  function validateMinimumThreshold(
    amount: number,
    minThreshold: number | undefined
  ): string | null {
    if (minThreshold && amount < minThreshold) {
      return tError("INVALID_AMOUNT");
    }
    return null;
  }

  const fetchStakingRecords = async () => {
    try {
      if (!address) {
        return;
      }

      const response = await fetch("/api/user/transactions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          address: address.toString(),
          status: [
            TxFlowStatus.PENDING,
            TxFlowStatus.CONFIRMED,
            TxFlowStatus.FAILED,
          ],
          flowTypeArr: [TxFlowType.DEPOSIT],
          take: 500, // Adjust based on your needs
        }),
      });

      const data = await response.json();
      if (data.data) {
        // Convert the data to match our StakingRecord interface
        const records = data.data.map((record: any) => ({
          time: new Date(record.created_at).toISOString(),
          amount: `${record.amount}`,
          status: record.status,
        }));
        return records;
      }
    } catch (error) {
      console.error("Error fetching staking records:", error);
      setError("Failed to fetch staking records");
    }
  };

  const fetchUserStakeInfo = async () => {
    try {
      if (!address) {
        setUserStakeInfo({
          balance: 0,
          tokenRewardCap: 0,
          performance: 0,
          stakedBalance: 0,
          records: [],
        });
        return;
      }

      // Get staked balance from API
      const response = await fetch(
        `/api/user/info?address=${address.toString()}`
      );
      const data = await response.json();
      const records = await fetchStakingRecords();
      console.log("API data:", data);

      // Get TXT token balance directly using getBalance from @wagmi/core
      let tokenBalance = 0;
      try {
        console.log("Fetching token balance for address:", address);

        // For ERC20 tokens in wagmi v3, we need to use readContract instead of getBalance
        const tokenAddress = "0xf43C9b40C9361b301019C98Fb535affB3ec6C673" as `0x${string}`;
        const { readContract } = await import("@wagmi/core");
        
        // First get the token decimals
        const decimals = await readContract(config, {
          address: tokenAddress,
          abi: [{ type: "function", name: "decimals", inputs: [], outputs: [{ type: "uint8" }], stateMutability: "view" }],
          functionName: "decimals",
        });
        
        // Then get the balance
        const balanceValue = await readContract(config, {
          address: tokenAddress,
          abi: [{ type: "function", name: "balanceOf", inputs: [{ type: "address" }], outputs: [{ type: "uint256" }], stateMutability: "view" }],
          functionName: "balanceOf",
          args: [address as `0x${string}`],
        });
        
        // Create a similar structure to what getBalance would return
        const balanceResult = {
          value: balanceValue,
          decimals: Number(decimals)
        };

        console.log("Token balance result:", balanceResult);
        // Convert bigint to string first, then to Decimal for proper division
        const balanceDecimal = new decimal(balanceResult.value.toString());
        const divisor = new decimal(10).pow(TOKEN_DECIMAL);
        tokenBalance = balanceDecimal.div(divisor).toNumber();
        console.log("Converted token balance:", tokenBalance);

        setUserStakeInfo({
          balance: tokenBalance,
          performance: data.performance,
          tokenRewardCap: data.stake_reward_cap,
          stakedBalance: data.token_staked_points,
          records: records,
        });
      } catch (err) {
        console.log("Token account may not exist yet:", err);
        // If token account doesn't exist, balance is 0
        setUserStakeInfo({
          balance: 0,
          performance: data.performance,
          tokenRewardCap: data.stake_reward_cap,
          stakedBalance: data.token_staked_points,
          records: records,
        });
      }
    } catch (error) {
      console.error("Error fetching user info:", error);
    }
  };

  const handleStake = async () => {
    try {
      setIsStaking(true);
      setError("");
      setSuccess("");
      if (!address) {
        triggerWalletConnect();
        setIsStaking(false);
        return;
      }
      const usdtNumeric = parseInt(stakingAmount);
      const price = await fetchTokenPrice();
      const points = new decimal(usdtNumeric).div(new decimal(price)).toNumber();
      if (isNaN(points) || points <= 0) {
        setError(tError("INVALID_AMOUNT"));
        setIsStaking(false);
        return;
      }

      // Check if amount meets minimum threshold
      const thresholdError = validateMinimumThreshold(
        usdtNumeric,
        env?.miningTokenMinimalThreshold
      );
      if (thresholdError) {
        setError(thresholdError);
        setIsStaking(false);
        return;
      }

      let txSig = "";
      if (env?.environment === DEV_ENV) {
        console.warn("Using mock transaction hash in development mode");
        // Generate a random base58 string of correct length for Solana tx hash
        const randomBytes = new Uint8Array(32);
        crypto.getRandomValues(randomBytes);
        txSig = bs58.encode(randomBytes);
      } else {
        txSig = await transferTokens(points, TokenType.HAK);
      }

      console.log("Staking transaction signature:", txSig);

      // Show transaction signature in modal
      setTxSignature(txSig ?? null);
      setShowTxModal(true);

      // Call points/community endpoint with transaction signature
      const response = await fetch("/api/points/mining", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          txHash: txSig,
          dev_address: address.toString(),
          dev_amount: points,
          tokenType: TokenType.HAK,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to verify transaction");
      }
      setSuccess("Staked successfully");
    } catch (err) {
      setTxErrorMessage(
        err instanceof Error ? err.message : "Failed to verify transaction"
      );
      setShowTxErrorModal(true);
    } finally {
      setIsStaking(false);
    }
  };

  const burn = async (info: { amount: number }) => {
    console.log(
      `amount: ${info.amount}, powed amount:${powDecimal(info.amount)}`
    );
    if (!address) {
      console.error("Please connect your wallet first");
      return "";
    }

    //const tokenMint = new PublicKey(process.env.NEXT_PUBLIC_TOKEN_ADDRESS!);

    // const burnATA = await getAssociatedTokenAddress(
    //   tokenMint,
    //   address
    // )

    // const instruction = createBurnInstruction(
    //   burnATA,
    //   tokenMint,
    //   address,
    //   powDecimal(info.amount)
    // );

    // const transaction = new Transaction().add(instruction);
    // const blockhash = await connection.getLatestBlockhash();
    // transaction.feePayer = publicKey;
    // transaction.recentBlockhash = blockhash.blockhash;
    // const signature = await sendTransaction(transaction, connection);
    //return signature;
    return "";
  };

  const fetchEnv = async () => {
    try {
      // Check if we already have node data
      if (env) return;

      const response = await fetch("/api/info/env", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });
      const data = await response.json();
      setEnv(data);
    } catch (error) {
      console.error("Error fetching node data:", error);
    }
  };

  // const fetchTotalStaking = async () => {
  //   try {
  //     const response = await fetch('/api/staking/total');
  //     const data = await response.json();
  //     if (data.data) {
  //       setStakeData(prev => ({
  //         ...prev,
  //         total: data.data.total
  //       }));
  //     }
  //   } catch (error) {
  //     console.error('Error fetching total staking:', error);
  //   }
  // };

  const fetchUpgradeCondition = async () => {
    if (!address) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const response = await fetch("/api/user/upgrade-condition", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          address: address.toString(),
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to fetch upgrade condition");
      }

      const result = await response.json();
      setUpgradeData(result.data);
    } catch (err) {
      console.error("Error fetching upgrade condition:", err);
    } finally {
      setLoading(false);
    }
  };

  // Format number for display
  const formatNumber = (num: number) => {
    if (num >= 1000) {
      return `${(num / 1000).toFixed(0)}K`;
    }
    return num.toString();
  };

  // Calculate progress percentage
  const progressPercentage = upgradeData
    ? Math.min(Math.round(upgradeData.process * 100), 100)
    : 0;

  useEffect(() => {
    if (address) {
      fetchUserStakeInfo();
      fetchEnv();
      fetchUpgradeCondition();
    }
  }, [address]);

  const fetchSubordinatesPerformance = async () => {
    if (!address) return;

    try {
      setLoadingSubordinates(true);
      const response = await fetch("/api/user/subordinates", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          walletAddress: address.toString(),
          isDirect: true,
        }),
      });

      const result = await response.json();

      if (result.data) {
        const formattedData: SubordinatePerformance[] = result.data.map(
          (sub: any) => ({
            address: sub.address,
            performance: sub.balance?.performance || 0,
            amount: sub.balance?.token_staked_points || 0,
            type: sub.type,
            level: sub.level,
          })
        );

        setSubordinates(formattedData);
      }
    } catch (error) {
      console.error("Error fetching subordinates:", error);
      setError("Failed to fetch subordinates data");
    } finally {
      setLoadingSubordinates(false);
    }
  };

  useEffect(() => {
    if (activeTab === "subordinates" && address) {
      fetchSubordinatesPerformance();
    }
  }, [activeTab, address]);

  // Mock data for staking records

  // State for liquidation modal
  const [usdtAmount, setUsdtAmount] = useState("0.00");
  const [tokenAmount, setTokenAmount] = useState("0.00");
  const [tokenPrice, setTokenPrice] = useState(0);
  const [isLoadingPrice, setIsLoadingPrice] = useState(false);

  // Fetch TXT price from API
  const fetchTokenPrice = async () => {
    try {
      setIsLoadingPrice(true);
      const response = await fetch("/api/info/token-price");
      const data = await response.json();
      if (data.success && data.data.tokenPrice) {
        setTokenPrice(parseFloat(data.data.tokenPrice));
        return parseFloat(data.data.tokenPrice);
      } else {
        throw new Error("Failed to fetch token price");
      }
    } catch (error) {
      console.error("Error fetching token price:", error);
      return 0;
    } finally {
      setIsLoadingPrice(false);
    }
  };

  const { writeContractAsync, isPending: isWritePending } = useWriteContract();

  const tokenAbi = [
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

  const transferTokens = async (
    amount: number,
    tokenType: TokenType
  ): Promise<string> => {
    if (!address) {
      setError("Wallet not connected");
      throw new Error("Wallet not connected");
    }

    if (!amount) {
      setError("Amount should not be empty")
      throw new Error("Amount should not be empty")
    }

    try {
      setError("");

      // Check if hot wallet address is set
      if (!env?.burningAddress) {
        throw new Error("Hot wallet address environment variable is not set");
      }

      // Convert amount to proper decimals
      // Since the API now returns price_transfer as a string without scientific notation,
      // we can safely convert it to BigInt
      const decimals =
        tokenType === TokenType.USDT
          ? Number(process.env.NEXT_PUBLIC_USDT_DECIMAL)
          : Number(process.env.NEXT_PUBLIC_TOKEN_DECIMAL);
      const amountInWei = BigInt(amount * Math.pow(10, decimals));

      setIsStaking(true);
      // Get the USDT contract address from environment variables
      const tokenAddress = tokenType === TokenType.USDT ? process.env.NEXT_PUBLIC_USDT_ADDRESS : process.env.NEXT_PUBLIC_TOKEN_ADDRESS;
      const targetAddress = tokenType === TokenType.USDT ? env.hotWalletAddress : env.burningAddress;
      if (!tokenAddress) {
        throw new Error(
          `${tokenType} contract address not found in environment variables`
        );
      }

      // Use wagmi's writeContractAsync function to send the transaction
      // In wagmi v2, we need to use the async version to get the hash
      const hash = await writeContractAsync({
        address: tokenAddress as `0x${string}`,
        abi: tokenAbi,
        functionName: "transfer",
        args: [targetAddress as `0x${string}`, amountInWei],
      });

      // If hash is undefined, throw an error
      if (!hash) {
        throw new Error("Transaction failed to return a hash");
      }

      const tx = { hash };

      // Set transaction signature and show modal
      setTxSignature(tx.hash);
      setShowTxModal(true);

      return tx.hash;
    } catch (error) {
      console.error("Error sending transaction:", error);
      setError("Failed to send transaction. Please try again.");
      throw error;
    } finally {
      setIsStaking(false);
    }
  };

  // Calculate USDT amount based on token amount and price
  const calculateUsdtAmount = (tokenValue: string, price: number) => {
    if (!price) return "0";
    // if tokenValue is empty, return 0
    if (!tokenValue) return "0";
    try {
      const tokenNumeric = new decimal(tokenValue.replace(/,/g, ""));
      if (tokenNumeric.isNaN()) return "0";
      const priceDecimal = new decimal(price);
      const usdtValue = tokenNumeric.times(priceDecimal);
      return usdtValue.toFixed(2);
    } catch (error) {
      console.error("Error calculating USDT amount:", error);
      return "0";
    }
  };

  // Handle token amount change
  const handleTokenAmountChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const value = e.target.value;

    // Only allow numbers with at most 2 decimal places
    if (value === "" || /^\d*(\.\d{0,2})?$/.test(value)) {
      setTokenAmount(value);

      // Clear any error when input changes
      setError("");

      // Get current price if we don't have it yet
      let currentPrice = tokenPrice;
      if (!currentPrice) {
        currentPrice = await fetchTokenPrice();
      }

      // Calculate USDT amount
      const newUsdtAmount = calculateUsdtAmount(value, currentPrice);
      setUsdtAmount(newUsdtAmount);
    }
  };

  // Parse numeric values for the flash swap
  const parseNumericValues = () => {
    const usdtNumeric = parseFloat(usdtAmount);
    if (isNaN(usdtNumeric)) {
      throw new Error("Invalid USDT amount");
    }

    const tokenNumeric = parseFloat(tokenAmount);
    if (isNaN(tokenNumeric)) {
      throw new Error("Invalid Token amount");
    }

    return { usdtNumeric, tokenNumeric };
  };

  // Effect to fetch price and clear error when modal opens
  // useEffect(() => {
  //   if (showLiquidationModal) {
  //     if (!tokenPrice) {
  //       fetchTokenPrice();
  //     }
  //     // Clear any previous error when modal opens
  //     setError("");
  //   }
  // }, [showLiquidationModal, tokenPrice]);

  // Handle flash swap function
  const handleUsdtStake = async () => {
    if (!address) {
      triggerWalletConnect();
      return;
    }

    // Check if amount meets minimum threshold
    const thresholdError = validateMinimumThreshold(parseFloat(stakingAmount), env?.miningTokenMinimalThreshold);
    if (thresholdError) {
      setError(thresholdError);
      return;
    }

    try {
      setIsStaking(true);
      setError("");
      // Get the parsed numeric values
      //const { usdtNumeric, tokenNumeric } = parseNumericValues();

      const usdtNumeric = parseInt(stakingAmount);

      if (isNaN(usdtNumeric) || usdtNumeric <= 0) {
        setError(tError("INVALID_AMOUNT"));
        setIsStaking(false);
        return;
      }

      // Convert USDT to the correct decimal format (assuming 6 decimals for USDT)
      //const usdtDecimal = Math.floor(usdtNumeric * 1000000); // 6 decimal places for USDT

      // Execute the token transfer
      let txSig;
      if (env?.environment === DEV_ENV) {
        console.warn("Using mock transaction hash in development mode");
        // Generate a random base58 string of correct length for Solana tx hash
        const randomBytes = new Uint8Array(32);
        crypto.getRandomValues(randomBytes);
        txSig = bs58.encode(randomBytes);
      } else {
        txSig = await transferTokens(usdtNumeric, TokenType.USDT);

      }

      // Call points/community endpoint with transaction signature
      const response = await fetch("/api/points/mining", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          txHash: txSig,
          dev_address: address.toString(),
          dev_amount: usdtNumeric,
          tokenType: TokenType.USDT,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to verify transaction");
      }
      setSuccess("Staked successfully");

      // Set transaction signature for modal
      setTxSignature(txSig);
      setShowLiquidationModal(false);
      setShowTxModal(true);
    } catch (error) {
      console.error("Flash swap error:", error);
      setTxErrorMessage(
        error instanceof Error ? error.message : "Failed to execute flash swap"
      );
      setShowTxErrorModal(true);
    } finally {
      setIsStaking(false);
    }
  };

  return (
    <>
      {/* Liquidation Modal */}
      {showLiquidationModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-80"
          onClick={() => setShowLiquidationModal(false)}
        >
          <div
            className="bg-black rounded-xl w-[90%] max-w-md overflow-hidden border-2 border-blue-500"
            style={{
              boxShadow: "0 0 30px rgba(59, 130, 246, 0.6)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="">
              {/* Modal Header */}
              {/* <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-white">
                  {t("one_click_destroy")}
                </h3>
                <button
                  onClick={() => setShowLiquidationModal(false)}
                  className="text-gray-400 hover:text-white"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-6 w-6"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div> */}

              {/* Token List */}
              <div className=" p-2">
                {/* USDT Token */}
                <div
                  style={{
                    borderRadius: "10px",
                    background: "rgba(255, 255, 255, 0.24)",
                  }}
                  className="py-1 px-4 flex justify-between items-center"
                >
                  <div className="flex items-center">
                    <div className="w-8 h-8 mr-2">
                      <Image
                        src="/images/tokens/usdt.svg"
                        alt="USDT"
                        width={28}
                        height={28}
                      />
                    </div>
                    <span className="text-white font-bold">USDT</span>
                  </div>
                  <div className="text-right w-1/2">
                    {isLoadingPrice ? (
                      <div className="text-white font-bold flex justify-end">
                        <LoadingSpinnerItem />
                      </div>
                    ) : (
                      <div className="text-white font-bold">{usdtAmount}</div>
                    )}
                    <div className="text-white" style={{ fontSize: "12px" }}>
                      $USDT
                    </div>
                  </div>
                </div>
                <div className="flex justify-center -my-3">
                  <div className="w-7 h-7 bg-[#3B82F6] rounded-full flex justify-center items-center">
                    <Image
                      src="/images/earning/arrow-down.png"
                      alt=""
                      width={12}
                      height={8}
                    />
                  </div>
                </div>
                {/* TXT Token */}
                <div
                  style={{
                    borderRadius: "10px",
                    background: "rgba(255, 255, 255, 0.24)",
                  }}
                  className=" py-1 px-4 rounded-lg flex justify-between items-center"
                >
                  <div className="flex items-center">
                    <div className="w-8 h-8 mr-2">
                      <Image
                        src="/images/v2/other/ait.png"
                        alt="TXT"
                        width={26}
                        height={28}
                      />
                    </div>
                    <span className="text-white font-bold">TXT</span>
                  </div>
                  <div className="text-right w-1/2">
                    <input
                      type="text"
                      className="p-0 w-full text-right bg-transparent text-white font-bold focus:outline-none focus:ring-0 border-none"
                      value={tokenAmount}
                      onChange={handleTokenAmountChange}
                      style={{ boxShadow: "none" }}
                      inputMode="decimal"
                    />
                    <div className="text-white " style={{ fontSize: "12px" }}>
                      {t("real_time_price")}
                    </div>
                  </div>
                </div>
                {/* Minimum amount tip */}
                {/* <div className="mt-2 text-xs text-gray-400 flex items-center">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4 mr-1"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  {t("minimum")}: {env?.miningTokenMinimalThreshold} TXT
                </div> */}
              </div>

              {/* Error Message */}
              {error && (
                <div className="mb-4 text-center text-red-500 text-sm">
                  {error}
                </div>
              )}

              {/* Liquidate Button */}
              <div className="p-2">
                <button
                  className={`w-full py-4 text-center text-lg text-black font-bold rounded-lg
                ${isStaking
                      ? "bg-gray-400 cursor-not-allowed text-gray-700" // styles when disabled
                      : "cursor-pointer" // styles when enabled
                    }`}
                  style={{
                    background:
                      "linear-gradient(270deg, #2563EB 0%, #60A5FA 100%)",
                    borderRadius: "10px",
                  }}
                  onClick={handleUsdtStake}
                  disabled={isStaking}
                >
                  {t("one_click_destroy")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Transaction Modal */}
      {showTxModal && (
        <TransactionModal
          isOpen={showTxModal}
          onClose={() => setShowTxModal(false)}
          type="success"
          txSignature={txSignature}
          message="success"
        />
      )}

      {/* Error Modal */}
      {showTxErrorModal && (
        <TransactionModal
          isOpen={showTxErrorModal}
          onClose={() => setShowTxErrorModal(false)}
          type="error"
          message={txErrorMessage || t("stake_error")}
        />
      )}

      <div className="flex flex-col min-h-screen h-full bg-black text-white">
        {/* Main content area with bottom padding for nav */}
        <div className="flex-1 pb-16 pt-28 bg-black">
          <div className="p-4">
            <div className="flex items-center mb-2">
              <div className="w-1 h-4 bg-[#3B82F6] mr-2 rounded-sm" />
              <h1 className="text-lg font-bold">{t("dip")}</h1>
            </div>
            {/* Community Level Card */}
            <div
              className=" rounded-lg mb-2 bg-black"
              style={{
                border: "1px solid #3B82F6",
              }}
            >
              <div className="p-4 ">
                <div className="flex items-center mb-2">
                  <h2 className="text-sm  text-white">
                    {t("community_level")}:
                  </h2>
                  <div className="flex items-center ml-2">
                    <Image
                      src={`/images/badges/v${upgradeData?.presentLevel || 0
                        }.svg`}
                      alt="Community Badge"
                      width={18}
                      height={18}
                      className="mr-1"
                    />
                    <span className="font-bold text-sm">
                      L{upgradeData?.presentLevel || 0}
                    </span>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="relative">
                  <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${progressPercentage}%`,
                        background:
                          "linear-gradient(270deg, #2563EB 0%, #60A5FA 100%)",
                      }}
                    ></div>
                  </div>
                  <div className="flex justify-between mb-2 mt-1">
                    <div className="flex items-center">
                      <Image
                        src={`/images/badges/v${upgradeData?.presentLevel || 0
                          }.svg`}
                        alt="Current Level"
                        width={18}
                        height={18}
                        className="mr-1"
                      />
                      <span className="text-sm">
                        L{upgradeData?.presentLevel || 0}
                      </span>
                    </div>
                    <div className="flex items-center">
                      <Image
                        src="/images/earning/arrow.png"
                        alt=""
                        width={20}
                        height={13}
                      />
                      {/* <span className="mr-1">{">>>"}</span> */}
                    </div>
                    <div className="flex items-center">
                      <Image
                        src={`/images/badges/v${upgradeData?.targetLevel || 0
                          }.svg`}
                        alt="Target Level"
                        width={18}
                        height={18}
                        className="mr-1"
                      />
                      <span className="text-sm">
                        L{upgradeData?.targetLevel || 0}
                      </span>
                    </div>
                  </div>
                  <div
                    className="mt-2 "
                    style={{
                      color: "rgba(255, 255, 255, 0.6)",
                      fontSize: "10px",
                    }}
                  >
                    {!upgradeData?.conditions.stakeAmount.achieved
                      ? `${tMy(
                        "community_page.need_more_stake"
                      )} ${truncateDecimals(
                        (upgradeData?.conditions.stakeAmount.target || 0) -
                        (upgradeData?.conditions.stakeAmount.present || 0)
                      )} TXT`
                      : `${tMy("community_page.ready_to_upgrade")}`}
                  </div>
                  {/* <div className="mt-1 text-sm flex items-center">
                  <Image 
                    src={`/images/badges/v${(upgradeData?.targetLevel || 0)}.svg`} 
                    alt="Target Level" 
                    width={16} 
                    height={16}
                    className="mr-1"
                  />
                  <span className="text-gray-300">{t("v_privileges", { level: upgradeData?.targetLevel || 0 })}</span>
                </div> */}
                </div>
              </div>

              {/* Stats */}
              <div
                className=""
                style={{
                  borderTop: "1px solid rgba(59, 130, 246, 0.3)",
                }}
              >
                <div
                  className="flex justify-between items-center py-2 px-4"
                  style={{
                    borderBottom: "1px solid rgba(59, 130, 246, 0.3)",
                  }}
                >
                  <span className="text-white text-sm">
                    {tMy("community_page.minor_zone_stake")}
                  </span>
                  <div className="font-bold flex items-center gap-1">
                    <span>
                      {truncateDecimals(
                        upgradeData?.conditions?.stakeAmount?.present || 0
                      )}{" "}
                    </span>
                    <div className=" w-3 h-3 flex justify-center items-center rounded-full bg-[#3B82F6]">
                      <Image
                        src="/images/v2/my/usdt.png"
                        alt=""
                        width={13}
                        height={14}
                      />
                    </div>
                    <span className="text-[#3B82F6] text-sm">USDT</span>
                  </div>
                </div>
                <div
                  className="flex justify-between items-center py-2 px-4"
                  style={{
                    borderBottom: "1px solid rgba(59, 130, 246, 0.3)",
                  }}
                >
                  <span className="text-white text-sm">
                    {tMy("community_page.performance")}
                  </span>
                  <div className="font-bold flex items-center gap-1">
                    <span>
                      {truncateDecimals(
                        userStakeInfo?.performance || 0
                      )}{" "}
                    </span>
                    <div className=" w-3 h-3 flex justify-center items-center rounded-full bg-[#3B82F6]">
                      <Image
                        src="/images/v2/my/usdt.png"
                        alt=""
                        width={13}
                        height={14}
                      />
                    </div>
                    <span className="text-[#3B82F6] text-sm">USDT</span>
                  </div>
                </div>
                <div
                  className="flex justify-between items-center py-2 px-4"
                  style={{
                    borderBottom: "1px solid rgba(59, 130, 246, 0.3)",
                  }}
                >
                  <span className="text-white text-sm">
                    {tMy("community_page.personal_stake")}
                  </span>
                  <div className="font-bold flex items-center gap-1">
                    <span>
                      {truncateDecimals(userStakeInfo?.stakedBalance || 0)}
                    </span>
                    <div className=" w-3 h-3 flex justify-center items-center rounded-full bg-[#3B82F6]">
                      <Image
                        src="/images/v2/my/usdt.png"
                        alt=""
                        width={13}
                        height={14}
                      />
                    </div>
                    <span className="text-[#3B82F6] text-sm">USDT</span>
                  </div>
                </div>
                <div className="flex justify-between items-center py-2 px-4">
                  <span className="text-white text-sm">
                    {tMy("community_page.reward_cap")}
                  </span>
                  <div className="font-bold flex items-center gap-1">
                    <span>
                      {truncateDecimals(userStakeInfo?.tokenRewardCap || 0)}
                    </span>
                    <div className=" w-3 h-3 flex justify-center items-center rounded-full bg-[#3B82F6]">
                      <Image
                        src="/images/v2/my/usdt.png"
                        alt=""
                        width={13}
                        height={14}
                      />
                    </div>
                    <span className="text-[#3B82F6] text-sm">USDT</span>
                  </div>
                </div>
                {/* <div className="flex justify-between items-center py-2 border-t border-purple-800">
                  <span className="text-gray-300">{t("total_produced")}</span>
                  <span className="font-bold">{formatNumber(122)} TXT</span>
                </div> */}
              </div>
            </div>

            {/* Staking Mining Header */}
            {/* <div className="flex items-center mb-4">
              <div className="w-1 h-6 bg-gradient-to-b from-purple-600 to-purple-200 mr-2" />
              <h1 className="text-xl font-bold">{t("staking_mining")}</h1>
            </div> */}

            {/* Staked Amount Card */}
            {/* <div className="mb-6 rounded-xl overflow-hidden relative">
              <div className="absolute inset-0 bg-gradient-to-b from-purple-900 to-purple-400"></div>
              <div className="absolute -inset-8">
                <Image
                  src="/images/staked-bg.svg"
                  alt="Staked Background"
                  fill
                  className="object-cover"
                />
              </div>
              <div className="absolute inset-0 opacity-20">
                <div className="absolute top-10 left-1/4 w-40 h-20 bg-purple-400 rounded-full blur-xl transform rotate-45"></div>
                <div className="absolute bottom-5 right-1/4 w-40 h-20 bg-blue-500 rounded-full blur-xl"></div>
              </div>
              <div className="p-6 relative z-10 text-center">
                {userStakeInfo ? (
                  <h2 className="text-2xl font-bold mb-2">
                    {truncateDecimals(userStakeInfo.stakedBalance)} TXT
                  </h2>
                ) : (
                  <div className="flex justify-center mb-2">
                    <LoadingSpinnerItem />
                  </div>
                )}
                <p className="text-16px text-gray-200">{t('staked')}</p>
              </div>
            </div> */}

            {/* Staking Form */}
            <div className="mb-2">
              {/* Staking Amount */}
              <div
                className="mb-2 rounded-lg overflow-hidden  bg-black"
                style={{
                  border: "1px solid #3B82F6",
                }}
              >
                <div className="p-4">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400 whitespace-nowrap text-14px">
                      {t("staking_amount")}
                    </span>
                    <div className="flex items-center justify-end w-full">
                      <div className="relative">
                        <input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          value={stakingAmount}
                          onChange={(e) => {
                            // Only allow numeric input
                            if (/^\d*$/.test(e.target.value)) {
                              setStakingAmount(e.target.value);
                            }
                          }}
                          className="text-xl font-bold bg-transparent border-0 outline-none text-right w-full p-0 m-0 focus:outline-none focus:ring-0 focus:border-0"
                          placeholder="0"
                          style={{
                            WebkitAppearance: "none",
                            MozAppearance: "textfield",
                            appearance: "none",
                            boxShadow: "none",
                          }}
                        />
                      </div>
                      <span className="text-14px font-bold ml-1">USDT</span>
                    </div>
                  </div>
                  {/* Minimum amount tip */}
                  {/* <div className="mt-2 text-xs text-gray-400 flex items-center">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-4 w-4 mr-1"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    {t("minimum")}: {env?.miningTokenMinimalThreshold} TXT
                  </div> */}
                </div>
              </div>

              {/* Duration */}

              {/* Daily Yield */}
              {/* <div className="mb-2">
                <div className="flex justify-between items-center px-2">
                  <span className="text-gray-400 text-sm">
                    {t("daily_yield")}
                  </span>
                  <span className="text-sm">{stakeData?.ratio * 100}%</span>
                </div>
              </div> */}

              {/* Balance */}
              <div className="mb-2">
                <div className="flex justify-between items-center px-2">
                  <span className="text-gray-400 text-sm">{t("balance")}</span>
                  <span className=" text-sm">
                    {truncateDecimals(userStakeInfo?.balance ?? 0)} TXT
                  </span>
                </div>
              </div>

              {/* Error Message */}
              {error && (
                <div className="mb-4 text-center text-red-500 text-sm">
                  {error}
                </div>
              )}

              {/* Confirm Stake Button */}
              {/* <button
                className="w-full py-4 text-center text-lg text-[#17191F] font-bold rounded-xl bg-gradient-to-r from-purple-600 to-[#FAC8E4]"
                onClick={handleStake}
              >
                {t('confirm_stake')}
              </button> */}
              <div className="flex space-x-2">
                <button
                  className={`w-full py-4 text-center text-lg text-black font-bold 
                  ${isStaking
                      ? "bg-gray-400 cursor-not-allowed text-gray-700" // styles when disabled
                      : "cursor-pointer" // styles when enabled
                    }`}
                  style={{
                    background:
                      "linear-gradient(270deg, #2563EB 0%, #60A5FA 100%)",
                    borderRadius: "10px",
                  }}
                  disabled={isStaking}
                  onClick={handleUsdtStake}
                >
                  {t("confirm_stake")}
                </button>
                <button
                  className={`w-full py-4 text-center text-lg text-black font-bold rounded-xl 
                  ${true//isStaking
                      ? "bg-gray-400 cursor-not-allowed text-gray-700" // styles when disabled
                      : "cursor-pointer" // styles when enabled
                    }`}
                  style={{
                    background:
                      "linear-gradient(270deg, #2563EB 0%, #60A5FA 100%)",
                    borderRadius: "10px",
                  }}
                  onClick={handleStake}
                  disabled={true/* isStaking */}
                >
                  {t("one_click_destroy")}
                </button>
              </div>
            </div>

            {/* Staking Records */}
            <div className="mt-4">
              <div className="flex items-center mb-2">
                <div className="w-1 h-4 bg-[#3B82F6] mr-2 rounded-sm" />
                <h2 className="text-xl font-bold">{t("staking_records")}</h2>
              </div>

              {/* Tab Navigation */}
              <div
                className="flex mb-2"
                style={{
                  background: "rgba(255, 255, 255, 0.29)",
                  height: "34px",
                  borderRadius: "4px",
                }}
              >
                <button
                  className={`flex-1 px-4 py-2 mr-4 text-sm  ${activeTab === "personal"
                    ? "text-black font-bold"
                    : "text-white"
                    }`}
                  style={{
                    background:
                      activeTab === "personal"
                        ? "linear-gradient(270deg, #2563EB 0%, #60A5FA 100%)"
                        : "",
                    borderRadius: "4px",
                  }}
                  onClick={() => setActiveTab("personal")}
                >
                  {t("personal_records")}
                </button>
                <button
                  className={`flex-1 px-4 py-2 text-sm font-medium ${activeTab === "subordinates"
                    ? "text-black font-bold"
                    : "text-white"
                    }`}
                  style={{
                    background:
                      activeTab === "subordinates"
                        ? "linear-gradient(270deg, #2563EB 0%, #60A5FA 100%)"
                        : "",
                    borderRadius: "4px",
                  }}
                  onClick={() => setActiveTab("subordinates")}
                >
                  {t("subordinates_performance")}
                </button>
              </div>

              {/* Personal Records Table */}
              {activeTab === "personal" && (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left text-[#3B82F6] text-xs">
                        <th className="pb-1.5">{t("time")}</th>
                        <th
                          className={`pb-1.5 ${userStakeInfo?.records &&
                            userStakeInfo?.records?.length > 0
                            ? "text-left"
                            : "text-center"
                            }`}
                        >
                          {t("amount")}
                        </th>
                        <th className="pb-1.5 text-right">{t("status")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {/* userStakeInfo?.records */}
                      {userStakeInfo?.records.map((record, index) => (
                        <tr key={index} className=" text-xs">
                          <td className="py-2">
                            {formatTime(new Date(record.time))}
                          </td>
                          <td className="py-2">
                            {truncateDecimals(record.amount)} TXT
                          </td>
                          <td className="py-2 text-right ">
                            <span
                              className={`${record.status === TxFlowStatus.PENDING
                                ? "text-green-500"
                                : "text-gray-400"
                                }`}
                            >
                              {record.status === "PENDING"
                                ? t("status_staking")
                                : t("status_completed")}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Subordinates Performance Table */}
              {activeTab === "subordinates" && (
                <div className="overflow-x-auto">
                  {loadingSubordinates ? (
                    <div className="flex justify-center py-8">
                      <LoadingSpinnerItem />
                    </div>
                  ) : (
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-left text-[#3B82F6] text-xs">
                          <th className="pb-1.5">{tNode("address")}</th>
                          <th className="pb-1.5">
                            {tMy("invite_page.performance")}
                          </th>
                          <th className="pb-1.5">
                            {tMy("community_page.personal_stake")}
                          </th>
                          <th className="pb-1.5">{tNode("type")}</th>
                          <th className="pb-1.5">{tMy("invite_page.level")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {subordinates.length > 0 ? (
                          subordinates.map((sub, index) => (
                            <tr
                              key={index}
                              className="border-t border-gray-800 text-xs"
                            >
                              <td className="py-2">
                                {sub.address.slice(0, 4) +
                                  "..." +
                                  sub.address.slice(-4)}
                              </td>
                              <td className="py-2">
                                {truncateDecimals(sub.performance)} TXT
                              </td>
                              <td className="py-2">
                                {truncateDecimals(sub.amount)} TXT
                              </td>
                              <td className="py-2">
                                {sub.type
                                  ? tUserType(sub.type)
                                  : tUserType("common")}
                              </td>
                              <td className="py-2">{sub.level}</td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td
                              colSpan={5}
                              className="py-4 text-center text-gray-400"
                            >
                              {tNode("no_referrals_found")}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default function StakePage() {
  const t = useTranslations("stake");

  return (
    <div className="min-h-screen bg-black text-white relative">
      <Suspense fallback={<LoadingSpinner />}>
        <StakingContent />
      </Suspense>
    </div>
  );
}
