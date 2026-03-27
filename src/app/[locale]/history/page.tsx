"use client";

import { useAppKitAccount } from "@reown/appkit/react";
import { TxFlowType } from "@prisma/client";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";

import { formatDate } from "@/utils/dateUtils";

const PAGE_SIZE = 30;

type ApiTx = {
  id: string;
  txHash: string | null;
  amount: string;
  tokenType: string;
  type: string;
  createdAt: string;
};

function normalizeTx(raw: Record<string, unknown>): ApiTx {
  const txHash = (raw.txHash ?? raw.tx_hash) as string | null | undefined;
  const amountRaw = raw.amount;
  const amount =
    amountRaw !== null && amountRaw !== undefined ? String(amountRaw) : "";
  const tokenType = String(raw.tokenType ?? raw.token_type ?? "");
  const type = String(raw.type ?? "");
  const createdAt = String(raw.createdAt ?? raw.created_at ?? "");
  const id = String(raw.id ?? "");
  return { id, txHash: txHash ?? null, amount, tokenType, type, createdAt };
}

function formatHashDisplay(hash: string): string {
  const h = hash.trim();
  if (!h) return "";
  const up = h.toUpperCase();
  if (up.length <= 18) return up;
  return `${up.slice(0, 8)}......${up.slice(-4)}`;
}

function formatTimeHm(d: Date): string {
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

function CopyIconButton({ text }: { text: string }) {
  const t = useTranslations("history_page");
  const [ok, setOk] = useState(false);

  const onCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setOk(true);
      window.setTimeout(() => setOk(false), 2000);
    } catch {
      setOk(false);
    }
  }, [text]);

  return (
    <button
      type="button"
      onClick={onCopy}
      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/25 bg-white/10 text-white transition hover:bg-white/20"
      aria-label={t("copy_hash")}
      title={t("copy_hash")}
    >
      {ok ? (
        <svg className="h-4 w-4 text-[#4FD1ED]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : (
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <rect x="8" y="8" width="11" height="11" rx="1.5" />
          <path d="M6 16H5a2 2 0 01-2-2V5a2 2 0 012-2h9a2 2 0 012 2v1" />
        </svg>
      )}
    </button>
  );
}

export default function HistoryPage() {
  const t = useTranslations("history_page");
  const { address, isConnected } = useAppKitAccount();
  const [rows, setRows] = useState<ApiTx[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTransactions = useCallback(
    async (skip: number, append: boolean) => {
      if (!address) {
        setRows([]);
        setTotal(0);
        setLoading(false);
        setError(null);
        return;
      }

      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
        setError(null);
      }

      try {
        const res = await fetch("/api/user/transactions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            address: address.toString().toLowerCase(),
            flowTypeArr: [TxFlowType.EQUITY],
            take: PAGE_SIZE,
            ...(skip > 0 ? { cursor: skip } : {}),
          }),
        });

        const json = await res.json();
        if (!res.ok || json?.error) {
          setError(t("error_load"));
          if (!append) setRows([]);
          return;
        }

        const list = Array.isArray(json.data) ? json.data.map((x: Record<string, unknown>) => normalizeTx(x)) : [];
        setTotal(typeof json.total === "number" ? json.total : list.length);
        if (append) {
          setRows((prev) => [...prev, ...list]);
        } else {
          setRows(list);
        }
      } catch {
        setError(t("error_load"));
        if (!append) setRows([]);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [address, t]
  );

  useEffect(() => {
    if (!isConnected || !address) {
      setRows([]);
      setTotal(0);
      setLoading(false);
      setError(null);
      return;
    }
    void fetchTransactions(0, false);
  }, [address, isConnected, fetchTransactions]);

  const canLoadMore = rows.length > 0 && rows.length < total;
  const onLoadMore = () => {
    void fetchTransactions(rows.length, true);
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#050810] text-white">
      <div
        className="pointer-events-none absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url('/imgs/history/bg.png')" }}
        aria-hidden
      />
      <div className="relative z-10 mx-auto max-w-[min(100%,720px)] px-4 pb-20 pt-16 sm:px-6">
        <h1 className="mb-8 text-center text-lg font-bold tracking-wide text-white sm:text-xl">
          {t("title")}
        </h1>

        {!isConnected || !address ? (
          <p className="rounded-lg border border-white/15 bg-black/40 px-4 py-8 text-center text-sm text-white/80">
            {t("connect_wallet")}
          </p>
        ) : error && rows.length === 0 && !loading ? (
          <p className="rounded-lg border border-red-500/30 bg-red-950/30 px-4 py-8 text-center text-sm text-red-200/90">
            {error}
          </p>
        ) : loading && rows.length === 0 ? (
          <p className="py-12 text-center text-sm text-white/70">{t("loading")}</p>
        ) : (
          <>
            {/* 表头 */}
            <div
              className="mb-2 grid grid-cols-[minmax(0,0.85fr)_minmax(0,0.95fr)_minmax(0,1.2fr)_minmax(0,0.9fr)] gap-2 px-2 text-[11px] text-white/65 sm:gap-3 sm:px-3 sm:text-xs"
              role="row"
            >
              <div className="text-left">{t("col_amount")}</div>
              <div className="text-left">{t("col_time")}</div>
              <div className="text-left">{t("col_hash")}</div>
              <div className="text-left">{t("col_purpose")}</div>
            </div>

            {rows.length === 0 ? (
              <p className="rounded-lg border border-white/15 bg-black/35 px-4 py-10 text-center text-sm text-white/75">
                {t("empty")}
              </p>
            ) : (
              <div className="space-y-0">
                {rows.map((row) => {
                  const created = row.createdAt ? new Date(row.createdAt) : null;
                  const dateStr = created && !Number.isNaN(created.getTime()) ? formatDate(created) : "—";
                  const timeStr = created && !Number.isNaN(created.getTime()) ? formatTimeHm(created) : "—";
                  const hash = row.txHash?.trim() || "";
                  return (
                    <div
                      key={row.id}
                      className="border-b border-[#4FD1ED]/40 bg-black/35 px-2 py-4 shadow-[0_1px_10px_rgba(79,209,237,0.2)] backdrop-blur-[2px] sm:px-3"
                    >
                      <div className="grid grid-cols-[minmax(0,0.85fr)_minmax(0,0.95fr)_minmax(0,1.2fr)_minmax(0,0.9fr)] items-center gap-2 sm:gap-3">
                        <div
                          className="text-lg font-semibold tabular-nums sm:text-xl"
                          style={{ color: "#4FD1ED" }}
                        >
                          {row.amount}
                          {row.tokenType ? (
                            <span className="ml-1 text-xs font-normal text-white/80 sm:text-sm">{row.tokenType}</span>
                          ) : null}
                        </div>
                        <div className="flex flex-col gap-0.5 text-[11px] leading-tight text-white sm:text-xs">
                          <span>{dateStr}</span>
                          <span className="text-white/90">{timeStr}</span>
                        </div>
                        <div className="flex min-w-0 items-center gap-1.5">
                          {hash ? (
                            <>
                              <span className="min-w-0 truncate font-mono text-[10px] text-white/95 sm:text-[11px]">
                                {formatHashDisplay(hash)}
                              </span>
                              <CopyIconButton text={hash} />
                            </>
                          ) : (
                            <span className="text-[11px] text-white/50 sm:text-xs">—</span>
                          )}
                        </div>
                        <div className="text-[11px] text-white sm:text-xs">
                          {row.type === "EQUITY" ? t("purpose_EQUITY") : row.type}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {canLoadMore ? (
              <div className="mt-6 flex justify-center">
                <button
                  type="button"
                  onClick={onLoadMore}
                  disabled={loadingMore}
                  className="rounded-full border border-[#4FD1ED]/50 bg-[#4FD1ED]/10 px-6 py-2 text-sm text-[#4FD1ED] transition hover:bg-[#4FD1ED]/20 disabled:opacity-50"
                >
                  {loadingMore ? t("loading") : t("load_more")}
                </button>
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
