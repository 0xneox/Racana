"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ProgressBar } from "@/components/ProgressBar";
import { Check, ArrowRight, Book, Feather, Compass, GraduationCap, Library, BookOpen, AlertTriangle, Loader2 } from "lucide-react";

interface TemplateDef {
  key: string;
  name: string;
  personality: string;
  description: string;
  icon: typeof Book;
  sampleFont: string;
  previewHeading: string;
  previewQuote: string;
}

const TEMPLATES: TemplateDef[] = [
  {
    key: "classic",
    name: "Classic",
    personality: "Timeless Literary",
    description: "Traditional Garamond typography with elegant drop caps and classic running headers.",
    icon: Book,
    sampleFont: "font-serif",
    previewHeading: "CHAPTER ONE",
    previewQuote: "True elegance withstands the passage of decades. Perfect for novels, historical memoirs, and timeless prose.",
  },
  {
    key: "modern",
    name: "Modern",
    personality: "Clean Minimal",
    description: "Crisp sans/serif blend, generous whitespace, asymmetrical chapter titles.",
    icon: Feather,
    sampleFont: "font-sans",
    previewHeading: "01 // INTRODUCTION",
    previewQuote: "Breathe life into business books, tech insights, and modern non-fiction with confident typographic pacing.",
  },
  {
    key: "philosophy",
    name: "Philosophy",
    personality: "Spacious Contemplative",
    description: "Wide margins for breathing room, subtle section markers, refined proportion.",
    icon: Compass,
    sampleFont: "font-serif",
    previewHeading: "BOOK I • MEDITATION",
    previewQuote: "Wide gutters and generous outer margins designed for contemplative reflection and margin notes.",
  },
  {
    key: "academic",
    name: "Academic",
    personality: "Structured Scholarly",
    description: "Clear hierarchy, footnote-friendly, rigorous folio layout.",
    icon: GraduationCap,
    sampleFont: "font-serif",
    previewHeading: "SECTION 1.1: METHODOLOGY",
    previewQuote: "Strict hierarchical subheadings, optimized bottom folios, and seamless footnote placement.",
  },
  {
    key: "literary",
    name: "Literary",
    personality: "Elegant Bookstore",
    description: "Deep typography, deckle-edge feel, poetic rhythm.",
    icon: Library,
    sampleFont: "font-serif",
    previewHeading: "I. THE RIVER RUN",
    previewQuote: "A rich, evocative typographic density evocative of artisan small-press clothbound editions.",
  },
];

interface AnalysisSummary {
  chapterCount: number;
  sectionCount: number;
  quotationCount: number;
  warningCount: number;
  detectedBookType: string | null;
  detectedTitle: string | null;
  estimatedPages: number;
}

function TemplatesContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const jobId = searchParams.get("jobId") || "";

  const [selectedKey, setSelectedKey] = useState<string>("classic");
  const [isSaving, setIsSaving] = useState(false);
  const [analysisLoading, setAnalysisLoading] = useState(true);
  const [analysisSummary, setAnalysisSummary] = useState<AnalysisSummary | null>(null);

  useEffect(() => {
    if (jobId) {
      fetch(`/api/jobs/${jobId}`)
        .then((res) => res.json())
        .then((data) => {
          if (data?.job?.templateChoice?.templateKey) {
            setSelectedKey(data.job.templateChoice.templateKey);
          }
        })
        .catch(() => {});
      setAnalysisLoading(true);
      fetch(`/api/jobs/${jobId}/structure`)
        .then(async (res) => {
          if (res.ok) {
            const json = await res.json();
            if (json?.summary) {
              setAnalysisSummary({
                chapterCount: Number(json.summary.chapterCount) || 0,
                sectionCount: Number(json.summary.sectionCount) || 0,
                quotationCount: Number(json.summary.quotationCount) || 0,
                warningCount: Number(json.summary.warningCount) || 0,
                detectedBookType: json.summary.detectedBookType || null,
                detectedTitle: json.summary.detectedTitle || null,
                estimatedPages: Number(json.summary.estimatedPages) || 0,
              });
            }
          }
        })
        .catch(() => {})
        .finally(() => setAnalysisLoading(false));
    }
  }, [jobId]);

  const handleContinue = async () => {
    if (jobId) {
      setIsSaving(true);
      try {
        await fetch(`/api/jobs/${jobId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ templateKey: selectedKey }),
        });
      } catch (err) {
        console.error("Failed to update template choice:", err);
      }
    }
    router.push(`/settings?jobId=${jobId}&template=${selectedKey}`);
  };

  return (
    <div className="py-10 px-4 sm:px-6 max-w-5xl mx-auto">
      <ProgressBar currentStep={2} />

      <div className="text-center mb-10">
        <h1 className="font-serif text-3xl sm:text-4xl font-bold text-[#1C1917] mb-2">
          Choose Your Book’s Personality
        </h1>
        <p className="text-sm text-[#78716C] max-w-xl mx-auto">
          Every template is engineered to strict bookstore printing standards with balanced margins, correct folios, and proper spine gutter clearance.
        </p>
      </div>

      <div className="mb-10 bg-white rounded-2xl border border-[#E2DDD2] p-5 sm:p-6 shadow-sm">
        {analysisLoading && (
          <div className="flex items-center gap-3 text-xs text-[#78716C]">
            <Loader2 className="w-4 h-4 animate-spin text-[#A34825]" />
            <span>Scanning your manuscript and detecting chapters…</span>
          </div>
        )}
        {!analysisLoading && analysisSummary && (
          <div>
            <div className="flex flex-col sm:flex-row sm:items-start gap-3 mb-4">
              <div className="w-9 h-9 rounded-lg bg-[#A34825]/10 text-[#A34825] flex items-center justify-center shrink-0">
                <BookOpen className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-serif text-base font-bold text-[#1C1917] mb-1">Structure detected</h3>
                <p className="text-sm text-[#57534E] leading-relaxed">
                  We found <strong>{analysisSummary.chapterCount}</strong> chapters, <strong>{analysisSummary.sectionCount}</strong> sections, and <strong>{analysisSummary.quotationCount}</strong> block quotation{analysisSummary.quotationCount === 1 ? "" : "s"} across an estimated <strong>{analysisSummary.estimatedPages}</strong> pages.
                  {analysisSummary.detectedTitle && (
                    <span className="block text-xs text-[#78716C] mt-1 italic">Detected title: “{analysisSummary.detectedTitle}”</span>
                  )}
                </p>
              </div>
              {analysisSummary.detectedBookType && (
                <span className="shrink-0 self-start inline-flex items-center px-2.5 py-1 rounded-full bg-[#F4EFEA] border border-[#E2DDD2] text-[11px] font-semibold text-[#57534E] capitalize">{analysisSummary.detectedBookType}</span>
              )}
            </div>
            {analysisSummary.warningCount > 0 && (
              <div className="text-[11px] text-[#78716C] flex items-center gap-1.5 mb-3">
                <AlertTriangle className="w-3.5 h-3.5 text-[#D97706]" />
                <span>{analysisSummary.warningCount} potential formatting note{analysisSummary.warningCount === 1 ? "" : "s"} flagged. No content was changed.</span>
              </div>
            )}
            <p className="text-[11px] text-[#A8A29E] italic">Your words are untouched. We only apply formatting — never rewrite, silently fix, or edit content.</p>
          </div>
        )}
        {!analysisLoading && !analysisSummary && (
          <p className="text-xs text-[#78716C]">Choose a template below to preview styles and continue.</p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
        {TEMPLATES.map((tmpl) => {
          const isSelected = selectedKey === tmpl.key;
          const Icon = tmpl.icon;

          return (
            <div
              key={tmpl.key}
              onClick={() => setSelectedKey(tmpl.key)}
              className={`rounded-2xl p-6 cursor-pointer transition-all relative flex flex-col justify-between ${
                isSelected
                  ? "border-2 border-[#1C1917] bg-[#FDFBF7] shadow-md ring-1 ring-[#1C1917]"
                  : "border border-[#E2DDD2] bg-white hover:border-[#78716C] hover:bg-[#FDFBF7]"
              }`}
            >
              {isSelected && (
                <div className="absolute top-4 right-4 w-6 h-6 rounded-full bg-[#1C1917] text-white flex items-center justify-center">
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                </div>
              )}

              <div>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 rounded-lg bg-[#F4EFEA] text-[#A34825] flex items-center justify-center">
                    <Icon className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-serif font-bold text-base text-[#1C1917]">
                      {tmpl.name}
                    </h3>
                    <span className="text-[11px] font-medium text-[#A34825]">
                      {tmpl.personality}
                    </span>
                  </div>
                </div>

                <p className="text-xs text-[#78716C] mb-6 leading-relaxed">
                  {tmpl.description}
                </p>

                {/* Visual Specimen Card */}
                <div className="bg-[#FAF8F3] border border-[#E8E2D5] rounded-xl p-4 mb-4 text-left select-none">
                  <div className="text-[10px] uppercase tracking-widest text-[#78716C] font-semibold mb-2">
                    {tmpl.previewHeading}
                  </div>
                  <p className={`text-xs text-[#44403C] italic leading-relaxed ${tmpl.sampleFont}`}>
                    “{tmpl.previewQuote}”
                  </p>
                </div>
              </div>

              <div className="pt-2 border-t border-[#F4EFEA] flex items-center justify-between text-[11px] text-[#78716C]">
                <span>Print-Ready Interior</span>
                <span className="font-semibold text-[#1C1917]">
                  {isSelected ? "Selected" : "Select Style"}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between pt-6 border-t border-[#E8E2D5]">
        <button
          onClick={() => router.back()}
          className="px-5 py-2.5 rounded-lg border border-[#D6CEBE] text-xs font-medium text-[#57534E] hover:bg-[#F8F5EE]"
        >
          Back to Upload
        </button>

        <button
          onClick={handleContinue}
          disabled={isSaving}
          className="px-8 py-3 rounded-xl bg-[#1C1917] text-[#F8F5EE] font-medium text-sm hover:bg-[#2E2824] shadow-md hover:shadow-lg transition-all flex items-center gap-2"
        >
          <span>Continue to Format Settings</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

export default function TemplatesPage() {
  return (
    <Suspense
      fallback={
        <div className="py-20 text-center text-xs text-[#78716C]">
          Loading styles...
        </div>
      }
    >
      <TemplatesContent />
    </Suspense>
  );
}
