import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check, ChevronDown } from "lucide-react";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "KDP Book Formatting — Racana",
  description:
    "Amazon KDP interior requirements explained — trim sizes, gutter margins, embedded fonts — and how Racana formats your manuscript into a KDP-ready paperback interior.",
  alternates: { canonical: "/kdp-formatting" },
  openGraph: {
    title: "KDP Book Formatting — Racana",
    description:
      "Upload your DOCX or PDF and get a typeset interior PDF built around Amazon KDP's paperback requirements.",
    type: "article",
    url: "/kdp-formatting",
  },
};

// --- Content ---------------------------------------------------------------

const kdpRequirements = [
  {
    req: "Correct trim-size page dimensions",
    how: "Every Racana interior is built at exactly the trim size you choose — no scaling, no surprises.",
  },
  {
    req: "Inside (gutter) margins that clear the binding",
    how: "Margins are calculated for physical binding so text never disappears into the spine.",
  },
  {
    req: "Fonts fully embedded in the PDF",
    how: "All type is embedded in the finished file, so KDP prints the typography you approved.",
  },
  {
    req: "A single PDF for the whole interior",
    how: "You receive one complete interior PDF — front to back — ready to upload to KDP.",
  },
  {
    req: "Clean pages without stray elements",
    how: "Automated quality checks look for layout problems before you ever see the file.",
  },
];

const trimSizes = [
  ["5 × 8″", "Fiction & memoir"],
  ["5.5 × 8.5″", "Trade paperback"],
  ["6 × 9″", "The KDP standard"],
  ["8.5 × 11″", "Workbooks & large format"],
];

const steps = [
  ["01", "Upload", "Your DOCX or PDF manuscript. DOCX is preferred — it carries real heading structure."],
  ["02", "Choose", "Pick a trim size and one of two book styles for your paperback."],
  ["03", "Upload to KDP", "Download the interior PDF, check it in KDP Print Previewer, and publish."],
];

const faqs: [string, string][] = [
  [
    "Which KDP trim sizes does Racana support?",
    "5 × 8″, 5.5 × 8.5″, 6 × 9″, and 8.5 × 11″ — all standard KDP paperback trim sizes. 6 × 9″ is the most common choice for novels and nonfiction.",
  ],
  [
    "Does the Racana PDF pass KDP's automated checks?",
    "Racana builds the interior around KDP's stated requirements — exact page dimensions, binding-aware gutters, embedded fonts, single-PDF output. If KDP ever rejects a Racana interior for a formatting reason, forward the rejection to books@racana.pro within 30 days for a full refund.",
  ],
  [
    "Do I still need to check the file in KDP Print Previewer?",
    "Yes — always. KDP's own previewer is the final authority on what will print, and every author should review their book there before publishing. Racana gives you a free preview first so you can iterate before paying.",
  ],
  [
    "Does Racana make my KDP cover?",
    "Yes — Cover Studio is included with every paid book. It builds your print-ready paperback wrap with the spine width calculated from your real page count, plus a Kindle eBook cover, directly from the finished interior.",
  ],
  [
    "Can I fix a typo and regenerate?",
    "Yes. Re-upload your corrected manuscript within 30 days of purchase and re-generate the interior, cover and EPUB — you don't pay again for revisions to the same book.",
  ],
];

// --- Small components --------------------------------------------------------

function SectionLabel({ num, label }: { num: string; label: string }) {
  return (
    <p className="text-[10px] font-extrabold uppercase tracking-[0.36em] text-primary">
      <span className="text-primary/50">{num}</span> &nbsp;{label}
    </p>
  );
}

function PrimaryCta({ children }: { children: ReactNode }) {
  return (
    <Link
      href="/upload"
      className="group inline-flex min-h-12 items-center justify-center gap-3 rounded-sm bg-primary px-6 text-sm font-semibold text-primary-foreground transition-all hover:-translate-y-0.5 hover:shadow-lift focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
    >
      {children}
      <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
    </Link>
  );
}

// --- Page --------------------------------------------------------------------

export default function KdpFormattingPage() {
  return (
    <div className="page-grain">
      {/* Hero */}
      <section className="border-b border-border px-5 py-20 md:px-10 md:py-28 lg:px-16">
        <div className="mx-auto max-w-[1312px]">
          <SectionLabel num="00" label="KDP book formatting" />
          <h1 className="mt-5 max-w-3xl font-serif text-[clamp(2.6rem,5vw,4.6rem)] font-medium leading-[1.02]">
            Paperback formatting for KDP,{" "}
            <span className="italic text-primary">without the spreadsheet.</span>
          </h1>
          <p className="mt-7 max-w-xl border-l border-foreground pl-6 text-base font-light leading-7 text-muted-foreground">
            Amazon KDP has exacting interior requirements — trim dimensions, gutter margins, embedded
            fonts. Racana builds your Amazon KDP interior around them automatically: upload your
            manuscript, download a print-ready PDF.
          </p>
          <div className="mt-9 flex flex-col items-start gap-5 sm:flex-row sm:items-center">
            <PrimaryCta>Format for KDP</PrimaryCta>
            <p className="text-[11px] leading-6 text-muted-foreground">
              Free preview · ₹2,450 (≈ $29) per finished book · No subscription
            </p>
          </div>
        </div>
      </section>

      {/* What KDP requires */}
      <section className="bg-paper-deep/60 border-b border-border px-5 py-20 md:px-10 md:py-28 lg:px-16">
        <div className="mx-auto max-w-[1312px]">
          <SectionLabel num="01" label="KDP requirements" />
          <h2 className="mt-4 max-w-2xl font-serif text-4xl font-medium sm:text-5xl">
            What KDP checks — and how Racana answers.
          </h2>
          <p className="mt-6 max-w-xl leading-7 text-muted-foreground">
            KDP's file review is automated. These are the interior requirements that most often trip
            up hand-formatted manuscripts — and what Racana does about each one.
          </p>
          <div className="mt-14 border-t border-border">
            {kdpRequirements.map((r) => (
              <div
                key={r.req}
                className="grid gap-2 border-b border-border py-6 md:grid-cols-2 md:gap-10"
              >
                <p className="text-sm font-bold">{r.req}</p>
                <p className="text-sm font-light leading-6 text-muted-foreground">{r.how}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trim sizes */}
      <section className="px-5 py-20 md:px-10 md:py-28 lg:px-16">
        <div className="mx-auto max-w-[1312px]">
          <div className="grid gap-10 lg:grid-cols-[1fr_1.2fr]">
            <div>
              <SectionLabel num="02" label="Trim sizes" />
              <h2 className="mt-4 font-serif text-4xl sm:text-5xl">KDP trim sizes supported.</h2>
              <p className="mt-6 max-w-md text-sm leading-6 text-muted-foreground">
                All four are standard KDP paperback dimensions. Choose your trim when you upload —
                Racana lays out every page to those exact measurements.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-px bg-border sm:grid-cols-4">
              {trimSizes.map(([s, u]) => (
                <div key={s} className="bg-background px-5 py-8">
                  <span className="font-serif text-2xl">{s}</span>
                  <span className="mt-2 block text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                    {u}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Workflow */}
      <section className="bg-forest px-5 py-20 text-forest-foreground md:px-10 md:py-28 lg:px-16">
        <div className="mx-auto max-w-[1312px]">
          <div className="flex items-end justify-between border-b border-forest-foreground/25 pb-8">
            <div>
              <SectionLabel num="03" label="The workflow" />
              <h2 className="mt-4 font-serif text-4xl sm:text-5xl">
                Manuscript to KDP-ready interior.
              </h2>
            </div>
            <span className="hidden text-[9px] font-bold uppercase tracking-[0.24em] text-forest-foreground/60 md:block">
              01 — 03
            </span>
          </div>
          <div className="grid md:grid-cols-3">
            {steps.map(([n, t, s], i) => (
              <article
                key={n}
                className={`flex min-h-56 flex-col justify-between p-8 ${i ? "border-t border-forest-foreground/25 md:border-l md:border-t-0" : ""}`}
              >
                <span className="font-serif text-4xl italic text-accent">{n}</span>
                <div>
                  <h3 className="text-xs font-extrabold uppercase tracking-[0.2em]">{t}</h3>
                  <p className="mt-4 text-sm font-light leading-6 text-forest-foreground/75">{s}</p>
                </div>
              </article>
            ))}
          </div>
          <p className="mt-7 text-xs uppercase tracking-[0.12em] text-forest-foreground/60">
            The whole process usually takes about two minutes.
          </p>
        </div>
      </section>

      {/* Honest notes */}
      <section className="border-b border-border px-5 py-20 md:px-10 md:py-28 lg:px-16">
        <div className="mx-auto grid max-w-[1312px] gap-12 lg:grid-cols-2">
          <div>
            <SectionLabel num="04" label="Before you publish" />
            <h2 className="mt-4 font-serif text-4xl sm:text-5xl">Three honest notes.</h2>
          </div>
          <ul className="max-w-xl space-y-5 text-sm leading-7 text-muted-foreground">
            <li className="flex gap-3">
              <Check className="mt-1 size-4 shrink-0 text-forest" />
              Always review your interior in KDP Print Previewer before publishing. It's the final
              authority on what Amazon will print.
            </li>
            <li className="flex gap-3">
              <Check className="mt-1 size-4 shrink-0 text-forest" />
              Your cover is a separate file with a spine width calculated from your final page count —
              Cover Studio builds it automatically once the interior is finished.
            </li>
            <li className="flex gap-3">
              <Check className="mt-1 size-4 shrink-0 text-forest" />
              If KDP rejects a Racana interior for a formatting reason, email the rejection to
              books@racana.pro within 30 days for a full refund.
            </li>
          </ul>
        </div>
      </section>

      {/* FAQ */}
      <section className="px-5 py-20 md:px-10 md:py-28 lg:px-16">
        <div className="mx-auto max-w-4xl">
          <SectionLabel num="05" label="FAQ" />
          <h2 className="mt-4 font-serif text-4xl sm:text-5xl">KDP questions, answered.</h2>
          <div className="mt-12 border-t border-border">
            {faqs.map(([q, a]) => (
              <details key={q} className="group border-b border-border">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-6 font-semibold">
                  <span>{q}</span>
                  <ChevronDown className="size-4 shrink-0 transition-transform group-open:rotate-180" />
                </summary>
                <p className="max-w-2xl pb-6 text-sm leading-7 text-muted-foreground">{a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="border-t border-border px-5 py-20 text-center md:py-28">
        <div className="mx-auto max-w-3xl">
          <h2 className="font-serif text-4xl leading-tight sm:text-6xl">
            Your KDP interior,<br />
            <span className="italic text-primary">ready for review.</span>
          </h2>
          <div className="mt-10">
            <PrimaryCta>Start your book</PrimaryCta>
          </div>
          <p className="mt-5 text-xs text-muted-foreground">
            Free preview · ₹2,450 (≈ $29) when you're ready
          </p>
        </div>
      </section>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@graph": [
              {
                "@type": "Article",
                headline: "KDP Book Formatting — Amazon KDP Interior Requirements, Handled",
                description:
                  "How Racana formats DOCX and PDF manuscripts into paperback interiors that meet Amazon KDP's requirements — trim sizes, gutters, and embedded fonts.",
                author: { "@type": "Organization", name: "Racana Studio" },
                publisher: { "@type": "Organization", name: "Racana Studio" },
                mainEntityOfPage: "/kdp-formatting",
              },
              {
                "@type": "FAQPage",
                mainEntity: faqs.map(([q, a]) => ({
                  "@type": "Question",
                  name: q,
                  acceptedAnswer: { "@type": "Answer", text: a },
                })),
              },
            ],
          }),
        }}
      />
    </div>
  );
}
