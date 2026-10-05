"use client";

import { useState, useEffect, useMemo, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { ProgressBar } from "@/components/ProgressBar";
import { track } from "@/lib/analytics";
import { Check, ArrowRight, Book, Feather, BookOpen, AlertTriangle, AlertCircle, Loader2 } from "lucide-react";

interface TemplateDef {
  key: string;
  /** Templates namespace key (t1–t6) for personality/description/quote */
  tk: string;
  /** Styles namespace key (s1–s6) for the shared style name */
  sk: string;
  icon: typeof Book;
  sampleFont: string;
  previewHeading: string;
}

// Launch catalogue: only the two templates that have been through the full
// print-quality audit are offered.  The engine still knows the others for
// existing jobs, but they are not sold.
const TEMPLATES: TemplateDef[] = [
  { key: "classic", tk: "t1", sk: "s1", icon: Book, sampleFont: "font-serif", previewHeading: "CHAPTER ONE" },
  { key: "modern", tk: "t2", sk: "s2", icon: Feather, sampleFont: "font-sans", previewHeading: "1  INTRODUCTION" },
];

interface DetectedChapter {
  index: number;
  number: number;
  title: string;
  wordCount: number;
}

interface AnalysisSummary {
  chapterCount: number;
  sectionCount: number;
  quotationCount: number;
  warningCount: number;
  detectedBookType: string | null;
  detectedTitle: string | null;
  detectedAuthor: string | null;
  detectedScript: string | null;
  scriptLabel: string | null;
  estimatedPages: number;
  chapters: DetectedChapter[];
  frontMatter: string[];
  backMatter: string[];
}

function TemplatesContent() {
  const t = useTranslations("Templates");
  const ts = useTranslations("Styles");
  const router = useRouter();
  const searchParams = useSearchParams();
  const jobId = searchParams.get("jobId") || "";

  const [selectedKey, setSelectedKey] = useState<string>("classic");
  const [hasSavedChoice, setHasSavedChoice] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [analysisLoading, setAnalysisLoading] = useState(true);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [analysisSummary, setAnalysisSummary] = useState<AnalysisSummary | null>(null);
  const [showChapters, setShowChapters] = useState(false);
  const [chapterEdits, setChapterEdits] = useState<Record<number, string>>({});
  const [structureSaved, setStructureSaved] = useState(false);
  // Title and author are printed on the half-title, title page, copyright
  // page and running heads — they must be confirmed by the author, never
  // guessed silently.
  const [bookTitle, setBookTitle] = useState("");
  const [bookAuthor, setBookAuthor] = useState("");
  const [metaTouched, setMetaTouched] = useState(false);
  // Titles freeze once the job enters the render pipeline — the structure
  // PATCH 409s from then on, so we show the editor as read-only instead.
  const [structureLocked, setStructureLocked] = useState(false);
  const [structureError, setStructureError] = useState<string | null>(null);

  useEffect(() => {
    if (jobId) {
      fetch(`/api/jobs/${jobId}`)
        .then((res) => res.json())
        .then((data) => {
          if (data?.job?.templateChoice?.templateKey) {
            setSelectedKey(data.job.templateChoice.templateKey);
            setHasSavedChoice(true);
          }
        })
        .catch(() => {});
      setAnalysisLoading(true);
      let attempts = 0;
      let cancelled = false;
      const poll = async () => {
        attempts++;
        try {
          const res = await fetch(`/api/jobs/${jobId}/structure`);
          if (res.ok) {
            const json = await res.json();
            if (json?.summary) {
              if (json.editable === false) setStructureLocked(true);
              setAnalysisSummary({
                chapterCount: Number(json.summary.chapterCount) || 0,
                sectionCount: Number(json.summary.sectionCount) || 0,
                quotationCount: Number(json.summary.quotationCount) || 0,
                warningCount: Number(json.summary.warningCount) || 0,
                detectedBookType: json.summary.detectedBookType || null,
                detectedTitle: json.summary.detectedTitle || null,
                detectedAuthor: json.summary.detectedAuthor || null,
                detectedScript: json.summary.detectedScript || null,
                scriptLabel: json.summary.scriptLabel || null,
                estimatedPages: Number(json.summary.estimatedPages) || 0,
                chapters: Array.isArray(json.summary.chapters) ? json.summary.chapters : [],
                frontMatter: Array.isArray(json.summary.frontMatter) ? json.summary.frontMatter : [],
                backMatter: Array.isArray(json.summary.backMatter) ? json.summary.backMatter : [],
              });
              setBookTitle((prev) => prev || json.summary.detectedTitle || "");
              setBookAuthor((prev) => prev || json.summary.detectedAuthor || "");
              setAnalysisLoading(false);
              return;
            }
          }
        } catch {}
        if (cancelled) return;
        if (attempts < 15) {
          setTimeout(poll, 1000);
        } else {
          setAnalysisLoading(false);
          setAnalysisError(t("analysisSlow"));
        }
      };
      poll();
      return () => {
        cancelled = true;
      };
    }
  }, [jobId]);

  // Recommend a template from what the analyzer learned: an Indic-script
  // manuscript needs the dedicated Indic design; otherwise map book type.
  // Indic-script manuscripts work in both: the renderer swaps in the Noto
  // family for the detected script automatically.
  const recommendedKey = useMemo(() => {
    if (!analysisSummary) return null;
    switch (analysisSummary.detectedBookType) {
      case "academic":
      case "business":
        return "modern";
      default:
        return "classic";
    }
  }, [analysisSummary]);

  // Pre-select the recommendation — an explicit saved choice always wins.
  useEffect(() => {
    if (recommendedKey && !hasSavedChoice) {
      setSelectedKey(recommendedKey);
    }
  }, [recommendedKey, hasSavedChoice]);

  const structurePayload = () => ({
    title: bookTitle.trim(),
    author: bookAuthor.trim(),
    chapters: Object.entries(chapterEdits).map(([index, title]) => ({
      index: Number(index),
      title,
    })),
  });

  const handleSaveStructure = async () => {
    if (!jobId || Object.keys(chapterEdits).length === 0) return;
    try {
      const res = await fetch(`/api/jobs/${jobId}/structure`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(structurePayload()),
      });
      if (res.ok) {
        setStructureError(null);
        setStructureSaved(true);
        setAnalysisSummary((prev) =>
          prev
            ? {
                ...prev,
                chapters: prev.chapters.map((c) =>
                  chapterEdits[c.index] ? { ...c, title: chapterEdits[c.index] } : c
                ),
              }
            : prev
        );
        setChapterEdits({});
      } else {
        const data = await res.json().catch(() => ({}));
        setStructureError(data.error || t("structureSaveFailed"));
      }
    } catch {
      setStructureError(t("structureSaveFailed"));
    }
  };

  const handleContinue = async () => {
    if (jobId) {
      setIsSaving(true);
      try {
        if (metaTouched || Object.keys(chapterEdits).length > 0) {
          await fetch(`/api/jobs/${jobId}/structure`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(structurePayload()),
          });
        }
        await fetch(`/api/jobs/${jobId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ templateKey: selectedKey }),
        });
        track("template_chosen", { template: selectedKey }, jobId);
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
          {t("title")}
        </h1>
        <p className="text-sm text-[#78716C] max-w-xl mx-auto">
          {t("subtitle")}
        </p>
      </div>

      <div className="mb-10 bg-white rounded-2xl border border-[#E2DDD2] p-5 sm:p-6 shadow-sm">
        {analysisLoading && (
          <div className="flex items-center gap-3 text-xs text-[#78716C]">
            <Loader2 className="w-4 h-4 animate-spin text-[#A34825]" />
            <span>{t("scanning")}</span>
          </div>
        )}
        {!analysisLoading && analysisSummary && (
          <div>
            <div className="flex flex-col sm:flex-row sm:items-start gap-3 mb-4">
              <div className="w-9 h-9 rounded-lg bg-[#A34825]/10 text-[#A34825] flex items-center justify-center shrink-0">
                <BookOpen className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-serif text-base font-bold text-[#1C1917] mb-1">{t("structureDetected")}</h3>
                <p className="text-sm text-[#57534E] leading-relaxed">
                  {t.rich("structureSummary", {
                    chapters: analysisSummary.chapterCount,
                    sections: analysisSummary.sectionCount,
                    quotes: analysisSummary.quotationCount,
                    pages: analysisSummary.estimatedPages,
                    strong: (chunks) => <strong>{chunks}</strong>,
                  })}
                </p>
                {structureLocked && (
                  <p className="mt-3 text-[11px] font-medium text-[#92400E] bg-[#FFFBEB] border border-[#FCD34D] rounded-lg px-3 py-2">
                    {t("titlesFrozen")}
                  </p>
                )}
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="block">
                    <span className="block text-[11px] font-semibold text-[#57534E] mb-1">{t("bookTitleLabel")}</span>
                    <input
                      type="text"
                      value={bookTitle}
                      maxLength={200}
                      disabled={structureLocked}
                      onChange={(e) => { setMetaTouched(true); setBookTitle(e.target.value); }}
                      className="w-full px-3 py-2 rounded-lg border border-[#E8E2D5] text-sm text-[#1C1917] focus:outline-none focus:border-[#1C1917] bg-[#FDFBF7] disabled:opacity-60 disabled:cursor-not-allowed"
                    />
                  </label>
                  <label className="block">
                    <span className="block text-[11px] font-semibold text-[#57534E] mb-1">{t("authorNameLabel")}</span>
                    <input
                      type="text"
                      value={bookAuthor}
                      maxLength={120}
                      placeholder={t("authorPlaceholder")}
                      disabled={structureLocked}
                      onChange={(e) => { setMetaTouched(true); setBookAuthor(e.target.value); }}
                      className="w-full px-3 py-2 rounded-lg border border-[#E8E2D5] text-sm text-[#1C1917] focus:outline-none focus:border-[#1C1917] bg-[#FDFBF7] disabled:opacity-60 disabled:cursor-not-allowed"
                    />
                  </label>
                </div>
                <p className="text-[11px] text-[#A8A29E] mt-1.5">{t("titleAuthorHint")}</p>
              </div>
              <div className="shrink-0 self-start flex flex-col items-end gap-1.5">
                {analysisSummary.detectedBookType && (
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-[#F4EFEA] border border-[#E2DDD2] text-[11px] font-semibold text-[#57534E] capitalize">{analysisSummary.detectedBookType}</span>
                )}
                {analysisSummary.detectedScript && analysisSummary.detectedScript !== "latin" && (
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-[#FFF7ED] border border-[#FDBA74] text-[11px] font-semibold text-[#9A3412]">
                    {analysisSummary.scriptLabel || analysisSummary.detectedScript} · {t("fontsIncluded")}
                  </span>
                )}
              </div>
            </div>
            {analysisSummary.warningCount > 0 && (
              <div className="text-[11px] text-[#78716C] flex items-center gap-1.5 mb-3">
                <AlertTriangle className="w-3.5 h-3.5 text-[#D97706]" />
                <span>{t("warningsFlagged", { count: analysisSummary.warningCount })}</span>
              </div>
            )}

            {analysisSummary.chapters.length > 0 && (
              <div className="mb-3">
                <button
                  type="button"
                  onClick={() => setShowChapters((v) => !v)}
                  className="text-xs font-semibold text-[#A34825] hover:text-[#8C3C1F] underline"
                >
                  {showChapters ? t("hideChapters") : t("reviewChapters", { count: analysisSummary.chapters.length })}
                </button>
                {showChapters && (
                  <div className="mt-3 space-y-1.5 max-h-64 overflow-y-auto pr-1">
                    {analysisSummary.chapters.map((ch) => (
                      <div key={ch.index} className="flex items-center gap-2">
                        <span className="w-6 shrink-0 text-[10px] font-semibold text-[#A8A29E] text-right">
                          {ch.number}
                        </span>
                        <input
                          type="text"
                          defaultValue={ch.title}
                          disabled={structureLocked}
                          onChange={(e) => {
                            setStructureSaved(false);
                            setChapterEdits((prev) => ({ ...prev, [ch.index]: e.target.value }));
                          }}
                          className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg border border-[#E8E2D5] text-xs text-[#1C1917] focus:outline-none focus:border-[#1C1917] bg-[#FDFBF7] disabled:opacity-60 disabled:cursor-not-allowed"
                        />
                        <span className="shrink-0 text-[10px] text-[#A8A29E]">
                          {ch.wordCount > 0 ? t("kWords", { count: (ch.wordCount / 1000).toFixed(1) }) : ""}
                        </span>
                      </div>
                    ))}
                    {analysisSummary.frontMatter.length > 0 && (
                      <p className="text-[10px] text-[#A8A29E] pt-1">
                        {t("frontMatter")}: {analysisSummary.frontMatter.join(", ")}
                      </p>
                    )}
                    {analysisSummary.backMatter.length > 0 && (
                      <p className="text-[10px] text-[#A8A29E]">
                        {t("backMatter")}: {analysisSummary.backMatter.join(", ")}
                      </p>
                    )}
                    <div className="flex items-center gap-3 pt-2">
                      {structureError && (
                        <span className="text-[11px] text-[#991B1B] font-medium">{structureError}</span>
                      )}
                      {!structureLocked && Object.keys(chapterEdits).length > 0 && (
                        <button
                          type="button"
                          onClick={handleSaveStructure}
                          className="px-4 py-1.5 rounded-lg bg-[#1C1917] text-[#F8F5EE] text-xs font-medium hover:bg-[#2E2824]"
                        >
                          {t("saveChapters")}
                        </button>
                      )}
                      {structureSaved && (
                        <span className="text-[11px] text-[#166534] font-medium">{t("chaptersSaved")}</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            <p className="text-[11px] text-[#A8A29E] italic">{t("untouched")}</p>
          </div>
        )}
        {!analysisLoading && !analysisSummary && (
          <p className="text-xs text-[#78716C]">{t("chooseBelow")}</p>
        )}
        {analysisError && (
          <div className="p-3 rounded-xl bg-[#FEF3C7] border border-[#FCD34D] text-[#92400E] text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{analysisError}</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12 max-w-3xl mx-auto">
        {TEMPLATES.map((tmpl) => {
          const isSelected = selectedKey === tmpl.key;
          const Icon = tmpl.icon;
          const name = ts(`${tmpl.sk}Name`);

          return (
            <div
              key={tmpl.key}
              onClick={() => setSelectedKey(tmpl.key)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setSelectedKey(tmpl.key);
                }
              }}
              role="button"
              tabIndex={0}
              aria-label={t("selectAria", { name })}
              aria-pressed={isSelected}
              className={`rounded-2xl p-6 cursor-pointer transition-all relative flex flex-col justify-between focus:outline-none focus-visible:ring-2 focus-visible:ring-[#A34825] focus-visible:ring-offset-2 ${
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
                      {name}
                    </h3>
                    <span className="text-[11px] font-medium text-[#A34825]">
                      {t(`${tmpl.tk}Personality`)}
                    </span>
                    {recommendedKey === tmpl.key && (
                      <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded bg-[#A34825]/10 text-[10px] font-semibold uppercase tracking-wide text-[#A34825]">
                        {t("recommended")}
                      </span>
                    )}
                  </div>
                </div>

                <p className="text-xs text-[#78716C] mb-6 leading-relaxed">
                  {t(`${tmpl.tk}Desc`)}
                </p>

                {/* Visual Specimen Card */}
                <div className="bg-[#FAF8F3] border border-[#E8E2D5] rounded-xl p-4 mb-4 text-left select-none">
                  <div className="text-[10px] uppercase tracking-widest text-[#78716C] font-semibold mb-2">
                    {tmpl.previewHeading}
                  </div>
                  <p className={`text-xs text-[#44403C] italic leading-relaxed ${tmpl.sampleFont}`}>
                    “{t(`${tmpl.tk}Quote`)}”
                  </p>
                </div>
              </div>

              <div className="pt-2 border-t border-[#F4EFEA] flex items-center justify-between text-[11px] text-[#78716C]">
                <span>{t("printReadyInterior")}</span>
                <span className="font-semibold text-[#1C1917]">
                  {isSelected ? t("selected") : t("selectStyle")}
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
          {t("backToUpload")}
        </button>

        <button
          onClick={handleContinue}
          disabled={isSaving || (!!analysisSummary && !bookTitle.trim())}
          className="px-8 py-3 rounded-xl bg-[#1C1917] text-[#F8F5EE] font-medium text-sm hover:bg-[#2E2824] shadow-md hover:shadow-lg transition-all flex items-center gap-2"
        >
          <span>{t("continueToFormat")}</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function TemplatesFallback() {
  const t = useTranslations("Templates");
  return (
    <div className="py-20 text-center text-xs text-[#78716C]">
      {t("loading")}
    </div>
  );
}

export default function TemplatesPage() {
  return (
    <Suspense fallback={<TemplatesFallback />}>
      <TemplatesContent />
    </Suspense>
  );
}
