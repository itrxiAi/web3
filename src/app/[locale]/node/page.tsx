"use client";

import React, { Suspense, useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import LoadingSpinner from "@/components/LoadingSpinner";
import LoadingSpinnerWithText from "@/components/LoadingSpinnerWithText";
import { COMMUNITY_TYPE, GROUP_TYPE } from "@/constants";
import { formatDate } from "@/utils/dateUtils";
import Image from "next/image";
import { QRCodeModal } from "@/components/ui/qr-code-modal";
import { triggerWalletConnect } from "@/components/ui/wallet-ref";
import { useAppKitAccount } from "@reown/appkit/react";
import {
  useCommunityNodePurchase,
  type NodesDataShape,
} from "@/hooks/useCommunityNodePurchase";
import { TransactionModal } from "@/components/TransactionModal";
import { NodeConfirmModal } from "@/components/NodeConfirmModal";
import { RecommenderAlertModal } from "@/components/RecommenderAlertModal";
import { TokenType, TxFlowStatus, UserType } from "@prisma/client";
import { truncateDecimals } from "@/utils/common";
import decimal from "decimal.js";
import BorderCustom from "@/components/ui/border-custom";

// Node Card Component
interface NodeCardProps {
  price: string;
  present: string;
  total: string;
  referralReward: string;
  dividendsReward: string;
  rewardCap: string;
  nodeType?: string;
  referralCode?: string;
  hasSuperior?: boolean;
  handleCommunity?: (isBigNode: boolean, recommender: string) => Promise<void>;
}

const NodeCard: React.FC<NodeCardProps> = ({
  price,
  present,
  total,
  referralReward,
  dividendsReward,
  rewardCap,
  nodeType,
  hasSuperior = false,
  handleCommunity,
}) => {
  const t = useTranslations("node");
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const { address } = useAppKitAccount();

  // 根据节点类型确定显示信息
  const isGroupNode = nodeType === UserType.COMMUNITY;
  const nodeTitle = isGroupNode ? t("node_info_text.GROUP.title") : t("node_info_text.COMMUNITY.title");
  const titleFormat = isGroupNode ? t("node_info_text.GROUP.title_format") : t("node_info_text.COMMUNITY.title_format");


  // 权益列表
  const benefits = isGroupNode
    ? [
        t("node_info_text.GROUP.min_level"),
        t("node_info_text.GROUP.reward_cap"),
        t("node_info_text.GROUP.direct_reward"),
        t("node_info_text.GROUP.dividends_reward"),
        t("node_info_text.GROUP.platform_reward"),
        t("node_info_text.GROUP.airdrop"),
        t("node_info_text.GROUP.mining"),
      ]
    : [
        t("node_info_text.COMMUNITY.min_level"),
        t("node_info_text.COMMUNITY.reward_cap"),
        t("node_info_text.COMMUNITY.direct_reward"),
        //t("node_info_text.COMMUNITY.diff_reward"),
        t("node_info_text.COMMUNITY.dividends_reward"),
        t("node_info_text.COMMUNITY.platform_reward"),
        t("node_info_text.COMMUNITY.airdrop"),
        t("node_info_text.COMMUNITY.mining"),
      ];

  return (
    <BorderCustom
      type={2}
      className="mb-2 bg-black border   overflow-hidden relative"
      style={{
        border: "1px solid #3B82F6",
      }}
    >
      <div className="p-6 flex flex-col items-center">
        {/* {t("node_icon")} */}
        <Image
          src={
            isGroupNode
              ? "/images/v2/node/group.png"
              : "/images/v2/node/community.png"
          }
          alt={nodeTitle}
          width={240}
          height={188}
        />

        {/* {t("title_and_status")} */}
        <div className="bg-blue-500 rounded-lg px-4 py-2 mt-2 mb-4">
          <h3 className="text-black font-bold text-center">
            {nodeTitle}{titleFormat}
          </h3>
        </div>

        {/* {t("benefits_list")} */}
        <BorderCustom
          className=" p-4 mb-2 -mt-8"
          style={{
            border: "1px solid rgba(59, 130, 246, 0.3)",
            paddingTop: "20px",
          }}
        >
          {benefits.map((benefit, index) => (
            <div key={index} className="flex items-center mb-1 last:mb-0">
              <div className="w-1 h-1 bg-[#3B82F6] mr-2 rounded-full"></div>
              <span
                className="text-white text-xs"
                style={{
                  color: "rgba(255, 255, 255, 0.9)",
                }}
              >
                {benefit}
              </span>
            </div>
          ))}
        </BorderCustom>

        {/* {t("purchase_button")} */}
        <button
          onClick={() => {
            if (!address) {
              triggerWalletConnect();
              return;
            }
            setShowConfirmModal(true);
          }}
          disabled={Number(present) === 0}
          className={`w-full py-3 px-4 rounded-lg font-bold text-center mb-3`}
          style={{
            background: "linear-gradient(270deg, #2563EB 0%, #60A5FA 100%)",
          }}
        >
          {price} USDT-{t("buy_now")}
        </button>

        {/* {t("invite_friends_button")} */}
        <button
          onClick={() => {
            if (!address) {
              triggerWalletConnect();
              return;
            }
            setShowQRModal(true);
          }}
          style={{
            border: "1px solid rgba(59, 130, 246, 0.3)",
            background: "rgba(59, 130, 246, 0.08)",
          }}
          className="w-full py-3 px-4  font-medium text-center  text-white  flex items-center justify-center "
        >
          <Image
            src="/images/v2/node/invite.png"
            alt="Invite"
            width={17}
            height={14}
            className="mr-1"
          />
          {t("invite_friends")}
        </button>
      </div>

      <NodeConfirmModal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        onConfirm={() => {
          setShowConfirmModal(false);
          handleCommunity?.(nodeType === UserType.COMMUNITY, "");
        }}
        isBigNode={nodeType === UserType.COMMUNITY}
        price={price}
      />

      {/* QR Code Modal */}
      {showQRModal && address && (
        <QRCodeModal
          isOpen={showQRModal}
          onClose={() => setShowQRModal(false)}
          publicKey={address?.toString()}
          userType={nodeType || null}
        />
      )}
    </BorderCustom>
  );
};

// Node Reward Card Component
interface NodeRewardCardProps {
  iconSrc: string;
  iconAlt: string;
  title: string;
  value: string;
  unit: string;
}

const NodeRewardCard: React.FC<NodeRewardCardProps> = ({
  iconSrc,
  iconAlt,
  title,
  value,
  unit,
}) => {
  return (
    <div className="bg-black border border-gray-800 rounded-xl p-2">
      <div className="flex items-center justify-center mb-2">
        {/* <Image
      src={iconSrc}
      alt={iconAlt}
      width={12}
      height={12}
    /> */}
        <span className="text-[12px] text-gray-300 text-center">{title}</span>
      </div>
      {/* <Image
    src={iconSrc}
    alt={iconAlt}
    width={12}
    height={12}
  /> */}
      <div className="text-xg font-bold text-white text-center">
        {value} {unit}
      </div>
    </div>
  );
};

// Connected Node Details Component
interface ConnectedNodeDetailsProps {
  referralCode: string;
  activationDate: string;
  userType?: string | null;
  level: number | null;
  activePercent: number | null;
  interestActive?: boolean;
}

const ConnectedNodeDetails: React.FC<ConnectedNodeDetailsProps> = ({
  activationDate,
  userType,
  level,
  activePercent,
  interestActive,
}) => {
  const t = useTranslations("node");
  const { address } = useAppKitAccount();
  const [showQRModal, setShowQRModal] = useState(false);
  const [currentDataType, setCurrentDataType] = useState<
    "directCommunity" | "directGroup" | "indirectCommunity" | "indirectGroup"
  >("directCommunity");

  // State for referral stats
  const [referralStats, setReferralStats] = useState({
    directCommunity: { count: 0, label: t("direct_community_count") },
    directGroup: { count: 0, label: t("direct_group_count") },
    indirectCommunity: { count: 0, label: t("indirect_community_count") },
    indirectGroup: { count: 0, label: t("indirect_group_count") },
  });

  const [nodeRewardData, setNodeRewardData] = useState({
    referralRewards: 0,
    communityRewards: 0,
    incubationRewards: 0,
    dividendsRewards: 0,
  });

  // Define types for referral data
  interface ReferralItem {
    address: string;
    type: string;
    time: string;
  }

  interface ReferralData {
    directCommunity: ReferralItem[];
    directGroup: ReferralItem[];
    indirectCommunity: ReferralItem[];
    indirectGroup: ReferralItem[];
  }

  // State for referral data
  const [allReferralData, setAllReferralData] = useState<ReferralData>({
    directCommunity: [],
    directGroup: [],
    indirectCommunity: [],
    indirectGroup: [],
  });

  const fetchEarnings = async () => {
    if (!address) return;
    const earningsResponse = await fetch("/api/user/earnings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        address: address.toString(),
      }),
    });

    const earningsData = (await earningsResponse.json()).data;
    setNodeRewardData({
      referralRewards:
        (earningsData.NODE_REWARD?.[TxFlowStatus.PENDING] || 0) +
        (earningsData.NODE_REWARD?.[TxFlowStatus.CONFIRMED] || 0),
      communityRewards:
        (earningsData.STAKE_DYNAMIC_NODE_REWARD?.[TxFlowStatus.PENDING] || 0) +
        (earningsData.STAKE_DYNAMIC_NODE_REWARD?.[TxFlowStatus.CONFIRMED] || 0),
      incubationRewards:
        (earningsData.STAKE_DYNAMIC_NODE_INCUBATION_REWARD?.[
          TxFlowStatus.PENDING
        ] || 0) +
        (earningsData.STAKE_DYNAMIC_NODE_INCUBATION_REWARD?.[
          TxFlowStatus.CONFIRMED
        ] || 0),
      dividendsRewards:
        (earningsData.FEE_DIVIDEND?.[TxFlowStatus.PENDING] || 0) +
        (earningsData.FEE_DIVIDEND?.[TxFlowStatus.CONFIRMED] || 0),
    });
  };

  const formatAddress = (address: string) => {
    return (
      address.substring(0, 6) + "..." + address.substring(address.length - 4)
    );
  };

  // Fetch referral data from API
  const fetchReferralData = async () => {
    if (!address) return;

    try {
      // Fetch direct referrals with COMMUNITY type
      const directCommunityResponse = await fetch("/api/user/subordinates", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          walletAddress: address.toString(),
          isDirect: true,
          nodeType: UserType.COMMUNITY,
        }),
      });
      const directCommunityData = (await directCommunityResponse.json()).data;

      // Fetch direct referrals with GROUP type
      const directGroupResponse = await fetch("/api/user/subordinates", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          walletAddress: address.toString(),
          isDirect: true,
          nodeType: UserType.COMMUNITY,
        }),
      });
      const directGroupData = (await directGroupResponse.json()).data;

      // Fetch indirect referrals with COMMUNITY type
      const indirectCommunityResponse = await fetch("/api/user/subordinates", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          walletAddress: address.toString(),
          isDirect: false,
          nodeType: UserType.COMMUNITY,
        }),
      });
      const indirectCommunityData = (await indirectCommunityResponse.json())
        .data;

      // Fetch indirect referrals with GROUP type
      const indirectGroupResponse = await fetch("/api/user/subordinates", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          walletAddress: address.toString(),
          isDirect: false,
          nodeType: UserType.COMMUNITY,
        }),
      });
      const indirectGroupData = (await indirectGroupResponse.json()).data;

      // Format the data for display
      const formatReferralData = (data: any) => {
        return data.map((sub: any) => ({
          address: formatAddress(sub.address),
          type:
            sub.type === UserType.COMMUNITY
              ? t("community_title")
              : t("group_title"),
          time: formatDate(new Date(sub.buy_at || "")),
        }));
      };

      // Format the data for each category
      const formattedDirectCommunity = formatReferralData(directCommunityData);
      const formattedDirectGroup = formatReferralData(directGroupData);
      const formattedIndirectCommunity = formatReferralData(
        indirectCommunityData
      );
      const formattedIndirectGroup = formatReferralData(indirectGroupData);

      // Update the referral stats
      setReferralStats({
        directCommunity: {
          count: directCommunityData?.length || 0,
          label: t("direct_community_count"),
        },
        directGroup: {
          count: directGroupData?.length || 0,
          label: t("direct_group_count"),
        },
        indirectCommunity: {
          count: indirectCommunityData?.length || 0,
          label: t("indirect_community_count"),
        },
        indirectGroup: {
          count: indirectGroupData?.length || 0,
          label: t("indirect_group_count"),
        },
      });

      // Update the referral data with formatted data
      setAllReferralData({
        directCommunity: formattedDirectCommunity,
        directGroup: formattedDirectGroup,
        indirectCommunity: formattedIndirectCommunity,
        indirectGroup: formattedIndirectGroup,
      });
    } catch (error) {
      console.error("Error fetching referral data:", error);
    }
  };

  // Get current data based on selected type
  const currentReferralData = allReferralData[currentDataType] || [];
  const currentStats = referralStats[currentDataType];

  // Fetch data on component mount and when address changes
  useEffect(() => {
    fetchReferralData();
    fetchEarnings();
  }, [address]);

  // Handle sliding to previous data type
  const handlePrevDataType = () => {
    if (currentDataType === "directCommunity")
      setCurrentDataType("directGroup");
    else if (currentDataType === "directGroup")
      setCurrentDataType("indirectCommunity");
    else if (currentDataType === "indirectCommunity")
      setCurrentDataType("indirectGroup");
    else if (currentDataType === "indirectGroup")
      setCurrentDataType("directCommunity");
  };

  // Handle sliding to next data type
  const handleNextDataType = () => {
    if (currentDataType === "directGroup")
      setCurrentDataType("directCommunity");
    else if (currentDataType === "indirectCommunity")
      setCurrentDataType("directGroup");
    else if (currentDataType === "indirectGroup")
      setCurrentDataType("indirectCommunity");
    else if (currentDataType === "directCommunity")
      setCurrentDataType("indirectGroup");
  };

  // Format the activation date to match the design
  const formattedDate = activationDate || "2025-05-01";

  // 根据节点类型确定显示信息
  const isGroupNode = userType === UserType.COMMUNITY;
  const isCommunityNode = userType === UserType.COMMUNITY;
  const isGalaxyNode = userType === UserType.COMMUNITY;

  // 节点标题和状态
  const nodeTitle = isGroupNode
    ? t("node_info_text.GROUP.title")
    : isCommunityNode
    ? t("node_info_text.COMMUNITY.title")
    : t("node_info_text.GALAXY.title");
  const isActivated = isGalaxyNode ? interestActive === true : true; // 银河节点根据interestActive判断激活状态，其他节点默认已激活
  const statusText = isActivated ? t("activated") : t("unactivated");

  // 节点图片
  const nodeImage = isGroupNode
    ? "/images/v2/node/group.png"
    : isCommunityNode
    ? "/images/v2/node/community.png"
    : isActivated
    ? "/images/v2/node/galaxy-active.png"
    : "/images/v2/node/galaxy.png";

  // 权益列表
  const benefits = isGroupNode
    ? [
        t("node_info_text.GROUP.min_level"),
        t("node_info_text.GROUP.reward_cap"),
        t("node_info_text.GROUP.direct_reward"),
        t("node_info_text.GROUP.dividends_reward"),
        t("node_info_text.GROUP.platform_reward"),
        t("node_info_text.GROUP.airdrop"),
        t("node_info_text.GROUP.mining"),
      ]
    : isCommunityNode
    ? [
        t("node_info_text.COMMUNITY.min_level"),
        t("node_info_text.COMMUNITY.reward_cap"),
        t("node_info_text.COMMUNITY.direct_reward"),
        //t("node_info_text.COMMUNITY.diff_reward"),
        t("node_info_text.COMMUNITY.dividends_reward"),
        t("node_info_text.COMMUNITY.platform_reward"),
        t("node_info_text.COMMUNITY.airdrop"),
        t("node_info_text.COMMUNITY.mining"),
      ]
    : [
        t("node_info_text.GALAXY.direct_reward"),
        //t("node_info_text.GALAXY.diff_reward"),
        t("node_info_text.GALAXY.dividends_reward"),
        t("node_info_text.COMMUNITY.platform_reward"),
      ];

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 pb-16 pt-28">
        {/* Main Node Card */}
        <div className="mx-4">
          <BorderCustom
            type={2}
            className="bg-black overflow-hidden relative"
            style={{
              border: "1px solid #3B82F6",
            }}
          >
            <div className="p-6 flex flex-col items-center">
              {/* {t("node_icon")} */}
              <Image src={nodeImage} alt={nodeTitle} width={240} height={188} />

              {/* {t("title_and_status")} */}
              <div className="flex items-center h-[40px] w-[250px] border border-blue-500 rounded-lg">
                <div className="text-black font-bold text-lg bg-[#3B82F6] h-full flex-1 rounded-l-lg flex items-center justify-center">
                  {nodeTitle}
                </div>
                <div
                  className={`  text-lg flex-1 text-[#3B82F6] text-center bg-black relative z-10`}
                >
                  {statusText}
                </div>
              </div>

              {/* {t("benefits_list")} */}
              <BorderCustom
                className="pt-4 pb-2 mb-4 w-full -mt-6"
                style={{
                  border: "1px solid rgba(59, 130, 246, 0.3)",
                  paddingTop: "30px",
                }}
              >
                {benefits.map((benefit, index) => (
                  <div
                    key={index}
                    className="flex items-center mb-1 last:mb-0 px-4"
                  >
                    <div className="w-1 h-1 bg-[#3B82F6] mr-2 rounded-full"></div>
                    <span
                      className={`text-xs ${
                        userType === UserType.COMMUNITY
                          ? "text-white"
                          : "text-[#60A5FA]"
                      }`}
                    >
                      {benefit}
                    </span>
                  </div>
                ))}
                {/* {t("equity_status_or_activation_progress")} */}
                {isActivated ? (
                  <div
                    className="text-[#3B82F6] text-md text-center pt-1 font-bold"
                    style={{
                      borderTop: "1px solid rgb(5, 47, 81)",
                    }}
                  >
                    {t("equity_effective")}
                  </div>
                ) : isGalaxyNode && activePercent !== null ? (
                  <div className="w-full  px-4 my-2">
                    <div className="w-full bg-gray-700 rounded-full h-2">
                      <div
                        className=" h-2 rounded-full transition-all duration-300"
                        style={{
                          width: `${activePercent}%`,
                          background:
                            "linear-gradient(270deg, #2563EB 0%, #60A5FA 100%)",
                        }}
                      ></div>
                    </div>
                    <div className="text-xs text-[#3B82F6] flex flex-col mt-2">
                      <span>
                        {t("node_info_text.GALAXY.active_percent") + activePercent + '%'}
                      </span>
                      <span>{t("node_info_text.GALAXY.active_condition")}</span>
                    </div>
                  </div>
                ) : null}
              </BorderCustom>

              {/* {t("invite_friends_button")} */}
              <button
                onClick={() => {
                  if (address) {
                    setShowQRModal((prev) => !prev);
                  }
                }}
                className="w-full py-3 px-4 rounded-lg font-medium text-center text-black flex items-center justify-center"
                style={{
                  background:
                    "linear-gradient(270deg, #2563EB 0%, #60A5FA 100%)",
                }}
              >
                <Image
                  src="/images/v2/node/invite-b.png"
                  alt="Invite"
                  width={17}
                  height={14}
                  className="mr-1"
                />
                {t("invite_friends")}
              </button>
            </div>
          </BorderCustom>
        </div>

        {/* Node Reward Data Section */}
        <div className="mx-4 mt-3">
          <div className="bg-black overflow-hidden">
            {/* Header */}
            <div className="flex items-center">
              <div className="w-1 h-5 bg-[#3B82F6] mr-1"></div>
              <h2 className="text-md font-medium text-white">
                {t("node_reward_data")}
              </h2>
            </div>

            {/* Reward Cards Grid */}
            <div className="grid grid-cols-2 gap-1 my-2">
              <BorderCustom
                className="bg-black border   p-2"
                style={{
                  border: "1px solid rgba(59, 130, 246, 0.3)",
                }}
              >
                <div className="flex items-center justify-center mb-2">
                  <Image
                    src="/images/v2/node/icon1.png"
                    alt="Referral"
                    width={12}
                    height={10}
                    className="mr-1"
                  />
                  <span className="text-[12px] text-white ">
                    {t("referral_reward")}
                  </span>
                </div>
                <div className="text-sm font-bold text-white text-center">
                  {truncateDecimals(nodeRewardData.referralRewards)} USDT
                </div>
              </BorderCustom>

              <BorderCustom
                className="bg-black border  p-2"
                style={{
                  border: "1px solid rgba(59, 130, 246, 0.3)",
                }}
              >
                <div className="flex items-center justify-center mb-2">
                  <Image
                    src="/images/v2/node/icon2.png"
                    alt="Referral"
                    width={13}
                    height={13}
                    className="mr-1"
                  />
                  <span className="text-[12px] text-white ">
                    {t("dividends_reward")}
                  </span>
                </div>
                <div className="text-sm font-bold text-white text-center">
                  {truncateDecimals(nodeRewardData.dividendsRewards)} TXT
                </div>
              </BorderCustom>
            </div>
            <div className="flex justify-center">
              <BorderCustom
                className="bg-black border  p-2 col-span-2 w-1/2"
                style={{
                  border: "1px solid rgba(59, 130, 246, 0.3)",
                }}
              >
                <div className="flex items-center justify-center mb-2">
                  <Image
                    src="/images/v2/node/icon3.png"
                    alt="Referral"
                    width={12}
                    height={12}
                    className="mr-1"
                  />
                  <span className="text-[12px] text-white ">
                    {t("platform_reward")}
                  </span>
                </div>
                <div className="text-sm font-bold text-white text-center">
                  0.00 TXT
                </div>
              </BorderCustom>
            </div>
          </div>
        </div>

        {/* Node Promotion Data Section */}
        <div className="mx-4 mt-3">
          <div className="bg-black overflow-hidden">
            {/* Header */}
            <div className="flex items-center">
              <div className="w-1 h-5 bg-[#3B82F6] mr-1"></div>
              <h2 className="text-md font-medium text-white">
                {t("node_promotion")}
              </h2>
            </div>

            {/* Referral Count with Sliding */}
            <div
              style={{
                background: "linear-gradient(270deg, #2563EB 0%, #60A5FA 100%)",
              }}
              className=" px-4 py-2 flex items-center justify-between text-black rounded-t-lg mt-2"
            >
              <button onClick={handlePrevDataType} className="text-white">
                <Image
                  src="/images/v2/node/left-arrow.png"
                  alt="Prev"
                  width={10}
                  height={14}
                />
              </button>
              <div className="text-center font-bold">
                <div className=" text-xs">{currentStats.label}</div>
                <div className="text-xs ">{currentStats.count}</div>
              </div>
              <button onClick={handleNextDataType} className="text-white">
                <Image
                  src="/images/v2/node/right-arrow.png"
                  alt="Next"
                  width={10}
                  height={14}
                />
              </button>
            </div>

            {/* Referral Table */}
            <BorderCustom
              className="p-2"
              style={{
                border: "1px solid rgba(59, 130, 246, 0.3)",
              }}
            >
              <div className="grid grid-cols-3 text-[#3B82F6] text-xs mb-2">
                <div>{t("address")}</div>
                <div className="text-center">{t("type")}</div>
                <div className="text-right">{t("time")}</div>
              </div>

              {/* Table Rows */}
              {currentReferralData.length > 0 ? (
                currentReferralData.map((item, index) => (
                  <div
                    key={index}
                    className="grid grid-cols-3 py-3 border-b border-gray-800 text-white text-xs"
                  >
                    <div className="truncate">{item.address}</div>
                    <div className="text-center">{item.type}</div>
                    <div className="text-right">{item.time}</div>
                  </div>
                ))
              ) : (
                <div className="text-center text-gray-400 py-4 text-sm">
                  {t("no_referrals_found")}
                </div>
              )}
            </BorderCustom>
          </div>
        </div>

        {/* QR Code Modal */}
        {showQRModal && address && (
          <QRCodeModal
            isOpen={showQRModal}
            onClose={() => setShowQRModal(false)}
            publicKey={address?.toString()}
            userType={userType || null}
          />
        )}
      </div>
    </div>
  );
};

// Node Market Component (shown when wallet is not connected or user doesn't own a node)
interface NodeMarketProps {
  nodeData: NodesDataShape | null;
  userInfo: {
    type: string | null;
    level: number | null;
    superior: string | null;
    referral_code: string | null;
    created_at: string | null;
    buy_at: string | null;
  } | null;
  handleCommunity: (isBigNode: boolean, recommender: string) => Promise<void>;
}

const NodeMarket: React.FC<NodeMarketProps> = ({
  nodeData,
  userInfo,
  handleCommunity,
}) => {
  const tSub = useTranslations("subscribe_page");
  const { address } = useAppKitAccount();
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  if (!nodeData) {
    return <LoadingSpinner />;
  }

  const price = nodeData.communityNode.price_display.toString();
  const leftNum = nodeData.communityNode.leftNum;

  const benefits = [
    tSub("benefit_1"),
    tSub("benefit_2"),
    tSub("benefit_3"),
    tSub("benefit_4"),
    tSub("benefit_5"),
  ];

  return (
    <div className="relative min-h-screen overflow-hidden text-white">
      <div className="relative pb-16 pt-16 px-5">
        {/* Title */}
        <h1 className="mb-6 text-center text-xl font-bold text-white">
          {tSub("title")}
        </h1>

        {/* Content Card — 权益说明 */}
        <div
          className="mb-5 rounded-[10px] p-3 text-xs leading-snug"
          style={{
            backgroundImage: "linear-gradient(0deg, #e50e0f 0%, #680a71 100%)",
          }}
        >
          <p className="mb-3 leading-snug text-white" style={{ color: "#ffffff" }}>
            {tSub("intro")}
          </p>

          <div className="space-y-1.5">
            {benefits.map((benefit, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <span
                  className="mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-black text-[10px] font-bold leading-none text-white"
                  aria-hidden
                >
                  {i + 1}
                </span>
                <p className="leading-snug text-white" style={{ color: "#ffffff" }}>
                  {benefit}
                </p>
              </div>
            ))}
          </div>

          <p className="mt-3 text-[11px] leading-snug text-white/60">
            {tSub("note")}
          </p>
        </div>

        {/* Urgency */}
        <p
          className="mb-1 text-center text-sm font-semibold"
          style={{ color: "#f0507a" }}
        >
          {tSub("urgency")}
        </p>
        <p
          className="mb-6 text-center text-xs"
          style={{ color: "rgba(255,255,255,0.68)" }}
        >
          {tSub("price_line")}
        </p>

        {/* CTA Button — 立即认购 */}
        <button
          onClick={() => {
            if (!address) {
              triggerWalletConnect();
              return;
            }
            setShowConfirmModal(true);
          }}
          disabled={leftNum === 0}
          className="mb-8 w-full py-4 text-center text-lg font-bold text-white"
          style={
            leftNum === 0
              ? {
                  borderRadius: "10px",
                  background: "rgba(80,80,80,0.5)",
                  boxShadow: "none",
                }
              : {
                  borderRadius: "10px",
                  backgroundImage:
                    "linear-gradient(0deg, #e50e0f 0%, #680a71 100%)",
                  boxShadow: "0 4px 24px rgba(229, 14, 15, 0.35)",
                }
          }
        >
          {tSub("cta")}
        </button>

        {/* Footer Notes */}
        <p className="mb-3 text-xs" style={{ color: "rgba(255,255,255,0.58)" }}>
          {tSub("footer_1")}
        </p>
        <p className="text-xs" style={{ color: "rgba(255,255,255,0.58)" }}>
          {tSub("footer_2")}
        </p>
      </div>

      {/* Confirm Modal — calls COMMUNITY (isBigNode=true) */}
      <NodeConfirmModal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        onConfirm={() => {
          setShowConfirmModal(false);
          handleCommunity(true, "");
        }}
        isBigNode={true}
        price={price}
      />
    </div>
  );
};

function NodeContent() {
  const t = useTranslations("node");
  const { address } = useAppKitAccount();
  const [userInfo, setUserInfo] = useState<{
    type: string | null;
    level: number | null;
    superior: string | null;
    referral_code: string | null;
    created_at: string | null;
    buy_at: string | null;
    active_percent: number | null;
    interest_active?: boolean;
  } | null>(null);

  const fetchUserInfo = async () => {
    try {
      if (!address) {
        setUserInfo(null);
        return;
      }

      const response = await fetch(
        `/api/user/info?address=${address.toString()}`
      );
      const data = await response.json();
      if (!response.ok || data?.error) {
        setUserInfo(null);
        return;
      }
      setUserInfo(data);
    } catch (error) {
      console.error("Error fetching user info:", error);
    }
  };

  const {
    nodeData,
    isJoining,
    handleCommunity,
    showTxModal,
    setShowTxModal,
    showTxErrorModal,
    setShowTxErrorModal,
    txSignature,
    txErrorMessage,
  } = useCommunityNodePurchase({ onAfterPurchase: fetchUserInfo });

  // Effect for fetching user info - runs when address changes
  useEffect(() => {
    fetchUserInfo();
  }, [address]);

  const hasNode =
    userInfo?.type === GROUP_TYPE ||
    userInfo?.type === COMMUNITY_TYPE ||
    userInfo?.type === UserType.COMMUNITY;

  if (!nodeData) {
    return <LoadingSpinner />;
  }

  // Calculate rewards for the connected node details
  const referralReward =
    hasNode && userInfo?.type === COMMUNITY_TYPE
      ? `${new decimal(nodeData.communityNode.referralReward)
          .mul(100)
          .toString()}% USDT`
      : `${new decimal(nodeData.communityNode.referralReward)
          .mul(100)
          .toString()}% USDT`;

  const dividendsReward =
    hasNode && userInfo?.type === COMMUNITY_TYPE
      ? `${new decimal(0.1).mul(100).toString()}% ${t("total_fee")}`
      : `${new decimal(0.1).mul(100).toString()}% ${t("total_fee")}`;

  // const incubationMiningReward =
  //   hasNode && userInfo.type === COMMUNITY_TYPE
  //     ? `${new decimal(nodeData.communityNode.incubationReward)
  //         .mul(100)
  //         .toString()}% TOKE`
  //     : `${new decimal(nodeData.groupNode.incubationReward)
  //         .mul(100)
  //         .toString()}% TXT`;

  // const rewardCapStr =
  //   hasNode && userInfo.type === COMMUNITY_TYPE
  //     ? `${new decimal(nodeData.communityNode.dynamicRewardCap).toString()} TXT`
  //     : `${new decimal(nodeData.groupNode.dynamicRewardCap).toString()} TXT`;

  // const rewardCap =
  //   hasNode && userInfo.type === COMMUNITY_TYPE
  //     ? new decimal(nodeData.communityNode.dynamicRewardCap)
  //     : new decimal(nodeData.groupNode.dynamicRewardCap);

  if (isJoining) {
    return <LoadingSpinnerWithText />;
  }

  return (
    <>
      <TransactionModal
        isOpen={showTxModal}
        onClose={() => {
          setShowTxModal(false);
          window.location.reload();
        }}
        type="success"
        txSignature={txSignature}
      />
      <TransactionModal
        isOpen={showTxErrorModal}
        onClose={() => setShowTxErrorModal(false)}
        type="error"
        message={txErrorMessage}
      />
      {hasNode && userInfo ? (
        <ConnectedNodeDetails
          referralCode={userInfo.referral_code || ""}
          activationDate={formatDate(new Date(userInfo.buy_at || ""))}
          userType={userInfo.type}
          level={userInfo.level}
          activePercent={userInfo.active_percent}
          interestActive={userInfo.interest_active}
        />
      ) : (
        <NodeMarket
          nodeData={nodeData}
          userInfo={userInfo}
          handleCommunity={handleCommunity}
        />
      )}
    </>
  );
}

export default function NodePage() {
  return (
    <div
      className="min-h-screen bg-black text-white bg-cover bg-center bg-no-repeat"
      style={{ backgroundImage: "url(/imgs/history/bg.png)" }}
    >
      <main>
        <Suspense fallback={<LoadingSpinner />}>
          <NodeContent />
        </Suspense>
      </main>
    </div>
  );
  // const router = useRouter();
  
  // // Redirect to home page on component mount
  // useEffect(() => {
  //   router.push("/");
  // }, [router]);

  // // Return empty div while redirecting
  // return <div className="min-h-screen bg-black"></div>;
}
