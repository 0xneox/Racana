"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { ProgressBar } from "@/components/ProgressBar";
import {
  Download,
  Mail,
  CheckCircle2,
  FileCheck,
  Printer,
  Sparkles,
  ArrowRight,
  BookOpen,
  Loader2,
  Lock,
  CreditCard,
  Share2,
  Link2,
  UserPlus,
  Palette,
  Book,
} from "lucide-react";
import { motion } from "framer-motion";
import { track } from "@/lib/analytics";

function ReadyContent() {
  const t = useTranslations("Ready");
  const ts = useTranslations("Styles");
  const searchParams = useSearchParams();
  const jobId = searchParams.get("jobId") || "";
  const justPaid = searchParams.get("paid") === "1";

  // If no jobId, redirect to upload — showing fake demo data is misleading.
  useEffect(() => {
    if (!jobId) {
      window.location.href = "/upload";
    }
  }, [jobId]);

  const [bookTitle, setBookTitle] = useState(() => t("defaultTitle"));
  const [templateName, setTemplateName] = useState(() => ts("s1Name"));
  const [trimSize, setTrimSize] = useState("6″ × 9″");
  const [gutterLabel, setGutterLabel] = useState("0.875″");
  const [chapterOpenLabel, setChapterOpenLabel] = useState(() => t("rectoLabel"));
  const [pageCount, setPageCount] = useState(184);
  const [qaScore, setQaScore] = useState<number | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [isPaid, setIsPaid] = useState(false);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [previewPages, setPreviewPages] = useState(0);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [isGuest, setIsGuest] = useState(false);
  const [hasCover, setHasCover] = useState(false);
  const [preflight, setPreflight] = useState<{
    items: { id: string; label: string; status: "ok" | "check"; detail?: string; location?: string }[];
    estimatedPages: number;
    belowKdpSpineMinimum: boolean;
    needsEndPad: boolean;
  } | null>(null);

  // Email modal state
  const [email, setEmail] = useState("");
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [emailStatus, setEmailStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!jobId) return;
    const load = () =>
      fetch(`/api/jobs/${jobId}`)
        .then((res) => res.json())
        .then((data) => {
          if (data?.job) {
            const j = data.job;
            if (Array.isArray(j.payments) && j.payments.some((p: any) => p.status === "paid")) {
              setIsPaid(true);
            }
            if (j.manuscriptAsset?.fileName) {
              setBookTitle(j.manuscriptAsset.fileName.replace(/\.[^/.]+$/, ""));
            }
            let realPages = 0;
            if (Array.isArray(j.qaReports) && j.qaReports.length > 0) {
              const latest = j.qaReports[j.qaReports.length - 1];
              if (typeof latest.score === "number") setQaScore(latest.score);
              if (latest.pageCount > 0) realPages = latest.pageCount;
            }
            if (realPages > 0) {
              setPageCount(realPages);
            } else if (j.manuscriptAsset?.pageCountEstimate) {
              setPageCount(j.manuscriptAsset.pageCountEstimate);
            }
            if (j.templateChoice?.name) {
              setTemplateName(j.templateChoice.name);
            }
            if (j.settings) {
              const s = j.settings;
              if (typeof s.marginInsideMm === "number") {
                setGutterLabel(`${(s.marginInsideMm / 25.4).toFixed(3)}″`);
              }
              if (typeof s.chapterOpenRecto === "boolean") {
                setChapterOpenLabel(s.chapterOpenRecto ? t("rectoLabel") : t("anyPageLabel"));
              }
            }
            if (j.trimSize) {
              const mapping: Record<string, string> = {
                trim_5x8: "5″ × 8″",
                trim_5_5x8_5: "5.5″ × 8.5″",
                trim_6x9: "6″ × 9″",
                trim_8_5x11: "8.5″ × 11″",
              };
              setTrimSize(mapping[j.trimSize] || "6″ × 9″");
            }
            setDownloadUrl(`/api/jobs/${jobId}/download`);
            if (Array.isArray(j.artifacts)) {
              setPreviewPages(j.artifacts.filter((a: any) => a.artifactType === "preview_png").length);
              setHasCover(
                j.artifacts.some(
                  (a: any) => a.artifactType === "cover_png" || a.artifactType === "cover_pdf"
                )
              );
            }
          }
        })
        .catch(() => {
          setDownloadUrl(`/api/jobs/${jobId}/download`);
        });

    load();
    // Preflight review checklist — flags found during analysis, for the
    // author to eyeball ("Looks right / Fix it"). Nothing was auto-changed.
    fetch(`/api/jobs/${jobId}/structure`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.summary?.preflight) setPreflight(data.summary.preflight);
      })
      .catch(() => {});
    fetch("/api/auth/session")
      .then((res) => res.json())
      .then((data) => setIsGuest(!data?.user))
      .catch(() => {});
    // Returning from Razorpay: the webhook may land a moment after redirect —
    // poll briefly until the payment is confirmed.
    if (justPaid && !isPaid) {
      const interval = setInterval(load, 3000);
      const stop = setTimeout(() => clearInterval(interval), 30000);
      return () => { clearInterval(interval); clearTimeout(stop); };
    }
  }, [jobId, justPaid, isPaid, t]);

  const handleCheckout = async () => {
    track("checkout_started", {}, jobId);
    setIsCheckingOut(true);
    setCheckoutError(null);
    try {
      const res = await fetch("/api/checkout/razorpay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId }),
      });
      const data = await res.json();
      if (!res.ok || !data.orderId) {
        throw new Error(data.error || t("errCheckout"));
      }

      // Load Razorpay checkout.js on demand and open the payment modal.
      await new Promise<void>((resolve, reject) => {
        const existing = document.querySelector<HTMLScriptElement>(
          'script[src="https://checkout.razorpay.com/v1/checkout.js"]'
        );
        if (existing) return resolve();
        const script = document.createElement("script");
        script.src = "https://checkout.razorpay.com/v1/checkout.js";
        script.onload = () => resolve();
        script.onerror = () => reject(new Error(t("errPayment")));
        document.body.appendChild(script);
      });

      const rzp = new (window as any).Razorpay({
        key: data.keyId,
        amount: data.amount,
        currency: data.currency,
        order_id: data.orderId,
        name: "Racana",
        description: data.description,
        handler: async (resp: any) => {
          // Verify the payment signature server-side so the download unlocks
          // even if the Razorpay webhook isn't registered yet.
          try {
            await fetch("/api/checkout/razorpay/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                jobId,
                razorpay_order_id: resp.razorpay_order_id,
                razorpay_payment_id: resp.razorpay_payment_id,
                razorpay_signature: resp.razorpay_signature,
              }),
            });
          } catch {
            /* the webhook + status polling still confirm the payment */
          }
          window.location.href = data.successUrl;
        },
        modal: { ondismiss: () => setIsCheckingOut(false) },
        theme: { color: "#1C1917" },
      });
      rzp.open();
    } catch (err) {
      setCheckoutError((err as Error).message);
      setIsCheckingOut(false);
    }
  };

  const handleSendEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes("@")) {
      setEmailStatus(t("errInvalidEmail"));
      return;
    }

    setIsSendingEmail(true);
    setEmailStatus(null);

    try {
      const res = await fetch("/api/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId, email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t("errEmail"));
      setEmailStatus(t("emailSent", { email }));
      track("email_book_sent", {}, jobId);
    } catch (err) {
      setEmailStatus(t("emailError", { message: (err as Error).message }));
    } finally {
      setIsSendingEmail(false);
    }
  };

  const handleCreateShareLink = async () => {
    setIsSharing(true);
    try {
      const res = await fetch(`/api/jobs/${jobId}/share`, { method: "POST" });
      const data = await res.json();
      if (res.ok && data.shareUrl) {
        setShareUrl(data.shareUrl);
        track("share_created", {}, jobId);
      }
    } catch {
      /* share is optional */
    } finally {
      setIsSharing(false);
    }
  };

  const shareText = t("shareText", { title: bookTitle });
  const xShareUrl = shareUrl
    ? `https://twitter.com/intent/tweet?text=${encodeURIComponent(`${shareText} ${shareUrl}`)}`
    : null;
  const waShareUrl = shareUrl
    ? `https://wa.me/?text=${encodeURIComponent(`${shareText} ${shareUrl}`)}`
    : null;

  if (!jobId) {
    return (
      <div className="py-20 px-4 text-center">
        <Loader2 className="w-6 h-6 animate-spin mx-auto text-[#78716C]" />
        <p className="mt-3 text-sm text-[#78716C]">{t("redirecting")}</p>
      </div>
    );
  }

  return (
    <div className="py-10 px-4 sm:px-6 max-w-3xl mx-auto">
      <ProgressBar currentStep={5} />

      {isGuest && (
        <div className="mb-6 flex flex-col items-center gap-3 rounded-xl border border-[#D9A679] bg-[#FFF8F0] p-4 text-center sm:flex-row sm:text-left">
          <div className="flex items-center gap-3">
            <UserPlus className="h-5 w-5 shrink-0 text-[#A34825]" />
            <p className="text-xs leading-5 text-[#57534E]">
              <span className="font-semibold text-[#1C1917]">{t("guestNotice")}</span>{" "}
              {t("guestNoticeCta")}
            </p>
          </div>
          <Link
            href={`/auth/signin?callbackUrl=${encodeURIComponent(`/ready?jobId=${jobId}`)}`}
            className="ml-auto shrink-0 rounded-lg bg-[#1C1917] px-4 py-2 text-xs font-semibold text-[#F8F5EE] hover:bg-[#2E2824]"
          >
            {t("guestSave")}
          </Link>
        </div>
      )}

      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#A34825]/10 text-[#A34825] text-xs font-semibold mb-3">
          <Sparkles className="w-3.5 h-3.5" />
          <span>{t("badge")}</span>
        </div>
        <h1 className="font-serif text-3xl sm:text-4xl font-bold text-[#1C1917] mb-2">
          {t("title")}
        </h1>
        <p className="text-sm text-[#78716C]">
          {t("subtitle")}
        </p>
      </div>

      {/* Book Summary Card */}
      <div className="bg-[#FDFBF7] rounded-2xl border-2 border-[#1C1917] p-6 sm:p-8 mb-8 shadow-md relative overflow-hidden">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-[#E8E2D5]">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-[#1C1917] text-[#F8F5EE] flex items-center justify-center shrink-0">
              <FileCheck className="w-6 h-6" />
            </div>
            <div>
              <h2 className="font-serif text-xl font-bold text-[#1C1917]">
                {bookTitle}
              </h2>
              <span className="text-xs text-[#78716C]">
                {t("interiorMeta", { pages: pageCount, trim: trimSize })}
              </span>
            </div>
          </div>

          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#1C1917] text-white text-xs font-semibold uppercase tracking-wider">
            <CheckCircle2 className="w-3.5 h-3.5" /> {t("printReady")}
          </span>
        </div>

        {/* Print Spec Badges */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-6 text-xs text-[#57534E]">
          <div>
            <span className="text-[#A8A29E] block mb-0.5">{t("styleApplied")}</span>
            <span className="font-semibold text-[#1C1917] font-serif">{templateName}</span>
          </div>
          <div>
            <span className="text-[#A8A29E] block mb-0.5">{t("spineGutter")}</span>
            <span className="font-semibold text-[#1C1917]">{gutterLabel}</span>
          </div>
          <div>
            <span className="text-[#A8A29E] block mb-0.5">{t("chapterOpening")}</span>
            <span className="font-semibold text-[#1C1917]">{chapterOpenLabel}</span>
          </div>
          <div>
            <span className="text-[#A8A29E] block mb-0.5">{t("marginsFolios")}</span>
            <span className="font-semibold text-[#1C1917]">
              {qaScore !== null ? t("qaScore", { score: qaScore }) : t("qaPassed")}
            </span>
          </div>
        </div>

        {/* Preflight review — flagged items from the manuscript analysis.
            The author confirms each one; nothing was auto-changed. */}
        {preflight && preflight.items.length > 0 && (
          <div className="mt-6 pt-5 border-t border-[#E8E2D5]">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[#78716C] mb-3">
              {t("preflightTitle")}
            </h3>
            <ul className="space-y-2">
              {preflight.items.map((item) => (
                <li
                  key={item.id}
                  className="flex items-start justify-between gap-3 text-xs"
                >
                  <div className="min-w-0">
                    <span className="font-medium text-[#1C1917]">{item.label}</span>
                    {item.detail && (
                      <span className="block text-[#A8A29E] mt-0.5 leading-snug">
                        {item.detail}
                      </span>
                    )}
                  </div>
                  <span
                    className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider border ${
                      item.status === "ok"
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : "bg-amber-50 text-amber-800 border-amber-200"
                    }`}
                  >
                    {item.status === "ok" ? t("preflightOk") : t("preflightFix")}
                  </span>
                </li>
              ))}
            </ul>
            {(preflight.belowKdpSpineMinimum || preflight.needsEndPad) && (
              <p className="mt-3 text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2.5">
                {preflight.belowKdpSpineMinimum && <span>{t("preflightSpine")} </span>}
                {preflight.needsEndPad && <span>{t("preflightPad")}</span>}
              </p>
            )}
          </div>
        )}

        {/* Primary Action Buttons */}
        <div className="pt-6 border-t border-[#E8E2D5] space-y-4">
          {justPaid && isPaid && (
            <p className="text-xs font-semibold text-[#166534] bg-[#F0FDF4] border border-[#BBF7D0] rounded-lg p-3 text-center">
              {t("paymentConfirmed")}
            </p>
          )}
          {justPaid && !isPaid && (
            <p className="text-xs font-medium text-[#78716C] bg-[#F8F5EE] border border-[#E8E2D5] rounded-lg p-3 text-center flex items-center justify-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              {t("confirmingPayment")}
            </p>
          )}

          <div className="flex flex-col sm:flex-row gap-4">
            <motion.a
              href={downloadUrl || `/api/jobs/${jobId}/download`}
              download
              onClick={() => track("preview_downloaded", { paid: isPaid }, jobId)}
              whileHover={{ scale: 1.05, boxShadow: "0 0 8px rgba(255,255,255,0.4)" }}
              className={`flex-1 py-4 px-6 rounded-xl font-medium text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 ${
                isPaid
                  ? "bg-[#1C1917] text-[#F8F5EE] hover:bg-[#2E2824]"
                  : "border border-[#D6CEBE] bg-[#F8F5EE] text-[#1C1917] hover:border-[#1C1917]"
              }`}
            >
              <Download className="w-4 h-4" />
              <span>{isPaid ? t("downloadPaid") : t("downloadFree")}</span>
            </motion.a>

            {!isPaid && (
              <button
                type="button"
                onClick={handleCheckout}
                disabled={isCheckingOut}
                className="flex-1 py-4 px-6 rounded-xl bg-[#A34825] text-white font-medium text-sm hover:bg-[#8C3C1F] shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {isCheckingOut ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CreditCard className="w-4 h-4" />
                )}
                <span>{t("unlock")}</span>
              </button>
            )}
          </div>

          {!isPaid && (
            <p className="text-[11px] text-[#A8A29E] text-center flex items-center justify-center gap-1.5">
              <Lock className="w-3 h-3" />
              {t("watermarkNote")}
            </p>
          )}

          {checkoutError && (
            <p className="text-xs text-[#991B1B] bg-[#FEF2F2] p-2.5 rounded-lg border border-[#FCA5A5]">
              {checkoutError}
            </p>
          )}
        </div>
      </div>

      {/* Two-in-One Publishing Suite: eBook (EPUB) & Cover Studio */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        {/* eBook EPUB Card */}
        <div className="bg-white rounded-2xl border border-[#E2DDD2] p-6 shadow-sm flex flex-col justify-between hover:border-[#1C1917] transition-all">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-[#F4EFEA] text-[#A34825] flex items-center justify-center">
                <Book className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                {t("epubReady")}
              </span>
            </div>
            <h3 className="heading-h3 font-serif font-bold text-[#1C1917] mb-1">
              eBook (EPUB 3.0)
            </h3>
            <p className="text-xs text-[#78716C] mb-4">
              {t("epubSubtitle")}
            </p>
          </div>
          <a
            href={`/api/jobs/${jobId}/epub`}
            download
            className="w-full py-3 px-4 rounded-xl bg-[#1C1917] text-[#F8F5EE] text-xs font-semibold hover:bg-[#2E2824] transition-all flex items-center justify-center gap-2 shadow-sm"
          >
            <Download className="w-4 h-4" />
            <span>{t("downloadEpub")}</span>
          </a>
        </div>

        {/* Cover Studio Card */}
        <div className="bg-white rounded-2xl border border-[#E2DDD2] p-6 shadow-sm flex flex-col justify-between hover:border-[#1C1917] transition-all">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-[#F4EFEA] text-[#A34825] flex items-center justify-center">
                <Palette className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                AI &amp; Print-Ready
              </span>
            </div>
            <h3 className="heading-h3 font-serif font-bold text-[#1C1917] mb-1">
              {t("coverStudioTitle")}
            </h3>
            <p className="text-xs text-[#78716C] mb-4">
              {t("coverStudioSub")}
            </p>
          </div>
          {hasCover && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`/api/jobs/${jobId}/cover?export=svg`}
              alt={t("coverReady")}
              className="w-full max-h-44 object-contain rounded-lg border border-[#E8E2D5] mb-4 bg-[#FDFBF7]"
              loading="lazy"
            />
          )}
          <Link
            href={`/cover?jobId=${jobId}`}
            className="w-full py-3 px-4 rounded-xl border border-[#D6CEBE] bg-[#F8F5EE] text-[#1C1917] text-xs font-semibold hover:border-[#1C1917] hover:bg-white transition-all flex items-center justify-center gap-2 shadow-sm"
          >
            <Sparkles className="w-4 h-4 text-[#A34825]" />
            <span>{t("designCoverCta")}</span>
          </Link>
        </div>
      </div>

      {/* Publishing checklist — the fastest path from here to a printed book */}
      <div className="bg-[#FDFBF7] rounded-2xl border border-[#E2DDD2] p-6 sm:p-8 mb-8 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-lg bg-[#F4EFEA] text-[#A34825] flex items-center justify-center">
            <Printer className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-serif font-bold text-base text-[#1C1917]">
              {t("pubCheckTitle")}
            </h3>
            <p className="text-xs text-[#78716C]">{t("pubCheckSub")}</p>
          </div>
        </div>
        <ol className="space-y-2.5 text-xs text-[#57534E] list-none">
          {(["pubStep1", "pubStep2", "pubStep3", "pubStep4"] as const).map((key, i) => (
            <li key={key} className="flex items-start gap-3">
              <span className="shrink-0 w-5 h-5 rounded-full bg-[#1C1917] text-[#F8F5EE] text-[10px] font-bold flex items-center justify-center mt-px">
                {i + 1}
              </span>
              <span className="leading-5">{t(key)}</span>
            </li>
          ))}
        </ol>
      </div>

      {/* Page previews — real rendered pages from your interior */}
      {previewPages > 0 && (
        <div className="bg-white rounded-2xl border border-[#E2DDD2] p-6 sm:p-8 mb-8 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-lg bg-[#F4EFEA] text-[#A34825] flex items-center justify-center">
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <h3 className="heading-h3 font-serif font-bold text-[#1C1917]">
                {t("firstPages")}
              </h3>
              <p className="text-xs text-[#78716C]">
                {t("firstPagesSub")}
              </p>
            </div>
          </div>
          <div className="flex gap-4 overflow-x-auto pb-2">
            {Array.from({ length: previewPages }, (_, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={i}
                src={`/api/jobs/${jobId}/preview/${i + 1}`}
                alt={t("previewAlt", { n: i + 1 })}
                className="w-36 shrink-0 rounded border border-[#E8E2D5] shadow-sm sm:w-44"
                loading="lazy"
              />
            ))}
          </div>
        </div>
      )}

      {/* Share your book — the viral loop */}
      <div className="bg-white rounded-2xl border border-[#E2DDD2] p-6 sm:p-8 mb-8 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-lg bg-[#F4EFEA] text-[#A34825] flex items-center justify-center">
            <Share2 className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-serif font-bold text-base text-[#1C1917]">
              {t("shareTitle")}
            </h3>
            <p className="text-xs text-[#78716C]">
              {t("shareSub")}
            </p>
          </div>
        </div>

        {!shareUrl ? (
          <button
            type="button"
            onClick={handleCreateShareLink}
            disabled={isSharing}
            className="w-full rounded-xl border border-[#D6CEBE] bg-[#F8F5EE] py-3 text-xs font-semibold text-[#1C1917] transition-all hover:border-[#1C1917] flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {isSharing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
            {t("createShareLink")}
          </button>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2 rounded-lg border border-[#E8E2D5] bg-[#FDFBF7] p-3">
              <span className="flex-1 truncate font-mono text-[11px] text-[#57534E]">{shareUrl}</span>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard?.writeText(shareUrl).catch(() => {});
                  setShareCopied(true);
                  track("share_link_copied", {}, jobId);
                  setTimeout(() => setShareCopied(false), 2000);
                }}
                className="shrink-0 rounded-md border border-[#D6CEBE] px-3 py-1.5 text-[11px] font-semibold text-[#1C1917] hover:border-[#1C1917]"
              >
                {shareCopied ? t("copied") : t("copy")}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <a
                href={xShareUrl || "#"}
                target="_blank"
                rel="noreferrer"
                onClick={() => track("share_x_clicked", {}, jobId)}
                className="flex items-center justify-center gap-2 rounded-xl bg-[#1C1917] py-3 text-xs font-semibold text-[#F8F5EE] hover:bg-[#2E2824]"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                {t("postOnX")}
              </a>
              <a
                href={waShareUrl || "#"}
                target="_blank"
                rel="noreferrer"
                onClick={() => track("share_whatsapp_clicked", {}, jobId)}
                className="flex items-center justify-center gap-2 rounded-xl bg-[#166534] py-3 text-xs font-semibold text-white hover:bg-[#14532d]"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.895 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413"/></svg>
                WhatsApp
              </a>
            </div>
          </div>
        )}
      </div>

      {/* Email me the book section */}
      <div className="bg-white rounded-2xl border border-[#E2DDD2] p-6 sm:p-8 mb-8 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-lg bg-[#F4EFEA] text-[#A34825] flex items-center justify-center">
            <Mail className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-serif font-bold text-base text-[#1C1917]">
              {t("emailTitle")}
            </h3>
            <p className="text-xs text-[#78716C]">
              {t("emailSub")}
            </p>
          </div>
        </div>

        <form onSubmit={handleSendEmail} className="flex flex-col sm:flex-row gap-3">
          <input
            type="email"
            placeholder="author@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="flex-1 p-3 rounded-xl border border-[#D6CEBE] text-xs text-[#1C1917] focus:outline-none focus:border-[#1C1917]"
          />
          <button
            type="submit"
            disabled={isSendingEmail}
            className="px-6 py-3 rounded-xl border border-[#D6CEBE] bg-[#F8F5EE] text-[#1C1917] font-medium text-xs hover:border-[#1C1917] hover:bg-[#FDFBF7] transition-all flex items-center justify-center gap-2"
          >
            {isSendingEmail ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Mail className="w-3.5 h-3.5" />
            )}
            <span>{t("emailSend")}</span>
          </button>
        </form>

        {emailStatus && (
          <p className="text-xs mt-3 text-[#A34825] font-medium">{emailStatus}</p>
        )}
      </div>

      {/* Reset or Format Another */}
      <div className="text-center pt-2">
        <Link
          href="/upload"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#57534E] hover:text-[#1C1917] transition-colors"
        >
          <span>{t("formatAnother")}</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
}

function ReadyFallback() {
  const t = useTranslations("Ready");
  return (
    <div className="py-20 text-center text-xs text-[#78716C]">
      {t("loading")}
    </div>
  );
}

export default function ReadyPage() {
  return (
    <Suspense fallback={<ReadyFallback />}>
      <ReadyContent />
    </Suspense>
  );
}
