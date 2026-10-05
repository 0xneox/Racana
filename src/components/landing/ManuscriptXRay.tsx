"use client";

import { useState } from "react";
import Link from "next/link";
import {
  FileSearch,
  CheckCircle2,
  AlertCircle,
  Upload,
  ArrowRight,
  Sparkles,
  Loader2,
  FileText,
  RotateCcw,
  ShieldCheck,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const DEMO_SAMPLE = `Chapter 1: The Crossing

It was a cold morning in November when Sarah packed her notebooks. She looked around the empty room, wondering if she would ever return. "Everything is set," she whispered to herself. "Or at least, I hope so."

There were three things she carried: a pen, a leather journal, and the small bronze key her father had left behind. TODO: confirm the date of the letter in father's desk.

The road ahead was quiet, winding through the hills like a forgotten ribbon. She took a deep breath and stepped into the fog.`;

export function ManuscriptXRay() {
  const [activeTab, setActiveTab] = useState<"upload" | "paste">("paste");
  const [textInput, setTextInput] = useState(DEMO_SAMPLE);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    healthScore: number;
    grade: string;
    verdict: string;
    stats: {
      title: string;
      author: string;
      chapterCount: number;
      wordCount: number;
      estimatedPages: number;
    };
    preflight: {
      items: { id: string; label: string; status: "ok" | "check"; detail?: string; location?: string }[];
      estimatedPages: number;
      belowKdpSpineMinimum: boolean;
      needsEndPad: boolean;
    };
  } | null>(null);

  const runAudit = async (customFile?: File, customText?: string) => {
    setLoading(true);
    setError(null);
    try {
      let res: Response;
      const targetFile = customFile || file;
      const targetText = customText !== undefined ? customText : textInput;

      if (activeTab === "upload" && targetFile) {
        const formData = new FormData();
        formData.append("file", targetFile);
        res = await fetch("/api/preflight/audit", {
          method: "POST",
          body: formData,
        });
      } else {
        res = await fetch("/api/preflight/audit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: targetText }),
        });
      }

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to analyze manuscript.");
      }
      setResult(data);
    } catch (err: any) {
      setError(err.message || "Could not analyze manuscript.");
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      setFile(selected);
      runAudit(selected);
    }
  };

  return (
    <section className="border-y border-[#E8E2D5] bg-[#FAF8F5] py-20 px-5 md:px-12 lg:px-16" id="xray">
      <div className="mx-auto max-w-5xl">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#A34825]/10 text-[#A34825] text-xs font-semibold uppercase tracking-wider mb-3">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Instant Pre-Upload Audit</span>
          </div>
          <h2 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-bold text-[#1C1917] tracking-tight">
            Free Manuscript Health X-Ray
          </h2>
          <p className="mt-4 text-sm sm:text-base text-[#78716C] leading-relaxed">
            Run your manuscript through Racana’s preflight analyzer before typesetting. Detect unmatched quotes, placeholder leaks (TODOs), and Amazon KDP spine tolerances in seconds.
          </p>
        </div>

        <div className="bg-white rounded-3xl border border-[#E2DDD2] shadow-xl overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b border-[#E8E2D5] bg-[#F7F4EE]">
            <button
              type="button"
              onClick={() => {
                setActiveTab("paste");
                setError(null);
              }}
              className={`flex-1 py-3.5 px-6 text-xs sm:text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
                activeTab === "paste"
                  ? "bg-white text-[#1C1917] border-b-2 border-[#A34825]"
                  : "text-[#78716C] hover:text-[#1C1917]"
              }`}
            >
              <FileText className="w-4 h-4 text-[#A34825]" />
              <span>Paste Sample Chapter</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab("upload");
                setError(null);
              }}
              className={`flex-1 py-3.5 px-6 text-xs sm:text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
                activeTab === "upload"
                  ? "bg-white text-[#1C1917] border-b-2 border-[#A34825]"
                  : "text-[#78716C] hover:text-[#1C1917]"
              }`}
            >
              <Upload className="w-4 h-4 text-[#A34825]" />
              <span>Upload Full File (.docx / .pdf)</span>
            </button>
          </div>

          <div className="p-6 sm:p-8">
            {activeTab === "paste" ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label htmlFor="sample-text" className="text-xs font-semibold text-[#1C1917] uppercase tracking-wider">
                    Chapter Text / Manuscript Sample
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setTextInput(DEMO_SAMPLE);
                      runAudit(undefined, DEMO_SAMPLE);
                    }}
                    className="text-xs font-medium text-[#A34825] hover:underline flex items-center gap-1"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Load Demo Sample
                  </button>
                </div>
                <textarea
                  id="sample-text"
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  rows={6}
                  placeholder="Paste a chapter opening or manuscript excerpt here..."
                  className="w-full rounded-2xl border border-[#D6CEBE] bg-[#FDFBF7] p-4 text-xs sm:text-sm font-serif text-[#1C1917] leading-relaxed focus:outline-none focus:ring-2 focus:ring-[#A34825]"
                />
                <div className="flex justify-end">
                  <button
                    type="button"
                    disabled={loading || !textInput.trim()}
                    onClick={() => runAudit()}
                    className="px-6 py-3 rounded-xl bg-[#1C1917] hover:bg-[#2E2824] text-white text-xs sm:text-sm font-medium shadow-md transition-all flex items-center gap-2 disabled:opacity-50"
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSearch className="w-4 h-4" />}
                    <span>{loading ? "Analyzing Manuscript…" : "Run Instant X-Ray"}</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <label
                  htmlFor="xray-file-input"
                  className="cursor-pointer border-2 border-dashed border-[#D6CEBE] hover:border-[#A34825] rounded-2xl p-8 sm:p-12 flex flex-col items-center justify-center text-center bg-[#FDFBF7] transition-all group"
                >
                  <div className="w-14 h-14 rounded-2xl bg-[#F4EFEA] text-[#A34825] group-hover:scale-110 flex items-center justify-center transition-all mb-4">
                    {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Upload className="w-6 h-6" />}
                  </div>
                  <span className="font-semibold text-sm sm:text-base text-[#1C1917]">
                    {file ? file.name : "Drop your .docx or .pdf file here"}
                  </span>
                  <span className="text-xs text-[#78716C] mt-1">
                    Instant structural health audit · Free & private · Up to 50MB
                  </span>
                  <input
                    id="xray-file-input"
                    type="file"
                    accept=".docx,.pdf"
                    className="hidden"
                    onChange={handleFileChange}
                    disabled={loading}
                  />
                </label>
              </div>
            )}

            {error && (
              <p className="mt-4 text-xs text-[#991B1B] bg-[#FEF2F2] p-3 rounded-xl border border-[#FCA5A5]">
                {error}
              </p>
            )}

            {/* Results Panel */}
            <AnimatePresence>
              {result && (
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-8 pt-8 border-t border-[#E8E2D5] space-y-6"
                >
                  {/* Score & Verdict Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-[#FDFBF7] border border-[#E8E2D5]">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 rounded-2xl bg-[#1C1917] text-[#FAF8F5] flex flex-col items-center justify-center shrink-0">
                        <span className="font-serif text-xl font-bold leading-none">{result.grade}</span>
                        <span className="text-[10px] text-[#A8A29E] mt-0.5">{result.healthScore}/100</span>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm sm:text-base text-[#1C1917]">
                            {result.verdict}
                          </span>
                          <span className="px-2 py-0.5 rounded-full bg-[#F0FDF4] text-[#166534] border border-[#BBF7D0] text-[10px] font-semibold">
                            Audited
                          </span>
                        </div>
                        <p className="text-xs text-[#78716C] mt-0.5">
                          {result.stats.title} · ~{result.stats.wordCount.toLocaleString()} words · {result.stats.estimatedPages} estimated print pages
                        </p>
                      </div>
                    </div>

                    <Link
                      href="/upload"
                      className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#A34825] hover:bg-[#8C3C1F] text-white text-xs sm:text-sm font-medium shadow-md transition-all shrink-0"
                    >
                      <span>Typeset This Book Now</span>
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                  </div>

                  {/* Checklist Breakdown */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {result.preflight.items.map((item) => (
                      <div
                        key={item.id}
                        className={`p-4 rounded-xl border transition-all flex items-start gap-3 ${
                          item.status === "ok"
                            ? "bg-[#F0FDF4]/50 border-[#DCFCE7]"
                            : "bg-[#FFFBEB] border-[#FDE68A]"
                        }`}
                      >
                        {item.status === "ok" ? (
                          <CheckCircle2 className="w-4 h-4 text-[#166534] shrink-0 mt-0.5" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-[#B45309] shrink-0 mt-0.5" />
                        )}
                        <div>
                          <span
                            className={`font-semibold text-xs block ${
                              item.status === "ok" ? "text-[#166534]" : "text-[#92400E]"
                            }`}
                          >
                            {item.label}
                          </span>
                          {item.detail && (
                            <span className="text-[11px] text-[#78716C] block mt-0.5 leading-relaxed">
                              {item.detail}
                            </span>
                          )}
                          {item.location && (
                            <span className="text-[10px] font-mono text-[#A8A29E] block mt-0.5">
                              Found at: {item.location}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Trust footer */}
                  <div className="flex items-center justify-between text-xs text-[#78716C] pt-2">
                    <span className="flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-[#166534]" />
                      Zero text modification. Your manuscript remains untouched.
                    </span>
                    <span className="hidden sm:inline">Engine: Typst & preflight.ts v1.2</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  );
}
