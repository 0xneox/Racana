"use client";

import Link from "next/link";
import { BookOpen, RotateCcw } from "lucide-react";
import { useTranslations } from "next-intl";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("Errors");
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#FDFBF7] px-6 text-center">
      <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#1C1917] text-[#F8F5EE] shadow-md">
        <BookOpen className="h-7 w-7" />
      </div>
      <p className="mb-2 text-[10px] font-extrabold uppercase tracking-[0.28em] text-[#A34825]">
        {t("somethingWrong")}
      </p>
      <h1 className="font-serif text-4xl font-bold text-[#1C1917]">
        {t("errorTitle")}
      </h1>
      <p className="mt-4 max-w-md text-sm leading-6 text-[#78716C]">
        {t.rich("errorDesc", {
          mail: (chunks) => (
            <a href="mailto:books@racana.pro" className="font-semibold text-[#A34825] underline">
              {chunks}
            </a>
          ),
        })}
      </p>
      {error?.digest && (
        <p className="mt-3 font-mono text-[10px] text-[#A8A29E]">ref: {error.digest}</p>
      )}
      <div className="mt-8 flex items-center gap-4">
        <button
          onClick={reset}
          className="inline-flex items-center gap-2 rounded-xl bg-[#1C1917] px-6 py-3 text-sm font-semibold text-[#F8F5EE] shadow-md transition-all hover:bg-[#2E2824]"
        >
          <RotateCcw className="h-4 w-4" /> {t("tryAgain")}
        </button>
        <Link href="/" className="text-sm font-semibold text-[#57534E] underline">
          {t("backHome")}
        </Link>
      </div>
    </div>
  );
}
