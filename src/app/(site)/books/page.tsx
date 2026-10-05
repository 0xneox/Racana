"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { BookOpen, Loader2, AlertTriangle, CheckCircle2, Clock, ArrowRight, Download, Palette, Book, Trash2, Lock, UserX } from "lucide-react";
import { useTranslations } from "next-intl";

interface JobRow {
  id: string;
  status: string;
  progress: number;
  createdAt: string;
  manuscriptAsset?: { fileName: string; pageCountEstimate: number | null } | null;
  templateChoice?: { name: string; personality: string } | null;
  payments?: { status: string }[];
}

function statusLabel(
  status: string,
  t: (key: string, values?: Record<string, string | number>) => string
): { text: string; tone: "ready" | "working" | "failed" | "draft" } {
  switch (status) {
    case "ready":
      return { text: t("statusReady"), tone: "ready" };
    case "failed":
      return { text: t("statusFailed"), tone: "failed" };
    case "uploaded":
    case "analyzing":
    case "structure_ready":
      return { text: t("statusAnalysis"), tone: "draft" };
    default:
      return { text: t("statusProduction"), tone: "working" };
  }
}

function destinationFor(job: JobRow): string {
  switch (job.status) {
    case "ready":
      return `/ready?jobId=${job.id}`;
    case "failed":
      return `/create?jobId=${job.id}`;
    case "queued":
    case "typesetting":
    case "qa":
    case "fixing":
      return `/create?jobId=${job.id}`;
    default:
      return `/templates?jobId=${job.id}`;
  }
}

export default function BooksPage() {
  const t = useTranslations("Books");
  const router = useRouter();
  const [jobs, setJobs] = useState<JobRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [user, setUser] = useState<{ email: string; name?: string } | null>(null);
  const [deletingAccount, setDeletingAccount] = useState(false);

  useEffect(() => {
    fetch("/api/jobs")
      .then(async (res) => {
        if (!res.ok) throw new Error(t("errLoad"));
        const data = await res.json();
        setJobs(data.jobs || []);
      })
      .catch((e) => setError(e.message));
    fetch("/api/auth/session")
      .then((res) => res.json())
      .then((data) => { if (data?.user) setUser(data.user); })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDeleteJob = async (job: JobRow) => {
    const title =
      job.manuscriptAsset?.fileName?.replace(/\.[^/.]+$/, "") || t("untitled");
    if (!window.confirm(t("deleteConfirm", { title }))) return;
    setDeletingId(job.id);
    try {
      const res = await fetch(`/api/jobs/${job.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || t("deleteFailed"));
      setJobs((prev) => (prev ? prev.filter((j) => j.id !== job.id) : prev));
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setDeletingId(null);
    }
  };

  const handleDeleteAccount = async () => {
    if (!window.confirm(t("deleteAccountConfirm"))) return;
    setDeletingAccount(true);
    try {
      const res = await fetch("/api/account", { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || t("deleteFailed"));
      window.location.href = "/";
    } catch (e) {
      alert((e as Error).message);
      setDeletingAccount(false);
    }
  };

  return (
    <div className="py-10 px-4 sm:px-6 max-w-4xl mx-auto">
      <div className="text-center mb-10">
        <h1 className="font-serif text-3xl font-bold text-[#1C1917] mb-2">{t("title")}</h1>
        <p className="text-sm text-[#78716C]">
          {t("subtitle")}
        </p>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-[#FEF2F2] border border-[#FCA5A5] text-[#991B1B] text-xs flex items-center gap-2 max-w-xl mx-auto">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {!error && jobs === null && (
        <div className="py-20 flex items-center justify-center gap-3 text-xs text-[#78716C]">
          <Loader2 className="w-4 h-4 animate-spin text-[#A34825]" />
          <span>{t("loading")}</span>
        </div>
      )}

      {!error && jobs !== null && jobs.length === 0 && (
        <div className="bg-[#FDFBF7] border border-[#E8E2D5] rounded-2xl p-10 text-center max-w-xl mx-auto">
          <div className="w-12 h-12 rounded-xl bg-[#F4EFEA] text-[#A34825] flex items-center justify-center mx-auto mb-4">
            <BookOpen className="w-6 h-6" />
          </div>
          <h3 className="font-serif font-bold text-lg text-[#1C1917] mb-1">{t("emptyTitle")}</h3>
          <p className="text-xs text-[#78716C] mb-6">
            {t("emptyDesc")}
          </p>
          <Link
            href="/upload"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#1C1917] text-[#F8F5EE] text-sm font-medium hover:bg-[#2E2824] transition-all"
          >
            {t("emptyCta")} <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      )}

      {jobs && jobs.length > 0 && (
        <div className="space-y-3">
          {jobs.map((job) => {
            const s = statusLabel(job.status, t);
            const title =
              job.manuscriptAsset?.fileName?.replace(/\.[^/.]+$/, "") || t("untitled");
            return (
              <div
                key={job.id}
                className="w-full bg-white rounded-xl border border-[#E2DDD2] p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4 hover:border-[#1C1917] hover:shadow-sm transition-all"
              >
                <div
                  onClick={() => router.push(destinationFor(job))}
                  className="w-10 h-10 rounded-lg bg-[#F4EFEA] text-[#A34825] flex items-center justify-center shrink-0 cursor-pointer"
                >
                  {s.tone === "ready" ? (
                    <CheckCircle2 className="w-5 h-5" />
                  ) : s.tone === "failed" ? (
                    <AlertTriangle className="w-5 h-5" />
                  ) : (
                    <Clock className="w-5 h-5" />
                  )}
                </div>
                <div
                  onClick={() => router.push(destinationFor(job))}
                  className="flex-1 min-w-0 cursor-pointer"
                >
                  <div className="font-serif font-bold text-sm text-[#1C1917] truncate hover:text-[#A34825] transition-colors">
                    {title}
                  </div>
                  <div className="text-[11px] text-[#78716C] mt-0.5">
                    {job.templateChoice?.name || "Classic"} ·{" "}
                    {job.manuscriptAsset?.pageCountEstimate
                      ? t("pagesApprox", { count: job.manuscriptAsset.pageCountEstimate })
                      : t("pagesPending")}{" "}
                    · {new Date(job.createdAt).toLocaleDateString()}
                  </div>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
                  {s.tone === "ready" && (
                    <div className="flex items-center gap-1.5 mr-1">
                      <Link
                        href={`/cover?jobId=${job.id}`}
                        className="px-2.5 py-1 rounded-lg border border-[#D6CEBE] bg-[#F8F5EE] text-[11px] font-semibold text-[#1C1917] hover:border-[#1C1917] flex items-center gap-1 transition-all"
                        title="Design Cover"
                      >
                        <Palette className="w-3 h-3 text-[#A34825]" />
                        <span>Cover</span>
                      </Link>
                      {job.payments?.some((p) => p.status === "paid") ? (
                        <a
                          href={`/api/jobs/${job.id}/epub`}
                          download
                          className="px-2.5 py-1 rounded-lg border border-[#D6CEBE] bg-[#F8F5EE] text-[11px] font-semibold text-[#1C1917] hover:border-[#1C1917] flex items-center gap-1 transition-all"
                          title="Download eBook (EPUB)"
                        >
                          <Book className="w-3 h-3 text-emerald-700" />
                          <span>ePub</span>
                        </a>
                      ) : (
                        <span
                          className="px-2.5 py-1 rounded-lg border border-[#E8E2D5] bg-[#F8F5EE] text-[11px] font-semibold text-[#A8A29E] flex items-center gap-1 cursor-not-allowed"
                          title={t("includedWithPurchase")}
                        >
                          <Lock className="w-3 h-3" />
                          <span>ePub</span>
                        </span>
                      )}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => handleDeleteJob(job)}
                    disabled={deletingId === job.id}
                    title={t("delete")}
                    className="p-1.5 rounded-lg text-[#A8A29E] hover:text-[#991B1B] hover:bg-[#FEF2F2] transition-all disabled:opacity-50"
                  >
                    {deletingId === job.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="w-3.5 h-3.5" />
                    )}
                  </button>

                  <button
                    onClick={() => router.push(destinationFor(job))}
                    className={`shrink-0 text-[11px] font-semibold px-2.5 py-1 rounded-full ${
                      s.tone === "ready"
                        ? "bg-[#1C1917] text-white"
                        : s.tone === "failed"
                        ? "bg-[#FEF2F2] text-[#991B1B] border border-[#FCA5A5]"
                        : "bg-[#F4EFEA] text-[#57534E]"
                    }`}
                  >
                    {s.text}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {user && jobs !== null && (
        <div className="mt-10 max-w-xl mx-auto space-y-4">
          {/* Account card — the only place account-level actions live */}
          <div className="rounded-xl border border-[#E2DDD2] bg-white p-5 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <h3 className="text-xs font-semibold text-[#1C1917] uppercase tracking-wider">
                {t("accountTitle")}
              </h3>
              <p className="text-[11px] text-[#78716C] mt-1 truncate">
                {t("signedInAs", { email: user.email })}
              </p>
            </div>
            <button
              type="button"
              onClick={async () => {
                await fetch("/api/auth/signout", { method: "POST" });
                window.location.href = "/";
              }}
              className="shrink-0 px-3.5 py-2 rounded-lg border border-[#D6CEBE] bg-[#F8F5EE] text-[11px] font-semibold text-[#1C1917] hover:border-[#1C1917] transition-all"
            >
              {t("signOut")}
            </button>
          </div>

          <div className="rounded-xl border border-[#FCA5A5] bg-[#FEF2F2] p-5">
            <div className="flex items-start gap-3">
              <UserX className="w-4 h-4 text-[#991B1B] shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="text-xs font-semibold text-[#991B1B]">{t("dangerZoneTitle")}</h3>
                <p className="text-[11px] text-[#B91C1C]/80 mt-1 leading-relaxed">
                  {t("dangerZoneText")}
                </p>
                <button
                  type="button"
                  onClick={handleDeleteAccount}
                  disabled={deletingAccount}
                  className="mt-3 inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-[#FCA5A5] bg-white text-[11px] font-semibold text-[#991B1B] hover:bg-[#FEF2F2] transition-all disabled:opacity-60"
                >
                  {deletingAccount && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {t("deleteAccount")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
