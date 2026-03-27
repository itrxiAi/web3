import Image from "next/image";
import Link from "next/link";
import SideNavDrawer from "./side-nav-drawer";
import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { RecommenderModal } from "./recommender-modal";
import { useAppKit, useAppKitAccount } from "@reown/appkit/react";
import { useSearchParams, usePathname } from "next/navigation";
import { routing } from "@/i18n/routing";

function formatHeaderId(address: string | undefined) {
  if (!address) return "";
  const raw = address.startsWith("0x") ? address : `0x${address}`;
  const up = raw.toUpperCase();
  if (up.length <= 16) return up;
  return `${up.slice(0, 8)}......${up.slice(-6)}`;
}

/**
 * Header component for the application.
 *
 * This component renders the header at the top of every page. It includes:
 * - Site branding (logo)
 * - Desktop navigation menu
 * - Desktop theme toggle
 * - Desktop call-to-action (CTA)
 * - Mobile menu toggle
 *
 * @returns {JSX.Element} The header component.
 */
/** Returns true if the current pathname is the home page (i.e. /{locale} with no sub-path). */
function useIsHomePage(): boolean {
  const pathname = usePathname();
  // pathname looks like "/zh", "/en", "/zh/node", "/zh/my", etc.
  const segments = pathname.split("/").filter(Boolean);
  // If there is only one segment (the locale), it's the home page
  const isLocaleOnly =
    segments.length === 1 && (routing.locales as readonly string[]).includes(segments[0]);
  // Also handle root "/" with no locale prefix
  return isLocaleOnly || segments.length === 0;
}

export default function Header() {
  const isHome = useIsHomePage();
  const [sideMenuOpen, setSideMenuOpen] = useState(false);
  const { address, isConnected } = useAppKitAccount();
  const { open: openWallet } = useAppKit();
  const tNav = useTranslations("nav_drawer");
  const tWallet = useTranslations("wallet");
  const walletConnected = Boolean(isConnected && address);
  const searchParams = useSearchParams();
  const refFromUrl = searchParams.get("ref");
  const [showRecommenderModal, setShowRecommenderModal] = useState(false);
  const [referralCodeFromUrl, setReferralCodeFromUrl] = useState("");

  useEffect(() => {
    const fetchUserInfo = async () => {
      if (!address) {
        return;
      }
      try {
        const response = await fetch(`/api/user/info?address=${address}`);
        if (!response.ok) {
          return;
        }
        const data = await response.json();
        if (refFromUrl && !data.superior) {
          setReferralCodeFromUrl(refFromUrl);

          // Add 500ms delay before showing the modal
          setTimeout(() => {
            setShowRecommenderModal(true);
          }, 1000);
        }
      } catch {}
    };
    fetchUserInfo();
  }, [address, refFromUrl]);

  const homeLogoHref = `/node/${searchParams.toString() ? `?${searchParams.toString()}` : ""}`;

  return (
    <header
      className={`fixed left-0 right-0 top-0 z-30 transition-colors duration-300 ${
        isHome ? "shadow-sm" : "bg-transparent"
      }`}
      style={
        isHome
          ? {
              backgroundImage:
                "linear-gradient(0deg, rgb(229, 14, 15) 0%, rgb(104, 10, 113) 100%)",
            }
          : undefined
      }
    >
      <div className="mx-auto max-w-[1900px] px-4 sm:px-6 lg:px-8 2xl:px-16">
        {isHome ? (
          /* ── Home page: full header with logo + wallet address ── */
          <div className="grid h-14 grid-cols-[1fr_auto_1fr] items-center gap-2">
            <div className="flex min-w-0 justify-start">
              <button
                type="button"
                onClick={() => setSideMenuOpen(true)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-[#680a71] shadow-sm transition hover:bg-white/95"
                aria-label={tNav("open_menu")}
              >
                <svg
                  className="h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  aria-hidden
                >
                  <line x1="4" y1="6" x2="20" y2="6" />
                  <line x1="4" y1="12" x2="20" y2="12" />
                  <line x1="4" y1="18" x2="20" y2="18" />
                </svg>
              </button>
            </div>

            <div className="flex min-w-0 justify-center [&_img]:h-7 [&_img]:w-auto">
              <Link
                href={homeLogoHref}
                className="inline-flex shrink-0 items-center"
                aria-label="HarmonyLink"
              >
                <Image
                  src="/imgs/home/logo.png"
                  alt="HarmonyLink"
                  width={140}
                  height={40}
                  className="h-7 w-auto object-contain"
                  priority
                />
              </Link>
            </div>

            <div className="flex min-w-0 justify-end">
              <button
                type="button"
                onClick={() => openWallet()}
                className={
                  walletConnected
                    ? "max-w-[min(100%,11rem)] truncate font-mono text-[11px] font-medium tracking-tight text-white sm:max-w-[14rem] sm:text-xs"
                    : "rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-[#680a71] shadow-sm transition hover:bg-white/95"
                }
              >
                {walletConnected ? formatHeaderId(address) : tWallet("connect_wallet")}
              </button>
            </div>
          </div>
        ) : (
          /* ── Other pages: menu + wallet / connect ── */
          <div className="flex h-14 items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setSideMenuOpen(true)}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-sm transition hover:bg-white/25"
              aria-label={tNav("open_menu")}
            >
              <svg
                className="h-4 w-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                aria-hidden
              >
                <line x1="4" y1="6" x2="20" y2="6" />
                <line x1="4" y1="12" x2="20" y2="12" />
                <line x1="4" y1="18" x2="20" y2="18" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => openWallet()}
              className={
                walletConnected
                  ? "max-w-[min(100%,11rem)] truncate font-mono text-[11px] font-medium tracking-tight text-white sm:max-w-[14rem] sm:text-xs"
                  : "shrink-0 rounded-full bg-white/15 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm transition hover:bg-white/25"
              }
            >
              {walletConnected ? formatHeaderId(address) : tWallet("connect_wallet")}
            </button>
          </div>
        )}
      </div>

      {/* Recommender Modal */}
      <RecommenderModal
        isOpen={showRecommenderModal}
        onClose={() => setShowRecommenderModal(false)}
        initialReferralCode={referralCodeFromUrl}
      />

      <SideNavDrawer open={sideMenuOpen} onClose={() => setSideMenuOpen(false)} />
    </header>
  );
}
