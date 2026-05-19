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
/** 与首页使用同一套顶栏样式：根首页或「首页2」/home2 */
function useIsHomePage(): boolean {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);
  const locales = routing.locales as readonly string[];
  const isLocaleOnly = segments.length === 1 && locales.includes(segments[0]!);
  const isHome2 =
    segments.length === 2 && locales.includes(segments[0]!) && segments[1] === "home2";
  return isLocaleOnly || segments.length === 0 || isHome2;
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
    <>
    <header
      className={`fixed left-0 right-0 top-0 z-50 transition-colors duration-300 ${
        isHome
          ? "border-b border-white/[0.06] bg-[#050608]/92 shadow-[0_4px_24px_rgba(0,0,0,0.45)] backdrop-blur-md backdrop-saturate-150 supports-[backdrop-filter]:bg-[#050608]/80"
          : "bg-transparent"
      }`}
    >
      <div className="mx-auto max-w-[1900px] px-4 sm:px-6 lg:px-8 2xl:px-16">
        {isHome ? (
          /* ── Home page: full header with logo + wallet address ── */
          <div className="grid h-14 grid-cols-[1fr_auto_1fr] items-center gap-2">
            <div className="flex min-w-0 justify-start">
              <button
                type="button"
                onClick={() => setSideMenuOpen(true)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/10 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] transition hover:bg-white/15"
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
                    ? "max-w-[min(100%,11rem)] truncate font-mono text-[11px] font-medium tracking-tight text-white/90 sm:max-w-[14rem] sm:text-xs"
                    : "rounded-full border border-cyan-500/35 bg-cyan-500/15 px-3 py-1.5 text-xs font-semibold text-cyan-100 shadow-[0_0_20px_rgba(34,211,238,0.12)] transition hover:border-cyan-400/45 hover:bg-cyan-500/25"
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

    </header>

    {/* 与顶栏平级，避免被 header 的 backdrop-filter 创建的 containing block
        困住 fixed 元素（modal 会被夹在 header 那一条里）。 */}
    <RecommenderModal
      isOpen={showRecommenderModal}
      onClose={() => setShowRecommenderModal(false)}
      initialReferralCode={referralCodeFromUrl}
    />
    <SideNavDrawer open={sideMenuOpen} onClose={() => setSideMenuOpen(false)} />
    </>
  );
}
