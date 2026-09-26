"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Globe } from "lucide-react";

const LOCALE_COOKIE = "racana_locale";
const LOCALES = ["en", "hi", "ta", "bn"] as const;

/**
 * Simple locale picker. Persists the choice in a cookie that the middleware
 * reads before Accept-Language, then refreshes so server components re-render
 * with the new locale's messages.
 */
export function LanguageSwitcher() {
  const t = useTranslations("LanguageSwitcher");
  const locale = useLocale();
  const router = useRouter();

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const next = e.target.value;
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    router.refresh();
  };

  return (
    <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
      <Globe className="size-3.5" aria-hidden />
      <span className="sr-only">{t("label")}</span>
      <select
        value={locale}
        onChange={handleChange}
        aria-label={t("label")}
        className="cursor-pointer bg-transparent text-sm font-medium outline-none transition-colors hover:text-foreground"
      >
        {LOCALES.map((l) => (
          <option key={l} value={l} className="bg-background text-foreground">
            {t(l)}
          </option>
        ))}
      </select>
    </label>
  );
}
