"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ProgressBar } from "@/components/ProgressBar";
import { ChevronDown, ChevronUp, SlidersHorizontal, ArrowRight, Loader2, BookOpen } from "lucide-react";

interface TrimSizeOption {
  id: string;
  label: string;
  inches: string;
  popular?: boolean;
  idealFor: string;
}

const TRIM_SIZES: TrimSizeOption[] = [
  { id: "trim_5x8", label: "5″ × 8″", inches: "5 x 8 in", idealFor: "Pocket paperbacks, fiction, poetry" },
  { id: "trim_5_5x8_5", label: "5.5″ × 8.5″", inches: "5.5 x 8.5 in", idealFor: "Novels, memoirs, biographies" },
  { id: "trim_6x9", label: "6″ × 9″", inches: "6 x 9 in", popular: true, idealFor: "Standard publishing, non-fiction, trade" },
  { id: "trim_8_5x11", label: "8.5″ × 11″", inches: "8.5 x 11 in", idealFor: "Textbooks, workbooks, large manuals" },
];

function SettingsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const jobId = searchParams.get("jobId") || "";

  // Simple Mode State
  const [bookType, setBookType] = useState("novel");
  const [templateKey, setTemplateKey] = useState("classic");
  const [trimSize, setTrimSize] = useState("trim_6x9");

  // Advanced Mode State (Collapsed by default)
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [fontBody, setFontBody] = useState("Garamond");
  const [fontHeading, setFontHeading] = useState("Cinzel");
  const [fontSizePt, setFontSizePt] = useState(11.0);
  const [lineHeight, setLineHeight] = useState(1.35);
  const [marginInsideMm, setMarginInsideMm] = useState(22.2); // 0.875" gutter
  const [marginOutsideMm, setMarginOutsideMm] = useState(15.9);
  const [marginTopMm, setMarginTopMm] = useState(19.1);
  const [marginBottomMm, setMarginBottomMm] = useState(19.1);
  const [pageNumbers, setPageNumbers] = useState("bottom_center");
  const [runningHeaders, setRunningHeaders] = useState(true);
  const [chapterOpenRecto, setChapterOpenRecto] = useState(true);
  const [bleed, setBleed] = useState(false);

  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (jobId) {
      fetch(`/api/jobs/${jobId}`)
        .then((res) => res.json())
        .then((data) => {
          if (data?.job) {
            setBookType(data.job.bookType || "novel");
            if (data.job.templateChoice?.templateKey) {
              setTemplateKey(data.job.templateChoice.templateKey);
            }
            if (data.job.trimSize) {
              setTrimSize(data.job.trimSize);
            }
            if (data.job.settings) {
              const s = data.job.settings;
              setFontBody(s.fontBody || "Garamond");
              setFontHeading(s.fontHeading || "Cinzel");
              setFontSizePt(s.fontSizePt || 11.0);
              setLineHeight(s.lineHeight || 1.35);
              setMarginInsideMm(s.marginInsideMm || 22.2);
              setMarginOutsideMm(s.marginOutsideMm || 15.9);
              setMarginTopMm(s.marginTopMm || 19.1);
              setMarginBottomMm(s.marginBottomMm || 19.1);
              setPageNumbers(s.pageNumbers || "bottom_center");
              setRunningHeaders(s.runningHeaders ?? true);
              setChapterOpenRecto(s.chapterOpenRecto ?? true);
              setBleed(s.bleed ?? false);
            }
          }
        })
        .catch(() => {});
    }
  }, [jobId]);

  const handleStartGeneration = async () => {
    setIsLoading(true);

    if (jobId) {
      try {
        // 1. Save settings
        await fetch(`/api/jobs/${jobId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            bookType,
            templateKey,
            trimSize,
            settings: {
              trimSize,
              fontBody,
              fontHeading,
              fontSizePt,
              lineHeight,
              marginInsideMm,
              marginOutsideMm,
              marginTopMm,
              marginBottomMm,
              pageNumbers,
              runningHeaders,
              chapterOpenRecto,
              bleed,
            },
          }),
        });

        // 2. Start queue generation
        await fetch(`/api/jobs/${jobId}/start`, { method: "POST" });
      } catch (err) {
        console.error("Error starting generation:", err);
      }
    }

    router.push(`/create?jobId=${jobId}`);
  };

  return (
    <div className="py-10 px-4 sm:px-6 max-w-3xl mx-auto">
      <ProgressBar currentStep={3} />

      <div className="text-center mb-8">
        <h1 className="font-serif text-3xl font-bold text-[#1C1917] mb-2">
          Format & Print Specifications
        </h1>
        <p className="text-sm text-[#78716C]">
          Choose your physical book size. Optimal margins and gutter binding allowances are automatically applied.
        </p>
      </div>

      <div className="space-y-8">
        {/* SIMPLE MODE (Default) */}
        <div className="bg-white rounded-2xl border border-[#E2DDD2] p-6 sm:p-8 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-[#F4EFEA] pb-4">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-[#A34825]">
                Simple Setup (Standard)
              </span>
              <h2 className="font-serif font-bold text-lg text-[#1C1917]">
                Book Trim Size
              </h2>
            </div>
            <span className="text-xs text-[#78716C] bg-[#F8F5EE] px-3 py-1 rounded-full border border-[#E8E2D5]">
              90% of authors use 6″ × 9″
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {TRIM_SIZES.map((t) => {
              const isSelected = trimSize === t.id;
              return (
                <div
                  key={t.id}
                  onClick={() => setTrimSize(t.id)}
                  className={`p-4 rounded-xl cursor-pointer transition-all border relative flex flex-col justify-between ${
                    isSelected
                      ? "border-[#1C1917] bg-[#FDFBF7] ring-1 ring-[#1C1917] shadow-sm"
                      : "border-[#E2DDD2] bg-white hover:border-[#78716C]"
                  }`}
                >
                  {t.popular && (
                    <span className="absolute top-3 right-3 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-[#1C1917] text-white">
                      Standard
                    </span>
                  )}
                  <div>
                    <div className="font-serif font-bold text-base text-[#1C1917]">
                      {t.label}
                    </div>
                    <div className="text-xs text-[#78716C] mt-1">{t.idealFor}</div>
                  </div>
                  <div className="mt-3 text-[11px] text-[#A34825] font-medium">
                    {isSelected ? "✓ Selected" : "Click to select"}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="pt-4 border-t border-[#F4EFEA] flex flex-wrap gap-4 text-xs text-[#78716C]">
            <div>
              <span className="font-semibold text-[#1C1917]">Style: </span>
              <span className="capitalize">{templateKey}</span>
            </div>
            <div>
              <span className="font-semibold text-[#1C1917]">Type: </span>
              <span className="capitalize">{bookType}</span>
            </div>
            <div>
              <span className="font-semibold text-[#1C1917]">Gutter: </span>
              <span>Auto-compensated (0.875″)</span>
            </div>
          </div>
        </div>

        {/* ADVANCED SETTINGS (Collapsed by default, 90% never open this) */}
        <div className="border border-[#E2DDD2] rounded-2xl bg-[#FDFBF7] overflow-hidden">
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-[#F8F5EE] transition-colors"
          >
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-[#78716C]" />
              <div>
                <span className="text-xs font-semibold text-[#1C1917] block">
                  Advanced Typography & Margin Controls
                </span>
                <span className="text-[11px] text-[#78716C]">
                  Optional fine-tuning (90% of authors leave this untouched)
                </span>
              </div>
            </div>
            {showAdvanced ? (
              <ChevronUp className="w-4 h-4 text-[#78716C]" />
            ) : (
              <ChevronDown className="w-4 h-4 text-[#78716C]" />
            )}
          </button>

          {showAdvanced && (
            <div className="p-6 border-t border-[#E8E2D5] space-y-6 bg-white text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-[#1C1917] mb-1">
                    Body Font Family
                  </label>
                  <select
                    value={fontBody}
                    onChange={(e) => setFontBody(e.target.value)}
                    className="w-full p-2.5 rounded-lg border border-[#D6CEBE] bg-[#FDFBF7] text-[#1C1917]"
                  >
                    <option value="Garamond">EB Garamond (Classic Literary)</option>
                    <option value="Baskerville">Libre Baskerville (Refined)</option>
                    <option value="Minion">Minion Pro (Contemporary)</option>
                    <option value="Caslon">Caslon (Traditional English)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-[#1C1917] mb-1">
                    Heading Font Family
                  </label>
                  <select
                    value={fontHeading}
                    onChange={(e) => setFontHeading(e.target.value)}
                    className="w-full p-2.5 rounded-lg border border-[#D6CEBE] bg-[#FDFBF7] text-[#1C1917]"
                  >
                    <option value="Cinzel">Cinzel (Roman Lapidary)</option>
                    <option value="Playfair">Playfair Display (Serif)</option>
                    <option value="Inter">Inter (Clean Modern Sans)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <label className="block font-semibold text-[#1C1917] mb-1">
                    Font Size ({fontSizePt}pt)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="9"
                    max="14"
                    value={fontSizePt}
                    onChange={(e) => setFontSizePt(parseFloat(e.target.value))}
                    className="w-full p-2 rounded-lg border border-[#D6CEBE]"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#1C1917] mb-1">
                    Line Spacing ({lineHeight}x)
                  </label>
                  <input
                    type="number"
                    step="0.05"
                    min="1.1"
                    max="1.8"
                    value={lineHeight}
                    onChange={(e) => setLineHeight(parseFloat(e.target.value))}
                    className="w-full p-2 rounded-lg border border-[#D6CEBE]"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#1C1917] mb-1">
                    Inside Gutter (mm)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    value={marginInsideMm}
                    onChange={(e) => setMarginInsideMm(parseFloat(e.target.value))}
                    className="w-full p-2 rounded-lg border border-[#D6CEBE]"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#1C1917] mb-1">
                    Outside Margin (mm)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    value={marginOutsideMm}
                    onChange={(e) => setMarginOutsideMm(parseFloat(e.target.value))}
                    className="w-full p-2 rounded-lg border border-[#D6CEBE]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-[#F4EFEA]">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={chapterOpenRecto}
                    onChange={(e) => setChapterOpenRecto(e.target.checked)}
                    className="rounded border-[#D6CEBE] text-[#1C1917] focus:ring-0"
                  />
                  <span>Chapter Openings on Recto (Right page)</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={runningHeaders}
                    onChange={(e) => setRunningHeaders(e.target.checked)}
                    className="rounded border-[#D6CEBE] text-[#1C1917] focus:ring-0"
                  />
                  <span>Include Running Headers</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={bleed}
                    onChange={(e) => setBleed(e.target.checked)}
                    className="rounded border-[#D6CEBE] text-[#1C1917] focus:ring-0"
                  />
                  <span>Include 0.125″ Outer Bleed</span>
                </label>
              </div>
            </div>
          )}
        </div>

        {/* CTA */}
        <div className="flex items-center justify-between pt-4">
          <button
            type="button"
            onClick={() => router.back()}
            className="px-5 py-2.5 rounded-lg border border-[#D6CEBE] text-xs font-medium text-[#57534E] hover:bg-[#F8F5EE]"
          >
            Back to Styles
          </button>

          <button
            type="button"
            onClick={handleStartGeneration}
            disabled={isLoading}
            className="px-8 py-3.5 rounded-xl bg-[#1C1917] text-[#F8F5EE] font-medium text-sm hover:bg-[#2E2824] shadow-md hover:shadow-lg transition-all flex items-center gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Preparing Engine...</span>
              </>
            ) : (
              <>
                <span>Make My Book</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense
      fallback={
        <div className="py-20 text-center text-xs text-[#78716C]">
          Loading specifications...
        </div>
      }
    >
      <SettingsContent />
    </Suspense>
  );
}
