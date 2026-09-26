"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { ProgressBar } from "@/components/ProgressBar";
import { track } from "@/lib/analytics";
import { CheckCircle2, Loader2, Circle, Sparkles, AlertTriangle, ArrowRight } from "lucide-react";

interface ChecklistItem {
  id: number;
  /** Create namespace suffix: stepNLabel / stepNSub */
  step: number;
  at: number; // job progress % at which this step becomes active
}

const CHECKLIST_ITEMS: ChecklistItem[] = [
  { id: 1, step: 1, at: 12 },
  { id: 2, step: 2, at: 25 },
  { id: 3, step: 3, at: 40 },
  { id: 4, step: 4, at: 60 },
  { id: 5, step: 5, at: 72 },
  { id: 6, step: 6, at: 85 },
  { id: 7, step: 7, at: 95 },
  { id: 8, step: 8, at: 100 },
];

// Step is "in progress" once the job's progress reaches its threshold; every
// earlier step is complete.
function stepIndexFor(progress: number): number {
  return CHECKLIST_ITEMS.reduce((idx, it) => (progress >= it.at ? it.id : idx), 1);
}

function CreateContent() {
  const t = useTranslations("Create");
  const router = useRouter();
  const searchParams = useSearchParams();
  const jobId = searchParams.get("jobId") || "";

  const [progress, setProgress] = useState(15);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [activeStep, setActiveStep] = useState<number>(1);
  const [bookTitle, setBookTitle] = useState(() => t("defaultTitle"));
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

    // Fetch the book title once (the full job endpoint) so we don't pull
    // MBs of structureData on every poll tick.
    fetch(`/api/jobs/${jobId}`)
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (data?.job?.manuscriptAsset?.fileName) {
          setBookTitle(data.job.manuscriptAsset.fileName.replace(/\.[^/.]+$/, ""));
        }
      })
      .catch(() => {});

    // Lightweight status polling — only status/progress/currentStep/error.
    let pollFailures = 0;
    const pollTimer = setInterval(async () => {
      try {
        const res = await fetch(`/api/jobs/${jobId}/status`);
        if (!res.ok) {
          pollFailures++;
          if (pollFailures > 10) {
            setFailedMessage(t("errConnection"));
            clearInterval(pollTimer);
          }
          return;
        }
        pollFailures = 0;
        const job = await res.json();

        if (job) {
          const currentPct = job.progress || 10;
          setProgress(currentPct);

          // Map real pipeline progress to the active checklist step
          const currentStepIndex = stepIndexFor(currentPct);
          setActiveStep(currentStepIndex);
          setCompletedSteps(
            CHECKLIST_ITEMS.filter((i) => i.id < currentStepIndex || currentPct >= 100).map((i) => i.id)
          );

          if (job.status === "failed") {
            setFailedMessage(job.errorMessage || t("errGeneric"));
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
    }, 1000);

    return () => clearInterval(pollTimer);
  }, [jobId, router, retryNonce, t]);

  return (
    <div className="py-10 px-4 sm:px-6 max-w-2xl mx-auto">
      <ProgressBar currentStep={4} />

      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#A34825]/10 text-[#A34825] text-xs font-semibold mb-3">
          <Sparkles className="w-3.5 h-3.5" />
          <span>{t("badge")}</span>
        </div>
        <h1 className="font-serif text-3xl font-bold text-[#1C1917] mb-2">
          {t("title")}
        </h1>
        <p className="text-sm text-[#78716C]">
          {t.rich("transforming", {
            title: bookTitle,
            strong: (chunks) => <span className="font-semibold text-[#1C1917]">{chunks}</span>,
          })}
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
                {t("failTitle")}
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
                  <span>{t("tryAgain")}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => router.push("/upload")}
                  className="px-5 py-2.5 rounded-lg border border-[#D6CEBE] text-xs font-medium text-[#57534E] hover:bg-[#F8F5EE]"
                >
                  {t("uploadDifferent")}
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
            <span className="font-semibold text-[#1C1917]">{t("generating")}</span>
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
                      {t(`step${item.step}Label`)}
                    </span>
                    {isCompleted && (
                      <span className="text-[10px] uppercase tracking-wider font-semibold text-[#A34825]">
                        {t("verified")}
                      </span>
                    )}
                    {isActive && (
                      <span className="text-[10px] uppercase tracking-wider font-semibold text-[#1C1917] animate-pulse">
                        {t("inProgress")}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#78716C] mt-0.5">
                    {t(`step${item.step}Sub`)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      )}

      <p className="text-center text-xs text-[#A8A29E] mt-6 italic font-serif">
        {t("footerNote")}
      </p>
    </div>
  );
}

function CreateFallback() {
  const t = useTranslations("Create");
  return (
    <div className="py-20 text-center text-xs text-[#78716C]">
      {t("loading")}
    </div>
  );
}

export default function CreatePage() {
  return (
    <Suspense fallback={<CreateFallback />}>
      <CreateContent />
    </Suspense>
  );
}
