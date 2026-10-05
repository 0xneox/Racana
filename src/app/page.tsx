import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowDown,
  ArrowRight,
  Check,
  ChevronDown,
  Upload,
  Palette,
  BookOpen,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";

import { LandingHeader } from "@/components/landing/Header";
import { MobileAction } from "@/components/landing/MobileAction";
import { AnimatedBrand } from "@/components/AnimatedBrand";
import { ManuscriptXRay } from "@/components/landing/ManuscriptXRay";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Meta");
  return {
    title: t("title"),
    description: t("description"),
    openGraph: {
      title: t("ogTitle"),
      description: t("ogDescription"),
      type: "website",
      url: "/",
      locale: "en_IN",
      images: [
        {
          url: "/opengraph-image",
          width: 1200,
          height: 630,
          alt: "Racana — book interior publisher for Indian authors.",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: t("ogTitle"),
      description: t("ogDescription"),
      images: ["/opengraph-image"],
    },
    alternates: {
      canonical: "/",
    },
    keywords: [
      "book formatting",
      "book interior typesetting",
      "self publishing India",
      "KDP formatting",
      "Pothi",
      "IngramSpark layout",
      "EPUB conversion",
      "cover design India",
      "Malayalam book typesetting",
      "Tamil book formatting",
      "Devanagari typesetting",
    ],
  };
}

// --- Content data ---------------------------------------------------------

const featureKeys = ["f1", "f2", "f3", "f4", "f5"] as const;

const bookStyleMeta = [
  { key: "s1", numeral: "I", preview: "classic" },
  { key: "s2", numeral: "II", preview: "modern" },
] as const;

const audienceKeys = ["a1", "a2", "a3", "a4"] as const;

const faqIds = [1, 2, 3, 4, 5, 6, 7, 8] as const;

const printerPlatforms = ["Amazon KDP", "IngramSpark", "Pothi"] as const;

const demoBook = {
  chapter: "Chapter Three",
  title: ["The Weight", "of Quiet Things"],
  opening: "here are rooms we remember not for what happened in them, but for the silence they held.",
} as const;

// --- Shared UI primitives -------------------------------------------------

function PrimaryLink({
  children,
  href = "/upload",
  size = "md",
  variant = "solid",
}: {
  children: ReactNode;
  href?: string;
  size?: "sm" | "md" | "lg";
  variant?: "solid" | "ghost" | "outline";
}) {
  const sizes: Record<NonNullable<typeof size>, string> = {
    sm: "min-h-10 px-4 text-xs",
    md: "min-h-12 px-6 text-sm",
    lg: "min-h-14 px-8 text-base",
  };
  const variants: Record<NonNullable<typeof variant>, string> = {
    solid:
      "bg-primary text-primary-foreground hover:shadow-lift focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring",
    ghost:
      "bg-transparent text-foreground underline decoration-border underline-offset-[6px]",
    outline:
      "border border-primary bg-transparent text-primary hover:bg-primary/5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring",
  };
  return (
    <Link
      href={href}
      className={`group inline-flex items-center justify-center gap-3 rounded-sm font-semibold transition-all hover:-translate-y-0.5 ${sizes[size]} ${variants[variant]}`}
    >
      {children}
      <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
    </Link>
  );
}

function SectionLabel({ label }: { label: string }) {
  return (
    <p className="text-[10px] font-extrabold uppercase tracking-[0.36em] text-primary">{label}</p>
  );
}

function StylePreview({ variant }: { variant: "classic" | "modern" }) {
  if (variant === "classic") {
    return (
      <div
        className="flex h-[85%] flex-col items-center justify-center text-center"
        aria-label="Classic book style preview — dropcap EB Garamond with a centred chapter opener"
      >
        <span className="text-[6px] uppercase tracking-[0.25em] text-primary">{demoBook.chapter}</span>
        <h3 className="mt-3 font-serif text-2xl leading-none">{demoBook.title[0]}<br />{demoBook.title[1]}</h3>
        <div className="mt-4 h-px w-7 bg-primary" />
        <p className="mt-5 text-left font-serif text-[7px] leading-relaxed text-ink-soft">
          <span className="float-left mr-1 text-3xl leading-[.7] text-primary">T</span>
          {demoBook.opening}
        </p>
      </div>
    );
  }
  return (
    <div
      className="flex h-[85%] flex-col justify-start pt-4"
      aria-label="Modern book style preview — Source Serif with bold sans-serif headings"
    >
      <span className="text-[6px] font-bold tracking-[0.15em] text-muted-foreground">03</span>
      <h3 className="mt-2 text-xl font-bold leading-none">{demoBook.title.join(" ")}</h3>
      <p className="mt-4 text-[7px] leading-relaxed text-ink-soft">T{demoBook.opening}</p>
    </div>
  );
}

function ManuscriptPage({ finished = false, compact = false }: { finished?: boolean; compact?: boolean }) {
  const label = finished
    ? "Finished Racana book interior — professional typesetting with running heads, folios, and dropcap chapter openers"
    : "Raw author manuscript DOCX — unformatted, flat headings, tracked comments, and uneven spacing";
  return (
    <div
      aria-label={label}
      role="img"
      className={`relative mx-auto aspect-[3/4] w-full bg-paper text-foreground shadow-page ${compact ? "max-w-72 p-6" : "max-w-sm p-7 sm:p-10"}`}
    >
      {finished ? (
        <>
          <div className="flex justify-between border-b border-rule/60 pb-2 font-serif text-[8px] uppercase tracking-[0.18em] text-muted-foreground">
            <span>The Weight of Quiet Things</span>
            <span>17</span>
          </div>
          <div className="flex h-full flex-col pt-[18%] text-center">
            <span className="text-[8px] uppercase tracking-[0.28em] text-primary">Chapter Three</span>
            <h3 className="mt-3 font-serif text-2xl font-semibold leading-none sm:text-3xl">The Weight<br />of Quiet Things</h3>
            <div className="mx-auto mt-5 h-px w-8 bg-primary" />
            <div className="mt-7 space-y-2 text-left font-serif text-[9px] leading-[1.65] text-ink-soft sm:text-[10px]">
              <p><span className="float-left mr-1 text-4xl leading-[.75] text-primary">T</span>here are rooms we remember not for what happened in them, but for the silence they held.</p>
              <p>The afternoon settled over the house. Light moved slowly across the floorboards, finding every mark time had left behind.</p>
              <p>Outside, the leaves turned in a wind too soft to hear.</p>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="flex items-center gap-2 border-b border-border pb-3 text-[8px] text-muted-foreground">
            <i className="size-2 rounded-full bg-destructive/60" />
            <i className="size-2 rounded-full bg-accent" />
            <i className="size-2 rounded-full bg-forest/50" />
            <span className="ml-2">manuscript-final.docx</span>
          </div>
          <div className="pt-8 text-[9px] leading-[1.75] text-ink-soft sm:text-[10px]">
            <p className="mb-1 font-semibold">CHAPTER 3</p>
            <p className="mb-5 text-base font-bold leading-tight">THE WEIGHT OF QUIET THINGS</p>
            <p>There are rooms we remember not for what happened in them, but for the silence they held.</p>
            <p className="mt-2">The afternoon settled over the house. Light moved slowly across the floorboards, finding every mark time had left behind.</p>
            <p className="mt-2">Outside, the leaves turned in a wind too soft to hear.</p>
            <span className="mt-4 block w-16 bg-secondary px-1 text-[8px]">[PAGE BREAK]</span>
          </div>
        </>
      )}
    </div>
  );
}

// --- Page sections --------------------------------------------------------

function Hero() {
  const t = useTranslations("Hero");
  return (
    <section id="content" className="relative border-b border-border pt-28 lg:min-h-[820px] lg:pt-32">
      <div className="mx-auto max-w-[1440px] px-5 pb-20 md:px-10 lg:px-16">
        {/* Brand — the animated multilingual logo, left-aligned */}
        <div className="reveal overflow-hidden border-b border-foreground/15 py-4 sm:py-6">
          <AnimatedBrand />
        </div>

        {/* Hero content — 8 / 4 split on desktop: copy + CTA (left) + hero book visual (right) */}
        <div className="reveal grid gap-12 pt-12 lg:grid-cols-12 lg:items-center lg:gap-8">
          {/* Copy column (8 cols) */}
          <div className="lg:col-span-8 xl:col-span-7">
            <p className="mb-6 text-[10px] font-extrabold uppercase tracking-[0.28em] text-primary">
              {t("eyebrow")}
            </p>
            <h1 className="font-serif text-[clamp(3rem,5.5vw,6rem)] font-medium leading-[0.92]">
              {t("titleA")}<br />
              <span className="italic text-primary">{t("titleB")}</span>
            </h1>
            <p className="mt-7 max-w-2xl border-l border-foreground pl-6 text-lg font-light leading-8 text-muted-foreground sm:text-xl">
              {t("subtitle")}
            </p>

            {/* Proof row — right under copy */}
            <div className="mt-9 flex flex-wrap items-center gap-x-7 gap-y-4 border-t border-foreground/10 pt-6">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Upload className="size-4 text-primary" />
                <span>{t("trustFreePreview")}</span>
              </div>
              <div className="h-5 w-px bg-foreground/10" aria-hidden="true" />
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <BookOpen className="size-4 text-primary" />
                <span>{t("trustSpeed")}</span>
              </div>
              <div className="h-5 w-px bg-foreground/10" aria-hidden="true" />
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Palette className="size-4 text-primary" />
                <span>{t("trustScripts")}</span>
              </div>
            </div>

            {/* CTA row */}
            <div id="hero-action" className="mt-8 flex flex-col items-start gap-5 sm:flex-row sm:items-center">
              <PrimaryLink size="lg">{t("ctaPrimary")}</PrimaryLink>
              <a
                href="#before-after"
                className="inline-flex items-center gap-2 rounded-sm border border-border bg-transparent px-6 text-sm font-semibold text-foreground transition-all hover:bg-paper focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
              >
                {t("ctaSecondary")} <ArrowDown className="size-4" />
              </a>
            </div>

            {/* Pricing clarity — INR leading, USD secondary (Indian market) */}
            <p className="mt-7 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm text-muted-foreground">
              <span className="text-base font-bold text-foreground">
                {t("priceLead")}
              </span>
              <span>({t("priceUsd")})</span>
              <span className="text-foreground/40">·</span>
              <span className="text-foreground">{t("priceNoSubs")}</span>
            </p>
          </div>

          {/* Hero visual (book mockup stack) — 4 cols on lg, above fold on sm */}
          <div className="lg:col-span-4 xl:col-span-5">
            <div className="relative mx-auto w-full max-w-md">
              {/* Drop shadow / stack silhouette behind */}
              <div
                aria-hidden="true"
                className="absolute -right-6 top-6 h-full w-full translate-x-4 rotate-3 rounded-sm border border-foreground/10 bg-paper-deep/60 shadow-page"
              />
              <div
                aria-hidden="true"
                className="absolute -left-8 top-10 h-full w-full -translate-x-4 -rotate-2 rounded-sm border border-foreground/5 bg-paper shadow-page"
              />

              {/* Front page — demo book, Classic style, set in Devanagari */}
              <div
                lang="hi"
                role="img"
                aria-label="Classic style page in Devanagari: Chapter Three of The Weight of Quiet Things, 5.5 × 8.5 trade"
                className="relative mx-auto aspect-[3/4] w-full max-w-sm rounded-sm bg-paper text-foreground shadow-page ring-1 ring-foreground/10"
                style={{ fontFamily: '"Noto Serif Devanagari", serif' }}
              >
                <div className="flex h-full flex-col p-7 sm:p-9">
                  <div className="flex justify-between border-b border-rule/50 pb-2 text-[8px] tracking-[0.12em] text-muted-foreground">
                    <span>शांत चीज़ों का भार</span>
                    <span>१७</span>
                  </div>
                  <div className="flex h-full flex-col justify-center text-center">
                    <p className="text-[9px] tracking-[0.18em] text-primary">अध्याय तीन</p>
                    <h3 className="mt-3 text-4xl font-bold leading-[1.15] sm:text-5xl">
                      शांत चीज़ों<br />
                      का <span className="text-primary">भार</span>
                    </h3>
                    <div className="mx-auto mt-5 h-px w-9 bg-primary" />
                    <div className="mt-7 space-y-2 text-left text-[10px] leading-[1.8] text-ink-soft">
                      <p>
                        कुछ कमरे हमें इसलिए याद नहीं रहते कि उनमें क्या हुआ, बल्कि उस ख़ामोशी के लिए जो उनमें ठहरी रही।
                      </p>
                      <p>
                        दोपहर घर पर धीरे-धीरे उतर आई। रोशनी फ़र्श पर सरकती रही, और समय के छोड़े हर निशान को ढूँढ़ती रही।
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <p className="mx-auto mt-8 max-w-md text-center font-serif text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Racana Studio · 5.5 × 8.5 · Trade
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function BuiltForPrint() {
  const t = useTranslations("BuiltForPrint");
  return (
    <section className="border-b border-border bg-paper-deep/60 py-20 md:py-28">
      <div className="mx-auto max-w-[1312px] px-5 md:px-10 lg:px-16">
        <SectionLabel label={t("label")} />
        <h2 className="mt-4 font-serif text-4xl font-medium sm:text-5xl">
          {t("heading")}
        </h2>
        {/* Five cards: 3 + 2 centred on desktop, 2 + 2 + 1 on tablet, single column on mobile */}
        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
          {featureKeys.map((k, i) => (
            <div
              key={k}
              className={`border border-border bg-background px-6 py-8 lg:col-span-2 ${i === 3 ? "lg:col-start-2" : ""} ${i === 4 ? "sm:col-span-2" : ""}`}
            >
              <h3 className="text-sm font-bold">{t(`${k}Label`)}</h3>
              <p className="mt-3 text-sm font-light leading-6 text-muted-foreground">{t(`${k}Desc`)}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Method() {
  const t = useTranslations("Method");
  const steps = ["s1", "s2", "s3"] as const;
  return (
    <section id="how" className="px-5 py-24 md:px-10 md:py-32 lg:px-16">
      <div className="mx-auto max-w-[1312px]">
        <div className="flex items-end justify-between border-b border-border pb-8">
          <div>
            <SectionLabel label={t("label")} />
            <h2 className="mt-4 font-serif text-5xl font-medium sm:text-6xl">{t("heading")}</h2>
          </div>
          <span className="hidden text-[9px] font-bold uppercase tracking-[0.24em] text-muted-foreground md:block">
            01 — 03
          </span>
        </div>
        <div className="grid border-x border-b border-border md:grid-cols-3">
          {steps.map((k, i) => (
            <article
              key={k}
              className={`group flex min-h-80 flex-col justify-between p-8 transition-colors hover:bg-paper ${i ? "border-t border-border md:border-l md:border-t-0" : ""}`}
            >
              <div className="flex items-start justify-between">
                <span className="font-serif text-4xl italic text-primary">{`0${i + 1}`}</span>
                <span className="size-2 scale-0 rounded-full bg-foreground transition-transform group-hover:scale-100" />
              </div>
              <div>
                <h3 className="text-xs font-extrabold uppercase tracking-[0.2em]">{t(`${k}Title`)}</h3>
                <p className="mt-5 max-w-xs text-sm font-light leading-6 text-muted-foreground">{t(`${k}Sub`)}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function Styles() {
  const t = useTranslations("Styles");
  return (
    <section id="styles" className="bg-forest px-5 py-24 text-forest-foreground md:px-10 md:py-32 lg:px-16">
      <div className="mx-auto max-w-[1312px]">
        <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <div>
            <SectionLabel label={t("label")} />
            <h2 className="mt-4 max-w-2xl font-serif text-5xl sm:text-6xl">{t("heading")}</h2>
          </div>
          <p className="max-w-sm text-sm leading-6 text-forest-foreground/70">
            {t("sub")}
          </p>
        </div>
        <div className="mx-auto mt-16 grid max-w-3xl gap-px bg-forest-foreground/20 sm:grid-cols-2">
          {bookStyleMeta.map((s) => (
            <article key={s.key} className="group bg-forest p-5">
              <div className="aspect-[3/4] bg-paper p-5 text-foreground shadow-page transition-transform duration-500 group-hover:-translate-y-2">
                <div className="flex justify-between border-b border-rule/50 pb-2 text-[6px] uppercase tracking-[0.18em] text-muted-foreground">
                  <span>Racana</span>
                  <span>{s.numeral}</span>
                </div>
                <StylePreview variant={s.preview} />
              </div>
              <p className="mt-6 font-serif text-2xl">{t(`${s.key}Name`)}</p>
              <p className="mt-1 text-xs text-forest-foreground/80">{t(`${s.key}Mood`)}</p>
              <p className="mt-4 min-h-10 text-[11px] leading-5 text-forest-foreground/55">{t(`${s.key}Use`)}</p>
              <Link href="/upload" className="mt-5 inline-flex items-center gap-2 text-xs font-semibold text-accent">
                {t("preview", { name: t(`${s.key}Name`) })} <ArrowRight className="size-3" />
              </Link>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function BeforeAfter() {
  const t = useTranslations("BeforeAfter");
  return (
    <section id="before-after" className="px-5 py-24 md:px-10 md:py-32 lg:px-16">
      <div className="mx-auto max-w-[1312px]">
        <SectionLabel label={t("label")} />
        <h2 className="mt-4 font-serif text-5xl sm:text-6xl">
          {t("headingA")}<br />
          <span className="italic text-primary">{t("headingB")}</span>
        </h2>
        <p className="mt-7 max-w-md leading-7 text-muted-foreground">
          {t("sub")}
        </p>

        {/* The signature visual — bigger, more prominent */}
        <div className="mt-16 grid items-end gap-8 sm:gap-12 lg:grid-cols-2">
          <div>
            <p className="mb-4 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              {t("manuscriptLabel")}
            </p>
            <ManuscriptPage />
          </div>
          <div className="lg:translate-y-8">
            <p className="mb-4 text-[10px] font-semibold uppercase tracking-[0.2em] text-primary">
              {t("interiorLabel")}
            </p>
            <ManuscriptPage finished />
          </div>
        </div>

        {/* What Racana handles */}
        <div className="mt-16 border-t border-border pt-8">
          <p className="mb-6 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
            {t("handlesTitle")}
          </p>
          <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            {(["i1", "i2", "i3", "i4", "i5", "i6", "i7", "i8"] as const).map((k) => (
              <span key={k} className="flex items-center gap-2">
                <Check className="size-3.5 text-primary" />
                {t(k)}
              </span>
            ))}
          </div>
          {/* NEW: Cover + EPUB callout now that we actually ship them */}
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <div className="border border-border bg-paper p-5">
              <div className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-primary">
                Included · Cover Studio
              </div>
              <p className="mt-2 text-sm font-semibold">KDP-accurate paperback wrap + Kindle cover</p>
              <p className="mt-1 text-xs font-light leading-6 text-muted-foreground">
                Spine sized from your real page count and paper, matched to your trim. 300-DPI print PDF plus a 1600×2560 Kindle JPG.
              </p>
            </div>
            <div className="border border-border bg-paper p-5">
              <div className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-primary">
                Included · EPUB 3 Export
              </div>
              <p className="mt-2 text-sm font-semibold">One-click for Kindle &amp; Play Books</p>
              <p className="mt-1 text-xs font-light leading-6 text-muted-foreground">
                Keeps your bold, italics, footnotes and images, with a nested contents page. Each file is checked before you download it.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Promise() {
  const t = useTranslations("Promise");
  return (
    <section className="border-y border-border bg-paper-deep/45">
      <div className="mx-auto grid max-w-[1440px] lg:grid-cols-2">
        <div className="px-5 py-24 md:px-16 lg:border-r lg:border-border lg:px-24 lg:py-32">
          <SectionLabel label={t("label")} />
          <h2 className="mt-5 font-serif text-5xl sm:text-6xl">{t("heading")}</h2>
          <div className="mt-8 space-y-2 leading-7 text-muted-foreground">
            <p>{t("p1")}</p>
            <p>
              {t("p2a")}<br />
              {t("p2b")}<br />
              {t("p2c")}
            </p>
            <p className="pt-3 font-semibold text-foreground">{t("p3")}</p>
          </div>
        </div>
        <div className="flex items-center px-5 py-24 md:px-16 lg:px-24">
          <blockquote className="font-serif text-4xl leading-tight sm:text-5xl">
            &ldquo;{t("quoteA")}{" "}
            <span className="italic text-primary">{t("quoteB")}</span>&rdquo;
          </blockquote>
        </div>
      </div>
    </section>
  );
}

function PrintDims() {
  const t = useTranslations("PrintDims");
  const trimSizes: [string, string][] = [
    ["5 × 8″", t("u1")],
    ["5.5 × 8.5″", t("u2")],
    ["6 × 9″", t("u3")],
    ["8.5 × 11″", t("u4")],
  ];
  return (
    <section className="px-5 py-24 md:px-10 md:py-32 lg:px-16">
      <div className="mx-auto max-w-[1312px]">
        <SectionLabel label={t("label")} />
        <div className="mt-4 grid gap-10 lg:grid-cols-[1fr_1.2fr]">
          <div>
            <h2 className="font-serif text-5xl">{t("heading")}</h2>
            <p className="mt-6 max-w-md text-sm leading-6 text-muted-foreground">
              {t("sub")}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-px bg-border sm:grid-cols-4">
            {trimSizes.map(([s, u]) => (
              <div key={s} className="bg-background px-5 py-8">
                <span className="font-serif text-2xl">{s}</span>
                <span className="mt-2 block text-[10px] uppercase tracking-[0.15em] text-muted-foreground">{u}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function WhoFor() {
  const t = useTranslations("WhoFor");
  return (
    <section className="bg-paper-deep/45 border-y border-border px-5 py-24 md:px-10 md:py-32 lg:px-16">
      <div className="mx-auto max-w-[1312px]">
        <SectionLabel label={t("label")} />
        <h2 className="mt-4 max-w-2xl font-serif text-5xl sm:text-6xl">
          {t("heading")}
        </h2>
        <div className="mt-14 grid gap-px bg-border sm:grid-cols-2 lg:grid-cols-4">
          {audienceKeys.map((k) => (
            <div key={k} className="bg-background px-6 py-8">
              <h3 className="text-sm font-bold">{t(`${k}Title`)}</h3>
              <p className="mt-3 text-sm font-light leading-6 text-muted-foreground">{t(`${k}Desc`)}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Printers() {
  const t = useTranslations("Printers");
  return (
    <section className="border-b border-border px-5 py-16 md:px-10 lg:px-16">
      <div className="mx-auto max-w-[1312px]">
        <SectionLabel label={t("label")} />
        <div className="mt-6 flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
          <h2 className="max-w-2xl font-serif text-3xl sm:text-4xl">
            {t("heading")}
          </h2>
          <p className="max-w-sm text-sm font-light leading-6 text-muted-foreground">
            {t("sub")}
          </p>
        </div>
        <ul className="mt-10 grid grid-cols-1 gap-y-6 border border-border bg-background px-6 py-10 sm:grid-cols-3 md:px-10">
          {printerPlatforms.map((name) => (
            <li
              key={name}
              className="text-center font-serif text-sm font-bold tracking-[0.12em] text-foreground/70 sm:text-base"
            >
              {name}
            </li>
          ))}
        </ul>
        <p className="mt-5 text-xs text-muted-foreground">{t("epubLine")}</p>
      </div>
    </section>
  );
}

function Pricing() {
  const t = useTranslations("Pricing");
  return (
    <section id="pricing" className="bg-primary px-5 py-24 text-primary-foreground md:px-10 md:py-32 lg:px-16">
      <div className="mx-auto grid max-w-5xl gap-14 lg:grid-cols-2 lg:items-center">
        <div>
          <SectionLabel label={t("label")} />
          <h2 className="mt-4 font-serif text-6xl sm:text-7xl">
            {t("headingA")}<br />{t("headingB")}
          </h2>

          {/* INR LEAD PRICE — Indian market */}
          <div className="mt-9 flex flex-wrap items-baseline gap-x-3 gap-y-2">
            <span className="font-serif text-[clamp(3.5rem,7vw,6rem)] font-medium leading-none text-accent">
              {t("price")}
            </span>
            <span className="text-sm text-primary-foreground/70">
              {t("perBook")}
            </span>
          </div>
          <p className="mt-3 text-sm text-primary-foreground/65">
            {t("subPay")}
          </p>
          <p className="mt-6 text-sm font-semibold text-accent">
            {t("tagline")}
          </p>

          {/* Money-back / guarantee badge (trust) */}
          <p className="mt-8 inline-flex items-center gap-2 rounded-sm border border-primary-foreground/20 px-4 py-2 text-[11px] text-primary-foreground/80">
            <Check className="size-3.5 text-accent" />
            {t("guarantee")}
          </p>
        </div>
        <div className="border-primary-foreground/25 lg:border-l lg:pl-14">
          <p className="mb-6 text-[11px] font-semibold uppercase tracking-[0.22em] text-accent">
            {t("included")}
          </p>
          <ul className="space-y-4 text-sm">
            {(["i1", "i2", "i3", "i4", "i5", "i6", "i7"] as const).map((k) => (
              <li key={k} className="flex gap-3">
                <Check className="size-4 shrink-0 text-accent" />
                {t(k)}
              </li>
            ))}
          </ul>
          <Link
            href="/upload"
            className="mt-9 inline-flex min-h-12 items-center justify-center gap-3 rounded-sm bg-primary-foreground px-6 text-sm font-semibold text-primary transition-all hover:-translate-y-0.5 hover:shadow-lift"
          >
            {t("cta")} <ArrowRight className="size-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}

function Faq() {
  const t = useTranslations("Faq");
  return (
    <section id="faq" className="px-5 py-24 md:px-10 md:py-32">
      <div className="mx-auto max-w-4xl">
        <SectionLabel label={t("label")} />
        <h2 className="mt-4 font-serif text-5xl sm:text-6xl">{t("heading")}</h2>
        <div className="mt-14 border-t border-border">
          {faqIds.map((n) => (
            <details key={n} className="group border-b border-border">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-6 font-semibold">
                <span>{t(`q${n}`)}</span>
                <ChevronDown className="size-4 shrink-0 transition-transform group-open:rotate-180" />
              </summary>
              <p className="max-w-2xl pb-6 text-sm leading-7 text-muted-foreground">{t(`a${n}`)}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalCta() {
  const t = useTranslations("FinalCta");
  return (
    <section className="border-t border-border bg-paper-deep/35 px-5 py-24 text-center md:py-32">
      <div className="mx-auto max-w-3xl">
        <h2 className="font-serif text-5xl leading-tight sm:text-7xl">
          {t("headingA")}<br />
          <span className="italic text-primary">{t("headingB")}</span>
        </h2>
        <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <PrimaryLink size="lg">{t("cta")}</PrimaryLink>
          <p className="text-xs leading-6 text-muted-foreground sm:max-w-xs sm:text-left">
            {t("subCta")}
          </p>
        </div>
      </div>
    </section>
  );
}

function LandingFooter() {
  const t = useTranslations("Footer");
  const columns: [string, [string, string][]][] = [
    [
      t("product"),
      [
        [t("howItWorks"), "#how"],
        [t("styles"), "#styles"],
        [t("pricing"), "#pricing"],
        [t("faq"), "#faq"],
      ],
    ],
    [
      t("resources"),
      [
        ["Book formatting", "/book-formatting"],
        ["KDP formatting", "/kdp-formatting"],
        ["Vellum for Windows", "/vellum-alternative-windows"],
        ["Roast My Manuscript", "/roast"],
        [t("myBooks"), "/auth/signin?callbackUrl=%2Fbooks"],
      ],
    ],
    [
      t("legal"),
      [
        [t("privacy"), "/privacy"],
        [t("terms"), "/terms"],
        ["Refund policy", "/terms"],
        [t("contact"), "mailto:support@racana.pro"],
      ],
    ],
  ];
  return (
    <footer className="bg-foreground px-5 py-16 text-background md:px-10 lg:px-16">
      <div className="mx-auto max-w-[1312px]">
        <div className="grid gap-12 border-b border-background/20 pb-14 md:grid-cols-[2fr_1fr_1fr_1fr]">
          <div>
            <Link href="#top" className="flex items-center gap-3">
              <img
                src="/logo-mark.png"
                alt="Racana — book interior typesetting for Indian authors"
                className="h-10 w-auto"
              />
              <p className="font-serif text-3xl tracking-[0.14em]">RACANA</p>
            </Link>
            <p className="mt-4 text-sm text-background/60">{t("tagline")}</p>
            <div className="mt-6 flex flex-col gap-1 text-xs text-background/50">
              <a href="mailto:support@racana.pro" className="hover:text-background">
                support@racana.pro
              </a>
              <span>India</span>
            </div>
          </div>
          {columns.map(([h, ls]) => (
            <div key={h}>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-background/50">{h}</p>
              <div className="mt-4 flex flex-col gap-3 text-sm">
                {ls.map(([l, href]) => (
                  <a
                    key={l}
                    href={href}
                    className="text-background/80 transition-colors hover:text-background focus-visible:text-background focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-background/50"
                  >
                    {l}
                  </a>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="flex flex-col justify-between gap-3 pt-6 text-xs text-background/50 sm:flex-row sm:items-center">
          <span>{t("copyright")}</span>
          <div className="flex flex-wrap items-center gap-4">
            <a href="/sitemap.xml" className="hover:text-background">Sitemap</a>
            <span className="text-background/30">·</span>
            <a href="#top" className="hover:text-background">Back to top ↑</a>
          </div>
        </div>
      </div>
    </footer>
  );
}

// --- Page -----------------------------------------------------------------

export default function Index() {
  const t = useTranslations("Hero");
  const st = useTranslations("StructuredData");
  return (
    <main id="top" className="mobile-safe page-grain overflow-hidden">
      <a
        href="#content"
        className="fixed left-3 top-3 z-[100] -translate-y-24 rounded-sm bg-foreground px-4 py-3 text-xs font-bold text-background transition focus:translate-y-0 focus:outline-2 focus:outline-offset-4 focus:outline-ring"
      >
        {t("skipToContent")}
      </a>
      <LandingHeader />

      <Hero />
      <ManuscriptXRay />
      <BuiltForPrint />
      <Method />
      <Styles />
      <BeforeAfter />
      <Promise />
      <PrintDims />
      <WhoFor />
      <Printers />
      <Pricing />
      <Faq />
      <FinalCta />
      <LandingFooter />
      <MobileAction />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@graph": [
              {
                "@type": "SoftwareApplication",
                "@id": `${process.env.NEXT_PUBLIC_APP_URL || "https://racana.pro"}/#software`,
                name: "Racana",
                alternateName: ["रचना", "Racana Studio", "racana.pro"],
                applicationCategory: "DesignApplication",
                operatingSystem: "Web",
                description: st("description"),
                inLanguage: ["en-IN", "hi-IN", "ta-IN", "bn-IN"],
                keywords: st("keywords").split(","),
                featureList: st("features").split("|"),
                offers: [
                  {
                    "@type": "Offer",
                    price: "2450",
                    priceCurrency: "INR",
                    priceValidUntil: "2027-12-31",
                    availability: "https://schema.org/InStock",
                    url: `${process.env.NEXT_PUBLIC_APP_URL || "https://racana.pro"}/upload`,
                    businessFunction: "http://purl.org/goodrelations/v1#ProvideService",
                    description: "One finished interior — typeset, QA'd, print-ready PDF, EPUB 3, and cover design",
                    name: "Single Book Interior",
                  },
                  {
                    "@type": "Offer",
                    price: "29",
                    priceCurrency: "USD",
                    priceValidUntil: "2027-12-31",
                    availability: "https://schema.org/InStock",
                    url: `${process.env.NEXT_PUBLIC_APP_URL || "https://racana.pro"}/upload`,
                    businessFunction: "http://purl.org/goodrelations/v1#ProvideService",
                    name: "Single Book Interior (USD Equivalent)",
                  },
                ],
                publisher: {
                  "@type": "Organization",
                  name: "Racana Studio",
                  url: process.env.NEXT_PUBLIC_APP_URL || "https://racana.pro",
                  email: "support@racana.pro",
                  address: {
                    "@type": "PostalAddress",
                    addressCountry: "IN",
                  },
                },
              },
              {
                "@type": "WebSite",
                url: process.env.NEXT_PUBLIC_APP_URL || "https://racana.pro",
                name: "Racana",
                inLanguage: ["en-IN", "hi-IN", "ta-IN", "bn-IN"],
                potentialAction: [
                  {
                    "@type": "SearchAction",
                    target: `${process.env.NEXT_PUBLIC_APP_URL || "https://racana.pro"}/?q={search_term_string}`,
                    "query-input": "required name=search_term_string",
                  },
                ],
              },
            ],
          }),
        }}
      />
    </main>
  );
}
