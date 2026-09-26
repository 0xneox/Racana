import type { Metadata } from "next";
import Link from "next/link";
import { ArrowDown, ArrowRight, Check, ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";

import { LandingHeader } from "@/components/landing/Header";
import { MobileAction } from "@/components/landing/MobileAction";
import { AnimatedBrand } from "@/components/AnimatedBrand";

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
    },
    twitter: {
      card: "summary_large_image",
    },
    alternates: {
      canonical: "/",
    },
  };
}

// --- Content data ---------------------------------------------------------
// Copy lives in /messages/*.json under each section's namespace; these
// structural lists map translation keys to ordering/preview metadata.

const featureKeys = ["f1", "f2", "f3", "f4", "f5", "f6"] as const;

const bookStyleMeta = [
  { key: "s1", numeral: "I", preview: "classic" },
  { key: "s2", numeral: "II", preview: "modern" },
  { key: "s3", numeral: "III", preview: "philosophy" },
  { key: "s4", numeral: "IV", preview: "academic" },
  { key: "s5", numeral: "V", preview: "literary" },
  { key: "s6", numeral: "VI", preview: "indian" },
] as const;

const audienceKeys = ["a1", "a2", "a3", "a4"] as const;

const faqIds = [1, 2, 3, 4, 5, 6, 7, 8] as const;

// --- Shared components ----------------------------------------------------

function PrimaryLink({ children }: { children: ReactNode }) {
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

function SectionLabel({ num, label }: { num: string; label: string }) {
  return (
    <p className="text-[10px] font-extrabold uppercase tracking-[0.36em] text-primary">
      <span className="text-primary/50">{num}</span> &nbsp;{label}
    </p>
  );
}

// Genuinely different preview content per book style — not just a font swap.
function StylePreview({ variant }: { variant: "classic" | "modern" | "philosophy" | "academic" | "literary" | "indian" }) {
  if (variant === "classic") {
    return (
      <div className="flex h-[85%] flex-col items-center justify-center text-center">
        <span className="text-[6px] uppercase tracking-[0.25em] text-primary">Chapter One</span>
        <h3 className="mt-3 font-serif text-2xl leading-none">The Garden<br />Path</h3>
        <div className="mt-4 h-px w-7 bg-primary" />
        <p className="mt-5 font-serif text-[7px] leading-relaxed text-ink-soft">
          <span className="float-left mr-1 text-3xl leading-[.7] text-primary">T</span>
          he morning was quiet, and the path lay open.
        </p>
      </div>
    );
  }
  if (variant === "modern") {
    return (
      <div className="flex h-[85%] flex-col justify-start pt-4">
        <span className="text-[6px] font-bold tracking-[0.15em] text-muted-foreground">01.1</span>
        <h3 className="mt-2 text-xl font-bold leading-none">The Garden Path</h3>
        <p className="mt-4 text-[7px] leading-relaxed text-ink-soft">
          The morning was quiet, and the path lay open. There was nothing to decide.
        </p>
      </div>
    );
  }
  if (variant === "philosophy") {
    return (
      <div className="flex h-[85%] flex-col items-center justify-center text-center">
        <p className="font-serif text-[8px] italic leading-relaxed text-muted-foreground">
          &ldquo;The way is not the path.&rdquo;
        </p>
        <h3 className="mt-4 font-serif text-xl italic leading-none">The Garden<br />Path</h3>
        <div className="mt-5 h-px w-7 bg-primary" />
        <p className="mt-5 font-serif text-[7px] leading-[2] text-ink-soft">
          The morning was quiet.
        </p>
      </div>
    );
  }
  if (variant === "academic") {
    return (
      <div className="flex h-[85%] flex-col">
        <span className="text-[6px] font-bold tracking-[0.1em] text-primary">1. The Garden Path</span>
        <h3 className="mt-2 font-serif text-lg font-semibold leading-none">1.1 Overview</h3>
        <p className="mt-3 text-[7px] leading-[1.6] text-ink-soft">
          The morning was quiet, and the path lay open. There was nothing to decide, and nothing to carry.
        </p>
        <span className="mt-2 text-[6px] text-muted-foreground">¹</span>
      </div>
    );
  }
  if (variant === "literary") {
    return (
      <div className="flex h-[85%] flex-col items-center justify-center text-center">
        <span className="text-[6px] uppercase tracking-[0.3em] text-primary">~ I ~</span>
        <h3 className="mt-3 font-serif text-2xl leading-none">The Garden<br />Path</h3>
        <div className="mx-auto mt-4 h-px w-10 bg-primary" />
        <p className="mt-5 text-left font-serif text-[7px] leading-relaxed text-ink-soft">
          <span className="float-left mr-1 text-4xl leading-[.65] font-serif text-primary">T</span>
          he morning was quiet, and the path lay open before her.
        </p>
      </div>
    );
  }
  // indian
  return (
    <div className="flex h-[85%] flex-col items-center justify-center text-center">
      <span className="text-[7px] tracking-[0.2em] text-primary">अध्याय एक</span>
      <h3 className="mt-3 font-serif text-xl leading-none">The Garden<br />Path</h3>
      <div className="mt-4 h-px w-7 bg-primary" />
      <p className="mt-5 font-serif text-[7px] leading-relaxed text-ink-soft" style={{ fontFamily: '"Noto Serif Devanagari", serif' }}>
        रचना · the morning was quiet
      </p>
    </div>
  );
}

function ManuscriptPage({ finished = false, compact = false }: { finished?: boolean; compact?: boolean }) {
  return (
    <div className={`relative mx-auto aspect-[3/4] w-full bg-paper text-foreground shadow-page ${compact ? "max-w-72 p-6" : "max-w-sm p-7 sm:p-10"}`}>
      {finished ? (
        <>
          <div className="flex justify-between border-b border-rule/60 pb-2 font-serif text-[8px] uppercase tracking-[0.18em] text-muted-foreground">
            <span>The Architecture of Silence</span>
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
    <section id="content" className="border-b border-border pt-28 lg:min-h-[760px] lg:pt-32">
      <div className="mx-auto max-w-[1440px] px-5 pb-20 md:px-10 lg:px-16">
        {/* Brand — the animated multilingual logo, left-aligned */}
        <div className="reveal overflow-hidden border-b border-foreground/15 py-4 sm:py-6">
          <AnimatedBrand />
        </div>

        {/* Hero content — one clear hierarchy */}
        <div className="reveal grid gap-10 pt-12 lg:grid-cols-12 lg:items-end">
          <div className="lg:col-span-7">
            <p className="mb-6 text-[10px] font-extrabold uppercase tracking-[0.28em] text-primary">
              {t("eyebrow")}
            </p>
            <h1 className="font-serif text-[clamp(3rem,5.5vw,6rem)] font-medium leading-[0.92]">
              {t("titleA")}<br />
              <span className="italic text-primary">{t("titleB")}</span>
            </h1>
            <p className="mt-7 max-w-lg border-l border-foreground pl-6 text-base font-light leading-7 text-muted-foreground">
              {t("subtitle")}
            </p>
            <div id="hero-action" className="mt-8 flex flex-col items-start gap-5 sm:flex-row sm:items-center">
              <PrimaryLink>{t("ctaPrimary")}</PrimaryLink>
              <a href="#how" className="inline-flex items-center gap-2 text-sm font-semibold underline decoration-border">
                {t("ctaSecondary")} <ArrowDown className="size-4" />
              </a>
            </div>
            <p className="mt-7 text-[11px] leading-6 text-muted-foreground">
              {t("priceNote")}
            </p>
          </div>

          {/* Tagline column */}
          <div className="lg:col-span-5 lg:pl-8">
            <div className="border-l-2 border-primary/30 pl-6">
              <p className="font-serif text-2xl italic leading-tight text-muted-foreground">
                {t("taglineA")}<br />{t("taglineB")}
              </p>
              <p className="mt-4 text-sm leading-6 text-muted-foreground/70">
                {t("taglineNote")}
              </p>
            </div>
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
        <SectionLabel num="01" label={t("label")} />
        <h2 className="mt-4 font-serif text-4xl font-medium sm:text-5xl">
          {t("heading")}
        </h2>
        <div className="mt-14 grid gap-px bg-border sm:grid-cols-2 lg:grid-cols-3">
          {featureKeys.map((k, i) => (
            <div key={k} className="bg-background px-6 py-8">
              <div className="flex items-baseline gap-3">
                <span className="font-serif text-2xl italic text-primary/60">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3 className="text-sm font-bold">{t(`${k}Label`)}</h3>
              </div>
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
            <SectionLabel num="02" label={t("label")} />
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
                <p className="mt-5 font-medium">{t(`${k}Body`)}</p>
                <p className="mt-2 max-w-xs text-sm font-light leading-6 text-muted-foreground">{t(`${k}Sub`)}</p>
              </div>
            </article>
          ))}
        </div>
        <p className="mt-7 text-xs uppercase tracking-[0.12em] text-muted-foreground">
          {t("footnote")}
        </p>
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
            <SectionLabel num="03" label={t("label")} />
            <h2 className="mt-4 max-w-2xl font-serif text-5xl sm:text-6xl">{t("heading")}</h2>
          </div>
          <p className="max-w-sm text-sm leading-6 text-forest-foreground/70">
            {t("sub")}
          </p>
        </div>
        <div className="mt-16 grid gap-px bg-forest-foreground/20 sm:grid-cols-2 lg:grid-cols-6">
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
    <section className="px-5 py-24 md:px-10 md:py-32 lg:px-16">
      <div className="mx-auto max-w-[1312px]">
        <SectionLabel num="04" label={t("label")} />
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
          <SectionLabel num="05" label={t("label")} />
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

function Craft() {
  const t = useTranslations("Craft");
  const trimSizes: [string, string][] = [
    ["5 × 8″", t("u1")],
    ["5.5 × 8.5″", t("u2")],
    ["6 × 9″", t("u3")],
    ["8.5 × 11″", t("u4")],
  ];
  return (
    <section className="px-5 py-24 md:px-10 md:py-32 lg:px-16">
      <div className="mx-auto max-w-[1312px]">
        <div className="grid gap-16 lg:grid-cols-2">
          <div>
            <SectionLabel num="06" label={t("label")} />
            <h2 className="mt-4 font-serif text-5xl sm:text-6xl">{t("heading")}</h2>
          </div>
          <div className="max-w-xl leading-8 text-muted-foreground">
            <p>{t("p1")}</p>
            <p className="mt-5">
              {t("p2")}
            </p>
            <p className="mt-5 font-semibold text-foreground">{t("p3")}</p>
          </div>
        </div>

        <div className="mt-20 border-t border-border pt-14">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.36em] text-primary">
            <span className="text-primary/50">07</span> &nbsp;{t("dimsLabel")}
          </p>
          <div className="mt-4 grid gap-10 lg:grid-cols-[1fr_1.2fr]">
            <div>
              <h2 className="font-serif text-5xl">{t("dimsHeading")}</h2>
              <p className="mt-6 max-w-md text-sm leading-6 text-muted-foreground">
                {t("dimsSub")}
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
          <p className="mt-8 text-xs text-muted-foreground">{t("coverNote")}</p>
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
        <SectionLabel num="08" label={t("label")} />
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

function Pricing() {
  const t = useTranslations("Pricing");
  return (
    <section id="pricing" className="bg-primary px-5 py-24 text-primary-foreground md:px-10 md:py-32 lg:px-16">
      <div className="mx-auto grid max-w-5xl gap-14 lg:grid-cols-2 lg:items-center">
        <div>
          <SectionLabel num="09" label={t("label")} />
          <h2 className="mt-4 font-serif text-6xl sm:text-7xl">
            {t("headingA")}<br />{t("headingB")}
          </h2>
          <div className="mt-9 flex items-baseline gap-3">
            <span className="font-serif text-8xl">$29</span>
            <span className="text-sm text-primary-foreground/65">{t("perInterior")}</span>
          </div>
          <p className="mt-6 text-sm font-semibold text-accent">
            {t("tagline")}
          </p>
        </div>
        <div className="border-primary-foreground/25 lg:border-l lg:pl-14">
          <p className="mb-6 text-[11px] font-semibold uppercase tracking-[0.22em] text-accent">
            {t("included")}
          </p>
          <ul className="space-y-4 text-sm">
            {(["i1", "i2", "i3", "i4", "i5", "i6"] as const).map((k) => (
              <li key={k} className="flex gap-3">
                <Check className="size-4 shrink-0 text-accent" />
                {t(k)}
              </li>
            ))}
          </ul>
          <Link
            href="/upload"
            className="mt-9 inline-flex min-h-12 items-center gap-3 rounded-sm bg-primary-foreground px-6 text-sm font-semibold text-primary"
          >
            {t("cta")} <ArrowRight className="size-4" />
          </Link>
          <p className="mt-5 text-xs leading-5 text-primary-foreground/65">
            {t("kdpNote")}
          </p>
        </div>
      </div>
    </section>
  );
}

function Faq() {
  const t = useTranslations("Faq");
  return (
    <section className="px-5 py-24 md:px-10 md:py-32">
      <div className="mx-auto max-w-4xl">
        <SectionLabel num="10" label={t("label")} />
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
    <section className="border-t border-border px-5 py-24 text-center md:py-32">
      <div className="mx-auto max-w-3xl">
        <h2 className="font-serif text-5xl leading-tight sm:text-7xl">
          {t("headingA")}<br />
          <span className="italic text-primary">{t("headingB")}</span>
        </h2>
        <div className="mt-10">
          <PrimaryLink>{t("cta")}</PrimaryLink>
        </div>
        <p className="mt-5 text-xs text-muted-foreground">{t("note")}</p>
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
      ],
    ],
    [
      t("company"),
      [
        [t("about"), "#top"],
        [t("contact"), "#top"],
      ],
    ],
    [
      t("legal"),
      [
        [t("privacy"), "/privacy"],
        [t("terms"), "/terms"],
      ],
    ],
  ];
  return (
    <footer className="bg-foreground px-5 py-16 text-background md:px-10 lg:px-16">
      <div className="mx-auto max-w-[1312px]">
        <div className="grid gap-12 border-b border-background/20 pb-14 md:grid-cols-[2fr_1fr_1fr_1fr]">
          <div>
            <p className="font-serif text-3xl tracking-[0.14em]">RACANA</p>
            <p className="mt-4 text-sm text-background/60">{t("tagline")}</p>
          </div>
          {columns.map(([h, ls]) => (
            <div key={h}>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-background/50">{h}</p>
              <div className="mt-4 flex flex-col gap-3 text-sm">
                {ls.map(([l, href]) => (
                  <a key={l} href={href}>{l}</a>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="flex flex-col justify-between gap-3 pt-6 text-xs text-background/50 sm:flex-row">
          <span>{t("copyright")}</span>
          <span>{t("slogan")}</span>
        </div>
      </div>
    </footer>
  );
}

// --- Page -----------------------------------------------------------------

export default function Index() {
  const t = useTranslations("Hero");
  return (
    <main id="top" className="mobile-safe page-grain overflow-hidden">
      <a
        href="#content"
        className="fixed left-3 top-3 z-[100] -translate-y-24 bg-foreground px-4 py-3 text-xs font-bold text-background focus:translate-y-0"
      >
        {t("skipToContent")}
      </a>
      <LandingHeader />

      <Hero />
      <BuiltForPrint />
      <Method />
      <Styles />
      <BeforeAfter />
      <Promise />
      <Craft />
      <WhoFor />
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
            "@type": "SoftwareApplication",
            name: "Racana",
            applicationCategory: "DesignApplication",
            operatingSystem: "Web",
            description: "Book interior typesetting for independent authors.",
            offers: { "@type": "Offer", price: "29", priceCurrency: "USD" },
          }),
        }}
      />
    </main>
  );
}
