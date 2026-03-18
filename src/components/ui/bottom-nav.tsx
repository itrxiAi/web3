"use client";

import React from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useAppKitAccount } from "@reown/appkit/react";
import { triggerWalletConnect } from "@/components/ui/wallet-ref";
import Image from "next/image";

/**
 * Bottom navigation component.
 *
 * This component renders the navigation bar at the bottom of every page. It includes:
 * - Home navigation
 * - Node navigation
 * - Stake navigation
 * - Earnings navigation
 * - My navigation
 *
 * @returns {JSX.Element} The bottom navigation component.
 */
export default function BottomNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const t = useTranslations("foot");
  const { address } = useAppKitAccount();

  const tabbarItems = [
    {
      icon: "/images/v2/tabbar/home.png",
      iconActive: "/images/v2/tabbar/home-s.png",
      href: "/",
      label: "home",
    },
    {
      icon: "/images/v2/tabbar/task.png",
      iconActive: "/images/v2/tabbar/task-s.png",
      href: "/node",
      label: "node",
    },
    {
      icon: "/images/v2/tabbar/earn.png",
      iconActive: "/images/v2/tabbar/earn-s.png",
      href: "/stake",
      label: "stake",
    },
    {
      icon: "/images/v2/tabbar/chart.png",
      iconActive: "/images/v2/tabbar/chart-s.png",
      href: "/token",
      label: "chart",
    },
    {
      icon: "/images/v2/tabbar/top.png",
      iconActive: "/images/v2/tabbar/top-s.png",
      href: "/earnings",
      label: "earnings",
    },
    {
      icon: "/images/v2/tabbar/wallet.png",
      iconActive: "/images/v2/tabbar/wallet-s.png",
      href: "/my",
      label: "my",
    },
  ];

  // Function to determine if a link is active
  const isActive = (path: string) => {
    // For the home page
    if (path === "/") {
      // Check if pathname is exactly a locale (e.g., /en, /zh) or root
      // Match root path or any locale pattern (e.g., /en, /zh, /en-US, /zh-CN, /traditional-chinese)
      return pathname === "/" || /^\/[\w-]+$/.test(pathname);
    }

    // For other pages, check if the pathname contains the path segment after the locale
    // e.g., for '/node', check if pathname contains '/en/node' or '/zh/node'
    return pathname.includes(path);
  };

  const handleClick = (e: React.MouseEvent, href: string) => {
    // Only trigger wallet connect for stake, earnings, and my pages
    if (
      !address &&
      (href === "/stake" || href === "/earnings" || href === "/my")
    ) {
      e.preventDefault();
      triggerWalletConnect();
    }
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 h-16 bg-black flex justify-around items-center border-t border-gray-800 z-30 w-full">
      {tabbarItems.map((item, index) => {
        const active = isActive(item.href);
        return (
          <Link
            key={index}
            href={`${item.href}${
              searchParams.toString() ? `?${searchParams.toString()}` : ""
            }`}
            className={`flex flex-col items-center justify-center`}
            onClick={(e) => handleClick(e, item.href)}
          >
            <Image
              src={active ? item.iconActive : item.icon}
              alt={item.label}
              width={24}
              height={24}
              className="w-6 h-6"
            />
            <span
              className="text-xs mt-1"
              style={{ color: active ? "#0066CC" : "#ACACAC" }}
            >
              {t(item.label)}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
