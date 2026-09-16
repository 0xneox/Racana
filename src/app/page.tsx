import Link from "next/link";
import { ArrowRight, CheckCircle2, Sparkles, FileText, Check, ShieldCheck } from "lucide-react";

export default function HomePage() {
  return (
    <div className="bg-[#FDFBF7]">
      {/* Hero Section */}
      <section className="pt-16 pb-20 md:pt-24 md:pb-28 px-4 sm:px-6 max-w-5xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#F4EFEA] border border-[#E2DDD2] text-xs font-medium text-[#78716C] mb-8">
          <Sparkles className="w-3.5 h-3.5 text-[#A34825]" />
          <span>Zero-technical interior typesetting for authors</span>
        </div>

        <h1 className="font-serif text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight text-[#1C1917] max-w-3xl mx-auto leading-[1.15] mb-6">
          Your manuscript in. <br />
          <span className="italic font-serif text-[#A34825]">Your finished book out.</span>
        </h1>

        <p className="font-sans text-lg sm:text-xl text-[#57534E] max-w-2xl mx-auto mb-10 leading-relaxed font-normal">
          Upload. Choose a style. Get a print-ready book.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
          <Link
            href="/upload"
            className="w-full sm:w-auto px-8 py-4 rounded-xl bg-[#1C1917] text-[#F8F5EE] font-medium text-base shadow-md hover:bg-[#2E2824] hover:shadow-lg transition-all flex items-center justify-center gap-2 group"
          >
            <span>Upload your manuscript</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
          <a
            href="#pricing"
            className="w-full sm:w-auto px-6 py-4 rounded-xl border border-[#D6CEBE] bg-[#F8F5EE] text-[#44403C] font-medium text-base hover:border-[#1C1917] hover:text-[#1C1917] transition-all"
          >
            See Pricing ($29 / book)
          </a>
        </div>

        {/* The Core Promise Callout */}
        <div className="bg-[#F8F5EE] border border-[#E8E2D5] rounded-2xl p-6 sm:p-8 max-w-3xl mx-auto text-left shadow-sm">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-[#A34825]/10 text-[#A34825] flex items-center justify-center shrink-0 mt-1">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-serif text-lg font-bold text-[#1C1917] mb-1">
                The Zero-Technical Promise
              </h3>
              <p className="text-sm text-[#57534E] leading-relaxed mb-4">
                You never need to calculate margins, gutter compensation, trim sizes, typography leading, widow/orphan rules, bleed dimensions, or PDF/X conformance. We handle every millimeter so you can publish with confidence.
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-[#78716C]">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#A34825]" /> No margin math
                </span>
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#A34825]" /> Auto recto openings
                </span>
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#A34825]" /> Balanced folios
                </span>
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#A34825]" /> Guaranteed print specs
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Visual Comparison: Manuscript In -> Book Out */}
      <section className="py-16 bg-[#F4EFEA] border-y border-[#E8E2D5]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="font-serif text-2xl sm:text-3xl font-bold text-[#1C1917] mb-3">
              Bookstore Quality in Under Two Minutes
            </h2>
            <p className="text-sm text-[#57534E]">
              From messy Word documents to crisp, master-typeset book interiors ready for Amazon KDP, IngramSpark, or traditional offset printing.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
            {/* Before: Raw Manuscript */}
            <div className="bg-white rounded-xl border border-[#E2DDD2] p-6 shadow-sm">
              <div className="flex items-center justify-between pb-4 border-b border-[#F4EFEA] mb-4">
                <span className="text-xs font-mono text-[#A8A29E] flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5" /> draft_manuscript_final_v2.docx
                </span>
                <span className="text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded bg-[#F4EFEA] text-[#78716C]">
                  Raw Input
                </span>
              </div>
              <div className="space-y-2.5 opacity-60 text-xs font-mono text-[#44403C] select-none pointer-events-none">
                <div className="font-bold text-sm">Chapter 1. The Beginning</div>
                <p>
                  It was a dark and stormy night when the manuscript was first opened. There were default margins of 1 inch everywhere, no gutter compensation for binding, loose leading, and erratic line spacing...
                </p>
                <div className="h-2 w-full bg-[#E5DFD3] rounded" />
                <div className="h-2 w-5/6 bg-[#E5DFD3] rounded" />
                <div className="h-2 w-4/6 bg-[#E5DFD3] rounded" />
              </div>
              <div className="mt-6 pt-4 border-t border-[#F4EFEA] text-[11px] text-[#A8A29E] italic">
                ✗ Flat margins ✗ Unbound gutter ✗ Generic font
              </div>
            </div>

            {/* After: Typeset Book Interior */}
            <div className="bg-[#FDFBF7] rounded-xl border-2 border-[#1C1917] p-6 shadow-md relative overflow-hidden">
              <div className="absolute -right-12 -top-12 w-28 h-28 bg-[#A34825]/10 rounded-full blur-xl pointer-events-none" />
              <div className="flex items-center justify-between pb-4 border-b border-[#E8E2D5] mb-4">
                <span className="text-xs font-serif font-semibold text-[#1C1917]">
                  Typeset Interior • 6″ × 9″ Standard
                </span>
                <span className="text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded bg-[#1C1917] text-white">
                  Print Ready
                </span>
              </div>
              <div className="space-y-3 text-xs text-[#292524] select-none font-serif">
                <div className="text-center font-serif text-sm tracking-widest uppercase text-[#57534E] mb-2">
                  CHAPTER I
                </div>
                <div className="text-justify leading-relaxed">
                  <span className="float-left text-3xl font-serif leading-none pr-1.5 pt-0.5 text-[#1C1917]">
                    I
                  </span>
                  t is a truth universally acknowledged that a manuscript properly typeset invites contemplative reading. Symmetrical folios, generous outer margins, and an exact 0.875″ inside gutter allow your physical book to open flat without hiding text in the binding spine.
                </div>
              </div>
              <div className="mt-6 pt-4 border-t border-[#E8E2D5] text-[11px] text-[#A34825] font-medium flex items-center justify-between">
                <span>✓ Perfect spine gutter</span>
                <span>✓ Recto opening</span>
                <span>✓ PDF/X verified</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 px-4 sm:px-6 max-w-5xl mx-auto">
        <div className="text-center max-w-xl mx-auto mb-16">
          <h2 className="font-serif text-3xl sm:text-4xl font-bold text-[#1C1917] mb-3">
            Simple, Honest Pricing
          </h2>
          <p className="text-sm text-[#57534E]">
            No forced subscriptions. No hidden typesetting fees. Pay only when you have a finished book ready to print.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">
          {/* Free Tier */}
          <div className="rounded-2xl border border-[#E2DDD2] bg-white p-7 flex flex-col justify-between">
            <div>
              <h3 className="font-serif font-bold text-lg text-[#1C1917] mb-1">Free Preview</h3>
              <p className="text-xs text-[#78716C] mb-4">Sample your book before committing</p>
              <div className="text-3xl font-bold text-[#1C1917] font-serif mb-6">$0</div>
              <ul className="space-y-3 text-xs text-[#57534E] mb-8">
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-[#A34825]" /> Upload any DOCX or PDF
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-[#A34825]" /> Preview all 5 book styles
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-[#A34825]" /> Automated QA report
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-[#A34825]" /> Sample chapter PDF export
                </li>
              </ul>
            </div>
            <Link
              href="/upload"
              className="w-full py-2.5 rounded-lg border border-[#D6CEBE] text-center text-xs font-semibold text-[#1C1917] hover:bg-[#F8F5EE] transition-colors"
            >
              Start Free Preview
            </Link>
          </div>

          {/* Pay-per-book Tier (Highlighted) */}
          <div className="rounded-2xl border-2 border-[#1C1917] bg-[#FDFBF7] p-7 flex flex-col justify-between relative shadow-lg">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#1C1917] text-white px-3 py-1 rounded-full text-[10px] font-bold tracking-wide uppercase">
              Most Popular
            </div>
            <div>
              <h3 className="font-serif font-bold text-lg text-[#1C1917] mb-1">Pay-Per-Book</h3>
              <p className="text-xs text-[#78716C] mb-4">One-time payment. Complete print-ready interior.</p>
              <div className="text-3xl font-bold text-[#1C1917] font-serif mb-6">
                $29 <span className="text-xs font-sans text-[#78716C] font-normal">/ book</span>
              </div>
              <ul className="space-y-3 text-xs text-[#57534E] mb-8">
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-[#A34825]" /> Full interior PDF (up to 300 pages)
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-[#A34825]" /> PDF/X compliant for Amazon KDP & Ingram
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-[#A34825]" /> All 4 trim sizes included
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-[#A34825]" /> Unlimited re-downloads & typo fixes
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-[#A34825]" /> Direct email delivery of files
                </li>
              </ul>
            </div>
            <Link
              href="/upload"
              className="w-full py-2.5 rounded-lg bg-[#1C1917] text-center text-xs font-semibold text-[#F8F5EE] hover:bg-[#2E2824] transition-colors shadow-sm"
            >
              Upload & Typeset Now
            </Link>
          </div>

          {/* Pro Tier (Coming Soon) */}
          <div className="rounded-2xl border border-[#E2DDD2] bg-white p-7 flex flex-col justify-between opacity-80">
            <div>
              <div className="flex items-center justify-between mb-1">
                <h3 className="font-serif font-bold text-lg text-[#1C1917]">Pro Studio</h3>
                <span className="text-[10px] font-semibold bg-[#F4EFEA] text-[#78716C] px-2 py-0.5 rounded">
                  Coming Later
                </span>
              </div>
              <p className="text-xs text-[#78716C] mb-4">For publishers & prolific authors</p>
              <div className="text-3xl font-bold text-[#78716C] font-serif mb-6">
                $79 <span className="text-xs font-sans text-[#A8A29E] font-normal">/ month</span>
              </div>
              <ul className="space-y-3 text-xs text-[#78716C] mb-8">
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-[#A8A29E]" /> Unlimited books per month
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-[#A8A29E]" /> Custom publisher colophon branding
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-[#A8A29E]" /> Batch upload queue
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-[#A8A29E]" /> Priority typesetting rendering
                </li>
              </ul>
            </div>
            <button
              disabled
              className="w-full py-2.5 rounded-lg border border-[#E2DDD2] text-center text-xs font-semibold text-[#A8A29E] cursor-not-allowed bg-[#F8F5EE]"
            >
              Join Pro Waitlist
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
