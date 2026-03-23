"use client";

export default function DownloadPage() {
  type FileType = "pdf" | "jpg" | "mp4";
  type DownloadItem = {
    key: string;
    id: string;
    type: FileType;
    label: string;
    href?: string;
  };

  // NOTE: 这里的 href 目前未配置真实下载地址；先把 UI/交互做成和截图一致的结构，后续把链接填上即可。
  const items: DownloadItem[] = [
    { key: "business-zh", id: "business", type: "pdf", label: "HarmonyLink商业计划书（中文版）" },
    { key: "business-en", id: "business", type: "pdf", label: "HarmonyLink商业计划书（英文）" },
    { key: "whitepaper-zh", id: "whitepaper", type: "pdf", label: "HarmonyLink白皮书（中文版）" },
    { key: "whitepaper-en", id: "whitepaper", type: "pdf", label: "HarmonyLink白皮书（英文）" },
    { key: "long-pic-zh", id: "app", type: "jpg", label: "HarmonyLink长图（中文）" },
    { key: "long-pic-en", id: "app", type: "jpg", label: "HarmonyLink长图（英文）" },
    { key: "tutorial-zh", id: "app", type: "mp4", label: "HarmonyLink使用教程视频（中文）" },
    { key: "tutorial-en", id: "app", type: "mp4", label: "HarmonyLink使用教程视频（英文）" },
  ];

  function DownloadArrowIcon({ disabled }: { disabled?: boolean }) {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M12 4v12"
          stroke={disabled ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.65)"}
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path
          d="M8 11l4 4 4-4"
          stroke={disabled ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.65)"}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M5 20h14"
          stroke={disabled ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.65)"}
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  function FileIcon({ type }: { type: FileType }) {
    // 下面的图标用 SVG 近似截图中的“文件卡片”视觉效果（PDF/JPG/MP4）。
    // 只为匹配 UI，不依赖外部资源文件。
    if (type === "pdf") {
      return (
        <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-white/90 shadow-[0_10px_25px_-10px_rgba(0,0,0,0.6)]">
          <svg width="44" height="44" viewBox="0 0 48 48" fill="none" aria-hidden>
            <path d="M14 6h15l5 5v31H14V6Z" fill="#ffffff" />
            <path d="M29 6h5l-5 5V6Z" fill="#e24b4b" />
            <path d="M14 6h15l5 5v31H14V6Z" stroke="#e5e7eb" strokeWidth="1.5" />
            <path
              d="M21 33c2.2-5.7 4.4-11.4 6.6-17.1.1-.3.6-.3.7 0 2.1 5.7 4.3 11.4 6.4 17.1"
              stroke="#e24b4b"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <path d="M20 34h16" stroke="#e24b4b" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </div>
      );
    }
    if (type === "jpg") {
      return (
        <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-white/90 shadow-[0_10px_25px_-10px_rgba(0,0,0,0.6)]">
          <svg width="44" height="44" viewBox="0 0 48 48" fill="none" aria-hidden>
            <rect x="14" y="8" width="22" height="30" rx="2" fill="#ffffff" />
            <path d="M14 30h22v8H14v-8Z" fill="#e6e6e6" />
            <path d="M14 8h22v22H14V8Z" fill="#f8fafc" />
            <rect x="14" y="30" width="22" height="10" rx="1.5" fill="#6d28d9" opacity="0.95" />
            <text x="25" y="38" textAnchor="middle" fontSize="9" fontFamily="Arial" fontWeight="700" fill="#fff">
              JPG
            </text>
          </svg>
        </div>
      );
    }
    return (
      <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-white/90 shadow-[0_10px_25px_-10px_rgba(0,0,0,0.6)]">
        <svg width="44" height="44" viewBox="0 0 48 48" fill="none" aria-hidden>
          <path d="M14 14h20v20H14V14Z" fill="#ffffff" />
          <path d="M18 10h16l4 4v24l-4 4H18l-4-4V14l4-4Z" fill="#f8fafc" />
          <path d="M18 18l10 6-10 6V18Z" fill="#0f172a" opacity="0.85" />
          <path d="M16 30h16" stroke="#111827" strokeWidth="2" strokeLinecap="round" />
          <rect x="14" y="30" width="22" height="10" rx="1.5" fill="#0f172a" opacity="0.9" />
          <text x="25" y="38" textAnchor="middle" fontSize="9" fontFamily="Arial" fontWeight="700" fill="#fff">
            mp4
          </text>
        </svg>
      </div>
    );
  }

  function Section({
    id,
    title,
    items,
  }: {
    id: "app" | "business" | "whitepaper";
    title: string;
    items: DownloadItem[];
  }) {
    return (
      <section id={id} className="scroll-mt-[160px]">
        <div className="flex justify-center">
          <div className="w-[320px] rounded-md border border-[#21c7a2]/40 bg-[#0c6d60]/70 px-4 py-2 text-center shadow-[0_12px_30px_-18px_rgba(0,0,0,0.9)]">
            <h2 className="text-sm font-semibold tracking-wide text-white/90">{title}</h2>
          </div>
        </div>

        <ul className="mt-5 space-y-3">
          {items.map((it) => {
            const disabled = !it.href;
            return (
              <li key={it.key} className="px-2">
                <a
                  href={it.href ?? "#"}
                  onClick={(e) => {
                    if (!it.href) e.preventDefault();
                  }}
                  className={[
                    "group flex items-center justify-between gap-4 rounded-lg px-2 py-2",
                    "hover:bg-white/5 transition-colors",
                    disabled ? "cursor-not-allowed opacity-70" : "cursor-pointer",
                  ].join(" ")}
                >
                  <div className="flex min-w-0 items-center gap-4">
                    <FileIcon type={it.type} />
                    <span className="truncate text-sm font-medium text-white/90">{it.label}</span>
                  </div>

                  <div className="flex shrink-0 items-center justify-center pr-2 transition-colors group-hover:text-white/90">
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

  const businessItems = items.filter((x) => x.id === "business");
  const whitepaperItems = items.filter((x) => x.id === "whitepaper");
  const otherItems = items.filter((x) => x.id === "app");

  return (
    <div className="relative min-h-screen overflow-hidden bg-black px-4 pb-24 pt-28 text-white">
      {/* 截图同款深蓝绿渐变底 */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 50% 35%, rgba(16, 185, 129, 0.28) 0%, rgba(0,0,0,0) 48%), radial-gradient(circle at 30% 70%, rgba(59, 130, 246, 0.18) 0%, rgba(0,0,0,0) 55%), linear-gradient(180deg, rgba(0, 94, 90, 0.65) 0%, rgba(0, 14, 20, 0.92) 100%)",
        }}
      />

      {/* 轻微噪点/光晕 */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 60% 10%, rgba(99, 102, 241, 0.15) 0%, rgba(0,0,0,0) 45%)",
          mixBlendMode: "screen",
          opacity: 0.8,
        }}
      />

      <div className="relative mx-auto flex w-full max-w-[420px] flex-col items-center">
        <h1 className="text-center text-[20px] font-semibold tracking-wider text-white/95">
          HarmonyLink资料下载
        </h1>

        <div className="mt-8 w-full space-y-10">
          <div className="w-full">
            <Section id="business" title="商业计划书下载" items={businessItems} />
          </div>

          <div className="w-full">
            <div className="mb-6 h-px w-full bg-white/10" />
            <Section id="whitepaper" title="白皮书下载" items={whitepaperItems} />
          </div>

          <div className="w-full">
            <div className="mb-6 h-px w-full bg-white/10" />
            <Section id="app" title="其它资料下载" items={otherItems} />
          </div>
        </div>
      </div>
    </div>
  );
}
