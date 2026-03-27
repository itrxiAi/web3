"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";

const HOME_LOGO_SRC = "/imgs/home/logo.png";
const HOME_HERO_BG = "/imgs/home/home1.png";

interface Proclamation {
  index: number;
  title: string;
  content: string;
  updated_at: string;
  picture: string;
}

type EngineCard = { title: string; desc: string };

function EcosystemOrbit() {
  const dots = useMemo(
    () =>
      Array.from({ length: 48 }).map((_, i) => {
        const angle = (i / 48) * Math.PI * 2;
        const r = 38 + (i % 3) * 8;
        const x = 50 + Math.cos(angle) * r;
        const y = 50 + Math.sin(angle) * r;
        return { x, y, s: 1 + (i % 4) * 0.4 };
      }),
    []
  );

  return (
    <div className="relative mx-auto aspect-square w-full max-w-md">
      <svg viewBox="0 0 100 100" className="h-full w-full text-white/15">
        <circle cx="50" cy="50" r="46" fill="none" stroke="currentColor" strokeWidth="0.35" />
        <circle cx="50" cy="50" r="36" fill="none" stroke="currentColor" strokeWidth="0.35" />
        <circle cx="50" cy="50" r="26" fill="none" stroke="currentColor" strokeWidth="0.35" />
        <circle cx="50" cy="50" r="16" fill="none" stroke="currentColor" strokeWidth="0.35" />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="relative h-16 w-16 overflow-hidden rounded-full bg-black/40 p-2 ring-1 ring-white/20">
          <Image src={HOME_LOGO_SRC} alt="" fill className="object-contain p-1" sizes="64px" />
        </div>
      </div>
      {dots.map((d, i) => (
        <div
          key={i}
          className="absolute rounded-full bg-gradient-to-br from-cyan-400/80 to-fuchsia-500/60"
          style={{
            left: `${d.x}%`,
            top: `${d.y}%`,
            width: `${d.s}px`,
            height: `${d.s}px`,
            transform: "translate(-50%, -50%)",
          }}
        />
      ))}
    </div>
  );
}

export default function HarmonyLanding() {
  const t = useTranslations("home");
  const router = useRouter();
  const locale = useLocale();
  const [proclaims, setProclaims] = useState<Proclamation[]>([]);
  const [levelCounts, setLevelCounts] = useState<{ level: number; count: number }[]>([]);

  useEffect(() => {
    const fetchProclaim = async () => {
      try {
        const response = await fetch("/api/info/proclaims", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ locale }),
        });
        const data = await response.json();
        if (data.proclamation != null) setProclaims(data.proclamation);
      } catch (e) {
        console.error(e);
      }
    };
    const fetchLevels = async () => {
      try {
        const response = await fetch("/api/info/level", { method: "POST", headers: { "Content-Type": "application/json" } });
        const data = await response.json();
        if (Array.isArray(data)) setLevelCounts(data);
      } catch (e) {
        console.error(e);
      }
    };
    fetchProclaim();
    fetchLevels();
  }, [locale]);

  const engineCards = (t.raw("harmony.engine_cards") as EngineCard[] | undefined) ?? [];

  const statBars = useMemo(() => {
    const fallback = [
      { level: 1, count: 32 },
      { level: 2, count: 58 },
      { level: 3, count: 44 },
    ];
    const src = levelCounts.length >= 3 ? levelCounts.slice(0, 3) : fallback;
    const max = Math.max(...src.map((x) => x.count), 1);
    const labels = [t("harmony.stat_ecosystem"), t("harmony.stat_growth"), t("harmony.stat_consensus")];
    return src.map((x, i) => ({
      ...x,
      h: Math.round((x.count / max) * 100),
      label: labels[i] ?? "",
      color: ["bg-sky-400", "bg-amber-300", "bg-emerald-400"][i],
    }));
  }, [levelCounts, t]);

  return (
    <div className="flex flex-col bg-[#050608] text-white">
      {/* Hero：首张背景图 + 居中 Logo（顶部渐变在项目 Header 中） */}
      <section className="relative min-h-[56vh] overflow-hidden pb-8 pt-16">
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: `url(${HOME_HERO_BG})` }}
        />
        <div
          className="absolute inset-0 bg-gradient-to-b from-black/35 via-black/25 to-black/80"
          aria-hidden
        />

        <div className="relative z-10 mx-auto flex max-w-3xl flex-col items-center px-4 pt-6 text-center">
          <h1 className="sr-only">HarmonyLink</h1>
          <div className="relative mx-auto h-28 w-44 sm:h-32 sm:w-52 md:h-36 md:w-60">
            <Image
              src={HOME_LOGO_SRC}
              alt="HarmonyLink"
              fill
              className="object-contain"
              priority
              sizes="(max-width: 768px) 176px, 240px"
            />
          </div>
          <p className="mt-6 max-w-xl text-sm leading-relaxed text-white/90 drop-shadow sm:text-base">{t("harmony.hero_subtitle")}</p>
          <div className="mx-auto mt-6 h-1 w-12 rounded-full bg-white/80" />

          {proclaims.length > 0 && (
            <div className="mt-10 w-full max-w-2xl overflow-hidden rounded-lg border border-white/10 bg-black/40">
              <div className="animate-marquee flex whitespace-nowrap py-2">
                {proclaims.map((p, i) => (
                  <button
                    key={i}
                    type="button"
                    className={`inline-flex items-center px-6 text-sm text-white/90 ${i > 0 ? "border-l border-white/10" : ""}`}
                    onClick={() => router.push(`/my/proclaim/${p.index}`)}
                  >
                    {p.title}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* About Harmony */}
      <section className="relative border-y border-white/5 bg-gradient-to-b from-[#0a1628] via-[#070d18] to-[#050608] py-14">
        <div className="pointer-events-none absolute left-1/4 top-10 h-40 w-40 rounded-full bg-blue-500/20 blur-3xl" />
        <div className="pointer-events-none absolute right-1/4 bottom-10 h-36 w-36 rounded-full bg-purple-500/15 blur-3xl" />

        <div className="relative z-10 mx-auto grid max-w-5xl gap-10 px-4 md:grid-cols-2 md:items-center">
          <div>
            <h2 className="text-xl font-bold text-white sm:text-2xl">{t("harmony.about_title")}</h2>
            <p className="mt-4 text-sm leading-relaxed text-white/70">{t("harmony.about_body")}</p>
            <Link
              href="/about"
              className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-sky-300/95 underline-offset-4 transition hover:text-white hover:underline"
            >
              {t("harmony.detail_link")}
              <span aria-hidden className="text-base leading-none">→</span>
            </Link>
          </div>
          <div className="flex flex-col items-center gap-6 md:flex-row md:justify-end">
            <div className="relative h-24 w-24 shrink-0">
              <Image src={HOME_LOGO_SRC} alt="HarmonyLink" fill className="object-contain" sizes="96px" />
            </div>
            <div className="flex flex-1 items-end justify-center gap-4 sm:gap-6">
              {statBars.map((b) => (
                <div key={b.level} className="flex flex-col items-center gap-2">
                  <div className="flex h-28 w-10 items-end justify-center rounded-t bg-white/5">
                    <div className={`w-full rounded-t ${b.color}`} style={{ height: `${Math.max(b.h, 12)}%` }} />
                  </div>
                  <span className="text-[10px] text-white/50">{b.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Web3 traffic */}
      <section className="relative py-16">
        <div className="absolute inset-0 bg-gradient-to-br from-orange-950/90 via-amber-900/50 to-slate-950/95" />
        <div className="relative z-10 mx-auto max-w-3xl px-4 text-center">
          <h2 className="text-xl font-bold text-white sm:text-2xl">{t("harmony.traffic_title")}</h2>
          <p className="mt-4 text-sm leading-relaxed text-white/80">{t("harmony.traffic_body")}</p>
        </div>
      </section>

      {/* OS + phone */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#7f1d1d] via-[#9a3412] to-[#c2410c] py-16">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.12),transparent_50%)]" />
        <div className="relative z-10 mx-auto grid max-w-5xl items-center gap-10 px-4 md:grid-cols-2">
          <div>
            <h2 className="text-xl font-bold text-white sm:text-2xl">{t("harmony.os_title")}</h2>
            <p className="mt-4 text-sm leading-relaxed text-white/90">{t("harmony.os_body")}</p>
          </div>
          <div className="mx-auto flex w-full max-w-[260px] justify-center">
            <div className="relative aspect-[9/19] w-full rounded-[2rem] border border-white/25 bg-gradient-to-b from-slate-900 to-slate-950 p-3 shadow-2xl shadow-black/50">
              <div className="h-full w-full rounded-[1.5rem] bg-gradient-to-b from-sky-900/40 to-slate-950 ring-1 ring-white/10" />
              <div className="absolute bottom-3 left-1/2 h-1 w-16 -translate-x-1/2 rounded-full bg-white/20" />
            </div>
          </div>
        </div>
      </section>

      {/* Engine cards */}
      <section className="bg-zinc-100 py-16 text-zinc-900">
        <div className="mx-auto max-w-5xl px-4">
          <div className="mb-10 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="mb-2 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-pink-500 to-rose-600 text-white shadow-lg">
                <span className="text-xs">◆</span>
              </div>
              <h2 className="text-2xl font-bold">{t("harmony.engine_title")}</h2>
            </div>
            <p className="max-w-md text-sm leading-relaxed text-zinc-600">{t("harmony.engine_body")}</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {engineCards.map((card, i) => (
                <div
                  key={i}
                  className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm transition hover:-translate-y-1 hover:shadow-md"
                  style={{ transform: `rotate(${-4 + i * 2}deg)` }}
                >
                  <div className="text-xs font-bold text-zinc-400">0{i + 1}</div>
                  <div className="mt-2 text-sm font-semibold text-zinc-900">{card.title}</div>
                  <p className="mt-2 text-xs leading-relaxed text-zinc-600">{card.desc}</p>
                </div>
              ))}
          </div>
        </div>
      </section>

      {/* Orbit */}
      <section className="border-t border-white/5 bg-[#030508] py-16">
        <div className="mx-auto max-w-3xl px-4 text-center">
          <h2 className="text-xl font-bold">{t("harmony.orbit_title")}</h2>
          <p className="mt-2 text-sm text-white/55">{t("harmony.orbit_subtitle")}</p>
          <div className="mt-10">
            <EcosystemOrbit />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-teal-900/50 bg-[#0a1214] py-12">
        <div className="mx-auto grid max-w-5xl gap-10 px-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-teal-400/90">{t("harmony.footer_tools")}</h3>
            <ul className="mt-4 space-y-2 text-sm text-white/65">
              <li>
                <span className="cursor-default hover:text-white">{t("harmony.footer_sdk")}</span>
              </li>
              <li>
                <span className="cursor-default hover:text-white">{t("harmony.footer_wallet")}</span>
              </li>
              <li>
                <span className="cursor-default hover:text-white">{t("harmony.footer_devbox")}</span>
              </li>
            </ul>
          </div>
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-teal-400/90">{t("harmony.footer_dev")}</h3>
            <ul className="mt-4 space-y-2 text-sm text-white/65">
              <li>
                <span className="cursor-default hover:text-white">{t("harmony.footer_account_kit")}</span>
              </li>
              <li>
                <span className="cursor-default hover:text-white">{t("harmony.footer_ads_kit")}</span>
              </li>
              <li>
                <span className="cursor-default hover:text-white">{t("harmony.footer_game_kit")}</span>
              </li>
            </ul>
          </div>
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-teal-400/90">{t("harmony.footer_resources")}</h3>
            <ul className="mt-4 space-y-2 text-sm text-white/65">
              <li>
                <Link href="/download#whitepaper" className="hover:text-white">
                  {t("harmony.footer_whitepaper")}
                </Link>
              </li>
              <li>
                <Link href="/about" className="hover:text-white">
                  {t("harmony.footer_community")}
                </Link>
              </li>
              <li>
                <Link href="/download" className="hover:text-white">
                  {t("harmony.footer_docs")}
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-teal-400/90">{t("harmony.footer_programs")}</h3>
            <ul className="mt-4 space-y-2 text-sm text-white/65">
              <li>
                <span className="cursor-default hover:text-white">{t("harmony.footer_dev_groups")}</span>
              </li>
              <li>
                <span className="cursor-default hover:text-white">{t("harmony.footer_grants")}</span>
              </li>
            </ul>
          </div>
        </div>
        <div className="mx-auto mt-10 flex max-w-5xl items-center justify-between px-4">
          <Image src={HOME_LOGO_SRC} alt="HarmonyLink" width={80} height={80} className="h-10 w-auto object-contain opacity-90" />
          <p className="text-xs text-white/35">© {new Date().getFullYear()} HarmonyLink</p>
        </div>
      </footer>

      <div className="h-16 shrink-0 md:h-0" aria-hidden />
    </div>
  );
}
