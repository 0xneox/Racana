"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ProgressBar } from "@/components/ProgressBar";
import { CheckCircle2, Loader2, Circle, Sparkles, BookOpen } from "lucide-react";

interface ChecklistItem {
  id: number;
  label: string;
  sublabel: string;
}

const CHECKLIST_ITEMS: ChecklistItem[] = [
  { id: 1, label: "Manuscript analyzed", sublabel: "Validating file integrity, encoding, and word count" },
  { id: 2, label: "Chapters detected", sublabel: "Parsing titles, subtitles, scene breaks, and frontmatter" },
  { id: 3, label: "Typography applied", sublabel: "Setting font metrics, optical kerning, and baseline grid" },
  { id: 4, label: "Layout generated", sublabel: "Typesetting with Typst engine and binding geometry" },
  { id: 5, label: "Pagination optimized", sublabel: "Eliminating widows, orphans, and awkward breaks" },
  { id: 6, label: "Images checked", sublabel: "Verifying 300 DPI resolution and CMYK print profiles" },
  { id: 7, label: "Print margins checked", sublabel: "Enforcing 0.875″ gutter clearance and trim safety" },
  { id: 8, label: "Final PDF generated", sublabel: "Exporting PDF/X-compliant press interior" },
];

function CreateContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const jobId = searchParams.get("jobId") || "";

  const [progress, setProgress] = useState(15);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [activeStep, setActiveStep] = useState<number>(1);
  const [bookTitle, setBookTitle] = useState("Your Manuscript");

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
          const stepIndex = Math.min(8, Math.floor((next / 100) * 8) + 1);
          setActiveStep(stepIndex);
          setCompletedSteps(Array.from({ length: stepIndex - 1 }, (_, i) => i + 1));
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

          // Map current step or progress to checklist index (1-8)
          const currentStepIndex = Math.max(1, Math.min(8, Math.ceil((currentPct / 100) * 8)));
          setActiveStep(currentStepIndex);
          setCompletedSteps(
            Array.from({ length: currentStepIndex - (currentPct === 100 ? 0 : 1) }, (_, i) => i + 1)
          );

          if (job.status === "ready" || currentPct >= 100) {
            setCompletedSteps([1, 2, 3, 4, 5, 6, 7, 8]);
            setProgress(100);
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
  }, [jobId, router]);

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

      {/* Main Status Container */}
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
