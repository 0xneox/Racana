"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ProgressBar } from "@/components/ProgressBar";
import { track } from "@/lib/analytics";
import { CheckCircle2, Loader2, Circle, Sparkles, AlertTriangle, ArrowRight } from "lucide-react";

interface ChecklistItem {
  id: number;
  label: string;
  sublabel: string;
  at: number; // job progress % at which this step becomes active
}

const CHECKLIST_ITEMS: ChecklistItem[] = [
  { id: 1, label: "Manuscript analyzed", sublabel: "Parsing file structure, encoding, and word count", at: 12 },
  { id: 2, label: "Chapters detected", sublabel: "Identifying chapter boundaries, sections, and front/back matter", at: 25 },
  { id: 3, label: "Typography applied", sublabel: "Resolving template fonts, metrics, and baseline grid", at: 40 },
  { id: 4, label: "Layout generated", sublabel: "Compiling the interior with the Typst engine", at: 60 },
  { id: 5, label: "Images checked", sublabel: "Verifying embedded images decode and captions survive", at: 72 },
  { id: 6, label: "Trim & print checks", sublabel: "Confirming page size matches trim and text renders", at: 85 },
  { id: 7, label: "Final PDF generated", sublabel: "Saving the print-ready interior to your library", at: 95 },
  { id: 8, label: "Book ready", sublabel: "Print checks passed — your interior is finished", at: 100 },
];

// Step is "in progress" once the job's progress reaches its threshold; every
// earlier step is complete.
function stepIndexFor(progress: number): number {
  return CHECKLIST_ITEMS.reduce((idx, it) => (progress >= it.at ? it.id : idx), 1);
}

function CreateContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const jobId = searchParams.get("jobId") || "";

  const [progress, setProgress] = useState(15);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [activeStep, setActiveStep] = useState<number>(1);
  const [bookTitle, setBookTitle] = useState("Your Manuscript");
  const [failedMessage, setFailedMessage] = useState<string | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);

  useEffect(() => {
    if (!jobId) {
      // If no jobId provided, run local preview simulation
      const interval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 100) {
            clearInterval(interval);
            setTimeout(() => router.push("/ready"), 800);
            return 100;
          }
          const next = prev + 12;
          const stepIndex = stepIndexFor(next);
          setActiveStep(stepIndex);
          setCompletedSteps(CHECKLIST_ITEMS.filter((i) => i.id < stepIndex).map((i) => i.id));
          return next;
        });
      }, 600);
      return () => clearInterval(interval);
    }

    // Real-time polling against /api/jobs/[id]
    const pollTimer = setInterval(async () => {
      try {
        const res = await fetch(`/api/jobs/${jobId}`);
        if (!res.ok) return;
        const data = await res.json();
        const job = data.job;

        if (job) {
          if (job.manuscriptAsset?.fileName) {
            setBookTitle(job.manuscriptAsset.fileName.replace(/\.[^/.]+$/, ""));
          }

          const currentPct = job.progress || 10;
          setProgress(currentPct);

          // Map real pipeline progress to the active checklist step
          const currentStepIndex = stepIndexFor(currentPct);
          setActiveStep(currentStepIndex);
          setCompletedSteps(
            CHECKLIST_ITEMS.filter((i) => i.id < currentStepIndex || currentPct >= 100).map((i) => i.id)
          );

          if (job.status === "failed") {
            setFailedMessage(
              job.errorMessage ||
                "Something went wrong while making your book. Please try again."
            );
            clearInterval(pollTimer);
            return;
          }

          if (job.status === "ready" || currentPct >= 100) {
            setCompletedSteps([1, 2, 3, 4, 5, 6, 7, 8]);
            setProgress(100);
            track("book_ready", {}, jobId);
            clearInterval(pollTimer);
            setTimeout(() => {
              router.push(`/ready?jobId=${jobId}`);
            }, 1000);
          }
        }
      } catch (err) {
        console.error("Polling error:", err);
      }
    }, 500);

    return () => clearInterval(pollTimer);
  }, [jobId, router, retryNonce]);

  return (
    <div className="py-10 px-4 sm:px-6 max-w-2xl mx-auto">
      <ProgressBar currentStep={4} />

      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#A34825]/10 text-[#A34825] text-xs font-semibold mb-3">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Automated Typesetting Pipeline Active</span>
        </div>
        <h1 className="font-serif text-3xl font-bold text-[#1C1917] mb-2">
          Crafting Your Finished Book
        </h1>
        <p className="text-sm text-[#78716C]">
          Transforming <span className="font-semibold text-[#1C1917]">“{bookTitle}”</span> into a bookstore-grade interior.
        </p>
      </div>

      {/* Failure State */}
      {failedMessage && (
        <div className="bg-white rounded-2xl border border-[#FCA5A5] p-6 sm:p-8 shadow-sm mb-6">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-[#FEF2F2] text-[#991B1B] flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <h3 className="font-serif text-lg font-bold text-[#1C1917] mb-1">
                We couldn't finish this book
              </h3>
              <p className="text-sm text-[#57534E] leading-relaxed mb-4">
                {failedMessage}
              </p>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={async () => {
                    setFailedMessage(null);
                    setProgress(10);
                    setCompletedSteps([]);
                    setActiveStep(1);
                    await fetch(`/api/jobs/${jobId}/start`, { method: "POST" }).catch(() => {});
                    setRetryNonce((n) => n + 1);
                  }}
                  className="px-5 py-2.5 rounded-lg bg-[#1C1917] text-[#F8F5EE] text-xs font-semibold hover:bg-[#2E2824] transition-all flex items-center gap-2"
                >
                  <span>Try Again</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => router.push("/upload")}
                  className="px-5 py-2.5 rounded-lg border border-[#D6CEBE] text-xs font-medium text-[#57534E] hover:bg-[#F8F5EE]"
                >
                  Upload a different file
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Status Container */}
      {!failedMessage && (
      <div className="bg-white rounded-2xl border border-[#E2DDD2] p-6 sm:p-8 shadow-sm">
        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex items-center justify-between text-xs mb-2">
            <span className="font-semibold text-[#1C1917]">Generating Book Interior</span>
            <span className="font-mono text-[#A34825] font-bold">{Math.min(100, Math.round(progress))}%</span>
          </div>
          <div className="w-full h-2.5 bg-[#F4EFEA] rounded-full overflow-hidden">
            <div
              className="h-full bg-[#1C1917] rounded-full transition-all duration-300"
              style={{ width: `${Math.min(100, progress)}%` }}
            />
          </div>
        </div>

        {/* 8-Step Explicit Checklist */}
        <div className="space-y-4">
          {CHECKLIST_ITEMS.map((item) => {
            const isCompleted = completedSteps.includes(item.id);
            const isActive = activeStep === item.id && !isCompleted;
            const isPending = !isCompleted && !isActive;

            return (
              <div
                key={item.id}
                className={`flex items-start gap-3.5 p-3 rounded-xl transition-all ${
                  isActive
                    ? "bg-[#FDFBF7] border border-[#1C1917]/20"
                    : isCompleted
                    ? "bg-[#FAF8F5]/50"
                    : "opacity-40"
                }`}
              >
                <div className="mt-0.5 shrink-0">
                  {isCompleted ? (
                    <CheckCircle2 className="w-5 h-5 text-[#A34825] fill-[#A34825]/10" />
                  ) : isActive ? (
                    <Loader2 className="w-5 h-5 text-[#1C1917] animate-spin" />
                  ) : (
                    <Circle className="w-5 h-5 text-[#D6CEBE]" />
                  )}
                </div>

                <div className="flex-grow">
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-sm font-medium ${
                        isCompleted
                          ? "text-[#1C1917] font-semibold"
                          : isActive
                          ? "text-[#1C1917] font-bold"
                          : "text-[#78716C]"
                      }`}
                    >
                      {item.label}
                    </span>
                    {isCompleted && (
                      <span className="text-[10px] uppercase tracking-wider font-semibold text-[#A34825]">
                        Verified
                      </span>
                    )}
                    {isActive && (
                      <span className="text-[10px] uppercase tracking-wider font-semibold text-[#1C1917] animate-pulse">
                        In Progress
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#78716C] mt-0.5">
                    {item.sublabel}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      )}

      <p className="text-center text-xs text-[#A8A29E] mt-6 italic font-serif">
        Zero technical knowledge required • Perfect margins guaranteed
      </p>
    </div>
  );
}

export default function CreatePage() {
  return (
    <Suspense
      fallback={
        <div className="py-20 text-center text-xs text-[#78716C]">
          Loading generator...
        </div>
      }
    >
      <CreateContent />
    </Suspense>
  );
}
