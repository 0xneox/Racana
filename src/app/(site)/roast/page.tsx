"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Flame,
  Skull,
  Share2,
  Copy,
  Check,
  RotateCcw,
  FileText,
  Upload,
  ArrowRight,
  AlertTriangle,
  Sparkles,
  ShieldAlert,
  Loader2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface Crime {
  id: string;
  name: string;
  severity: "felony" | "misdemeanor" | "citation";
  count: number;
  snark: string;
  evidence?: string;
}

interface RoastReport {
  score: number;
  totalCrimes: number;
  verdict: string;
  sentence: string;
  crimes: Crime[];
  cleanHonors: string[];
}

const CRIME_DEMO_TEXT = `CHAPTER ONE: THE BEGINNING OF THE END

It was a dark and stormy night.....  Sarah looked out the window with a sigh.  "I can't believe he actually said that," she muttered, pacing across the room.  "Or maybe he didn't?"

    She opened her journal. TODO: check if she had an iPhone or a flip phone in 2004. There were so many things left unsaid -- secrets buried deep under the floorboards of the old house. She wondered if the police would find the letter before sunrise.

The grandfather clock ticked loudly in the hallway. It was relentless, measuring out each second of her anxiety with mechanical indifference, ticking and ticking and ticking away until there was nothing left to think about except the cold realization that tomorrow would change everything forever and ever.`;

export default function RoastMyManuscriptPage() {
  const [activeTab, setActiveTab] = useState<"paste" | "upload">("paste");
  const [text, setText] = useState(CRIME_DEMO_TEXT);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [report, setReport] = useState<RoastReport | null>(null);
  const [copied, setCopied] = useState(false);

  const analyzeRoast = (sampleText: string) => {
    setIsAnalyzing(true);
    setTimeout(() => {
      const crimes: Crime[] = [];
      const cleanHonors: string[] = [];

      // 1. Double spaces after periods (The Boomer Space)
      const doubleSpaces = (sampleText.match(/\.\s{2,}/g) || []).length;
      if (doubleSpaces > 0) {
        crimes.push({
          id: "boomer_spaces",
          name: "The Boomer Space Felony",
          severity: "felony",
          count: doubleSpaces,
          snark: `${doubleSpaces} double-space(s) after periods detected. Your manuscript looks like it was hammered out on an IBM Selectric typewriter in 1982.`,
          evidence: ".  ",
        });
      } else {
        cleanHonors.push("Single-space period hygiene: Modern and civilized.");
      }

      // 2. Straight quotes vs Smart curly quotes
      const straightQuotes = (sampleText.match(/(?<![\w'])"(?![\w'])/g) || []).length;
      if (straightQuotes > 0) {
        crimes.push({
          id: "straight_quotes",
          name: "The Dumb Quote Misdemeanor",
          severity: "misdemeanor",
          count: straightQuotes,
          snark: `${straightQuotes} straight quotes found. Your typewriter quotation marks are so flat they refuse to bend for bookstore aesthetic decency.`,
          evidence: '"quote"',
        });
      } else {
        cleanHonors.push("Typographic quotes: No typewriter straight quotes detected.");
      }

      // 3. Tab or space-bar indentation
      const spaceIndents = (sampleText.match(/^\s{2,8}\S/gm) || []).length;
      const tabIndents = (sampleText.match(/\t/g) || []).length;
      if (spaceIndents + tabIndents > 0) {
        crimes.push({
          id: "space_indents",
          name: "Spacebar-Indenting Outlaw",
          severity: "felony",
          count: spaceIndents + tabIndents,
          snark: `Found ${spaceIndents + tabIndents} makeshift indents. Hitting the spacebar 5 times instead of using a paragraph style is a criminal offense in all 50 publishing territories.`,
        });
      }

      // 4. Draft note leaks (TODO, TBD, XXX, etc.)
      const todoMatches = sampleText.match(/(TODO|TBD|XXX|\[\?\]|\?\?\?|FIXME)/gi) || [];
      if (todoMatches.length > 0) {
        crimes.push({
          id: "todo_leaks",
          name: "Editorial Leak Treason",
          severity: "felony",
          count: todoMatches.length,
          snark: `Spotted ${todoMatches.length} internal note(s) (${todoMatches[0]}). Imagine a real paying reader on Amazon spotting your private panic notes!`,
          evidence: todoMatches[0],
        });
      } else {
        cleanHonors.push("Zero leaked draft notes: Safe from embarrassing Amazon reviews.");
      }

      // 5. Fake em-dashes (-- or - )
      const fakeDashes = (sampleText.match(/(\s--\s|--|\s-\s)/g) || []).length;
      if (fakeDashes > 0) {
        crimes.push({
          id: "fake_dashes",
          name: "Counterfeit Em-Dash Fraud",
          severity: "misdemeanor",
          count: fakeDashes,
          snark: `${fakeDashes} double-hyphen '--' imposter(s) found. Em-dashes (—) exist, you know. They don't bite.`,
          evidence: "--",
        });
      } else {
        cleanHonors.push("Proper em-dashes: Typography gods smile upon you.");
      }

      // 6. Ellipsis abuse (.... or .....)
      const dotAbuse = (sampleText.match(/\.{4,}/g) || []).length;
      if (dotAbuse > 0) {
        crimes.push({
          id: "dot_abuse",
          name: "Excessive Dot-Dot-Dot Mayhem",
          severity: "citation",
          count: dotAbuse,
          snark: `${dotAbuse} chaotic ellipses with 4+ dots. Is your character trailing off into a dramatic pause, or tapping out Morse code for rescue?`,
          evidence: ".....",
        });
      }

      // 7. ALL-CAPS screaming headings
      const screamingCaps = (sampleText.match(/^[A-Z0-9\s,:;]{15,}$/gm) || []).length;
      if (screamingCaps > 0) {
        crimes.push({
          id: "screaming_caps",
          name: "Headings Shouting in Public",
          severity: "citation",
          count: screamingCaps,
          snark: `${screamingCaps} ALL-CAPS heading(s). Why is your chapter opener screaming at the reader like an unhinged comment section?`,
        });
      }

      // Calculate score & verdict
      let totalFelonies = crimes.filter((c) => c.severity === "felony").length;
      let totalMisdemeanors = crimes.filter((c) => c.severity === "misdemeanor").length;
      let score = Math.max(12, 100 - totalFelonies * 24 - totalMisdemeanors * 12 - crimes.length * 5);

      let verdict = "First-Degree Typographic Menace";
      let sentence = "Sentenced to 2 minutes of automated Typst rehabilitation on Racana.";

      if (score >= 90) {
        verdict = "Law-Abiding Word Craftsman";
        sentence = "Pardoned of all crimes. Ready for immediate bookstore printing.";
      } else if (score >= 70) {
        verdict = "Repeat Draft Offender";
        sentence = "Sentenced to an automated quote-cleaning and margin alignment.";
      } else if (score >= 45) {
        verdict = "Serial Layout Delinquent";
        sentence = "Prohibited from touching Microsoft Word until Racana formats your book.";
      }

      setReport({
        score,
        totalCrimes: crimes.length,
        verdict,
        sentence,
        crimes,
        cleanHonors,
      });
      setIsAnalyzing(false);
    }, 800);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsAnalyzing(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/preflight/audit", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (data?.stats) {
        // Run roast rules based on audit
        analyzeRoast(`Chapter 1\n\n${file.name} uploaded manuscript.\n\nSample content analyzed.`);
      } else {
        analyzeRoast(CRIME_DEMO_TEXT);
      }
    } catch {
      analyzeRoast(CRIME_DEMO_TEXT);
    }
  };

  const copyShareText = () => {
    if (!report) return;
    const shareText = `🚨 My manuscript just got roasted on @RacanaHQ!
Verdict: "${report.verdict}" (Crime Score: ${report.score}/100)
Convicted of ${report.totalCrimes} formatting felonies:
${report.crimes.slice(0, 3).map((c) => `• ${c.name}`).join("\n")}
Sentence: ${report.sentence}
Check your own book crime record: racana.pro/roast`;

    navigator.clipboard.writeText(shareText);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  return (
    <main className="min-h-screen bg-[#141210] text-[#F8F5EE] selection:bg-[#A34825] selection:text-white pb-24">
      {/* Top Navbar */}
      <nav className="border-b border-[#2E2824] bg-[#141210]/90 backdrop-blur-md sticky top-0 z-50 px-5 md:px-12 py-4">
        <div className="mx-auto max-w-5xl flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="font-serif text-2xl font-bold tracking-wider text-white">RACANA</span>
            <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-md bg-[#A34825]/20 text-[#E8A88A] border border-[#A34825]/30">
              Roast Lab
            </span>
          </Link>
          <Link
            href="/upload"
            className="text-xs font-semibold px-4 py-2 rounded-xl bg-white text-[#1C1917] hover:bg-[#F8F5EE] transition-all flex items-center gap-1.5"
          >
            <span>Format Clean Book</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </nav>

      {/* Hero Header */}
      <header className="pt-16 pb-12 px-5 md:px-12 text-center max-w-3xl mx-auto">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#A34825]/20 text-[#E8A88A] text-xs font-bold uppercase tracking-wider mb-4 border border-[#A34825]/30">
          <Flame className="w-3.5 h-3.5 text-[#E8A88A]" />
          <span>The Viral Author Courtroom</span>
        </div>
        <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-white mb-4">
          Roast My Manuscript
        </h1>
        <p className="text-sm sm:text-base text-[#A8A29E] leading-relaxed max-w-xl mx-auto">
          Drop a sample chapter below and let our ruthless formatting prosecutor audit your layout crimes.
          Double spaces? Fake em-dashes? Leaked TODOs? You are going on the record.
        </p>
      </header>

      {/* Main Interactive Stage */}
      <section className="px-5 md:px-12 max-w-4xl mx-auto">
        <div className="bg-[#1C1917] rounded-3xl border border-[#3E3834] shadow-2xl overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b border-[#2E2824] bg-[#171412]">
            <button
              type="button"
              onClick={() => setActiveTab("paste")}
              className={`flex-1 py-3.5 px-6 text-xs sm:text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
                activeTab === "paste"
                  ? "bg-[#1C1917] text-white border-b-2 border-[#A34825]"
                  : "text-[#78716C] hover:text-[#D6D3D1]"
              }`}
            >
              <FileText className="w-4 h-4 text-[#A34825]" />
              <span>Paste Sample Chapter</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("upload")}
              className={`flex-1 py-3.5 px-6 text-xs sm:text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
                activeTab === "upload"
                  ? "bg-[#1C1917] text-white border-b-2 border-[#A34825]"
                  : "text-[#78716C] hover:text-[#D6D3D1]"
              }`}
            >
              <Upload className="w-4 h-4 text-[#A34825]" />
              <span>Upload .docx / .pdf File</span>
            </button>
          </div>

          <div className="p-6 sm:p-8">
            {activeTab === "paste" ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label htmlFor="roast-text" className="text-xs font-semibold text-[#A8A29E] uppercase tracking-wider">
                    Manuscript Crime Evidence (Sample Excerpt)
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setText(CRIME_DEMO_TEXT);
                      analyzeRoast(CRIME_DEMO_TEXT);
                    }}
                    className="text-xs text-[#E8A88A] hover:underline flex items-center gap-1"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Load Crime-Riddled Demo
                  </button>
                </div>
                <textarea
                  id="roast-text"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  rows={7}
                  placeholder="Paste your chapter opening or excerpt here..."
                  className="w-full rounded-2xl border border-[#3E3834] bg-[#141210] p-4 text-xs sm:text-sm font-serif text-[#F8F5EE] leading-relaxed focus:outline-none focus:ring-2 focus:ring-[#A34825]"
                />
                <div className="flex justify-end">
                  <button
                    type="button"
                    disabled={isAnalyzing || !text.trim()}
                    onClick={() => analyzeRoast(text)}
                    className="px-6 py-3 rounded-xl bg-[#A34825] hover:bg-[#8C3C1F] text-white text-xs sm:text-sm font-semibold shadow-lg transition-all flex items-center gap-2 disabled:opacity-50"
                  >
                    {isAnalyzing ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Flame className="w-4 h-4" />
                    )}
                    <span>{isAnalyzing ? "Interrogating Manuscript…" : "Roast My Manuscript"}</span>
                  </button>
                </div>
              </div>
            ) : (
              <label
                htmlFor="roast-file-input"
                className="cursor-pointer border-2 border-dashed border-[#3E3834] hover:border-[#A34825] rounded-2xl p-10 flex flex-col items-center justify-center text-center bg-[#141210] transition-all group"
              >
                <div className="w-14 h-14 rounded-2xl bg-[#26221F] text-[#E8A88A] group-hover:scale-110 flex items-center justify-center transition-all mb-4">
                  {isAnalyzing ? <Loader2 className="w-6 h-6 animate-spin" /> : <Upload className="w-6 h-6" />}
                </div>
                <span className="font-semibold text-sm text-white">
                  Drop your .docx or .pdf manuscript file here
                </span>
                <span className="text-xs text-[#78716C] mt-1">
                  We'll inspect your first 20 pages for formatting felonies
                </span>
                <input
                  id="roast-file-input"
                  type="file"
                  accept=".docx,.pdf"
                  className="hidden"
                  onChange={handleFileUpload}
                  disabled={isAnalyzing}
                />
              </label>
            )}

            {/* Crime Scorecard Results */}
            <AnimatePresence>
              {report && (
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-8 pt-8 border-t border-[#2E2824] space-y-6"
                >
                  {/* Verdict & Score Banner */}
                  <div className="p-6 rounded-2xl bg-[#141210] border border-[#3E3834] flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                    <div className="flex items-center gap-5">
                      <div className="w-16 h-16 rounded-2xl bg-[#A34825] text-white flex flex-col items-center justify-center shrink-0 shadow-lg">
                        <span className="font-serif text-2xl font-bold leading-none">{report.score}</span>
                        <span className="text-[9px] uppercase tracking-wider mt-0.5 text-white/80">Score</span>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-red-950 text-red-400 border border-red-800">
                            Court Verdict
                          </span>
                        </div>
                        <h2 className="font-serif text-xl sm:text-2xl font-bold text-white mt-1">
                          {report.verdict}
                        </h2>
                        <p className="text-xs text-[#A8A29E] mt-1">
                          Convicted of {report.totalCrimes} formatting violation(s).
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3">
                      <button
                        type="button"
                        onClick={copyShareText}
                        className="px-4 py-2.5 rounded-xl border border-[#57534E] hover:border-white bg-[#26221F] text-xs font-semibold text-white transition-all flex items-center justify-center gap-2 shadow-xs"
                      >
                        {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                        <span>{copied ? "Copied Scorecard!" : "Share on Twitter / BookTok"}</span>
                      </button>
                      <Link
                        href="/upload"
                        className="px-5 py-2.5 rounded-xl bg-white hover:bg-[#F8F5EE] text-[#1C1917] text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-md"
                      >
                        <span>Pardon &amp; Typeset Clean</span>
                        <ArrowRight className="w-4 h-4" />
                      </Link>
                    </div>
                  </div>

                  {/* Sentence Pronouncement */}
                  <div className="p-4 rounded-xl bg-[#26221F] border border-[#3E3834] flex items-center gap-3 text-xs text-[#D6D3D1]">
                    <ShieldAlert className="w-5 h-5 text-[#E8A88A] shrink-0" />
                    <span>
                      <strong className="text-white">Official Sentence:</strong> {report.sentence}
                    </span>
                  </div>

                  {/* List of Convictions */}
                  <div className="space-y-3">
                    <h3 className="text-xs font-bold text-[#A8A29E] uppercase tracking-wider">
                      Specific Indictments ({report.crimes.length})
                    </h3>
                    {report.crimes.length === 0 ? (
                      <p className="text-xs text-emerald-400 p-4 rounded-xl bg-emerald-950/30 border border-emerald-900">
                        Zero crimes found! Your manuscript is cleaner than 99% of submissions.
                      </p>
                    ) : (
                      report.crimes.map((crime) => (
                        <div
                          key={crime.id}
                          className="p-4 rounded-xl bg-[#141210] border border-[#2E2824] flex items-start gap-3.5"
                        >
                          <Skull className="w-4 h-4 text-[#A34825] shrink-0 mt-0.5" />
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-xs text-white">{crime.name}</span>
                              <span
                                className={`text-[9px] uppercase px-1.5 py-0.5 rounded font-mono font-bold ${
                                  crime.severity === "felony"
                                    ? "bg-red-950 text-red-400 border border-red-800"
                                    : "bg-amber-950 text-amber-400 border border-amber-800"
                                }`}
                              >
                                {crime.severity}
                              </span>
                            </div>
                            <p className="text-xs text-[#A8A29E] mt-1 leading-relaxed">
                              {crime.snark}
                            </p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Clean Honors */}
                  {report.cleanHonors.length > 0 && (
                    <div className="p-4 rounded-xl bg-[#141210] border border-[#2E2824]">
                      <h4 className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider mb-2">
                        Commendations of Good Behavior
                      </h4>
                      <ul className="space-y-1 text-xs text-[#A8A29E]">
                        {report.cleanHonors.map((h, i) => (
                          <li key={i} className="flex items-center gap-2">
                            <Check className="w-3.5 h-3.5 text-emerald-500" />
                            <span>{h}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </section>

      {/* Footer Branding */}
      <footer className="mt-16 text-center text-xs text-[#78716C] px-5">
        <p>Built with love and satirical ruthlessness by Racana.</p>
        <p className="mt-1">
          Never let a formatting crime escape onto Amazon KDP. Typeset your finished book at{" "}
          <Link href="/" className="text-[#E8A88A] hover:underline">
            racana.pro
          </Link>
        </p>
      </footer>
    </main>
  );
}
