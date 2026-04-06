"use client";
// 左侧导航抽屉
import React, { useEffect, useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import LanguageSelector from "@/components/ui/language-selector";

type NavItem = {
  key: string;
  href: string;
};

const menuItems: NavItem[] = [
  { key: "home", href: "/" },
  // { key: "home2", href: "/home2" },
  { key: "history_records", href: "/history" },
  { key: "about", href: "/about" },
  { key: "early_consensus", href: "/node" },
  { key: "personal_center", href: "/my" },
  { key: "download_app", href: "/download#other" },
  { key: "download_business_plan", href: "/download#business" },
  { key: "download_whitepaper", href: "/download#whitepaper" },
  { key: "account_activation", href: "/activate" },
];

function MenuIcon({ name }: { name: string }) {
  const cls = "h-5 w-5 shrink-0 text-white/90";
  switch (name) {
    case "home":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M3 10.5L12 3l9 7.5V20a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1v-9.5z" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "about":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 16v-4M12 8h.01" strokeLinecap="round" />
        </svg>
      );
    case "early":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="12" cy="12" r="9" />
          <path d="M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01" strokeLinecap="round" />
        </svg>
      );
    case "user":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="12" cy="8" r="3.5" />
          <path d="M6 19.5c0-3 2.5-5 6-5s6 2 6 5" strokeLinecap="round" />
        </svg>
      );
    case "download":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M12 4v11M8 11l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M5 20h14" strokeLinecap="round" />
        </svg>
      );
    case "stack":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M6 10l6-3 6 3-6 3-6-3z" />
          <path d="M6 14l6 3 6-3M6 18l6 3 6-3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "book":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M4 6a2 2 0 012-2h5v16H6a2 2 0 01-2-2V6zM13 4h5a2 2 0 012 2v12a2 2 0 01-2 2h-5V4z" />
        </svg>
      );
    case "check":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="12" cy="12" r="9" />
          <path d="M8 12l2.5 2.5L16 9" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "history":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    default:
      return null;
  }
}

const iconByKey: Record<string, string> = {
  home: "home",
  home2: "home",
  about: "about",
  early_consensus: "early",
  personal_center: "user",
  history_records: "history",
  download_app: "download",
  download_business_plan: "stack",
  download_whitepaper: "book",
  account_activation: "check",
};

function ChevronRight() {
  return (
    <svg className="h-5 w-5 shrink-0 text-white/70" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
      <path
        fillRule="evenodd"
        d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export default function SideNavDrawer({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const t = useTranslations("nav_drawer");
  const [mountedOpen, setMountedOpen] = useState(open);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    if (open) {
      setMountedOpen(true);
      setClosing(false);
      return;
    }
    if (!mountedOpen) return;
    setClosing(true);
    const t = window.setTimeout(() => {
      setMountedOpen(false);
    }, 260);
    return () => window.clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!mountedOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [mountedOpen, onClose]);

  if (!mountedOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex" role="dialog" aria-modal="true" aria-label={t("open_menu")}>
      <style>{`
        @keyframes xwechat_drawer_fade_in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes xwechat_drawer_fade_out {
          from { opacity: 1; }
          to { opacity: 0; }
        }
        @keyframes xwechat_drawer_slide_in {
          from { transform: translateX(-18px); opacity: 0.001; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes xwechat_drawer_slide_out {
          from { transform: translateX(0); opacity: 1; }
          to { transform: translateX(-18px); opacity: 0.001; }
        }
      `}</style>
      <button
        type="button"
        className="absolute inset-0 z-0 bg-black/65 backdrop-blur-[2px]"
        onClick={onClose}
        aria-label={t("close_menu")}
        style={{
          animation: closing ? "xwechat_drawer_fade_out 200ms ease-in forwards" : "xwechat_drawer_fade_in 220ms ease-out forwards",
        }}
      />

      <aside
        className="relative z-10 flex h-full w-full flex-col overflow-hidden shadow-2xl"
        style={{
          boxShadow: "8px 0 32px rgba(0,0,0,0.5)",
          animation: closing ? "xwechat_drawer_slide_out 240ms ease-in forwards" : "xwechat_drawer_slide_in 260ms ease-out forwards",
        }}
      >
        <div className="pointer-events-none absolute inset-0 bg-[#0b0c10]" aria-hidden />
        <div
          className="pointer-events-none absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: "url('/imgs/menu/menuBG.png')" }}
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/20 via-black/10 to-black/30"
          aria-hidden
        />

        <button
          type="button"
          onClick={onClose}
          aria-label={t("close_menu")}
          className="absolute right-4 top-4 z-20 flex h-10 w-10 items-center justify-center rounded-xl bg-black/30 text-white/90 backdrop-blur-sm transition hover:bg-black/45"
        >
          <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
            <path
              fillRule="evenodd"
              d="M12.707 15.707a1 1 0 01-1.414 0l-4.5-4.5a1 1 0 010-1.414l4.5-4.5a1 1 0 011.414 1.414L8.914 10l3.793 3.793a1 1 0 010 1.414z"
              clipRule="evenodd"
            />
          </svg>
        </button>

        <div className="relative z-10 flex shrink-0 justify-center overflow-hidden px-6 pb-6 pt-10">
          <Image
            src="/imgs/menu/logo.png"
            alt="HarmonyLink"
            width={150}
            height={150}
            className="h-[8.25rem] w-[8.25rem] max-w-full object-contain"
            priority
          />
        </div>

        <nav className="relative z-10 min-h-0 flex-1 overflow-y-auto  border-white/[0.06] bg-gradient-to-b from-white/[0.05] from-[8%] via-black/55 via-[55%] to-black to-[100%] py-2 backdrop-blur-md">
          <ul className="space-y-0">
            {menuItems.map((item: NavItem) => {
              const isDownloadLink = item.href.startsWith('/documents/');
              const LinkComponent = isDownloadLink ? 'a' : Link;
              
              return (
                <li key={item.key}>
                  <LinkComponent
                    href={item.href}
                    onClick={onClose}
                    className="flex items-center gap-3 px-4 py-3.5 text-[15px] font-medium text-white/95 transition hover:bg-white/[0.06]"
                    {...(isDownloadLink && { target: '_blank', rel: 'noopener noreferrer' })}
                  >
                    <MenuIcon name={iconByKey[item.key] ?? "home"} />
                    <span className="min-w-0 flex-1 leading-snug">{t(item.key)}</span>
                    <ChevronRight />
                  </LinkComponent>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="relative z-10 flex shrink-0 items-center justify-between border-t border-white/10 bg-black px-4 py-4">
          <Image src="/imgs/menu/logo-samll.png" alt="" width={48} height={48} className="h-8 w-auto object-contain opacity-90" />
          <div className="flex items-center text-white/80">
            <LanguageSelector showLocaleCode dropUp />
          </div>
        </div>
      </aside>
    </div>
  );
}
