"use client";

import { useEffect, useState, useMemo, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Sparkles,
  Download,
  ArrowLeft,
  Palette,
  Type,
  Layers,
  BookOpen,
  Check,
  RotateCcw,
  Loader2,
  FileCheck,
  Eye,
  Sliders,
  Share2,
} from "lucide-react";
import {
  COVER_PRESETS,
  generateCoverSvg,
  spineWidthInches,
  type CoverDesignConfig,
  type CoverPreset,
  type CoverOrnament,
  type CoverFont,
  type CoverFormat,
  type CoverLayout,
} from "@/lib/cover/generator";
import { coverPdfBlob, coverPngBlob, downloadBlob, coverFilename } from "@/lib/cover/export";

function CoverStudioContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const jobId = searchParams.get("jobId") || "";

  const [activeTab, setActiveTab] = useState<"presets" | "content" | "style" | "ornament">("presets");
  const [format, setFormat] = useState<CoverFormat>("ebook");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [downloadingPng, setDownloadingPng] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [showGuides, setShowGuides] = useState(true);

  // Cover configuration state
  const [config, setConfig] = useState<CoverDesignConfig>(() => ({
    title: "Echoes of Eternity",
    subtitle: "A Journey Through Ancient Truths",
    author: "Aryavrat Varma",
    tagline: "National Literary Bestseller",
    genre: "Fiction",
    spineText: "Echoes of Eternity",
    backBlurb:
      "A luminous tale woven with the depth of Indian heritage, philosophical contemplation, and unforgettable characters. This edition has been typeset with devotion to classical bookmaking standards.",
    aboutAuthor:
      "Aryavrat Varma is a novelist and cultural historian whose works explore human consciousness, mythology, and timeless landscapes.",
    isbn: "978-93-89000-01-2",
    publisher: "Racana Books",
    palette: COVER_PRESETS[0].palette,
    typography: COVER_PRESETS[0].typography,
    ornament: COVER_PRESETS[0].ornament,
    layoutStyle: COVER_PRESETS[0].layoutStyle,
    format: "ebook",
    pageCount: 180,
  }));

  // Fetch job details to auto-populate from manuscript
  useEffect(() => {
    if (!jobId) {
      setLoading(false);
      return;
    }
    fetch(`/api/jobs/${jobId}/cover`)
      .then((res) => res.json())
      .then((data) => {
        if (data?.config) {
          setConfig((prev) => ({
            ...prev,
            ...data.config,
            format: prev.format,
          }));
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [jobId]);

  // Sync format with config
  useEffect(() => {
    setConfig((prev) => ({ ...prev, format }));
  }, [format]);

  // Load the cover font families so the live preview matches the export.
  useEffect(() => {
    const id = "cover-studio-fonts";
    if (document.getElementById(id)) return;
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href =
      "https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&family=EB+Garamond:ital,wght@0,400;0,700;1,400&family=Noto+Serif:ital,wght@0,400;0,700;1,400&family=Noto+Serif+Devanagari:wght@400;700&family=Poppins:wght@400;600;700&display=swap";
    document.head.appendChild(link);
  }, []);

  // Live SVG Preview
  const svgOutput = useMemo(() => {
    try {
      return generateCoverSvg(config, { showGuides });
    } catch {
      return "";
    }
  }, [config, showGuides]);

  // Apply a preset
  const applyPreset = (preset: CoverPreset) => {
    setConfig((prev) => ({
      ...prev,
      palette: { ...preset.palette },
      ornament: preset.ornament,
      layoutStyle: preset.layoutStyle,
      typography: { ...preset.typography },
    }));
  };

  // Shuffle / Invert inspiration
  const handleShuffle = () => {
    const randomPreset = COVER_PRESETS[Math.floor(Math.random() * COVER_PRESETS.length)];
    const ornaments: CoverOrnament[] = ["mandala", "lotus", "arch", "flourish", "geometric"];
    const randomOrnament = ornaments[Math.floor(Math.random() * ornaments.length)];
    setConfig((prev) => ({
      ...prev,
      palette: { ...randomPreset.palette },
      ornament: randomOrnament,
      layoutStyle: randomPreset.layoutStyle,
      typography: { ...randomPreset.typography },
    }));
  };

  // Download SVG
  const handleDownloadSvg = () => {
    const blob = new Blob([svgOutput], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${config.title.replace(/[^a-zA-Z0-9_-]/g, "_")}_cover.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Download Print-Ready PDF — rendered client-side from the same SVG as the
  // preview, so the download is pixel-identical to what the user sees.
  const handleDownloadPdf = async () => {
    setDownloadingPdf(true);
    setExportError(null);
    try {
      const blob = await coverPdfBlob(config);
      downloadBlob(blob, coverFilename(config, "pdf"));
    } catch (e) {
      console.error(e);
      setExportError("PDF export failed. Try again or download the SVG instead.");
    } finally {
      setDownloadingPdf(false);
    }
  };

  // Download high-res PNG (300 DPI) — KDP accepts PNG/JPG for eBook covers.
  const handleDownloadPng = async () => {
    setDownloadingPng(true);
    setExportError(null);
    try {
      const blob = await coverPngBlob(config);
      downloadBlob(blob, coverFilename(config, "png"));
    } catch (e) {
      console.error(e);
      setExportError("PNG export failed. Try again or download the SVG instead.");
    } finally {
      setDownloadingPng(false);
    }
  };

  // Save Cover to Job — persists the design config and uploads the
  // client-rendered PDF/PNG so stored artifacts match the preview exactly.
  const handleSaveToBook = async () => {
    if (!jobId) return;
    setSaving(true);
    setSavedSuccess(false);
    setExportError(null);
    try {
      const form = new FormData();
      form.append("config", JSON.stringify(config));
      try {
        form.append("pdf", await coverPdfBlob(config), "cover.pdf");
        form.append("png", await coverPngBlob(config), "cover.png");
      } catch {
        // Rasterization unavailable (e.g. headless) — config is still saved.
      }
      const res = await fetch(`/api/jobs/${jobId}/cover`, { method: "POST", body: form });
      if (res.ok) {
        setSavedSuccess(true);
        setTimeout(() => setSavedSuccess(false), 4000);
      } else {
        setExportError("Could not save the cover. Please try again.");
      }
    } catch (e) {
      console.error(e);
      setExportError("Could not save the cover. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FDFBF7] text-[#1C1917]">
      {/* Top Header */}
      <div className="border-b border-[#E8E2D5] bg-white/80 backdrop-blur sticky top-0 z-40 px-4 sm:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href={jobId ? `/ready?jobId=${jobId}` : "/books"}
            className="p-1.5 rounded-lg hover:bg-[#F4EFEA] text-[#57534E] transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="font-serif font-bold text-base sm:text-lg flex items-center gap-2">
              <span>Cover Studio</span>
              <span className="text-[10px] uppercase font-sans tracking-widest font-semibold px-2 py-0.5 rounded-full bg-[#A34825]/10 text-[#A34825]">
                Print &amp; eBook
              </span>
            </h1>
            <p className="text-[11px] text-[#78716C] truncate max-w-xs sm:max-w-md">
              {config.title} · {config.author}
            </p>
          </div>
        </div>

        {/* Top Actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={handleShuffle}
            className="px-3 py-1.5 rounded-lg border border-[#D6CEBE] bg-[#F8F5EE] text-xs font-semibold hover:border-[#1C1917] transition-all flex items-center gap-1.5"
            title="Randomize Harmonious Palette"
          >
            <Sparkles className="w-3.5 h-3.5 text-[#A34825]" />
            <span className="hidden sm:inline">Inspire Me</span>
          </button>

          {jobId && (
            <button
              type="button"
              onClick={handleSaveToBook}
              disabled={saving}
              className="px-4 py-1.5 rounded-lg bg-[#1C1917] text-[#F8F5EE] text-xs font-semibold hover:bg-[#2E2824] transition-all flex items-center gap-1.5 disabled:opacity-60"
            >
              {saving ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : savedSuccess ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <FileCheck className="w-3.5 h-3.5" />
              )}
              <span>{savedSuccess ? "Saved to Book!" : "Save Cover"}</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Studio Grid */}
      <div className="max-w-[1520px] mx-auto p-4 sm:p-6 lg:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Live Canvas Preview */}
        <div className="lg:col-span-7 flex flex-col items-center">
          {/* Format Switcher */}
          <div className="bg-[#EFE9DF] p-1 rounded-xl flex items-center gap-1 mb-5">
            <button
              type="button"
              onClick={() => setFormat("ebook")}
              className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                format === "ebook"
                  ? "bg-white text-[#1C1917] shadow-sm"
                  : "text-[#78716C] hover:text-[#1C1917]"
              }`}
            >
              eBook Front Cover (1:1.6)
            </button>
            <button
              type="button"
              onClick={() => setFormat("paperback")}
              className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                format === "paperback"
                  ? "bg-white text-[#1C1917] shadow-sm"
                  : "text-[#78716C] hover:text-[#1C1917]"
              }`}
            >
              Paperback Full Wrap (Print)
            </button>
            <label className="ml-3 flex items-center gap-1.5 text-[11px] font-medium text-[#78716C] cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showGuides}
                onChange={(e) => setShowGuides(e.target.checked)}
                className="accent-[#A34825]"
              />
              Trim guides
            </label>
          </div>

          {format === "paperback" && (
            <div className="-mt-3 mb-3 text-center space-y-1.5">
              <p className="text-[11px] text-[#78716C]">
                Spine ≈ {spineWidthInches(config.pageCount || 100).toFixed(3)}″ ·{" "}
                {config.pageCount || 100} pages · KDP cream paper · 6×9 trim + 0.125″ bleed
              </p>
              {(config.pageCount || 0) < 100 && (
                <p className="text-[11px] font-medium text-[#92400E] bg-[#FFFBEB] border border-[#FCD34D] rounded-lg px-3 py-1.5 inline-block">
                  KDP doesn&apos;t allow spine text under 100 pages
                  {(config.pageCount || 0) < 80 ? " — omitted automatically" : ""}.
                </p>
              )}
            </div>
          )}

          {/* Canvas Preview Container */}
          <div className="w-full flex justify-center items-center py-4">
            <div
              className={`transition-all duration-300 rounded-xl overflow-hidden shadow-2xl border-4 border-[#1C1917]/20 bg-white ${
                format === "paperback"
                  ? "w-full max-w-[820px] aspect-[1680/1280]"
                  : "w-full max-w-[420px] aspect-[800/1280]"
              }`}
              dangerouslySetInnerHTML={{ __html: svgOutput }}
            />
          </div>

          {/* Quick Download Buttons */}
          <div className="flex flex-wrap items-center justify-center gap-3 mt-6">
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={downloadingPdf}
              className="px-5 py-2.5 rounded-xl bg-[#A34825] text-white text-xs font-semibold shadow hover:bg-[#8C3C1F] transition-all flex items-center gap-2 disabled:opacity-60"
            >
              {downloadingPdf ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              <span>Download Print PDF (300 DPI)</span>
            </button>
            <button
              type="button"
              onClick={handleDownloadPng}
              disabled={downloadingPng}
              className="px-5 py-2.5 rounded-xl border border-[#D6CEBE] bg-white text-xs font-semibold text-[#1C1917] hover:border-[#1C1917] shadow-sm transition-all flex items-center gap-2 disabled:opacity-60"
            >
              {downloadingPng ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              <span>PNG for KDP (300 DPI)</span>
            </button>
            <button
              type="button"
              onClick={handleDownloadSvg}
              className="px-5 py-2.5 rounded-xl border border-[#D6CEBE] bg-white text-xs font-semibold text-[#1C1917] hover:border-[#1C1917] shadow-sm transition-all flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              <span>Vector SVG</span>
            </button>
          </div>
          {exportError && (
            <p className="mt-3 text-xs text-[#991B1B] bg-[#FEF2F2] border border-[#FCA5A5] rounded-lg p-2.5 text-center max-w-md">
              {exportError}
            </p>
          )}
        </div>

        {/* Right Column: Customization Controls */}
        <div className="lg:col-span-5 bg-white border border-[#E2DDD2] rounded-2xl p-5 sm:p-6 shadow-sm">
          {/* Navigation Tabs */}
          <div className="flex border-b border-[#E8E2D5] gap-2 mb-6 overflow-x-auto pb-1">
            <button
              type="button"
              onClick={() => setActiveTab("presets")}
              className={`pb-2.5 px-2 text-xs font-semibold transition-all border-b-2 whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === "presets"
                  ? "border-[#A34825] text-[#A34825]"
                  : "border-transparent text-[#78716C] hover:text-[#1C1917]"
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" /> Presets
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("content")}
              className={`pb-2.5 px-2 text-xs font-semibold transition-all border-b-2 whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === "content"
                  ? "border-[#A34825] text-[#A34825]"
                  : "border-transparent text-[#78716C] hover:text-[#1C1917]"
              }`}
            >
              <Type className="w-3.5 h-3.5" /> Text &amp; Spine
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("style")}
              className={`pb-2.5 px-2 text-xs font-semibold transition-all border-b-2 whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === "style"
                  ? "border-[#A34825] text-[#A34825]"
                  : "border-transparent text-[#78716C] hover:text-[#1C1917]"
              }`}
            >
              <Palette className="w-3.5 h-3.5" /> Colors
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("ornament")}
              className={`pb-2.5 px-2 text-xs font-semibold transition-all border-b-2 whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === "ornament"
                  ? "border-[#A34825] text-[#A34825]"
                  : "border-transparent text-[#78716C] hover:text-[#1C1917]"
              }`}
            >
              <Layers className="w-3.5 h-3.5" /> Motifs
            </button>
          </div>

          {/* TAB 1: PRESETS */}
          {activeTab === "presets" && (
            <div className="space-y-3">
              <p className="text-xs text-[#78716C] mb-4">
                Curated book cover styles crafted for Asian &amp; Indian literary, spiritual, and
                contemporary publications.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {COVER_PRESETS.map((p) => {
                  const isSelected =
                    config.palette.primary === p.palette.primary && config.ornament === p.ornament;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => applyPreset(p)}
                      className={`text-left p-3.5 rounded-xl border transition-all relative overflow-hidden flex flex-col justify-between ${
                        isSelected
                          ? "border-[#1C1917] bg-[#FDFBF7] ring-2 ring-[#1C1917]/20"
                          : "border-[#E8E2D5] hover:border-[#1C1917] bg-white"
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span
                          className="w-4 h-4 rounded-full border border-black/10 shrink-0"
                          style={{ backgroundColor: p.palette.primary }}
                        />
                        <span
                          className="w-4 h-4 rounded-full border border-black/10 shrink-0"
                          style={{ backgroundColor: p.palette.accent }}
                        />
                        <span className="font-serif font-bold text-xs text-[#1C1917] truncate">
                          {p.name}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#78716C] leading-snug line-clamp-2">
                        {p.description}
                      </p>
                      {isSelected && (
                        <span className="absolute top-2 right-2 text-emerald-600 bg-emerald-50 rounded-full p-0.5">
                          <Check className="w-3.5 h-3.5" />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 2: TEXT & CONTENT */}
          {activeTab === "content" && (
            <div className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold mb-1 text-[#57534E]">Book Title</label>
                <input
                  type="text"
                  value={config.title}
                  onChange={(e) => setConfig({ ...config, title: e.target.value })}
                  className="w-full p-2.5 rounded-lg border border-[#D6CEBE] focus:outline-none focus:border-[#1C1917]"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1 text-[#57534E]">Subtitle / Tagline</label>
                <input
                  type="text"
                  value={config.subtitle || ""}
                  placeholder="e.g. A Novel of Courage"
                  onChange={(e) => setConfig({ ...config, subtitle: e.target.value })}
                  className="w-full p-2.5 rounded-lg border border-[#D6CEBE] focus:outline-none focus:border-[#1C1917]"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1 text-[#57534E]">Author Name</label>
                <input
                  type="text"
                  value={config.author}
                  onChange={(e) => setConfig({ ...config, author: e.target.value })}
                  className="w-full p-2.5 rounded-lg border border-[#D6CEBE] focus:outline-none focus:border-[#1C1917]"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1 text-[#57534E]">Top Eyebrow / Endorsement</label>
                <input
                  type="text"
                  value={config.tagline || ""}
                  placeholder="e.g. National Bestseller"
                  onChange={(e) => setConfig({ ...config, tagline: e.target.value })}
                  className="w-full p-2.5 rounded-lg border border-[#D6CEBE] focus:outline-none focus:border-[#1C1917]"
                />
              </div>

              {format === "paperback" && (
                <>
                  <div className="pt-2 border-t border-[#E8E2D5]">
                    <label className="block font-semibold mb-1 text-[#57534E]">
                      Spine Title / Text
                    </label>
                    <input
                      type="text"
                      value={config.spineText || ""}
                      placeholder="Title on spine"
                      onChange={(e) => setConfig({ ...config, spineText: e.target.value })}
                      className="w-full p-2.5 rounded-lg border border-[#D6CEBE] focus:outline-none focus:border-[#1C1917]"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold mb-1 text-[#57534E]">Back Cover Blurb</label>
                    <textarea
                      rows={4}
                      value={config.backBlurb || ""}
                      onChange={(e) => setConfig({ ...config, backBlurb: e.target.value })}
                      className="w-full p-2.5 rounded-lg border border-[#D6CEBE] focus:outline-none focus:border-[#1C1917]"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold mb-1 text-[#57534E]">
                      About the Author
                    </label>
                    <textarea
                      rows={2}
                      value={config.aboutAuthor || ""}
                      onChange={(e) => setConfig({ ...config, aboutAuthor: e.target.value })}
                      className="w-full p-2.5 rounded-lg border border-[#D6CEBE] focus:outline-none focus:border-[#1C1917]"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold mb-1 text-[#57534E]">ISBN Number</label>
                    <input
                      type="text"
                      value={config.isbn || ""}
                      placeholder="978-93-0000-00-0"
                      onChange={(e) => setConfig({ ...config, isbn: e.target.value })}
                      className="w-full p-2.5 rounded-lg border border-[#D6CEBE] focus:outline-none focus:border-[#1C1917]"
                    />
                    <p className="mt-1.5 text-[11px] text-[#78716C] leading-snug">
                      No ISBN yet? Indian authors get one free at{" "}
                      <a
                        href="https://isbn.gov.in"
                        target="_blank"
                        rel="noreferrer"
                        className="text-[#A34825] underline"
                      >
                        isbn.gov.in
                      </a>
                      . KDP also assigns a free ISBN if you skip this.
                    </p>
                  </div>

                  <div>
                    <label className="block font-semibold mb-1 text-[#57534E]">
                      Page Count <span className="font-normal text-[#A8A29E]">(sets spine width)</span>
                    </label>
                    <input
                      type="number"
                      min={24}
                      max={828}
                      value={config.pageCount || ""}
                      onChange={(e) =>
                        setConfig({ ...config, pageCount: parseInt(e.target.value, 10) || 0 })
                      }
                      className="w-full p-2.5 rounded-lg border border-[#D6CEBE] focus:outline-none focus:border-[#1C1917]"
                    />
                  </div>
                </>
              )}
            </div>
          )}

          {/* TAB 3: COLORS & PALETTE */}
          {activeTab === "style" && (
            <div className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold mb-1 text-[#57534E]">Primary Background</label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={config.palette.primary}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        palette: { ...config.palette, primary: e.target.value },
                      })
                    }
                    className="w-10 h-10 rounded border border-[#D6CEBE] cursor-pointer"
                  />
                  <input
                    type="text"
                    value={config.palette.primary}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        palette: { ...config.palette, primary: e.target.value },
                      })
                    }
                    className="flex-1 p-2 rounded-lg border border-[#D6CEBE] font-mono text-xs uppercase"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold mb-1 text-[#57534E]">Secondary Gradient Base</label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={config.palette.secondary}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        palette: { ...config.palette, secondary: e.target.value },
                      })
                    }
                    className="w-10 h-10 rounded border border-[#D6CEBE] cursor-pointer"
                  />
                  <input
                    type="text"
                    value={config.palette.secondary}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        palette: { ...config.palette, secondary: e.target.value },
                      })
                    }
                    className="flex-1 p-2 rounded-lg border border-[#D6CEBE] font-mono text-xs uppercase"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold mb-1 text-[#57534E]">Accent (Gold / Silver)</label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={config.palette.accent}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        palette: { ...config.palette, accent: e.target.value },
                      })
                    }
                    className="w-10 h-10 rounded border border-[#D6CEBE] cursor-pointer"
                  />
                  <input
                    type="text"
                    value={config.palette.accent}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        palette: { ...config.palette, accent: e.target.value },
                      })
                    }
                    className="flex-1 p-2 rounded-lg border border-[#D6CEBE] font-mono text-xs uppercase"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold mb-1 text-[#57534E]">Title &amp; Main Text Color</label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={config.palette.textColor}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        palette: { ...config.palette, textColor: e.target.value },
                      })
                    }
                    className="w-10 h-10 rounded border border-[#D6CEBE] cursor-pointer"
                  />
                  <input
                    type="text"
                    value={config.palette.textColor}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        palette: { ...config.palette, textColor: e.target.value },
                      })
                    }
                    className="flex-1 p-2 rounded-lg border border-[#D6CEBE] font-mono text-xs uppercase"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: MOTIFS & ORNAMENTS */}
          {activeTab === "ornament" && (
            <div className="space-y-4 text-xs">
              <p className="text-xs text-[#78716C] mb-3">
                Select a cultural ornament or sacred motif for the central medallion.
              </p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { key: "mandala", label: "Sacred Mandala" },
                  { key: "lotus", label: "Indian Lotus" },
                  { key: "arch", label: "Heritage Arch" },
                  { key: "flourish", label: "Classic Flourish" },
                  { key: "geometric", label: "Modern Geometric" },
                  { key: "none", label: "No Motif (Clean)" },
                ].map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() =>
                      setConfig({ ...config, ornament: item.key as CoverOrnament })
                    }
                    className={`p-3 rounded-xl border text-center transition-all ${
                      config.ornament === item.key
                        ? "border-[#1C1917] bg-[#FDFBF7] font-semibold text-[#1C1917] shadow-sm"
                        : "border-[#E8E2D5] text-[#78716C] hover:border-[#1C1917] hover:text-[#1C1917]"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              <div className="pt-4 border-t border-[#E8E2D5]">
                <label className="block font-semibold mb-2 text-[#57534E]">Layout Style</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { key: "centered", label: "Classic Centered" },
                    { key: "editorial", label: "Editorial Left" },
                    { key: "heritage", label: "Heritage Frame" },
                    { key: "minimal", label: "Minimal Clean" },
                  ].map((l) => (
                    <button
                      key={l.key}
                      type="button"
                      onClick={() =>
                        setConfig({ ...config, layoutStyle: l.key as CoverLayout })
                      }
                      className={`p-2.5 rounded-lg border text-center transition-all ${
                        config.layoutStyle === l.key
                          ? "border-[#1C1917] bg-[#F8F5EE] font-semibold text-[#1C1917]"
                          : "border-[#E8E2D5] text-[#78716C] hover:border-[#1C1917]"
                      }`}
                    >
                      {l.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t border-[#E8E2D5]">
                <label className="block font-semibold mb-2 text-[#57534E]">Typography Style</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { key: "cinzel", label: "Cinzel Classical" },
                    { key: "noto-serif", label: "Noto Indic Serif" },
                    { key: "garamond", label: "EB Garamond" },
                    { key: "poppins", label: "Modern Poppins" },
                  ].map((font) => (
                    <button
                      key={font.key}
                      type="button"
                      onClick={() =>
                        setConfig({
                          ...config,
                          typography: {
                            ...config.typography,
                            fontFamily: font.key as CoverFont,
                          },
                        })
                      }
                      className={`p-2.5 rounded-lg border text-center transition-all ${
                        config.typography.fontFamily === font.key
                          ? "border-[#1C1917] bg-[#F8F5EE] font-semibold text-[#1C1917]"
                          : "border-[#E8E2D5] text-[#78716C] hover:border-[#1C1917]"
                      }`}
                    >
                      {font.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function CoverStudioPage() {
  return (
    <Suspense fallback={<div className="py-20 text-center text-xs text-[#78716C]">Loading Cover Studio...</div>}>
      <CoverStudioContent />
    </Suspense>
  );
}
