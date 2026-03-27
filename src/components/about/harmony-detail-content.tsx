"use client";

import Image from "next/image";
import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
export default function HarmonyDetailContent() {
  const t = useTranslations("about_page");

  const bold = (chunks: ReactNode) => (
    <strong className="font-bold text-[#1a1a1a]">{chunks}</strong>
  );

  const bodyClass =
    "text-left [&_strong]:font-bold [&_strong]:text-[#1a1a1a]";

  // 主标题（原顶栏大标题，现放在正文最上方）
  const heroTitleStyle = {
    fontSize: "18px",
    letterSpacing: "1px",
    lineHeight: "1.4",
    fontWeight: "bold" as const,
    color: "#1a1a1a",
    fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif',
  };

  // 正文标题样式（中等）
  const titleStyle = {
    fontSize: "16px",
    letterSpacing: "0.5px",
    lineHeight: "1.4",
    color: "#1a1a1a",
    fontWeight: "bold",
    fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif',
  };

  // 正文段落样式（常规）
  const paragraphStyle = {
    fontSize: "14px",
    letterSpacing: "0.5px",
    lineHeight: "1.5",
    color: "#333333", // 正文颜色稍微柔和一点
    fontWeight: "normal",
    fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif',
  };

  return (
    <div className="min-h-screen bg-white">
      <header
        className="min-h-[60px] w-full shadow-sm"
        style={{
          backgroundImage: "linear-gradient(0deg, #e50e0f 0%, #680a71 100%)",
        }}
        aria-hidden
      />

      <main className="mx-auto max-w-[min(100%,560px)] px-4 pb-28 pt-6 sm:px-6">
        <article className="space-y-6"> {/* 减小段落之间的整体间距 (space-y-10 -> space-y-6) */}
          <h1 className="text-center pb-1" style={heroTitleStyle}>
            {t("hero_title")}
          </h1>

          <section>
            <h2 style={titleStyle}>
              {t("section1_title")}
            </h2>
            <p className={`mt-2 ${bodyClass}`} style={paragraphStyle}>{t.rich("section1_body", { b: bold })}</p> {/* 减小标题和正文间距 mt-4 -> mt-2 */}
          </section>

          <section>
            <h2 style={titleStyle}>
              {t("section2_title")}
            </h2>
            <div className={`mt-2 space-y-2 ${bodyClass}`} style={paragraphStyle}> {/* 减小标题和正文间距 mt-4 -> mt-2, 减小列表项间距 space-y-3 -> space-y-2 */}
              <p>{t.rich("section2_p1", { b: bold })}</p>
              <p>{t("section2_lead")}</p>
              <p>{t.rich("section2_entry4d", { b: bold })}</p>
              <p>{t.rich("section2_compliance", { b: bold })}</p>
            </div>
          </section>

          {/* <figure className="py-2">
            <div className="relative w-full overflow-hidden rounded-xl bg-[#fafafa]">
              <Image
                src="/images/harmony-detail-hero.png"
                alt=""
                width={1200}
                height={1800}
                className="h-auto w-full object-contain object-center"
                sizes="(max-width: 560px) 100vw, 560px"
                priority
              />
            </div>
          </figure> */}

          <figure className="py-2"> {/* 减小图片上下间距 py-4 -> py-2 */}
            <div className="relative w-full overflow-hidden rounded-xl">
              <Image
                src="/imgs/detail/people.png"
                alt="People"
                width={1200}
                height={800}
                className="h-auto w-full object-contain object-center"
                sizes="(max-width: 560px) 100vw, 560px"
              />
            </div>
          </figure>

          <section>
            <h2 style={titleStyle}>
              {t("architecture_title")}
            </h2>

            <div className="mt-4 space-y-5"> {/* 减小标题和内容的间距 mt-6 -> mt-4, 减小区块间距 space-y-8 -> space-y-5 */}
              <div>
                <h3 style={titleStyle}>
                  <span className="mr-1 text-[#D00000]">1.</span>
                  {t("arch1_title")}
                </h3>
                <ul className={`mt-2 space-y-1.5 ${bodyClass}`} style={paragraphStyle}> {/* 减小列表间距 */}
                  <li>{t("arch1_bullet1")}</li>
                  <li>{t("arch1_bullet2")}</li>
                  <li className="font-medium text-[#1a1a1a]">{t("arch1_quote")}</li>
                </ul>
              </div>

              <div>
                <h3 style={titleStyle}>
                  <span className="mr-1 text-[#D00000]">2.</span>
                  {t("arch2_title")}
                </h3>
                <ul className={`mt-2 space-y-1.5 ${bodyClass}`} style={paragraphStyle}> {/* 减小列表间距 */}
                  <li>{t("arch2_bullet1")}</li>
                  <li>{t("arch2_bullet2")}</li>
                </ul>
              </div>
            </div>
          </section>

          <section className="border-t border-[#eee] pt-6"> {/* 减小分割线后的上边距 pt-10 -> pt-6 */}
            <h2 style={titleStyle}>
              {t("section4_title")}
            </h2>
            <div className={`mt-2 space-y-2 ${bodyClass}`} style={paragraphStyle}> {/* 减小间距 */}
              <p>{t.rich("section4_p1", { b: bold })}</p>
              <p>{t.rich("section4_p2", { b: bold })}</p>
              <p>{t("section4_p3")}</p>
              <p>{t.rich("section4_p4", { b: bold })}</p>
            </div>
          </section>
        </article>
      </main>
    </div>
  );
}
