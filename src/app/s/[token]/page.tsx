import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { ArrowRight, BookOpen } from "lucide-react";
import { getTranslations } from "next-intl/server";
import prisma from "@/lib/db";
import { getAppUrl } from "@/lib/env";

interface ShareParams {
  params: { token: string };
}

async function getSharedJob(token: string) {
  if (!/^[a-f0-9]{24}$/.test(token)) return null;
  return prisma.bookJob.findFirst({
    where: { shareToken: token, status: "ready" },
    include: {
      manuscriptAsset: true,
      structureJson: true,
      templateChoice: true,
      qaReports: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
}

export async function generateMetadata({ params }: ShareParams): Promise<Metadata> {
  const t = await getTranslations("Share");
  const job = await getSharedJob(params.token);
  if (!job) return { title: "Racana" };
  const title =
    job.structureJson?.detectedTitle ||
    job.manuscriptAsset?.fileName?.replace(/\.[^/.]+$/, "") ||
    t("finishedBook");
  const description = t("metaDesc", { title });
  return {
    title: t("metaTitle", { title }),
    description,
    openGraph: { title, description, type: "website" },
    twitter: { card: "summary_large_image", title, description },
  };
}

const BOT_UA = /bot|crawl|spider|facebookexternalhit|twitterbot|slackbot|whatsapp|linkedinbot/i;

export default async function SharePage({ params }: ShareParams) {
  const t = await getTranslations("Share");
  const job = await getSharedJob(params.token);
  if (!job) notFound();

  // Count real human views only — crawler fetches don't tell us anything.
  const ua = headers().get("user-agent") || "";
  if (!BOT_UA.test(ua)) {
    await prisma.analyticsEvent
      .create({
        data: { event: "share_page_view", jobId: job.id, props: { token: params.token } as any },
      })
      .catch(() => {});
  }

  const title =
    job.structureJson?.detectedTitle ||
    job.manuscriptAsset?.fileName?.replace(/\.[^/.]+$/, "") ||
    t("untitled");
  const author = job.structureJson?.detectedAuthor || null;
  const templateName = job.templateChoice?.name || "Classic";
  const pages = job.qaReports?.[0]?.pageCount || job.manuscriptAsset?.pageCountEstimate || null;
  const appUrl = getAppUrl();

  return (
    <main className="flex min-h-screen flex-col bg-[#FDFBF7]">
      <header className="border-b border-[#E8E2D5]">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-5">
          <Link href="/" className="font-serif text-lg font-black tracking-[0.24em] text-[#1C1917]">
            RACANA
          </Link>
          <Link
            href="/upload"
            className="text-xs font-semibold text-[#A34825] underline underline-offset-4"
          >
            {t("makeYourBook")}
          </Link>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col items-center justify-center px-5 py-16">
        <p className="mb-6 text-[10px] font-extrabold uppercase tracking-[0.3em] text-[#A34825]">
          {t("badge")}
        </p>

        {/* The book card */}
        <div className="w-full max-w-md bg-[#1C1917] p-1 shadow-2xl">
          <div className="flex aspect-[3/4.2] flex-col justify-between bg-[#FDFBF7] p-8 sm:p-10">
            <div className="flex items-center justify-between border-b border-[#D6CEBE] pb-3 text-[8px] uppercase tracking-[0.25em] text-[#A8A29E]">
              <span>{t("interiorBy", { name: templateName })}</span>
              <span>{pages ? t("pages", { count: pages }) : t("printReady")}</span>
            </div>
            <div className="flex flex-1 flex-col items-center justify-center text-center">
              <span className="mb-4 text-[9px] uppercase tracking-[0.3em] text-[#A34825]">
                {t("finishedBook")}
              </span>
              <h1 className="font-serif text-3xl font-semibold leading-tight text-[#1C1917] sm:text-4xl">
                {title}
              </h1>
              {author && (
                <p className="mt-4 font-serif text-sm italic text-[#78716C]">{t("byAuthor", { author })}</p>
              )}
              <div className="mx-auto mt-6 h-px w-10 bg-[#A34825]" />
            </div>
            <div className="border-t border-[#D6CEBE] pt-3 text-center text-[8px] uppercase tracking-[0.25em] text-[#A8A29E]">
              racana.studio
            </div>
          </div>
        </div>

        <p className="mt-10 max-w-md text-center text-sm leading-6 text-[#78716C]">
          {t("desc")}
        </p>

        <Link
          href="/upload"
          className="group mt-8 inline-flex items-center gap-3 rounded-xl bg-[#1C1917] px-8 py-4 text-sm font-semibold text-[#F8F5EE] shadow-md transition-all hover:-translate-y-0.5 hover:shadow-lg"
        >
          <BookOpen className="h-4 w-4" />
          {t("cta")}
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
        </Link>
        <p className="mt-4 text-[11px] text-[#A8A29E]">{t("noSignup")} · {appUrl.replace(/^https?:\/\//, "")}</p>
      </div>
    </main>
  );
}
