"use client";

import { Suspense, useMemo, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useAppKitAccount } from "@reown/appkit/react";
import LoadingSpinner from "@/components/LoadingSpinner";
import { TransactionModal } from "@/components/TransactionModal";
import { triggerWalletConnect } from "@/components/ui/wallet-ref";
import {
  useEquityActivation,
  isEquityDevType,
  type EquityTierInfo,
} from "@/hooks/useEquityActivation";
import {
  EQUITY_BASE_TYPE,
  EQUITY_PLUS_TYPE,
  EQUITY_PREMIUM_TYPE,
} from "@/constants";

function tierKey(devType: string): "base" | "plus" | "premium" {
  if (devType === EQUITY_PLUS_TYPE) return "plus";
  if (devType === EQUITY_PREMIUM_TYPE) return "premium";
  return "base";
}

function ActivateInner() {
  const t = useTranslations("equity_activation_page");
  const searchParams = useSearchParams();
  const { address } = useAppKitAccount();
  const [selected, setSelected] = useState<string>(EQUITY_BASE_TYPE);
  const [referralInput, setReferralInput] = useState("");

  useEffect(() => {
    const r = searchParams.get("ref");
    if (r) setReferralInput(r);
  }, [searchParams]);

  const referralCode = useMemo(
    () => (searchParams.get("ref") || referralInput).trim(),
    [searchParams, referralInput]
  );

  const {
    tiers,
    isPaying,
    payEquity,
    showTxModal,
    setShowTxModal,
    showTxErrorModal,
    setShowTxErrorModal,
    txErrorMessage,
    txSignature,
  } = useEquityActivation({ referralCode });

  const selectedTier: EquityTierInfo | undefined = tiers?.find((x) => x.dev_type === selected);
  const selectedLabel = selectedTier?.price_display ?? "—";

  const onPay = () => {
    if (!address) {
      triggerWalletConnect();
      return;
    }
    if (!selected || !isEquityDevType(selected)) return;
    void payEquity(selected);
  };

  if (!tiers?.length) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <LoadingSpinner />
      </div>
    );
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

      <div className="relative mx-auto max-w-[min(100%,480px)] px-4 pb-24 pt-16 sm:px-5">
        <h1 className="mb-6 text-center text-xl font-bold tracking-wide text-white">
          {t("title")}
        </h1>

        {/* 说明区 */}
        <div
          className="mb-5 rounded-[10px] border border-white/10 p-3 text-xs leading-snug shadow-inner"
          style={{
            backgroundImage: "linear-gradient(165deg, rgba(104,10,113,0.95) 0%, rgba(80,12,24,0.98) 100%)",
          }}
        >
          <p className="mb-0 whitespace-pre-line leading-relaxed text-white/95">{t("intro")}</p>
        </div>

        {/* 对比表：第1行 #650a73，第2行 #89161f，第3行同第1，第4行同第2 */}
        <div className="mb-4 overflow-hidden rounded-lg border border-white/15 text-[11px] sm:text-xs">
          <div
            className="grid grid-cols-[minmax(0,0.42fr)_1fr] gap-0 px-2 py-2 font-semibold text-white/95 sm:px-3"
            style={{ backgroundColor: "#650a73" }}
          >
            <div>{t("table_col_option")}</div>
            <div className="text-right sm:text-left">{t("table_col_benefits")}</div>
          </div>
          {[EQUITY_BASE_TYPE, EQUITY_PLUS_TYPE, EQUITY_PREMIUM_TYPE].map((dt, idx) => {
            const tier = tiers.find((x) => x.dev_type === dt);
            const k = tierKey(dt);
            const rowBg = idx % 2 === 0 ? "#89161f" : "#650a73";
            return (
              <div
                key={dt}
                className="grid grid-cols-[minmax(0,0.42fr)_1fr] gap-0 border-t border-white/10 px-2 py-2 sm:px-3"
                style={{ backgroundColor: rowBg }}
              >
                <div className="font-semibold text-[#f0c0c8]">
                  {tier?.price_display ?? ""} USDT
                </div>
                <div className="text-[10px] leading-snug text-white/88 sm:text-[11px]">
                  {t(`row_benefit_${k}`)}
                </div>
              </div>
            );
          })}
        </div>

        {/* 选档 */}
        <p className="mb-2 text-center text-xs font-medium" style={{ color: "#2dd4bf" }}>
          {t("select_hint")}
        </p>
        <div className="mb-3 flex gap-2">
          {tiers.map((tier) => {
            const active = selected === tier.dev_type;
            return (
              <button
                key={tier.dev_type}
                type="button"
                onClick={() => setSelected(tier.dev_type)}
                className="flex-1 rounded-lg py-2.5 text-center text-xs font-bold transition sm:text-sm"
                style={
                  active
                    ? {
                        background: "linear-gradient(180deg, #2dd4bf 0%, #14b8a6 100%)",
                        color: "#0f172a",
                        boxShadow: "0 0 16px rgba(45,212,191,0.35)",
                      }
                    : {
                        background: "rgba(55, 55, 65, 0.65)",
                        color: "rgba(255,255,255,0.85)",
                        border: "1px solid rgba(255,255,255,0.08)",
                      }
                }
              >
                {tier.price_display} USDT
              </button>
            );
          })}
        </div>

        <p className="mb-6 text-center text-[11px] leading-relaxed text-white/80">
          {t("confirm_line", { amount: selectedLabel })}
        </p>

        {/* 发起支付居中；历史记录单独一行 */}
        <div className="flex flex-col items-center gap-3">
          <button
            type="button"
            onClick={onPay}
            disabled={true}//{isPaying}
            className="min-h-[48px] w-full max-w-[min(100%,320px)] rounded-[10px] py-3 text-center text-base font-bold text-white disabled:opacity-60"
            style={{
              backgroundImage: "linear-gradient(90deg, #c41e3a 0%, #5b21b6 100%)",
              boxShadow: "0 4px 20px rgba(196, 30, 58, 0.35)",
            }}
          >
            {isPaying ? t("paying") : t("cta_pay")}
          </button>
          <Link
            href="/history"
            className="text-xs font-medium text-[#60a5fa] underline-offset-2 hover:underline"
          >
            {t("history_link")}
          </Link>
        </div>

        <p className="mt-8 text-[10px] leading-relaxed text-white/45 sm:text-[11px]">{t("disclaimer")}</p>
      </div>
    </>
  );
}

export default function ActivatePage() {
  return (
    <div
      className="min-h-screen bg-black text-white bg-cover bg-center bg-no-repeat"
      style={{ backgroundImage: "url(/imgs/history/bg.png)" }}
    >
      <main>
        <Suspense fallback={<LoadingSpinner />}>
          <ActivateInner />
        </Suspense>
      </main>
    </div>
  );
}
