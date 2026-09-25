"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
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
} from "lucide-react";
import { track } from "@/lib/analytics";

function ReadyContent() {
  const searchParams = useSearchParams();
  const jobId = searchParams.get("jobId") || "demo-job-ready-001";
  const justPaid = searchParams.get("paid") === "1";

  const [bookTitle, setBookTitle] = useState("Your Finished Book");
  const [templateName, setTemplateName] = useState("Classic");
  const [trimSize, setTrimSize] = useState("6″ × 9″");
  const [gutterLabel, setGutterLabel] = useState("0.875″");
  const [chapterOpenLabel, setChapterOpenLabel] = useState("Recto (Right)");
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
                setChapterOpenLabel(s.chapterOpenRecto ? "Recto (Right)" : "Any page");
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
            }
          }
        })
        .catch(() => {
          setDownloadUrl(`/api/jobs/${jobId}/download`);
        });

    load();
    fetch("/api/auth/session")
      .then((res) => res.json())
      .then((data) => setIsGuest(!data?.user))
      .catch(() => {});
    // Returning from Stripe: the webhook may land a moment after redirect —
    // poll briefly until the payment is confirmed.
    if (justPaid && !isPaid) {
      const interval = setInterval(load, 3000);
      const stop = setTimeout(() => clearInterval(interval), 30000);
      return () => { clearInterval(interval); clearTimeout(stop); };
    }
  }, [jobId, justPaid, isPaid]);

  const handleCheckout = async () => {
    track("checkout_started", {}, jobId);
    setIsCheckingOut(true);
    setCheckoutError(null);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Checkout failed");
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      throw new Error("No checkout URL returned");
    } catch (err) {
      setCheckoutError((err as Error).message);
      setIsCheckingOut(false);
    }
  };

  const handleSendEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes("@")) {
      setEmailStatus("Please enter a valid email address.");
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
      if (!res.ok) throw new Error(data.error || "Failed to send email");
      setEmailStatus(`✓ Print-ready files scheduled to ${email}`);
      track("email_book_sent", {}, jobId);
    } catch (err) {
      setEmailStatus("Error sending email: " + (err as Error).message);
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

  const shareText = `I just typeset "${bookTitle}" into a print-ready book interior with Racana — took about 2 minutes.`;
  const xShareUrl = shareUrl
    ? `https://twitter.com/intent/tweet?text=${encodeURIComponent(`${shareText} ${shareUrl}`)}`
    : null;
  const waShareUrl = shareUrl
    ? `https://wa.me/?text=${encodeURIComponent(`${shareText} ${shareUrl}`)}`
    : null;

  return (
    <div className="py-10 px-4 sm:px-6 max-w-3xl mx-auto">
      <ProgressBar currentStep={5} />

      {isGuest && (
        <div className="mb-6 flex flex-col items-center gap-3 rounded-xl border border-[#D9A679] bg-[#FFF8F0] p-4 text-center sm:flex-row sm:text-left">
          <div className="flex items-center gap-3">
            <UserPlus className="h-5 w-5 shrink-0 text-[#A34825]" />
            <p className="text-xs leading-5 text-[#57534E]">
              <span className="font-semibold text-[#1C1917]">You're using Racana as a guest.</span>{" "}
              Sign in to keep this book in your library forever.
            </p>
          </div>
          <Link
            href={`/auth/signin?callbackUrl=${encodeURIComponent(`/ready?jobId=${jobId}`)}`}
            className="ml-auto shrink-0 rounded-lg bg-[#1C1917] px-4 py-2 text-xs font-semibold text-[#F8F5EE] hover:bg-[#2E2824]"
          >
            Save my book
          </Link>
        </div>
      )}

      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#A34825]/10 text-[#A34825] text-xs font-semibold mb-3">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Press-Ready Interior Generated</span>
        </div>
        <h1 className="font-serif text-3xl sm:text-4xl font-bold text-[#1C1917] mb-2">
          Your Finished Book is Ready
        </h1>
        <p className="text-sm text-[#78716C]">
          Typeset to professional bookstore standards. Fully prepared for Amazon KDP, IngramSpark, or offset press.
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
                Interior PDF • {pageCount} pages • {trimSize}
              </span>
            </div>
          </div>

          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#1C1917] text-white text-xs font-semibold uppercase tracking-wider">
            <CheckCircle2 className="w-3.5 h-3.5" /> Print-Ready
          </span>
        </div>

        {/* Print Spec Badges */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-6 text-xs text-[#57534E]">
          <div>
            <span className="text-[#A8A29E] block mb-0.5">Style Applied</span>
            <span className="font-semibold text-[#1C1917] font-serif">{templateName}</span>
          </div>
          <div>
            <span className="text-[#A8A29E] block mb-0.5">Spine Gutter</span>
            <span className="font-semibold text-[#1C1917]">{gutterLabel}</span>
          </div>
          <div>
            <span className="text-[#A8A29E] block mb-0.5">Chapter Opening</span>
            <span className="font-semibold text-[#1C1917]">{chapterOpenLabel}</span>
          </div>
          <div>
            <span className="text-[#A8A29E] block mb-0.5">Margins & Folios</span>
            <span className="font-semibold text-[#1C1917]">
              {qaScore !== null ? `QA Score ${qaScore}/100` : "QA Passed"}
            </span>
          </div>
        </div>

        {/* Primary Action Buttons */}
        <div className="pt-6 border-t border-[#E8E2D5] space-y-4">
          {justPaid && isPaid && (
            <p className="text-xs font-semibold text-[#166534] bg-[#F0FDF4] border border-[#BBF7D0] rounded-lg p-3 text-center">
              ✓ Payment confirmed — your clean print-ready PDF is unlocked.
            </p>
          )}
          {justPaid && !isPaid && (
            <p className="text-xs font-medium text-[#78716C] bg-[#F8F5EE] border border-[#E8E2D5] rounded-lg p-3 text-center flex items-center justify-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Confirming your payment…
            </p>
          )}

          <div className="flex flex-col sm:flex-row gap-4">
            <a
              href={downloadUrl || `/api/jobs/${jobId}/download`}
              download
              onClick={() => track("preview_downloaded", { paid: isPaid }, jobId)}
              className={`flex-1 py-4 px-6 rounded-xl font-medium text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 ${
                isPaid
                  ? "bg-[#1C1917] text-[#F8F5EE] hover:bg-[#2E2824]"
                  : "border border-[#D6CEBE] bg-[#F8F5EE] text-[#1C1917] hover:border-[#1C1917]"
              }`}
            >
              <Download className="w-4 h-4" />
              <span>{isPaid ? "Download Print-Ready PDF" : "Download Free Preview (Watermarked)"}</span>
            </a>

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
                <span>Unlock Print-Ready PDF — $29 (≈ ₹2,450)</span>
              </button>
            )}
          </div>

          {!isPaid && (
            <p className="text-[11px] text-[#A8A29E] text-center flex items-center justify-center gap-1.5">
              <Lock className="w-3 h-3" />
              Free previews carry a Racana watermark. One payment unlocks this interior forever.
            </p>
          )}

          {checkoutError && (
            <p className="text-xs text-[#991B1B] bg-[#FEF2F2] p-2.5 rounded-lg border border-[#FCA5A5]">
              {checkoutError}
            </p>
          )}
        </div>
      </div>

      {/* Page previews — real rendered pages from your interior */}
      {previewPages > 0 && (
        <div className="bg-white rounded-2xl border border-[#E2DDD2] p-6 sm:p-8 mb-8 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-lg bg-[#F4EFEA] text-[#A34825] flex items-center justify-center">
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-serif font-bold text-base text-[#1C1917]">
                Your first pages
              </h3>
              <p className="text-xs text-[#78716C]">
                Rendered exactly as they'll print — fonts, margins and trim included.
              </p>
            </div>
          </div>
          <div className="flex gap-4 overflow-x-auto pb-2">
            {Array.from({ length: previewPages }, (_, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={i}
                src={`/api/jobs/${jobId}/preview/${i + 1}`}
                alt={`Preview of page ${i + 1}`}
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
              Share your book
            </h3>
            <p className="text-xs text-[#78716C]">
              A beautiful card of your finished interior — nothing public until you share it.
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
            Create share link
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
                {shareCopied ? "Copied!" : "Copy"}
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
                Post on X
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
              Email Me the Book
            </h3>
            <p className="text-xs text-[#78716C]">
              Receive a backup copy with download link and printing instructions.
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
            <span>Send Email</span>
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
          <span>Format another manuscript</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
}

export default function ReadyPage() {
  return (
    <Suspense
      fallback={
        <div className="py-20 text-center text-xs text-[#78716C]">
          Loading completed book...
        </div>
      }
    >
      <ReadyContent />
    </Suspense>
  );
}
