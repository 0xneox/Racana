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
} from "lucide-react";

function ReadyContent() {
  const searchParams = useSearchParams();
  const jobId = searchParams.get("jobId") || "demo-job-ready-001";

  const [bookTitle, setBookTitle] = useState("Your Finished Book");
  const [templateName, setTemplateName] = useState("Classic");
  const [trimSize, setTrimSize] = useState("6″ × 9″");
  const [pageCount, setPageCount] = useState(184);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  // Email modal state
  const [email, setEmail] = useState("");
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [emailStatus, setEmailStatus] = useState<string | null>(null);

  useEffect(() => {
    if (jobId) {
      fetch(`/api/jobs/${jobId}`)
        .then((res) => res.json())
        .then((data) => {
          if (data?.job) {
            const j = data.job;
            if (j.manuscriptAsset?.fileName) {
              setBookTitle(j.manuscriptAsset.fileName.replace(/\.[^/.]+$/, ""));
            }
            if (j.manuscriptAsset?.pageCountEstimate) {
              setPageCount(j.manuscriptAsset.pageCountEstimate);
            }
            if (j.templateChoice?.name) {
              setTemplateName(j.templateChoice.name);
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
          }
        })
        .catch(() => {
          setDownloadUrl(`/api/jobs/${jobId}/download`);
        });
    }
  }, [jobId]);

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
    } catch (err) {
      setEmailStatus("Error sending email: " + (err as Error).message);
    } finally {
      setIsSendingEmail(false);
    }
  };

  return (
    <div className="py-10 px-4 sm:px-6 max-w-3xl mx-auto">
      <ProgressBar currentStep={5} />

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
            <CheckCircle2 className="w-3.5 h-3.5" /> PDF/X Compliant
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
            <span className="font-semibold text-[#1C1917]">0.875″ (Auto)</span>
          </div>
          <div>
            <span className="text-[#A8A29E] block mb-0.5">Chapter Opening</span>
            <span className="font-semibold text-[#1C1917]">Recto (Right)</span>
          </div>
          <div>
            <span className="text-[#A8A29E] block mb-0.5">Margins & Folios</span>
            <span className="font-semibold text-[#1C1917]">Passed QA (100)</span>
          </div>
        </div>

        {/* Primary Action Buttons */}
        <div className="pt-6 border-t border-[#E8E2D5] flex flex-col sm:flex-row gap-4">
          <a
            href={downloadUrl || `/api/jobs/${jobId}/download`}
            download
            className="flex-1 py-4 px-6 rounded-xl bg-[#1C1917] text-[#F8F5EE] font-medium text-sm hover:bg-[#2E2824] shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2"
          >
            <Download className="w-4 h-4" />
            <span>Download Print-Ready PDF</span>
          </a>
        </div>
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
