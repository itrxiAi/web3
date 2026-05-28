"use client";

import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useAppKitAccount } from "@reown/appkit/react";
import LoadingSpinnerWithText from "@/components/LoadingSpinnerWithText";
import { TransactionModal } from "@/components/TransactionModal";
import { triggerWalletConnect } from "@/components/ui/wallet-ref";
import {
  pickSubscribeNodeKind,
  useCommunityNodePurchase,
} from "@/hooks/useCommunityNodePurchase";

const BENEFIT_KEYS = [
  "benefit_1",
  "benefit_2",
  "benefit_3",
  "benefit_4",
  "benefit_5",
] as const;

export default function EarlyConsensusSubscribe() {
  const t = useTranslations("subscribe_page");
  const searchParams = useSearchParams();
  const { address } = useAppKitAccount();

  const {
    nodeData,
    ready,
    isJoining,
    handleCommunity,
    showTxModal,
    setShowTxModal,
    showTxErrorModal,
    setShowTxErrorModal,
    txSignature,
    txErrorMessage,
  } = useCommunityNodePurchase();

  const onSubscribe = () => {
    const ref = searchParams.get("ref")?.trim() ?? "";
    if (!address) {
      triggerWalletConnect();
      return;
    }
    if (!ready || !nodeData) return;
    const { type, price } = pickSubscribeNodeKind(nodeData);
    void handleCommunity(type, price, ref);
  };

  if (isJoining) {
    return <LoadingSpinnerWithText />;
  }

  return (
    <>
      <TransactionModal
        isOpen={showTxModal}
        onClose={() => {
          setShowTxModal(false);
          window.location.reload();
        }}
        type="success"
        txSignature={txSignature}
      />
      <TransactionModal
        isOpen={showTxErrorModal}
        onClose={() => setShowTxErrorModal(false)}
        type="error"
        message={txErrorMessage}
      />

      <div className="relative min-h-screen overflow-hidden bg-gradient-to-b from-[#000814] via-[#061228] to-[#001d3d] pb-16 pt-[4.5rem] text-white">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.12]"
          aria-hidden
        >
          <Image
            src="/images/subscribe-bg.png"
            alt=""
            fill
            className="object-cover object-top"
            sizes="100vw"
            priority
          />
        </div>
        <div className="relative z-10 mx-auto max-w-lg px-4">
          <h1 className="text-center text-xl font-bold tracking-tight text-white">
            {t("title")}
          </h1>

          <div
            className="mt-8 rounded-2xl border border-white/10 px-4 py-5 shadow-[0_16px_48px_rgba(0,0,0,0.45)] sm:px-5"
            style={{
              background:
                "linear-gradient(180deg, rgba(90,12,18,0.95) 0%, rgba(74,4,4,0.98) 35%, rgba(80,0,40,0.95) 100%)",
            }}
          >
            <p className="text-left text-[13px] leading-[1.85] text-white/95 sm:text-sm">
              {t("intro")}
            </p>

            <ol className="mt-5 list-none space-y-3 pl-0">
              {BENEFIT_KEYS.map((key, i) => (
                <li
                  key={key}
                  className="flex gap-2 text-left text-[13px] leading-[1.75] text-white/95 sm:text-sm"
                >
                  <span className="shrink-0 font-bold text-white">{i + 1}</span>
                  <span className="whitespace-pre-line">{t(key)}</span>
                </li>
              ))}
            </ol>

            <p className="mt-6 text-left text-[12px] leading-relaxed text-[#ff8a8a] sm:text-[13px]">
              {t("note")}
            </p>
          </div>

          <p className="mt-8 text-center text-sm font-semibold leading-snug text-[#ff4d4d]">
            {t("urgency")}
          </p>
          <p className="mt-3 text-center text-sm text-white/95">
            {t("price_line")}
          </p>

          <div className="mt-8 flex justify-center">
            <button
              type="button"
              onClick={onSubscribe}
              disabled={Boolean(address && (!ready || !nodeData))}
              className="inline-flex min-w-[min(100%,280px)] items-center justify-center rounded-full bg-gradient-to-r from-[#c41e3a] via-[#9b1b4a] to-[#6b2d8a] px-10 py-3.5 text-center text-base font-bold text-white shadow-lg shadow-black/30 transition hover:brightness-110 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {t("cta")}
            </button>
          </div>

          <div className="mt-10 space-y-4 text-left text-[12px] leading-relaxed text-[#a2d2ff] sm:text-[13px]">
            <p>{t("footer_1")}</p>
            <p>{t("footer_2")}</p>
          </div>
        </div>
      </div>
    </>
  );
}
