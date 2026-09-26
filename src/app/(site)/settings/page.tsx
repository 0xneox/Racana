"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { ProgressBar } from "@/components/ProgressBar";
import { track } from "@/lib/analytics";
import { ChevronDown, ChevronUp, SlidersHorizontal, ArrowRight, Loader2, BookOpen } from "lucide-react";

interface TrimSizeOption {
  id: string;
  label: string;
  inches: string;
  popular?: boolean;
  /** Settings namespace key for the "ideal for" blurb */
  idealKey: string;
}

const TRIM_SIZES: TrimSizeOption[] = [
  { id: "trim_5x8", label: "5″ × 8″", inches: "5 x 8 in", idealKey: "trim1Ideal" },
  { id: "trim_5_5x8_5", label: "5.5″ × 8.5″", inches: "5.5 x 8.5 in", idealKey: "trim2Ideal" },
  { id: "trim_6x9", label: "6″ × 9″", inches: "6 x 9 in", popular: true, idealKey: "trim3Ideal" },
  { id: "trim_8_5x11", label: "8.5″ × 11″", inches: "8.5 x 11 in", idealKey: "trim4Ideal" },
];

const STYLE_NAME_KEY: Record<string, string> = {
  classic: "s1Name",
  modern: "s2Name",
  philosophy: "s3Name",
  academic: "s4Name",
  literary: "s5Name",
  indian: "s6Name",
};

const BOOK_TYPE_KEY: Record<string, string> = {
  novel: "typeNovel",
  philosophy: "typePhilosophy",
  academic: "typeAcademic",
  business: "typeBusiness",
  memoir: "typeMemoir",
  spiritual: "typeSpiritual",
  other: "typeOther",
};

function SettingsContent() {
  const t = useTranslations("Settings");
  const ts = useTranslations("Styles");
  const tu = useTranslations("Upload");
  const router = useRouter();
  const searchParams = useSearchParams();
  const jobId = searchParams.get("jobId") || "";

  // Simple Mode State
  const [bookType, setBookType] = useState("novel");
  const [templateKey, setTemplateKey] = useState("classic");
  const [trimSize, setTrimSize] = useState("trim_6x9");

  // Advanced Mode State (Collapsed by default)
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [fontBody, setFontBody] = useState("EB Garamond");
  const [fontHeading, setFontHeading] = useState("EB Garamond");
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
              setFontBody(s.fontBody || "EB Garamond");
              setFontHeading(s.fontHeading || "EB Garamond");
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
        // Guard against NaN in numeric inputs — empty fields produce NaN
        // via parseFloat, which would propagate to the API as null/NaN.
        const safeNum = (v: number) => (typeof v === "number" && !isNaN(v) && isFinite(v) ? v : undefined);
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
              fontSizePt: safeNum(fontSizePt),
              lineHeight: safeNum(lineHeight),
              marginInsideMm: safeNum(marginInsideMm),
              marginOutsideMm: safeNum(marginOutsideMm),
              marginTopMm: safeNum(marginTopMm),
              marginBottomMm: safeNum(marginBottomMm),
              pageNumbers,
              runningHeaders,
              chapterOpenRecto,
              bleed,
            },
          }),
        });

        // 2. Start queue generation
        await fetch(`/api/jobs/${jobId}/start`, { method: "POST" });
        track("settings_confirmed", { trimSize, bookType, templateKey }, jobId);
        track("render_started", { trimSize }, jobId);
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
          {t("title")}
        </h1>
        <p className="text-sm text-[#78716C]">
          {t("subtitle")}
        </p>
      </div>

      <div className="space-y-8">
        {/* SIMPLE MODE (Default) */}
        <div className="bg-white rounded-2xl border border-[#E2DDD2] p-6 sm:p-8 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-[#F4EFEA] pb-4">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-[#A34825]">
                {t("simpleSetup")}
              </span>
              <h2 className="font-serif font-bold text-lg text-[#1C1917]">
                {t("trimSize")}
              </h2>
            </div>
            <span className="text-xs text-[#78716C] bg-[#F8F5EE] px-3 py-1 rounded-full border border-[#E8E2D5]">
              {t("popularNote")}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {TRIM_SIZES.map((opt) => {
              const isSelected = trimSize === opt.id;
              return (
                <div
                  key={opt.id}
                  onClick={() => setTrimSize(opt.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setTrimSize(opt.id);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  aria-label={t("trimAria", { size: opt.label })}
                  aria-pressed={isSelected}
                  className={`p-4 rounded-xl cursor-pointer transition-all border relative flex flex-col justify-between focus:outline-none focus-visible:ring-2 focus-visible:ring-[#A34825] focus-visible:ring-offset-2 ${
                    isSelected
                      ? "border-[#1C1917] bg-[#FDFBF7] ring-1 ring-[#1C1917] shadow-sm"
                      : "border-[#E2DDD2] bg-white hover:border-[#78716C]"
                  }`}
                >
                  {opt.popular && (
                    <span className="absolute top-3 right-3 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-[#1C1917] text-white">
                      {t("standardBadge")}
                    </span>
                  )}
                  <div>
                    <div className="font-serif font-bold text-base text-[#1C1917]">
                      {opt.label}
                    </div>
                    <div className="text-xs text-[#78716C] mt-1">{t(opt.idealKey)}</div>
                  </div>
                  <div className="mt-3 text-[11px] text-[#A34825] font-medium">
                    {isSelected ? t("selected") : t("clickToSelect")}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="pt-4 border-t border-[#F4EFEA] flex flex-wrap gap-4 text-xs text-[#78716C]">
            <div>
              <span className="font-semibold text-[#1C1917]">{t("styleLabel")}: </span>
              <span>{ts(STYLE_NAME_KEY[templateKey] || "s1Name")}</span>
            </div>
            <div>
              <span className="font-semibold text-[#1C1917]">{t("typeLabel")}: </span>
              <span>{tu(BOOK_TYPE_KEY[bookType] || "typeNovel")}</span>
            </div>
            <div>
              <span className="font-semibold text-[#1C1917]">{t("gutterLabel")}: </span>
              <span>{t("gutterAuto")}</span>
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
                  {t("advanced")}
                </span>
                <span className="text-[11px] text-[#78716C]">
                  {t("advancedSub")}
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
                    {t("bodyFont")}
                  </label>
                  <select
                    value={fontBody}
                    onChange={(e) => setFontBody(e.target.value)}
                    className="w-full p-2.5 rounded-lg border border-[#D6CEBE] bg-[#FDFBF7] text-[#1C1917]"
                  >
                    <option value="EB Garamond">EB Garamond (Classic Literary)</option>
                    <option value="Libre Baskerville">Libre Baskerville (Refined)</option>
                    <option value="Source Serif 4">Source Serif 4 (Contemporary)</option>
                    <option value="Noto Serif Devanagari">Noto Serif Devanagari (Hindi)</option>
                    <option value="Noto Serif Malayalam">Noto Serif Malayalam</option>
                    <option value="Noto Serif Tamil">Noto Serif Tamil</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-[#1C1917] mb-1">
                    {t("headingFont")}
                  </label>
                  <select
                    value={fontHeading}
                    onChange={(e) => setFontHeading(e.target.value)}
                    className="w-full p-2.5 rounded-lg border border-[#D6CEBE] bg-[#FDFBF7] text-[#1C1917]"
                  >
                    <option value="EB Garamond">EB Garamond (Classic Serif)</option>
                    <option value="Libre Baskerville">Libre Baskerville (Bookish)</option>
                    <option value="Source Sans 3">Source Sans 3 (Clean Modern)</option>
                    <option value="Noto Serif Devanagari">Noto Serif Devanagari (Hindi)</option>
                    <option value="Noto Serif Malayalam">Noto Serif Malayalam</option>
                    <option value="Noto Serif Tamil">Noto Serif Tamil</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <label className="block font-semibold text-[#1C1917] mb-1">
                    {t("fontSize")} ({fontSizePt}pt)
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
                    {t("lineSpacing")} ({lineHeight}x)
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
                    {t("insideGutter")}
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
                    {t("outsideMargin")}
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
                  <span>{t("rectoChapters")}</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={runningHeaders}
                    onChange={(e) => setRunningHeaders(e.target.checked)}
                    className="rounded border-[#D6CEBE] text-[#1C1917] focus:ring-0"
                  />
                  <span>{t("runningHeaders")}</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={bleed}
                    onChange={(e) => setBleed(e.target.checked)}
                    className="rounded border-[#D6CEBE] text-[#1C1917] focus:ring-0"
                  />
                  <span>{t("bleed")}</span>
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
            {t("backToStyles")}
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
                <span>{t("preparing")}</span>
              </>
            ) : (
              <>
                <span>{t("makeMyBook")}</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function SettingsFallback() {
  const t = useTranslations("Settings");
  return (
    <div className="py-20 text-center text-xs text-[#78716C]">
      {t("loading")}
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<SettingsFallback />}>
      <SettingsContent />
    </Suspense>
  );
}
