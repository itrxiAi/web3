"use client";

import React, { useEffect, useState } from "react";
import {
  useAppKit,
  useAppKitAccount,
  useDisconnect,
} from "@reown/appkit/react";
import { useTranslations } from "next-intl";
import { WalletOutlined } from "@ant-design/icons";
import Image from "next/image";
import IndexBtn from "./IndexBtn";
import { useSearchParams } from "next/navigation";

interface Props {
  size?: "small";
  className?: string;
}

const MyConnectButton: React.FC<Props> = ({ size, className }) => {
  const { address, isConnected } = useAppKitAccount();
  const { open } = useAppKit();
  const { disconnect } = useDisconnect();
  const t = useTranslations("wallet");
  const [mounted, setMounted] = useState(false);
  const searchParams = useSearchParams();
  const refParam = searchParams.get("ref");

  // Only show the wallet button after mounting to avoid hydration errors
  useEffect(() => {
    setMounted(true);
  }, []);

  // Handle user creation when wallet is connected
  useEffect(() => {
    if (address && isConnected) {
      const userAddress = address;

      // First check if we have existing user data in session
      const existingUserData = JSON.parse(
        sessionStorage.getItem("userData") || "{}"
      );

      if (existingUserData && existingUserData.address) {
        // If we have existing data, just update the session with the new address
        if (userAddress.toLowerCase() === existingUserData.address.toLowerCase()) {
          return;
        }
      }

      // If no existing data, call user creation API（带上 URL ?ref= 以便绑定上级）
      fetch("/api/user/init", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          address: userAddress.toLowerCase(),
          referralCode: refParam || undefined,
        }),
      })
        .then((response) => {
          if (!response.ok) {
            throw new Error("Failed to create user");
          }
          return response.json();
        })
        .then((data) => {
          // Store user data in session storage
          if (data && data.data) {
            sessionStorage.setItem("userData", JSON.stringify(data.data));
            console.log("User data saved to session:", data.data);
          }
        })
        .catch((error) => {
          console.error("Error creating user:", error);
        });
    }
  }, [address, isConnected, refParam]);

  // Function to handle wallet modal opening
  /* const openWalletModal = useCallback(() => {
    if (publicKey) {
      disconnect();
    } else {
      // Open the wallet modal using the proper wallet adapter method
      setVisible(true);
    }
  }, [publicKey, disconnect, setVisible]); */

  const openWalletModal = async () => {
    if (isConnected) {
      await disconnect();
    } else {
      // Open Reown AppKit modal
      open();
    }
  };

  return (
    <div style={{ position: "relative" }} className={className}>
      {/* Custom styled button using IndexBtn */}
      <div className="flex ">
        {/* <div
          className=" rounded-1 flex flex-col justify-center items-center"
          style={{
            backgroundImage: `url(/images/earning/top-bg.png)`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            height: "32px",
            borderRadius: "6px",
            paddingRight: "20px",
            marginRight: "-20px",
            paddingTop: "5px",
          }}
        >
          <img src="/images/earning/net.png" alt="" className="w-2 h-4" />
          <span
            className="text-sm text-[#FFFFFFB5]"
            style={{ transform: "scale(0.5)" }}
          >
            网络
          </span>
        </div> */}
        {/* <img src="/images/v2/wallet.png" alt="" className="w-4 h-4" /> */}
        <IndexBtn
          isConnectWallet={true}
          height={size === "small" ? "40px" : "52px"}
          fontSize={size === "small" ? "16px" : "20px"}
          size={size}
          onClick={openWalletModal}
        >
          <span className="flex items-center gap-1">
            {/* <WalletOutlined className="text-white" /> */}
            <Image src="/images/earning/wallet.png" alt="Wallet" width={20} height={20} />
            {!mounted
              ? t("connect_wallet") || "Connect Wallet"
              : address
              ? `${address.slice(0, 4)}...${address.slice(-4)}`
              : t("connect_wallet") || "Connect Wallet"}
          </span>
        </IndexBtn>
      </div>
    </div>
  );
};

const ConnectWallet: React.FC<Props> = ({ size, className }) => {
  return <MyConnectButton size={size} className={className} />;
};

export default ConnectWallet;
