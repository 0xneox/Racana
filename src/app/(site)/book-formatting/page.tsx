import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check, ChevronDown } from "lucide-react";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Book Interior Formatting — Racana",
  description:
    "What book interior formatting is, why it matters for print-on-demand, and how Racana turns your DOCX or PDF manuscript into a print-ready book interior.",
  alternates: { canonical: "/book-formatting" },
  openGraph: {
    title: "Book Interior Formatting — Racana",
    description:
      "Manuscript formatting and book interior design, explained. Upload your DOCX or PDF and receive a professionally typeset, print-ready interior.",
    type: "article",
    url: "/book-formatting",
  },
};

// --- Content ---------------------------------------------------------------

const formattingElements = [
  {
    n: "01",
    label: "Trim size & page geometry",
    desc: "The physical dimensions of the book — 5 × 8″, 6 × 9″, and so on — decide everything else on the page.",
  },
  {
    n: "02",
    label: "Margins & gutter",
    desc: "Inside margins must leave room for the binding. Too tight, and words disappear into the spine.",
  },
  {
    n: "03",
    label: "Typography",
    desc: "A readable serif at the right size and leading, embedded correctly so the printer sees exactly what you saw.",
  },
  {
    n: "04",
    label: "Chapter openings",
    desc: "New chapters conventionally open on a right-hand (recto) page, with the folio suppressed.",
  },
  {
    n: "05",
    label: "Running heads & folios",
    desc: "The quiet furniture of a book — author name, book title, page numbers — placed consistently.",
  },
  {
    n: "06",
    label: "Paragraph rhythm",
    desc: "Indents, spacing, and widow/orphan control that keep pages even from the first leaf to the last.",
  },
];

const steps = [
  ["01", "Upload", "Give us your DOCX or PDF manuscript. Your text is never edited or rewritten."],
  ["02", "Choose a style", "Pick from six type systems — Classic, Modern, Philosophy, Academic, Literary, or Indian Classical."],
  ["03", "Download", "Receive a print-ready interior PDF with embedded fonts and binding-aware margins."],
];

const faqs: [string, string][] = [
  [
    "Is book formatting the same as editing?",
    "No. Formatting (also called typesetting or book interior design) arranges your finished text on the page — margins, type, chapter openings, page numbers. It never changes a word you wrote. Editing is a separate craft that happens before formatting.",
  ],
  [
    "Can I format a book interior myself in Word?",
    "You can, and many authors do — but Word fights you on gutters, recto chapter openings, and font embedding. A formatter or a dedicated tool exists because those details are tedious to get right by hand.",
  ],
  [
    "What file do I get back from Racana?",
    "A print-ready interior PDF at your chosen trim size, with fonts embedded. That file is what you upload to a print-on-demand service like Amazon KDP or IngramSpark.",
  ],
  [
    "Does Racana design my cover too?",
    "No. Racana formats the interior pages only. Covers are a separate file with their own specifications — use a cover tool or your printer's template for that.",
  ],
  [
    "How much does it cost?",
    "Previewing your typeset interior is free. When you're happy with it, the finished print-ready PDF is $29 — one book, one payment, no subscription.",
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

export default function BookFormattingPage() {
  return (
    <div className="page-grain">
      {/* Hero */}
      <section className="border-b border-border px-5 py-20 md:px-10 md:py-28 lg:px-16">
        <div className="mx-auto max-w-[1312px]">
          <SectionLabel num="00" label="Book interior formatting" />
          <h1 className="mt-5 max-w-3xl font-serif text-[clamp(2.6rem,5vw,4.6rem)] font-medium leading-[1.02]">
            Book formatting is the craft that turns a manuscript{" "}
            <span className="italic text-primary">into a book.</span>
          </h1>
          <p className="mt-7 max-w-xl border-l border-foreground pl-6 text-base font-light leading-7 text-muted-foreground">
            Book interior formatting — also called manuscript formatting or book interior design —
            is everything that decides how your words sit on the printed page. Racana does that work
            for you: upload a DOCX or PDF, and get back a professionally typeset interior.
          </p>
          <div className="mt-9 flex flex-col items-start gap-5 sm:flex-row sm:items-center">
            <PrimaryCta>Format your manuscript</PrimaryCta>
            <p className="text-[11px] leading-6 text-muted-foreground">
              Free preview · $29 per finished interior · No subscription
            </p>
          </div>
        </div>
      </section>

      {/* What book formatting is */}
      <section className="bg-paper-deep/60 border-b border-border px-5 py-20 md:px-10 md:py-28 lg:px-16">
        <div className="mx-auto max-w-[1312px]">
          <SectionLabel num="01" label="The craft" />
          <h2 className="mt-4 max-w-2xl font-serif text-4xl font-medium sm:text-5xl">
            What book formatting actually is.
          </h2>
          <p className="mt-6 max-w-xl leading-7 text-muted-foreground">
            A reader never notices good formatting — that's the point. It's a set of quiet,
            interlocking decisions that make a printed page feel effortless.
          </p>
          <div className="mt-14 grid gap-px bg-border sm:grid-cols-2 lg:grid-cols-3">
            {formattingElements.map((f) => (
              <div key={f.n} className="bg-background px-6 py-8">
                <div className="flex items-baseline gap-3">
                  <span className="font-serif text-2xl italic text-primary/60">{f.n}</span>
                  <h3 className="text-sm font-bold">{f.label}</h3>
                </div>
                <p className="mt-3 text-sm font-light leading-6 text-muted-foreground">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why it matters for POD */}
      <section className="bg-forest px-5 py-20 text-forest-foreground md:px-10 md:py-28 lg:px-16">
        <div className="mx-auto grid max-w-[1312px] gap-12 lg:grid-cols-2 lg:items-center">
          <div>
            <SectionLabel num="02" label="Print-on-demand" />
            <h2 className="mt-4 font-serif text-4xl sm:text-5xl">
              Why formatting matters more when the printer is a platform.
            </h2>
          </div>
          <div className="max-w-xl leading-7 text-forest-foreground/80">
            <p>
              Print-on-demand services like Amazon KDP and IngramSpark don't have a human checking
              your file with a ruler. Their checks are automated — and their tolerances are literal.
            </p>
            <p className="mt-5">
              A gutter that's a few millimetres too narrow means text swallowed by the binding. A
              PDF without embedded fonts can be rejected outright, or worse, printed with substituted
              type. A trim size mismatch means the file simply won't be accepted.
            </p>
            <p className="mt-5 font-semibold text-forest-foreground">
              Manuscript formatting done properly is the difference between a file that passes review
              and one that bounces back.
            </p>
          </div>
        </div>
      </section>

      {/* What Racana does */}
      <section className="px-5 py-20 md:px-10 md:py-28 lg:px-16">
        <div className="mx-auto max-w-[1312px]">
          <div className="flex items-end justify-between border-b border-border pb-8">
            <div>
              <SectionLabel num="03" label="What Racana does" />
              <h2 className="mt-4 font-serif text-4xl font-medium sm:text-5xl">
                Manuscript in. Print-ready interior out.
              </h2>
            </div>
            <span className="hidden text-[9px] font-bold uppercase tracking-[0.24em] text-muted-foreground md:block">
              01 — 03
            </span>
          </div>
          <div className="grid border-x border-b border-border md:grid-cols-3">
            {steps.map(([n, t, s], i) => (
              <article
                key={n}
                className={`flex min-h-56 flex-col justify-between p-8 ${i ? "border-t border-border md:border-l md:border-t-0" : ""}`}
              >
                <span className="font-serif text-4xl italic text-primary">{n}</span>
                <div>
                  <h3 className="text-xs font-extrabold uppercase tracking-[0.2em]">{t}</h3>
                  <p className="mt-4 text-sm font-light leading-6 text-muted-foreground">{s}</p>
                </div>
              </article>
            ))}
          </div>
          <p className="mt-7 text-xs uppercase tracking-[0.12em] text-muted-foreground">
            The whole process usually takes about two minutes.
          </p>

          <div className="mt-16 border-t border-border pt-10">
            <p className="mb-6 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
              What Racana handles for you
            </p>
            <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              {[
                "Trim size",
                "Margins & gutter",
                "Chapter openings",
                "Running heads",
                "Paragraph rhythm",
                "Page breaks",
                "Typography",
                "Folios",
              ].map((x) => (
                <span key={x} className="flex items-center gap-2">
                  <Check className="size-3.5 text-forest" />
                  {x}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Honest limits */}
      <section className="border-y border-border bg-paper-deep/45 px-5 py-20 md:px-10 md:py-28 lg:px-16">
        <div className="mx-auto grid max-w-[1312px] gap-12 lg:grid-cols-2">
          <div>
            <SectionLabel num="04" label="What Racana is not" />
            <h2 className="mt-4 font-serif text-4xl sm:text-5xl">An honest boundary.</h2>
          </div>
          <ul className="max-w-xl space-y-5 text-sm leading-7 text-muted-foreground">
            <li className="flex gap-3">
              <Check className="mt-1 size-4 shrink-0 text-forest" />
              Racana formats your manuscript — it never edits, rewrites, or summarizes your text.
            </li>
            <li className="flex gap-3">
              <Check className="mt-1 size-4 shrink-0 text-forest" />
              Racana produces the interior pages only. Cover files are separate.
            </li>
            <li className="flex gap-3">
              <Check className="mt-1 size-4 shrink-0 text-forest" />
              You review the finished PDF before it goes to print — the free preview exists for
              exactly that reason.
            </li>
          </ul>
        </div>
      </section>

      {/* FAQ */}
      <section className="px-5 py-20 md:px-10 md:py-28 lg:px-16">
        <div className="mx-auto max-w-4xl">
          <SectionLabel num="05" label="FAQ" />
          <h2 className="mt-4 font-serif text-4xl sm:text-5xl">Formatting questions, answered.</h2>
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
            Your book is written.<br />
            <span className="italic text-primary">Now give it a finished interior.</span>
          </h2>
          <div className="mt-10">
            <PrimaryCta>Start your book</PrimaryCta>
          </div>
          <p className="mt-5 text-xs text-muted-foreground">
            Free preview · $29 (≈ ₹2,450) when you're ready
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
                headline: "Book Interior Formatting — What It Is and Why It Matters",
                description:
                  "An explanation of book interior formatting (manuscript formatting) and how Racana produces print-ready interiors from DOCX or PDF files.",
                author: { "@type": "Organization", name: "Racana Studio" },
                publisher: { "@type": "Organization", name: "Racana Studio" },
                mainEntityOfPage: "/book-formatting",
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
