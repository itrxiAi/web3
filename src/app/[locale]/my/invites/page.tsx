"use client";

import { useAppKitAccount } from "@reown/appkit/react";

import { useTranslations } from "next-intl";
import Image from "next/image";
import { useRouter } from "next/navigation";

import { useEffect, useState } from "react";
import { Dialog } from "@headlessui/react";
import { UserType } from "@prisma/client";

interface Invite {
  user: string;
  level: string;
  staking: string;
  performance: string;
  type: string;
  joinTime: string;
}

const formatAddress = (address: string) => {
  return (
    address.substring(0, 6) + "..." + address.substring(address.length - 4)
  );
};

// Modal component to display invite details
function InviteDetailsModal({
  isOpen,
  onClose,
  invite,
}: {
  isOpen: boolean;
  onClose: () => void;
  invite: Invite | null;
}) {
  const t = useTranslations("my.invite_page.achievement");
  const tUserType = useTranslations("user_type");
  const [communityCount, setCommunityCount] = useState(0);
  const [groupCount, setGroupCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Only fetch data when modal is open and we have an invite
    if (isOpen && invite) {
      setIsLoading(true);

      // Fetch Genesis nodes count
      fetch("/api/user/subordinates-count", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          walletAddress: invite.user,
          isDirect: false,
          nodeType: UserType.COMMUNITY,
        }),
      })
        .then((response) => response.json())
        .then((data) => {
          setCommunityCount(data.count || 0);
        })
        .catch((error) => {
          console.error("Error fetching genesis count:", error);
        });

      // Fetch Community nodes count
      fetch("/api/user/subordinates-count", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          walletAddress: invite.user,
          isDirect: false,
          nodeType: UserType.COMMUNITY,
        }),
      })
        .then((response) => response.json())
        .then((data) => {
          setGroupCount(data.count || 0);
          setIsLoading(false);
        })
        .catch((error) => {
          console.error("Error fetching community count:", error);
          setIsLoading(false);
        });
    }
  }, [isOpen, invite]);

  if (!invite) return null;

  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/80" aria-hidden="true" />

      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel
          className="w-full max-w-md rounded-xl bg-black p-6 text-white border-2 border-blue-500"
          style={{ boxShadow: "0 0 30px rgba(59, 130, 246, 0.6)" }}
        >
          <div className="relative mb-4">
            <button
              onClick={onClose}
              className="absolute right-0 top-0 text-gray-400 hover:text-blue-400 transition-colors"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
            <Dialog.Title className="text-base font-semibold text-white text-center">
              {t("title", { address: formatAddress(invite.user) })}
            </Dialog.Title>
          </div>

          <div className="space-y-4">
            {/* Total Community Minted TXT */}
            {/* <div className="bg-gray-800 rounded-lg p-4">
              <div className="flex justify-between items-center">
                <div className="text-gray-300 text-xs">
                  {t("mining_total")}
                </div>
                <div className="text-lg font-bold">0 token</div>
              </div>
            </div> */}

            {/* Promoted Planet Nodes */}
            <div className="bg-gray-800 rounded-lg p-4">
              <div className="flex justify-between items-center">
                <div className="text-white text-xs">
                  {tUserType("GROUP")}
                </div>
                <div className="text-lg font-bold text-white">
                  {isLoading ? (
                    <span className="text-sm opacity-70">{t("loading")}</span>
                  ) : (
                    t("unit", { count: groupCount })
                  )}
                </div>
              </div>
            </div>

            {/* Promoted Star Nodes */}
            <div className="bg-gray-800 rounded-lg p-4">
              <div className="flex justify-between items-center">
                <div className="text-white text-xs">
                  {tUserType("COMMUNITY")}
                </div>
                <div className="text-lg font-bold text-white">
                  {isLoading ? (
                    <span className="text-sm opacity-70">{t("loading")}</span>
                  ) : (
                    t("unit", { count: communityCount })
                  )}
                </div>
              </div>
            </div>
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
}

export default function MyInvitesPage() {
  const t = useTranslations("my");
  const tUserType = useTranslations("user_type");
  const router = useRouter();
  const [invites, setInvites] = useState<Invite[]>([]);
  const { address } = useAppKitAccount();
  const [selectedInvite, setSelectedInvite] = useState<Invite | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    if (address) {
      fetch("/api/user/subordinates", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          walletAddress: address.toString(),
          isDirect: true, // assuming you want direct subordinates
        }),
      })
        .then((response) => response.json())
        .then((data) => {
          // Transform API response to match our invite interface
          const transformedInvites = data.data.map((subordinate: any) => ({
            user: subordinate.address,
            level: `L${subordinate.level}`,
            staking: `${subordinate.balance.token_staked_points} USDT`,
            performance: `${subordinate.balance.performance} USDT`,
            type: subordinate.type ? `${subordinate.type}` : "",
            joinTime: new Date(subordinate.created_at)
              .toISOString()
              .split("T")[0],
          }));
          setInvites(transformedInvites);
        })
        .catch((error) => {
          console.error("Error fetching invites:", error);
        });
    }
  }, [address]);

  return (
    <div className="flex flex-col min-h-screen h-full bg-black text-white">
      {/* Main content area with bottom padding for nav and top padding for header */}
      <div className="flex-1 pb-16 pt-20 bg-black">
        <div className="p-4 pl-0">
          {/* Header with back button */}
          <div className="mb-6 relative z-50">
            <button
              onClick={() => router.back()}
              className="mb-4 p-2"
              aria-label="Go back"
            >
              <Image
                src="/images/icons/arrow-left.svg"
                alt="Back"
                width={24}
                height={24}
              />
            </button>
            <h1 className="text-lg font-semibold mb-2 flex items-center pl-2">
              <div className="w-1 h-5 bg-[#3B82F6] mr-2"></div>
              <span className="text-white ">{t("invite_records")}</span>
            </h1>
          </div>

          {/* Table header */}
          <div className="flex items-center text-[#3B82F6] mb-4  text-xs">
            <div className="w-48 text-center">{t("user_address")}</div>
            <div className="w-20 text-center">{t("identity")}</div>
            <div className="w-24 text-center">{t("level")}</div>
            <div className="w-32 text-center">{t("personal_mining")}</div>
            <div className="w-32 text-center">{t("community_mining")}</div>
            <div className="w-32 text-center">{t("join_time")}</div>
          </div>

          {/* Table content */}
          <div className="space-y-1">
            {invites.length === 0 ? (
              <div className="flex items-center py-2 px-2"></div>
            ) : (
              invites.map((invite, index) => (
                <div
                  key={index}
                  className="flex items-center py-2 px-2 text-xs text-white bg-transparent mb-1 cursor-pointer hover:bg-gray-800/20 transition-colors"
                  onClick={() => {
                    setSelectedInvite(invite);
                    setIsModalOpen(true);
                  }}
                >
                  <div className="truncate w-48 text-center">
                    {formatAddress(invite.user)}
                  </div>
                  <div className="truncate w-20 text-center">
                    {invite.type === "" ? "" : tUserType(invite.type)}
                  </div>
                  <div className="truncate w-24 text-center">
                    {invite.level}
                  </div>
                  <div className="truncate w-32 text-center">
                    {invite.staking}
                  </div>
                  <div className="truncate w-32 text-center">
                    {invite.performance}
                  </div>
                  <div className="truncate w-32 text-center">
                    {invite.joinTime}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Invite Details Modal */}
      <InviteDetailsModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        invite={selectedInvite}
      />
    </div>
  );
}
