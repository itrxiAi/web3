"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";

export default function DownloadPage() {
  const t = useTranslations("download_page");

  type FileType = "pdf" | "jpg" | "mp4";
  type DownloadItem = {
    key: string;
    categoryId: "business" | "whitepaper" | "other";
    type: FileType;
    label: string;
    href?: string;
  };

  /** Mock：三类 — 商业计划书、白皮书、其他资料（href 后续可接真实地址） */
  const items: DownloadItem[] = [
    { key: "business-zh", categoryId: "business", type: "pdf", label: t("file_business_zh"), href: "/documents/businessplan.pdf" },
    { key: "business-en", categoryId: "business", type: "pdf", label: t("file_business_en"), href: "/documents/businessplan.pdf" },
    { key: "whitepaper-zh", categoryId: "whitepaper", type: "pdf", label: t("file_whitepaper_zh"), href: "/documents/whitepaper.pdf" },
    { key: "whitepaper-en", categoryId: "whitepaper", type: "pdf", label: t("file_whitepaper_en"), href: "/documents/whitepaper.pdf" },
    { key: "long-pic-zh", categoryId: "other", type: "jpg", label: t("file_long_pic_zh"), href: "/documents/whitepaper.pdf" },
    { key: "long-pic-en", categoryId: "other", type: "jpg", label: t("file_long_pic_en"), href: "/documents/whitepaper.pdf" },
    { key: "tutorial-zh", categoryId: "other", type: "mp4", label: t("file_tutorial_zh"), href: "/documents/whitepaper.pdf" },
    { key: "tutorial-en", categoryId: "other", type: "mp4", label: t("file_tutorial_en"), href: "/documents/whitepaper.pdf" },
  ];

  const FILE_ICON_SRC: Record<FileType, string> = {
    pdf: "/imgs/docDown/pdf.png",
    jpg: "/imgs/docDown/jpg.png",
    mp4: "/imgs/docDown/mp4.png",
  };

  function DownloadArrowIcon({ disabled }: { disabled?: boolean }) {
    const stroke = disabled ? "rgba(255,255,255,0.75)" : "rgba(255,255,255,0.95)";
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M12 4v12" stroke={stroke} strokeWidth="2" strokeLinecap="round" />
        <path d="M8 11l4 4 4-4" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M5 20h14" stroke={stroke} strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }

  function FileIcon({ type }: { type: FileType }) {
    const src = FILE_ICON_SRC[type];
    return (
      <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg shadow-[0_8px_20px_-8px_rgba(0,0,0,0.75)] sm:h-14 sm:w-14">
        <Image
          src={src}
          alt=""
          width={56}
          height={56}
          className="h-full w-full object-contain"
          sizes="56px"
        />
      </div>
    );
  }

  function Section({
    id,
    title,
    sectionItems,
  }: {
    id: string;
    title: string;
    sectionItems: DownloadItem[];
  }) {
    return (
      <section id={id} className="scroll-mt-28">
        <div
          className="inline-block w-fit max-w-full rounded-none px-2.5 py-1 text-left sm:px-3 sm:py-1.5"
          style={{ backgroundColor: "#069488" }}
        >
          <h2 className="text-xs font-semibold tracking-wide text-white sm:text-sm">{title}</h2>
        </div>

        <ul className="mt-3 space-y-1 sm:space-y-2">
          {sectionItems.map((it) => {
            const disabled = !it.href;
            return (
              <li key={it.key}>
                <a
                  href={it.href ?? "#"}
                  onClick={(e) => {
                    if (!it.href) e.preventDefault();
                  }}
                  className={[
                    "group flex items-center justify-between gap-2 rounded-lg px-1 py-2.5 sm:gap-4 sm:px-2 sm:py-2",
                    "transition-colors hover:bg-white/5",
                    disabled ? "cursor-not-allowed opacity-75" : "cursor-pointer",
                  ].join(" ")}
                >
                  <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-4">
                    <FileIcon type={it.type} />
                    <span className="min-w-0 flex-1 text-left text-[13px] font-medium leading-snug text-white sm:text-sm">
                      {it.label}
                    </span>
                  </div>

                  <div className="flex shrink-0 items-center justify-center pr-0.5 sm:pr-2">
                    <DownloadArrowIcon disabled={disabled} />
                  </div>
                </a>
              </li>
            );
          })}
        </ul>
      </section>
    );
  }

  const businessItems = items.filter((x) => x.categoryId === "business");
  const whitepaperItems = items.filter((x) => x.categoryId === "whitepaper");
  const otherItems = items.filter((x) => x.categoryId === "other");

  return (
    <div className="relative min-h-screen overflow-hidden text-white">
      <div
        className="pointer-events-none absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url('/imgs/history/bg.png')" }}
        aria-hidden
      />
      <div className="pointer-events-none absolute inset-0 bg-black/35" aria-hidden />

      <div className="relative z-10 mx-auto w-full max-w-lg px-4 pb-28 pt-16 sm:max-w-xl sm:px-6 sm:pb-32 sm:pt-28">
        <h1 className="text-center text-lg font-semibold tracking-wide text-white drop-shadow-sm sm:text-left sm:text-[20px]">
          {t("page_heading")}
        </h1>

        <div className="mt-8 w-full space-y-8 sm:mt-10">
          <Section id="business" title={t("section_business")} sectionItems={businessItems} />
          <div className="h-px w-full bg-white/15" />
          <Section id="whitepaper" title={t("section_whitepaper")} sectionItems={whitepaperItems} />
          <div className="h-px w-full bg-white/15" />
          <Section id="other" title={t("section_other")} sectionItems={otherItems} />
        </div>
      </div>
    </div>
  );
}
