"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { BookOpen, Loader2, AlertTriangle, CheckCircle2, Clock, ArrowRight } from "lucide-react";

interface JobRow {
  id: string;
  status: string;
  progress: number;
  createdAt: string;
  manuscriptAsset?: { fileName: string; pageCountEstimate: number | null } | null;
  templateChoice?: { name: string; personality: string } | null;
}

function statusLabel(status: string): { text: string; tone: "ready" | "working" | "failed" | "draft" } {
  switch (status) {
    case "ready":
      return { text: "Print-ready", tone: "ready" };
    case "failed":
      return { text: "Needs attention", tone: "failed" };
    case "uploaded":
    case "analyzing":
    case "structure_ready":
      return { text: "Analysis", tone: "draft" };
    default:
      return { text: "In production", tone: "working" };
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
  const router = useRouter();
  const [jobs, setJobs] = useState<JobRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/jobs")
      .then(async (res) => {
        if (!res.ok) throw new Error("Couldn't load your books.");
        const data = await res.json();
        setJobs(data.jobs || []);
      })
      .catch((e) => setError(e.message));
  }, []);

  return (
    <div className="py-10 px-4 sm:px-6 max-w-4xl mx-auto">
      <div className="text-center mb-10">
        <h1 className="font-serif text-3xl font-bold text-[#1C1917] mb-2">My Books</h1>
        <p className="text-sm text-[#78716C]">
          Every manuscript you've brought to Racana — pick up right where you left off.
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
          <span>Loading your bookshelf…</span>
        </div>
      )}

      {!error && jobs !== null && jobs.length === 0 && (
        <div className="bg-[#FDFBF7] border border-[#E8E2D5] rounded-2xl p-10 text-center max-w-xl mx-auto">
          <div className="w-12 h-12 rounded-xl bg-[#F4EFEA] text-[#A34825] flex items-center justify-center mx-auto mb-4">
            <BookOpen className="w-6 h-6" />
          </div>
          <h3 className="font-serif font-bold text-lg text-[#1C1917] mb-1">Your shelf is empty</h3>
          <p className="text-xs text-[#78716C] mb-6">
            Upload your first manuscript and we'll typeset it into a print-ready book.
          </p>
          <Link
            href="/upload"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#1C1917] text-[#F8F5EE] text-sm font-medium hover:bg-[#2E2824] transition-all"
          >
            Upload your manuscript <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      )}

      {jobs && jobs.length > 0 && (
        <div className="space-y-3">
          {jobs.map((job) => {
            const s = statusLabel(job.status);
            const title =
              job.manuscriptAsset?.fileName?.replace(/\.[^/.]+$/, "") || "Untitled Manuscript";
            return (
              <button
                key={job.id}
                onClick={() => router.push(destinationFor(job))}
                className="w-full text-left bg-white rounded-xl border border-[#E2DDD2] p-5 flex items-center gap-4 hover:border-[#1C1917] hover:shadow-sm transition-all group"
              >
                <div className="w-10 h-10 rounded-lg bg-[#F4EFEA] text-[#A34825] flex items-center justify-center shrink-0">
                  {s.tone === "ready" ? (
                    <CheckCircle2 className="w-5 h-5" />
                  ) : s.tone === "failed" ? (
                    <AlertTriangle className="w-5 h-5" />
                  ) : (
                    <Clock className="w-5 h-5" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-serif font-bold text-sm text-[#1C1917] truncate">
                    {title}
                  </div>
                  <div className="text-[11px] text-[#78716C] mt-0.5">
                    {job.templateChoice?.name || "Classic"} ·{" "}
                    {job.manuscriptAsset?.pageCountEstimate
                      ? `~${job.manuscriptAsset.pageCountEstimate} pages`
                      : "pages pending"}{" "}
                    · {new Date(job.createdAt).toLocaleDateString()}
                  </div>
                </div>
                <span
                  className={`shrink-0 text-[11px] font-semibold px-2.5 py-1 rounded-full ${
                    s.tone === "ready"
                      ? "bg-[#1C1917] text-white"
                      : s.tone === "failed"
                      ? "bg-[#FEF2F2] text-[#991B1B] border border-[#FCA5A5]"
                      : "bg-[#F4EFEA] text-[#57534E]"
                  }`}
                >
                  {s.text}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
